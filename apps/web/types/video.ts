export type VideoStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export type VideoLiveChannel = {
  id: string;
  name: string;
  isOnline: boolean;
};

export type VideoItem = {
  id: string;
  userId: string;
  liveChannelId?: string | null;
  title: string;
  status: VideoStatus;
  sourceUrl?: string | null;
  hlsUrl?: string | null;
  fileKey?: string | null;
  durationSec?: number | null;
  sizeMb?: number | null;
  createdAt: string;
  updatedAt: string;
  liveChannel?: VideoLiveChannel | null;
  uploadProgress?: number;
};

export type VideoUsage = {
  used: number;
  limit: number;
  remaining: number;
  canCreate: boolean;
  maxFileSizeGb?: number;
  maxFileSizeBytes?: number;
};

export type CreateVideoPayload = {
  title: string;
  liveChannelId?: string | null;
  sourceUrl?: string | null;
  file?: File | null;
  onUploadProgress?: (progress: number) => void;
};

export type UpdateVideoPayload = {
  title?: string;
  liveChannelId?: string | null;
  sourceUrl?: string | null;
};

export type UpdateVideoStatusPayload = {
  status: VideoStatus;
};

export type ConvertVideoPayload = Record<string, never>;

export type Video = VideoItem;
