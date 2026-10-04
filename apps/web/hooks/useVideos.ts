"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { accountService } from "@/services/account.service";
import { videoService } from "@/services/video.service";
import type { LiveChannel } from "@/types/account";
import type {
  CreateVideoPayload,
  UpdateVideoPayload,
  VideoItem,
  VideoStatus,
  VideoUsage,
} from "@/types/video";

function getVideoSourceKey(item: VideoItem) {
  return (item.sourceUrl || item.fileKey || "").trim().replace(/\\/g, "/");
}

function isRealVideoItem(item: VideoItem) {
  const source = getVideoSourceKey(item);
  if (!source) return false;
  if (/example\.com/i.test(source)) return false;
  return true;
}

function isFileNameTitle(item: VideoItem) {
  const source = getVideoSourceKey(item);
  const fileName = source.split("/").pop()?.replace(/\.mp4$/i, "") || "";
  return Boolean(fileName && item.title.trim() === fileName);
}

function pickBetterVideoItem(current: VideoItem, next: VideoItem) {
  const currentIsFileName = isFileNameTitle(current);
  const nextIsFileName = isFileNameTitle(next);

  if (currentIsFileName && !nextIsFileName) return next;
  if (!currentIsFileName && nextIsFileName) return current;

  return new Date(next.updatedAt || next.createdAt).getTime() >
    new Date(current.updatedAt || current.createdAt).getTime()
    ? next
    : current;
}

function dedupeVideos(items: VideoItem[]) {
  const bySource = new Map<string, VideoItem>();

  for (const item of items) {
    if (!isRealVideoItem(item)) continue;
    const source = getVideoSourceKey(item);
    const previous = bySource.get(source);
    bySource.set(source, previous ? pickBetterVideoItem(previous, item) : item);
  }

  return Array.from(bySource.values()).sort(
    (a, b) =>
      new Date(b.updatedAt || b.createdAt).getTime() -
      new Date(a.updatedAt || a.createdAt).getTime(),
  );
}

export function useVideos() {
  const [items, setItems] = useState<VideoItem[]>([]);
  const [usage, setUsage] = useState<VideoUsage | null>(null);
  const [liveChannels, setLiveChannels] = useState<LiveChannel[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextUsage, nextItems, nextLiveChannels] = await Promise.all([
        videoService.usage(),
        videoService.list(),
        accountService.list().catch(() => [] as LiveChannel[]),
      ]);

      setUsage(nextUsage);
      setItems(dedupeVideos(nextItems));
      setLiveChannels(nextLiveChannels);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "โหลดข้อมูลวิดีโอไม่สำเร็จ",
      );
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
      return [
        item.id,
        item.title,
        item.status,
        item.sourceUrl,
        item.liveChannel?.name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [items, query]);

  const stats = useMemo(() => {
    const total = items.length;
    const pending = items.filter((item) => item.status === "PENDING").length;
    const processing = items.filter(
      (item) => item.status === "PROCESSING",
    ).length;
    const ready = items.filter((item) => item.status === "READY").length;
    const failed = items.filter((item) => item.status === "FAILED").length;

    return { total, pending, processing, ready, failed };
  }, [items]);

  const createVideo = useCallback(
    async (payload: CreateVideoPayload) => {
      setSaving(true);
      setError(null);

      try {
        await videoService.create(payload);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "เพิ่มวิดีโอไม่สำเร็จ");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const updateVideo = useCallback(
    async (id: string, payload: UpdateVideoPayload) => {
      setSaving(true);
      setError(null);

      try {
        await videoService.update(id, payload);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "แก้ไขวิดีโอไม่สำเร็จ");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const updateStatus = useCallback(
    async (id: string, status: VideoStatus) => {
      setSaving(true);
      setError(null);

      try {
        await videoService.updateStatus(id, { status });
        await load();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "เปลี่ยนสถานะวิดีโอไม่สำเร็จ",
        );
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const convertVideo = useCallback(
    async (id: string) => {
      setSaving(true);
      setError(null);

      try {
        await videoService.convert(id);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "แปลงวิดีโอไม่สำเร็จ");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const removeVideo = useCallback(
    async (id: string) => {
      setSaving(true);
      setError(null);

      try {
        await videoService.remove(id);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "ลบวิดีโอไม่สำเร็จ");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  return {
    items,
    filteredItems,
    usage,
    stats,
    liveChannels,
    query,
    setQuery,
    loading,
    saving,
    error,
    load,
    createVideo,
    updateVideo,
    updateStatus,
    convertVideo,
    removeVideo,
  };
}
