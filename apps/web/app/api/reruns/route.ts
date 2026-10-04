import { apiData, sessions } from '../_mock/store';

export async function GET() {
  return apiData(sessions);
}
