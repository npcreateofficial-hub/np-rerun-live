import { apiData, demoUser } from '../../_mock/store';

export async function GET() {
  return apiData(demoUser);
}
