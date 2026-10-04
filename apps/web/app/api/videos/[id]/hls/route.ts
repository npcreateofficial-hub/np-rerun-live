import { apiData, apiError, prepareVideoHls } from '../../../_mock/store';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const video = await prepareVideoHls(params.id);
    return apiData({
      id: video.id,
      hlsUrl: video.hlsUrl,
      sourceUrl: video.sourceUrl,
      status: video.status,
    });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'สร้างไฟล์ .m3u8 ไม่สำเร็จ', 400);
  }
}
