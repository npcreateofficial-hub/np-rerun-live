export type Role = 'USER' | 'ADMIN' | 'STAFF' | string;

export type AuthUser = {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  licenseKey?: string | null;
  device?: {
    id: string | null;
    name: string | null;
    boundAt: string | null;
    moveLimit: number;
    moveUsed: number;
    lockEnabled: boolean;
  };
  role: Role;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type LoginPayload = {
  licenseKey: string;
  username: string;
  password: string;
  deviceId?: string;
  deviceName?: string;
};

export type RegisterPayload = {
  email: string;
  username?: string;
  password: string;
};

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

