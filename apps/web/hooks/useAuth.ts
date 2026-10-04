'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/auth.service';
import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from '@/lib/auth';
import type { AuthUser, LoginPayload } from '@/types/auth';

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMe = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setBooting(false);
      return null;
    }

    try {
      const me = await authService.me();
      setUser(me);
      return me;
    } catch {
      clearAuthTokens();
      setUser(null);
      return null;
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      setLoading(true);
      setError(null);

      try {
        const session = await authService.login(payload);
        setAuthTokens(session.accessToken, session.refreshToken);
        setUser(session.user);
        router.replace('/dashboard');
        return session;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();

    try {
      await authService.logout(refreshToken);
    } catch {
      // logout ฝั่ง client ต่อให้ backend ตอบ error
    } finally {
      clearAuthTokens();
      setUser(null);
      router.replace('/login');
    }
  }, [router]);

  return {
    user,
    loading,
    booting,
    error,
    isAuthenticated: Boolean(user),
    login,
    logout,
    loadMe,
  };
}
