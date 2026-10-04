import { apiData, tokens } from '../../_mock/store';

export async function POST() {
  return apiData(tokens);
}
