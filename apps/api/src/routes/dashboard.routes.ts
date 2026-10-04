import { Router } from 'express';
import { asyncHandler, ok, AppError } from '../http';
import { requireAuth, type AuthedRequest } from '../auth';
import { effectivePackage, getUsage, getUserWithPackage, limitsFromPackage } from '../limits';
import { prisma } from '../prisma';
import { parseShopeeLiveSessionId, shopee } from '../shopee';
import { revealSecret } from '../secrets';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

function bangkokDayStart(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day')) - 7 * 60 * 60 * 1000);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function thaiShortDay(date: Date, todayKey: string) {
  const key = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  if (key === todayKey) return 'วันนี้';
  return new Intl.DateTimeFormat('th-TH', { weekday: 'short', timeZone: 'Asia/Bangkok' }).format(date);
}

function dayKey(date: Date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

async function activeShopeeStats(userId: string) {
  const channels = await prisma.liveChannel.findMany({
    where: { userId, isOnline: true, liveSessionId: { not: null }, cookie: { not: null } },
    select: { id: true, cookie: true, liveSessionId: true },
  });

  const results = await Promise.all(
    channels.map(async (channel) => {
      const sessionId = parseShopeeLiveSessionId(channel.liveSessionId);
      const cookie = revealSecret(channel.cookie);
      if (!sessionId || !cookie) return null;
      try {
        return await shopee.sessionStats(cookie, sessionId);
      } catch {
        return null;
      }
    }),
  );

  return results.filter((item): item is NonNullable<typeof item> => Boolean(item));
}

async function dashboardPerformance(userId: string) {
  const todayStart = bangkokDayStart();
  const todayKey = dayKey(todayStart);
  const weekStart = addDays(todayStart, -6);
  const tomorrowStart = addDays(todayStart, 1);
  const [liveStats, snapshots, todayReruns, activeReruns] = await Promise.all([
    activeShopeeStats(userId),
    prisma.liveGmvSnapshot.findMany({
      where: {
        capturedAt: { gte: weekStart, lt: tomorrowStart },
        liveChannelId: { in: (await prisma.liveChannel.findMany({ where: { userId }, select: { id: true } })).map((item) => item.id) },
      },
      orderBy: { capturedAt: 'asc' },
    }),
    prisma.rerun.findMany({
      where: {
        userId,
        OR: [
          { startedAt: { gte: todayStart, lt: tomorrowStart } },
          { stoppedAt: { gte: todayStart, lt: tomorrowStart } },
          { status: { in: ['STARTING', 'LIVE'] } },
        ],
      },
      select: { startedAt: true, stoppedAt: true, status: true },
    }),
    prisma.rerun.count({ where: { userId, status: { in: ['STARTING', 'LIVE'] } } }),
  ]);

  const rows = new Map<string, { label: string; values: number[]; orders: number; liveHours: number }>();
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(weekStart, i);
    rows.set(dayKey(date), { label: thaiShortDay(date, todayKey), values: [], orders: 0, liveHours: 0 });
  }

  for (const snapshot of snapshots) {
    const row = rows.get(dayKey(snapshot.capturedAt));
    if (row) row.values.push(Number(snapshot.gmv || 0));
  }

  let liveSeconds = 0;
  const now = new Date();
  for (const rerun of todayReruns) {
    const startedAt = rerun.startedAt && rerun.startedAt > todayStart ? rerun.startedAt : todayStart;
    const stoppedAt = rerun.stoppedAt ?? (['STARTING', 'LIVE'].includes(rerun.status) ? now : null);
    if (!rerun.startedAt || !stoppedAt || stoppedAt < todayStart) continue;
    liveSeconds += Math.max(0, Math.min(stoppedAt.getTime(), tomorrowStart.getTime()) - startedAt.getTime()) / 1000;
  }

  const activeSales = liveStats.reduce((sum, item) => sum + Number(item.totalSales || 0), 0);
  const activeOrders = liveStats.reduce((sum, item) => sum + Number(item.orders || 0), 0);
  const activeViewers = liveStats.reduce((sum, item) => sum + Number(item.viewers || 0), 0);
  const activeSalesPerHour = liveStats.reduce((sum, item) => sum + Number(item.salesPerHour || 0), 0);

  const trend = [...rows.entries()].map(([key, row]) => {
    const sales = row.values.length > 1 ? Math.max(0, Math.max(...row.values) - Math.min(...row.values)) : 0;
    return {
      label: row.label,
      sales,
      orders: key === todayKey ? activeOrders : row.orders,
      liveHours: key === todayKey ? Number((liveSeconds / 3600).toFixed(1)) : row.liveHours,
    };
  });

  const todayTrend = trend.find((item) => item.label === 'วันนี้');
  const totalSales = activeSales || todayTrend?.sales || 0;
  const liveHours = Number((liveSeconds / 3600).toFixed(1));

  return {
    totalSales,
    orders: activeOrders,
    viewers: activeViewers,
    liveHours,
    salesPerHour: activeSalesPerHour || (liveHours > 0 ? totalSales / liveHours : 0),
    conversionRate: activeViewers > 0 ? Number(((activeOrders / activeViewers) * 100).toFixed(2)) : 0,
    activeLives: activeReruns,
    revenueTarget: 0,
    orderTarget: 0,
    trend,
  };
}

dashboardRouter.get(
  '/summary',
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await getUserWithPackage(req.userId!);
    if (!user) throw new AppError('ไม่พบผู้ใช้', 404);

    const pkg = effectivePackage(user);
    const limits = limitsFromPackage(pkg);
    const usage = await getUsage(user.id);
    const [
      activeLive,
      endedLive,
      failedLive,
      readyAccounts,
      needsCookie,
      autoLiveChannels,
      readyVideos,
      processingVideos,
      failedVideos,
      basketSources,
      recentSessions,
      performance,
    ] = await Promise.all([
      prisma.rerun.count({ where: { userId: user.id, status: { in: ['STARTING', 'LIVE'] } } }),
      prisma.rerun.count({ where: { userId: user.id, status: 'ENDED' } }),
      prisma.rerun.count({ where: { userId: user.id, status: 'FAILED' } }),
      prisma.liveChannel.count({ where: { userId: user.id, cookieValid: { not: false }, cookie: { not: null } } }),
      prisma.liveChannel.count({ where: { userId: user.id, OR: [{ cookieValid: false }, { cookie: null }] } }),
      prisma.liveChannel.count({ where: { userId: user.id, autoLive: true } }),
      prisma.video.count({ where: { userId: user.id, status: 'READY' } }),
      prisma.video.count({ where: { userId: user.id, status: { in: ['PENDING', 'PROCESSING'] } } }),
      prisma.video.count({ where: { userId: user.id, status: 'FAILED' } }),
      prisma.liveChannel.findMany({ where: { userId: user.id }, select: { basketItemsJson: true } }),
      prisma.rerun.findMany({
        where: { userId: user.id, status: { in: ['STARTING', 'LIVE'] } },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          startedAt: true,
          updatedAt: true,
          errorMessage: true,
          liveChannel: { select: { name: true, accountName: true, liveSessionId: true } },
          video: { select: { title: true } },
        },
      }),
      dashboardPerformance(user.id),
    ]);
    const basketItems = basketSources.reduce((total, item) => {
      try {
        const parsed = JSON.parse(item.basketItemsJson || '[]');
        return total + (Array.isArray(parsed) ? parsed.length : 0);
      } catch {
        return total;
      }
    }, 0);

    return ok(res, {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
      stats: {
        accounts: usage.accounts,
        proxies: usage.proxies,
        liveChannels: usage.liveChannels,
        videos: usage.videos,
      },
      operations: {
        activeLive,
        endedLive,
        failedLive,
        readyAccounts,
        needsCookie,
        autoLiveChannels,
        readyVideos,
        processingVideos,
        failedVideos,
        basketItems,
      },
      recentSessions: recentSessions.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        accountName: item.liveChannel.accountName ?? item.liveChannel.name ?? null,
        videoTitle: item.video.title ?? null,
        sessionId: item.liveChannel.liveSessionId ?? null,
        startedAt: item.startedAt,
        updatedAt: item.updatedAt,
        errorMessage: item.errorMessage ?? null,
      })),
      performance,
      package: {
        id: pkg?.id ?? null,
        name: pkg?.name ?? 'ยังไม่มีแพ็กเกจ',
        code: pkg?.code ?? 'FREE',
        startedAt: user.packageStartedAt,
        expiresAt: user.packageExpiresAt,
        priceBaht: pkg?.priceBaht,
        durationDays: pkg?.durationDays,
        limits: {
          accounts: limits.accounts,
          liveChannels: limits.liveChannels,
          videos: limits.videos,
          storageGb: limits.storageGb,
          proxies: limits.proxies,
        },
      },
    });
  }),
);
