import { apiData } from '../_mock/store';

export async function GET() {
  return apiData([]);
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const createdAt = new Date().toISOString();
  return apiData({
    id: `proxy-${Date.now()}`,
    host: payload.host || '127.0.0.1',
    port: Number(payload.port || 8080),
    username: payload.username || null,
    password: payload.password || null,
    note: payload.note || null,
    status: 'UNKNOWN',
    checkedAt: null,
    createdAt,
    updatedAt: createdAt,
  });
}
