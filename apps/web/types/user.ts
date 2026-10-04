import type { AuthUser } from './auth';
import type { PackageItem } from './package';

export type UsageSummary = {
  accounts: number;
  liveChannels: number;
  videos: number;
  proxies: number;
  storageGb: number;
};

export type PackageLimits = {
  accounts: number;
  liveChannels: number;
  videos: number;
  proxies: number;
  storageGb: number;
};

export type UserPermissions = {
  package: {
    id: string | null;
    code: string;
    name: string;
    startedAt?: string | null;
    expiresAt?: string | null;
    daysLeft?: number | null;
    limits: PackageLimits;
  };
  usage: UsageSummary;
  canCreate: {
    account: boolean;
    liveChannel: boolean;
    proxy: boolean;
    video: boolean;
    storage: boolean;
  };
};

export type UserProfile = AuthUser & {
  credit?: number;
  packageId?: string | null;
  packageStartedAt?: string | null;
  packageExpiresAt?: string | null;
  package?: PackageItem | null;
  usage?: UsageSummary;
  permissions?: UserPermissions;
};

export type UpdateProfilePayload = {
  username?: string;
  displayName?: string;
};

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};
