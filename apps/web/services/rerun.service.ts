import { api } from '@/lib/api';
import type {
  RerunLiveChannel,
  RerunSession,
  RerunUsage,
  RerunVideo,
  StartRerunPayload,
} from '@/types/rerun';

function normalizeArray<T>(value: T[] | { items?: T[]; data?: T[] } | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

export const rerunService = {
  async usage() {
    return api<RerunUsage>('/reruns/usage');
  },

  async list() {
    const data = await api<RerunSession[] | { items?: RerunSession[]; data?: RerunSession[] }>('/reruns');
    return normalizeArray(data);
  },

  async active() {
    const data = await api<RerunSession[] | RerunSession | { items?: RerunSession[]; data?: RerunSession[] }>('/reruns/active');
    if (Array.isArray(data)) return data;
    if (data && 'items' in data && Array.isArray(data.items)) return data.items;
    if (data && 'data' in data && Array.isArray(data.data)) return data.data;
    if (data && 'id' in data) return [data as RerunSession];
    return [];
  },


  start(payload: StartRerunPayload) {
    return api<RerunSession>('/reruns/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  stop(id: string, options?: { manual?: boolean }) {
    return api<RerunSession>(`/reruns/${id}/stop`, {
      method: 'POST',
      body: JSON.stringify(options ?? {}),
    });
  },

  remove(id: string) {
    return api<{ deleted: boolean }>(`/reruns/${id}`, { method: 'DELETE' });
  },

  async liveChannels() {
    const data = await api<RerunLiveChannel[] | { items?: RerunLiveChannel[]; data?: RerunLiveChannel[] }>('/live-channels');
    return normalizeArray(data);
  },

  async videos() {
    const data = await api<RerunVideo[] | { items?: RerunVideo[]; data?: RerunVideo[] }>('/videos');
    return normalizeArray(data);
  },

};
