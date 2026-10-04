import { api } from '@/lib/api';
import type { AuthSession, AuthUser, LoginPayload, RegisterPayload } from '@/types/auth';

export const authService = {
  register(payload: RegisterPayload) {
    return api<AuthSession>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
    });
  },

  login(payload: LoginPayload) {
    return api<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
    });
  },

  refresh(refreshToken: string) {
    return api<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
      skipRefresh: true,
    });
  },

  logout(refreshToken?: string | null) {
    return api<{ loggedOut: boolean }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },

  me() {
    return api<AuthUser>('/auth/me');
  },
};
