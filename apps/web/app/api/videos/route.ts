import { apiData, createVideo, syncUploadedVideos } from '../_mock/store';

export async function GET() {
  return apiData(syncUploadedVideos());
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  return apiData(createVideo({
    title: payload.title || 'วิดีโอใหม่',
    sourceUrl: payload.sourceUrl || null,
    liveChannelId: payload.liveChannelId || null,
    file: null,
  }));
}
