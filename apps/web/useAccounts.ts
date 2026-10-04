'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { accountService } from '@/services/account.service';
import { proxyService } from '@/services/proxy.service';
import { ApiError } from '@/types/api';
import type { CheckCookieResult, CreateLiveChannelPayload, LiveChannel, LiveChannelUsage, UpdateLiveChannelPayload } from '@/types/account';
import type { ProxyItem } from '@/types/proxy';

export function useAccounts() {
  const [items, setItems] = useState<LiveChannel[]>([]);
  const [usage, setUsage] = useState<LiveChannelUsage | null>(null);
  const [proxies, setProxies] = useState<ProxyItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authExpiredRef = useRef(false);
  const loadingRef = useRef(false);
  const rateLimitedUntilRef = useRef(0);

  const load = useCallback(async (showLoading = true) => {
    if (authExpiredRef.current) return;
    if (loadingRef.current) return;
    if (Date.now() < rateLimitedUntilRef.current) return;
    loadingRef.current = true;
    if (showLoading) setLoading(true);
    setError(null);

    try {
      const [nextItems, nextUsage, nextProxies] = await Promise.all([
        accountService.list(),
        accountService.usage(),
        proxyService.list().catch(() => [] as ProxyItem[]),
      ]);

      setItems((current) => (JSON.stringify(current) === JSON.stringify(nextItems) ? current : nextItems));
      setUsage((current) => (JSON.stringify(current) === JSON.stringify(nextUsage) ? current : nextUsage));
      setProxies((current) => (JSON.stringify(current) === JSON.stringify(nextProxies) ? current : nextProxies));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        authExpiredRef.current = true;
        setError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
        return;
      }
      if (err instanceof ApiError && err.status === 429) {
        rateLimitedUntilRef.current = Date.now() + 30_000;
        setError('ระบบกำลังเรียกข้อมูลถี่เกินไป รอสักครู่แล้วจะโหลดใหม่ให้อัตโนมัติ');
        return;
      }
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลช่องไลฟ์ไม่สำเร็จ');
    } finally {
      loadingRef.current = false;
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (authExpiredRef.current) {
        window.clearInterval(timer);
        return;
      }
      void load(false);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;

    return items.filter((item) => {
      const proxy = proxies.find((proxyItem) => proxyItem.id === item.proxyId);
      return [
        item.id,
        item.name,
        item.accountName,
        item.platform,
        item.platformUid,
        item.status,
        item.isOnline ? 'LIVE' : 'NOTLIVE',
        proxy?.host,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [items, proxies, query]);


  const checkCookie = useCallback(async (payload: CreateLiveChannelPayload): Promise<CheckCookieResult> => {
    setError(null);
    return accountService.checkCookie(payload);
  }, []);

  const createAccount = useCallback(async (payload: CreateLiveChannelPayload) => {
    setSaving(true);
    setError(null);

    try {
      await accountService.create(payload);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เพิ่มช่องไลฟ์ไม่สำเร็จ');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [load]);

  const updateAccount = useCallback(async (id: string, payload: UpdateLiveChannelPayload) => {
    setSaving(true);
    setError(null);

    try {
      await accountService.update(id, payload);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'แก้ไขช่องไลฟ์ไม่สำเร็จ');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [load]);

  const updateStatus = useCallback(async (id: string, isOnline: boolean) => {
    setSaving(true);
    setError(null);

    try {
      await accountService.updateStatus(id, { isOnline });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เปลี่ยนสถานะช่องไลฟ์ไม่สำเร็จ');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [load]);

  const removeAccount = useCallback(async (id: string) => {
    setSaving(true);
    setError(null);

    try {
      await accountService.remove(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลบช่องไลฟ์ไม่สำเร็จ');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [load]);

  return {
    items,
    filteredItems,
    usage,
    proxies,
    query,
    setQuery,
    loading,
    saving,
    error,
    load,
    checkCookie,
    createAccount,
    updateAccount,
    updateStatus,
    removeAccount,
  };
}

