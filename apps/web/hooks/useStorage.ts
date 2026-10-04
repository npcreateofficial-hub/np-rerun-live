'use client';

import { useCallback, useEffect, useState } from 'react';
import { storageService } from '@/services/storage.service';
import type { StorageFile, StorageFolder, StorageUsage } from '@/types/storage';

type State = {
  usage: StorageUsage | null;
  folders: StorageFolder[];
  files: StorageFile[];
  loading: boolean;
  error: string | null;
};

export function useStorage() {
  const [state, setState] = useState<State>({
    usage: null,
    folders: [],
    files: [],
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const [usage, folders, files] = await Promise.all([
        storageService.usage(),
        storageService.folders(),
        storageService.files(),
      ]);

      setState({ usage, folders, files, loading: false, error: null });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'โหลดข้อมูลพื้นที่จัดเก็บไม่สำเร็จ',
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createFolder = async (name: string) => {
    await storageService.createFolder(name);
    await refresh();
  };

  const addFileMeta = async (file: File) => {
    await storageService.addFile({
      name: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
    });
    await refresh();
  };

  const deleteFile = async (id: string) => {
    await storageService.deleteFile(id);
    await refresh();
  };

  return {
    ...state,
    refresh,
    createFolder,
    addFileMeta,
    deleteFile,
  };
}
