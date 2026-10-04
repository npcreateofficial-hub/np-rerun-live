import type { AuthUser } from './auth';

export type PackageItem = {
  id: string;
  name: string;
  code: string;
  category?: 'STARTER' | 'PRO' | 'PROMAX' | 'ULTRA_PRO' | string;
  description?: string | null;
  priceBaht: number | string;
  durationDays: number;
  maxAccounts: number;
  maxLiveChannels: number;
  maxVideos: number;
  storageGb: number;
  maxProxies: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type PackageUsageItem = {
  used: number;
  total: number;
};

export type CurrentPackage = {
  package: PackageItem | null;
  startedAt?: string | null;
  expiresAt?: string | null;
  daysLeft?: number | null;
  usage?: {
    storage?: PackageUsageItem;
    accounts?: PackageUsageItem;
    proxy?: PackageUsageItem;
    live?: PackageUsageItem;
    videos?: PackageUsageItem;
  };
};

export type SelectPackageResult = {
  message: string;
  user?: AuthUser & {
    packageId?: string | null;
    packageExpiresAt?: string | null;
    package?: PackageItem | null;
  };
  package?: PackageItem;
  current?: CurrentPackage;
};
