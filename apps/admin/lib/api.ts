import { API_BASE_URL } from './constants';
import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from './auth';
import { ApiError, type ApiResponse } from '@/types/api';

type ApiRequestInit = RequestInit & { skipAuth?: boolean; skipRefresh?: boolean };

let refreshPromise: Promise<string | null> | null = null;

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const message = cleanText || `API ตอบกลับไม่ถูกต้อง (${response.status})`;
      throw new ApiError(message.slice(0, 220), response.status, text);
    }
  }

  if (!response.ok) {
    const rawMessage = payload && typeof payload === 'object' && 'message' in payload ? payload.message : `API error ${response.status}`;
    const message = Array.isArray(rawMessage) ? rawMessage.map(String).join(', ') : String(rawMessage);
    throw new ApiError(message, response.status, payload);
  }

  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    return (payload as ApiResponse<T>).data;
  }

  return payload as T;
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return null;

      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const data = await parseResponse<{ accessToken: string; refreshToken: string }>(response);
        setAuthTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
      } catch {
        clearAuthTokens();
        return null;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function api<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const token = init.skipAuth ? null : getAccessToken();
  const headers = new Headers(init.headers);
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;

  if (!headers.has('Content-Type') && init.body && !isFormData) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (response.status === 401 && !init.skipAuth && !init.skipRefresh) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      const retryHeaders = new Headers(init.headers);
      if (!retryHeaders.has('Content-Type') && init.body && !isFormData) retryHeaders.set('Content-Type', 'application/json');
      retryHeaders.set('Authorization', `Bearer ${nextToken}`);
      return parseResponse<T>(await fetch(`${API_BASE_URL}${path}`, { ...init, headers: retryHeaders }));
    }

    clearAuthTokens();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
  }

  return parseResponse<T>(response);
}
