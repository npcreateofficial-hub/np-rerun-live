import { apiData, apiError, channels, syncUploadedVideos, videos } from '../../_mock/store';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  syncUploadedVideos();
  const video = videos.find((item) => item.id === params.id);
  if (!video) return apiError('ไม่พบวิดีโอนี้', 404);
  return apiData(video);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const payload = await request.json().catch(() => ({}));
    syncUploadedVideos();
    const video = videos.find((item) => item.id === params.id);
    if (!video) return apiError('ไม่พบวิดีโอนี้', 404);

    if (typeof payload.title === 'string' && payload.title.trim()) video.title = payload.title.trim();
    if ('sourceUrl' in payload) video.sourceUrl = payload.sourceUrl || video.sourceUrl;
    if ('liveChannelId' in payload) {
      video.liveChannelId = payload.liveChannelId || null;
      const channel = channels.find((item) => item.id === video.liveChannelId);
      video.liveChannel = channel ? { id: channel.id, name: channel.name, isOnline: channel.isOnline } : null;
      if (channel) channel.caption = video.title;
    }

    video.updatedAt = new Date().toISOString();
    return apiData(video);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'แก้วิดีโอไม่สำเร็จ', 400);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  syncUploadedVideos();
  const index = videos.findIndex((item) => item.id === params.id);
  if (index >= 0) videos.splice(index, 1);
  return apiData({ deleted: index >= 0 });
}
