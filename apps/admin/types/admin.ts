export type AdminSummary = {
  users: { total: number; active: number; expired: number; expiringSoon: number; expiringInThreeDays: number };
  packages: { active: number };
  live: { online: number };
  videos: { ready: number };
  payments: { paid: number; revenueBaht: number };
  packageBreakdown: { packageId: string | null; packageName: string; count: number }[];
  marketing: Record<string, number>;
};

export type AdminPackage = {
  id: string;
  name: string;
  code: string;
  category?: string | null;
  description: string | null;
  priceBaht: number;
  durationDays: number;
  maxAccounts: number;
  maxLiveChannels: number;
  maxVideos: number;
  storageGb: number;
  maxDevices: number;
  maxProxies: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  _count?: { users: number };
};

export type AdminUser = {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  phone: string | null;
  lineId: string | null;
  licenseKey: string | null;
  marketingStatus: 'NEW' | 'FOLLOW_UP' | 'INTERESTED' | 'RENEWED' | 'PAUSED' | string;
  lastContactedAt: string | null;
  adminNote: string | null;
  deviceId: string | null;
  deviceName: string | null;
  deviceBoundAt: string | null;
  deviceMoveLimit: number;
  deviceMoveUsed: number;
  deviceLockEnabled: boolean;
  role: string;
  isActive: boolean;
  credit: number;
  packageId: string | null;
  packageStartedAt: string | null;
  packageExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  package: AdminPackage | null;
  _count?: {
    liveChannels: number;
    videos: number;
    proxies: number;
    payments: number;
    notifications: number;
  };
};

export type AdminNotification = {
  id: string;
  userId: string | null;
  title: string;
  message: string;
  imageUrl: string | null;
  styleJson: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | string;
  status: 'DRAFT' | 'SENT' | 'ARCHIVED' | string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
  user?: Pick<AdminUser, 'id' | 'email' | 'username' | 'displayName'> | null;
};

export type AdminPayment = {
  id: string;
  userId: string;
  amountBaht: number;
  method: string | null;
  status: string;
  reference: string | null;
  slipImageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: Pick<AdminUser, 'id' | 'email' | 'username' | 'displayName'> | null;
};

export type AdminPaymentPayload = {
  status?: 'PENDING' | 'PAID' | 'REJECTED';
  reference?: string | null;
};

export type AdminSales = {
  expiringUsers: AdminUser[];
  expiredUsers: AdminUser[];
  recentPayments: AdminPayment[];
};
