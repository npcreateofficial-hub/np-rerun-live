import { api } from '@/lib/api';
import type { CurrentPackage, PackageItem, SelectPackageResult } from '@/types/package';

type ApiListShape =
  | PackageItem[]
  | { data?: PackageItem[] | { items?: PackageItem[] } }
  | { items?: PackageItem[] }
  | null
  | undefined;

type CurrentPackageShape =
  | CurrentPackage
  | { data?: CurrentPackage }
  | { current?: CurrentPackage }
  | null
  | undefined;

function normalizePackageList(payload: ApiListShape): PackageItem[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  if ('items' in payload && Array.isArray(payload.items)) return payload.items;

  if ('data' in payload) {
    const data = payload.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && 'items' in data && Array.isArray(data.items)) return data.items;
  }

  return [];
}

function normalizeCurrentPackage(payload: CurrentPackageShape): CurrentPackage | null {
  if (!payload || typeof payload !== 'object') return null;
  if ('data' in payload && payload.data) return payload.data;
  if ('current' in payload && payload.current) return payload.current;
  if ('package' in payload) return payload as CurrentPackage;
  return null;
}

async function tryApi<T>(path: string, init?: RequestInit) {
  try {
    return await api<T>(path, init);
  } catch {
    return null;
  }
}

export const packageService = {
  async list() {
    const payload = await api<ApiListShape>('/packages');
    return normalizePackageList(payload);
  },

  async listAll() {
    const payload = await api<ApiListShape>('/packages/all');
    return normalizePackageList(payload);
  },

  async current() {
    const payload = await tryApi<CurrentPackageShape>('/packages/current');
    return normalizeCurrentPackage(payload);
  },

  async select(packageId: string) {
    const endpoints: Array<[string, RequestInit]> = [
      [`/packages/${packageId}/select`, { method: 'POST' }],
      ['/packages/select', { method: 'POST', body: JSON.stringify({ packageId }) }],
      ['/packages/buy', { method: 'POST', body: JSON.stringify({ packageId }) }],
    ];

    let lastError: unknown;

    for (const [path, init] of endpoints) {
      try {
        return await api<SelectPackageResult>(path, init);
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('เลือกแพ็กเกจไม่สำเร็จ');
  },
};
