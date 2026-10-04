import { api } from '@/lib/api';
import type { DashboardSummary } from '@/types/dashboard';

export const dashboardService = {
  summary() {
    return api<DashboardSummary>('/dashboard/summary');
  },
};
