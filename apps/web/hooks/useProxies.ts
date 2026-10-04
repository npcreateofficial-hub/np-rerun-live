'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { proxyService } from '@/services/proxy.service';
import type { CreateProxyPayload, ProxyItem, ProxyUsage } from '@/types/proxy';

export function useProxies() {
  const [items, setItems] = useState<ProxyItem[]>([]);
  const [usage, setUsage] = useState<ProxyUsage | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextItems, nextUsage] = await Promise.all([
        proxyService.list(),
        proxyService.usage(),
      ]);
      setItems(nextItems);
      setUsage(nextUsage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลพร็อกซี่ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => {
      return [item.host, item.username, item.note, item.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [items, query]);

  const createProxy = useCallback(async (payload: CreateProxyPayload) => {
    setSaving(true);
    setError(null);

    try {
      await proxyService.create(payload);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เพิ่มพร็อกซี่ไม่สำเร็จ');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [load]);

  const checkProxy = useCallback(async (id: string) => {
    setError(null);
    try {
      await proxyService.check(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ตรวจสอบพร็อกซี่ไม่สำเร็จ');
    }
  }, [load]);

  const removeProxy = useCallback(async (id: string) => {
    setError(null);
    try {
      await proxyService.remove(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลบพร็อกซี่ไม่สำเร็จ');
    }
  }, [load]);

  return {
    items,
    filteredItems,
    usage,
    query,
    setQuery,
    loading,
    saving,
    error,
    load,
    createProxy,
    checkProxy,
    removeProxy,
  };
}
