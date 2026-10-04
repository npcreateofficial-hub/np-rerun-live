import { api } from '@/lib/api';
import { API_BASE_URL } from '@/lib/constants';
import { getAccessToken } from '@/lib/auth';
import { ApiError, type ApiResponse } from '@/types/api';
import type {
  ConvertVideoPayload,
  CreateVideoPayload,
  UpdateVideoPayload,
  UpdateVideoStatusPayload,
  VideoItem,
  VideoUsage,
} from '@/types/video';

async function parseVideoResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      const message = text.trim().slice(0, 300) || `API error ${response.status}`;
      throw new ApiError(message, response.status, { raw: text });
    }
  }

  if (!response.ok) {
    const rawMessage = payload && typeof payload === 'object' && 'message' in payload ? payload.message : `API error ${response.status}`;
    const message = Array.isArray(rawMessage) ? rawMessage.map(String).join(', ') : String(rawMessage);
    throw new ApiError(message, response.status, payload);
  }

  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return (payload as ApiResponse<T>).data;
  }

  return payload as T;
}

const CHUNK_SIZE = 25 * 1024 * 1024;
const MAX_CHUNK_RETRIES = 3;

type ChunkInitResponse = {
  uploadId: string;
  receivedChunks: number[];
  chunkSize: number;
  totalChunks: number;
};

function authedHeaders(extra?: HeadersInit) {
  const headers = new Headers(extra);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

async function uploadChunk(uploadId: string, index: number, chunk: Blob) {
  let attempt = 0;

  while (attempt < MAX_CHUNK_RETRIES) {
    attempt += 1;
    const response = await fetch(`${API_BASE_URL}/videos/uploads/${uploadId}/chunks/${index}`, {
      method: 'POST',
      headers: authedHeaders({ 'Content-Type': 'application/octet-stream' }),
      body: chunk,
    });

    if (response.ok) return parseVideoResponse<unknown>(response);
    if (attempt >= MAX_CHUNK_RETRIES || response.status < 500) return parseVideoResponse<unknown>(response);
    await new Promise((resolve) => setTimeout(resolve, 650 * attempt));
  }
}

async function uploadVideoFile(payload: CreateVideoPayload) {
  const file = payload.file;
  if (!file) throw new ApiError('ไม่พบไฟล์วิดีโอ', 400);

  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const initResponse = await fetch(`${API_BASE_URL}/videos/uploads/init`, {
    method: 'POST',
    headers: authedHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      title: payload.title,
      fileName: file.name,
      fileSize: file.size,
      chunkSize: CHUNK_SIZE,
      totalChunks,
      mimeType: file.type,
      liveChannelId: payload.liveChannelId || null,
    }),
  });

  const init = await parseVideoResponse<ChunkInitResponse>(initResponse);
  const uploaded = new Set(init.receivedChunks);
  payload.onUploadProgress?.(Math.round((uploaded.size / totalChunks) * 100));

  for (let index = 0; index < totalChunks; index += 1) {
    if (uploaded.has(index)) continue;
    const start = index * CHUNK_SIZE;
    const end = Math.min(file.size, start + CHUNK_SIZE);
    await uploadChunk(init.uploadId, index, file.slice(start, end));
    uploaded.add(index);
    payload.onUploadProgress?.(Math.round((uploaded.size / totalChunks) * 100));
  }

  const completeResponse = await fetch(`${API_BASE_URL}/videos/uploads/${init.uploadId}/complete`, {
    method: 'POST',
    headers: authedHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({}),
  });

  return parseVideoResponse<VideoItem>(completeResponse);
}

export const videoService = {
  usage() {
    return api<VideoUsage>('/videos/usage');
  },

  list() {
    return api<VideoItem[]>('/videos');
  },

  get(id: string) {
    return api<VideoItem>(`/videos/${id}`);
  },

  create(payload: CreateVideoPayload) {
    if (payload.file) return uploadVideoFile(payload);

    return api<VideoItem>('/videos', {
      method: 'POST',
      body: JSON.stringify({
        title: payload.title,
        sourceUrl: payload.sourceUrl,
        liveChannelId: payload.liveChannelId,
      }),
    });
  },

  update(id: string, payload: UpdateVideoPayload) {
    return api<VideoItem>(`/videos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  updateStatus(id: string, payload: UpdateVideoStatusPayload) {
    return api<VideoItem>(`/videos/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  convert(id: string, payload: ConvertVideoPayload = {}) {
    return api<VideoItem>(`/videos/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  prepareHls(id: string) {
    return api<{ id: string; hlsUrl: string | null; sourceUrl: string | null; status: VideoItem['status'] }>(`/videos/${id}/hls`, {
      method: 'POST',
    });
  },

  remove(id: string) {
    return api<{ deleted: boolean }>(`/videos/${id}`, {
      method: 'DELETE',
    });
  },
};
