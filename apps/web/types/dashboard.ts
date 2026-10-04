import type { AuthUser } from './auth';

export type DashboardSummary = {
  user: AuthUser;
  stats: {
    accounts: number;
    proxies: number;
    liveChannels: number;
    videos: number;
  };
  performance: {
    totalSales: number;
    salesPerHour: number;
    orders: number;
    activeLives: number;
    liveHours: number;
    viewers: number;
    conversionRate: number;
    revenueTarget: number;
    orderTarget: number;
    liveHourTarget: number;
    trend: Array<{
      label: string;
      sales: number;
      orders: number;
      liveHours: number;
    }>;
  };
  wallet: {
    credit: number;
    currency: string;
  };
  package: {
    id?: string | null;
    name: string;
    code: string;
    startedAt: string | null;
    expiresAt: string | null;
    priceBaht?: number;
    durationDays?: number;
    limits: {
      accounts: number;
      liveChannels: number;
      videos?: number;
      storageGb: number;
      proxies?: number;
    };
  };
};
