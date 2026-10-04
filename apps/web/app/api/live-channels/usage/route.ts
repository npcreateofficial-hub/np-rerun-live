import { apiData, channels } from '../../_mock/store';

export async function GET() {
  const limit = 10;
  const used = channels.length;
  return apiData({ used, limit, remaining: Math.max(limit - used, 0), canCreate: used < limit });
}
