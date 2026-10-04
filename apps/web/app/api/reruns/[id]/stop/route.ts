import { apiData, apiError, stopSession } from '../../../_mock/store';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    return apiData(stopSession(params.id));
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'หยุดไลฟ์ไม่สำเร็จ', 400);
  }
}
