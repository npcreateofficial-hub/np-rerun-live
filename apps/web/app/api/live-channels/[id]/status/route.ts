import { apiData, apiError, channels, createSession, sessions, stopSession, syncUploadedVideos, videos } from '../../../_mock/store';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const payload = await request.json().catch(() => ({}));
    const channel = channels.find((item) => item.id === params.id);
    if (!channel) return apiError('ไม่พบบัญชีนี้', 404);

    if (payload.isOnline) {
      syncUploadedVideos();
      const video = videos.find((item) => item.liveChannelId === channel.id && item.status === 'READY') || videos.find((item) => item.status === 'READY');
      if (!video) return apiError('ยังไม่มีวิดีโอ READY สำหรับดันขึ้นไลฟ์', 400);
      return apiData(await createSession({ liveChannelId: channel.id, videoId: video.id, title: channel.caption || video.title }));
    }

    const active = sessions.find((item) => item.liveChannelId === channel.id && item.status === 'LIVE');
    if (active) stopSession(active.id);
    channel.isOnline = false;
    channel.status = 'NOTLIVE';
    channel.updatedAt = new Date().toISOString();
    return apiData(channel);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'เปลี่ยนสถานะไม่สำเร็จ', 400);
  }
}
