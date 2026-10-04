export type RerunStatus = 'STARTING' | 'LIVE' | 'STOPPING' | 'ENDED' | 'FAILED';
export type VideoStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export type RerunLiveChannel = {
  id: string;
  name: string;
  isOnline: boolean;
  platform?: string | null;
  accountName?: string | null;
  shopId?: string | null;
  platformUid?: string | null;
  avatar?: string | null;
  cookie?: string | null;
  cookieValid?: boolean | null;
  coverImageUrl?: string | null;
  liveSessionId?: string | null;
  caption?: string | null;
  description?: string | null;
  basketLinks?: string | null;
  basketItemsJson?: string | null;
};

export type RerunVideo = {
  id: string;
  title: string;
  status: VideoStatus;
  sourceUrl?: string | null;
  fileKey?: string | null;
};

export type RerunSession = {
  id: string;
  userId: string;
  liveChannelId: string;
  videoId: string;
  title: string;
  status: RerunStatus;
  rtmpUrl?: string | null;
  streamKey?: string | null;
  ffmpegPid?: number | null;
  startedAt?: string | null;
  stoppedAt?: string | null;
  durationSec?: number | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  liveChannel?: RerunLiveChannel | null;
  video?: RerunVideo | null;
};

export type RerunUsage = {
  active?: number;
  used?: number;
  limit: number;
  remaining: number;
  canStart: boolean;
};

export type StartRerunPayload = {
  liveChannelId?: string;
  accountId?: string;
  videoId?: string;
  title?: string;
  liveChannel?: RerunLiveChannel | null;
  account?: RerunLiveChannel | null;
  video?: RerunVideo | null;
};
