import { apiData } from '../../_mock/store';

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const hasCookie = Boolean(payload.cookie || payload.sessionId || payload.liveUrl);

  return apiData({
    valid: hasCookie,
    platform: payload.platform || 'SHOPEE',
    accountName: 'npcreatemarketing',
    name: 'npcreatemarketing',
    shopId: '43988129',
    userId: '43988129',
    platformUid: '43988129',
    username: 'npcreatemarketing',
    avatar: '/icons/shopee.png',
    source: 'mock-shopee-api',
    message: hasCookie ? 'พร้อมตรวจผ่าน Shopee API' : 'ต้องใส่ cookie/session ก่อน',
  });
}
