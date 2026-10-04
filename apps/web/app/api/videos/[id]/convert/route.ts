import { apiData, apiError, syncUploadedVideos, videos } from '../../../_mock/store';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  syncUploadedVideos();
  const video = videos.find((item) => item.id === params.id);
  if (!video) return apiError('ไม่พบวิดีโอนี้', 404);
  video.status = 'READY';
  video.updatedAt = new Date().toISOString();
  return apiData(video);
}
