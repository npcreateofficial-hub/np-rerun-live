import { prisma } from './prisma';
import type { Package, User } from '@prisma/client';

export type Limits = {
  accounts: number;
  liveChannels: number;
  videos: number;
  proxies: number;
  /** Maximum size allowed for one uploaded video clip, in GB. */
  storageGb: number;
};

export const BYTES_PER_GB = 1024 * 1024 * 1024;

export const FREE_LIMITS: Limits = {
  accounts: 1,
  liveChannels: 1,
  videos: 3,
  proxies: 1,
  storageGb: 1,
};

export function limitsFromPackage(pkg: Package | null | undefined): Limits {
  if (!pkg) return FREE_LIMITS;
  return {
    accounts: pkg.maxAccounts,
    liveChannels: pkg.maxLiveChannels,
    videos: pkg.maxVideos,
    proxies: pkg.maxProxies,
    storageGb: pkg.storageGb,
  };
}

export function maxVideoFileSizeBytes(limits: Limits): number {
  if (limits.storageGb <= 0) return 0;
  return Math.max(0, limits.storageGb) * BYTES_PER_GB;
}

export function videoStorageCapacityBytes(limits: Limits): number {
  if (limits.videos <= 0 || limits.storageGb <= 0) return 0;
  return Math.max(0, limits.videos) * maxVideoFileSizeBytes(limits);
}

export function isLimited(limit: number): boolean {
  return Number.isFinite(limit) && limit > 0;
}

export function remainingForLimit(limit: number, used: number): number | null {
  if (!isLimited(limit)) return null;
  return Math.max(0, limit - used);
}

export function canCreateWithinLimit(limit: number, used: number): boolean {
  return !isLimited(limit) || used < limit;
}

export type Usage = {
  accounts: number;
  liveChannels: number;
  videos: number;
  proxies: number;
  storageGb: number;
};

export async function getUsage(userId: string): Promise<Usage & { storageBytes: number }> {
  const [liveChannels, videos, proxies, storageAgg] = await Promise.all([
    prisma.liveChannel.count({ where: { userId } }),
    prisma.video.count({ where: { userId } }),
    prisma.proxy.count({ where: { userId } }),
    prisma.storageFile.aggregate({ where: { userId }, _sum: { sizeBytes: true } }),
  ]);

  const storageBytes = storageAgg._sum.sizeBytes ?? 0;
  const storageGb = storageBytes / (1024 * 1024 * 1024);

  return {
    accounts: liveChannels,
    liveChannels,
    videos,
    proxies,
    storageGb: Number(storageGb.toFixed(4)),
    storageBytes,
  };
}

export async function getUserWithPackage(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, include: { package: true } });
}

/** Effective package (respecting expiry). Returns null if none / expired. */
export function effectivePackage(user: (User & { package: Package | null }) | null): Package | null {
  if (!user?.package) return null;
  if (user.packageExpiresAt && user.packageExpiresAt < new Date()) return null;
  return user.package;
}

export function daysLeft(expiresAt: Date | null | undefined): number | null {
  if (!expiresAt) return null;
  const diff = expiresAt.getTime() - Date.now();
  return diff <= 0 ? 0 : Math.ceil(diff / (1000 * 60 * 60 * 24));
}
