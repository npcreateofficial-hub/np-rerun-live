import express from 'express';
import type { Response } from 'express';
import cors from 'cors';
import { Router } from 'express';
import { config } from './config';
import { errorHandler, notFound, ok } from './http';
import { ensureUploadDir } from './uploads';
import { prisma } from './prisma';
import { reconcileOnBoot } from './rerun-engine';
import { resumeAiCommentReplyLoopsOnBoot } from './ai-comment-reply-loop';
import { startHourlySalesScheduler } from './hourly-sales';
import { startAdsAutomationScheduler } from './ads-automation-scheduler';
import { shopee } from './shopee';
import { mediaFileGuard, noStoreApi, rateLimit, securityHeaders } from './security';

import { authRouter } from './routes/auth.routes';
import { usersRouter } from './routes/users.routes';
import { packagesRouter } from './routes/packages.routes';
import { proxiesRouter } from './routes/proxies.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { liveChannelsRouter } from './routes/live-channels.routes';
import { videosRouter } from './routes/videos.routes';
import { storageRouter } from './routes/storage.routes';
import { rerunsRouter } from './routes/reruns.routes';
import { adminRouter } from './routes/admin.routes';
import { notificationsRouter } from './routes/notifications.routes';
import { paymentsRouter } from './routes/payments.routes';
import { adsAccountsRouter } from './routes/ads-accounts.routes';

const app = express();

app.disable('x-powered-by');
app.use(securityHeaders);
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: config.corsCredentials,
  }),
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const apiRateLimit = rateLimit({ windowMs: 60_000, max: 600, keyPrefix: 'api' });
const authRateLimit = rateLimit({ windowMs: 15 * 60_000, max: 30, keyPrefix: 'auth' });
const shopeeActionRateLimit = rateLimit({ windowMs: 60_000, max: 60, keyPrefix: 'shopee-action' });
const adsAccountsReadRateLimit = rateLimit({ windowMs: 60_000, max: 240, keyPrefix: 'ads-accounts-read' });
const uploadRateLimit = rateLimit({ windowMs: 60 * 60_000, max: 20, keyPrefix: 'upload' });
const uploadedMediaStaticOptions = {
  fallthrough: true,
  immutable: true,
  maxAge: '30d',
  setHeaders(res: Response) {
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
  },
};

const api = Router();

api.use(noStoreApi);
api.get('/health', (_req, res) => ok(res, { status: 'ok', shopeeMode: shopee.mode }, 'healthy'));

api.use('/auth', authRateLimit, authRouter);
api.use('/users', usersRouter);
api.use('/packages', packagesRouter);
api.use('/proxies', proxiesRouter);
api.use('/dashboard', dashboardRouter);
api.use('/live-channels', shopeeActionRateLimit, liveChannelsRouter);
api.use('/videos/upload', uploadRateLimit);
api.use('/videos', videosRouter);
api.use('/storage', storageRouter);
api.use('/reruns', shopeeActionRateLimit, rerunsRouter);
api.use('/notifications', notificationsRouter);
api.use('/payments', paymentsRouter);
api.use('/ads-accounts', (req, res, next) => (
  req.method === 'GET' ? adsAccountsReadRateLimit(req, res, next) : shopeeActionRateLimit(req, res, next)
), adsAccountsRouter);
api.use('/admin', adminRouter);

const npSegments: Record<string, string> = {
  h0: 'health',
  a1: 'auth',
  u2: 'users',
  p3: 'packages',
  x4: 'proxies',
  d5: 'dashboard',
  l6: 'live-channels',
  v7: 'videos',
  s8: 'storage',
  r9: 'reruns',
  n10: 'notifications',
  m11: 'payments',
  z12: 'admin',
  y13: 'ads-accounts',
  k01: 'register',
  k02: 'login',
  k03: 'refresh',
  k04: 'logout',
  k05: 'me',
  k06: 'permissions',
  k07: 'profile',
  k08: 'password',
  k09: 'usage',
  k10: 'check-cookie',
  k11: 'coupons',
  k12: 'items',
  k13: 'basket',
  k14: 'show',
  k15: 'show-loop',
  k16: 'stop',
  k17: 'status',
  k18: 'upload',
  k19: 'convert',
  k20: 'hls',
  k21: 'folders',
  k22: 'files',
  k23: 'active',
  k24: 'stats',
  k25: 'summary',
  k26: 'all',
  k27: 'current',
  k28: 'select',
  k29: 'buy',
  k30: 'check',
  k31: 'read',
  k32: 'secrets',
  k33: 'capabilities',
};

function decodeNpUrl(url: string) {
  const [path, query] = url.split('?');
  const decodedPath = path
    .split('/')
    .map((segment) => npSegments[segment] ?? segment)
    .join('/');

  return query ? `${decodedPath}?${query}` : decodedPath;
}

app.get('/', (_req, res) =>
  ok(
    res,
    {
      status: 'ok',
      service: 'NP LIVE API',
      apiBase: '/api/NP',
      health: '/api/NP/h0',
      shopeeMode: shopee.mode,
    },
    'API พร้อมใช้งาน',
  ),
);

app.use('/api/NP', apiRateLimit, (req, res, next) => {
  req.url = decodeNpUrl(req.url);
  api(req, res, next);
});

if (process.env.NP_LEGACY_API === 'true') {
  app.use('/api', apiRateLimit, api);
}

app.use('/api/NP/uploads', mediaFileGuard, express.static(config.uploadDir, uploadedMediaStaticOptions));

app.use('/api/NP', notFound);
app.use('/api', notFound);

// Serve uploaded media so the <video> preview and rerun engine can read files.
// Frontend builds preview URLs as `${apiOrigin}/${fileKey}`, so serve at root.
// express.static supports HTTP range requests (needed for video seeking).
app.use(mediaFileGuard, express.static(config.uploadDir, uploadedMediaStaticOptions));
app.use('/uploads', mediaFileGuard, express.static(config.uploadDir, uploadedMediaStaticOptions));

app.use(notFound);
app.use(errorHandler);

async function bootstrap() {
  ensureUploadDir();
  await prisma.$connect();
  await reconcileOnBoot();
  await resumeAiCommentReplyLoopsOnBoot();
  startHourlySalesScheduler();
  startAdsAutomationScheduler();

  const server = app.listen(config.port, () => {
    console.log(`\n  NP LIVE API listening on http://localhost:${config.port}/api/NP`);
    console.log(`  Shopee mode: ${shopee.mode.toUpperCase()}  |  FFmpeg loop: ${config.rerunLoop}\n`);
  });

  server.requestTimeout = config.uploadTimeoutMs;
  server.timeout = config.uploadTimeoutMs;
  server.headersTimeout = Math.max(60_000, Math.min(config.uploadTimeoutMs, 120_000));
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

