import { apiData, apiError, createSession, syncUploadedVideos } from '../../_mock/store';

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    syncUploadedVideos();
    return apiData(await createSession(payload));
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'เริ่มไลฟ์ไม่สำเร็จ', 400);
  }
}
