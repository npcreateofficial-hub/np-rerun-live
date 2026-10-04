import { AppError } from './http';
import { prisma } from './prisma';
import { parseShopeeBasketItems, shopee, type ShopeeBasketItem } from './shopee';

type ProductShowLoopItem = ShopeeBasketItem & {
  pinOrder: number;
  pinSeconds: number;
};

type ProductShowLoopJob = {
  liveChannelId: string;
  userId: string;
  stopped: boolean;
  timer: NodeJS.Timeout | null;
};

const jobs = new Map<string, ProductShowLoopJob>();

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

function normalizePinSeconds(value: unknown, fallback: number) {
  const seconds = Math.round(Number(value));
  if (!Number.isFinite(seconds) || seconds <= 0) return fallback;
  return Math.min(Math.max(seconds, 1), 24 * 60 * 60);
}

function selectedShowLoopItems(basketLinks?: string | null, basketItemsJson?: string | null, defaultSeconds = 60): ProductShowLoopItem[] {
  const rows: ProductShowLoopItem[] = [];
  const seen = new Set<string>();

  if (basketItemsJson?.trim()) {
    try {
      const parsed = JSON.parse(basketItemsJson);
      const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : [];
      for (const [index, item] of items.entries()) {
        if (item?.pinEnabled === false) continue;
        const itemId = Number(item?.item_id ?? item?.itemId);
        if (!Number.isSafeInteger(itemId) || itemId <= 0) continue;
        const shopId = Number(item?.shop_id ?? item?.shopId);
        const key = `${Number.isSafeInteger(shopId) ? shopId : 0}:${itemId}:${String(item?.url ?? '')}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          shop_id: Number.isSafeInteger(shopId) && shopId > 0 ? shopId : 0,
          item_id: itemId,
          ...(item?.url ? { url: String(item.url) } : {}),
          ...(item?.campaign_token || item?.campaignToken ? { campaign_token: String(item.campaign_token ?? item.campaignToken) } : {}),
          pinOrder: Math.max(1, Math.round(Number(item?.pinOrder) || index + 1)),
          pinSeconds: normalizePinSeconds(item?.pinSeconds, defaultSeconds),
        });
      }
    } catch {
      // Fall back to basketLinks below.
    }
  }

  if (!rows.length) {
    const parsedLinks = parseShopeeBasketItems(basketLinks, null);
    parsedLinks.forEach((item, index) => {
      if (!item.item_id) return;
      rows.push({ ...item, pinOrder: index + 1, pinSeconds: defaultSeconds });
    });
  }

  return rows.sort((a, b) => a.pinOrder - b.pinOrder);
}

function clearJob(liveChannelId: string) {
  const job = jobs.get(liveChannelId);
  if (!job) return false;
  job.stopped = true;
  if (job.timer) clearTimeout(job.timer);
  jobs.delete(liveChannelId);
  return true;
}

export function isProductShowLoopRunning(liveChannelId: string) {
  return jobs.has(liveChannelId);
}

export async function stopProductShowLoopForChannel(liveChannelId: string) {
  return clearJob(liveChannelId);
}

export async function startProductShowLoopForChannel(userId: string, liveChannelId: string, options?: { defaultSeconds?: number }) {
  const channel = await prisma.liveChannel.findFirst({ where: { id: liveChannelId, userId } });
  if (!channel) throw new AppError('ไม่พบช่องไลฟ์', 404);
  if (channel.platform !== 'SHOPEE') throw new AppError('บัญชีนี้ไม่ใช่ Shopee', 400);
  if (channel.cookieValid === false) throw new AppError('คุกกี้ของบัญชีนี้ใช้ไม่ได้ กรุณาเชื่อมบัญชีใหม่', 400);
  if (!channel.cookie) throw new AppError('บัญชีนี้ไม่มีคุกกี้ Shopee', 400);
  if (!channel.liveSessionId) throw new AppError('ยังไม่มี Shopee Live session สำหรับบัญชีนี้', 400);

  const defaultSeconds = normalizePinSeconds(options?.defaultSeconds, 60);
  const items = selectedShowLoopItems(channel.basketLinks, channel.basketItemsJson, defaultSeconds);
  if (!items.length) throw new AppError('ไม่มีสินค้าที่ติ๊กไว้สำหรับปักหมุด', 400);

  clearJob(liveChannelId);
  const job: ProductShowLoopJob = { liveChannelId, userId, stopped: false, timer: null };
  jobs.set(liveChannelId, job);

  void (async () => {
    let index = 0;
    while (!job.stopped && jobs.get(liveChannelId) === job) {
      const item = items[index % items.length];
      try {
        await shopee.showBasketItem(channel.cookie!, channel.liveSessionId!, item);
      } catch (error) {
        console.warn('[product-show-loop] show item failed', {
          liveChannelId,
          itemId: item.item_id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      index += 1;
      await sleep(item.pinSeconds * 1000);
    }
  })();

  return {
    liveChannelId,
    running: true,
    itemCount: items.length,
    defaultSeconds,
    items: items.map((item) => ({
      shop_id: item.shop_id,
      item_id: item.item_id,
      url: item.url,
      pinOrder: item.pinOrder,
      pinSeconds: item.pinSeconds,
    })),
  };
}
