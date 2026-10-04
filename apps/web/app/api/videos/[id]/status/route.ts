import { apiData, apiError, syncUploadedVideos, videos } from '../../../_mock/store';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const payload = await request.json().catch(() => ({}));
  syncUploadedVideos();
  const video = videos.find((item) => item.id === params.id);
  if (!video) return apiError('ไม่พบวิดีโอนี้', 404);
  video.status = payload.status || video.status;
  video.updatedAt = new Date().toISOString();
  return apiData(video);
}
