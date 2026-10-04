'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { rerunService } from '@/services/rerun.service';
import type { RerunLiveChannel, RerunSession, RerunUsage, RerunVideo, StartRerunPayload } from '@/types/rerun';

const EMPTY_USAGE: RerunUsage = { active: 0, used: 0, limit: 0, remaining: 0, canStart: false };

export function useReruns() {
  const [usage, setUsage] = useState<RerunUsage>(EMPTY_USAGE);
  const [sessions, setSessions] = useState<RerunSession[]>([]);
  const [activeSessions, setActiveSessions] = useState<RerunSession[]>([]);
  const [liveChannels, setLiveChannels] = useState<RerunLiveChannel[]>([]);
  const [videos, setVideos] = useState<RerunVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readyVideos = useMemo(() => videos.filter((video) => video.status === 'READY'), [videos]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [nextUsage, nextSessions, nextActive, nextChannels, nextVideos] = await Promise.all([
        rerunService.usage().catch(() => EMPTY_USAGE),
        rerunService.list(),
        rerunService.active(),
        rerunService.liveChannels(),
        rerunService.videos(),
      ]);
      setUsage(nextUsage);
      setSessions(nextSessions);
      setActiveSessions(nextActive);
      setLiveChannels(nextChannels);
      setVideos(nextVideos);
    } catch (event) {
      const message = event instanceof Error ? event.message : 'โหลดข้อมูลรีรันไม่สำเร็จ';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 10_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const start = useCallback(async (payload: StartRerunPayload) => {
    setBusy(true);
    setError(null);
    try {
      const session = await rerunService.start(payload);
      await refresh();
      return session;
    } catch (event) {
      const message = event instanceof Error ? event.message : 'เริ่มรีรันไม่สำเร็จ';
      setError(message);
      throw event;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const stop = useCallback(async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const session = await rerunService.stop(id);
      await refresh();
      return session;
    } catch (event) {
      const message = event instanceof Error ? event.message : 'หยุดรีรันไม่สำเร็จ';
      setError(message);
      throw event;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await rerunService.remove(id);
      await refresh();
    } catch (event) {
      const message = event instanceof Error ? event.message : 'ลบประวัติรีรันไม่สำเร็จ';
      setError(message);
      throw event;
    } finally {
      setBusy(false);
    }
  }, [refresh]);


  return {
    usage,
    sessions,
    activeSessions,
    liveChannels,
    videos,
    readyVideos,
    loading,
    busy,
    error,
    refresh,
    start,
    stop,
    remove,
  };
}
