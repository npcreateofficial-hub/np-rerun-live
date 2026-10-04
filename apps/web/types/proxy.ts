export type ProxyStatus = 'UNKNOWN' | 'ACTIVE' | 'INACTIVE';

export type ProxyItem = {
  id: string;
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
  note?: string | null;
  status: ProxyStatus;
  checkedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateProxyPayload = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  note?: string;
};

export type ProxyUsage = {
  used: number;
  limit: number | null;
  remaining: number | null;
  unlimited?: boolean;
  canCreate: boolean;
};
