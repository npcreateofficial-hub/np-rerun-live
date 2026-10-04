import { api } from '@/lib/api';
import type { AuthSession, AuthUser } from '@/types/auth';

export const authService = {
  login(email: string, password: string) {
    return api<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: email, password }),
      skipAuth: true,
      skipRefresh: true,
    });
  },

  me() {
    return api<AuthUser>('/auth/me');
  },
};
