import { storage } from './storage';

export const ACCESS_TOKEN_KEY = 'gujalive_access_token';
export const REFRESH_TOKEN_KEY = 'gujalive_refresh_token';
export const LEGACY_TOKEN_KEY = 'gujalive_token';

function getCookie(name: string) {
  if (typeof document === 'undefined') return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function cookieSecurityAttribute() {
  if (typeof window === 'undefined') return '';
  return window.location.protocol === 'https:' ? '; Secure' : '';
}

function setCookie(name: string, value: string, maxAge = 60 * 60 * 24 * 7) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${cookieSecurityAttribute()}`;
}

function removeCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax${cookieSecurityAttribute()}`;
}

export function getAccessToken() {
  return storage.get(ACCESS_TOKEN_KEY) ?? storage.get(LEGACY_TOKEN_KEY) ?? getCookie(ACCESS_TOKEN_KEY) ?? getCookie(LEGACY_TOKEN_KEY);
}

export function getRefreshToken() {
  return storage.get(REFRESH_TOKEN_KEY) ?? getCookie(REFRESH_TOKEN_KEY);
}

export function setAuthTokens(accessToken: string, refreshToken: string) {
  storage.set(ACCESS_TOKEN_KEY, accessToken);
  storage.set(REFRESH_TOKEN_KEY, refreshToken);
  storage.set(LEGACY_TOKEN_KEY, accessToken);
  setCookie(ACCESS_TOKEN_KEY, accessToken);
  setCookie(REFRESH_TOKEN_KEY, refreshToken);
  setCookie(LEGACY_TOKEN_KEY, accessToken);
}

export function setAccessToken(accessToken: string) {
  storage.set(ACCESS_TOKEN_KEY, accessToken);
  storage.set(LEGACY_TOKEN_KEY, accessToken);
  setCookie(ACCESS_TOKEN_KEY, accessToken);
  setCookie(LEGACY_TOKEN_KEY, accessToken);
}

export function clearAuthTokens() {
  storage.remove(ACCESS_TOKEN_KEY);
  storage.remove(REFRESH_TOKEN_KEY);
  storage.remove(LEGACY_TOKEN_KEY);
  removeCookie(ACCESS_TOKEN_KEY);
  removeCookie(REFRESH_TOKEN_KEY);
  removeCookie(LEGACY_TOKEN_KEY);
}

export function getToken() {
  return getAccessToken();
}

export function setToken(token: string) {
  setAccessToken(token);
}

export function clearToken() {
  clearAuthTokens();
}
