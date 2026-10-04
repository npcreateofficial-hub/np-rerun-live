import { api } from '@/lib/api';
import type { StorageFile, StorageFolder, StorageUsage } from '@/types/storage';

export const storageService = {
  usage() {
    return api<StorageUsage>('/storage/usage');
  },

  folders() {
    return api<StorageFolder[]>('/storage/folders');
  },

  createFolder(name: string) {
    return api<StorageFolder>('/storage/folders', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  files() {
    return api<StorageFile[]>('/storage/files');
  },

  addFile(payload: { name: string; sizeBytes: number; mimeType?: string; folderId?: string }) {
    return api<StorageFile>('/storage/files', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteFile(id: string) {
    return api<{ success: true }>(`/storage/files/${id}`, {
      method: 'DELETE',
    });
  },
};
