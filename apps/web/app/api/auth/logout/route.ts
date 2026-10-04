import { apiData } from '../../_mock/store';

export async function POST() {
  return apiData({ loggedOut: true });
}
