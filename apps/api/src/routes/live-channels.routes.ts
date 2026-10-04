import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { AppError, asyncHandler, ok } from '../http';
import { requireAuth, type AuthedRequest } from '../auth';
import { canCreateWithinLimit, effectivePackage, getUsage, getUserWithPackage, limitsFromPackage, remainingForLimit } from '../limits';
import { parseShopeeBasketItems, parseShopeeLiveSessionId, shopee, type ShopeeBasketItem } from '../shopee';
import { isProductShowLoopRunning, startProductShowLoopForChannel, stopProductShowLoopForChannel } from '../product-show-loop';
import { startAiCommentReplyLoopForChannel, stopAiCommentReplyLoopForChannel } from '../ai-comment-reply-loop';

export const liveChannelsRouter = Router();

const SHOPEE_MAX_LIVE_MINUTES = 23 * 60 + 59;

liveChannelsRouter.use(requireAuth);

/** Never expose the raw cookie/streamKey more than necessary is acceptable here
 * because the frontend UI shows/copies the cookie; we return the full row. */
async function ownedChannel(userId: string, id: string) {
  const channel = await prisma.liveChannel.findFirst({ where: { id, userId } });
  if (!channel) throw new AppError('ไม่พบช่องไลฟ์', 404);
  return channel;
}

liveChannelsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const items = await prisma.liveChannel.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, items.map((item) => ({
      ...item,
      liveSessionId: item.isOnline ? item.liveSessionId : null,
      rtmpUrl: item.isOnline ? item.rtmpUrl : null,
      streamKey: item.isOnline ? item.streamKey : null,
    })));
  }),
);

liveChannelsRouter.get(
  '/usage',
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await getUserWithPackage(req.userId!);
    const limits = limitsFromPackage(effectivePackage(user));
    const usage = await getUsage(req.userId!);
    const remaining = remainingForLimit(limits.liveChannels, usage.liveChannels);
    return ok(res, { used: usage.liveChannels, limit: limits.liveChannels, remaining, canCreate: canCreateWithinLimit(limits.liveChannels, usage.liveChannels) });
  }),
);

const cookieSchema = z.object({
  platform: z.string().default('SHOPEE'),
  cookie: z.string().min(1, 'กรุณาวางคุกกี้'),
  sessionId: z.string().nullish(),
  liveSessionId: z.string().nullish(),
  liveUrl: z.string().nullish(),
  proxyId: z.string().nullish(),
});

const aiKeySchema = z.object({
  apiKey: z.string().trim().min(1, 'กรุณากรอก OpenAI API key'),
});

async function checkOpenAiApiKey(apiKey: string) {
  const key = apiKey.trim();
  if (!key) throw new AppError('กรุณากรอก OpenAI API key', 400);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch('https://api.openai.com/v1/models/gpt-4o-mini', {
      headers: { authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    if (response.ok) return { valid: true, model: 'gpt-4o-mini' };

    const text = await response.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // keep raw text below
    }
    const message = json?.error?.message || text.slice(0, 240) || `OpenAI HTTP ${response.status}`;
    throw new AppError(`OpenAI API key ใช้งานไม่ได้: ${message}`, 400);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(error instanceof Error && error.name === 'AbortError'
      ? 'ตรวจสอบ OpenAI API key ไม่สำเร็จ: OpenAI ไม่ตอบกลับในเวลาที่กำหนด'
      : `ตรวจสอบ OpenAI API key ไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`, 400);
  } finally {
    clearTimeout(timer);
  }
}

liveChannelsRouter.post(
  '/check-cookie',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = cookieSchema.parse(req.body);
    const result = await shopee.checkCookie(body.platform, body.cookie);
    return ok(res, result, result.valid ? 'ตรวจคุกกี้สำเร็จ' : (result.message ?? 'คุกกี้ใช้ไม่ได้'));
  }),
);

liveChannelsRouter.post(
  '/check-ai-key',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = aiKeySchema.parse(req.body);
    const result = await checkOpenAiApiKey(body.apiKey);
    return ok(res, result, 'พร้อมใช้งาน (gpt-4o-mini)');
  }),
);

liveChannelsRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = cookieSchema.parse(req.body);

    const user = await getUserWithPackage(req.userId!);
    const limits = limitsFromPackage(effectivePackage(user));
    const usage = await getUsage(req.userId!);
    if (!canCreateWithinLimit(limits.liveChannels, usage.liveChannels)) {
      throw new AppError('จำนวนช่องไลฟ์เต็มโควตาแพ็กเกจแล้ว', 403);
    }

    if (body.proxyId) {
      const proxy = await prisma.proxy.findFirst({ where: { id: body.proxyId, userId: req.userId } });
      if (!proxy) throw new AppError('ไม่พบพร็อกซี่ที่เลือก', 400);
    }

    const check = await shopee.checkCookie(body.platform, body.cookie);
    if (!check.valid) throw new AppError(check.message ?? 'คุกกี้ใช้ไม่ได้ ไม่สามารถเพิ่มบัญชีได้', 400);

    const channel = await prisma.liveChannel.create({
      data: {
        userId: req.userId!,
        name: check.accountName ?? check.name ?? `บัญชี ${check.platformUid ?? ''}`.trim(),
        platform: body.platform,
        cookie: body.cookie,
        cookieValid: check.valid,
        proxyId: body.proxyId ?? null,
        accountName: check.accountName ?? check.name ?? null,
        shopId: check.shopId ?? null,
        platformUid: check.platformUid ?? check.userId ?? null,
        avatar: check.avatar ?? null,
        liveSessionId: parseShopeeLiveSessionId(body.liveSessionId ?? body.sessionId ?? body.liveUrl),
        status: 'CONNECTED',
        lastCheckedAt: new Date(),
      },
    });

    return ok(res, channel, 'เพิ่มบัญชีสำเร็จ', 201);
  }),
);


liveChannelsRouter.get(
  '/:id/insights',
  asyncHandler(async (req: AuthedRequest, res) => {
    const channel = await ownedChannel(req.userId!, req.params.id);
    const latestRerun = await prisma.rerun.findFirst({
      where: { liveChannelId: channel.id, userId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: { video: { select: { id: true, title: true } } },
    });
    const activeRerun = await prisma.rerun.findFirst({
      where: { liveChannelId: channel.id, userId: req.userId, status: { in: ['STARTING', 'LIVE', 'STOPPING'] } },
      orderBy: { createdAt: 'desc' },
      include: { video: { select: { id: true, title: true } } },
    });
    const rerun = activeRerun ?? latestRerun;
    const sessionId = parseShopeeLiveSessionId(channel.liveSessionId ?? null);
    const startedAt = rerun?.startedAt ?? null;
    const stoppedAt = channel.isOnline ? null : (rerun?.stoppedAt ?? null);
    const fallbackSeconds = channel.isOnline && startedAt
      ? Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
      : rerun?.durationSec ?? (startedAt
        ? Math.max(0, Math.floor(((stoppedAt ? new Date(stoppedAt).getTime() : Date.now()) - new Date(startedAt).getTime()) / 1000))
        : 0);

    let stats = {
      sessionId,
      isLive: Boolean(channel.isOnline || activeRerun),
      status: channel.isOnline || activeRerun ? 'LIVE' : 'NOTLIVE',
      liveSeconds: fallbackSeconds,
      totalSales: 0,
      salesPerHour: 0,
      viewers: 0,
      orders: 0,
      productsSold: 0,
      buyers: 0,
      addedToCart: 0,
      currentViewers: 0,
      peakViewers: 0,
      views: 0,
      averageWatchSeconds: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      newFollowers: 0,
      updatedAt: new Date().toISOString(),
      source: sessionId ? 'local-fallback' : 'no-session',
    };

    if (channel.cookie && sessionId) {
      try {
        const liveStats = await shopee.sessionStats(channel.cookie, sessionId);
        stats = {
          ...stats,
          ...liveStats,
          liveSeconds: liveStats.liveSeconds || fallbackSeconds,
          isLive: liveStats.isLive || Boolean(channel.isOnline || activeRerun),
          status: liveStats.status || stats.status,
        };
      } catch {
        stats = { ...stats, source: 'local-fallback-after-shopee-error' };
      }
    }

    const maxLiveSeconds = 23 * 60 * 60 + 59 * 60;
    const remainingSafeSeconds = Math.max(0, maxLiveSeconds - stats.liveSeconds);
    return ok(res, {
      channelId: channel.id,
      channelName: channel.accountName ?? channel.name,
      platform: channel.platform,
      liveSessionId: sessionId,
      startedAt,
      rerun: rerun
        ? {
            id: rerun.id,
            title: rerun.title,
            status: rerun.status,
            videoTitle: rerun.video?.title ?? null,
            startedAt: rerun.startedAt,
            stoppedAt: rerun.stoppedAt,
          }
        : null,
      stats,
      limit: {
        maxLiveSeconds,
        remainingSafeSeconds,
        warning: stats.liveSeconds >= 22 * 60 * 60,
        exceeded: stats.liveSeconds >= maxLiveSeconds,
      },
    }, 'โหลดข้อมูลเชิงลึกสำเร็จ');
  }),
);
const showItemSchema = z.object({
  clear: z.boolean().optional(),
  productUrl: z.string().nullish(),
  shopId: z.union([z.string(), z.number()]).nullish(),
  itemId: z.union([z.string(), z.number()]).nullish(),
  item: z.object({
    shop_id: z.union([z.string(), z.number()]).nullish(),
    item_id: z.union([z.string(), z.number()]),
    url: z.string().nullish(),
    campaign_token: z.string().nullish(),
  }).passthrough().nullish(),
});

const showLoopSchema = z.object({
  defaultSeconds: z.number().int().min(1).max(24 * 60 * 60).optional(),
});

function requireShopeeLiveSession(channel: Awaited<ReturnType<typeof ownedChannel>>) {
  if (channel.platform !== 'SHOPEE') throw new AppError('บัญชีนี้ไม่ใช่ Shopee', 400);
  if (channel.cookieValid === false) throw new AppError('คุกกี้ของบัญชีนี้ใช้ไม่ได้ กรุณาเชื่อมบัญชีใหม่', 400);
  if (!channel.cookie) throw new AppError('บัญชีนี้ไม่มีคุกกี้ Shopee', 400);
  const sessionId = parseShopeeLiveSessionId(channel.liveSessionId ?? null);
  if (!sessionId) throw new AppError('ยังไม่มี Shopee Live session สำหรับบัญชีนี้', 400);
  return sessionId;
}

function requireShopeeCookie(channel: Awaited<ReturnType<typeof ownedChannel>>) {
  if (channel.platform !== 'SHOPEE') throw new AppError('บัญชีนี้ไม่ใช่ Shopee', 400);
  if (channel.cookieValid === false) throw new AppError('คุกกี้ของบัญชีนี้ใช้ไม่ได้ กรุณาเชื่อมบัญชีใหม่', 400);
  if (!channel.cookie) throw new AppError('บัญชีนี้ไม่มีคุกกี้ Shopee', 400);
}

function showItemFromBody(body: z.infer<typeof showItemSchema>): ShopeeBasketItem | null {
  if (body.clear) return null;
  if (body.item?.item_id) {
    const shopId = Number(body.item.shop_id ?? body.shopId);
    const itemId = Number(body.item.item_id);
    const next: ShopeeBasketItem = {
      shop_id: Number.isSafeInteger(shopId) && shopId > 0 ? shopId : 0,
      item_id: itemId,
    };
    if (body.item.url) next.url = String(body.item.url);
    if (body.item.campaign_token) next.campaign_token = String(body.item.campaign_token);
    return next;
  }
  const productUrl = body.productUrl?.trim() || '';
  const parsed = productUrl ? parseShopeeBasketItems(productUrl, null) : [];
  if (parsed[0]) return parsed[0];
  const shopId = Number(body.shopId);
  const itemId = Number(body.itemId);
  if (Number.isSafeInteger(itemId) && itemId > 0) {
    const next: ShopeeBasketItem = {
      shop_id: Number.isSafeInteger(shopId) && shopId > 0 ? shopId : 0,
      item_id: itemId,
    };
    if (productUrl) next.url = productUrl;
    return next;
  }
  throw new AppError('กรุณาส่งสินค้าเป็น productUrl หรือ shopId/itemId หรือ item', 400);
}

const productDetailsSchema = z.object({
  productUrl: z.string().nullish(),
  productUrls: z.array(z.string()).optional(),
  shopId: z.union([z.string(), z.number()]).nullish(),
  itemId: z.union([z.string(), z.number()]).nullish(),
  items: z.array(z.object({
    shop_id: z.union([z.string(), z.number()]).nullish(),
    item_id: z.union([z.string(), z.number()]),
    url: z.string().nullish(),
    campaign_token: z.string().nullish(),
  }).passthrough()).optional(),
});

function productDetailsInputFromBody(body: z.infer<typeof productDetailsSchema>) {
  const links = [body.productUrl, ...(body.productUrls ?? [])]
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  const items: ShopeeBasketItem[] = [];

  for (const link of links) items.push(...parseShopeeBasketItems(link, null));
  for (const item of body.items ?? []) {
    const itemId = Number(item.item_id);
    if (!Number.isSafeInteger(itemId) || itemId <= 0) continue;
    const shopId = Number(item.shop_id);
    const next: ShopeeBasketItem = {
      shop_id: Number.isSafeInteger(shopId) && shopId > 0 ? shopId : 0,
      item_id: itemId,
    };
    if (item.url) next.url = String(item.url);
    if (item.campaign_token) next.campaign_token = String(item.campaign_token);
    items.push(next);
  }

  const shopId = Number(body.shopId);
  const itemId = Number(body.itemId);
  if (Number.isSafeInteger(itemId) && itemId > 0) {
    items.push({
      shop_id: Number.isSafeInteger(shopId) && shopId > 0 ? shopId : 0,
      item_id: itemId,
      ...(links[0] ? { url: links[0] } : {}),
    });
  }

  return { items, links };
}

liveChannelsRouter.post(
  '/:id/product-details',
  asyncHandler(async (req: AuthedRequest, res) => {
    const channel = await ownedChannel(req.userId!, req.params.id);
    requireShopeeCookie(channel);
    const sessionId = parseShopeeLiveSessionId(channel.liveSessionId ?? null);
    const body = productDetailsSchema.parse(req.body);
    const { items, links } = productDetailsInputFromBody(body);
    if (!items.length && !links.length) throw new AppError('กรุณาส่งลิงก์สินค้า หรือ shopId/itemId หรือ items', 400);
    const result = await shopee.productDetails(channel.cookie!, sessionId, items, links);
    return ok(res, result, 'โหลดรายละเอียดสินค้า Shopee สำเร็จ');
  }),
);

liveChannelsRouter.post(
  '/:id/screen-rankings',
  asyncHandler(async (req: AuthedRequest, res) => {
    const channel = await ownedChannel(req.userId!, req.params.id);
    requireShopeeCookie(channel);
    const sessionId = parseShopeeLiveSessionId(channel.liveSessionId ?? null);
    const body = productDetailsSchema.parse(req.body);
    const { items, links } = productDetailsInputFromBody(body);
    if (!items.length && !links.length) throw new AppError('กรุณาส่งลิงก์สินค้า หรือ shopId/itemId หรือ items', 400);
    const result = await shopee.productScreenRankings(channel.cookie!, sessionId, items, links);
    return ok(res, result, 'โหลดอันดับจอ Shopee สำเร็จ');
  }),
);
liveChannelsRouter.get(
  '/:id/basket-items',
  asyncHandler(async (req: AuthedRequest, res) => {
    const channel = await ownedChannel(req.userId!, req.params.id);
    const sessionId = requireShopeeLiveSession(channel);
    const result = await shopee.basketItems(channel.cookie!, sessionId);
    return ok(res, result, 'โหลดสินค้าในตะกร้า Shopee Live สำเร็จ');
  }),
);

liveChannelsRouter.post(
  '/:id/show-item',
  asyncHandler(async (req: AuthedRequest, res) => {
    const channel = await ownedChannel(req.userId!, req.params.id);
    const sessionId = requireShopeeLiveSession(channel);
    const body = showItemSchema.parse(req.body);
    const item = showItemFromBody(body);
    const result = await shopee.showBasketItem(channel.cookie!, sessionId, item);
    return ok(res, result, result.cleared ? 'ล้างสินค้าที่แสดงบนไลฟ์สำเร็จ' : 'แสดงสินค้าบนไลฟ์สำเร็จ');
  }),
);

liveChannelsRouter.get(
  '/:id/show-loop',
  asyncHandler(async (req: AuthedRequest, res) => {
    const channel = await ownedChannel(req.userId!, req.params.id);
    return ok(res, { liveChannelId: channel.id, running: isProductShowLoopRunning(channel.id) }, 'โหลดสถานะปักหมุดสำเร็จ');
  }),
);

liveChannelsRouter.post(
  '/:id/show-loop/start',
  asyncHandler(async (req: AuthedRequest, res) => {
    await ownedChannel(req.userId!, req.params.id);
    const body = showLoopSchema.parse(req.body ?? {});
    const result = await startProductShowLoopForChannel(req.userId!, req.params.id, { defaultSeconds: body.defaultSeconds });
    return ok(res, result, 'เริ่มปักหมุดสินค้าอัตโนมัติสำเร็จ');
  }),
);

liveChannelsRouter.post(
  '/:id/show-loop/stop',
  asyncHandler(async (req: AuthedRequest, res) => {
    const channel = await ownedChannel(req.userId!, req.params.id);
    const stopped = await stopProductShowLoopForChannel(channel.id);
    if (channel.cookie && channel.liveSessionId) {
      await shopee.showBasketItem(channel.cookie, channel.liveSessionId, null).catch(() => undefined);
    }
    return ok(res, { liveChannelId: channel.id, running: false, stopped }, 'หยุดปักหมุดสินค้าอัตโนมัติสำเร็จ');
  }),
);
liveChannelsRouter.get(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    return ok(res, await ownedChannel(req.userId!, req.params.id));
  }),
);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  cookie: z.string().nullish(),
  proxyId: z.string().nullish(),
  platform: z.string().optional(),
  rtmpUrl: z.string().nullish(),
  streamKey: z.string().nullish(),
  sessionId: z.string().nullish(),
  liveSessionId: z.string().nullish(),
  liveUrl: z.string().nullish(),
  coverImageUrl: z.string().nullish(),
  basketLinks: z.string().nullish(),
  basketItemsJson: z.string().nullish(),
  aiCommentApiKey: z.string().nullish(),
  aiCommentAutoReply: z.boolean().nullish(),
  videoQueueJson: z.string().nullish(),
  caption: z.string().nullish(),
  description: z.string().nullish(),
  autoLive: z.boolean().nullish(),
  liveDurationMinutes: z.number().int().min(1).max(SHOPEE_MAX_LIVE_MINUTES).nullish(),
  restartDelayMinutes: z.number().int().nullish(),
  scheduledStartAt: z.string().datetime().nullish(),
  scheduledStopAt: z.string().datetime().nullish(),
});

liveChannelsRouter.patch(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const channel = await ownedChannel(req.userId!, req.params.id);
    const body = updateSchema.parse(req.body);
    const sessionPatch =
      body.liveSessionId !== undefined
        ? parseShopeeLiveSessionId(body.liveSessionId)
        : body.sessionId !== undefined
          ? parseShopeeLiveSessionId(body.sessionId)
          : body.liveUrl !== undefined
            ? parseShopeeLiveSessionId(body.liveUrl)
            : undefined;

    const liveDurationMinutes = body.liveDurationMinutes === undefined
      ? undefined
      : body.liveDurationMinutes === null
        ? null
        : Math.min(Math.max(body.liveDurationMinutes, 1), SHOPEE_MAX_LIVE_MINUTES);

    const nextScheduledStartAt = body.scheduledStartAt ? new Date(body.scheduledStartAt) : null;
    const nextScheduledStopAt = body.scheduledStopAt ? new Date(body.scheduledStopAt) : null;
    if (nextScheduledStartAt && nextScheduledStopAt) {
      const minutes = Math.floor((nextScheduledStopAt.getTime() - nextScheduledStartAt.getTime()) / 60_000);
      if (minutes > SHOPEE_MAX_LIVE_MINUTES) {
        throw new AppError('เวลาลงไลฟ์ต้องไม่เกิน 23:59 ชั่วโมงหลังขึ้นไลฟ์ เพื่อไม่ให้เกินลิมิต Shopee', 400);
      }
      if (minutes <= 0) {
        throw new AppError('เวลาลงไลฟ์ต้องมากกว่าเวลาขึ้นไลฟ์', 400);
      }
    }

    const nextAiCommentApiKey = body.aiCommentApiKey === undefined ? undefined : body.aiCommentApiKey?.trim() || null;
    if (nextAiCommentApiKey) {
      await checkOpenAiApiKey(nextAiCommentApiKey);
    }

    // Re-validate cookie if it changed
    let cookieValid = channel.cookieValid;
    let accountPatch: Record<string, unknown> = {};
    if (body.cookie && (body.cookie !== channel.cookie || channel.cookieValid !== true)) {
      const check = await shopee.checkCookie(body.platform ?? channel.platform, body.cookie);
      cookieValid = check.valid;
      if (check.valid) {
        accountPatch = {
          accountName: check.accountName ?? check.name ?? channel.accountName,
          shopId: check.shopId ?? channel.shopId,
          platformUid: check.platformUid ?? check.userId ?? channel.platformUid,
          avatar: check.avatar ?? channel.avatar,
          lastCheckedAt: new Date(),
        };
      }
    }

            const updateData = {
      name: body.name,
      cookie: body.cookie ?? undefined,
      cookieValid,
      proxy: body.proxyId === undefined ? undefined : body.proxyId ? { connect: { id: body.proxyId } } : { disconnect: true },
      platform: body.platform,
      rtmpUrl: body.rtmpUrl === undefined ? undefined : body.rtmpUrl,
      streamKey: body.streamKey === undefined ? undefined : body.streamKey,
      liveSessionId: sessionPatch === undefined ? undefined : sessionPatch,
      isOnline: sessionPatch === undefined ? undefined : Boolean(sessionPatch),
      coverImageUrl: body.coverImageUrl ?? undefined,
      basketLinks: body.basketLinks === undefined ? undefined : body.basketLinks,
      basketItemsJson: body.basketItemsJson === undefined ? undefined : body.basketItemsJson,
      aiCommentApiKey: body.aiCommentApiKey === undefined ? undefined : nextAiCommentApiKey,
      aiCommentAutoReply: body.aiCommentAutoReply ?? undefined,
      videoQueueJson: body.videoQueueJson === undefined ? undefined : body.videoQueueJson,
      caption: body.caption ?? undefined,
      description: body.description ?? undefined,
      autoLive: body.autoLive ?? undefined,
      liveDurationMinutes: liveDurationMinutes ?? undefined,
      restartDelayMinutes: body.restartDelayMinutes ?? undefined,
      ...accountPatch,
    };

    let updated = await prisma.liveChannel.update({
      where: { id: channel.id },
      data: updateData as any,
    });

    if (body.scheduledStartAt !== undefined) {
      await prisma.$executeRawUnsafe(
        `UPDATE "LiveChannel" SET "scheduledStartAt" = ? WHERE "id" = ?`,
        body.scheduledStartAt ? new Date(body.scheduledStartAt).toISOString() : null,
        channel.id,
      );
    }
    if (body.scheduledStopAt !== undefined) {
      await prisma.$executeRawUnsafe(
        `UPDATE "LiveChannel" SET "scheduledStopAt" = ? WHERE "id" = ?`,
        body.scheduledStopAt ? new Date(body.scheduledStopAt).toISOString() : null,
        channel.id,
      );
    }
    if (body.scheduledStartAt !== undefined || body.scheduledStopAt !== undefined) {
      updated = await ownedChannel(req.userId!, channel.id);
    }

    const nextLiveSessionId = sessionPatch === undefined ? channel.liveSessionId : sessionPatch;
    const didMetadataChange =
      (body.coverImageUrl !== undefined && (body.coverImageUrl ?? null) !== (channel.coverImageUrl ?? null)) ||
      (body.caption !== undefined && (body.caption ?? null) !== (channel.caption ?? null)) ||
      (body.description !== undefined && (body.description ?? null) !== (channel.description ?? null));
    const shouldSyncShopeeMetadata = Boolean(
      channel.cookie &&
      nextLiveSessionId &&
      didMetadataChange,
    );

    if (shouldSyncShopeeMetadata) {
      await shopee.syncSessionMetadata(channel.cookie!, nextLiveSessionId!, {
        ...(body.caption !== undefined ? { title: body.caption } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.coverImageUrl !== undefined ? { coverImageUrl: body.coverImageUrl } : {}),
      });
    }

    const shouldRunAiReply = Boolean(
      updated.aiCommentAutoReply &&
      updated.aiCommentApiKey &&
      updated.cookie &&
      updated.liveSessionId &&
      updated.isOnline,
    );
    if (shouldRunAiReply) {
      await startAiCommentReplyLoopForChannel(req.userId!, updated.id).catch((error) => {
        console.warn('[ai-comment-reply] start after channel update skipped', {
          liveChannelId: updated.id,
          message: error instanceof Error ? error.message : String(error),
        });
      });
    } else {
      await stopAiCommentReplyLoopForChannel(updated.id).catch(() => undefined);
    }

    return ok(res, updated, 'บันทึกช่องไลฟ์สำเร็จ');
  }),
);

const statusSchema = z.object({ isOnline: z.boolean() });

liveChannelsRouter.patch(
  '/:id/status',
  asyncHandler(async (req: AuthedRequest, res) => {
    const channel = await ownedChannel(req.userId!, req.params.id);
    const { isOnline } = statusSchema.parse(req.body);
    const updated = await prisma.liveChannel.update({
      where: { id: channel.id },
      data: isOnline
        ? { isOnline }
        : { isOnline, liveSessionId: null, rtmpUrl: null, streamKey: null },
    });
    if (!isOnline) await stopAiCommentReplyLoopForChannel(channel.id).catch(() => undefined);
    return ok(res, updated, 'อัปเดตสถานะสำเร็จ');
  }),
);

liveChannelsRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const channel = await ownedChannel(req.userId!, req.params.id);
    // detach videos, remove reruns history, then the channel
    await prisma.video.updateMany({ where: { liveChannelId: channel.id }, data: { liveChannelId: null } });
    await prisma.rerun.deleteMany({ where: { liveChannelId: channel.id } });
    await prisma.liveChannel.delete({ where: { id: channel.id } });
    return ok(res, { deleted: true }, 'ลบบัญชีสำเร็จ');
  }),
);




