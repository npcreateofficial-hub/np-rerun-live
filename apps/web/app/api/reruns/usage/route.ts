import { apiData, sessions } from '../../_mock/store';

export async function GET() {
  const active = sessions.filter((item) => item.status === 'LIVE' || item.status === 'STARTING').length;
  const limit = 1;
  return apiData({ active, used: active, limit, remaining: Math.max(limit - active, 0), canStart: active < limit });
}
