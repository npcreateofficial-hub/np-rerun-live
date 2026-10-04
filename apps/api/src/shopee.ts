import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import { config } from './config';
import { AppError } from './http';

/**
 * Shopee Live integration adapter.
 *
 * IMPORTANT — read before wiring production:
 * Shopee Live has no public/official API for creating a broadcast + fetching the
 * RTMP push URL. Those endpoints are private, undocumented, region-specific, and
 * require a signed request built from the seller's logged-in cookie. They also
 * change over time and using them may violate Shopee's Terms of Service.
 *
 * This adapter is built with a single, clearly-marked integration seam:
 *   - MOCK mode (SHOPEE_LIVE_MODE=false): everything works end-to-end using a
 *     configurable test RTMP target, so you can verify the whole app + the real
 *     FFmpeg rerun engine without Shopee.
 *   - LIVE mode (SHOPEE_LIVE_MODE=true): performs the Shopee Live API flow:
 *     check the seller cookie, create/update the live session, read the push URL,
 *     then start FFmpeg with the returned RTMP target.
 */

export type CheckCookieResult = {
  valid: boolean;
  platform: string;
  accountName?: string | null;
  name?: string | null;
  shopId?: string | null;
  userId?: string | null;
  platformUid?: string | null;
  username?: string | null;
  avatar?: string | null;
  liveAuth?: boolean | null;
  source?: string | null;
  message?: string;
};

export type LiveSession = {
  liveSessionId: string;
  rtmpUrl: string;
  streamKey: string;
  coverImageUrl?: string | null;
  alreadyLive?: boolean;
  raw?: unknown;
};

export type ShopeeStartSessionResult = {
  sessionId: string;
  isLive: boolean;
  alreadyLive: boolean;
};

export type ShopeeLiveStats = {
  sessionId: string | null;
  isLive: boolean;
  status: string;
  liveSeconds: number;
  totalSales: number;
  salesPerHour: number;
  viewers: number;
  orders: number;
  productsSold: number;
  buyers: number;
  addedToCart: number;
  currentViewers: number;
  peakViewers: number;
  views: number;
  averageWatchSeconds: number;
  likes: number;
  comments: number;
  shares: number;
  newFollowers: number;
  updatedAt: string;
  source: string;
};

export type ShopeeBasketItem = {
  shop_id?: number;
  item_id: number;
  url?: string;
  campaign_token?: string;
  [key: string]: unknown;
};

export type ShopeePromotionPermission = {
  canUsePromotionItem: boolean;
  canUseImportItem: boolean;
  canUseEarnCommission: boolean;
  canUseLikeItem: boolean;
  showLiveCampaign: boolean;
  showRecommendedItem: boolean;
  reason: string | null;
};

export type ShopeePromotionSummary = {
  promotionId: string;
  title: string;
  status?: string | null;
  total?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type ShopeePromotionProduct = {
  shop_id: number;
  item_id: number;
  campaign_token?: string;
  title: string;
  image?: string | null;
  price?: number | null;
  stock?: number | null;
};

export type ShopeePromotionListResult = {
  sessionId: string;
  permission: ShopeePromotionPermission;
  promotions: ShopeePromotionSummary[];
  total: number;
  hasMore: boolean;
  message: string | null;
};

export type ShopeePromotionItemsResult = {
  sessionId: string;
  promotionId: string;
  permission: ShopeePromotionPermission;
  items: ShopeePromotionProduct[];
  total: number;
  hasMore: boolean;
  message: string | null;
};

export type ShopeeLiveSyncResult = {
  sessionId: string;
  synced: boolean;
  basketCount: number;
  hasCover: boolean;
  title: string;
  description: string;
  raw?: unknown;
};

export type ShopeeLiveMetadataSyncResult = {
  sessionId: string;
  synced: boolean;
  changed: {
    title: boolean;
    description: boolean;
    cover: boolean;
  };
  raw?: unknown;
};

export type ShopeeBasketSyncResult = {
  sessionId: string;
  synced: boolean;
  basketCount: number;
  raw?: unknown;
};

export type ShopeeBasketItemsResult = {
  sessionId: string;
  items: ShopeeBasketItem[];
  total: number;
  raw?: unknown;
};

export type ShopeeScreenRankingItem = {
  shopId: number;
  itemId: number;
  url: string;
  screenRank: number | null;
  screenRankLabel: string;
  rankingType: string | null;
  score: number | null;
  ctr: number | null;
  cvr: number | null;
  viewCount: number | null;
  liveSessionId: string | null;
  matched: boolean;
  sessionCount: number;
  previewImage?: string | null;
  error?: string | null;
};

export type ShopeeScreenRankingsResult = {
  sessionId: string | null;
  items: ShopeeScreenRankingItem[];
};

export type ShopeeScreenRankingTarget = {
  sessionId?: string | null;
  channelName?: string | null;
  accountName?: string | null;
  username?: string | null;
  platformUid?: string | null;
  shopId?: string | number | null;
};

export type ShopeePinBasketItemsResult = {
  sessionId: string;
  pinned: number;
  items: ShopeeBasketItem[];
  raw?: unknown;
};

export type ShopeeShowBasketItemResult = {
  sessionId: string;
  shown: boolean;
  cleared?: boolean;
  item?: ShopeeBasketItem | null;
  raw?: unknown;
};

export type ShopeeLiveComment = {
  id: string | null;
  customerName: string | null;
  text: string;
  createdAt: string | null;
  raw?: unknown;
};

export function parseShopeeBasketItems(
  basketLinks?: string | null,
  basketItemsJson?: string | null,
): ShopeeBasketItem[] {
  const seen = new Set<string>();
  const items: ShopeeBasketItem[] = [];
  const readProductIds = (rawUrl: string) => {
    const product = rawUrl.match(/product\/(\d+)\/(\d+)/i);
    const iFormat = rawUrl.match(/(?:^|[\/?&#.-])i\.(\d+)\.(\d+)(?:$|[/?&#])/i);
    const shopPath = rawUrl.match(/shopee\.co\.th\/(?!product\/|search\b|cart\b|checkout\b|buyer\/|seller\/|m\/|api\/|webapi\/)[^/?#]+\/(\d+)\/(\d+)(?:[/?#]|$)/i);
    const queryShop = rawUrl.match(/[?&#](?:shopid|shop_id)=(\d+)/i);
    const queryItem = rawUrl.match(/[?&#](?:itemid|item_id)=(\d+)/i);
    return {
      shopId: product?.[1] || iFormat?.[1] || shopPath?.[1] || queryShop?.[1],
      itemId: product?.[2] || iFormat?.[2] || shopPath?.[2] || queryItem?.[1],
    };
  };
  const addItem = (shopId: unknown, itemId: unknown, url?: string, campaignToken?: unknown) => {
    const shop = Number(shopId);
    const item = Number(itemId);
    if (!Number.isSafeInteger(shop) || !Number.isSafeInteger(item) || shop <= 0 || item <= 0) return;

    const key = `${shop}:${item}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      shop_id: shop,
      item_id: item,
      ...(url ? { url } : {}),
      ...(typeof campaignToken === 'string' && campaignToken.trim() ? { campaign_token: campaignToken.trim() } : {}),
    });
  };
  const addAffiliateOffer = (itemId: unknown, url?: string) => {
    const item = Number(itemId);
    if (!Number.isSafeInteger(item) || item <= 0) return;

    const key = `affiliate:${item}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ item_id: item, ...(url ? { url } : {}) });
  };
  const addUnresolvedLink = (url: string) => {
    if (!/^https?:\/\/(?:s\.)?shopee\.co\.th\//i.test(url)) return;
    const key = `link:${url}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ item_id: 0, url });
  };

  if (basketItemsJson?.trim()) {
    try {
      const parsed = JSON.parse(basketItemsJson);
      const parsedItems = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : [];
      for (const entry of parsedItems) {
        addItem(entry?.shop_id ?? entry?.shopId, entry?.item_id ?? entry?.itemId, entry?.url, entry?.campaign_token ?? entry?.campaignToken);
      }
    } catch {
      // Ignore malformed cached basket data; basketLinks below is the source of truth.
    }
  }

  for (const row of (basketLinks || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)) {
    const affiliateOffer = row.match(/affiliate\.shopee\.co\.th\/offer\/product_offer\/(\d+)/i);
    const ids = readProductIds(row);
    if (affiliateOffer?.[1]) addAffiliateOffer(affiliateOffer[1], row);
    else if (ids.shopId && ids.itemId) addItem(ids.shopId, ids.itemId, row);
    else addUnresolvedLink(row);
    if (items.length >= 200) break;
  }

  return items;
}

export function parseShopeeLiveSessionId(value?: string | null): string | null {
  const raw = (value || '').trim();
  if (!raw) return null;
  const direct = raw.match(/^\d{5,}$/);
  if (direct) return direct[0];

  try {
    const url = new URL(raw);
    const session = url.searchParams.get('session');
    if (session && /^\d{5,}$/.test(session)) return session;
  } catch {
    // Fall through to regex parsing for pasted fragments or partially escaped URLs.
  }

  const match = raw.match(/[?&#]session=(\d{5,})/i) || raw.match(/\/session\/(\d{5,})(?:$|[/?#])/i);
  return match?.[1] ?? null;
}

export function parseCookie(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

function stableId(seed: string, digits = 10): string {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  const num = parseInt(hash.slice(0, 12), 16) % 10 ** digits;
  return String(num).padStart(digits, '0');
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout หลัง ${Math.round(ms / 1000)} วินาที`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// ---------------------------------------------------------------------------
// MOCK implementation (default) — lets the full flow work for local testing.
// ---------------------------------------------------------------------------

function mockCheckCookie(platform: string, cookie: string): CheckCookieResult {
  const jar = parseCookie(cookie);
  const looksValid = Boolean(jar.SPC_EC || jar.SPC_ST || jar.SPC_U || Object.keys(jar).length >= 2);

  if (!looksValid) {
    return { valid: false, platform, source: 'mock', message: 'คุกกี้ไม่ครบ (ต้องมี SPC_EC/SPC_ST เป็นต้น)' };
  }

  const uid = jar.SPC_U || stableId(cookie, 9);
  const shopId = stableId(`shop:${cookie}`, 8);

  return {
    valid: true,
    platform,
    accountName: `ร้านทดสอบ ${shopId.slice(-4)}`,
    name: `ร้านทดสอบ ${shopId.slice(-4)}`,
    shopId,
    userId: uid,
    platformUid: uid,
    username: `seller_${uid.slice(-4)}`,
    avatar: null,
    source: 'mock',
    message: 'ตรวจคุกกี้สำเร็จ (โหมดทดสอบ)',
  };
}

function mockCreateSession(title: string, coverImageUrl?: string | null): LiveSession {
  const sessionId = stableId(`${title}:${Date.now()}`, 12);
  // Point this at your own RTMP server (e.g. local nginx-rtmp) to test real push.
  const rtmpUrl = process.env.SHOPEE_MOCK_RTMP_URL || 'rtmp://127.0.0.1:1935/live';
  const streamKey = process.env.SHOPEE_MOCK_STREAM_KEY || `test_${sessionId}`;
  return { liveSessionId: sessionId, rtmpUrl, streamKey, coverImageUrl: coverImageUrl ?? null };
}

// ---------------------------------------------------------------------------
// LIVE implementation — wire real Shopee endpoints here.
// ---------------------------------------------------------------------------

// Real Shopee endpoints:
//   - userInfo -> { code, msg, data: { avatar, userName, userId } }
const SHOPEE_USER_INFO_URL =
  process.env.SHOPEE_ACCOUNT_INFO_URL || 'https://creator.shopee.co.th/supply/api/lm/sellercenter/userInfo';
const DEFAULT_SHOPEE_LIVE_API_BASES: string[] = [];
const SHOPEE_MOBILE_REFERER =
  process.env.SHOPEE_LIVE_REFERER || 'https://live.shopee.co.th/p/setup?from=seller_center';
const SHOPEE_MOBILE_API_REFERER =
  process.env.SHOPEE_LIVE_API_REFERER || 'https://live.shopee.co.th/guide-download';
const SHOPEE_MOBILE_APP_USER_AGENT =
  process.env.SHOPEE_MOBILE_APP_USER_AGENT ||
  process.env.SHOPEE_USER_AGENT ||
  'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230805.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 ShopeeTH/3.45.24 Beeshop appver=34524 rnver=1663221600 language/th';
const SHOPEE_CREATOR_LIVE_URL =
  process.env.SHOPEE_CREATOR_LIVE_URL || 'https://seller.shopee.co.th/creator-center/insight/live';
const SHOPEE_MOBILE_CLIENT_INFO = process.env.SHOPEE_LIVE_CLIENT_INFO || 'os=2;platform=9';
const SHOPEE_LIVESTREAMING_SOURCE = process.env.SHOPEE_LIVESTREAMING_SOURCE || 'shopee';
type LiveHeaderProfile = {
  label: string;
  szToken?: string;
};
type CdpTarget = {
  id: string;
  type: string;
  title?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
};
type CdpClient = {
  send<T = any>(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<T>;
  onMessage(handler: (message: any) => void): void;
  close(): void;
};
const ALLOWED_SHOPEE_HOSTS = new Set([
  'shopee.co.th',
  'seller.shopee.co.th',
  'creator.shopee.co.th',
  'live.shopee.co.th',
]);

function isAllowedShopeeHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_SHOPEE_HOSTS.has(host) || host.endsWith('.shopee.co.th');
}

function safeShopeeUrl(rawUrl: string | undefined, label: string): string {
  if (!rawUrl?.trim()) {
    throw new AppError(`${label} ยังไม่ได้ตั้งค่า`, 400);
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AppError(`${label} ไม่ใช่ URL ที่ถูกต้อง`, 400);
  }

  if (url.protocol !== 'https:') {
    throw new AppError(`${label} ต้องเป็น https เท่านั้น เพื่อป้องกันคุกกี้รั่วไหล`, 400);
  }

  if (!isAllowedShopeeHost(url.hostname)) {
    throw new AppError(`${label} ไม่อยู่ในโดเมน Shopee ที่อนุญาต: ${url.hostname}`, 400);
  }

  return url.toString();
}

function shopeeHeaders(cookie: string, targetUrl?: string): Record<string, string> {
  // Referer must match the host we call (seller.* vs creator.*), otherwise Shopee may reject the request.
  let referer = 'https://seller.shopee.co.th/';
  try {
    if (targetUrl) referer = `${new URL(targetUrl).origin}/`;
  } catch {
    // keep default referer
  }
  return {
    cookie,
    'user-agent': process.env.SHOPEE_USER_AGENT || 'Mozilla/5.0',
    accept: 'application/json',
    'accept-language': 'th-TH,th;q=0.9',
    referer,
  };
}

function readInlineValue(raw: string, names: string[]): string {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?:^|[;\\r\\n])\\s*${escaped}\\s*[:=]\\s*([^;\\r\\n]+)`, 'i');
    const match = raw.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return '';
}

function addUniqueProfile(profiles: LiveHeaderProfile[], label: string, szToken?: string) {
  const token = szToken?.trim();
  const key = `${label}:${token || ''}`;
  if (profiles.some((profile) => `${profile.label}:${profile.szToken || ''}` === key)) return;
  profiles.push(token ? { label, szToken: token } : { label });
}

function liveHeaderProfiles(cookie: string): LiveHeaderProfile[] {
  const jar = parseCookie(cookie);
  const profiles: LiveHeaderProfile[] = [];
  const explicitToken =
    process.env.SHOPEE_LS_SZ_TOKEN ||
    process.env.X_LS_SZ_TOKEN ||
    readInlineValue(cookie, ['x-ls-sz-token', 'x_ls_sz_token', 'ls-sz-token']);

  addUniqueProfile(profiles, explicitToken ? 'mobile-explicit-token' : 'mobile-no-token', explicitToken);
  addUniqueProfile(profiles, 'mobile-cookie-sz-token', jar['sz-token']);
  addUniqueProfile(profiles, 'mobile-cookie-device-fingerprint', jar.device_sz_fingerprint);
  addUniqueProfile(profiles, 'mobile-cookie-af-token', jar['af-ac-enc-sz-token']);
  addUniqueProfile(profiles, 'mobile-cookie-webunique', jar.shopee_webUnique_ccd);
  addUniqueProfile(profiles, 'mobile-cookie-ds', jar.ds);

  return profiles;
}

function liveShopeeHeaders(cookie: string, extra?: Record<string, string>, profile?: LiveHeaderProfile): Record<string, string> {
  const jar = parseCookie(cookie);
  const csrfToken = jar.csrftoken || jar.CSRFTOKEN || jar.SPC_CDS || readInlineValue(cookie, ['x-csrftoken', 'csrf-token']);
  const szToken =
    profile?.szToken ||
    process.env.SHOPEE_LS_SZ_TOKEN ||
    process.env.X_LS_SZ_TOKEN ||
    readInlineValue(cookie, ['x-ls-sz-token', 'x_ls_sz_token', 'ls-sz-token']) ||
    jar['sz-token'] ||
    jar.device_sz_fingerprint ||
    jar['af-ac-enc-sz-token'];
  const authToken =
    process.env.SHOPEE_LIVESTREAMING_AUTH ||
    process.env.X_LIVESTREAMING_AUTH ||
    readInlineValue(cookie, ['x-livestreaming-auth', 'x_livestreaming_auth', 'livestreaming-auth']);
  const clientInfo = process.env.SHOPEE_LIVE_CLIENT_INFO || readInlineValue(cookie, ['client-info', 'client_info']) || SHOPEE_MOBILE_CLIENT_INFO;
  const requestedWith = process.env.SHOPEE_X_REQUESTED_WITH || readInlineValue(cookie, ['x-requested-with']);
  return {
    cookie,
    'user-agent':
      SHOPEE_MOBILE_APP_USER_AGENT,
    accept: 'application/json, text/plain, */*',
    'accept-language': 'th-TH,th;q=0.9,en;q=0.8',
    'content-type': 'application/json;charset=UTF-8',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty',
    'x-api-source': 'rweb',
    'x-shopee-language': 'th',
    origin: 'https://live.shopee.co.th',
    referer: SHOPEE_MOBILE_REFERER,
    'client-info': clientInfo,
    'x-livestreaming-source': SHOPEE_LIVESTREAMING_SOURCE,
    ...(requestedWith ? { 'x-requested-with': requestedWith } : {}),
    ...(csrfToken ? { 'x-csrftoken': csrfToken } : {}),
    ...(szToken ? { 'x-ls-sz-token': szToken } : {}),
    ...(authToken ? { 'x-livestreaming-auth': authToken } : {}),
    ...extra,
  };
}

async function shopeeJson<T = any>(
  url: string,
  init: RequestInit,
  label: string,
): Promise<T> {
  const resp = await fetch(url, init);
  const data = (await resp.json().catch(() => null)) as any;
  if (!resp.ok) {
    if (resp.status === 403) {
      const message = data?.err_msg || data?.msg || data?.message || 'Shopee ปฏิเสธ API path นี้ แม้คุกกี้ยังล็อกอินอยู่';
      throw new AppError(
        `${label} ไม่สำเร็จ (403): ${message}`,
        403,
        data,
      );
    }

    throw new AppError(`${label} ไม่สำเร็จ (${resp.status})`, resp.status, data);
  }

  const errCode = data?.err_code ?? data?.error;
  if (errCode !== undefined && errCode !== 0) {
    throw new AppError(data?.err_msg || data?.msg || `${label} ไม่สำเร็จ`, 502, data);
  }

  return data as T;
}

function dataOf(payload: any) {
  return payload?.data ?? payload;
}

function unwrapShopeeTuple(payload: any) {
  if (!Array.isArray(payload)) return payload;
  return payload[1] ?? payload[0] ?? null;
}

function readCookieDeviceId(jar: Record<string, string>, cookie: string): string {
  const value = jar.LIVE_STREAMING_UUID_KEY || jar.SPC_F || jar.SPC_CLIENTID || jar.SPC_U;
  return value && value.trim() ? value.trim() : stableId(cookie, 16);
}

function readSessionId(payload: any): string | null {
  const data = dataOf(unwrapShopeeTuple(payload));
  const candidates = [
    data?.session?.session_id,
    data?.session?.sessionId,
    data?.session?.id,
    data?.session_id,
    data?.sessionId,
    data?.id,
  ];
  const value = candidates.find((item) => item !== undefined && item !== null && String(item).trim());
  return value ? String(value) : null;
}

function readDeviceId(cookie: string, payload: any): string {
  const data = dataOf(unwrapShopeeTuple(payload));
  const jar = parseCookie(cookie);
  const candidates = [
    data?.device_id,
    data?.deviceId,
    data?.session?.device_id,
    data?.session?.deviceId,
    readCookieDeviceId(jar, cookie),
  ];
  const value = candidates.find((item) => item !== undefined && item !== null && String(item).trim());
  return value ? String(value) : stableId(cookie, 16);
}

function readLiveUsersig(payload: any): string | null {
  const data = dataOf(unwrapShopeeTuple(payload));
  const candidates = [
    data?.usersig,
    data?.user_sig,
    data?.userSig,
    data?.user_signature,
    data?.userSignature,
    data?.session?.usersig,
    data?.session?.user_sig,
    data?.session?.userSig,
    data?.session_info?.usersig,
    data?.session_info?.user_sig,
    data?.sessionInfo?.usersig,
    data?.sessionInfo?.userSig,
  ];
  const direct = candidates.find((item) => typeof item === 'string' && item.trim().length > 8);
  if (direct) return String(direct).trim();

  return findStringValue(data, (value, key) => {
    const normalizedKey = key.toLowerCase().replace(/[_-]/g, '');
    return value.trim().length > 8 && (normalizedKey === 'usersig' || normalizedKey === 'usersignature');
  })?.trim() || null;
}

function readLiveChatroomId(payload: any): string | null {
  const data = dataOf(unwrapShopeeTuple(payload));
  const candidates = [
    data?.chatroom_id,
    data?.chatroomId,
    data?.chat_room_id,
    data?.session?.chatroom_id,
    data?.session?.chatroomId,
    data?.session?.chat_room_id,
    data?.session_info?.chatroom_id,
    data?.session_info?.chatroomId,
    data?.sessionInfo?.chatroomId,
    data?.sessionInfo?.chatroom_id,
  ];
  const direct = candidates.find((item) => item !== undefined && item !== null && String(item).trim());
  if (direct) return String(direct).trim();

  return findStringValue(data, (value, key) => {
    const normalizedKey = key.toLowerCase().replace(/[_-]/g, '');
    return value.trim().length > 0 && normalizedKey === 'chatroomid';
  })?.trim() || null;
}

function readCoverPic(payload: any): string {
  const data = dataOf(unwrapShopeeTuple(payload));
  const value = [
    data?.cover_pic,
    data?.coverPic,
    data?.session?.cover_pic,
    data?.session?.coverPic,
  ].find((item) => typeof item === 'string' && item.trim());
  return value ? String(value).trim() : '';
}

function liveSessionBootstrapUrls(base: string): string[] {
  return [`${base}/session`];
}

function findStringValue(payload: any, predicate: (value: string, key: string) => boolean): string | null {
  const seen = new Set<any>();
  const stack: Array<{ value: any; key: string }> = [{ value: payload, key: '' }];

  while (stack.length) {
    const { value, key } = stack.pop()!;
    if (typeof value === 'string' && predicate(value, key)) return value;
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);

    for (const [childKey, childValue] of Object.entries(value)) {
      stack.push({ value: childValue, key: childKey });
    }
  }

  return null;
}

function findCampaignToken(payload: any): string | undefined {
  const value = findStringValue(payload, (item, key) => {
    const lowerKey = key.toLowerCase();
    return Boolean(item.trim()) && (lowerKey === 'campaign_token' || lowerKey === 'campaigntoken');
  });
  return value?.trim() || undefined;
}

function readPushUrl(payload: any): string | null {
  const data = dataOf(unwrapShopeeTuple(payload));
  const validPushUrl = (item: unknown) =>
    typeof item === 'string' && item.trim() && /^(?:rtmps?|srtrtmp):\/\//i.test(item) && !/speedtest/i.test(item);
  const candidates = [
    data?.push_url,
    data?.pushUrl,
    data?.rtmp_url,
    data?.rtmpUrl,
    data?.push_url_list?.[0],
    data?.pushUrlList?.[0],
    data?.session?.push_url,
    data?.session?.pushUrl,
    data?.session?.push_url_list?.[0],
    data?.session?.pushUrlList?.[0],
    data?.session_info?.push_url,
    data?.session_info?.push_url_list?.[0],
    data?.sessionInfo?.pushUrl,
    data?.sessionInfo?.pushUrlList?.[0],
  ];
  const value = candidates.find(validPushUrl);
  if (value) return String(value);

  return findStringValue(data, (item, key) => {
    const lowerKey = key.toLowerCase();
    const lowerValue = item.toLowerCase();
    if (lowerValue.includes('speedtest')) return false;
    return (
      lowerValue.startsWith('rtmp://') ||
      lowerValue.startsWith('rtmps://') ||
      lowerValue.startsWith('srtrtmp://') ||
      lowerKey.includes('pushurl') ||
      lowerKey.includes('push_url') ||
      lowerKey.includes('rtmp')
    );
  });
}

function cleanShopeeRuntimeErrorText(raw: string): string {
  const cleaned = String(raw || '')
    .replace(/^Error:\s*/, '')
    .replace(/\n\s+at\s+.+/g, '')
    .replace(/(?:rtmps?|srtrtmp):\/\/[^\s"'<>\\]+/gi, '[redacted-rtmp]')
    .trim();

  if (/no permission to use like item/i.test(cleaned)) {
    return 'Shopee ไม่อนุญาตให้เพิ่มสินค้านี้ในตะกร้า Live ของบัญชีนี้ (no permission to use like item)';
  }

  return cleaned.slice(0, 1_200);
}

function normalizeEscapedText(text: string): string {
  return String(text || '')
    .replace(/\\\//g, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/&amp;/gi, '&');
}

function extractShopeeRtmpFromText(text: string): string {
  const normalized = normalizeEscapedText(text);
  const direct = normalized.match(/(?:rtmps?|srtrtmp):\/\/[^\s"'<>\\]+/i);
  if (direct) return direct[0].replace(/[),.;]+$/, '');

  try {
    const decoded = decodeURIComponent(normalized);
    const found = decoded.match(/(?:rtmps?|srtrtmp):\/\/[^\s"'<>\\]+/i);
    if (found) return found[0].replace(/[),.;]+$/, '');
  } catch {
    // Payload may not be URI-encoded.
  }

  return '';
}

function extractShopeeRtmpFromPayload(payload: unknown): string {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const direct = extractShopeeRtmpFromText(raw);
  if (direct) return direct;

  const server = findStringValue(payload, (value, key) => {
    const lowerKey = key.toLowerCase();
    return /^(?:rtmps?|srtrtmp):\/\//i.test(value) && /server|push|rtmp/i.test(lowerKey);
  });
  const key = findStringValue(payload, (_value, key) => /stream(_?key|_?name|_?id)|push(_?key)?/i.test(key));
  if (server && key) return `${server.replace(/\/+$/, '')}/${String(key).replace(/^\/+/, '')}`;

  return '';
}

function readShopeeSessionIdFromText(text: string): string {
  const normalized = normalizeEscapedText(text);
  const patterns = [
    /(?:session_id|sessionId|session)[=:/"'%20]+(\d{5,})/i,
    /\/(?:share|session)\/?[^"'<>]*[?&]session=(\d{5,})/i,
    /"session_id"\s*:\s*"?(\d{5,})"?/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) return match[1];
  }

  try {
    const decoded = decodeURIComponent(normalized);
    for (const pattern of patterns) {
      const match = decoded.match(pattern);
      if (match?.[1]) return match[1];
    }
  } catch {
    // Payload may not be URI-encoded.
  }

  return '';
}

function mobilePushLaunchInfo(liveSessionId: string, uid?: string | null, coverImageUrl?: string | null) {
  const encodedSession = encodeURIComponent(liveSessionId);
  const shareUrl = `https://live.shopee.co.th/p/share?from=live&session=${encodedSession}`;
  const endPageUrl = 'https://live.shopee.co.th/p/streamer-end';
  const productSelectUrl = `https://live.shopee.co.th/p/product-select?session=${encodedSession}&from_source=streamer_add_product`;
  const params = new URLSearchParams({
    sessionId: liveSessionId,
    shareUrl,
    endPageUrl,
    productSelectUrl,
    fromType: '0',
    auctionAllow: '1',
    ...(uid ? { uid } : {}),
    ...(coverImageUrl ? { cover: coverImageUrl } : {}),
  });

  return {
    apprl: 'n/SHOPEE_LIVE_STREAM_PUSH',
    path: `ShopeeLiveStreamingPush?${params.toString()}`,
    params: Object.fromEntries(params.entries()),
  };
}

function stableJson(data: unknown): string {
  return JSON.stringify(data, Object.keys(data as Record<string, unknown>).sort());
}

function coverPayloadForShopee(coverImageUrl?: string | null): string {
  const cover = coverImageUrl?.trim();
  if (!cover) return '';

  return cover;
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; extension: string } {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) throw new AppError('รูปภาพหน้าปกไม่ใช่ data URL ที่ถูกต้อง', 400);
  const mime = match[1].toLowerCase();
  const extension =
    mime === 'image/png' ? 'png' :
      mime === 'image/webp' ? 'webp' :
        'jpg';
  const bytes = Buffer.from(match[2], 'base64');
  return {
    blob: new Blob([new Uint8Array(bytes)], { type: mime }),
    extension,
  };
}

function readShopeeCoverFileId(payload: any): string {
  const data = dataOf(unwrapShopeeTuple(payload));
  const fileId = data?.file_id || data?.fileId || data?.cover_pic || data?.coverPic || data?.url || data?.image_url;
  return fileId ? String(fileId) : '';
}

async function uploadCoverImageToShopee(cookie: string, coverDataUrl: string): Promise<string> {
  const { blob, extension } = dataUrlToBlob(coverDataUrl);
  const form = new FormData();
  form.append('cover_pic', blob, `cover.${extension}`);

  const headers = liveShopeeHeaders(cookie, {
    accept: 'application/json, text/plain, */*',
    referer: SHOPEE_MOBILE_REFERER,
  });
  delete headers['content-type'];

  const response = await fetch('https://live.shopee.co.th/api/v1/image/upload', {
    method: 'POST',
    headers,
    body: form,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AppError(`อัปโหลดรูปภาพหน้าปกไป Shopee ไม่สำเร็จ (${response.status})`, 502, payload);
  }

  assertShopeePageOk(payload, 'upload cover');
  const data = dataOf(unwrapShopeeTuple(payload));
  const violation = data?.cover_violation;
  if (violation?.is_invalid) {
    throw new AppError(
      violation.violation_info
        ? `รูปภาพหน้าปกไม่ผ่านการอนุมัติ Shopee: ${violation.violation_info}`
        : 'รูปภาพหน้าปกไม่ผ่านการอนุมัติ Shopee กรุณาเลือกรูปใหม่',
      400,
      payload,
    );
  }

  const fileId = readShopeeCoverFileId(payload);
  if (!fileId) throw new AppError('Shopee อัปโหลดรูปภาพหน้าปกแล้วแต่ไม่คืน file_id', 502, payload);
  return fileId;
}

async function resolveCoverPayloadForShopee(cookie: string, coverImageUrl?: string | null): Promise<string> {
  const cover = coverPayloadForShopee(coverImageUrl);
  if (!cover) return '';
  if (!cover.startsWith('data:')) return cover;
  return uploadCoverImageToShopee(cookie, cover);
}

function chromeDebugPort(): number {
  const parsed = Number(process.env.SHOPEE_CHROME_DEBUG_PORT || process.env.CHROME_DEBUG_PORT || 9223);
  return Number.isFinite(parsed) ? parsed : 9223;
}

function chromeDebugBaseUrl(): string {
  return `http://127.0.0.1:${chromeDebugPort()}`;
}

function chromeExecutablePath(): string {
  const candidates = [
    process.env.SHOPEE_CHROME_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean) as string[];

  const found = candidates.find((item) => fs.existsSync(item));
  if (!found) throw new Error('ไม่พบ Chrome/Chromium บน server กรุณาติดตั้ง chromium หรือกำหนด SHOPEE_CHROME_PATH');
  return found;
}

function chromeDebugUserDataDir(): string {
  return process.env.SHOPEE_CHROME_USER_DATA_DIR || path.join('/tmp', `np-live-chrome-${chromeDebugPort()}`);
}

async function fetchChromeJson<T>(path: string, timeoutMs = 3_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${chromeDebugBaseUrl()}${path}`, { signal: controller.signal });
    if (!resp.ok) throw new Error(`Chrome DevTools ตอบกลับ ${resp.status}`);
    return (await resp.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function ensureChromeDebugAvailable(): Promise<void> {
  try {
    await fetchChromeJson('/json/version');
    return;
  } catch {
    // Start a dedicated Chrome profile when the debug port is not already open.
  }

  if (process.env.SHOPEE_AUTO_LAUNCH_CHROME === 'false') {
    throw new Error(`Chrome DevTools port ${chromeDebugPort()} ยังไม่เปิด`);
  }

  const userDataDir = chromeDebugUserDataDir();
  fs.mkdirSync(userDataDir, { recursive: true });
  const chrome = chromeExecutablePath();
  const child = spawn(
    chrome,
    [
      `--remote-debugging-port=${chromeDebugPort()}`,
      '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--headless=new',
      '--disable-gpu',
      '--disable-backgrounding-occluded-windows',
      '--disable-features=CalculateNativeWinOcclusion',
      '--start-minimized',
      'about:blank',
    ],
    {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    },
  );
  let launchError: Error | null = null;
  child.on('error', (err) => {
    launchError = err;
    console.error('[shopee chrome] launch failed', err);
  });
  child.unref();

  for (let i = 0; i < 60; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      await fetchChromeJson('/json/version');
      return;
    } catch {
      // Keep waiting for Chrome to expose the debugging endpoint.
    }
  }

  throw new Error(launchError ? `เปิด Chrome DevTools port ${chromeDebugPort()} ไม่สำเร็จ: ${(launchError as Error).message}` : `เปิด Chrome DevTools port ${chromeDebugPort()} ไม่สำเร็จ`);
}

async function cdpJson<T>(path: string): Promise<T> {
  await ensureChromeDebugAvailable();
  return fetchChromeJson<T>(path);
}

async function createChromeTarget(url: string): Promise<CdpTarget> {
  await ensureChromeDebugAvailable();
  const resp = await fetch(`${chromeDebugBaseUrl()}/json/new?${url}`, { method: 'PUT' });
  if (!resp.ok) throw new Error(`Chrome DevTools ตอบกลับ ${resp.status}`);
  return (await resp.json()) as CdpTarget;
}

async function findOrCreateShopeeLiveTarget(): Promise<CdpTarget> {
  return createChromeTarget('about:blank');
}

async function connectCdp(wsUrl: string): Promise<CdpClient> {
  const NativeWebSocket = (globalThis as unknown as { WebSocket?: any }).WebSocket || WebSocket;

  return new Promise((resolve, reject) => {
    const ws = new NativeWebSocket(wsUrl);
    let callId = 0;
    const pending = new Map<
      number,
      { resolve: (value: any) => void; reject: (reason: unknown) => void; timer: ReturnType<typeof setTimeout> }
    >();
    const listeners = new Set<(message: any) => void>();

    ws.onmessage = (event: { data: string }) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const waiter = pending.get(message.id)!;
        pending.delete(message.id);
        clearTimeout(waiter.timer);
        if (message.error) waiter.reject(new Error(message.error.message || 'Chrome DevTools command failed'));
        else waiter.resolve(message.result);
        return;
      }

      for (const listener of listeners) listener(message);
    };
    ws.onerror = (error: unknown) => reject(error);
    ws.onopen = () => {
      resolve({
        send<T = any>(method: string, params: Record<string, unknown> = {}, timeoutMs?: number) {
          return new Promise<T>((done, fail) => {
            const id = ++callId;
            const ms = Math.max(1_000, Number(timeoutMs || process.env.SHOPEE_CDP_COMMAND_TIMEOUT_MS || 45_000));
            const timer = setTimeout(() => {
              pending.delete(id);
              fail(new Error(`Chrome DevTools command ${method} timeout หลัง ${Math.round(ms / 1000)} วินาที`));
            }, ms);
            pending.set(id, { resolve: done, reject: fail, timer });
            ws.send(JSON.stringify({ id, method, params }));
          });
        },
        onMessage(handler: (message: any) => void) {
          listeners.add(handler);
        },
        close() {
          ws.close();
        },
      });
    };
  });
}

function isTransientCdpTargetError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Inspected target navigated or closed|Execution context was destroyed|Cannot find context|Target closed|WebSocket is not open/i.test(
    message,
  );
}

async function withShopeeChromeTarget<T>(fn: (client: CdpClient, target: CdpTarget) => Promise<T>): Promise<T> {
  const bridgeStub = `
    (() => {
      const callBack = (callbackId, responseData) => {
        const bridge = window.WebViewJavascriptBridge;
        if (!callbackId || !bridge || typeof bridge._handleMessageFromObjC !== 'function') return;
        setTimeout(() => {
          bridge._handleMessageFromObjC(JSON.stringify({ responseId: callbackId, responseData }));
        }, 0);
      };
      window.gabridge = window.gabridge || {
        sendMsg(raw) {
          try {
            const message = typeof raw === 'string' ? JSON.parse(raw) : raw || {};
            const handlerName = message.handlerName || message.handler || '';
            const callbackId = message.callbackId || message.callback_id || '';
            let responseData = { errorCode: 0, data: '{}' };
            if (handlerName === 'hasHandler') {
              responseData = { status: 1 };
            } else if (handlerName === 'checkVersion' || handlerName === 'getAppInfo') {
              responseData = {
                app_version: '3.45.24',
                appver: 34524,
                deviceID: 'codex-mobile-runtime',
                platform: 'android',
                rnver: '1663221600'
              };
            }
            callBack(callbackId, responseData);
          } catch {}
        },
        onHasHandler() {}
      };
    })();
  `;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const target = await findOrCreateShopeeLiveTarget();
    if (!target.webSocketDebuggerUrl) throw new Error('ไม่พบ Chrome tab สำหรับ Shopee Live');
    const client = await connectCdp(target.webSocketDebuggerUrl);
    try {
      await client.send('Page.enable').catch(() => undefined);
      await client.send('Runtime.enable').catch(() => undefined);
      await client.send('Network.enable');
      await client.send('Page.addScriptToEvaluateOnNewDocument', { source: bridgeStub }).catch(() => undefined);
      await client
        .send('Network.setBlockedURLs', {
          urls: ['*://play.google.com/*', '*://market.android.com/*', 'intent://*', 'shopeeth://*'],
        })
        .catch(() => undefined);
      await client
        .send('Emulation.setUserAgentOverride', {
          userAgent: SHOPEE_MOBILE_APP_USER_AGENT,
          platform: 'Android',
        })
        .catch(() => undefined);
      await client
        .send('Emulation.setDeviceMetricsOverride', {
          width: 390,
          height: 844,
          deviceScaleFactor: 3,
          mobile: true,
        })
        .catch(() => undefined);
      return await fn(client, target);
    } catch (error) {
      lastError = error;
      if (!isTransientCdpTargetError(error) || attempt === 1) throw error;
      console.warn('[shopee-runtime] Chrome target หลุดระหว่างทำงาน กำลังเปิด target ใหม่แล้วลองซ้ำ');
      await new Promise((resolve) => setTimeout(resolve, 750));
    } finally {
      client.close();
    }
  }
  throw lastError;
}

async function setShopeeCookiesInChrome(client: CdpClient, cookie: string): Promise<void> {
  const jar = parseCookie(cookie);
  const entries = Object.entries(jar).filter(([name, value]) => name && value);
  if (entries.length === 0) return;

  // Keep the headless mobile profile clean. Setting the same Shopee cookie on
  // several matching domains makes Chrome send duplicate cookie names to
  // live.shopee.co.th, which can trip Shopee's 400 "Header Or Cookie Too Large".
  await client.send('Network.clearBrowserCookies', {}, 10_000).catch(() => undefined);

  const cookies = entries.map(([name, value]) => ({
    name,
    value,
    domain: '.shopee.co.th',
    path: '/',
    secure: true,
  }));
  await client.send('Network.setCookies', { cookies }, 15_000).catch(() => undefined);
}

type ShopeePageFetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
};

type ShopeePageFetchResult = {
  status: number;
  ok: boolean;
  json: any | null;
  text: string;
};

function readShopeeSessionStatus(payload: any): number | null {
  const data = dataOf(unwrapShopeeTuple(payload));
  const session = data?.session || data || {};
  const value = session.status ?? data?.status;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function assertShopeePageOk(payload: any, label: string): void {
  const errCode = payload && (payload.err_code ?? payload.error ?? payload.code);
  if (errCode !== undefined && Number(errCode) !== 0) {
    throw new Error(cleanShopeeRuntimeErrorText(payload.err_msg || payload.msg || payload.message || `${label} Shopee err_code ${errCode}`));
  }
}

function isShopeeStreamSessionLivingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /ErrorStreamSessionIsLiving|StreamSessionIsLiving/i.test(message);
}

async function shopeePageContextFetch(
  client: CdpClient,
  path: string,
  options: ShopeePageFetchOptions = {},
): Promise<ShopeePageFetchResult> {
  const body =
    typeof options.body === 'string'
      ? options.body
      : options.body === undefined
        ? undefined
        : JSON.stringify(options.body);
  const expression = `
    (async () => {
      const path = ${JSON.stringify(path)};
      const method = ${JSON.stringify(options.method || (body === undefined ? 'GET' : 'POST'))};
      const extraHeaders = ${JSON.stringify(options.headers || {})};
      const body = ${JSON.stringify(body)};
      const timeoutMs = ${JSON.stringify(options.timeoutMs || 12_000)};
      let csrfToken = '';
      try {
        csrfToken = (document.cookie.match(/(?:^|;\\s*)csrftoken=([^;]+)/) || [])[1] || '';
      } catch {}
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch('https://live.shopee.co.th' + path, {
          method,
          credentials: 'include',
          headers: {
            accept: 'application/json, text/plain, */*',
            'x-requested-with': 'XMLHttpRequest',
            'x-shopee-language': 'th',
            'x-livestreaming-source': 'shopee',
            ...(csrfToken ? { 'x-csrftoken': decodeURIComponent(csrfToken) } : {}),
            ...extraHeaders
          },
          ...(body === undefined ? {} : { body }),
          signal: controller.signal
        });
        const text = await response.text();
        let json = null;
        try { json = JSON.parse(text); } catch {}
        return { status: response.status, ok: response.ok, json, text: json ? '' : text.slice(0, 600) };
      } finally {
        clearTimeout(timer);
      }
    })()
  `;

  const result = await withTimeout(
    client.send<{ result?: { value?: ShopeePageFetchResult }; exceptionDetails?: any }>(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      (options.timeoutMs || 12_000) + 5_000,
    ),
    (options.timeoutMs || 12_000) + 8_000,
    `Shopee page fetch ${path}`,
  );
  if (result.exceptionDetails) {
    const exceptionText =
      result.exceptionDetails?.exception?.description ||
      result.exceptionDetails?.text ||
      JSON.stringify(result.exceptionDetails);
    throw new Error(cleanShopeeRuntimeErrorText(exceptionText));
  }
  const value = result.result?.value;
  if (!value) throw new Error(`Shopee page fetch ${path} ไม่คืนผลลัพธ์`);
  if (!value.ok) {
    const message = value.json?.err_msg || value.json?.msg || value.json?.message || value.text || '';
    throw new Error(cleanShopeeRuntimeErrorText(`${path} HTTP ${value.status}${message ? `: ${message}` : ''}`));
  }
  return value;
}

async function ensureShopeeLiveOrigin(client: CdpClient): Promise<void> {
  const current = await client
    .send<{ result?: { value?: string } }>('Runtime.evaluate', {
      expression: `location.origin`,
      returnByValue: true,
    })
    .then((result) => String(result.result?.value || ''))
    .catch(() => '');

  if (current === 'https://live.shopee.co.th') return;

  await client.send('Page.navigate', { url: 'https://live.shopee.co.th/' }, 15_000).catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 1_500));
}

async function navigateShopeeLiveSharePage(client: CdpClient, liveSessionId: string): Promise<void> {
  const shareUrl = `https://live.shopee.co.th/p/share?from=live&session=${encodeURIComponent(liveSessionId)}`;
  await client.send('Page.navigate', { url: shareUrl }, 15_000).catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 3_500));
}

async function pageContextFetchUrl(
  client: CdpClient,
  url: string,
  options: ShopeePageFetchOptions = {},
): Promise<ShopeePageFetchResult> {
  const body =
    typeof options.body === 'string'
      ? options.body
      : options.body === undefined
        ? undefined
        : JSON.stringify(options.body);
  const expression = `
    (async () => {
      const url = ${JSON.stringify(url)};
      const method = ${JSON.stringify(options.method || (body === undefined ? 'GET' : 'POST'))};
      const extraHeaders = ${JSON.stringify(options.headers || {})};
      const body = ${JSON.stringify(body)};
      const timeoutMs = ${JSON.stringify(options.timeoutMs || 12_000)};
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method,
          credentials: 'include',
          headers: {
            accept: 'application/json, text/plain, */*',
            ...extraHeaders
          },
          ...(body === undefined ? {} : { body }),
          signal: controller.signal
        });
        const text = await response.text();
        let json = null;
        try { json = JSON.parse(text); } catch {}
        return { status: response.status, ok: response.ok, json, text: json ? '' : text.slice(0, 600) };
      } finally {
        clearTimeout(timer);
      }
    })()
  `;

  const result = await withTimeout(
    client.send<{ result?: { value?: ShopeePageFetchResult }; exceptionDetails?: any }>(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      (options.timeoutMs || 12_000) + 5_000,
    ),
    (options.timeoutMs || 12_000) + 8_000,
    `page fetch ${url}`,
  );
  if (result.exceptionDetails) {
    const exceptionText =
      result.exceptionDetails?.exception?.description ||
      result.exceptionDetails?.text ||
      JSON.stringify(result.exceptionDetails);
    throw new Error(cleanShopeeRuntimeErrorText(exceptionText));
  }
  const value = result.result?.value;
  if (!value) throw new Error(`page fetch ${url} ไม่คืนผลลัพธ์`);
  if (!value.ok) {
    const message = value.json?.err_msg || value.json?.msg || value.json?.message || value.text || '';
    throw new Error(cleanShopeeRuntimeErrorText(`${url} HTTP ${value.status}${message ? `: ${message}` : ''}`));
  }
  return value;
}

async function navigateCdp(client: CdpClient, url: string, waitMs = 2_000): Promise<void> {
  await client.send('Page.navigate', { url }, 8_000).catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  await client.send('Page.stopLoading', {}, 3_000).catch(() => undefined);
}

function productPairFromUrl(rawUrl: unknown): ShopeeBasketItem | null {
  if (typeof rawUrl !== 'string') return null;
  const product = rawUrl.match(/product\/(\d+)\/(\d+)/i);
  const iFormat = rawUrl.match(/(?:^|[\/?&#.-])i\.(\d+)\.(\d+)(?:$|[/?&#])/i);
  const shopPath = rawUrl.match(/shopee\.co\.th\/(?!product\/|search\b|cart\b|checkout\b|buyer\/|seller\/|m\/|api\/|webapi\/)[^/?#]+\/(\d+)\/(\d+)(?:[/?#]|$)/i);
  const queryShop = rawUrl.match(/[?&#](?:shopid|shop_id)=(\d+)/i);
  const queryItem = rawUrl.match(/[?&#](?:itemid|item_id)=(\d+)/i);
  const shopId = product?.[1] || iFormat?.[1] || shopPath?.[1] || queryShop?.[1];
  const itemId = product?.[2] || iFormat?.[2] || shopPath?.[2] || queryItem?.[1];
  if (!shopId || !itemId) return null;
  const shop = Number(shopId);
  const item = Number(itemId);
  if (!Number.isSafeInteger(shop) || !Number.isSafeInteger(item) || shop <= 0 || item <= 0) return null;
  return { shop_id: shop, item_id: item, url: rawUrl };
}

function hasValidShopeeBasketIds(item: ShopeeBasketItem): boolean {
  const shopId = Number(item.shop_id);
  const itemId = Number(item.item_id);
  return Number.isSafeInteger(shopId) && Number.isSafeInteger(itemId) && shopId > 0 && itemId > 0;
}

function isShopeeShortLink(rawUrl: unknown): rawUrl is string {
  return typeof rawUrl === 'string' && /^https?:\/\/s\.shopee\.co\.th\//i.test(rawUrl.trim());
}

async function fetchShopeeRedirectUrl(rawUrl: string, method: 'HEAD' | 'GET'): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch(rawUrl, {
      method,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'th-TH,th;q=0.9,en;q=0.8',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      },
    });
    const location = response.headers.get('location');
    if (location) return new URL(location, rawUrl).toString();
    if (response.url && response.url !== rawUrl) return response.url;
  } catch {
    // Short-link expansion is a best-effort fallback; unresolved links can still be handled by Shopee import.
  } finally {
    clearTimeout(timer);
  }
  return null;
}

async function resolveShopeeShortLinkViaChrome(client: CdpClient, rawUrl: string): Promise<string | null> {
  try {
    await navigateCdp(client, rawUrl, 5_000);
    const result = await client.send<{ result?: { value?: string }; exceptionDetails?: any }>(
      'Runtime.evaluate',
      {
        expression: `(() => {
          const canonical = document.querySelector('link[rel="canonical"]')?.href || '';
          const ogUrl = document.querySelector('meta[property="og:url"]')?.content || '';
          return canonical || ogUrl || location.href || '';
        })()`,
        returnByValue: true,
      },
      5_000,
    );
    if (result.exceptionDetails) return null;
    const resolved = String(result.result?.value || '').trim();
    if (!resolved || /shopee\.ee\/error_page/i.test(resolved)) return null;
    return resolved;
  } catch {
    return null;
  }
}

async function resolveShopeeShortBasketLinks(basketItems: ShopeeBasketItem[]): Promise<ShopeeBasketItem[]> {
  if (!basketItems.some((item) => !hasValidShopeeBasketIds(item) && isShopeeShortLink(item.url))) return basketItems;

  const resolved: ShopeeBasketItem[] = [];
  for (const item of basketItems) {
    if (hasValidShopeeBasketIds(item) || !isShopeeShortLink(item.url)) {
      resolved.push(item);
      continue;
    }

    const expandedUrl =
      (await fetchShopeeRedirectUrl(item.url, 'HEAD')) ||
      (await fetchShopeeRedirectUrl(item.url, 'GET'));
    const pair = expandedUrl ? productPairFromUrl(expandedUrl) : null;
    if (pair && expandedUrl) resolved.push({ ...pair, url: expandedUrl });
    else resolved.push(item);
  }

  const output: ShopeeBasketItem[] = [];
  const seenItems = new Set<string>();
  const seenLinks = new Set<string>();
  for (const item of resolved) {
    if (hasValidShopeeBasketIds(item)) {
      const key = `${Number(item.shop_id)}:${Number(item.item_id)}`;
      if (seenItems.has(key)) continue;
      seenItems.add(key);
      output.push({
        ...item,
        shop_id: Number(item.shop_id),
        item_id: Number(item.item_id),
      });
      continue;
    }
    if (typeof item.url === 'string') {
      const key = `link:${item.url}`;
      if (seenLinks.has(key)) continue;
      seenLinks.add(key);
    }
    output.push(item);
  }
  return output;
}

function affiliateOfferPair(payload: any, fallbackItemId: number, originalUrl?: string): ShopeeBasketItem | null {
  const data = dataOf(unwrapShopeeTuple(payload));
  const directFromLink = productPairFromUrl(data?.product_link || data?.long_link);
  const campaignToken = findCampaignToken(data);
  if (directFromLink) return { ...directFromLink, url: originalUrl || directFromLink.url, ...(campaignToken ? { campaign_token: campaignToken } : {}) };

  const card = data?.batch_item_for_item_card_full || {};
  const shopId = data?.shop_id ?? data?.shopid ?? data?.shopId ?? card.shop_id ?? card.shopid ?? card.shopId;
  const itemId = data?.item_id ?? data?.itemid ?? data?.itemId ?? card.item_id ?? card.itemid ?? card.itemId ?? fallbackItemId;
  const shop = Number(shopId);
  const item = Number(itemId);
  if (!Number.isSafeInteger(shop) || !Number.isSafeInteger(item) || shop <= 0 || item <= 0) return null;
  return { shop_id: shop, item_id: item, url: originalUrl, ...(campaignToken ? { campaign_token: campaignToken } : {}) };
}

async function resolveAffiliateOfferItemViaPageContext(
  client: CdpClient,
  itemId: number,
  originalUrl?: string,
): Promise<ShopeeBasketItem | null> {
  if (!Number.isSafeInteger(itemId) || itemId <= 0) return null;
  await navigateCdp(client, 'https://affiliate.shopee.co.th/dashboard', 1_500);
  const response = await pageContextFetchUrl(
    client,
    `https://affiliate.shopee.co.th/api/v3/offer/product?item_id=${encodeURIComponent(String(itemId))}`,
    { timeoutMs: 10_000 },
  );
  assertShopeePageOk(response.json, 'affiliate offer');
  return affiliateOfferPair(response.json, itemId, originalUrl);
}

async function currentPageUrl(client: CdpClient): Promise<string | null> {
  const result = await client.send<{ result?: { value?: string }; exceptionDetails?: any }>(
    'Runtime.evaluate',
    { expression: 'window.location.href', returnByValue: true },
    5_000,
  );
  if (result.exceptionDetails) return null;
  return typeof result.result?.value === 'string' ? result.result.value : null;
}

function affiliateItemIdFromUrl(rawUrl: unknown): number | null {
  if (typeof rawUrl !== 'string') return null;
  const offer = rawUrl.match(/affiliate\.shopee\.co\.th\/offer\/product_offer\/(\d+)/i);
  const itemQuery = rawUrl.match(/[?&#](?:itemid|item_id|itemId)=(\d+)/i);
  const value = offer?.[1] || itemQuery?.[1];
  const itemId = Number(value);
  return Number.isSafeInteger(itemId) && itemId > 0 ? itemId : null;
}

async function resolveShopeeLinkViaBrowserContext(client: CdpClient, link: string): Promise<ShopeeBasketItem | null> {
  const directPair = productPairFromUrl(link);
  if (directPair) return directPair;

  const directAffiliateItemId = affiliateItemIdFromUrl(link);
  if (directAffiliateItemId) {
    const affiliatePair = await resolveAffiliateOfferItemViaPageContext(client, directAffiliateItemId, link).catch(() => null);
    if (affiliatePair) return affiliatePair;
  }

  await navigateCdp(client, link, 2_500);
  const finalUrl = (await currentPageUrl(client)) || link;
  const finalPair = productPairFromUrl(finalUrl);
  if (finalPair) return { ...finalPair, url: link };

  const finalAffiliateItemId = affiliateItemIdFromUrl(finalUrl);
  if (finalAffiliateItemId) {
    const affiliatePair = await resolveAffiliateOfferItemViaPageContext(client, finalAffiliateItemId, link).catch(() => null);
    if (affiliatePair) return affiliatePair;
  }

  return null;
}

async function resolveAffiliateBasketItemsViaPageContext(
  client: CdpClient,
  sessionId: string,
  basketItems: ShopeeBasketItem[],
): Promise<ShopeeBasketItem[]> {
  const unresolved = basketItems.filter((item) => !Number.isFinite(Number(item.shop_id)) && Number.isFinite(Number(item.item_id)));
  if (!unresolved.length) return basketItems;

  const resolved = new Map<number, ShopeeBasketItem>();
  await navigateCdp(client, 'https://affiliate.shopee.co.th/dashboard', 2_500);
  for (const item of unresolved) {
    const itemId = Number(item.item_id);
    try {
      const response = await pageContextFetchUrl(
        client,
        `https://affiliate.shopee.co.th/api/v3/offer/product?item_id=${encodeURIComponent(String(itemId))}`,
        { timeoutMs: 10_000 },
      );
      assertShopeePageOk(response.json, 'affiliate offer');
      const pair = affiliateOfferPair(response.json, itemId, item.url);
      if (pair) resolved.set(itemId, pair);
    } catch {
      // Keep unresolved items out of add_items; Shopee will reject items without shop_id.
    }
  }
  await navigateCdp(
    client,
    `https://live.shopee.co.th/p/product-select?session=${encodeURIComponent(sessionId)}&from_source=streamer_add_product`,
    2_500,
  );

  const output: ShopeeBasketItem[] = [];
  const seen = new Set<string>();
  for (const item of basketItems) {
    const candidate = Number.isFinite(Number(item.shop_id)) ? item : resolved.get(Number(item.item_id));
    if (!candidate) continue;
    const key = `${candidate.shop_id}:${candidate.item_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(candidate);
  }
  return output;
}

function dedupeShopeeBasketItems(basketItems: ShopeeBasketItem[]) {
  const output: ShopeeBasketItem[] = [];
  const seen = new Set<string>();
  for (const item of basketItems) {
    const shopId = Number(item.shop_id);
    const itemId = Number(item.item_id);
    if (!Number.isFinite(shopId) || !Number.isFinite(itemId)) continue;
    const key = `${shopId}:${itemId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({
      ...item,
      shop_id: shopId,
      item_id: itemId,
      ...(typeof item.url === 'string' ? { url: item.url } : {}),
      ...(item.campaign_token ? { campaign_token: item.campaign_token } : {}),
    });
  }
  return output;
}

function collectShopeeBasketItemsFromPayload(payload: any): ShopeeBasketItem[] {
  const output: ShopeeBasketItem[] = [];
  const seen = new Set<string>();
  const visited = new Set<object>();
  const stack = [dataOf(unwrapShopeeTuple(payload))];

  while (stack.length) {
    const value = stack.pop();
    if (!value || typeof value !== 'object') continue;
    if (visited.has(value)) continue;
    visited.add(value);

    const shopId = Number(value.shop_id ?? value.shopId);
    const itemId = Number(value.item_id ?? value.itemId);
    if (Number.isFinite(shopId) && Number.isFinite(itemId)) {
      const key = `${shopId}:${itemId}`;
      if (!seen.has(key)) {
        seen.add(key);
        const campaignToken = findCampaignToken(value);
        output.push({
          ...value,
          shop_id: shopId,
          item_id: itemId,
          ...(campaignToken ? { campaign_token: campaignToken } : {}),
        });
      }
    }

    for (const child of Object.values(value)) stack.push(child);
  }

  return output;
}

async function importBasketItemsFromLinksViaPageContext(
  client: CdpClient,
  sessionId: string,
  basketUrls: string[],
  fallbackItems: ShopeeBasketItem[],
): Promise<ShopeeBasketItem[]> {
  let parsed: any = null;
  let lastError = '';
  for (const path of ['/webapi/v1/item/parse_url', '/api/v1/item/parse_url']) {
    try {
      const response = await shopeePageContextFetch(client, path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { links: basketUrls },
        timeoutMs: 10_000,
      });
      assertShopeePageOk(response.json, 'parse item URL');
      parsed = response.json;
      break;
    } catch (error) {
      lastError = cleanShopeeRuntimeErrorText(error instanceof Error ? error.message : String(error));
    }
  }

  const parsedItems = collectShopeeBasketItemsFromPayload(parsed);
  const candidateItems = dedupeShopeeBasketItems(parsedItems.length ? parsedItems : fallbackItems);
  if (!candidateItems.length) {
    throw new Error(lastError || 'Shopee ไม่สามารถแปลงลิงก์สินค้าเป็น shop_id/item_id ได้');
  }

  for (const path of [
    `/webapi/v1/session/${encodeURIComponent(sessionId)}/import_items/detail`,
    `/api/v1/session/${encodeURIComponent(sessionId)}/import_items/detail`,
  ]) {
    try {
      const response = await shopeePageContextFetch(client, path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { items: candidateItems, links: basketUrls },
        timeoutMs: 10_000,
      });
      assertShopeePageOk(response.json, 'import items');
      const importedItems = collectShopeeBasketItemsFromPayload(response.json);
      return dedupeShopeeBasketItems(importedItems.length ? importedItems : candidateItems);
    } catch (error) {
      lastError = cleanShopeeRuntimeErrorText(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(lastError || 'Shopee import item URL ไม่สำเร็จ');
}

function normalizePromotionPermission(payload: any): ShopeePromotionPermission {
  const data = dataOf(unwrapShopeeTuple(payload)) || {};
  const permission = {
    canUseLikeItem: Boolean(data.can_use_like_item),
    canUseImportItem: Boolean(data.can_use_import_item),
    canUsePromotionItem: Boolean(data.can_use_promotion_item),
    canUseEarnCommission: Boolean(data.can_use_earn_commission),
    showLiveCampaign: Boolean(data.show_live_campaign),
    showRecommendedItem: Boolean(data.show_rcmd_item),
    reason: null as string | null,
  };
  if (!permission.canUsePromotionItem) {
    permission.reason = 'Shopee ยังไม่เปิดสิทธิ์คูปอง/โปรโมชัน Live ให้บัญชีนี้ หรือบัญชีนี้ยังไม่มี promotion item ที่ใช้กับไลฟ์ได้';
  }
  return permission;
}

function numberOrNull(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readPromotionId(value: any): string {
  const raw =
    value?.promotion_id ??
    value?.promotionId ??
    value?.promo_id ??
    value?.promoId ??
    value?.campaign_id ??
    value?.campaignId ??
    value?.id;
  return raw === undefined || raw === null ? '' : String(raw).trim();
}

function normalizePromotionSummary(value: any): ShopeePromotionSummary | null {
  const promotionId = readPromotionId(value);
  if (!promotionId) return null;
  const title =
    stringOrNull(value?.title) ||
    stringOrNull(value?.name) ||
    stringOrNull(value?.promotion_name) ||
    stringOrNull(value?.promotionName) ||
    stringOrNull(value?.campaign_name) ||
    `โปรโมชัน ${promotionId}`;
  return {
    promotionId,
    title,
    status: stringOrNull(value?.status) || stringOrNull(value?.state),
    total: numberOrNull(value?.total ?? value?.item_count ?? value?.itemCount ?? value?.items_count ?? value?.itemsCount),
    startsAt: stringOrNull(value?.start_time ?? value?.startTime ?? value?.start_at ?? value?.startAt),
    endsAt: stringOrNull(value?.end_time ?? value?.endTime ?? value?.end_at ?? value?.endAt),
  };
}

function normalizePromotionProduct(value: any): ShopeePromotionProduct | null {
  const shopId = Number(value?.shop_id ?? value?.shopId);
  const itemId = Number(value?.item_id ?? value?.itemId);
  if (!Number.isFinite(shopId) || !Number.isFinite(itemId) || shopId <= 0 || itemId <= 0) return null;
  const title =
    stringOrNull(value?.title) ||
    stringOrNull(value?.name) ||
    stringOrNull(value?.item_name) ||
    stringOrNull(value?.itemName) ||
    `${shopId}/${itemId}`;
  const image =
    stringOrNull(value?.image) ||
    stringOrNull(value?.image_url) ||
    stringOrNull(value?.imageUrl) ||
    stringOrNull(value?.cover) ||
    stringOrNull(Array.isArray(value?.images) ? value.images[0] : null);
  return {
    shop_id: shopId,
    item_id: itemId,
    title,
    image,
    price: numberOrNull(value?.price ?? value?.price_min ?? value?.priceMin ?? value?.current_price ?? value?.currentPrice),
    stock: numberOrNull(value?.stock ?? value?.total_stock ?? value?.totalStock),
    ...(findCampaignToken(value) ? { campaign_token: findCampaignToken(value) } : {}),
  };
}

function payloadItems(payload: any): any[] {
  const data = dataOf(unwrapShopeeTuple(payload)) || {};
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.list)) return data.list;
  if (Array.isArray(data.promotions)) return data.promotions;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function payloadTotal(payload: any, fallback: number): number {
  const data = dataOf(unwrapShopeeTuple(payload)) || {};
  return numberOrNull(data.total ?? data.total_count ?? data.all_total ?? data.count) ?? fallback;
}

function payloadHasMore(payload: any): boolean {
  const data = dataOf(unwrapShopeeTuple(payload)) || {};
  return Boolean(data.has_more ?? data.hasMore);
}

function promotionMessage(permission: ShopeePromotionPermission, total: number): string | null {
  if (!permission.canUsePromotionItem) return permission.reason;
  if (total <= 0) return 'ยังไม่พบคูปอง/โปรโมชันจาก Shopee สำหรับ session นี้';
  return null;
}

async function withShopeePromotionPage<T>(
  cookie: string,
  liveSessionId: string,
  fn: (client: CdpClient) => Promise<T>,
): Promise<T> {
  if (!liveSessionId?.trim()) throw new AppError('ต้องมี Session ID ของ Shopee Live ก่อนเปิดคูปอง', 400);
  return withShopeeChromeTarget(async (client) => {
    await setShopeeCookiesInChrome(client, cookie);
    await navigateCdp(
      client,
      `https://live.shopee.co.th/p/product-select?session=${encodeURIComponent(liveSessionId)}&from_source=streamer_add_product`,
      2_500,
    );
    return fn(client);
  });
}

async function readShopeePromotionPermission(client: CdpClient): Promise<ShopeePromotionPermission> {
  const response = await shopeePageContextFetch(client, '/api/v1/host_config/permission', { timeoutMs: 10_000 });
  assertShopeePageOk(response.json, 'promotion permission');
  return normalizePromotionPermission(response.json);
}

async function livePromotionList(cookie: string, liveSessionId: string): Promise<ShopeePromotionListResult> {
  if (!config.shopeeLiveMode) {
    return {
      sessionId: liveSessionId,
      permission: {
        canUsePromotionItem: true,
        canUseImportItem: true,
        canUseEarnCommission: true,
        canUseLikeItem: true,
        showLiveCampaign: true,
        showRecommendedItem: true,
        reason: null,
      },
      promotions: [
        { promotionId: 'mock-promotion', title: 'คูปองทดสอบ', total: 1, status: 'mock' },
      ],
      total: 1,
      hasMore: false,
      message: null,
    };
  }

  return withShopeePromotionPage(cookie, liveSessionId, async (client) => {
    const permission = await readShopeePromotionPermission(client);
    const response = await shopeePageContextFetch(
      client,
      `/api/v1/item/promotion?offset=0&limit=50&session_id=${encodeURIComponent(liveSessionId)}`,
      { timeoutMs: 12_000 },
    );
    assertShopeePageOk(response.json, 'promotion list');
    const promotions = payloadItems(response.json)
      .map(normalizePromotionSummary)
      .filter((item): item is ShopeePromotionSummary => Boolean(item));
    const total = payloadTotal(response.json, promotions.length);
    return {
      sessionId: liveSessionId,
      permission,
      promotions,
      total,
      hasMore: payloadHasMore(response.json),
      message: promotionMessage(permission, total),
    };
  });
}

async function livePromotionItems(cookie: string, liveSessionId: string, promotionId: string): Promise<ShopeePromotionItemsResult> {
  if (!promotionId?.trim()) throw new AppError('กรุณาเลือกโปรโมชันก่อน', 400);
  if (!config.shopeeLiveMode) {
    return {
      sessionId: liveSessionId,
      promotionId,
      permission: {
        canUsePromotionItem: true,
        canUseImportItem: true,
        canUseEarnCommission: true,
        canUseLikeItem: true,
        showLiveCampaign: true,
        showRecommendedItem: true,
        reason: null,
      },
      items: [{ shop_id: 1, item_id: 1, title: 'สินค้าทดสอบคูปอง', campaign_token: 'mock' }],
      total: 1,
      hasMore: false,
      message: null,
    };
  }

  return withShopeePromotionPage(cookie, liveSessionId, async (client) => {
    const permission = await readShopeePromotionPermission(client);
    const response = await shopeePageContextFetch(
      client,
      `/api/v1/item/promotion/${encodeURIComponent(promotionId)}?offset=0&limit=200&session_id=${encodeURIComponent(liveSessionId)}`,
      { timeoutMs: 12_000 },
    );
    assertShopeePageOk(response.json, 'promotion items');
    const items = payloadItems(response.json)
      .map(normalizePromotionProduct)
      .filter((item): item is ShopeePromotionProduct => Boolean(item));
    const total = payloadTotal(response.json, items.length);
    return {
      sessionId: liveSessionId,
      promotionId,
      permission,
      items,
      total,
      hasMore: payloadHasMore(response.json),
      message: promotionMessage(permission, total),
    };
  });
}

async function liveAddPromotionItems(
  cookie: string,
  liveSessionId: string,
  items: ShopeeBasketItem[],
): Promise<{ sessionId: string; added: number; items: ShopeeBasketItem[] }> {
  const cleanItems = dedupeShopeeBasketItems(items).map((item) => ({
    shop_id: Number(item.shop_id),
    item_id: Number(item.item_id),
    ...(item.campaign_token ? { campaign_token: item.campaign_token } : {}),
  }));
  if (!cleanItems.length) throw new AppError('ไม่มีสินค้าคูปองที่เลือก', 400);

  if (!config.shopeeLiveMode) {
    return { sessionId: liveSessionId, added: cleanItems.length, items: cleanItems };
  }

  return withShopeePromotionPage(cookie, liveSessionId, async (client) => {
    const permission = await readShopeePromotionPermission(client);
    if (!permission.canUsePromotionItem) throw new AppError(permission.reason || 'บัญชีนี้ยังใช้คูปอง/โปรโมชัน Live ไม่ได้', 403, permission);

    const response = await shopeePageContextFetch(client, `/api/v1/session/${encodeURIComponent(liveSessionId)}/add_items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: { items: cleanItems },
      timeoutMs: 12_000,
    });
    assertShopeePageOk(response.json, 'add promotion items');
    return { sessionId: liveSessionId, added: cleanItems.length, items: cleanItems };
  });
}

async function liveRemovePromotionItems(
  cookie: string,
  liveSessionId: string,
  items: ShopeeBasketItem[],
): Promise<{ sessionId: string; removed: number; items: ShopeeBasketItem[] }> {
  const cleanItems = dedupeShopeeBasketItems(items);
  if (!cleanItems.length) throw new AppError('ไม่มีสินค้าคูปองที่เลือกสำหรับถอดออก', 400);

  if (!config.shopeeLiveMode) {
    return { sessionId: liveSessionId, removed: cleanItems.length, items: cleanItems };
  }

  return withShopeePromotionPage(cookie, liveSessionId, async (client) => {
    const response = await shopeePageContextFetch(client, `/api/v1/session/${encodeURIComponent(liveSessionId)}/items`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: { item_ids: cleanItems.map((item) => Number(item.item_id)) },
      timeoutMs: 12_000,
    });
    assertShopeePageOk(response.json, 'remove promotion items');
    return { sessionId: liveSessionId, removed: cleanItems.length, items: cleanItems };
  });
}

async function liveBasketItems(cookie: string, liveSessionId: string): Promise<ShopeeBasketItemsResult> {
  if (!config.shopeeLiveMode) {
    return { sessionId: liveSessionId, items: [], total: 0, raw: { source: 'mock-basket-items' } };
  }

  return withShopeePromotionPage(cookie, liveSessionId, async (client) => {
    const { items, lastPayload } = await readShopeeLiveBasketItems(client, liveSessionId);
    const cleanItems = dedupeShopeeBasketItems(items);
    return {
      sessionId: liveSessionId,
      items: cleanItems,
      total: cleanItems.length,
      raw: lastPayload,
    };
  });
}

async function readShopeeLiveBasketItems(client: CdpClient, liveSessionId: string) {
  const paths = [
    `/api/v1/session/${encodeURIComponent(liveSessionId)}/items?offset=0&limit=200&visible=true`,
    `/api/v1/session/${encodeURIComponent(liveSessionId)}/host/items?offset=0&limit=200&visible=true`,
    `/api/v1/session/${encodeURIComponent(liveSessionId)}/sp_items?offset=0&limit=200`,
    `/api/v1/session/${encodeURIComponent(liveSessionId)}/more_items?offset=0&limit=200`,
    `/webapi/v1/session/${encodeURIComponent(liveSessionId)}/items?offset=0&limit=200&visible=true`,
    `/webapi/v1/session/${encodeURIComponent(liveSessionId)}/host/items?offset=0&limit=200&visible=true`,
    `/webapi/v1/session/${encodeURIComponent(liveSessionId)}/sp_items?offset=0&limit=200`,
    `/webapi/v1/session/${encodeURIComponent(liveSessionId)}/more_items?offset=0&limit=200`,
  ];
  let lastPayload: unknown = null;
  const items: ShopeeBasketItem[] = [];
  for (const path of paths) {
    try {
      const response = await shopeePageContextFetch(client, path, { timeoutMs: 10_000 });
      assertShopeePageOk(response.json, 'read live basket items');
      lastPayload = response.json;
      items.push(...collectShopeeBasketItemsFromPayload(response.json));
    } catch {
      // Some Shopee item lists are only available in specific room states. Keep trying the next source.
    }
  }
  if (!items.length) {
    const fallback = await readShopeeLiveBasketItemsFromViewerPage(client, liveSessionId);
    if (fallback.items.length) {
      items.push(...fallback.items);
      lastPayload = fallback.lastPayload ?? lastPayload;
    }
  }
  return { items, lastPayload };
}

async function readShopeeLiveBasketItemsFromViewerPage(client: CdpClient, liveSessionId: string) {
  await client.send('Network.enable').catch(() => undefined);
  const payloads: unknown[] = [];
  const items: ShopeeBasketItem[] = [];
  const seenBodies = new Set<string>();

  const readPayload = (payload: unknown) => {
    payloads.push(payload);
    items.push(...collectShopeeBasketItemsFromPayload(payload));
  };

  const readText = (text: string, source: string) => {
    const trimmed = text.trim();
    if (!trimmed || seenBodies.has(trimmed)) return;
    seenBodies.add(trimmed);
    try {
      readPayload({ source, json: JSON.parse(trimmed) });
      return;
    } catch {
      // Keep parsing embedded JSON below.
    }

    const matches = trimmed.match(/\{[\s\S]{30,}\}/g) || [];
    for (const match of matches.slice(0, 10)) {
      try {
        readPayload({ source, json: JSON.parse(match) });
      } catch {
        // Ignore non-JSON fragments.
      }
    }
  };

  const handler = (message: any) => {
    if (message.method !== 'Network.responseReceived') return;
    const responseUrl = String(message.params?.response?.url || '');
    if (!/live\.shopee\.co\.th|shopee\.co\.th/i.test(responseUrl)) return;
    if (!/session|item|product|cart|basket|viewer|share|pdp/i.test(responseUrl)) return;
    void client
      .send<{ body?: string; base64Encoded?: boolean }>('Network.getResponseBody', {
        requestId: message.params.requestId,
      })
      .then((body) => {
        const text = body.base64Encoded
          ? Buffer.from(body.body || '', 'base64').toString('utf8')
          : String(body.body || '');
        if (/(shop_id|shopId|item_id|itemId|items|product|สินค้า)/i.test(text)) readText(text, responseUrl);
      })
      .catch(() => undefined);
  };

  client.onMessage(handler);
  const urls = [
    `https://live.shopee.co.th/p/viewer-end?session=${encodeURIComponent(liveSessionId)}`,
    `https://live.shopee.co.th/p/share?from=live&session=${encodeURIComponent(liveSessionId)}`,
    `https://live.shopee.co.th/share?from=live&session=${encodeURIComponent(liveSessionId)}`,
  ];
  for (const url of urls) {
    try {
      await navigateCdp(client, url, 12_000);
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      const page = await client
        .send<{ result?: { value?: { href?: string; title?: string; text?: string; scripts?: string } }; exceptionDetails?: any }>(
          'Runtime.evaluate',
          {
            expression: `
              (() => ({
                href: location.href,
                title: document.title,
                text: document.body?.innerText || '',
                scripts: [...document.querySelectorAll('script')]
                  .map((script) => script.textContent || '')
                  .filter(Boolean)
                  .join('\\n')
              }))()
            `,
            returnByValue: true,
          },
          8_000,
        )
        .catch(() => null);
      const value = page?.result?.value;
      if (value?.text) readText(value.text, `${url}:dom-text`);
      if (value?.scripts) readText(value.scripts, `${url}:scripts`);
      if (items.length) break;
    } catch {
      // Try the next viewer surface.
    }
  }

  const cleanItems = dedupeShopeeBasketItems(items);
  if (!cleanItems.length) {
    console.warn('[shopee-basket] viewer fallback found no items', {
      sessionId: liveSessionId,
      payloads: payloads.length,
    });
  } else {
    console.info('[shopee-basket] viewer fallback found items', {
      sessionId: liveSessionId,
      count: cleanItems.length,
      payloads: payloads.length,
    });
  }
  return { items: cleanItems, lastPayload: payloads[payloads.length - 1] ?? null };
}

function sameShopeeBasketItem(left: ShopeeBasketItem, right: ShopeeBasketItem) {
  return Number(left.shop_id) === Number(right.shop_id) && Number(left.item_id) === Number(right.item_id);
}

async function liveShowBasketItem(
  cookie: string,
  liveSessionId: string,
  item: ShopeeBasketItem | null,
): Promise<ShopeeShowBasketItemResult> {
  if (!config.shopeeLiveMode) {
    return { sessionId: liveSessionId, shown: Boolean(item), cleared: !item, item, raw: { source: 'mock-show-basket-item' } };
  }

  return withShopeePromotionPage(cookie, liveSessionId, async (client) => {
    let itemPayload: ShopeeBasketItem | null = null;
    if (item) {
      const cleanItem = dedupeShopeeBasketItems([item])[0];
      if (!cleanItem) throw new AppError('ไม่มีสินค้าที่เลือกสำหรับแสดงบนไลฟ์', 400);
      const { items } = await readShopeeLiveBasketItems(client, liveSessionId);
      itemPayload = dedupeShopeeBasketItems(items).find((candidate) => sameShopeeBasketItem(candidate, cleanItem)) || cleanItem;
    }

    const session = encodeURIComponent(liveSessionId);
    const cleanItemPayload = itemPayload
      ? {
          ...itemPayload,
          shop_id: Number(itemPayload.shop_id),
          item_id: Number(itemPayload.item_id),
        }
      : null;
    const itemJson = cleanItemPayload ? JSON.stringify(cleanItemPayload) : '';
    const bodies = cleanItemPayload
      ? [
          { item: itemJson },
          { item: cleanItemPayload },
          { items: [cleanItemPayload] },
          { shop_id: cleanItemPayload.shop_id, item_id: cleanItemPayload.item_id },
          { shopId: cleanItemPayload.shop_id, itemId: cleanItemPayload.item_id },
          { item_id: cleanItemPayload.item_id, shop_id: cleanItemPayload.shop_id, item: itemJson },
          { display_item: cleanItemPayload },
          { show_item: cleanItemPayload },
        ]
      : [
          { item: '' },
          { item: null },
          { shop_id: 0, item_id: 0 },
          { display_item: null },
          { show_item: null },
        ];
    const paths = [
      '/api/v1/session/' + session + '/show',
      '/webapi/v1/session/' + session + '/show',
      '/api/v1/session/' + session + '/show_item',
      '/webapi/v1/session/' + session + '/show_item',
      '/api/v1/session/' + session + '/item/show',
      '/webapi/v1/session/' + session + '/item/show',
      '/api/v1/session/' + session + '/items/show',
      '/webapi/v1/session/' + session + '/items/show',
      '/api/v1/session/' + session + '/show/items',
      '/webapi/v1/session/' + session + '/show/items',
      '/api/v1/session/' + session + '/host/show',
      '/webapi/v1/session/' + session + '/host/show',
    ];

    const attempts: Array<{ path: string; body: unknown; error: string }> = [];
    for (const path of paths) {
      for (const body of bodies) {
        try {
          const response = await shopeePageContextFetch(client, path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            timeoutMs: 10_000,
          });
          assertShopeePageOk(response.json, itemPayload ? 'show live product card' : 'clear live product card');
          return {
            sessionId: liveSessionId,
            shown: Boolean(cleanItemPayload),
            cleared: !cleanItemPayload,
            item: cleanItemPayload,
            raw: { path, body, response: response.json, attempts },
          };
        } catch (error) {
          attempts.push({
            path,
            body,
            error: cleanShopeeRuntimeErrorText(error instanceof Error ? error.message : String(error)),
          });
        }
      }
    }

    throw new AppError(
      itemPayload ? 'แสดงสินค้า Shopee Live ไม่สำเร็จ: ไม่พบ API show item ที่ Shopee ยอมรับ' : 'ล้างสินค้า Shopee Live ไม่สำเร็จ: ไม่พบ API show item ที่ Shopee ยอมรับ',
      502,
      { attempts: attempts.slice(-20) },
    );
  });
}

async function livePinBasketItems(
  cookie: string,
  liveSessionId: string,
  items: ShopeeBasketItem[],
): Promise<ShopeePinBasketItemsResult> {
  const cleanItems = dedupeShopeeBasketItems(items).map((item) => ({
    shop_id: Number(item.shop_id),
    item_id: Number(item.item_id),
    ...(item.campaign_token ? { campaign_token: item.campaign_token } : {}),
  }));
  if (!cleanItems.length) throw new AppError('ไม่มีสินค้าที่เลือกสำหรับปักหมุด', 400);

  if (!config.shopeeLiveMode) {
    return { sessionId: liveSessionId, pinned: cleanItems.length, items: cleanItems, raw: { source: 'mock-pin-basket-items' } };
  }

  throw new AppError(
    'ปิดการปักหมุดผ่าน /items/pin แล้ว เพราะเส้นนี้เป็นการจัดลำดับสินค้าในตะกร้า ไม่ใช่การแสดงการ์ดสินค้าบนไลฟ์',
    501,
    { sessionId: liveSessionId, items: cleanItems },
  );
}

async function updateShopeeBasketItemsViaPageContext(
  client: CdpClient,
  sessionId: string,
  basketItems: ShopeeBasketItem[],
  options: { mode?: 'append' | 'replace' } = {},
) {
  const mode = options.mode || 'append';
  await navigateCdp(
    client,
    `https://live.shopee.co.th/p/product-select?session=${encodeURIComponent(sessionId)}&from_source=streamer_add_product`,
    2_500,
  );

  let permission: Record<string, unknown> | null = null;
  try {
    const permissionPayload = (await shopeePageContextFetch(client, '/api/v1/host_config/permission', { timeoutMs: 8_000 })).json;
    const permissionData = dataOf(unwrapShopeeTuple(permissionPayload));
    permission = permissionData && typeof permissionData === 'object'
      ? {
          can_use_like_item: Boolean(permissionData.can_use_like_item),
          can_use_import_item: Boolean(permissionData.can_use_import_item),
          can_use_promotion_item: Boolean(permissionData.can_use_promotion_item),
          can_use_earn_commission: Boolean(permissionData.can_use_earn_commission),
          show_live_campaign: Boolean(permissionData.show_live_campaign),
          show_rcmd_item: Boolean(permissionData.show_rcmd_item),
        }
      : null;
  } catch {
    // Permission probing is diagnostic only; Shopee may still accept a direct product update.
  }

  const resolvedBasketItems = await resolveAffiliateBasketItemsViaPageContext(client, sessionId, basketItems);
  const basketUrls = basketItems.map((item) => item.url).filter((url): url is string => Boolean(url));
  const hasUnresolvedBasketLinks = basketItems.some((item) => {
    const shop = Number(item.shop_id);
    const itemId = Number(item.item_id);
    return !Number.isFinite(shop) || shop <= 0 || !Number.isFinite(itemId) || itemId <= 0;
  });
  let cleanBasketItems = resolvedBasketItems
    .map((item) => ({
      shop_id: Number(item.shop_id),
      item_id: Number(item.item_id),
      ...(item.campaign_token ? { campaign_token: item.campaign_token } : {}),
    }))
    .filter((item) => Number.isFinite(item.shop_id) && Number.isFinite(item.item_id));
  const status = {
    attempted: basketItems.length > 0,
    succeeded: basketItems.length === 0,
    mode,
    requestedCount: basketItems.length,
    count: cleanBasketItems.length,
    resolvedCount: cleanBasketItems.length,
    usedAddItems: false,
    usedImportFlow: false,
    usedItemsPut: false,
    error: '',
    warning: '',
    permission,
    selectedCount: null as number | null,
    moreCount: null as number | null,
    hostCount: null as number | null,
    allTotal: null as number | null,
    verifiedCount: 0,
  };
  if ((hasUnresolvedBasketLinks || !cleanBasketItems.length) && basketUrls.length) {
    try {
      const importedBasketItems = (await importBasketItemsFromLinksViaPageContext(client, sessionId, basketUrls, cleanBasketItems))
        .map((item) => ({
          shop_id: Number(item.shop_id),
          item_id: Number(item.item_id),
          ...(item.campaign_token ? { campaign_token: item.campaign_token } : {}),
        }))
        .filter((item) => Number.isFinite(item.shop_id) && Number.isFinite(item.item_id));
      cleanBasketItems = dedupeShopeeBasketItems([...cleanBasketItems, ...importedBasketItems])
        .map((item) => ({
          shop_id: Number(item.shop_id),
          item_id: Number(item.item_id),
          ...(item.campaign_token ? { campaign_token: String(item.campaign_token) } : {}),
        }))
        .filter((item) => Number.isFinite(item.shop_id) && Number.isFinite(item.item_id));
      status.usedImportFlow = true;
      status.count = cleanBasketItems.length;
      status.resolvedCount = cleanBasketItems.length;
    } catch (error) {
      status.usedImportFlow = true;
      status.error = cleanShopeeRuntimeErrorText(error instanceof Error ? error.message : String(error));
      status.warning = 'แปลงลิงก์ตะกร้า Shopee Live ไม่สำเร็จ';
      return status;
    }
  }

  if (!cleanBasketItems.length && mode !== 'replace') {
    status.error = 'ไม่มีสินค้าในตะกร้าที่พร้อมปักหลังแปลงลิงก์';
    status.warning = 'แปลงลิงก์ตะกร้า Shopee Live ไม่สำเร็จ';
    return status;
  }

  if (mode === 'replace') {
    try {
      const put = await shopeePageContextFetch(client, `/api/v1/session/${encodeURIComponent(sessionId)}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: { items: cleanBasketItems },
      });
      assertShopeePageOk(put.json, 'update items');
      status.usedItemsPut = true;
      status.succeeded = true;
    } catch (error) {
      const message = cleanShopeeRuntimeErrorText(error instanceof Error ? error.message : String(error));
      const blockedByPermission = permission && [
        permission.can_use_like_item,
        permission.can_use_import_item,
        permission.can_use_promotion_item,
        permission.can_use_earn_commission,
        permission.show_live_campaign,
        permission.show_rcmd_item,
      ].every((value) => value === false);
      status.error = blockedByPermission
        ? 'Shopee ยังไม่เปิดสิทธิ์เพิ่มสินค้า/สินค้านายหน้าเข้าตะกร้า Live ให้บัญชีนี้'
        : message;
      status.warning = 'อัปเดตตะกร้า Shopee Live ไม่สำเร็จ';
    }
  } else {
    try {
      const add = await shopeePageContextFetch(client, `/api/v1/session/${encodeURIComponent(sessionId)}/add_items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: { items: cleanBasketItems },
      });
      assertShopeePageOk(add.json, 'add items');
      status.usedAddItems = true;
      status.succeeded = true;
    } catch (firstError) {
      status.error = firstError instanceof Error ? firstError.message : String(firstError);
      try {
        const put = await shopeePageContextFetch(client, `/api/v1/session/${encodeURIComponent(sessionId)}/items`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: { items: cleanBasketItems },
        });
        assertShopeePageOk(put.json, 'update items');
        status.usedItemsPut = true;
        status.succeeded = true;
      } catch (secondError) {
        const message = cleanShopeeRuntimeErrorText(status.error || (secondError instanceof Error ? secondError.message : String(secondError)));
        const blockedByPermission = permission && [
          permission.can_use_like_item,
          permission.can_use_import_item,
          permission.can_use_promotion_item,
          permission.can_use_earn_commission,
          permission.show_live_campaign,
          permission.show_rcmd_item,
        ].every((value) => value === false);
        status.error = blockedByPermission
          ? 'Shopee ยังไม่เปิดสิทธิ์เพิ่มสินค้า/สินค้านายหน้าเข้าตะกร้า Live ให้บัญชีนี้'
          : message;
        status.warning = 'เพิ่มสินค้าเข้าตะกร้า Shopee Live ไม่สำเร็จ';
      }
    }
  }

  const requestedKeys = cleanBasketItems.map((item) => `${item.shop_id}:${item.item_id}`);
  let verifiedKeys = new Set<string>();
  const readbackLimit = Math.max(20, Math.min(200, requestedKeys.length + 5));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const verifiedItems: ShopeeBasketItem[] = [];
    for (const [key, path] of Object.entries({
      host: `/api/v1/session/${encodeURIComponent(sessionId)}/host/items?offset=0&limit=${readbackLimit}`,
      selected: `/api/v1/session/${encodeURIComponent(sessionId)}/sp_items?offset=0&limit=${readbackLimit}`,
      more: `/api/v1/session/${encodeURIComponent(sessionId)}/more_items?offset=0&limit=${readbackLimit}`,
    })) {
      try {
        const response = await shopeePageContextFetch(client, path, { timeoutMs: 8_000 });
        assertShopeePageOk(response.json, key);
        const data = dataOf(response.json);
        verifiedItems.push(...collectShopeeBasketItemsFromPayload(response.json));
        if (key === 'host') status.hostCount = Number(data?.total_count ?? data?.items?.length ?? 0);
        if (key === 'selected') status.selectedCount = Number(data?.total_count ?? data?.items?.length ?? 0);
        if (key === 'more') status.moreCount = Number(data?.total_count ?? data?.items?.length ?? 0);
        if (status.allTotal === null && data?.all_total !== undefined) status.allTotal = Number(data.all_total);
      } catch {
        // Draft rooms reliably expose selected basket items through host/items. Viewer endpoints can reject until live starts.
      }
    }
    verifiedKeys = new Set(dedupeShopeeBasketItems(verifiedItems).map((item) => `${item.shop_id}:${item.item_id}`));
    status.verifiedCount = requestedKeys.filter((key) => verifiedKeys.has(key)).length;
    if (!requestedKeys.length || status.verifiedCount === requestedKeys.length) break;
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  if (requestedKeys.length && status.verifiedCount === requestedKeys.length) {
    status.succeeded = true;
    status.warning = '';
  } else if (basketItems.length) {
    const writeAccepted = status.usedAddItems || status.usedItemsPut;
    status.succeeded = writeAccepted;
    status.warning = status.warning || 'ตรวจตะกร้า Shopee Live แล้ว ยังไม่พบสินค้าที่ตั้งไว้ใน session นี้';
  }

  return status;
}

function assertRequiredBasketUpdated(productUpdate: any, basketItems: ShopeeBasketItem[]): void {
  if (!basketItems.length || productUpdate?.succeeded) return;
  throw new AppError(
    productUpdate?.error || productUpdate?.warning || 'เพิ่มสินค้าเข้าตะกร้า Shopee Live ไม่สำเร็จ',
    502,
    {
      productUpdate,
    },
  );
}

async function createSessionViaPageContextFetch(
  client: CdpClient,
  cookie: string,
  title: string,
  coverImageUrl?: string | null,
  descriptionText?: string | null,
  basketItems: ShopeeBasketItem[] = [],
  existingLiveSessionId?: string | null,
): Promise<LiveSession> {
  const titleText = title.trim().slice(0, 200);
  const description = (descriptionText || title).trim().slice(0, 200);
  const coverCandidate = await resolveCoverPayloadForShopee(cookie, coverImageUrl);

  let sessionPayload: any = null;
  let usedStoredSessionId = false;
  if (existingLiveSessionId) {
    try {
      const storedPayload = (await shopeePageContextFetch(
        client,
        `/api/v1/session/${encodeURIComponent(existingLiveSessionId)}`,
      )).json;
      assertShopeePageOk(storedPayload, 'load stored session');
      if (readShopeeSessionStatus(storedPayload) !== 2 && readSessionId(storedPayload)) {
        sessionPayload = storedPayload;
        usedStoredSessionId = true;
      }
      if (!sessionPayload) {
        console.warn('[shopee-runtime] stored session is not usable; falling back to current draft session', {
          existingLiveSessionId,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[shopee-runtime] stored session lookup failed; falling back to current draft session', {
        existingLiveSessionId,
        message,
      });
    }
  }

  sessionPayload = sessionPayload || (await shopeePageContextFetch(client, '/api/v1/session')).json;
  assertShopeePageOk(sessionPayload, 'load session');
  const liveSessionId = readSessionId(sessionPayload);
  if (!liveSessionId) throw new Error('Shopee mobile API ไม่คืน session_id');
  const sessionStatus = readShopeeSessionStatus(sessionPayload);
  if (sessionStatus === 2) throw new Error('Shopee Live session นี้จบแล้ว');

  const sessionData = dataOf(unwrapShopeeTuple(sessionPayload));
  const session = sessionData?.session || sessionData || {};
  const updatePayload = {
    session: String(liveSessionId),
    title: titleText,
    cover_pic: coverCandidate || session.cover_pic || session.coverPic || '',
    description,
    device_id: session.device_id || session.deviceId || readDeviceId(cookie, sessionPayload),
    subtitle: session.subtitle || '',
  };
  const skipMetadataUpdate = sessionStatus === 1;
  let updateSucceeded = skipMetadataUpdate;
  let updateError = skipMetadataUpdate ? 'Shopee Live session กำลังไลฟ์อยู่แล้ว จึงข้ามการอัปเดตข้อมูลห้องตอนเริ่มไลฟ์' : '';
  if (!skipMetadataUpdate) {
    try {
      const updateResponse = (await shopeePageContextFetch(client, `/api/v1/session/${encodeURIComponent(String(liveSessionId))}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: updatePayload,
      })).json;
      assertShopeePageOk(updateResponse, 'update session');
      updateSucceeded = true;
    } catch (error) {
      updateError = cleanShopeeRuntimeErrorText(error instanceof Error ? error.message : String(error));
    }
  }
  const blockedByLivingSession = /ErrorStreamSessionIsLiving|StreamSessionIsLiving/i.test(updateError);
  if (coverCandidate && !updateSucceeded && !blockedByLivingSession) {
    throw new AppError(
      `Shopee ไม่รับรูปภาพหน้าปก: ${updateError || 'อัปเดตข้อมูลห้องไม่สำเร็จ'}`,
      502,
    );
  }
  const alreadyLive = sessionStatus === 1 || blockedByLivingSession;

  const productUpdate = await updateShopeeBasketItemsViaPageContext(client, String(liveSessionId), basketItems);
  assertRequiredBasketUpdated(productUpdate, basketItems);

  let detailPayload: any = null;
  let pushUrlPayload: any = null;
  let previewPayload: any = null;
  try {
    detailPayload = (await shopeePageContextFetch(client, `/api/v1/session/${encodeURIComponent(String(liveSessionId))}`, { timeoutMs: 8_000 })).json;
  } catch {}
  try {
    pushUrlPayload = (await shopeePageContextFetch(client, `/api/v1/session/${encodeURIComponent(String(liveSessionId))}/push_url_list`, { timeoutMs: 8_000 })).json;
  } catch {}
  try {
    const uuid = readDeviceId(cookie, sessionPayload);
    previewPayload = (await shopeePageContextFetch(
      client,
      `/api/v1/session/${encodeURIComponent(String(liveSessionId))}/preview?uuid=${encodeURIComponent(uuid)}&ver=2`,
      { timeoutMs: 8_000 },
    )).json;
  } catch {}

  const pushUrl =
    readPushUrl(pushUrlPayload) ||
    extractShopeeRtmpFromPayload(pushUrlPayload) ||
    readPushUrl(previewPayload) ||
    extractShopeeRtmpFromPayload(previewPayload) ||
    readPushUrl(detailPayload) ||
    extractShopeeRtmpFromPayload(detailPayload) ||
    readPushUrl(sessionPayload) ||
    extractShopeeRtmpFromPayload(sessionPayload) ||
    '';

  if (!pushUrl) {
    return {
      liveSessionId: String(liveSessionId),
      rtmpUrl: '',
      streamKey: '',
      coverImageUrl: coverImageUrl ?? null,
      alreadyLive,
      raw: {
        source: 'chrome-page-context-fetch',
        usedStoredSessionId,
        alreadyLive,
        updateSucceeded,
        updateError,
        hasCoverPic: Boolean(updatePayload.cover_pic),
        hasPushUrl: false,
        productUpdate,
      },
    };
  }

  const { rtmpUrl, streamKey } = splitShopeePushUrl(pushUrl);
  return {
    liveSessionId: String(liveSessionId),
    rtmpUrl,
    streamKey,
    coverImageUrl: coverImageUrl ?? null,
    alreadyLive,
    raw: {
      source: 'chrome-page-context-fetch',
      usedStoredSessionId,
      alreadyLive,
      updateSucceeded,
      updateError,
      hasCoverPic: Boolean(updatePayload.cover_pic),
      hasPushUrl: true,
      productUpdate,
    },
  };
}

async function ensureShopeeRuntime(client: CdpClient): Promise<void> {
  console.info('[shopee-runtime] ensure: read href');
  const state = await client.send<{ result?: { value?: string } }>('Runtime.evaluate', {
    expression: 'location.href',
    returnByValue: true,
  }, 5_000);
  const href = state.result?.value || '';
  if (!href.includes('live.shopee.co.th/p/setup')) {
    console.info('[shopee-runtime] ensure: navigate setup', { from: href || 'blank' });
    await client.send('Page.navigate', { url: SHOPEE_MOBILE_REFERER }, 5_000).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 6_000));
  }

  const injectRuntime = () => client.send('Runtime.evaluate', {
    expression: `
      (() => {
        if (window.__codex_require__) return true;
        const id = 'codex_capture_' + Date.now();
        const modules = {};
        modules[id] = function(module, exports, __webpack_require__) {
          window.__codex_require__ = __webpack_require__;
          module.exports = {};
        };
        if (window.webpackJsonp_N_E && window.webpackJsonp_N_E.push) {
          window.webpackJsonp_N_E.push([[id], modules, [[id]]]);
        }
        if (!window.__codex_require__ && window.webpackJsonp) {
          window.webpackJsonp([id], modules, [id]);
        }
        return Boolean(window.__codex_require__);
      })()
    `,
    awaitPromise: true,
    returnByValue: true,
  }, 5_000);

  const checkReady = () => client.send<{ result?: { value?: string }; exceptionDetails?: any }>(
    'Runtime.evaluate',
    {
      expression: `
      (() => {
        const inject = () => {
          if (window.__codex_require__) return true;
          const id = 'codex_capture_' + Date.now();
          const modules = {};
          modules[id] = function(module, exports, __webpack_require__) {
            window.__codex_require__ = __webpack_require__;
            module.exports = {};
          };
          if (window.webpackJsonp_N_E && window.webpackJsonp_N_E.push) {
            window.webpackJsonp_N_E.push([[id], modules, [[id]]]);
          }
          if (!window.__codex_require__ && window.webpackJsonp) {
            window.webpackJsonp([id], modules, [id]);
          }
          return Boolean(window.__codex_require__);
        };
        let lastError = '';
        const hasMobileLiveModules = () => {
          try {
            inject();
            const req = window.__codex_require__;
            if (!req) return false;
            const setupApi = req('vwzm');
            const sessionApi = req('WzRY');
            return Boolean(
              setupApi &&
                typeof setupApi.h === 'function' &&
                sessionApi &&
                typeof sessionApi.u === 'function' &&
                typeof sessionApi.p === 'function'
            );
          } catch (error) {
            lastError = error && error.message ? error.message : String(error);
            return false;
          }
        };

        if (hasMobileLiveModules()) {
          const req = window.__codex_require__;
          return JSON.stringify({
            ready: true,
            href: location.href,
            hasRequire: true,
            vwzmKeys: Object.keys(req('vwzm') || {}),
            wzryKeys: Object.keys(req('WzRY') || {})
          });
        }

        let vwzmKeys = [];
        let wzryKeys = [];
        try { vwzmKeys = window.__codex_require__ ? Object.keys(window.__codex_require__('vwzm') || {}) : []; } catch (error) {}
        try { wzryKeys = window.__codex_require__ ? Object.keys(window.__codex_require__('WzRY') || {}) : []; } catch (error) {}
        return JSON.stringify({
          ready: false,
          href: location.href,
          hasRequire: Boolean(window.__codex_require__),
          hasWebpack: Boolean(window.webpackJsonp_N_E && window.webpackJsonp_N_E.push),
          vwzmKeys,
          wzryKeys,
          text: document.body ? document.body.innerText.slice(0, 240) : '',
          lastError
        });
      })()
    `,
      returnByValue: true,
    },
    5_000,
  );

  console.info('[shopee-runtime] ensure: inject runtime');
  await injectRuntime().catch(() => undefined);
  console.info('[shopee-runtime] ensure: wait modules');
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  let ready = await checkReady();
  let diagnostic = ready.result?.value || '';

  if (ready.exceptionDetails || !diagnostic.includes('"ready":true')) {
    console.info('[shopee-runtime] ensure: retry navigate setup');
    await client.send('Page.navigate', { url: SHOPEE_MOBILE_REFERER }, 5_000).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 8_000));
    console.info('[shopee-runtime] ensure: retry inject runtime');
    await injectRuntime().catch(() => undefined);
    console.info('[shopee-runtime] ensure: retry wait modules');
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    ready = await checkReady();
    diagnostic = ready.result?.value || diagnostic;
  }

  if (ready.exceptionDetails || !diagnostic.includes('"ready":true')) {
    const detail =
      ready.exceptionDetails?.exception?.description ||
      ready.exceptionDetails?.text ||
      diagnostic.slice(0, 900);
    throw new Error(`Shopee mobile runtime ยังโหลด module สำหรับสร้างห้อง Live ไม่ครบ${detail ? `: ${detail}` : ''}`);
  }
}

async function createSessionViaProbeStyleRuntime(
  cookie: string,
  title: string,
  coverImageUrl?: string | null,
  descriptionText?: string | null,
  basketItems: ShopeeBasketItem[] = [],
  existingLiveSessionId?: string | null,
): Promise<LiveSession | null> {
  if (process.env.SHOPEE_DISABLE_CHROME_RUNTIME === 'true') return null;

  try {
    return await withShopeeChromeTarget(async (client) => {
      console.info('[shopee-runtime] probe create: prepare target');
      if (process.env.SHOPEE_SYNC_COOKIES_TO_CHROME !== 'false') {
        console.info('[shopee-runtime] probe create: sync cookies');
        await setShopeeCookiesInChrome(client, cookie);
      }

      console.info('[shopee-runtime] probe create: navigate mobile api page');
      await client.send('Page.navigate', { url: SHOPEE_MOBILE_API_REFERER }, 5_000).catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 1_800));
      await client.send('Page.stopLoading', {}, 3_000).catch(() => undefined);

      const preflight = await client.send<{ result?: { value?: string }; exceptionDetails?: any }>(
        'Runtime.evaluate',
        {
          expression: `
            JSON.stringify({
              href: location.href,
              title: document.title || '',
              hasWebpack: Boolean(window.webpackJsonp_N_E && window.webpackJsonp_N_E.push),
              hasRequire: Boolean(window.__codex_require__),
              bodyText: (document.body && document.body.innerText || '').slice(0, 240)
            })
          `,
          returnByValue: true,
        },
        8_000,
      );
      const preflightText = preflight.result?.value || '{}';
      const preflightState = JSON.parse(preflightText) as {
        href?: string;
        title?: string;
        hasWebpack?: boolean;
        hasRequire?: boolean;
        bodyText?: string;
      };
      console.info('[shopee-runtime] probe create: preflight', {
        href: preflightState.href,
        hasWebpack: preflightState.hasWebpack,
        hasRequire: preflightState.hasRequire,
        title: preflightState.title,
      });
      if (!String(preflightState.href || '').includes('live.shopee.co.th')) {
        throw new Error(`Shopee mobile runtime หลุดจาก live.shopee.co.th ไปที่ ${preflightState.href || 'unknown page'}`);
      }

      try {
        console.info('[shopee-runtime] probe create: use page-context fetch bridge');
        return await createSessionViaPageContextFetch(
          client,
          cookie,
          title,
          coverImageUrl,
          descriptionText,
          basketItems,
          existingLiveSessionId,
        );
      } catch (error) {
        if (isTransientCdpTargetError(error)) throw error;
        if (basketItems.length > 0) throw error;
        console.warn(
          '[shopee-runtime] page-context fetch bridge failed; fallback to webpack runtime',
          cleanShopeeRuntimeErrorText(error instanceof Error ? error.message : String(error)),
        );
      }

      const coverCandidate = await resolveCoverPayloadForShopee(cookie, coverImageUrl);
      const expression = `
        (async () => {
          const title = ${JSON.stringify(title.trim().slice(0, 200))};
          const description = ${JSON.stringify((descriptionText || title).trim().slice(0, 200))};
          const coverCandidate = ${JSON.stringify(coverCandidate)};
          const basketItems = ${JSON.stringify(basketItems.map(({ shop_id, item_id, url }) => ({ shop_id, item_id, url })))};
          const existingLiveSessionId = ${JSON.stringify(existingLiveSessionId || '')};
          const inject = () => {
            if (window.__codex_require__) return true;
            const id = 'codex_call_probe_' + Date.now();
            const modules = {};
            modules[id] = function(module, exports, __webpack_require__) {
              window.__codex_require__ = __webpack_require__;
              module.exports = {};
            };
            if (window.webpackJsonp_N_E && window.webpackJsonp_N_E.push) {
              window.webpackJsonp_N_E.push([[id], modules, [[id]]]);
            }
            return Boolean(window.__codex_require__);
          };
          const timeout = (promise, ms, label) => Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' timeout')), ms)),
          ]);
          const unwrap = (payload) => Array.isArray(payload) ? (payload[1] || payload[0]) : payload;
          const dataOf = (payload) => {
            const unwrapped = unwrap(payload);
            return (unwrapped && unwrapped.data) || unwrapped || {};
          };
          const validPush = (value) =>
            typeof value === 'string' && /^(?:rtmps?|srtrtmp):\\/\\//i.test(value) && !/speedtest/i.test(value);
          const readPush = (payload) => {
            const seen = new Set();
            const stack = [dataOf(payload)];
            while (stack.length) {
              const value = stack.pop();
              if (validPush(value)) return value;
              if (!value || typeof value !== 'object' || seen.has(value)) continue;
              seen.add(value);
              Object.values(value).forEach((child) => stack.push(child));
            }
            return '';
          };
          const readSessionId = (payload) => {
            const data = dataOf(payload);
            const session = data.session || data;
            const value = session.session_id || session.sessionId || session.id || data.session_id || data.sessionId || data.id || '';
            return value ? String(value) : '';
          };
          const readStatus = (payload) => {
            const data = dataOf(payload);
            const session = data.session || data;
            const value = session.status ?? data.status;
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : null;
          };
          const fetchJson = async (path, options = {}) => {
            const csrfToken = (document.cookie.match(/(?:^|;\\s*)csrftoken=([^;]+)/) || [])[1] || '';
            const response = await timeout(fetch('https://live.shopee.co.th' + path, {
              credentials: 'include',
              ...options,
              headers: {
                accept: 'application/json, text/plain, */*',
                'x-requested-with': 'XMLHttpRequest',
                'x-shopee-language': 'th',
                'x-livestreaming-source': 'shopee',
                ...(csrfToken ? { 'x-csrftoken': decodeURIComponent(csrfToken) } : {}),
                ...(options.headers || {}),
              },
            }), 10_000, path);
            const text = await response.text();
            let json = null;
            try { json = JSON.parse(text); } catch {}
            if (!response.ok) {
              const message = (json && (json.err_msg || json.msg || json.message || json.error)) || text.slice(0, 300);
              throw new Error(path + ' HTTP ' + response.status + (message ? ': ' + message : ''));
            }
            return json || text;
          };
          const cleanBasketItems = basketItems.map((item) => ({
            shop_id: Number(item.shop_id),
            item_id: Number(item.item_id)
          })).filter((item) => Number.isFinite(item.shop_id) && Number.isFinite(item.item_id));
          const basketUrls = basketItems.map((item) => item.url).filter(Boolean);
          const hasUnresolvedBasketLinks = basketItems.some((item) => {
            const shop = Number(item.shop_id);
            const itemId = Number(item.item_id);
            return !Number.isFinite(shop) || shop <= 0 || !Number.isFinite(itemId) || itemId <= 0;
          });
          const collectItems = (payload) => {
            const output = [];
            const seen = new Set();
            const stack = [dataOf(payload)];
            while (stack.length) {
              const value = stack.pop();
              if (!value || typeof value !== 'object') continue;
              const shopId = value.shop_id ?? value.shopId;
              const itemId = value.item_id ?? value.itemId;
              if (shopId && itemId) {
                const item = { shop_id: Number(shopId), item_id: Number(itemId) };
                const key = item.shop_id + ':' + item.item_id;
                if (Number.isFinite(item.shop_id) && Number.isFinite(item.item_id) && !seen.has(key)) {
                  seen.add(key);
                  output.push(item);
                }
              }
              Object.values(value).forEach((child) => stack.push(child));
            }
            return output;
          };
          const assertShopeeOk = (payload, label) => {
            const errCode = payload && (payload.err_code ?? payload.error ?? payload.code);
            if (errCode !== undefined && Number(errCode) !== 0) {
              throw new Error((payload.err_msg || payload.msg || payload.message || label + ' Shopee err_code ' + errCode));
            }
          };
          const writeItems = async (sessionId, items) => {
            const payload = await fetchJson('/api/v1/session/' + encodeURIComponent(String(sessionId)) + '/items', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items }),
            });
            assertShopeeOk(payload, 'update items');
            return payload;
          };
          const addItems = async (sessionId, items) => {
            const payload = await fetchJson('/api/v1/session/' + encodeURIComponent(String(sessionId)) + '/add_items', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items }),
            });
            assertShopeeOk(payload, 'add items');
            return payload;
          };
          const importItemsFromLinks = async (sessionId) => {
            let parsed = null;
            let parseError = '';
            for (const path of ['/webapi/v1/item/parse_url', '/api/v1/item/parse_url']) {
              try {
                parsed = await fetchJson(path, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ links: basketUrls }),
                });
                assertShopeeOk(parsed, 'parse item URL');
                break;
              } catch (error) {
                parseError = error && error.message ? error.message : String(error);
              }
            }
            const parsedItems = collectItems(parsed);
            const candidateItems = parsedItems.length ? parsedItems : cleanBasketItems;
            let importError = '';
            for (const path of [
              '/webapi/v1/session/' + encodeURIComponent(String(sessionId)) + '/import_items/detail',
              '/api/v1/session/' + encodeURIComponent(String(sessionId)) + '/import_items/detail'
            ]) {
              try {
                const imported = await fetchJson(path, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ items: candidateItems, links: basketUrls }),
                });
                assertShopeeOk(imported, 'import items');
                return collectItems(imported).length ? collectItems(imported) : candidateItems;
              } catch (error) {
                importError = error && error.message ? error.message : String(error);
              }
            }
            throw new Error(importError || parseError || 'Shopee import item URL ไม่สำเร็จ');
          };
          const updateProductItems = async (sessionId) => {
            const status = {
              attempted: basketItems.length > 0,
              requestedCount: basketItems.length,
              succeeded: basketItems.length === 0,
              count: cleanBasketItems.length,
              usedAddItems: false,
              usedImportFlow: false,
              error: ''
            };
            if (!cleanBasketItems.length || hasUnresolvedBasketLinks) {
              if (basketUrls.length) {
                status.usedImportFlow = true;
                try {
                  const importedItems = await importItemsFromLinks(sessionId);
                  const mergedItems = [...cleanBasketItems, ...importedItems].filter((item, index, all) => {
                    const key = item.shop_id + ':' + item.item_id;
                    return all.findIndex((other) => other.shop_id + ':' + other.item_id === key) === index;
                  });
                  await addItems(sessionId, mergedItems).catch(() => writeItems(sessionId, mergedItems));
                  status.succeeded = true;
                  status.count = mergedItems.length;
                  return status;
                } catch (importError) {
                  status.error = importError && importError.message ? importError.message : String(importError);
                  throw new Error(status.error);
                }
              }
              status.error = basketItems.length ? 'ไม่มีสินค้าในตะกร้าที่พร้อมปักหลังแปลงลิงก์' : '';
              return status;
            }
            try {
              await addItems(sessionId, cleanBasketItems);
              status.usedAddItems = true;
              status.succeeded = true;
              return status;
            } catch (addItemsError) {
              status.error = addItemsError && addItemsError.message ? addItemsError.message : String(addItemsError);
            }
            try {
              await writeItems(sessionId, cleanBasketItems);
              status.succeeded = true;
              return status;
            } catch (firstError) {
              if (!basketUrls.length) throw new Error(status.error || (firstError && firstError.message ? firstError.message : String(firstError)));
              status.usedImportFlow = true;
              try {
                const importedItems = await importItemsFromLinks(sessionId);
                await addItems(sessionId, importedItems).catch(() => writeItems(sessionId, importedItems));
                status.succeeded = true;
                return status;
              } catch (importError) {
                throw new Error(status.error || (importError && importError.message ? importError.message : String(importError)));
              }
            }
          };

          let directSessionPayload = null;
          let usedStoredSessionId = false;
          if (existingLiveSessionId) {
            try {
              const storedSessionPayload = await fetchJson('/api/v1/session/' + encodeURIComponent(existingLiveSessionId));
              if (readSessionId(storedSessionPayload) && readStatus(storedSessionPayload) !== 2) {
                directSessionPayload = storedSessionPayload;
                usedStoredSessionId = true;
              }
              if (!directSessionPayload) throw new Error('stored session finished or unavailable');
            } catch (error) {
              throw new Error('Shopee Live session ที่เตรียมตะกร้าไว้ใช้งานไม่ได้: ' + (error && error.message ? error.message : String(error)));
            }
          }
          directSessionPayload = directSessionPayload || await fetchJson('/api/v1/session');
          const directSessionData = dataOf(directSessionPayload);
          const directSession = directSessionData.session || directSessionData || {};
          const directSessionId = readSessionId(directSessionPayload);
          if (!directSessionId) {
            throw new Error('Shopee mobile API ไม่คืน session_id');
          }
          if (readStatus(directSessionPayload) === 2) {
            throw new Error('Shopee Live session นี้จบแล้ว');
          }

          const directUpdatePayload = {
            session: String(directSessionId),
            title,
            cover_pic: coverCandidate || directSession.cover_pic || directSession.coverPic || '',
            description,
            device_id: directSession.device_id || directSession.deviceId || 'codex-mobile-runtime',
            subtitle: directSession.subtitle || ''
          };
          let updateSucceeded = false;
          let updateError = '';
          try {
            const updateResult = await fetchJson('/api/v1/session/' + encodeURIComponent(String(directSessionId)), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(directUpdatePayload),
            });
            assertShopeeOk(updateResult, 'update session');
            updateSucceeded = true;
          } catch (error) {
            updateError = error && error.message ? error.message : String(error);
          }
          if (coverCandidate && updateError) {
            throw new Error('Shopee ไม่รับรูปภาพหน้าปก: ' + updateError);
          }

          const productUpdateStatus = await updateProductItems(String(directSessionId)).catch((error) => ({
            attempted: basketItems.length > 0,
            requestedCount: basketItems.length,
            succeeded: false,
            count: cleanBasketItems.length,
            usedAddItems: false,
            usedImportFlow: false,
            error: error && error.message ? error.message : String(error),
            warning: 'เพิ่มสินค้าเข้าตะกร้า Shopee Live ไม่สำเร็จ'
          }));

          let directDetailPayload = null;
          let directPushPayload = null;
          let directPreviewPayload = null;
          try {
            directDetailPayload = await fetchJson('/api/v1/session/' + encodeURIComponent(String(directSessionId)));
          } catch {}
          try {
            directPushPayload = await fetchJson('/api/v1/session/' + encodeURIComponent(String(directSessionId)) + '/push_url_list');
          } catch {}
          try {
            const uuid = document.cookie.match(/(?:^|; )LIVE_STREAMING_UUID_KEY=([^;]+)/)?.[1] || directUpdatePayload.device_id;
            directPreviewPayload = await fetchJson('/api/v1/session/' + encodeURIComponent(String(directSessionId)) + '/preview?uuid=' + encodeURIComponent(uuid) + '&ver=2');
          } catch {}
          const directDetailData = dataOf(directDetailPayload || directSessionPayload);
          const directDetailSession = directDetailData.session || directDetailData || {};
          const directPushUrl =
            readPush(directPushPayload) ||
            readPush(directPreviewPayload) ||
            [directDetailSession.push_url, directDetailSession.pushUrl, directSession.push_url, directSession.pushUrl].find(validPush) ||
            readPush(directDetailPayload) ||
            readPush(directSessionPayload) ||
            '';

          return JSON.stringify({
            liveSessionId: String(directSessionId),
            pushUrl: directPushUrl,
            raw: {
              source: 'chrome-mobile-direct-api',
              usedStoredSessionId,
              href: location.href,
              status: directDetailSession.status ?? directSession.status ?? null,
              hasPushUrl: Boolean(directPushUrl),
              usedPushUrlList: Boolean(readPush(directPushPayload)),
              usedPreview: Boolean(!readPush(directPushPayload) && readPush(directPreviewPayload)),
              updateSucceeded,
              updateError: updateError ? updateError.slice(0, 300) : '',
              hasCoverPic: Boolean(directUpdatePayload.cover_pic),
              productUpdate: productUpdateStatus,
            }
          });

          if (!inject()) {
            throw new Error('Next runtime webpack ยังไม่พร้อม: ' + location.href);
          }

          const req = window.__codex_require__;
          const vwzm = req && req('vwzm');
          const WzRY = req && req('WzRY');
          if (!vwzm || typeof vwzm.h !== 'function' || !WzRY || typeof WzRY.u !== 'function' || typeof WzRY.p !== 'function') {
            throw new Error('Shopee mobile module ยังไม่ครบ: ' + location.href);
          }

          const sessionPayload = await timeout(vwzm.h(), 8_000, 'vwzm.h GET /session');
          const sessionData = dataOf(sessionPayload);
          const session = sessionData.session || sessionData || {};
          const sessionId = readSessionId(sessionPayload);
          if (!sessionId) {
            throw new Error('Shopee mobile API ไม่คืน session_id');
          }
          if (readStatus(sessionPayload) === 2) {
            throw new Error('Shopee Live session นี้จบแล้ว');
          }

          const updatePayload = {
            session: String(sessionId),
            title,
            cover_pic: coverCandidate || session.cover_pic || session.coverPic || '',
            description,
            device_id: session.device_id || session.deviceId || 'codex-mobile-runtime',
            subtitle: session.subtitle || ''
          };
          const updateResponse = await timeout(WzRY.u(updatePayload), 12_000, 'WzRY.u PUT /session/{id}');
          const moduleProductUpdateStatus = await updateProductItems(String(sessionId)).catch((error) => ({
            attempted: basketItems.length > 0,
            requestedCount: basketItems.length,
            succeeded: false,
            count: cleanBasketItems.length,
            usedAddItems: false,
            usedImportFlow: false,
            error: error && error.message ? error.message : String(error),
            warning: 'เพิ่มสินค้าเข้าตะกร้า Shopee Live ไม่สำเร็จ'
          }));
          const detailPayload = await timeout(WzRY.p(String(sessionId)), 8_000, 'WzRY.p GET /session/{id}');
          const detailData = dataOf(detailPayload);
          const detailSession = detailData.session || detailData || {};
          const pushUrl =
            detailSession.push_url ||
            detailSession.pushUrl ||
            session.push_url ||
            session.pushUrl ||
            readPush(detailPayload) ||
            readPush(updateResponse) ||
            readPush(sessionPayload) ||
            '';

          return JSON.stringify({
            liveSessionId: String(sessionId),
            pushUrl,
            raw: {
              source: 'chrome-mobile-probe-runtime',
              href: location.href,
              status: detailSession.status ?? session.status ?? null,
              hasPushUrl: Boolean(pushUrl),
              updateSucceeded: Boolean(updateResponse),
              hasCoverPic: Boolean(updatePayload.cover_pic),
              productUpdate: moduleProductUpdateStatus,
            }
          });
        })()
      `;

      const result = await withTimeout(
        client.send<{ result?: { value?: string }; exceptionDetails?: any }>(
          'Runtime.evaluate',
          {
            expression,
            awaitPromise: true,
            returnByValue: true,
          },
          30_000,
        ),
        35_000,
        'Shopee probe-style mobile runtime create session',
      );
      if (result.exceptionDetails) {
        const exceptionText =
          result.exceptionDetails?.exception?.description ||
          result.exceptionDetails?.text ||
          JSON.stringify(result.exceptionDetails);
        throw new Error(cleanShopeeRuntimeErrorText(exceptionText));
      }

      const payload = JSON.parse(result.result?.value || '{}');
      if (!payload.liveSessionId) throw new Error('Shopee probe-style runtime ไม่คืน session_id');
      assertRequiredBasketUpdated(payload.raw?.productUpdate, basketItems);
      const pushUrl = typeof payload.pushUrl === 'string' ? payload.pushUrl : '';
      if (!pushUrl) {
        return {
          liveSessionId: String(payload.liveSessionId),
          rtmpUrl: '',
          streamKey: '',
          coverImageUrl: coverImageUrl ?? null,
          raw: payload.raw,
        };
      }

      const { rtmpUrl, streamKey } = splitShopeePushUrl(pushUrl);
      return {
        liveSessionId: String(payload.liveSessionId),
        rtmpUrl,
        streamKey,
        coverImageUrl: coverImageUrl ?? null,
        raw: payload.raw,
      };
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(error instanceof Error ? error.message : 'Shopee probe-style runtime ทำงานไม่สำเร็จ', 502);
  }
}

async function createSessionViaShopeeRuntime(
  cookie: string,
  title: string,
  coverImageUrl?: string | null,
  descriptionText?: string | null,
  existingLiveSessionId?: string | null,
  platformUid?: string | null,
): Promise<LiveSession | null> {
  if (process.env.SHOPEE_DISABLE_CHROME_RUNTIME === 'true') return null;

  try {
    return await withShopeeChromeTarget(async (client) => {
      console.info('[shopee-runtime] create session: ensure mobile runtime');
      await ensureShopeeRuntime(client);
      console.info('[shopee-runtime] create session: runtime ready');
      if (process.env.SHOPEE_SYNC_COOKIES_TO_CHROME === 'true') {
        console.info('[shopee-runtime] create session: set cookies');
        await setShopeeCookiesInChrome(client, cookie);
      }

      const coverCandidate = await resolveCoverPayloadForShopee(cookie, coverImageUrl);
      const waitMs = Math.max(1_000, Number(process.env.SHOPEE_MOBILE_SESSION_WAIT_MS || 120_000));
      const expression = `
        (async () => {
          const title = ${JSON.stringify(title.trim().slice(0, 200))};
          const description = ${JSON.stringify((descriptionText || title).trim().slice(0, 200))};
          const coverCandidate = ${JSON.stringify(coverCandidate)};
          const existingLiveSessionId = ${JSON.stringify(existingLiveSessionId || '')};
          const platformUid = ${JSON.stringify(platformUid || '')};
          const waitMs = ${JSON.stringify(waitMs)};
          const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          const unwrap = (payload) => Array.isArray(payload) ? (payload[1] || payload[0]) : payload;
          const dataOf = (payload) => {
            const unwrapped = unwrap(payload);
            return (unwrapped && unwrapped.data) || unwrapped || {};
          };
          const assertShopeeOk = (payload, label) => {
            const unwrapped = unwrap(payload);
            const errCode = unwrapped && (unwrapped.err_code ?? unwrapped.error ?? unwrapped.code);
            if (errCode !== undefined && Number(errCode) !== 0) {
              throw new Error((unwrapped.err_msg || unwrapped.msg || unwrapped.message || label + ' Shopee err_code ' + errCode));
            }
          };
          const validPush = (value) =>
            typeof value === 'string' && /^(?:rtmps?|srtrtmp):\\/\\//i.test(value) && !/speedtest/i.test(value);
          const readPush = (payload) => {
            const seen = new Set();
            const stack = [dataOf(payload)];
            while (stack.length) {
              const value = stack.pop();
              if (validPush(value)) return value;
              if (!value || typeof value !== 'object' || seen.has(value)) continue;
              seen.add(value);
              Object.values(value).forEach((child) => stack.push(child));
            }
            return '';
          };
          const cookieValue = (name) => {
            const prefix = name + '=';
            const found = document.cookie
              .split(';')
              .map((part) => part.trim())
              .find((part) => part.startsWith(prefix));
            return found ? decodeURIComponent(found.slice(prefix.length)) : '';
          };
          const readSessionId = (payload) => {
            const data = dataOf(payload);
            const session = data.session || data;
            const value = session.session_id || session.sessionId || session.id || data.session_id || data.sessionId || data.id || '';
            return value ? String(value) : '';
          };
          const readSessionStatus = (payload) => {
            const data = dataOf(payload);
            const session = data.session || data;
            const value = session.status ?? data.status;
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : null;
          };
          const readRtmp = (payload) => {
            const raw = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
            const match = raw.replace(/\\\\\\//g, '/').match(/(?:rtmps?|srtrtmp):\\/\\/[^\\s"'<>\\\\]+/i);
            return match && validPush(match[0]) ? match[0] : '';
          };
          const fetchJson = async (path, options = {}) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 8000);
            try {
              const origin = location.hostname.endsWith('shopee.co.th') ? location.origin : 'https://live.shopee.co.th';
              const response = await fetch(origin + path, {
                credentials: 'include',
                ...options,
                signal: controller.signal,
              });
              const text = await response.text();
              let json = null;
              try { json = JSON.parse(text); } catch {}
              return { response, text, json };
            } finally {
              clearTimeout(timer);
            }
          };

          let sessionPayload = null;
          let lastError = '';
          let sessionId = '';
          const timeout = (promise, ms, label) => Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' timeout')), ms)),
          ]);
          const runtimeRequire = () => window.__codex_require__ || null;
          const tryRuntimeCall = async (label, getter) => {
            try {
              const fn = getter(runtimeRequire());
              if (typeof fn !== 'function') return null;
              const value = await timeout(fn(), 12000, label);
              return { label, value };
            } catch (error) {
              lastError = label + ': ' + (error && error.message ? error.message : String(error));
              return null;
            }
          };
          const acceptSession = (payload, source) => {
            if (!payload) return false;
            const status = readSessionStatus(payload);
            if (status === 2) {
              lastError = source + ': session finished';
              return false;
            }
            const foundSessionId = readSessionId(payload);
            if (!foundSessionId) return false;
            sessionPayload = payload;
            sessionId = foundSessionId;
            return true;
          };

          const runtimeSession =
            (await tryRuntimeCall('next runtime get session', (req) => req && req('vwzm') && req('vwzm').h)) ||
            (await tryRuntimeCall('legacy runtime get session', (req) => {
              const api = req && req(164) && req(164).a;
              return api && api.getSessionInfo ? () => api.getSessionInfo() : null;
            }));

          if (existingLiveSessionId) {
            try {
              const storedDetail = await fetchJson('/api/v1/session/' + encodeURIComponent(existingLiveSessionId));
              const storedStatus = readSessionStatus(storedDetail.json);
              if (storedDetail.response.ok && storedDetail.json && (storedDetail.json.err_code === 0 || storedDetail.json.err_code === undefined) && storedStatus !== 2) {
                sessionPayload = storedDetail.json;
                sessionId = existingLiveSessionId;
              } else if (storedStatus === 2) {
                throw new Error('stored session finished');
              } else {
                throw new Error((storedDetail.json && (storedDetail.json.err_msg || storedDetail.json.msg || storedDetail.json.message)) || storedDetail.text || 'stored session unavailable');
              }
            } catch (error) {
              throw new Error('Shopee Live session ที่เตรียมตะกร้าไว้ใช้งานไม่ได้: ' + (error && error.message ? error.message : String(error)));
            }
          }

          if (!sessionId && runtimeSession) acceptSession(runtimeSession.value, runtimeSession.label);

          if (sessionId) {
            const sessionData = dataOf(sessionPayload);
            const session = sessionData.session || sessionData || {};
            const deviceId =
              session.device_id ||
              session.deviceId ||
              cookieValue('LIVE_STREAMING_UUID_KEY') ||
              cookieValue('SPC_F') ||
              cookieValue('SPC_CLIENTID') ||
              cookieValue('SPC_U') ||
              String(Date.now());
            const coverPic = coverCandidate || session.cover_pic || session.coverPic || '';
            const updatePayload = {
              session: sessionId,
              title,
              cover_pic: coverPic,
              description,
              device_id: deviceId,
              subtitle: session.subtitle || ''
            };

            let updateResponse = null;
            let detailPayload = null;
            try {
              const req = runtimeRequire();
              const nextUpdate = req && req('WzRY') && req('WzRY').u;
              if (typeof nextUpdate === 'function') {
                updateResponse = await timeout(nextUpdate(updatePayload), 20000, 'next runtime update session');
                assertShopeeOk(updateResponse, 'update session');
              }
            } catch (error) {
              lastError = error && error.message ? error.message : String(error);
            }
            if (coverPic && !updateResponse) {
              throw new Error('Shopee ไม่รับรูปภาพหน้าปก: ' + (lastError || 'อัปเดตข้อมูลห้องไม่สำเร็จ'));
            }
            try {
              const req = runtimeRequire();
              const nextDetail = req && req('WzRY') && req('WzRY').p;
              if (typeof nextDetail === 'function') {
                detailPayload = await timeout(nextDetail(sessionId), 12000, 'next runtime detail session');
              }
            } catch (error) {
              lastError = error && error.message ? error.message : String(error);
            }

            const detailData = dataOf(detailPayload || sessionPayload);
            const detailSession = detailData.session || detailData || {};
            const pushUrl =
              detailSession.push_url ||
              detailSession.pushUrl ||
              session.push_url ||
              session.pushUrl ||
              readRtmp(detailPayload) ||
              readPush(detailPayload) ||
              readRtmp(updateResponse) ||
              readPush(updateResponse) ||
              readRtmp(sessionPayload) ||
              readPush(sessionPayload);
            const uid = detailSession.uid || session.uid || '';
            const shareUrl = 'https://live.shopee.co.th/p/share?from=live&session=' + encodeURIComponent(sessionId);
            const path = 'ShopeeLiveStreamingPush?sessionId=' + encodeURIComponent(sessionId) +
              '&shareUrl=' + encodeURIComponent(shareUrl) +
              '&endPageUrl=' + encodeURIComponent(window.location.origin + '/p/live-end') +
              '&productSelectUrl=' + encodeURIComponent(window.location.origin + '/p/product-select?session=' + sessionId + '&from_source=streamer_add_product') +
              '&fromType=0&auctionAllow=1';

            return JSON.stringify({
              liveSessionId: sessionId,
              pushUrl,
              shareUrl,
              uid: uid ? String(uid) : '',
              mobilePush: { path },
              raw: {
                source: 'chrome-mobile-runtime',
                happyPath: true,
                runtimeSource: runtimeSession.label,
                status: detailSession.status,
                hasPushUrl: Boolean(pushUrl),
                hasCoverPic: Boolean(coverPic),
                updateSucceeded: Boolean(updateResponse),
                usedStoredSessionId: Boolean(existingLiveSessionId && sessionId === existingLiveSessionId),
                lastError
              }
            });
          }

          if (!sessionId && platformUid) {
            try {
              const hostSession = await fetchJson('/api/v1/host_session?uid=' + encodeURIComponent(platformUid));
              const hostStatus = readSessionStatus(hostSession.json);
              if (hostSession.response.ok && hostSession.json && (hostSession.json.err_code === 0 || hostSession.json.err_code === undefined) && hostStatus !== 2) {
                sessionPayload = hostSession.json;
                sessionId = readSessionId(hostSession.json);
              } else if (hostStatus === 2) {
                lastError = 'latest host session finished';
              } else {
                lastError = (hostSession.json && (hostSession.json.err_msg || hostSession.json.msg || hostSession.json.message)) || hostSession.text || '';
              }
            } catch (error) {
              lastError = error && error.message ? error.message : String(error);
            }
          }

          if (!sessionId) {
            try {
              const directSession = await fetchJson('/api/v1/session');
              if (directSession.response.ok && directSession.json && (directSession.json.err_code === 0 || directSession.json.err_code === undefined)) {
                sessionPayload = directSession.json;
                sessionId = readSessionId(directSession.json);
              } else {
                lastError = (directSession.json && (directSession.json.err_msg || directSession.json.msg || directSession.json.message)) || directSession.text || '';
              }
            } catch (error) {
              lastError = error && error.message ? error.message : String(error);
            }
          }

          if (!sessionId) {
            throw new Error(
              'Shopee mobile API ยังไม่คืน live session ของบัญชีนี้' +
                (lastError ? ' (' + lastError + ')' : '')
            );
          }

          if (!sessionPayload) {
            try {
              const directDetail = await fetchJson('/api/v1/session/' + encodeURIComponent(sessionId));
              sessionPayload = directDetail.json || directDetail.text || {};
            } catch (error) {
              sessionPayload = {};
            }
          }

          const sessionData = dataOf(sessionPayload);
          const session = sessionData.session || sessionData || {};
          const deviceId =
            session.device_id ||
            session.deviceId ||
            cookieValue('LIVE_STREAMING_UUID_KEY') ||
            cookieValue('SPC_F') ||
            cookieValue('SPC_CLIENTID') ||
            cookieValue('SPC_U') ||
            String(Date.now());
          const coverPic = coverCandidate || session.cover_pic || session.coverPic || '';
          const updatePayload = {
            session: sessionId,
            title,
            cover_pic: coverPic,
            description,
            device_id: deviceId,
            subtitle: session.subtitle || ''
          };

          let updateResponse = null;
          try {
            const req = runtimeRequire();
            const nextUpdate = req && req('WzRY') && req('WzRY').u;
            const legacyApi = req && req(164) && req(164).a;
            if (typeof nextUpdate === 'function') {
              updateResponse = await timeout(nextUpdate(updatePayload), 20000, 'next runtime update session');
              assertShopeeOk(updateResponse, 'update session');
            } else if (legacyApi && typeof legacyApi.updateSessionInfo === 'function') {
              updateResponse = await timeout(legacyApi.updateSessionInfo(updatePayload), 20000, 'legacy runtime update session');
              assertShopeeOk(updateResponse, 'update session');
            }
          } catch (error) {
            lastError = error && error.message ? error.message : String(error);
            updateResponse = null;
          }
          if (!updateResponse) {
            try {
              const directUpdate = await fetchJson('/api/v1/session/' + encodeURIComponent(sessionId), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload)
              });
              if (!directUpdate.response.ok) {
                throw new Error((directUpdate.json && (directUpdate.json.err_msg || directUpdate.json.msg || directUpdate.json.message)) || directUpdate.text || 'HTTP ' + directUpdate.response.status);
              }
              assertShopeeOk(directUpdate.json, 'update session');
              updateResponse = directUpdate.json || directUpdate.text || null;
            } catch (error) {
              lastError = error && error.message ? error.message : String(error);
              updateResponse = null;
            }
          }
          if (coverPic && !updateResponse) {
            throw new Error('Shopee ไม่รับรูปภาพหน้าปก: ' + (lastError || 'อัปเดตข้อมูลห้องไม่สำเร็จ'));
          }

          let detailPayload = null;
          let pushUrlPayload = null;
          let previewPayload = null;
          try {
            const req = runtimeRequire();
            const nextDetail = req && req('WzRY') && req('WzRY').p;
            const legacyApi = req && req(164) && req(164).a;
            if (typeof nextDetail === 'function') {
              detailPayload = await timeout(nextDetail(sessionId), 12000, 'next runtime detail session');
            } else if (legacyApi && typeof legacyApi.getSessionInfoWithId === 'function') {
              detailPayload = await timeout(legacyApi.getSessionInfoWithId(sessionId), 12000, 'legacy runtime detail session');
            }
          } catch (error) {}
          const modulePushUrl =
            readRtmp(detailPayload) ||
            readPush(detailPayload) ||
            readRtmp(updateResponse) ||
            readPush(updateResponse) ||
            readRtmp(sessionPayload) ||
            readPush(sessionPayload);
          if (!modulePushUrl) {
            try {
              const directDetail = await fetchJson('/api/v1/session/' + encodeURIComponent(sessionId));
              detailPayload = directDetail.json || directDetail.text || null;
            } catch (error) {}
            try {
              const directPush = await fetchJson('/api/v1/session/' + encodeURIComponent(sessionId) + '/push_url_list');
              pushUrlPayload = directPush.json || directPush.text || null;
            } catch (error) {}
            try {
              const directPreview = await fetchJson('/api/v1/session/' + encodeURIComponent(sessionId) + '/preview?uuid=' + encodeURIComponent(deviceId) + '&ver=2');
              previewPayload = directPreview.json || directPreview.text || null;
            } catch (error) {}
          }

          const detailData = dataOf(detailPayload || sessionPayload);
          const detailSession = detailData.session || detailData || {};
          const pushUrl =
            readRtmp(pushUrlPayload) ||
            readPush(pushUrlPayload) ||
            readRtmp(previewPayload) ||
            readPush(previewPayload) ||
            [detailSession.push_url, detailSession.pushUrl, session.push_url, session.pushUrl].find(validPush) ||
            modulePushUrl ||
            readPush(updateResponse) ||
            readPush(detailPayload) ||
            readPush(sessionPayload);
          const uid = detailSession.uid || session.uid || '';
          const shareUrl = 'https://live.shopee.co.th/p/share?from=live&session=' + encodeURIComponent(sessionId);
          const path = 'ShopeeLiveStreamingPush?sessionId=' + encodeURIComponent(sessionId) +
            '&shareUrl=' + encodeURIComponent(shareUrl) +
            '&endPageUrl=' + encodeURIComponent(window.location.origin + '/p/live-end') +
            '&productSelectUrl=' + encodeURIComponent(window.location.origin + '/p/product-select?session=' + sessionId + '&from_source=streamer_add_product') +
            '&fromType=0&auctionAllow=1';

          return JSON.stringify({
            liveSessionId: sessionId,
            pushUrl,
            shareUrl: 'https://live.shopee.co.th/p/share?from=live&session=' + encodeURIComponent(sessionId),
            uid: uid ? String(uid) : '',
            mobilePush: { path },
            raw: {
              source: 'chrome-mobile-runtime',
              waitedForMobileDraft: true,
              waitMs,
              usedStoredSessionId: Boolean(existingLiveSessionId && !readSessionId(sessionPayload)),
              status: detailSession.status,
              hasPushUrl: Boolean(pushUrl),
              usedPushUrlList: Boolean(readPush(pushUrlPayload)),
              usedPreview: Boolean(!readPush(pushUrlPayload) && readPush(previewPayload)),
              hasCoverPic: Boolean(coverPic),
            }
          });
        })()
      `;

      const result = await withTimeout(
        client.send<{ result?: { value?: string }; exceptionDetails?: any }>(
          'Runtime.evaluate',
          {
            expression,
            awaitPromise: true,
            returnByValue: true,
          },
          Math.max(60_000, waitMs + 20_000),
        ),
        Math.max(30_000, waitMs + 15_000),
        'Shopee mobile runtime create session',
      );
      console.info('[shopee-runtime] create session: runtime evaluate returned');
      if (result.exceptionDetails) {
        const exceptionText =
          result.exceptionDetails?.exception?.description ||
          result.exceptionDetails?.text ||
          JSON.stringify(result.exceptionDetails);
        if (exceptionText.includes('Shopee mobile API ยังไม่คืน live session ของบัญชีนี้')) {
          throw new Error(cleanShopeeRuntimeErrorText(exceptionText));
        }
        const safeExceptionText = cleanShopeeRuntimeErrorText(exceptionText);
        throw new Error(`Shopee mobile runtime ทำงานไม่สำเร็จ: ${safeExceptionText}`);
      }

      const payload = JSON.parse(result.result?.value || '{}');
      if (!payload.liveSessionId) throw new Error('Shopee mobile runtime ไม่คืน session_id');
      const pushUrl = typeof payload.pushUrl === 'string' ? payload.pushUrl : '';
      if (!pushUrl) {
        return {
          liveSessionId: String(payload.liveSessionId),
          rtmpUrl: '',
          streamKey: '',
          coverImageUrl: coverImageUrl ?? null,
          raw: {
            source: 'chrome-mobile-runtime',
            mobilePush: payload.mobilePush,
            ...(payload.raw || {}),
          },
        };
      }

      const { rtmpUrl, streamKey } = splitShopeePushUrl(pushUrl);
      return {
        liveSessionId: String(payload.liveSessionId),
        rtmpUrl,
        streamKey,
        coverImageUrl: coverImageUrl ?? null,
        raw: payload.raw,
      };
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(error instanceof Error ? error.message : 'Shopee mobile runtime ทำงานไม่สำเร็จ', 502);
  }
}

async function readPushUrlViaShopeeRuntime(cookie: string, liveSessionId: string): Promise<string | null> {
  try {
    return await withShopeeChromeTarget(async (client) => {
      await ensureShopeeRuntime(client);
      if (process.env.SHOPEE_SYNC_COOKIES_TO_CHROME === 'true') {
        await setShopeeCookiesInChrome(client, cookie);
      }

      const expression = `
        (async () => {
          const sessionId = ${JSON.stringify(liveSessionId)};
          const inject = () => {
            if (window.__codex_require__) return true;
            const id = 'codex_push_probe_' + Date.now();
            const modules = {};
            modules[id] = function(module, exports, __webpack_require__) {
              window.__codex_require__ = __webpack_require__;
              module.exports = {};
            };
            if (window.webpackJsonp_N_E && window.webpackJsonp_N_E.push) {
              window.webpackJsonp_N_E.push([[id], modules, [[id]]]);
            }
            return Boolean(window.__codex_require__);
          };
          inject();
          const req = window.__codex_require__;
          const api = req && req('WzRY');
          if (!api || typeof api.p !== 'function') {
            throw new Error('WzRY.p ยังไม่พร้อม');
          }
          const detail = await Promise.race([
            api.p(String(sessionId)),
            new Promise((_, reject) => setTimeout(() => reject(new Error('WzRY.p timeout')), 12_000)),
          ]);
          return JSON.stringify(detail);
        })()
      `;

      const result = await withTimeout(
        client.send<{ result?: { value?: string }; exceptionDetails?: any }>(
          'Runtime.evaluate',
          {
            expression,
            awaitPromise: true,
            returnByValue: true,
          },
          20_000,
        ),
        25_000,
        'Shopee mobile runtime read push URL',
      );
      if (result.exceptionDetails) return null;

      const raw = result.result?.value || '';
      const payload = raw ? JSON.parse(raw) : null;
      return readPushUrl(payload) || extractShopeeRtmpFromPayload(payload);
    });
  } catch {
    return null;
  }
}

async function captureShopeeRtmpViaChrome(cookie: string): Promise<LiveSession | null> {
  const captureUrl = safeShopeeUrl(SHOPEE_CREATOR_LIVE_URL, 'SHOPEE_CREATOR_LIVE_URL');
  const waitMs = Math.max(5_000, Number(process.env.SHOPEE_RTMP_CAPTURE_WAIT_MS || 180_000));

  try {
    return await withShopeeChromeTarget(async (client) => {
      await setShopeeCookiesInChrome(client, cookie);
      await client.send('Network.enable').catch(() => undefined);

      return await new Promise<LiveSession | null>((resolve) => {
        let settled = false;
        let scanTimer: ReturnType<typeof setInterval> | null = null;
        let timeout: ReturnType<typeof setTimeout> | null = null;
        let lastSessionId = '';

        const finish = (session: LiveSession | null) => {
          if (settled) return;
          settled = true;
          if (scanTimer) clearInterval(scanTimer);
          if (timeout) clearTimeout(timeout);
          resolve(session);
        };

        const readFromText = (text: string, source: string) => {
          if (settled || !text) return;
          const pushUrl = extractShopeeRtmpFromPayload(text);
          const sessionId = readShopeeSessionIdFromText(text);
          if (sessionId) lastSessionId = sessionId;
          if (!pushUrl) return;

          const { rtmpUrl, streamKey } = splitShopeePushUrl(pushUrl);
          finish({
            liveSessionId: lastSessionId || stableId(`shopee-captured:${Date.now()}`, 12),
            rtmpUrl,
            streamKey,
            raw: {
              source,
              capturedUrl: captureUrl,
              hasSessionId: Boolean(lastSessionId),
            },
          });
        };

        client.onMessage((message) => {
          if (settled || message.method !== 'Network.responseReceived') return;
          const responseUrl = String(message.params?.response?.url || '');
          if (!/shopee|livetech|live/i.test(responseUrl)) return;
          void client
            .send<{ body?: string; base64Encoded?: boolean }>('Network.getResponseBody', {
              requestId: message.params.requestId,
            })
            .then((body) => {
              const text = body.base64Encoded
                ? Buffer.from(body.body || '', 'base64').toString('utf8')
                : String(body.body || '');
              readFromText(`${responseUrl}\n${text}`, 'chrome-network-capture');
            })
            .catch(() => undefined);
        });

        scanTimer = setInterval(() => {
          if (settled) return;
          void client
            .send<{ result?: { value?: string } }>('Runtime.evaluate', {
              expression: `
                (() => {
                  const values = [...document.querySelectorAll('input, textarea')]
                    .map((el) => el.value || el.placeholder || '')
                    .join('\\n');
                  return [location.href, document.title, document.body ? document.body.innerText : '', values].join('\\n');
                })()
              `,
              awaitPromise: true,
              returnByValue: true,
            })
            .then((result) => readFromText(result.result?.value || '', 'chrome-dom-capture'))
            .catch(() => undefined);
        }, 1_500);

        timeout = setTimeout(() => finish(null), waitMs);
        void client.send('Page.navigate', { url: captureUrl }).catch(() => finish(null));
      });
    });
  } catch {
    return null;
  }
}

function liveApiBases(): string[] {
  const explicitBases = (process.env.SHOPEE_LIVE_API_BASES || process.env.SHOPEE_LIVE_WEBAPI_BASE || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const bases = explicitBases.length ? explicitBases : DEFAULT_SHOPEE_LIVE_API_BASES;

  return Array.from(new Set(bases.map((base) => safeShopeeUrl(base, 'SHOPEE_LIVE_API_BASES').replace(/\/+$/, ''))));
}

function splitShopeePushUrl(pushUrl: string): Pick<LiveSession, 'rtmpUrl' | 'streamKey'> {
  if (/speedtest/i.test(pushUrl)) {
    throw new AppError('Shopee คืน RTMP speedtest ไม่ใช่ push URL ของห้อง Live จริง', 502);
  }

  try {
    const parsed = new URL(pushUrl);
    const preferredHost = parsed.searchParams.get('speHost') || parsed.searchParams.get('pushDomain');
    if (preferredHost && /^[a-z0-9.-]+(?::\d+)?$/i.test(preferredHost)) {
      const escapedHost = preferredHost.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      parsed.pathname = parsed.pathname.replace(new RegExp(`^/${escapedHost}(?=/)`, 'i'), '');
    }
    if (
      preferredHost &&
      /^[a-z0-9.-]+(?::\d+)?$/i.test(preferredHost) &&
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(parsed.hostname)
    ) {
      parsed.host = preferredHost;
      pushUrl = parsed.toString();
    }
    const marker = parsed.pathname.includes('/livestreaming/') ? '/livestreaming/' : '/live/';
    const markerIndex = pushUrl.indexOf(marker);
    if (markerIndex === -1) return { rtmpUrl: pushUrl, streamKey: '' };

    const server = pushUrl.slice(0, markerIndex + marker.length);
    const key = pushUrl.slice(markerIndex + marker.length);
    return { rtmpUrl: server, streamKey: key };
  } catch {
    return { rtmpUrl: pushUrl, streamKey: '' };
  }
}

async function liveCheckCookie(platform: string, cookie: string): Promise<CheckCookieResult> {
  // 1) identify the account (userId / userName / avatar)
  const userInfoUrl = safeShopeeUrl(SHOPEE_USER_INFO_URL, 'SHOPEE_ACCOUNT_INFO_URL');
  const resp = await fetch(userInfoUrl, { method: 'GET', headers: shopeeHeaders(cookie, userInfoUrl) });
  if (!resp.ok) {
    return { valid: false, platform, source: 'shopee', message: `Shopee ตอบกลับ ${resp.status} (คุกกี้อาจหมดอายุ)` };
  }

  const payload = (await resp.json().catch(() => null)) as any;
  const info = payload?.data ?? {};
  const codeOk = payload?.code === 0 || payload?.code === undefined;
  const userId = info?.userId != null ? String(info.userId) : null;
  const userName: string | null = info?.userName ?? null;
  const shopId = info?.shopId != null ? String(info.shopId) : null;
  const valid = Boolean(codeOk && userId);

  if (!valid) {
    return {
      valid: false,
      platform,
      source: 'shopee',
      message: payload?.msg ? String(payload.msg) : 'คุกกี้ใช้ไม่ได้ หรือหมดอายุ (ดึงข้อมูลบัญชีไม่ได้)',
    };
  }

  return {
    valid: true,
    platform,
    accountName: userName ?? `Shopee ${userId}`,
    name: userName ?? null,
    shopId,
    userId,
    platformUid: userId,
    username: userName,
    avatar: info?.avatar ?? null,
    liveAuth: null,
    source: 'shopee',
    message: 'ตรวจคุกกี้กับ Shopee สำเร็จ',
  };
}

async function liveCreateSession(
  cookie: string,
  title: string,
  coverImageUrl?: string | null,
  descriptionText?: string | null,
  existingLiveSessionId?: string | null,
  platformUid?: string | null,
  basketItems: ShopeeBasketItem[] = [],
): Promise<LiveSession> {
  const resolvedBasketItems = await resolveShopeeShortBasketLinks(basketItems);
  let runtimeError: unknown = null;
  const runtimeSession = await createSessionViaProbeStyleRuntime(
    cookie,
    title,
    coverImageUrl,
    descriptionText,
    resolvedBasketItems,
    existingLiveSessionId,
  ).catch((error) => {
    runtimeError = error;
    return null;
  });
  if (runtimeSession?.rtmpUrl) return runtimeSession;
  if (!runtimeSession && resolvedBasketItems.length > 0 && runtimeError) {
    throw runtimeError instanceof AppError
      ? runtimeError
      : new AppError(runtimeError instanceof Error ? runtimeError.message : 'เพิ่มสินค้าเข้าตะกร้า Shopee Live ไม่สำเร็จ', 502);
  }
  if (runtimeSession?.liveSessionId) {
    const recoveredPushUrl = await readPushUrlViaShopeeRuntime(cookie, runtimeSession.liveSessionId);
    if (recoveredPushUrl) {
      const { rtmpUrl, streamKey } = splitShopeePushUrl(recoveredPushUrl);
      return {
        liveSessionId: runtimeSession.liveSessionId,
        rtmpUrl,
        streamKey,
        coverImageUrl: runtimeSession.coverImageUrl ?? null,
        raw: {
          source: 'chrome-mobile-runtime-push-recovery',
          recoveredAfterCreate: true,
          ...(runtimeSession.raw && typeof runtimeSession.raw === 'object' ? runtimeSession.raw : {}),
        },
      };
    }

    throw new AppError(
      'สร้างห้อง Shopee Live มือถือสำเร็จแล้ว แต่ยังดึง RTMP จาก /push_url_list ไม่ได้',
      502,
      {
        liveSessionId: runtimeSession.liveSessionId,
        raw: runtimeSession.raw,
      },
    );
  }

  const capturedSession = await captureShopeeRtmpViaChrome(cookie);
  if (capturedSession?.rtmpUrl) return capturedSession;

  const runtimeMessage = runtimeError instanceof Error ? runtimeError.message : '';
  throw new AppError(
    runtimeMessage ||
      'ยังไม่พบ Shopee Live session ของบัญชีนี้จาก mobile API และยังจับ RTMP จากหน้า Shopee Live ไม่ได้',
    502,
  );
}

async function liveSyncSessionInfo(
  cookie: string,
  liveSessionId: string,
  title: string,
  coverImageUrl?: string | null,
  descriptionText?: string | null,
  basketItems: ShopeeBasketItem[] = [],
): Promise<ShopeeLiveSyncResult> {
  const sessionId = parseShopeeLiveSessionId(liveSessionId);
  if (!sessionId) throw new AppError('ไม่มี Session ID สำหรับอัปเดต Shopee Live ที่กำลังไลฟ์', 400);
  const resolvedBasketItems = await resolveShopeeShortBasketLinks(basketItems);

  const session = await withShopeeChromeTarget(async (client) => {
    await setShopeeCookiesInChrome(client, cookie);
    await client.send('Page.navigate', { url: SHOPEE_MOBILE_API_REFERER }, 5_000).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    await client.send('Page.stopLoading', {}, 3_000).catch(() => undefined);
    return createSessionViaPageContextFetch(client, cookie, title, coverImageUrl, descriptionText, resolvedBasketItems, sessionId);
  });

  return {
    sessionId: session.liveSessionId,
    synced: true,
    basketCount: resolvedBasketItems.length,
    hasCover: Boolean(coverImageUrl),
    title: title.trim().slice(0, 200),
    description: (descriptionText || title).trim().slice(0, 200),
    raw: session.raw,
  };
}

async function liveSyncSessionMetadata(
  cookie: string,
  liveSessionId: string,
  changes: { title?: string | null; description?: string | null; coverImageUrl?: string | null },
): Promise<ShopeeLiveMetadataSyncResult> {
  const sessionId = parseShopeeLiveSessionId(liveSessionId);
  if (!sessionId) throw new AppError('ไม่มี Session ID สำหรับอัปเดตข้อมูลห้อง Shopee Live', 400);

  return withShopeeChromeTarget(async (client) => {
    await setShopeeCookiesInChrome(client, cookie);
    await client.send('Page.navigate', { url: SHOPEE_MOBILE_API_REFERER }, 5_000).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    await client.send('Page.stopLoading', {}, 3_000).catch(() => undefined);

    const storedPayload = (await shopeePageContextFetch(
      client,
      `/api/v1/session/${encodeURIComponent(sessionId)}`,
      { timeoutMs: 10_000 },
    )).json;
    assertShopeePageOk(storedPayload, 'load live session');
    if (readShopeeSessionStatus(storedPayload) === 2) throw new AppError('Shopee Live session นี้จบแล้ว', 400);

    const sessionData = dataOf(unwrapShopeeTuple(storedPayload));
    const session = sessionData?.session || sessionData || {};
    const currentTitle = String(session.title || session.name || '').trim();
    const nextTitle =
      changes.title !== undefined
        ? String(changes.title || currentTitle || 'รีรันไลฟ์').trim().slice(0, 200)
        : (currentTitle || 'รีรันไลฟ์').slice(0, 200);
    const currentDescription = String(session.description || session.desc || currentTitle || '').trim();
    const nextDescription =
      changes.description !== undefined
        ? String(changes.description || nextTitle).trim().slice(0, 200)
        : (currentDescription || nextTitle).slice(0, 200);
    const coverPic =
      changes.coverImageUrl !== undefined
        ? await resolveCoverPayloadForShopee(cookie, changes.coverImageUrl)
        : session.cover_pic || session.coverPic || '';

    const updatePayload = {
      session: sessionId,
      title: nextTitle,
      cover_pic: coverPic,
      description: nextDescription,
      device_id: session.device_id || session.deviceId || readDeviceId(cookie, storedPayload),
      subtitle: session.subtitle || '',
    };

    let updateResponse: any = null;
    let skippedBecauseLive = false;
    try {
      updateResponse = (await shopeePageContextFetch(client, `/api/v1/session/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: updatePayload,
        timeoutMs: 12_000,
      })).json;
      assertShopeePageOk(updateResponse, 'update live session metadata');
    } catch (error) {
      if (!isShopeeStreamSessionLivingError(error)) throw error;
      skippedBecauseLive = true;
      updateResponse = {
        skipped: true,
        reason: 'Shopee Live session is already living; metadata update is deferred.',
      };
    }

    return {
      sessionId,
      synced: !skippedBecauseLive,
      changed: {
        title: changes.title !== undefined,
        description: changes.description !== undefined,
        cover: changes.coverImageUrl !== undefined,
      },
      raw: updateResponse,
    };
  });
}

async function liveSyncBasketItems(
  cookie: string,
  liveSessionId: string,
  basketItems: ShopeeBasketItem[],
): Promise<ShopeeBasketSyncResult> {
  const sessionId = parseShopeeLiveSessionId(liveSessionId);
  if (!sessionId) throw new AppError('ไม่มี Session ID สำหรับอัปเดตตะกร้า Shopee Live', 400);

  if (!config.shopeeLiveMode) {
    return { sessionId, synced: true, basketCount: basketItems.length, raw: { source: 'mock-basket-sync' } };
  }

  const resolvedBasketItems = await resolveShopeeShortBasketLinks(basketItems);
  const status = await withShopeeChromeTarget(async (client) => {
    await setShopeeCookiesInChrome(client, cookie);
    return updateShopeeBasketItemsViaPageContext(client, sessionId, resolvedBasketItems, { mode: 'replace' });
  });

  if (!status.succeeded) {
    throw new AppError(status.warning || status.error || 'อัปเดตตะกร้า Shopee Live ไม่สำเร็จ', 502, status);
  }

  return {
    sessionId,
    synced: true,
    basketCount: resolvedBasketItems.length,
    raw: status,
  };
}

async function startSessionViaShopeeRuntime(cookie: string, liveSessionId: string): Promise<ShopeeStartSessionResult> {
  return withShopeeChromeTarget(async (client) => {
    await setShopeeCookiesInChrome(client, cookie);
    await client.send('Page.navigate', { url: SHOPEE_MOBILE_API_REFERER }, 5_000).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    await client.send('Page.stopLoading', {}, 3_000).catch(() => undefined);

    const expression = `
      (async () => {
        const sessionId = ${JSON.stringify(liveSessionId)};
        const cookieValue = (name) => {
          const prefix = name + '=';
          const found = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
          return found ? decodeURIComponent(found.slice(prefix.length)) : '';
        };
        let deviceId = cookieValue('LIVE_STREAMING_UUID_KEY') || cookieValue('SPC_F') || cookieValue('SPC_CLIENTID') || cookieValue('SPC_U') || 'codex-mobile-runtime';
        const fetchJson = async (path, options = {}) => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10000);
          try {
            const response = await fetch('https://live.shopee.co.th' + path, {
              credentials: 'include',
              ...options,
              headers: {
                accept: 'application/json, text/plain, */*',
                'Client-Info': [
                  'device_model=iPhone%2011',
                  'client_version=33450',
                  'language=th',
                  'os=1',
                  'os_version=18.0',
                  'network=1',
                  'platform=2',
                  'cpu_model=ARM64E'
                ].join(';'),
                ...(options.headers || {}),
              },
              signal: controller.signal,
            });
            const text = await response.text();
            let json = null;
            try { json = JSON.parse(text); } catch {}
            return { ok: response.ok, status: response.status, text, json };
          } finally {
            clearTimeout(timer);
          }
        };
        const unwrap = (payload) => Array.isArray(payload) ? (payload[1] || payload[0]) : payload;
        const beforeDetailResp = await fetchJson('/api/v1/session/' + encodeURIComponent(sessionId));
        const beforeDetail = unwrap(beforeDetailResp.json || {});
        const beforeData = (beforeDetail && beforeDetail.data) || beforeDetail || {};
        const beforeSession = beforeData.session || beforeData || {};
        deviceId = String(beforeSession.device_id || beforeSession.deviceId || deviceId);
        if (Number(beforeSession.status) === 1) {
          return {
            status: beforeSession.status,
            isLive: true,
            alreadyLive: true,
            publishAccepted: true,
            publishConfirmed: true,
            raw: beforeDetailResp.json || beforeDetailResp.text
          };
        }
        const liveResp = await fetchJson('/api/v1/session/' + encodeURIComponent(sessionId) + '/live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        if (!liveResp.ok || (liveResp.json && liveResp.json.err_code && liveResp.json.err_code !== 0)) {
            const message = (liveResp.json && (liveResp.json.err_msg || liveResp.json.msg || liveResp.json.message)) || liveResp.text || '';
            throw new Error('Shopee mobile publish API ไม่สำเร็จ' + (message ? ': ' + message : ''));
        }
        let session = {};
        for (let i = 0; i < 20; i += 1) {
          const detailResp = await fetchJson('/api/v1/session/' + encodeURIComponent(sessionId));
          const detail = unwrap(detailResp.json || {});
          session = (detail && detail.data && detail.data.session) || (detail && detail.session) || detail || {};
          if (Number(session.status) === 1) break;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        return {
          status: session.status,
          isLive: Number(session.status) === 1,
          publishAccepted: true,
          publishConfirmed: Number(session.status) === 1,
          raw: liveResp.json || liveResp.text
        };
      })()
    `;
    const result = await withTimeout(
      client.send<{ result?: { value?: { status?: unknown; isLive?: boolean; alreadyLive?: boolean } }; exceptionDetails?: any }>(
        'Runtime.evaluate',
        {
          expression,
          awaitPromise: true,
          returnByValue: true,
        },
        45_000,
      ),
      30_000,
      'Shopee mobile runtime publish session',
    );
    if (result.exceptionDetails || !result.result?.value?.isLive) {
      const detail =
        result.exceptionDetails?.exception?.description ||
        result.exceptionDetails?.text ||
        JSON.stringify(result.result?.value || {});
      throw new Error(`Shopee runtime เริ่ม session ไม่สำเร็จ${detail ? `: ${detail}` : ''}`);
    }
    return {
      sessionId: liveSessionId,
      isLive: true,
      alreadyLive: Boolean(result.result.value.alreadyLive),
    };
  });
}

async function liveStartSession(cookie: string, liveSessionId: string): Promise<ShopeeStartSessionResult> {
  if (process.env.SHOPEE_USE_PUBLISH_ENDPOINT === 'false') {
    return { sessionId: liveSessionId, isLive: true, alreadyLive: false };
  }

  try {
    return await startSessionViaShopeeRuntime(cookie, liveSessionId);
  } catch (error) {
    if (isShopeeStreamSessionLivingError(error)) {
      return { sessionId: liveSessionId, isLive: true, alreadyLive: true };
    }
    throw new AppError(
      `เริ่ม Shopee Live ไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`,
      502,
    );
  }
}

async function endSessionViaShopeeRuntime(cookie: string, liveSessionId: string): Promise<void> {
  await withShopeeChromeTarget(async (client) => {
    await setShopeeCookiesInChrome(client, cookie);
    await client.send('Page.navigate', { url: SHOPEE_MOBILE_API_REFERER }, 5_000).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    await client.send('Page.stopLoading', {}, 3_000).catch(() => undefined);

    const expression = `
      (async () => {
        const sessionId = ${JSON.stringify(liveSessionId)};
        const timeout = (promise, ms, label) => Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' timeout')), ms)),
        ]);
        const unwrap = (payload) => Array.isArray(payload) ? (payload[1] || payload[0]) : payload;
        const dataOf = (payload) => {
          const unwrapped = unwrap(payload);
          return (unwrapped && unwrapped.data) || unwrapped || {};
        };
        const readStatus = (payload) => {
          const data = dataOf(payload);
          const session = data.session || data;
          const value = session.status ?? data.status;
          const numeric = Number(value);
          return Number.isFinite(numeric) ? numeric : null;
        };
        const fetchJson = async (path, options = {}) => {
          const response = await timeout(fetch('https://live.shopee.co.th' + path, {
            credentials: 'include',
            ...options,
            headers: {
              accept: 'application/json, text/plain, */*',
              ...(options.headers || {}),
            },
          }), 10_000, path);
          const text = await response.text();
          let json = null;
          try { json = JSON.parse(text); } catch {}
          if (!response.ok) {
            const message = (json && (json.err_msg || json.msg || json.message || json.error)) || text.slice(0, 300);
            throw new Error(path + ' HTTP ' + response.status + (message ? ': ' + message : ''));
          }
          if (json && json.err_code && json.err_code !== 0) {
            const message = json.err_msg || json.msg || json.message || '';
            throw new Error(path + ' Shopee err_code ' + json.err_code + (message ? ': ' + message : ''));
          }
          return json || text;
        };

        let endPayload = null;
        try {
          endPayload = await fetchJson('/api/v1/session/' + encodeURIComponent(sessionId) + '/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          });
        } catch (error) {
          const message = error && error.message ? error.message : String(error);
          if (/ErrorStreamSessionIsEnd|StreamSessionIsEnd|session is end/i.test(message)) {
            return { ended: true, finalStatus: 2, alreadyEnded: true };
          }
          if (/ErrorStreamSessionIsInit|StreamSessionIsInit|session is init/i.test(message)) {
            return { ended: true, finalStatus: 0, notPublished: true };
          }
          throw error;
        }

        let finalStatus = null;
        for (let i = 0; i < 8; i += 1) {
          const detailPayload = await fetchJson('/api/v1/session/' + encodeURIComponent(sessionId));
          finalStatus = readStatus(detailPayload);
          if (finalStatus === 2 || finalStatus === 3 || finalStatus === 4) break;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        return {
          ended: finalStatus === 2 || finalStatus === 3 || finalStatus === 4,
          finalStatus,
          rawStatus: readStatus(endPayload),
        };
      })()
    `;
    const result = await withTimeout(
      client.send<{ result?: { value?: { ended?: boolean; finalStatus?: unknown } }; exceptionDetails?: any }>(
        'Runtime.evaluate',
        {
          expression,
          awaitPromise: true,
          returnByValue: true,
        },
        45_000,
      ),
      40_000,
      'Shopee mobile runtime end session',
    );
    if (result.exceptionDetails || !result.result?.value?.ended) {
      const detail =
        result.exceptionDetails?.exception?.description ||
        result.exceptionDetails?.text ||
        JSON.stringify(result.result?.value || {});
      throw new Error(`Shopee runtime จบ session ไม่สำเร็จ${detail ? `: ${detail}` : ''}`);
    }
  });
}

function zeroLiveStats(sessionId: string | null, isLive = false, source = 'empty'): ShopeeLiveStats {
  return {
    sessionId,
    isLive,
    status: isLive ? 'LIVE' : 'NOTLIVE',
    liveSeconds: 0,
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
    source,
  };
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[฿,\s]/g, '');
    if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(cleaned)) {
      const parts = cleaned.split(':').map((item) => Number(item));
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    const numeric = Number(cleaned);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function normalizedStatKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function readStatNumber(payloads: unknown[], names: string[]): number {
  const wanted = new Set(names.map(normalizedStatKey));
  const seen = new Set<unknown>();
  const stack: Array<{ value: unknown; key: string }> = payloads.map((value) => ({ value, key: '' }));

  while (stack.length) {
    const { value, key } = stack.pop()!;
    if (key && wanted.has(normalizedStatKey(key))) {
      const numeric = toFiniteNumber(value);
      if (numeric !== null) return Math.max(0, numeric);
    }
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    for (const [childKey, childValue] of Object.entries(value)) {
      stack.push({ value: childValue, key: childKey });
    }
  }

  return 0;
}

function readStatStatus(payloads: unknown[]): { isLive: boolean; status: string } {
  const raw = readStatNumber(payloads, ['status', 'session_status', 'live_status', 'stream_status']);
  if (raw === 1) return { isLive: true, status: 'LIVE' };
  if (raw === 2 || raw === 3 || raw === 4) return { isLive: false, status: 'ENDED' };

  const serialized = JSON.stringify(payloads).toLowerCase();
  if (serialized.includes('"status":"live"') || serialized.includes('"live_status":"live"')) {
    return { isLive: true, status: 'LIVE' };
  }
  return { isLive: false, status: 'NOTLIVE' };
}

function statsFromShopeePayloads(sessionId: string, payloads: unknown[], source = 'shopee-runtime'): ShopeeLiveStats {
  const status = readStatStatus(payloads);
  const totalSales = readStatNumber(payloads, [
    'total_sales',
    'totalSales',
    'sales',
    'sales_amount',
    'salesAmount',
    'revenue',
    'total_revenue',
    'totalRevenue',
    'placed_sales',
    'placedSales',
    'gmv',
  ]);
  const liveSeconds = readStatNumber(payloads, [
    'duration',
    'duration_sec',
    'durationSec',
    'live_seconds',
    'liveSeconds',
    'live_duration',
    'liveDuration',
    'elapsed_seconds',
    'elapsedSeconds',
    'stream_duration',
    'streamDuration',
  ]);
  const currentViewers = readStatNumber(payloads, [
    'current_viewers',
    'currentViewers',
    'current_viewer_count',
    'currentViewerCount',
    'viewer_count',
    'viewerCount',
    'viewer_cnt',
    'viewerCnt',
    'current_viewer_cnt',
    'currentViewerCnt',
    'online_user_count',
    'onlineUserCount',
    'online_user_cnt',
    'onlineUserCnt',
    'watching_count',
    'watchingCount',
    'watching_cnt',
    'watchingCnt',
    'current_ccu',
    'currentCcu',
    'current_uv',
    'currentUv',
    'engaged_viewers',
    'engagedViewers',
    'uv',
    'ccu',
  ]);
  const peakViewers = readStatNumber(payloads, [
    'peak_viewers',
    'peakViewers',
    'peak_viewer_cnt',
    'peakViewerCnt',
    'max_viewer_count',
    'maxViewerCount',
    'max_viewer_cnt',
    'maxViewerCnt',
    'peak_ccu',
    'peakCcu',
    'max_ccu',
    'maxCcu',
  ]);
  const views = readStatNumber(payloads, [
    'views',
    'view_count',
    'viewCount',
    'view_cnt',
    'viewCnt',
    'watch_count',
    'watchCount',
    'watch_cnt',
    'watchCnt',
    'watcher_count',
    'watcherCount',
    'watcher_cnt',
    'watcherCnt',
    'pv',
  ]);
  const reportedSalesPerHour = readStatNumber(payloads, [
    'sales_per_hour',
    'salesPerHour',
    'sales_per_hr',
    'salesPerHr',
    'revenue_per_hour',
    'revenuePerHour',
    'revenue_per_hr',
    'revenuePerHr',
    'gmv_per_hour',
    'gmvPerHour',
    'gmv_per_hr',
    'gmvPerHr',
    'avg_hourly_sales',
    'avgHourlySales',
    'hourly_sales',
    'hourlySales',
  ]);
  const computedSalesPerHour = totalSales > 0 && liveSeconds > 0 ? totalSales / (liveSeconds / 3600) : 0;

  return {
    ...zeroLiveStats(sessionId, status.isLive, source),
    ...status,
    liveSeconds,
    totalSales,
    salesPerHour: reportedSalesPerHour || computedSalesPerHour,
    viewers: currentViewers || views,
    orders: readStatNumber(payloads, ['orders', 'order_count', 'orderCount', 'order_cnt', 'orderCnt', 'paid_order_count', 'paidOrderCount', 'paid_order_cnt', 'paidOrderCnt', 'placed_orders', 'placedOrders']),
    productsSold: readStatNumber(payloads, ['products_sold', 'productsSold', 'item_sold_count', 'itemSoldCount', 'item_sold_cnt', 'itemSoldCnt', 'sold_count', 'soldCount', 'sold_cnt', 'soldCnt']),
    buyers: readStatNumber(payloads, ['buyers', 'buyer_count', 'buyerCount', 'buyer_cnt', 'buyerCnt']),
    addedToCart: readStatNumber(payloads, ['added_to_cart', 'addedToCart', 'add_to_cart_count', 'addToCartCount', 'add_to_cart_cnt', 'addToCartCnt', 'cart_count', 'cartCount', 'cart_cnt', 'cartCnt', 'atc']),
    currentViewers,
    peakViewers,
    views,
    averageWatchSeconds: (() => {
      const rawAverage = readStatNumber(payloads, [
        'average_watch_seconds',
        'averageWatchSeconds',
        'avg_watch_seconds',
        'avgWatchSeconds',
        'avg_watch_duration',
        'avgWatchDuration',
        'average_view_time',
        'averageViewTime',
        'avg_view_time',
        'avgViewTime',
        'avg_watch_time_mills',
        'avgWatchTimeMills',
        'average_watch_mills',
        'averageWatchMills',
      ]);
      return rawAverage > 10_000 ? Math.floor(rawAverage / 1000) : rawAverage;
    })(),
    likes: readStatNumber(payloads, ['likes', 'like_count', 'likeCount', 'like_cnt', 'likeCnt']),
    comments: readStatNumber(payloads, ['comments', 'comment_count', 'commentCount', 'comment_cnt', 'commentCnt']),
    shares: readStatNumber(payloads, ['shares', 'share_count', 'shareCount', 'share_cnt', 'shareCnt']),
    newFollowers: readStatNumber(payloads, ['new_followers', 'newFollowers', 'new_follower_count', 'newFollowerCount', 'new_follower_cnt', 'newFollowerCnt', 'follow_count', 'followCount', 'follow_cnt', 'followCnt']),
    updatedAt: new Date().toISOString(),
  };
}

function hasUsefulStats(stats: ShopeeLiveStats): boolean {
  return [
    stats.liveSeconds,
    stats.totalSales,
    stats.salesPerHour,
    stats.viewers,
    stats.orders,
    stats.productsSold,
    stats.buyers,
    stats.addedToCart,
    stats.currentViewers,
    stats.peakViewers,
    stats.views,
    stats.averageWatchSeconds,
    stats.likes,
    stats.comments,
    stats.shares,
    stats.newFollowers,
  ].some((value) => Number(value) > 0);
}

async function shopeeStatsDirectFetch(cookie: string, liveSessionId: string, path: string): Promise<unknown | null> {
  const url = safeShopeeUrl(`https://live.shopee.co.th${path}`, 'Shopee stats URL');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: liveShopeeHeaders(cookie, {
        accept: 'application/json, text/plain, */*',
        referer: `https://live.shopee.co.th/share?from=live&session=${encodeURIComponent(liveSessionId)}&in=1`,
      }),
      signal: controller.signal,
    });
    const text = await response.text().catch(() => '');
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      return null;
    }
    if (!response.ok || !json) return null;
    const errCode = json.err_code ?? json.error ?? json.code;
    if (errCode !== undefined && Number(errCode) !== 0) return null;
    return { path, json };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function liveSessionStatsViaDirectFetch(cookie: string, liveSessionId: string): Promise<ShopeeLiveStats | null> {
  const deviceId = readCookieDeviceId(parseCookie(cookie), cookie);
  const encodedSessionId = encodeURIComponent(liveSessionId);
  const encodedDeviceId = encodeURIComponent(deviceId);
  const paths = [
    `/api/v1/session/${encodedSessionId}`,
    `/api/v1/session/${encodedSessionId}/dashboard`,
    `/api/v1/session/${encodedSessionId}/stats`,
    `/api/v1/session/${encodedSessionId}/statistics`,
    `/api/v1/session/${encodedSessionId}/statistics/realtime`,
    `/api/v1/session/${encodedSessionId}/overview`,
    `/api/v1/session/${encodedSessionId}/summary`,
    `/api/v1/session/${encodedSessionId}/insight`,
    `/api/v1/session/${encodedSessionId}/performance`,
    `/api/v1/session/${encodedSessionId}/metrics`,
    `/api/v1/session/${encodedSessionId}/preview?uuid=${encodedDeviceId}&ver=2`,
    `/webapi/v1/session/${encodedSessionId}`,
    `/webapi/v1/session/${encodedSessionId}/dashboard`,
    `/webapi/v1/session/${encodedSessionId}/stats`,
    `/webapi/v1/session/${encodedSessionId}/statistics`,
    `/webapi/v1/session/${encodedSessionId}/statistics/realtime`,
    `/webapi/v1/session/${encodedSessionId}/overview`,
    `/webapi/v1/session/${encodedSessionId}/summary`,
    `/webapi/v1/session/${encodedSessionId}/insight`,
    `/webapi/v1/session/${encodedSessionId}/performance`,
    `/webapi/v1/session/${encodedSessionId}/metrics`,
  ];

  const results = await Promise.all(paths.map((path) => shopeeStatsDirectFetch(cookie, liveSessionId, path)));
  const payloads = results.filter((payload): payload is unknown => Boolean(payload));
  if (!payloads.length) return null;

  const stats = statsFromShopeePayloads(liveSessionId, payloads, 'shopee-direct');
  return hasUsefulStats(stats) || stats.isLive ? stats : null;
}

async function liveSessionStatsViaShopeeRuntime(cookie: string, liveSessionId: string): Promise<ShopeeLiveStats> {
  const payloads = await withShopeeChromeTarget(async (client) => {
    await setShopeeCookiesInChrome(client, cookie);
    await client.send('Page.navigate', { url: SHOPEE_MOBILE_API_REFERER }, 5_000).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await client.send('Page.stopLoading', {}, 3_000).catch(() => undefined);

    const expression = `
      (async () => {
        const sessionId = ${JSON.stringify(liveSessionId)};
        const paths = [
          '/api/v1/session/' + encodeURIComponent(sessionId),
          '/api/v1/session/' + encodeURIComponent(sessionId) + '/dashboard',
          '/api/v1/session/' + encodeURIComponent(sessionId) + '/stats',
          '/api/v1/session/' + encodeURIComponent(sessionId) + '/statistics',
          '/api/v1/session/' + encodeURIComponent(sessionId) + '/overview',
          '/api/v1/session/' + encodeURIComponent(sessionId) + '/summary',
          '/api/v1/session/' + encodeURIComponent(sessionId) + '/insight',
          '/webapi/v1/session/' + encodeURIComponent(sessionId),
          '/webapi/v1/session/' + encodeURIComponent(sessionId) + '/dashboard',
          '/webapi/v1/session/' + encodeURIComponent(sessionId) + '/stats',
          '/webapi/v1/session/' + encodeURIComponent(sessionId) + '/statistics'
        ];
        const fetchJson = async (path) => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          try {
            const response = await fetch('https://live.shopee.co.th' + path, {
              credentials: 'include',
              headers: {
                accept: 'application/json, text/plain, */*',
                'Client-Info': [
                  'device_model=iPhone%2011',
                  'client_version=33450',
                  'language=th',
                  'os=1',
                  'os_version=18.0',
                  'network=1',
                  'platform=2',
                  'cpu_model=ARM64E'
                ].join(';')
              },
              signal: controller.signal
            });
            const text = await response.text();
            let json = null;
            try { json = JSON.parse(text); } catch {}
            return { path, ok: response.ok, status: response.status, json, text: json ? undefined : text.slice(0, 500) };
          } finally {
            clearTimeout(timer);
          }
        };
        const responses = [];
        for (const path of paths) {
          try {
            const result = await fetchJson(path);
            if (result.ok && result.json) responses.push(result);
          } catch (error) {
            responses.push({ path, ok: false, status: 0, text: error && error.message ? error.message : String(error) });
          }
        }
        return responses;
      })()
    `;

    const result = await withTimeout(
      client.send<{ result?: { value?: unknown[] }; exceptionDetails?: any }>(
        'Runtime.evaluate',
        {
          expression,
          awaitPromise: true,
          returnByValue: true,
        },
        45_000,
      ),
      40_000,
      'Shopee realtime stats',
    );

    if (result.exceptionDetails) {
      const detail =
        result.exceptionDetails?.exception?.description ||
        result.exceptionDetails?.text ||
        'Shopee runtime อ่านสถิติไม่สำเร็จ';
      throw new Error(detail);
    }

    return Array.isArray(result.result?.value) ? result.result.value : [];
  });

  if (!payloads.length) return zeroLiveStats(liveSessionId, false, 'shopee-runtime-empty');
  return statsFromShopeePayloads(liveSessionId, payloads, 'shopee-runtime');
}


// Creator Center realtime dashboard: the only Shopee endpoint that reliably reports
// GMV / orders / viewers for a live session. Authenticated by the channel cookie only.
const SHOPEE_CREATOR_OVERVIEW_URL =
  process.env.SHOPEE_CREATOR_OVERVIEW_URL || 'https://creator.shopee.co.th/supply/api/lm/sellercenter/realtime/dashboard/overview';

async function liveSessionStatsViaCreatorOverview(cookie: string, liveSessionId: string): Promise<ShopeeLiveStats | null> {
  const base = safeShopeeUrl(SHOPEE_CREATOR_OVERVIEW_URL, 'SHOPEE_CREATOR_OVERVIEW_URL');
  const url = `${base}?sessionId=${encodeURIComponent(liveSessionId)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        ...shopeeHeaders(cookie, url),
        referer: `https://creator.shopee.co.th/dashboard/live/${encodeURIComponent(liveSessionId)}`,
        'x-env': 'live',
        'x-region': 'th',
        'x-region-domain': 'co.th',
        'x-region-timezone': '+0700',
      },
      signal: controller.signal,
    });
    if (!resp.ok) return null;
    const payload = (await resp.json().catch(() => null)) as any;
    if (!payload || Number(payload.code ?? 0) !== 0 || !payload.data || typeof payload.data !== 'object') return null;
    const d = payload.data;
    const n = (value: unknown) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    };
    const engagement = d.engagementData || {};
    const isLive = Number(d.status) === 1;
    const avgView = n(d.avgViewTime ?? engagement.avgViewingDuration);
    return {
      ...zeroLiveStats(liveSessionId, isLive, 'shopee-creator-overview'),
      isLive,
      status: isLive ? 'LIVE' : 'NOTLIVE',
      totalSales: n(d.placedGmv),
      salesPerHour: 0, // derived from liveSeconds by the route (placedGmv / hours live)
      viewers: n(d.viewers),
      orders: n(d.placedOrder),
      productsSold: n(d.placedItemsSold),
      buyers: n(d.buyers),
      addedToCart: n(d.atc),
      currentViewers: n(d.ccu),
      peakViewers: n(d.pcu),
      views: n(d.views ?? engagement.views),
      averageWatchSeconds: avgView > 10_000 ? Math.floor(avgView / 1000) : Math.floor(avgView),
      likes: n(engagement.likes),
      comments: n(engagement.comments),
      shares: n(engagement.shares),
      newFollowers: n(engagement.newFollowers),
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function liveSessionStats(cookie: string, liveSessionId: string): Promise<ShopeeLiveStats> {
  if (!config.shopeeLiveMode) return zeroLiveStats(liveSessionId, true, 'mock');
  const creatorStats = await liveSessionStatsViaCreatorOverview(cookie, liveSessionId);
  if (creatorStats) return creatorStats;
  const directStats = await liveSessionStatsViaDirectFetch(cookie, liveSessionId);
  if (directStats) return directStats;
  if (process.env.SHOPEE_STATS_USE_CHROME !== 'true') {
    return zeroLiveStats(liveSessionId, true, 'shopee-direct-empty');
  }
  try {
    return await liveSessionStatsViaShopeeRuntime(cookie, liveSessionId);
  } catch (error) {
    throw new AppError(
      `อ่านสถิติ Shopee Live ไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`,
      502,
    );
  }
}

// ---------------------------------------------------------------------------
// Public adapter surface
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Product detail lookup (name / image / price / stock / rating) for basket links.
// Uses the same live.shopee.co.th mobile runtime as session creation, because the
// public shopee.co.th PDP endpoint is protected by anti-bot headers we cannot forge.
// ---------------------------------------------------------------------------

export type ShopeeProductDetail = {
  shopId: number;
  itemId: number;
  url: string;
  name: string | null;
  image: string | null;
  imageUrl: string | null;
  videoId: string | null;
  videoUrl: string | null;
  videoThumbnailUrl: string | null;
  videoDurationSec: number | null;
  price: number | null;
  priceMin: number | null;
  priceMax: number | null;
  priceBeforeDiscount: number | null;
  stock: number | null;
  sold: number | null;
  rating: number | null;
  ratingCount: number | null;
  discount: number | null;
  commissionRate: number | null;
  modelOptions: unknown;
  tierVariations: unknown;
  variationOptions: unknown;
  isOutOfStock: boolean;
  error: string | null;
  raw?: Record<string, unknown> | null;
};

export type ShopeeProductDetailsResult = {
  sessionId: string | null;
  items: ShopeeProductDetail[];
};

function shopeeImageUrl(id: unknown): string | null {
  const text = String(id ?? '').trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  return `https://down-th.img.susercontent.com/file/${text}`;
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function normalizeShopeeVideoUrl(value: unknown): string | null {
  const text = pickString(value);
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith('//')) return `https:${text}`;
  return null;
}

function findShopeeProductVideo(detail: Record<string, any>) {
  const videoInfo =
    detail.video_info ??
    detail.videoInfo ??
    detail.video ??
    detail.item_video ??
    detail.itemVideo ??
    (Array.isArray(detail.videos) ? detail.videos[0] : null) ??
    (Array.isArray(detail.video_list) ? detail.video_list[0] : null) ??
    {};

  const videoId = pickString(
    videoInfo.video_id,
    videoInfo.videoId,
    videoInfo.id,
    detail.video_id,
    detail.videoId,
  );
  const videoUrl = normalizeShopeeVideoUrl(
    videoInfo.video_url ??
      videoInfo.videoUrl ??
      videoInfo.play_url ??
      videoInfo.playUrl ??
      videoInfo.url ??
      videoInfo.src ??
      detail.video_url ??
      detail.videoUrl ??
      detail.play_url,
  );
  const thumbnail = videoInfo.thumbnail ?? videoInfo.thumbnail_url ?? videoInfo.cover ?? videoInfo.cover_url ?? detail.video_thumbnail;
  const duration = pickNumber(videoInfo.duration, videoInfo.duration_sec, videoInfo.durationSec, detail.video_duration);

  return {
    videoId,
    videoUrl,
    videoThumbnailUrl: shopeeImageUrl(thumbnail),
    videoDurationSec: duration === null ? null : Math.round(duration > 10_000 ? duration / 1000 : duration),
  };
}

/** Shopee returns money as integer × 100000. Values that large are converted to baht. */
function normalizeShopeeMoney(value: number | null): number | null {
  if (value === null) return null;
  return value >= 100000 ? Math.round(value) / 100000 : value;
}

function hasShopeeOptionData(detail: Record<string, any> | null): boolean {
  if (!detail) return false;
  const options =
    detail.models ??
    detail.modelOptions ??
    detail.item_models ??
    detail.itemModels ??
    detail.options ??
    detail.tier_variation_display_indicators ??
    detail.tierVariationDisplayIndicators ??
    detail.variationOptions ??
    detail.tier_variations ??
    detail.tierVariations ??
    detail.tier_variation ??
    detail.variations;
  return Array.isArray(options) ? options.length > 0 : Boolean(options);
}

/** Shopee Live sends comm_rate scaled by 1000 (10000 = 10%, 5000 = 5%). Fractions (0.05) and plain percents (5) are also accepted. */
function normalizeCommissionRate(value: number | null): number | null {
  if (value === null) return null;
  if (value <= 1) return value * 100;
  if (value > 100) return value / 1000;
  return value;
}

function normalizeProductDetail(
  item: ShopeeBasketItem,
  url: string,
  detail: Record<string, any> | null,
  error: string | null,
): ShopeeProductDetail {
  const d = detail || {};
  const rating = d.item_rating || d.rating || {};
  const ratingCountRaw = d.rating_count ?? rating.rating_count ?? d.cmt_count ?? d.review_count;
  const image = d.image ?? d.cover ?? d.item_image ?? d.thumbnail ?? (Array.isArray(d.images) ? d.images[0] : null);
  const video = findShopeeProductVideo(d);
  return {
    shopId: Number(item.shop_id),
    itemId: Number(item.item_id),
    url,
    name: (d.name ?? d.title ?? d.item_name ?? d.product_name ?? null) as string | null,
    image: image ? String(image) : null,
    imageUrl: shopeeImageUrl(image),
    videoId: video.videoId,
    videoUrl: video.videoUrl,
    videoThumbnailUrl: video.videoThumbnailUrl,
    videoDurationSec: video.videoDurationSec,
    price: normalizeShopeeMoney(pickNumber(d.price, d.price_min, d.min_price, d.item_price, d.model?.price, d.product_price?.price?.single_value)),
    priceMin: normalizeShopeeMoney(pickNumber(d.price_min, d.min_price, d.price, d.product_price?.price?.range_min)),
    priceMax: normalizeShopeeMoney(pickNumber(d.price_max, d.max_price, d.price, d.product_price?.price?.range_max)),
    priceBeforeDiscount: normalizeShopeeMoney(pickNumber(d.price_before_discount, d.original_price, d.product_price?.price_before_discount?.single_value)),
    stock: pickNumber(d.display_total_stock, d.normal_stock, d.sp_total_stock, d.stock, d.total_stock, d.stock_info?.stock, d.stock_info?.total),
    sold: pickNumber(d.sold, d.historical_sold, d.sold_count),
    rating: pickNumber(d.rating_star, rating.rating_star, d.item_rating?.rating_star, d.shop_rating, typeof d.rating === 'number' ? d.rating : null),
    ratingCount: pickNumber(Array.isArray(ratingCountRaw) ? ratingCountRaw[0] : ratingCountRaw),
    discount: pickNumber(d.discount, d.raw_discount, d.show_discount),
    commissionRate: normalizeCommissionRate(pickNumber(d.comm_rate, d.commission_rate, d.affiliate?.comm_rate, d.affiliate?.commission_rate)),
    modelOptions: d.models ?? d.modelOptions ?? d.item_models ?? d.itemModels ?? d.options ?? null,
    tierVariations: d.tier_variations ?? d.tierVariations ?? d.tier_variation ?? d.variations ?? null,
    variationOptions: d.tier_variation_display_indicators ?? d.tierVariationDisplayIndicators ?? d.variationOptions ?? null,
    isOutOfStock: Boolean(d.is_oos) || pickNumber(d.display_total_stock, d.normal_stock, d.stock) === 0,
    error,
    raw: d,
  };
}

async function fetchShopeeVariationOptionsViaPageContext(
  client: CdpClient,
  cookie: string,
  item: ShopeeBasketItem,
  url: string,
): Promise<Record<string, any> | null> {
  const shopId = Number(item.shop_id);
  const itemId = Number(item.item_id);
  if (!Number.isSafeInteger(shopId) || !Number.isSafeInteger(itemId) || shopId <= 0 || itemId <= 0) return null;

  const jar = parseCookie(cookie);
  const deviceFingerprint = jar.device_sz_fingerprint || jar.shopee_webUnique_ccd || jar.ds || undefined;
  await navigateCdp(client, `https://shopee.co.th/product/${encodeURIComponent(String(shopId))}/${encodeURIComponent(String(itemId))}`, 1_800);

  const body: Record<string, unknown> = {
    item_id: itemId,
    shop_id: shopId,
    quantity: 1,
    tz_offset_in_minutes: 420,
    selected_tiers: { 0: 0 },
  };
  if (deviceFingerprint) body.device_sz_fingerprint = deviceFingerprint;

  const response = await pageContextFetchUrl(client, 'https://shopee.co.th/api/v4/pdp/cart_panel/select_variation_pc', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-source': 'pc',
      'x-requested-with': 'XMLHttpRequest',
      referer: url || `https://shopee.co.th/product/${shopId}/${itemId}`,
    },
    body,
    timeoutMs: 12_000,
  });
  assertShopeePageOk(response.json, 'product variation detail');
  const data = dataOf(unwrapShopeeTuple(response.json)) || response.json?.data || response.json;
  if (!data || typeof data !== 'object') return null;
  return {
    product_price: data.product_price,
    stock: data.stock,
    selected_variation: data.selected_variation,
    tier_variation_display_indicators: data.tier_variation_display_indicators,
  };
}

async function fetchShopeePdpDetailViaPageContext(
  client: CdpClient,
  item: ShopeeBasketItem,
  url: string,
): Promise<Record<string, any> | null> {
  const shopId = Number(item.shop_id);
  const itemId = Number(item.item_id);
  if (!Number.isSafeInteger(shopId) || !Number.isSafeInteger(itemId) || shopId <= 0 || itemId <= 0) return null;

  await navigateCdp(client, `https://shopee.co.th/product/${encodeURIComponent(String(shopId))}/${encodeURIComponent(String(itemId))}`, 1_500);
  try {
    const response = await pageContextFetchUrl(
      client,
      `https://shopee.co.th/api/v4/pdp/get_pc?shop_id=${encodeURIComponent(String(shopId))}&item_id=${encodeURIComponent(String(itemId))}`,
      {
        headers: {
          'x-api-source': 'pc',
          'x-requested-with': 'XMLHttpRequest',
          referer: url || `https://shopee.co.th/product/${shopId}/${itemId}`,
        },
        timeoutMs: 12_000,
      },
    );
    assertShopeePageOk(response.json, 'product page detail');
    const data = dataOf(unwrapShopeeTuple(response.json)) || response.json?.data || response.json;
    return (data?.item || data) as Record<string, any> | null;
  } catch (err) {
    console.warn('[shopee-product] pdp api fetch failed; trying embedded pdp state', {
      shopId,
      itemId,
      message: cleanShopeeRuntimeErrorText(err instanceof Error ? err.message : String(err)),
    });
  }

  const expression = `
    (() => {
      const shopItemKey = ${JSON.stringify(`${shopId}/${itemId}`)};
      const wantedItemId = ${JSON.stringify(itemId)};
      function findItem(value, seen = new Set()) {
        if (!value || typeof value !== 'object' || seen.has(value)) return null;
        seen.add(value);
        if (Number(value.item_id || value.itemid) === wantedItemId) return value;
        for (const child of Object.values(value)) {
          const found = findItem(child, seen);
          if (found) return found;
        }
        return null;
      }
      const scripts = [...document.scripts].map((script) => (script.textContent || '').trim());
      for (const text of scripts) {
        if (!text.includes('PDP_BFF_DATA') && !text.includes(shopItemKey)) continue;
        try {
          const parsed = JSON.parse(text);
          const cachedItem = parsed?.initialState?.DOMAIN_PDP?.data?.PDP_BFF_DATA?.cachedMap?.[shopItemKey]?.item;
          const found = cachedItem || findItem(parsed);
          if (found) return found;
        } catch {}
      }
      for (const text of scripts) {
        const match = text.match(/window\\.__STORE__=JSON\\.parse\\("([\\s\\S]*?)"\\)/);
        if (!match) continue;
        try {
          const parsed = JSON.parse(JSON.parse('"' + match[1] + '"'));
          const found = findItem(parsed);
          if (found) return found;
        } catch {}
      }
      return null;
    })()
  `;
  const result = await withTimeout(
    client.send<{ result?: { value?: Record<string, any> | null }; exceptionDetails?: any }>(
      'Runtime.evaluate',
      { expression, returnByValue: true },
      12_000,
    ),
    15_000,
    'Shopee embedded product state',
  );
  if (result.exceptionDetails) return null;
  return result.result?.value || null;
}

function readTcLevel(value: unknown): { rank: number | null; type: string | null } {
  if (typeof value !== 'string' || !value.trim()) return { rank: null, type: null };
  let tcLevel = '';
  try {
    const parsed = new URL(value);
    tcLevel = parsed.searchParams.get('tcLevel') || '';
  } catch {
    const match = value.match(/[?&]tcLevel=([^&#]+)/i);
    tcLevel = match?.[1] ? decodeURIComponent(match[1]) : value;
  }
  const parts = tcLevel.split(',').map((part) => part.trim()).filter(Boolean);
  let rank: number | null = null;
  let type: string | null = null;
  for (const part of parts) {
    const rankMatch = part.match(/^rank_(\d+(?:\.\d+)?)$/i);
    if (rankMatch) {
      const parsedRank = Number(rankMatch[1]);
      if (Number.isFinite(parsedRank)) rank = parsedRank;
      continue;
    }
    if (!type && /^[a-z]+$/i.test(part)) type = part.toUpperCase();
  }
  return { rank, type };
}

function readRankingMetrics(recommendationInfo: unknown): Pick<ShopeeScreenRankingItem, 'score' | 'ctr' | 'cvr'> {
  const text = typeof recommendationInfo === 'string' ? recommendationInfo : '';
  const read = (pattern: RegExp, multiplier: number) => {
    const match = text.match(pattern);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? Number((value * multiplier).toFixed(2)) : null;
  };
  return {
    score: read(/(?:^|[|,])rule_engine=([0-9.]+)/i, 10_000),
    ctr: read(/RNKMOD:ctr=([0-9.]+)/i, 100),
    cvr: read(/(?:^|[|,])cvr=([0-9.]+)/i, 100),
  };
}

function normalizeRankingText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function collectScreenRankingTargetValues(target?: ShopeeScreenRankingTarget | null): Set<string> {
  const values = new Set<string>();
  if (!target) return values;
  for (const value of [
    target.sessionId,
    target.channelName,
    target.accountName,
    target.username,
    target.platformUid,
    target.shopId,
  ]) {
    const normalized = normalizeRankingText(value);
    if (normalized) values.add(normalized);
  }
  return values;
}

function collectSessionInfoValues(entry: any): Set<string> {
  const values = new Set<string>();
  const add = (value: unknown) => {
    const normalized = normalizeRankingText(value);
    if (normalized) values.add(normalized);
  };

  for (const value of [
    entry?.session_id,
    entry?.sessionId,
    entry?.streamer_shop_id,
    entry?.streamerShopId,
    entry?.shop_id,
    entry?.shopid,
    entry?.shopId,
    entry?.uid,
    entry?.user_id,
    entry?.userId,
    entry?.userid,
    entry?.username,
    entry?.user_name,
    entry?.nickname,
    entry?.display_name,
    entry?.displayName,
    entry?.name,
    entry?.shop_name,
    entry?.shopName,
    entry?.account_name,
    entry?.accountName,
    entry?.streamer_name,
    entry?.streamerName,
    entry?.streamer_username,
    entry?.streamerUsername,
    entry?.streamer_nickname,
    entry?.streamerNickname,
    entry?.seller?.username,
    entry?.seller?.nickname,
    entry?.seller?.shop_name,
    entry?.seller?.shopid,
    entry?.shop?.username,
    entry?.shop?.nickname,
    entry?.shop?.name,
    entry?.shop?.shop_name,
    entry?.shop?.shopid,
    entry?.user?.username,
    entry?.user?.nickname,
    entry?.user?.name,
    entry?.user_info?.username,
    entry?.user_info?.nickname,
    entry?.userInfo?.username,
    entry?.userInfo?.nickname,
  ]) add(value);

  return values;
}

function findScreenRankingMatchIndex(
  sessions: any[],
  liveSessionId: string | null,
  target?: ShopeeScreenRankingTarget | null,
): number {
  const targetValues = collectScreenRankingTargetValues({
    ...target,
    sessionId: target?.sessionId || liveSessionId,
  });
  if (!targetValues.size) return -1;

  return sessions.findIndex((entry: any) => {
    const values = collectSessionInfoValues(entry);
    for (const targetValue of targetValues) {
      if (values.has(targetValue)) return true;
    }
    return false;
  });
}

function normalizeScreenRankingItem(
  item: ShopeeBasketItem,
  url: string,
  liveSessionId: string | null,
  target: ShopeeScreenRankingTarget | null,
  payload: Record<string, any> | null,
  error: string | null,
): ShopeeScreenRankingItem {
  const sessions = Array.isArray(payload?.shop_detailed?.session_infos)
    ? payload?.shop_detailed?.session_infos
    : [];
  const wantedSession = liveSessionId ? String(liveSessionId) : null;
  const matchedIndex = findScreenRankingMatchIndex(sessions, wantedSession, target);
  const matched = matchedIndex >= 0 ? sessions[matchedIndex] : null;
  const first = matched || sessions[0] || null;
  const tc = readTcLevel(first?.session_url || first?.play_url || '');
  const metrics = readRankingMetrics(first?.recommendation_info);
  const matchedCurrentLive = matchedIndex >= 0 && matchedIndex < 10;
  const shouldShowUnavailableAsNotOnScreen = Boolean(error && /Failed to fetch/i.test(error));
  return {
    shopId: Number(item.shop_id) || 0,
    itemId: Number(item.item_id) || 0,
    url,
    screenRank: matchedCurrentLive ? matchedIndex + 1 : null,
    screenRankLabel: error && !shouldShowUnavailableAsNotOnScreen
      ? 'เช็กไม่ได้'
      : matchedCurrentLive
        ? `อันดับ ${matchedIndex + 1}`
        : 'ไม่ติดจอ',
    rankingType: tc.type,
    score: metrics.score,
    ctr: metrics.ctr,
    cvr: metrics.cvr,
    viewCount: pickNumber(first?.view_count, first?.viewer_count, first?.views),
    liveSessionId: wantedSession,
    matched: matchedCurrentLive,
    sessionCount: sessions.length,
    previewImage: first?.preview_image || first?.cover_pic || first?.cover || null,
    error: shouldShowUnavailableAsNotOnScreen ? null : error,
  };
}

async function fetchShopeePdpRankingViaPageContext(
  client: CdpClient,
  item: ShopeeBasketItem,
  url: string,
  cookie: string,
): Promise<Record<string, any> | null> {
  const shopId = Number(item.shop_id);
  const itemId = Number(item.item_id);
  if (!Number.isSafeInteger(shopId) || !Number.isSafeInteger(itemId) || shopId <= 0 || itemId <= 0) return null;

  const jar = parseCookie(cookie);
  const canonicalUrl = `https://shopee.co.th/-i.${shopId}.${itemId}`;
  const query = new URLSearchParams({
    shop_id: String(shopId),
    item_id: String(itemId),
    tz_offset_minutes: '420',
    detail_level: '2',
  });
  if (jar.SPC_CDS) {
    query.set('SPC_CDS', jar.SPC_CDS);
    query.set('SPC_CDS_VER', '2');
  }
  const apiUrl = `https://shopee.co.th/api/v4/pdp/get_pc?${query.toString()}`;

  await client.send('Emulation.clearDeviceMetricsOverride', {}, 5_000).catch(() => undefined);
  await client
    .send('Network.setUserAgentOverride', {
      userAgent: process.env.SHOPEE_DESKTOP_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    }, 5_000)
    .catch(() => undefined);
  const captured = await captureShopeePdpRankingFromProductPage(client, url || canonicalUrl, item);
  if (captured) return captured;

  await navigateCdp(client, 'https://shopee.co.th/#spl-action=check_live_info', 2_500);
  try {
    const response = await pageContextFetchUrl(
      client,
      apiUrl,
      {
        headers: {
          'x-api-source': 'pc',
          'x-requested-with': 'XMLHttpRequest',
          ...(jar.csrftoken ? { 'x-csrftoken': jar.csrftoken } : {}),
          referer: url || canonicalUrl,
        },
        timeoutMs: 12_000,
      },
    );
    assertShopeePageOk(response.json, 'screen ranking detail');
    return (dataOf(unwrapShopeeTuple(response.json)) || response.json?.data || response.json) as Record<string, any> | null;
  } catch {
    const response = await shopeeJson<Record<string, any>>(
      apiUrl,
      {
        headers: {
          ...shopeeHeaders(cookie, canonicalUrl),
          'x-api-source': 'pc',
          'x-requested-with': 'XMLHttpRequest',
          'x-shopee-language': 'th',
          ...(jar.csrftoken ? { 'x-csrftoken': jar.csrftoken } : {}),
          referer: canonicalUrl,
        },
      },
      'screen ranking detail',
    );
    return (dataOf(unwrapShopeeTuple(response)) || response?.data || response) as Record<string, any> | null;
  }
}

async function captureShopeePdpRankingFromProductPage(
  client: CdpClient,
  productUrl: string,
  item: ShopeeBasketItem,
): Promise<Record<string, any> | null> {
  const shopId = Number(item.shop_id);
  const itemId = Number(item.item_id);
  const fallbackUrl = Number.isSafeInteger(shopId) && Number.isSafeInteger(itemId) && shopId > 0 && itemId > 0
    ? `https://shopee.co.th/-i.${shopId}.${itemId}`
    : productUrl;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (payload: Record<string, any> | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(payload);
    };
    const readPayload = (text: string) => {
      if (settled || !text || !/session_infos|shop_detailed/i.test(text)) return;
      try {
        const parsed = JSON.parse(text);
        const data = dataOf(unwrapShopeeTuple(parsed)) || parsed?.data || parsed;
        const sessions = data?.shop_detailed?.session_infos;
        if (Array.isArray(sessions)) finish(data);
      } catch {
        // Ignore non-JSON responses.
      }
    };
    const timer = setTimeout(() => finish(null), 8_000);

    client.onMessage((message) => {
      if (settled || message.method !== 'Network.responseReceived') return;
      const responseUrl = String(message.params?.response?.url || '');
      if (!/shopee/i.test(responseUrl)) return;
      if (!/shopee\.co\.th\/api\/v4\/pdp\/get_pc|shopee\.co\.th\/api\/v4\/item\/get|session|recommend|live|pdp|item/i.test(responseUrl)) return;
      void client
        .send<{ body?: string; base64Encoded?: boolean }>('Network.getResponseBody', {
          requestId: message.params.requestId,
        })
        .then((body) => {
          const text = body.base64Encoded
            ? Buffer.from(body.body || '', 'base64').toString('utf8')
            : String(body.body || '');
          readPayload(text);
        })
        .catch(() => undefined);
    });

    void client.send('Network.clearBrowserCache', {}, 5_000).catch(() => undefined);
    void client.send('Page.navigate', { url: fallbackUrl || productUrl }, 10_000).catch(() => undefined);
    if (productUrl && productUrl !== fallbackUrl) {
      setTimeout(() => {
        if (!settled) void client.send('Page.navigate', { url: productUrl }, 10_000).catch(() => undefined);
      }, 4_000);
    }
  });
}

async function liveProductScreenRankings(
  cookie: string,
  liveSessionId: string | null,
  items: ShopeeBasketItem[],
  links: string[] = [],
  target: ShopeeScreenRankingTarget | null = null,
): Promise<ShopeeScreenRankingsResult> {
  const cleanItems = dedupeShopeeBasketItems(items).slice(0, 200);
  const cleanLinks = links.map((link) => String(link || '').trim()).filter(Boolean).slice(0, 200);
  if (!cleanItems.length && !cleanLinks.length) throw new AppError('ไม่มีสินค้าที่ต้องเช็กอันดับจอ', 400);

  if (!config.shopeeLiveMode) {
    return {
      sessionId: liveSessionId,
      items: cleanItems.map((item, index) => ({
        shopId: Number(item.shop_id) || 0,
        itemId: Number(item.item_id) || 0,
        url: item.url || `https://shopee.co.th/product/${item.shop_id}/${item.item_id}`,
        screenRank: index + 1,
        screenRankLabel: `อันดับ ${index + 1}`,
        rankingType: 'MOCK',
        score: null,
        ctr: null,
        cvr: null,
        viewCount: null,
        liveSessionId,
        matched: true,
        sessionCount: cleanItems.length,
      })),
    };
  }

  return withShopeeChromeTarget(async (client) => {
    await setShopeeCookiesInChrome(client, cookie);
    await navigateCdp(client, 'https://shopee.co.th/', 1_200);

    const resolvedItems: ShopeeBasketItem[] = [...cleanItems];
    for (const link of cleanLinks) {
      if (resolvedItems.some((item) => item.url === link)) continue;
      let resolved: ShopeeBasketItem | null = null;
      let resolveError: string | null = null;
      try {
        resolved = productPairFromUrl(link);
        if (!resolved && isShopeeShortLink(link)) {
          const expandedUrl = (await fetchShopeeRedirectUrl(link, 'HEAD').catch(() => null)) || (await fetchShopeeRedirectUrl(link, 'GET').catch(() => null));
          resolved = expandedUrl ? productPairFromUrl(expandedUrl) : null;
        }
        if (!resolved) resolved = await resolveShopeeLinkViaBrowserContext(client, link).catch(() => null);
      } catch (err) {
        resolveError = cleanShopeeRuntimeErrorText(err instanceof Error ? err.message : String(err));
      }
      resolvedItems.push(resolved ? { ...resolved, url: link } : { shop_id: 0, item_id: 0, url: link, error: resolveError || 'แปลงลิงก์นี้เป็นสินค้า Shopee ไม่ได้' });
    }

    let sessionId = liveSessionId?.trim() || null;
    if (!sessionId) {
      try {
        const payload = (await shopeePageContextFetch(client, '/api/v1/session', { timeoutMs: 10_000 })).json;
        assertShopeePageOk(payload, 'load session');
        sessionId = readSessionId(payload);
      } catch {
        sessionId = null;
      }
    }
    const results: ShopeeScreenRankingItem[] = [];
    for (const item of dedupeShopeeBasketItems(resolvedItems)) {
      const url = item.url || `https://shopee.co.th/product/${item.shop_id}/${item.item_id}`;
      if (!Number(item.shop_id) || !Number(item.item_id)) {
        results.push(normalizeScreenRankingItem(item, url, sessionId, target, null, 'แปลงลิงก์นี้เป็นสินค้า Shopee ไม่ได้'));
        continue;
      }
      try {
        const detail = await fetchShopeePdpRankingViaPageContext(client, item, url, cookie);
        results.push(normalizeScreenRankingItem(item, url, sessionId, target, detail, null));
      } catch (err) {
        results.push(normalizeScreenRankingItem(item, url, sessionId, target, null, cleanShopeeRuntimeErrorText(err instanceof Error ? err.message : String(err))));
      }
    }
    return { sessionId, items: results };
  });
}

async function liveProductDetails(
  cookie: string,
  liveSessionId: string | null,
  items: ShopeeBasketItem[],
  links: string[] = [],
): Promise<ShopeeProductDetailsResult> {
  const cleanItems = dedupeShopeeBasketItems(items).slice(0, 200);
  const cleanLinks = links.map((link) => String(link || '').trim()).filter(Boolean).slice(0, 200);
  if (!cleanItems.length && !cleanLinks.length) throw new AppError('ไม่มีสินค้าที่ต้องเช็ก', 400);

  if (!config.shopeeLiveMode) {
    return {
      sessionId: liveSessionId,
      items: cleanItems.map((item) =>
        normalizeProductDetail(item, item.url || `https://shopee.co.th/product/${item.shop_id}/${item.item_id}`, {
          name: `สินค้าทดสอบ ${item.item_id}`,
          price: 1900000,
          stock: 10,
          rating_star: 4.5,
          rating_count: 12,
        }, null),
      ),
    };
  }

  return withShopeeChromeTarget(async (client) => {
    await setShopeeCookiesInChrome(client, cookie);
    await navigateCdp(client, SHOPEE_MOBILE_API_REFERER, 1_800);

    let sessionId = liveSessionId?.trim() || null;
    if (!sessionId) {
      const payload = (await shopeePageContextFetch(client, '/api/v1/session', { timeoutMs: 10_000 })).json;
      assertShopeePageOk(payload, 'load session');
      sessionId = readSessionId(payload);
    }
    if (!sessionId) throw new AppError('ไม่พบ Shopee Live session สำหรับเช็กสินค้า', 502);

    // Resolve product, short, and affiliate links to shop_id + item_id first.
    const resolvedItems: ShopeeBasketItem[] = [...cleanItems];
    for (const link of cleanLinks) {
      if (resolvedItems.some((item) => item.url === link)) continue;
      let resolved: ShopeeBasketItem | null = null;
      for (const path of ['/webapi/v1/item/parse_url', '/api/v1/item/parse_url']) {
        try {
          const response = await shopeePageContextFetch(client, path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { links: [link] },
            timeoutMs: 10_000,
          });
          assertShopeePageOk(response.json, 'parse item URL');
          resolved = collectShopeeBasketItemsFromPayload(response.json)[0] ?? null;
          if (resolved) break;
        } catch (error) {
          // try the next endpoint variant
        }
      }
      if (!resolved) {
        const expandedUrl = isShopeeShortLink(link)
          ? (await fetchShopeeRedirectUrl(link, 'HEAD')) || (await fetchShopeeRedirectUrl(link, 'GET'))
          : null;
        const expandedPair = expandedUrl ? productPairFromUrl(expandedUrl) : null;
        if (expandedPair) resolved = { ...expandedPair, url: link };
      }
      if (!resolved) resolved = await resolveShopeeLinkViaBrowserContext(client, link).catch(() => null);
      resolvedItems.push(resolved ? { ...resolved, url: link } : { shop_id: 0, item_id: 0, url: link });
      await navigateCdp(client, SHOPEE_MOBILE_API_REFERER, 600).catch(() => undefined);
    }

    const results: ShopeeProductDetail[] = [];
    for (const item of resolvedItems) {
      const url = item.url || `https://shopee.co.th/product/${item.shop_id}/${item.item_id}`;
      if (!Number(item.item_id)) {
        results.push(normalizeProductDetail(item, url, null, 'แปลงลิงก์นี้เป็นสินค้า Shopee ไม่ได้'));
        continue;
      }
      let detail: Record<string, any> | null = null;
      let error: string | null = null;
      for (const path of [
        `/webapi/v1/session/${encodeURIComponent(sessionId)}/import_items/detail`,
        `/api/v1/session/${encodeURIComponent(sessionId)}/import_items/detail`,
      ]) {
        try {
          const response = await shopeePageContextFetch(client, path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { items: [{ shop_id: Number(item.shop_id), item_id: Number(item.item_id) }], links: [url] },
            timeoutMs: 10_000,
          });
          assertShopeePageOk(response.json, 'product detail');
          const found = collectShopeeBasketItemsFromPayload(response.json);
          detail = found.find((candidate) => sameShopeeBasketItem(candidate, item)) ?? found[0] ?? null;
          error = detail ? null : 'Shopee ไม่คืนข้อมูลสินค้านี้';
          if (detail) break;
        } catch (err) {
          error = cleanShopeeRuntimeErrorText(err instanceof Error ? err.message : String(err));
        }
      }
      if (!detail) {
        try {
          detail = await fetchShopeePdpDetailViaPageContext(client, item, url);
          error = detail ? null : (error || 'Shopee ไม่คืนข้อมูลสินค้านี้');
        } catch (err) {
          error = cleanShopeeRuntimeErrorText(err instanceof Error ? err.message : String(err));
        }
      } else if (!hasShopeeOptionData(detail)) {
        try {
          const pdpDetail = await fetchShopeePdpDetailViaPageContext(client, item, url);
          if (pdpDetail) {
            detail = { ...pdpDetail, ...detail };
            if (hasShopeeOptionData(pdpDetail)) {
              detail.models = detail.models ?? pdpDetail.models ?? pdpDetail.item_models;
              detail.tier_variations = detail.tier_variations ?? pdpDetail.tier_variations ?? pdpDetail.tierVariations;
            }
          }
        } catch {
          // Live import detail is still usable for price/stock when PDP anti-bot blocks options.
        }
      }
      if (detail && !hasShopeeOptionData(detail)) {
        try {
          const variationDetail = await fetchShopeeVariationOptionsViaPageContext(client, cookie, item, url);
          if (variationDetail) {
            detail = { ...detail, ...variationDetail };
            error = null;
          }
        } catch (err) {
          console.warn('[shopee-product] variation option fetch failed', {
            shopId: Number(item.shop_id),
            itemId: Number(item.item_id),
            message: cleanShopeeRuntimeErrorText(err instanceof Error ? err.message : String(err)),
          });
        }
      }
      results.push(normalizeProductDetail(item, url, detail, error));
    }

    const sample = results.find((entry) => !entry.error);
    if (sample) {
      console.info('[shopee-product] detail fetched', {
        sessionId,
        count: results.length,
        sample: {
          shopId: sample.shopId,
          itemId: sample.itemId,
          hasName: Boolean(sample.name),
          hasImage: Boolean(sample.imageUrl),
          price: sample.price,
          stock: sample.stock,
          commissionRate: sample.commissionRate,
          hasOptions: Boolean(sample.variationOptions || sample.tierVariations || sample.modelOptions),
        },
      });
    }
    return { sessionId, items: results };
  });
}

function collectCommentCandidates(value: unknown, out: any[] = [], seen = new Set<object>()): any[] {
  if (!value || typeof value !== 'object') return out;
  if (seen.has(value as object)) return out;
  seen.add(value as object);

  if (Array.isArray(value)) {
    for (const item of value) collectCommentCandidates(item, out, seen);
    return out;
  }

  const record = value as Record<string, any>;
  if (Array.isArray(record.message)) {
    for (const entry of record.message) {
      collectCommentCandidates(entry, out, seen);
      const msgs = entry && typeof entry === 'object' ? (entry as Record<string, any>).msgs : null;
      if (Array.isArray(msgs)) {
        for (const msg of msgs) {
          out.push({
            ...(entry && typeof entry === 'object' ? entry : {}),
            ...(msg && typeof msg === 'object' ? msg : { content: msg }),
            raw_message_entry: entry,
          });
          collectCommentCandidates(msg, out, seen);
        }
      }
    }
  }
  if (Array.isArray(record.msgs)) {
    for (const msg of record.msgs) {
      out.push({
        ...record,
        ...(msg && typeof msg === 'object' ? msg : { content: msg }),
        raw_msgs_entry: record,
      });
      collectCommentCandidates(msg, out, seen);
    }
  }
  const content = record.content;
  if (typeof content === 'string' && content.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        out.push({ ...record, ...parsed, raw_content: content });
        collectCommentCandidates(parsed, out, seen);
      }
    } catch {
      // Shopee sometimes uses plain text content. Keep the original record below.
    }
  }
  const text =
    record.content ??
    record.comment ??
    record.comment_content ??
    record.commentContent ??
    record.message ??
    record.msg ??
    record.text;
  if (typeof text === 'string' && text.trim()) {
    out.push(record);
  }

  for (const child of Object.values(record)) collectCommentCandidates(child, out, seen);
  return out;
}

function readNestedCommentText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return readNestedCommentText(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (typeof value !== 'object') return String(value).trim();
  const record = value as Record<string, any>;
  const nested =
    record.text ??
    record.comment ??
    record.comment_content ??
    record.commentContent ??
    record.message ??
    record.msg ??
    record.content ??
    '';
  return readNestedCommentText(nested);
}

function compactCommentPayloadSample(payloads: unknown[]): string[] {
  return payloads.slice(-3).map((payload) => {
    try {
      return JSON.stringify(payload)
        .replace(/"SPC_[^"]*":"[^"]*"/g, '"cookie":"[redacted]"')
        .replace(/\s+/g, ' ')
        .slice(0, 900);
    } catch {
      return String(payload).slice(0, 900);
    }
  });
}

function normalizeShopeeLiveComments(payload: unknown): ShopeeLiveComment[] {
  const candidates = collectCommentCandidates(dataOf(unwrapShopeeTuple(payload)));
  const comments: ShopeeLiveComment[] = [];
  const seen = new Set<string>();
  const byText = new Map<string, ShopeeLiveComment>();

  for (const item of candidates) {
    const messageType = Number(item.type ?? item.msg_type ?? item.message_type ?? item.messageType);
    if (messageType === 101 || item.is_host === true || item.isHost === true || item.sender_type === 'host' || item.senderType === 'host') {
      continue;
    }

    const text = readNestedCommentText(item);
    if (!text) continue;

    const rawId =
      item.id ??
      item.comment_id ??
      item.commentId ??
      item.msg_id ??
      item.message_id ??
      item.messageId ??
      item.uuid ??
      item.client_msg_id ??
      item.clientMsgId ??
      null;
    const customerName =
      item.nickname ??
      item.nick_name ??
      item.nickName ??
      item.username ??
      item.user_name ??
      item.userName ??
      item.display_name ??
      item.displayName ??
      item.sender?.nickname ??
      item.sender?.username ??
      item.from?.nickname ??
      item.from?.username ??
      item.user?.nickname ??
      item.user?.username ??
      item.user_info?.nickname ??
      item.user_info?.username ??
      item.userInfo?.nickname ??
      item.userInfo?.username ??
      null;
    const created =
      item.created_at ??
      item.create_time ??
      item.createTime ??
      item.timestamp ??
      item.time ??
      null;
    const id = rawId === null || rawId === undefined ? null : String(rawId);
    const createdAt =
      typeof created === 'number'
        ? new Date(created > 10_000_000_000 ? created : created * 1000).toISOString()
        : created
          ? String(created)
          : null;
    const key = id || `${customerName || ''}:${text}:${createdAt || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const comment = {
      id,
      customerName: customerName ? String(customerName) : null,
      text,
      createdAt,
      raw: item,
    };
    const textKey = text.replace(/\s+/g, ' ').trim().toLowerCase();
    const existing = byText.get(textKey);
    if (!existing || (!existing.customerName && comment.customerName) || (!existing.id && comment.id)) {
      byText.set(textKey, comment);
    }
    comments.push(comment);
  }

  const merged: ShopeeLiveComment[] = [];
  const mergedSeen = new Set<ShopeeLiveComment>();
  for (const comment of comments) {
    const textKey = comment.text.replace(/\s+/g, ' ').trim().toLowerCase();
    const preferred = byText.get(textKey) || comment;
    if (mergedSeen.has(preferred)) continue;
    mergedSeen.add(preferred);
    merged.push(preferred);
  }
  return merged.slice(-50);
}

async function readShopeeLiveCommentsFromChatroom(
  client: CdpClient,
  sessionId: string,
  cookie: string,
): Promise<ShopeeLiveComment[]> {
  const jar = parseCookie(cookie);
  const uuid = readCookieDeviceId(jar, cookie);
  const previewPath = `/api/v1/session/${encodeURIComponent(sessionId)}/preview?uuid=${encodeURIComponent(uuid)}&ver=2`;
  const preview = await shopeePageContextFetch(client, previewPath, { timeoutMs: 8_000 });
  assertShopeePageOk(preview.json, 'ดึง chatroom Shopee Live');
  const chatroomId = readLiveChatroomId(preview.json);
  if (!chatroomId) throw new Error(`${previewPath}: ไม่พบ chatroom_id`);

  const url =
    `https://chatroom-live.shopee.co.th/api/v1/fetch/chatroom/${encodeURIComponent(chatroomId)}/message` +
    `?uuid=${encodeURIComponent(uuid)}&timestamp=0&version=v2`;
  const result = await pageContextFetchUrl(client, url, {
    timeoutMs: 10_000,
    headers: {
      'content-type': 'application/json',
      'client-info': 'os=web;platform=shopee',
      'x-livestreaming-source': 'shopee',
    },
  });
  assertShopeePageOk(result.json, 'อ่านคอมเมนต์ Shopee Live');
  const comments = normalizeShopeeLiveComments(result.json);
  console.info('[shopee-comments] read chatroom messages', {
    sessionId,
    chatroomId,
    count: comments.length,
  });
  return comments;
}

function normalizeShopeeLiveCommentsFromText(text: string): ShopeeLiveComment[] {
  const seen = new Set<string>();
  const comments: ShopeeLiveComment[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^(.{2,48}?)[：:]\s*(.{1,240})$/);
    if (!match) continue;
    const customerName = match[1].trim();
    const commentText = match[2].trim();
    if (!customerName || !commentText) continue;
    if (/Shopee\s*Live|LIVE|ราคา|ตะกร้า|ซื้อ|Coins|Reward/i.test(customerName)) continue;
    if (/ขอให้สนุกกับการรับชม|เลือกดูสินค้า|ราคาพิเศษ|ช้อปเลย/i.test(commentText)) continue;
    const key = `${customerName}:${commentText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    comments.push({
      id: stableId(`dom-comment:${key}`, 16),
      customerName,
      text: commentText,
      createdAt: new Date().toISOString(),
      raw: { source: 'share-page-dom', line },
    });
  }

  return comments.slice(-50);
}

async function readShopeeLiveCommentsFromSharePage(client: CdpClient, liveSessionId: string): Promise<ShopeeLiveComment[]> {
  await navigateShopeeLiveSharePage(client, liveSessionId);
  const result = await client.send<{ result?: { value?: { href?: string; title?: string; text?: string } }; exceptionDetails?: any }>(
    'Runtime.evaluate',
    {
      expression: `
        (() => {
          const texts = [];
          if (document.body?.innerText) texts.push(document.body.innerText);
          for (const el of document.querySelectorAll('[aria-label], [title], input, textarea')) {
            texts.push(el.getAttribute('aria-label') || '');
            texts.push(el.getAttribute('title') || '');
            texts.push(el.value || el.placeholder || '');
          }
          return {
            href: location.href,
            title: document.title,
            text: texts.filter(Boolean).join('\\n')
          };
        })()
      `,
      returnByValue: true,
    },
    10_000,
  );
  if (result.exceptionDetails) return [];
  const page = result.result?.value || {};
  const comments = normalizeShopeeLiveCommentsFromText(page.text || '');
  if (!comments.length) {
    console.warn('[shopee-comments] share page has no parsed comments', {
      sessionId: liveSessionId,
      href: page.href,
      title: page.title,
      textLength: page.text?.length || 0,
      sample: (page.text || '').replace(/\s+/g, ' ').slice(0, 300),
    });
  }
  return comments;
}

async function readShopeeLiveCommentsFromNetwork(client: CdpClient, liveSessionId: string): Promise<ShopeeLiveComment[]> {
  await client.send('Network.enable').catch(() => undefined);
  const payloads: unknown[] = [];
  const seenText = new Set<string>();

  const readText = (text: string, source: string) => {
    const trimmed = text.trim();
    if (!trimmed || seenText.has(trimmed)) return;
    seenText.add(trimmed);
    try {
      payloads.push({ source, json: JSON.parse(trimmed) });
      return;
    } catch {
      // Some websocket frames contain escaped JSON inside a larger string.
    }
    const matches = trimmed.match(/\{[\s\S]{20,}\}/g) || [];
    for (const match of matches.slice(0, 5)) {
      try {
        payloads.push({ source, json: JSON.parse(match) });
      } catch {
        // Ignore non-JSON fragments.
      }
    }
  };

  const handler = (message: any) => {
    if (message.method === 'Network.webSocketFrameReceived' || message.method === 'Network.webSocketFrameSent') {
      const payloadData = String(message.params?.response?.payloadData || '');
      if (/comment|message|msg|chat|content|nickname|username/i.test(payloadData)) {
        readText(payloadData, message.method);
      }
      return;
    }
    if (message.method !== 'Network.responseReceived') return;
    const responseUrl = String(message.params?.response?.url || '');
    if (!/live|chat|comment|message|msg|session|im|gateway/i.test(responseUrl)) return;
    void client
      .send<{ body?: string; base64Encoded?: boolean }>('Network.getResponseBody', {
        requestId: message.params.requestId,
      })
      .then((body) => {
        const text = body.base64Encoded
          ? Buffer.from(body.body || '', 'base64').toString('utf8')
          : String(body.body || '');
        if (/comment|message|msg|chat|content|nickname|username/i.test(text)) {
          readText(text, responseUrl);
        }
      })
      .catch(() => undefined);
  };

  client.onMessage(handler);
  await navigateShopeeLiveSharePage(client, liveSessionId);
  await new Promise((resolve) => setTimeout(resolve, 8_000));

  const comments = normalizeShopeeLiveComments(payloads);
  if (comments.length) {
    console.info('[shopee-comments] read comments', {
      sessionId: liveSessionId,
      endpoint: 'share-page-network',
      count: comments.length,
      payloads: payloads.length,
    });
    return comments;
  }
  console.warn('[shopee-comments] share network has no parsed comments', {
    sessionId: liveSessionId,
    payloads: payloads.length,
    sample: compactCommentPayloadSample(payloads),
  });
  return [];
}

async function sendShopeeLiveCommentViaSharePage(client: CdpClient, liveSessionId: string, text: string): Promise<boolean> {
  await navigateShopeeLiveSharePage(client, liveSessionId);
  const result = await client.send<{ result?: { value?: boolean }; exceptionDetails?: any }>(
    'Runtime.evaluate',
    {
      expression: `
        (async () => {
          const message = ${JSON.stringify(text)};
          const candidates = [
            ...document.querySelectorAll('textarea, input[type="text"], input:not([type]), [contenteditable="true"]')
          ];
          const visible = (el) => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
          };
          const input = candidates.find(visible);
          if (!input) return false;
          input.focus();
          if (input.isContentEditable) {
            input.textContent = message;
          } else {
            input.value = message;
          }
          input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: message }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 250));
          const buttons = [...document.querySelectorAll('button, [role="button"], div, span')]
            .filter(visible)
            .filter((el) => /ส่ง|send/i.test((el.innerText || el.textContent || '').trim()));
          const button = buttons[0];
          if (button) {
            button.click();
            return true;
          }
          input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }));
          input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }));
          return true;
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    },
    15_000,
  );
  return Boolean(result.result?.value) && !result.exceptionDetails;
}

async function liveComments(cookie: string, liveSessionId: string): Promise<ShopeeLiveComment[]> {
  const sessionId = parseShopeeLiveSessionId(liveSessionId);
  if (!sessionId) return [];

  const attempts = [
    `/api/v1/session/${encodeURIComponent(sessionId)}/comments?limit=30`,
    `/api/v1/session/${encodeURIComponent(sessionId)}/comment/list?limit=30`,
    `/api/v1/session/${encodeURIComponent(sessionId)}/comments/list?limit=30`,
    `/api/v1/session/${encodeURIComponent(sessionId)}/chatroom/messages?limit=30`,
    `/api/v1/session/${encodeURIComponent(sessionId)}/messages?limit=30`,
    `/api/v1/comment/list?session_id=${encodeURIComponent(sessionId)}&limit=30`,
    `/api/v1/comments?session_id=${encodeURIComponent(sessionId)}&limit=30`,
    `/api/v1/chatroom/messages?session_id=${encodeURIComponent(sessionId)}&limit=30`,
  ];

  return withShopeeChromeTarget(async (client) => {
    await setShopeeCookiesInChrome(client, cookie);
    await ensureShopeeLiveOrigin(client);
    const errors: string[] = [];
    try {
      return await readShopeeLiveCommentsFromChatroom(client, sessionId, cookie);
    } catch (error) {
      errors.push(`chatroom-live: ${error instanceof Error ? error.message : String(error)}`);
    }
    for (const path of attempts) {
      try {
        const result = await shopeePageContextFetch(client, path, { timeoutMs: 8_000 });
        const comments = normalizeShopeeLiveComments(result.json);
        if (comments.length) {
          console.info('[shopee-comments] read comments', { sessionId, endpoint: path, count: comments.length });
          return comments;
        }
        errors.push(`${path}: empty`);
      } catch (error) {
        errors.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (process.env.SHOPEE_COMMENT_NETWORK_FALLBACK === 'true') {
      const networkComments = await readShopeeLiveCommentsFromNetwork(client, sessionId).catch(() => []);
      if (networkComments.length) return networkComments;
    }
    if (process.env.SHOPEE_COMMENT_DOM_FALLBACK === 'true') {
      const domComments = await readShopeeLiveCommentsFromSharePage(client, sessionId).catch(() => []);
      if (domComments.length) {
        console.info('[shopee-comments] read comments', { sessionId, endpoint: 'share-page-dom', count: domComments.length });
        return domComments;
      }
    }
    console.warn('[shopee-comments] no comment endpoint returned data', { sessionId, errors: errors.slice(0, 4) });
    return [];
  });
}

async function sendLiveComment(cookie: string, liveSessionId: string, text: string): Promise<{ sessionId: string; sent: boolean; endpoint: string | null; raw?: unknown }> {
  const sessionId = parseShopeeLiveSessionId(liveSessionId) || liveSessionId;
  const message = text.trim().slice(0, 240);
  if (!message) return { sessionId, sent: false, endpoint: null };

  return withShopeeChromeTarget(async (client) => {
    await setShopeeCookiesInChrome(client, cookie);
    await ensureShopeeLiveOrigin(client);
    const errors: string[] = [];
    const jar = parseCookie(cookie);
    const uuid = readCookieDeviceId(jar, cookie);
    const previewPath = `/api/v1/session/${encodeURIComponent(sessionId)}/preview?uuid=${encodeURIComponent(uuid)}&ver=2`;
    try {
      const preview = await shopeePageContextFetch(client, previewPath, { timeoutMs: 8_000 });
      assertShopeePageOk(preview.json, 'ดึง usersig Shopee Live');
      const usersig = readLiveUsersig(preview.json);
      if (!usersig) {
        errors.push(`${previewPath}: ไม่พบ usersig`);
      } else {
        const path = `/webapi/v1/session/${encodeURIComponent(sessionId)}/message`;
        const result = await shopeePageContextFetch(client, path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: {
            uuid,
            usersig,
            content: JSON.stringify({ type: 101, content: message }),
            pin: false,
          },
          timeoutMs: 8_000,
        });
        assertShopeePageOk(result.json, 'ส่งคอมเมนต์ Shopee Live');
        console.info('[shopee-comments] sent comment', { sessionId, endpoint: path, variant: 'json-usersig-type101' });
        return { sessionId, sent: true, endpoint: `${path}#json-usersig-type101`, raw: result.json };
      }
    } catch (error) {
      errors.push(`${previewPath} -> /webapi/v1/session/${sessionId}/message: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (process.env.SHOPEE_COMMENT_DOM_FALLBACK === 'true') {
      const sentViaDom = await sendShopeeLiveCommentViaSharePage(client, sessionId, message).catch(() => false);
      if (sentViaDom) {
        console.info('[shopee-comments] sent comment', { sessionId, endpoint: 'share-page-dom' });
        return { sessionId, sent: true, endpoint: 'share-page-dom', raw: { source: 'share-page-dom' } };
      }
    }
    console.warn('[shopee-comments] send comment failed', { sessionId, errors: errors.slice(0, 4) });
    throw new AppError(`ส่งคอมเมนต์ Shopee Live ไม่สำเร็จ: ${errors[0] || 'ไม่พบ endpoint ที่ใช้งานได้'}`, 502);
  });
}

export const shopee = {
  get mode() {
    return config.shopeeLiveMode ? 'live' : 'mock';
  },

  checkCookie(platform: string, cookie: string): Promise<CheckCookieResult> {
    if (config.shopeeLiveMode) return liveCheckCookie(platform, cookie);
    return Promise.resolve(mockCheckCookie(platform, cookie));
  },

  productDetails(cookie: string, liveSessionId: string | null, items: ShopeeBasketItem[], links: string[] = []) {
    return liveProductDetails(cookie, liveSessionId, items, links);
  },

  productScreenRankings(cookie: string, liveSessionId: string | null, items: ShopeeBasketItem[], links: string[] = [], target: ShopeeScreenRankingTarget | null = null) {
    return liveProductScreenRankings(cookie, liveSessionId, items, links, target);
  },

  createSession(
    cookie: string,
    title: string,
    coverImageUrl?: string | null,
    description?: string | null,
    existingLiveSessionId?: string | null,
    platformUid?: string | null,
    basketItems: ShopeeBasketItem[] = [],
  ): Promise<LiveSession> {
    if (config.shopeeLiveMode) {
      return liveCreateSession(cookie, title, coverImageUrl, description, existingLiveSessionId, platformUid, basketItems);
    }
    return Promise.resolve(mockCreateSession(title, coverImageUrl));
  },

  syncSessionInfo(
    cookie: string,
    liveSessionId: string,
    title: string,
    coverImageUrl?: string | null,
    description?: string | null,
    basketItems: ShopeeBasketItem[] = [],
  ): Promise<ShopeeLiveSyncResult> {
    if (config.shopeeLiveMode) {
      return liveSyncSessionInfo(cookie, liveSessionId, title, coverImageUrl, description, basketItems);
    }
    return Promise.resolve({
      sessionId: liveSessionId,
      synced: true,
      basketCount: basketItems.length,
      hasCover: Boolean(coverImageUrl),
      title: title.trim().slice(0, 200),
      description: (description || title).trim().slice(0, 200),
      raw: { source: 'mock-live-sync' },
    });
  },

  syncSessionMetadata(
    cookie: string,
    liveSessionId: string,
    changes: { title?: string | null; description?: string | null; coverImageUrl?: string | null },
  ): Promise<ShopeeLiveMetadataSyncResult> {
    if (config.shopeeLiveMode) return liveSyncSessionMetadata(cookie, liveSessionId, changes);
    return Promise.resolve({
      sessionId: liveSessionId,
      synced: true,
      changed: {
        title: changes.title !== undefined,
        description: changes.description !== undefined,
        cover: changes.coverImageUrl !== undefined,
      },
      raw: { source: 'mock-metadata-sync' },
    });
  },

  syncBasketItems(
    cookie: string,
    liveSessionId: string,
    basketItems: ShopeeBasketItem[],
  ): Promise<ShopeeBasketSyncResult> {
    return liveSyncBasketItems(cookie, liveSessionId, basketItems);
  },

  async startSession(cookie: string, liveSessionId: string): Promise<ShopeeStartSessionResult> {
    if (!config.shopeeLiveMode) return { sessionId: liveSessionId, isLive: true, alreadyLive: false };
    return liveStartSession(cookie, liveSessionId);
  },

  async endSession(cookie: string, liveSessionId: string): Promise<void> {
    if (!config.shopeeLiveMode) return;
    try {
      await endSessionViaShopeeRuntime(cookie, liveSessionId);
    } catch (error) {
      throw new AppError(
        `จบ Shopee Live ไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`,
        502,
      );
    }
  },

  sessionStats(cookie: string, liveSessionId: string): Promise<ShopeeLiveStats> {
    return liveSessionStats(cookie, liveSessionId);
  },

  promotionList(cookie: string, liveSessionId: string): Promise<ShopeePromotionListResult> {
    return livePromotionList(cookie, liveSessionId);
  },

  promotionItems(cookie: string, liveSessionId: string, promotionId: string): Promise<ShopeePromotionItemsResult> {
    return livePromotionItems(cookie, liveSessionId, promotionId);
  },

  addPromotionItems(
    cookie: string,
    liveSessionId: string,
    items: ShopeeBasketItem[],
  ): Promise<{ sessionId: string; added: number; items: ShopeeBasketItem[] }> {
    return liveAddPromotionItems(cookie, liveSessionId, items);
  },

  removePromotionItems(
    cookie: string,
    liveSessionId: string,
    items: ShopeeBasketItem[],
  ): Promise<{ sessionId: string; removed: number; items: ShopeeBasketItem[] }> {
    return liveRemovePromotionItems(cookie, liveSessionId, items);
  },

  basketItems(cookie: string, liveSessionId: string): Promise<ShopeeBasketItemsResult> {
    return liveBasketItems(cookie, liveSessionId);
  },

  showBasketItem(
    cookie: string,
    liveSessionId: string,
    item: ShopeeBasketItem | null,
  ): Promise<ShopeeShowBasketItemResult> {
    return liveShowBasketItem(cookie, liveSessionId, item);
  },

  pinBasketItems(
    cookie: string,
    liveSessionId: string,
    items: ShopeeBasketItem[],
  ): Promise<ShopeePinBasketItemsResult> {
    return livePinBasketItems(cookie, liveSessionId, items);
  },

  liveComments(cookie: string, liveSessionId: string): Promise<ShopeeLiveComment[]> {
    return liveComments(cookie, liveSessionId);
  },

  sendLiveComment(cookie: string, liveSessionId: string, text: string): Promise<{ sessionId: string; sent: boolean; endpoint: string | null; raw?: unknown }> {
    return sendLiveComment(cookie, liveSessionId, text);
  },
};
