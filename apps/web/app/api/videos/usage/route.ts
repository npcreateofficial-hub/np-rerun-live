import { apiData, videos } from '../../_mock/store';

export async function GET() {
  const limit = 10;
  const used = videos.length;
  return apiData({ used, limit, remaining: Math.max(limit - used, 0), canUpload: used < limit });
}
