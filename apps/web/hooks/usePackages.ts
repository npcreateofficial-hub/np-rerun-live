'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { packageService } from '@/services/package.service';
import type { CurrentPackage, PackageItem } from '@/types/package';

export function usePackages() {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [current, setCurrent] = useState<CurrentPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sortedPackages = useMemo(() => {
    return [...packages].sort((a, b) => {
      const sortA = Number(a.sortOrder ?? 0);
      const sortB = Number(b.sortOrder ?? 0);
      if (sortA !== sortB) return sortA - sortB;
      return Number(a.priceBaht ?? 0) - Number(b.priceBaht ?? 0);
    });
  }, [packages]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [currentPackage, activePackages] = await Promise.all([
        packageService.current(),
        packageService.list().catch(async () => packageService.listAll()),
      ]);

      let data = activePackages;
      if (!data.length) data = await packageService.listAll();

      setCurrent(currentPackage);
      setPackages(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'โหลดข้อมูลแพ็กเกจไม่สำเร็จ';
      setError(message);
      setPackages([]);
      setCurrent(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectPackage = useCallback(async (packageId: string) => {
    setSelectingId(packageId);
    setError(null);
    setSuccess(null);
    try {
      const result = await packageService.select(packageId);
      setSuccess(result?.message || 'เลือกแพ็กเกจสำเร็จ');
      const nextCurrent = result?.current ?? (result?.package ? { package: result.package, expiresAt: result.user?.packageExpiresAt } : null);
      if (nextCurrent) setCurrent(nextCurrent);
      await refresh();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'เลือกแพ็กเกจไม่สำเร็จ';
      setError(message);
      throw err;
    } finally {
      setSelectingId(null);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { packages: sortedPackages, current, loading, selectingId, error, success, refresh, selectPackage };
}
