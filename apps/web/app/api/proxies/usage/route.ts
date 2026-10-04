import { apiData } from '../../_mock/store';

export async function GET() {
  return apiData({ used: 0, limit: 10, remaining: 10, canCreate: true });
}
