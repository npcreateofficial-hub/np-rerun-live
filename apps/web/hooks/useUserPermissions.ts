'use client';

import { useCallback, useEffect, useState } from 'react';
import { userService } from '@/services/user.service';
import type { UserPermissions } from '@/types/user';

export function useUserPermissions() {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await userService.permissions();
      setPermissions(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'โหลดสิทธิ์การใช้งานไม่สำเร็จ';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { permissions, loading, error, load };
}
