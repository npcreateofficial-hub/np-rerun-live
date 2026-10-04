import { apiData, sessions } from '../_mock/store';

export async function GET() {
  return apiData([
    {
      id: 'shopee-api-live-1',
      status: 'READY',
      currentSessionId: sessions.find((item) => item.status === 'LIVE')?.id ?? null,
      heartbeat: new Date().toISOString(),
      capabilities: ['shopee-cookie-check', 'create-live-session', 'read-push-url', 'ffmpeg-push'],
    },
  ]);
}
