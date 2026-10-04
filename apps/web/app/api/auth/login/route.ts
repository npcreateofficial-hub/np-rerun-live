import { apiData, authSession } from '../../_mock/store';

export async function POST() {
  return apiData(authSession());
}
