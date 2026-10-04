export type StorageUsage = {
  usedBytes: number;
  usedGb: number;
  totalGb: number;
  totalBytes: number;
  percent: number;
  remainingBytes: number;
  maxFileSizeGb?: number;
  maxFileSizeBytes?: number;
  fileCount: number;
  folderCount: number;
};

export type StorageFolder = {
  id: string;
  name: string;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StorageFile = {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType?: string | null;
  url?: string | null;
  folderId?: string | null;
  folder?: StorageFolder | null;
  createdAt: string;
  updatedAt: string;
};
