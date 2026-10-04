import { storage } from './storage';

export const ACCESS_TOKEN_KEY = 'gujalive_admin_access_token';
export const REFRESH_TOKEN_KEY = 'gujalive_admin_refresh_token';

function setCookie(name: string, value: string, maxAge = 60 * 60 * 12) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function removeCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export function getAccessToken() {
  return storage.get(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return storage.get(REFRESH_TOKEN_KEY);
}

export function setAuthTokens(accessToken: string, refreshToken: string) {
  storage.set(ACCESS_TOKEN_KEY, accessToken);
  storage.set(REFRESH_TOKEN_KEY, refreshToken);
  setCookie(ACCESS_TOKEN_KEY, accessToken);
  setCookie(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearAuthTokens() {
  storage.remove(ACCESS_TOKEN_KEY);
  storage.remove(REFRESH_TOKEN_KEY);
  removeCookie(ACCESS_TOKEN_KEY);
  removeCookie(REFRESH_TOKEN_KEY);
}
