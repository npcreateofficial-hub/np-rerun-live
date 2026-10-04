import type { AuthSession, AuthUser } from '@/types/auth';
import type { LiveChannel } from '@/types/account';
import type { RerunSession } from '@/types/rerun';
import type { CreateVideoPayload, VideoItem } from '@/types/video';
import crypto from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const now = () => new Date().toISOString();

export const demoUser: AuthUser = {
  id: 'user-demo',
  email: 'npcreatemarketing@test.local',
  username: 'npcreatemarketing',
  displayName: 'npcreatemarketing',
  role: 'USER',
  isActive: true,
  createdAt: now(),
  updatedAt: now(),
};

export const tokens = {
  accessToken: 'demo-access-token',
  refreshToken: 'demo-refresh-token',
};

export const channels: LiveChannel[] = [
  {
    id: 'channel-npcreate',
    userId: demoUser.id,
    name: 'npcreatemarketing',
    isOnline: false,
    platform: 'SHOPEE',
    accountName: 'npcreatemarketing',
    shopId: '43988129',
    platformUid: '43988129',
    avatar: '/icons/shopee.png',
    status: 'READY',
    cookie: process.env.SHOPEE_TEST_COOKIE || null,
    cookieValid: true,
    rtmpUrl: null,
    streamKey: null,
    coverImageUrl: null,
    liveSessionId: null,
    basketLinks: '',
    basketItemsJson: '[]',
    caption: 'Shopee Live จากเว็บ',
    description: 'รอบทดสอบขึ้นไลฟ์',
    autoLive: false,
    liveDurationMinutes: 60,
    restartDelayMinutes: 5,
    lastCheckedAt: now(),
    createdAt: now(),
    updatedAt: now(),
  },
];

export const videos: VideoItem[] = [];

export const sessions: RerunSession[] = [];
export const pushProcesses = new Map<string, ReturnType<typeof spawn>>();

type ShopeeLiveStartResult = {
  sessionId: string;
  shareUrl?: string | null;
  pushUrl: string;
  streamKey?: string | null;
  raw?: unknown;
};

type LiveHeaderProfile = {
  label: string;
  szToken?: string;
};

const DEFAULT_SHOPEE_LIVE_API_BASES: string[] = [];
const SHOPEE_MOBILE_REFERER = process.env.SHOPEE_LIVE_REFERER || 'https://live.shopee.co.th/guide-download';
const SHOPEE_MOBILE_CLIENT_INFO = process.env.SHOPEE_LIVE_CLIENT_INFO || 'os=2;platform=9';
const SHOPEE_LIVESTREAMING_SOURCE = process.env.SHOPEE_LIVESTREAMING_SOURCE || 'shopee';
const ALLOWED_SHOPEE_HOSTS = new Set(['shopee.co.th', 'seller.shopee.co.th', 'creator.shopee.co.th', 'live.shopee.co.th']);

export function apiData<T>(data: T) {
  return Response.json({ success: true, data });
}

export function apiError(message: string, status = 400, extra?: unknown) {
  return Response.json({ success: false, message, error: extra }, { status });
}

export async function createSession(payload: {
  liveChannelId?: string;
  accountId?: string;
  videoId?: string;
  title?: string;
  liveChannel?: Partial<LiveChannel> | null;
  account?: Partial<LiveChannel> | null;
  video?: Partial<VideoItem> | null;
}) {
  syncUploadedVideos();
  const liveChannelId = payload.liveChannelId ?? payload.accountId;
  const incomingChannel = payload.liveChannel ?? payload.account ?? null;
  const incomingVideo = payload.video ?? null;
  let channel = channels.find((item) => item.id === liveChannelId);
  let video = videos.find((item) => item.id === payload.videoId) || videos.find((item) => item.liveChannelId === liveChannelId && item.status === 'READY');

  if (!channel && incomingChannel) {
    channel = buildTransientChannel(incomingChannel, liveChannelId);
    channels.unshift(channel);
  }

  if (!video && incomingVideo) {
    video = buildTransientVideo(incomingVideo, channel?.id ?? liveChannelId);
    videos.unshift(video);
  }

  if (!channel) throw new Error('ไม่พบบัญชี Shopee ที่เลือก');
  if (!video) throw new Error('ไม่พบวิดีโอ READY ที่เลือก');
  if (channel.cookieValid === false) throw new Error('Cookie ของบัญชีนี้ยังไม่ผ่าน');
  if (channel.isOnline) throw new Error('บัญชีนี้กำลัง LIVE อยู่');
  const shopeeLive = await prepareShopeeApiLive(channel, video, payload.title || video.title);

  const id = `rerun-${Date.now()}`;
  const createdAt = now();

  channel.isOnline = true;
  channel.liveSessionId = shopeeLive.sessionId;
  channel.status = 'LIVE';
  channel.rtmpUrl = shopeeLive.pushUrl;
  channel.streamKey = shopeeLive.streamKey || '';
  channel.updatedAt = createdAt;

  const session: RerunSession & { apiPlan?: unknown } = {
    id,
    userId: demoUser.id,
    liveChannelId: channel.id,
    videoId: video.id,
    title: payload.title || video.title,
    status: 'LIVE',
    rtmpUrl: shopeeLive.pushUrl,
    streamKey: shopeeLive.streamKey,
    ffmpegPid: null,
    startedAt: createdAt,
    stoppedAt: null,
    durationSec: 0,
    errorMessage: null,
    createdAt,
    updatedAt: createdAt,
    liveChannel: channel,
    video,
    apiPlan: {
      mode: 'shopee-live-api',
      sessionId: shopeeLive.sessionId,
      shareUrl: shopeeLive.shareUrl || null,
      createFlow: ['ตรวจ cookie Shopee', 'สร้าง Shopee Live session', 'ดึง push URL', 'ffmpeg pushes selected video'],
    },
  };

  sessions.unshift(session);
  startVideoPush(session, channel, video);
  if (session.status === 'FAILED') {
    channel.isOnline = false;
    channel.liveSessionId = null;
    channel.updatedAt = now();
    throw new Error(session.errorMessage || 'ดันวิดีโอไม่สำเร็จ');
  }
  return session;
}

function buildTransientChannel(payload: Partial<LiveChannel>, fallbackId?: string): LiveChannel {
  const createdAt = now();
  const id = payload.id || fallbackId || `channel-${Date.now()}`;
  return {
    id,
    userId: payload.userId || demoUser.id,
    name: payload.name || payload.accountName || 'Shopee Account',
    isOnline: Boolean(payload.isOnline),
    platform: payload.platform || 'SHOPEE',
    accountName: payload.accountName || payload.name || 'Shopee Account',
    shopId: payload.shopId || null,
    platformUid: payload.platformUid || payload.shopId || null,
    avatar: payload.avatar || '/icons/shopee.png',
    status: payload.status || 'READY',
    cookie: payload.cookie || null,
    cookieValid: payload.cookieValid ?? Boolean(payload.cookie),
    rtmpUrl: payload.rtmpUrl || null,
    streamKey: payload.streamKey || null,
    coverImageUrl: payload.coverImageUrl || null,
    liveSessionId: payload.liveSessionId || null,
    basketLinks: payload.basketLinks || '',
    basketItemsJson: payload.basketItemsJson || '[]',
    caption: payload.caption || 'Shopee Live จากเว็บ',
    description: payload.description || payload.caption || 'รอบทดสอบขึ้นไลฟ์',
    autoLive: Boolean(payload.autoLive),
    liveDurationMinutes: Number(payload.liveDurationMinutes || 60),
    restartDelayMinutes: Number(payload.restartDelayMinutes || 5),
    lastCheckedAt: payload.lastCheckedAt || createdAt,
    createdAt: payload.createdAt || createdAt,
    updatedAt: createdAt,
  };
}

function buildTransientVideo(payload: Partial<VideoItem>, liveChannelId?: string | null): VideoItem {
  const createdAt = now();
  const title = payload.title || 'วิดีโอใหม่';
  const sourceUrl = payload.sourceUrl || payload.fileKey || null;
  return {
    id: payload.id || `video-${Date.now()}`,
    userId: payload.userId || demoUser.id,
    liveChannelId: liveChannelId || payload.liveChannelId || null,
    title,
    status: payload.status || 'READY',
    sourceUrl,
    hlsUrl: payload.hlsUrl || null,
    fileKey: payload.fileKey || sourceUrl?.split(/[\\/]/).pop() || `${title}.mp4`,
    durationSec: payload.durationSec || 0,
    sizeMb: payload.sizeMb ?? null,
    createdAt: payload.createdAt || createdAt,
    updatedAt: createdAt,
    liveChannel: liveChannelId
      ? {
          id: liveChannelId,
          name: payload.liveChannel?.name || 'Shopee Account',
          isOnline: Boolean(payload.liveChannel?.isOnline),
        }
      : null,
  };
}

export function stopSession(id: string) {
  const session = sessions.find((item) => item.id === id);
  if (!session) throw new Error('ไม่พบงานไลฟ์นี้');

  const stoppedAt = now();
  session.status = 'ENDED';
  session.stoppedAt = stoppedAt;
  session.updatedAt = stoppedAt;

  const channel = channels.find((item) => item.id === session.liveChannelId);
  if (channel) {
    channel.isOnline = false;
    channel.status = 'NOTLIVE';
    channel.updatedAt = stoppedAt;
  }

  const child = pushProcesses.get(id);
  if (child && !child.killed) child.kill('SIGTERM');
  pushProcesses.delete(id);

  return session;
}

function findFfmpeg() {
  const candidates = [
    process.env.FFMPEG_PATH,
    path.join(process.cwd(), '..', '..', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
    path.join(process.cwd(), '..', 'api', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
    path.join(process.cwd(), '..', '..', 'apps', 'api', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
    'ffmpeg',
  ].filter(Boolean) as string[];

  return candidates.find((candidate) => candidate === 'ffmpeg' || existsSync(candidate)) ?? null;
}

function resolveVideoPath(video: VideoItem) {
  const source = (video.sourceUrl || video.fileKey || '').trim();
  if (!source || /^https?:\/\//i.test(source)) return source;
  if (source.startsWith('/uploads/')) return path.join(process.cwd(), 'public', source);
  if (source.startsWith('local://')) return path.join(process.cwd(), 'public', 'uploads', source.replace('local://', ''));
  return path.isAbsolute(source) ? source : path.join(process.cwd(), 'public', source.replace(/^\/+/, ''));
}

export async function prepareVideoHls(videoId: string) {
  syncUploadedVideos();
  const video = videos.find((item) => item.id === videoId);
  if (!video) throw new Error('ไม่พบวิดีโอนี้');

  const ffmpeg = findFfmpeg();
  if (!ffmpeg) throw new Error('ไม่พบ ffmpeg สำหรับสร้างไฟล์ .m3u8');

  const input = resolveVideoPath(video);
  if (!input || /^https?:\/\//i.test(input) || !existsSync(input)) {
    throw new Error(`ต้องเป็นไฟล์วิดีโอในเครื่องเท่านั้น: ${input || '-'}`);
  }

  const streamId = video.id.replace(/[^\w.-]+/g, '_');
  const streamDir = path.join(process.cwd(), 'public', 'streams', streamId);
  mkdirSync(streamDir, { recursive: true });

  const playlistPath = path.join(streamDir, 'index.m3u8');
  const segmentPattern = path.join(streamDir, 'segment-%05d.ts');

  video.status = 'PROCESSING';
  video.updatedAt = now();

  const args = [
    '-y',
    '-i', input,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-g', '60',
    '-sc_threshold', '0',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_playlist_type', 'vod',
    '-hls_segment_filename', segmentPattern,
    playlistPath,
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpeg, args, { windowsHide: true, stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0 && existsSync(playlistPath)) resolve();
      else reject(new Error(`ffmpeg สร้าง .m3u8 ไม่สำเร็จ code=${code}`));
    });
  });

  video.hlsUrl = `/streams/${streamId}/index.m3u8`;
  video.status = 'READY';
  video.updatedAt = now();
  return video;
}

async function prepareShopeeApiLive(channel: LiveChannel, video: VideoItem, title: string): Promise<ShopeeLiveStartResult> {
  if (!channel.cookie) {
    throw new Error('บัญชียังไม่มี cookie/session สำหรับ Shopee API');
  }

  const live = await createShopeeMobileLiveSession(
    channel.cookie,
    title,
    channel.coverImageUrl,
    channel.description || channel.caption || video.title,
  );

  return {
    sessionId: live.liveSessionId,
    shareUrl: live.shareUrl,
    pushUrl: live.rtmpUrl,
    streamKey: live.streamKey,
    raw: { title, videoId: video.id, source: 'shopee-mobile-api', detail: live.raw },
  };
}

function parseCookie(raw: string): Record<string, string> {
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

function readInlineValue(raw: string, names: string[]): string {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?:^|[;\\r\\n])\\s*${escaped}\\s*[:=]\\s*([^;\\r\\n]+)`, 'i');
    const match = raw.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return '';
}

function isAllowedShopeeHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_SHOPEE_HOSTS.has(host) || host.endsWith('.shopee.co.th');
}

function safeShopeeUrl(rawUrl: string | undefined, label: string): string {
  if (!rawUrl?.trim()) throw new Error(`${label} ยังไม่ได้ตั้งค่า`);

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`${label} ไม่ใช่ URL ที่ถูกต้อง`);
  }

  if (url.protocol !== 'https:') throw new Error(`${label} ต้องเป็น https เท่านั้น`);
  if (!isAllowedShopeeHost(url.hostname)) throw new Error(`${label} ไม่อยู่ในโดเมน Shopee ที่อนุญาต: ${url.hostname}`);
  return url.toString();
}

function dataOf(payload: any) {
  return payload?.data ?? payload;
}

function readCookieDeviceId(jar: Record<string, string>, cookie: string): string {
  const value = jar.LIVE_STREAMING_UUID_KEY || jar.SPC_F || jar.SPC_CLIENTID || jar.SPC_U;
  return value && value.trim() ? value.trim() : stableId(cookie, 16);
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
      process.env.SHOPEE_USER_AGENT ||
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
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

async function shopeeJson<T = any>(url: string, init: RequestInit, label: string): Promise<T> {
  const resp = await fetch(url, init);
  const text = await resp.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text ? { message: text.slice(0, 500) } : null;
  }

  if (!resp.ok) {
    const message = data?.err_msg || data?.msg || data?.message || 'Shopee ปฏิเสธ request';
    throw new Error(`${label} ไม่สำเร็จ (${resp.status}): ${message}`);
  }

  const errCode = data?.err_code ?? data?.error;
  if (errCode !== undefined && errCode !== 0) {
    throw new Error(data?.err_msg || data?.msg || `${label} ไม่สำเร็จ`);
  }

  return data as T;
}

function readSessionId(payload: any): string | null {
  const data = dataOf(payload);
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
  const data = dataOf(payload);
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

function liveApiBases(): string[] {
  const explicitBases = (process.env.SHOPEE_LIVE_API_BASES || process.env.SHOPEE_LIVE_WEBAPI_BASE || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const bases = explicitBases.length ? explicitBases : DEFAULT_SHOPEE_LIVE_API_BASES;

  return Array.from(new Set(bases.map((base) => safeShopeeUrl(base, 'SHOPEE_LIVE_API_BASES').replace(/\/+$/, ''))));
}

function liveSessionBootstrapUrls(base: string, cookie: string): string[] {
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

function readPushUrl(payload: any): string | null {
  const data = dataOf(payload);
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
  const value = candidates.find((item) => typeof item === 'string' && item.trim());
  if (value) return String(value);

  return findStringValue(data, (item, key) => {
    const lowerKey = key.toLowerCase();
    const lowerValue = item.toLowerCase();
    return (
      lowerValue.startsWith('rtmp://') ||
      lowerValue.startsWith('rtmps://') ||
      lowerKey.includes('pushurl') ||
      lowerKey.includes('push_url') ||
      lowerKey.includes('rtmp')
    );
  });
}

function stableJson(data: unknown): string {
  return JSON.stringify(data, Object.keys(data as Record<string, unknown>).sort());
}

function coverPayloadForShopee(coverImageUrl?: string | null): string {
  const cover = coverImageUrl?.trim();
  if (!cover) return '';

  const maxDataUrlLength = Number(process.env.SHOPEE_MAX_COVER_DATA_URL_LENGTH || 220_000);
  if (cover.startsWith('data:')) {
    return cover.length <= maxDataUrlLength ? cover : '';
  }

  return cover;
}

function splitShopeePushUrl(pushUrl: string): { rtmpUrl: string; streamKey: string } {
  try {
    const marker = pushUrl.includes('/livestreaming/') ? '/livestreaming/' : '/live/';
    const markerIndex = pushUrl.indexOf(marker);
    if (markerIndex === -1) return { rtmpUrl: pushUrl, streamKey: '' };

    const server = pushUrl.slice(0, markerIndex + marker.length);
    const key = pushUrl.slice(markerIndex + marker.length);
    return { rtmpUrl: server, streamKey: key };
  } catch {
    return { rtmpUrl: pushUrl, streamKey: '' };
  }
}

async function createShopeeMobileLiveSession(
  _cookie: string,
  _title: string,
  _coverImageUrl?: string | null,
  _descriptionText?: string | null,
): Promise<{ liveSessionId: string; shareUrl: string; rtmpUrl: string; streamKey: string; raw: unknown }> {
  throw new Error(
    'Shopee Live ใช้ session ที่สร้างจากมือถือเท่านั้น: เปิด Shopee บนมือถือ กดปุ่ม Live ให้ถึงหน้าตั้งค่าห้อง แล้วกดขึ้นไลฟ์ในระบบนี้อีกครั้ง',
  );
}

function buildPushTarget(pushUrl?: string | null, streamKey?: string | null) {
  const url = (pushUrl || '').trim();
  const key = (streamKey || '').trim();
  if (!url) return null;
  if (!key) return url;
  if (url.includes(key)) return url;
  if (url.endsWith('/')) return `${url}${key}`;
  return `${url}/${key}`;
}

function startVideoPush(session: RerunSession, channel: LiveChannel, video: VideoItem) {
  const ffmpeg = findFfmpeg();
  const input = resolveVideoPath(video);
  const target = buildPushTarget(session.rtmpUrl, session.streamKey);

  if (!ffmpeg) {
    session.status = 'FAILED';
    session.errorMessage = 'ไม่พบ ffmpeg สำหรับดันวิดีโอ';
    channel.isOnline = false;
    channel.status = 'FAILED';
    return;
  }

  if (!input || (!/^https?:\/\//i.test(input) && !existsSync(input))) {
    session.status = 'FAILED';
    session.errorMessage = `ไม่พบไฟล์วิดีโอจริง: ${input || '-'}`;
    channel.isOnline = false;
    channel.status = 'FAILED';
    return;
  }

  if (!target) {
    session.status = 'FAILED';
    session.errorMessage = 'Shopee API ยังไม่ได้คืน push URL สำหรับดันวิดีโอ';
    channel.isOnline = false;
    channel.status = 'FAILED';
    return;
  }

  const args = [
    '-hide_banner',
    '-loglevel', 'info',
    '-re',
    '-stream_loop', '-1',
    '-i', input,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-profile:v', 'baseline',
    '-level:v', '3.1',
    '-pix_fmt', 'yuv420p',
    '-vf', 'scale=w=min(1280\\,iw):h=-2:force_original_aspect_ratio=decrease,fps=30',
    '-g', '60',
    '-keyint_min', '60',
    '-sc_threshold', '0',
    '-b:v', '2500k',
    '-maxrate', '2500k',
    '-bufsize', '5000k',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-f', 'flv',
    target,
  ];

  const child = spawn(ffmpeg, args, { windowsHide: true, stdio: 'ignore' });
  pushProcesses.set(session.id, child);
  session.ffmpegPid = child.pid ?? null;

  child.on('exit', (code) => {
    pushProcesses.delete(session.id);
    if (session.status === 'LIVE') {
      session.status = code === 0 ? 'ENDED' : 'FAILED';
      session.errorMessage = code === 0 ? null : `ffmpeg หยุดทำงาน code=${code}`;
      session.stoppedAt = now();
      session.updatedAt = now();
      channel.isOnline = false;
      channel.status = session.status;
      channel.updatedAt = now();
    }
  });
}

export function createVideo(payload: CreateVideoPayload & { fileName?: string | null; sizeMb?: number | null }) {
  const createdAt = now();
  const channel = channels.find((item) => item.id === payload.liveChannelId);
  const fileName = payload.fileName || payload.sourceUrl?.split('/').pop() || `${payload.title}.mp4`;
  const sourceUrl = payload.sourceUrl || `local://${fileName}`;

  const video: VideoItem = {
    id: `video-${Date.now()}`,
    userId: demoUser.id,
    liveChannelId: payload.liveChannelId || null,
    title: payload.title,
    status: 'READY',
    sourceUrl,
    hlsUrl: null,
    fileKey: fileName,
    durationSec: 0,
    sizeMb: payload.sizeMb ?? null,
    createdAt,
    updatedAt: createdAt,
    liveChannel: channel
      ? {
          id: channel.id,
          name: channel.name,
          isOnline: channel.isOnline,
        }
      : null,
  };

  videos.unshift(video);
  return video;
}

export function syncUploadedVideos() {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  if (!existsSync(uploadDir)) return videos;

  for (const entry of readdirSync(uploadDir)) {
    if (!/\.(mp4|mov|m4v|flv)$/i.test(entry)) continue;
    const sourceUrl = `/uploads/${entry}`;
    if (videos.some((item) => item.sourceUrl === sourceUrl || item.fileKey === entry)) continue;

    const fullPath = path.join(uploadDir, entry);
    const stat = statSync(fullPath);
    const createdAt = stat.birthtime?.toISOString?.() || now();
    const title = entry.replace(/^\d+-/, '').replace(/\.(mp4|mov|m4v|flv)$/i, '') || entry;

    videos.unshift({
      id: `video-upload-${entry.replace(/[^\w.-]+/g, '_')}`,
      userId: demoUser.id,
      liveChannelId: null,
      title,
      status: 'READY',
      sourceUrl,
      hlsUrl: existsSync(path.join(process.cwd(), 'public', 'streams', `video-upload-${entry.replace(/[^\w.-]+/g, '_')}`, 'index.m3u8'))
        ? `/streams/video-upload-${entry.replace(/[^\w.-]+/g, '_')}/index.m3u8`
        : null,
      fileKey: entry,
      durationSec: 0,
      sizeMb: Number((stat.size / 1024 / 1024).toFixed(2)),
      createdAt,
      updatedAt: stat.mtime?.toISOString?.() || createdAt,
      liveChannel: null,
    });
  }

  const firstReady = videos.find((item) => item.status === 'READY');
  const defaultChannel = channels[0];
  if (defaultChannel && firstReady && !videos.some((item) => item.liveChannelId === defaultChannel.id)) {
    firstReady.liveChannelId = defaultChannel.id;
    firstReady.liveChannel = {
      id: defaultChannel.id,
      name: defaultChannel.name,
      isOnline: defaultChannel.isOnline,
    };
    defaultChannel.caption = firstReady.title;
  }

  return videos;
}

export function updateChannel(id: string, payload: Record<string, unknown>, selectedVideoId?: string | null) {
  const channel = channels.find((item) => item.id === id);
  if (!channel) throw new Error('ไม่พบบัญชีนี้');

  Object.assign(channel, payload, { updatedAt: now() });

  if (selectedVideoId) {
    const selected = videos.find((item) => item.id === selectedVideoId);
    if (selected) {
      selected.liveChannelId = channel.id;
      selected.liveChannel = { id: channel.id, name: channel.name, isOnline: channel.isOnline };
      channel.caption = selected.title;
    }
  }

  return channel;
}

export function authSession(): AuthSession {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: demoUser,
  };
}

