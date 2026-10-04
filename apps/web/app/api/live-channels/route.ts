import { apiData, channels, syncUploadedVideos } from '../_mock/store';

export async function GET() {
  syncUploadedVideos();
  for (const channel of channels) {
    if (!channel.isOnline && channel.status === 'FAILED') channel.liveSessionId = null;
  }
  return apiData(channels);
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const createdAt = new Date().toISOString();
  const channel = {
    id: `channel-${Date.now()}`,
    userId: 'user-demo',
    name: payload.accountName || payload.name || 'Shopee Account',
    isOnline: false,
    platform: payload.platform || 'SHOPEE',
    accountName: payload.accountName || payload.username || 'Shopee Account',
    shopId: payload.shopId || null,
    platformUid: payload.platformUid || payload.shopId || null,
    avatar: '/icons/shopee.png',
    status: 'READY',
    cookie: payload.cookie || null,
    cookieValid: Boolean(payload.cookie || payload.sessionId || payload.liveUrl),
    coverImageUrl: payload.coverImageUrl || null,
    liveSessionId: payload.liveSessionId || null,
    basketLinks: payload.basketLinks || '',
    basketItemsJson: payload.basketItemsJson || '[]',
    caption: payload.caption || payload.title || 'Shopee Live จากเว็บ',
    description: payload.description || payload.caption || payload.title || 'รอบทดสอบขึ้นไลฟ์',
    autoLive: Boolean(payload.autoLive),
    liveDurationMinutes: Number(payload.liveDurationMinutes || 60),
    restartDelayMinutes: Number(payload.restartDelayMinutes || 5),
    lastCheckedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  };

  channels.unshift(channel);
  return apiData(channel);
}
