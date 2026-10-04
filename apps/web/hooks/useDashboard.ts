'use client';

import { useCallback, useEffect, useState } from 'react';
import { dashboardService } from '@/services/dashboard.service';
import type { DashboardSummary } from '@/types/dashboard';

export function useDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await dashboardService.summary();
      setSummary(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'โหลด Dashboard ไม่สำเร็จ';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { summary, loading, error, refresh: load };
}
