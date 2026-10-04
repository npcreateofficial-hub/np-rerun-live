import { apiData, apiError, channels, syncUploadedVideos, updateChannel } from '../../_mock/store';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  syncUploadedVideos();
  const channel = channels.find((item) => item.id === params.id);
  if (!channel) return apiError('ไม่พบบัญชีนี้', 404);
  return apiData(channel);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const payload = await request.json().catch(() => ({}));
    const selectedVideoId = payload.selectedVideoId ?? payload.videoId ?? null;
    delete payload.selectedVideoId;
    delete payload.videoId;
    return apiData(updateChannel(params.id, payload, selectedVideoId));
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'แก้ไขบัญชีไม่สำเร็จ', 400);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const index = channels.findIndex((item) => item.id === params.id);
  if (index >= 0) channels.splice(index, 1);
  return apiData({ deleted: index >= 0 });
}
