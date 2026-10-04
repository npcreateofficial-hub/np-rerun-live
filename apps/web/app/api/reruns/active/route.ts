import { apiData, sessions } from '../../_mock/store';

export async function GET() {
  return apiData(sessions.filter((item) => item.status === 'LIVE' || item.status === 'STARTING'));
}
