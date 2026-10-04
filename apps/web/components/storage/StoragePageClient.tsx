'use client';

import CenterPopupNotice, {
  type CenterPopupNoticePayload,
} from '@/components/common/CenterPopupNotice';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  CloudUpload,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/common/Button';
import { EditVideoDialog } from '@/components/storage/EditVideoDialog';
import { UploadVideoDialog } from '@/components/storage/UploadVideoDialog';
import { VideoTable } from '@/components/storage/VideoTable';
import { storageService } from '@/services/storage.service';
import { videoService } from '@/services/video.service';
import { userService } from '@/services/user.service';
import { useVideos } from '@/hooks/useVideos';
import type { StorageUsage } from '@/types/storage';
import type { UserPermissions, UserProfile } from '@/types/user';
import type {
  CreateVideoPayload,
  UpdateVideoPayload,
  VideoItem,
} from '@/types/video';

const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

type SortField = 'date' | 'name' | 'size';
type SortDirection = 'desc' | 'asc';

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function calculateDaysLeft(expiresAt?: string | null) {
  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

function formatMb(bytes: number) {
  const value = Number.isFinite(bytes) && bytes > 0 ? bytes / MB : 0;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function CurrentPackageCard({
  videoUsed,
  videoLimit,
  fileCount,
  usedBytes,
  maxFileSizeGb,
  daysLeft,
  expiresAt,
}: {
  videoUsed: number;
  videoLimit: number;
  fileCount: number;
  usedBytes: number;
  maxFileSizeGb: number;
  daysLeft: number | null;
  expiresAt: string;
}) {
  const percent = videoLimit > 0 ? Math.min(100, (videoUsed / videoLimit) * 100) : 0;
  const remaining = Math.max(0, videoLimit - videoUsed);
  const percentLabel = percent.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  const maxBytes = Math.max(0, maxFileSizeGb) * GB;

  return (
    <div className="rounded-[16px] border border-[#5b4118] bg-[linear-gradient(110deg,#071d3f_0%,#071d3f_18%,#0d0d0c_58%,#2d1e0e_100%)] px-5 py-4 shadow-[0_18px_45px_rgba(0,0,0,.22)]">
      <div className="grid items-center gap-4 lg:grid-cols-[230px_150px_150px_150px_1fr]">
        <div className="flex items-center gap-3 text-[13px] font-black text-[#f7f1e7]">
          <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-[#0b79ff] text-[12px] leading-none text-white">S</span>
          <div>
            <div className="flex items-center gap-2">
              <span>โควตาวิดีโอ</span>
              <span className="rounded-full border border-[#e3aa3a] px-2 py-0.5 text-[10px] font-black leading-none text-[#e3aa3a]">{percentLabel}%</span>
            </div>
            <p className="mt-1 text-[11px] font-bold text-[#9bc9ff]">คุมจำนวนวิดีโอตามแพ็กเกจ</p>
          </div>
        </div>

        <div className="border-[#5b4118]/80 lg:border-l lg:pl-5">
          <p className="text-[12px] font-bold text-[#9bc9ff]">วิดีโอทั้งหมด</p>
          <b className="mt-1 block text-[18px] text-[#f7f1e7]">{videoLimit.toLocaleString()}</b>
        </div>

        <div className="border-[#5b4118]/80 lg:border-l lg:pl-5">
          <p className="text-[12px] font-bold text-[#9bc9ff]">ใช้งานแล้ว</p>
          <b className="mt-1 block text-[18px] text-[#f7f1e7]">{videoUsed.toLocaleString()}</b>
        </div>

        <div className="border-[#5b4118]/80 lg:border-l lg:pl-5">
          <p className="text-[12px] font-bold text-[#9bc9ff]">คงเหลือ</p>
          <b className="mt-1 block text-[18px] text-[#f7f1e7]">{remaining.toLocaleString()}</b>
        </div>

        <div className="border-[#5b4118]/80 lg:border-l lg:pl-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-bold text-[#9bc9ff]">ไฟล์ที่อัปไว้ตอนนี้</p>
              <b className="mt-1 block text-[14px] text-[#e3aa3a]">
                {fileCount.toLocaleString()} ไฟล์ · {formatMb(usedBytes)} MB
              </b>
            </div>
            <span className="text-right text-[12px] font-bold text-[#ffe0a3]">
              สูงสุด {maxFileSizeGb.toLocaleString()} GB/คลิป
              {maxBytes > 0 ? <span className="block text-[#9d968d]">เพดาน {formatMb(maxBytes)} MB/คลิป</span> : null}
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-[#4d3918]">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#f1c34d,#35a3ff)]" style={{ width: `${percent}%` }} />
          </div>

          <div className="mt-2 flex justify-end text-[11px] font-bold text-[#9d968d]">
            <span>{daysLeft === null ? 'ไม่กำหนดวันหมดอายุ' : `เหลือ ${daysLeft} วัน`}{expiresAt ? ` · ${expiresAt}` : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StoragePageClient() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [uploadingVideos, setUploadingVideos] = useState<VideoItem[]>([]);
  const [quotaNotice, setQuotaNotice] = useState<CenterPopupNoticePayload | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VideoItem | null>(null);

  const {
    items,
    filteredItems,
    usage,
    liveChannels,
    query,
    setQuery,
    loading,
    saving,
    error,
    load,
    createVideo,
    updateVideo,
    removeVideo,
  } = useVideos();

  const loadPageMeta = useCallback(async () => {
    const [storageResult, profileResult, permissionsResult] = await Promise.allSettled([
      storageService.usage(),
      userService.me(),
      userService.permissions(),
    ]);

    if (storageResult.status === 'fulfilled') setStorageUsage(storageResult.value);
    if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
    if (permissionsResult.status === 'fulfilled') setPermissions(permissionsResult.value);
  }, []);

  useEffect(() => {
    void loadPageMeta();
  }, [loadPageMeta]);

  const sortedVideos = useMemo(() => {
    const next = [...uploadingVideos, ...filteredItems];
    const factor = sortDirection === 'asc' ? 1 : -1;

    next.sort((left, right) => {
      if (sortField === 'name') {
        return left.title.localeCompare(right.title, 'th') * factor;
      }

      if (sortField === 'size') {
        return (Number(left.sizeMb ?? 0) - Number(right.sizeMb ?? 0)) * factor;
      }

      const leftDate = new Date(left.createdAt || left.updatedAt).getTime();
      const rightDate = new Date(right.createdAt || right.updatedAt).getTime();
      return (leftDate - rightDate) * factor;
    });

    return next;
  }, [filteredItems, sortDirection, sortField, uploadingVideos]);

  const packageData = profile?.package;
  const packageExpiresAt = profile?.packageExpiresAt || permissions?.package.expiresAt || null;
  const daysLeft = permissions?.package.daysLeft ?? calculateDaysLeft(packageExpiresAt);
  const expiryLabel = formatDate(packageExpiresAt);

  const videoBytes = items.reduce((total, video) => {
    const sizeMb = Number(video.sizeMb);
    return total + (Number.isFinite(sizeMb) && sizeMb > 0 ? sizeMb * MB : 0);
  }, 0);
  const packageStorageGb = Number(packageData?.storageGb ?? permissions?.package.limits.storageGb ?? 0);
  const maxFileSizeGb = Number(usage?.maxFileSizeGb ?? storageUsage?.maxFileSizeGb ?? packageStorageGb);
  const maxFileSizeBytes = Number(usage?.maxFileSizeBytes ?? storageUsage?.maxFileSizeBytes ?? Math.max(0, maxFileSizeGb) * GB);
  const usedBytes = Math.max(Number(storageUsage?.usedBytes ?? 0), videoBytes);
  const currentVideoCount = items.length;
  const videoUsed = currentVideoCount;
  const videoLimit = Number(usage?.limit ?? packageData?.maxVideos ?? permissions?.package.limits.videos ?? currentVideoCount);
  const isVideoQuotaFull = (videoLimit > 0 && currentVideoCount >= videoLimit) || usage?.canCreate === false;

  const handleUploadClick = () => {
    if (isVideoQuotaFull) {
      setQuotaNotice({
        id: Date.now(),
        message: 'ใช้งานครบตามแพ็กเกจแล้ว กรุณาติดต่อแอดมิน',
      });
      return;
    }
    setQuotaNotice(null);
    setUploadOpen(true);
  };

  const handleCreate = async (payload: CreateVideoPayload) => {
    const now = new Date().toISOString();
    const previewUrl = payload.file ? URL.createObjectURL(payload.file) : payload.sourceUrl || null;
    const localId = `local-upload-${Date.now()}`;
    const localVideo: VideoItem = {
      id: localId,
      userId: 'local',
      title: payload.title,
      status: 'PROCESSING',
      sourceUrl: previewUrl,
      fileKey: null,
      hlsUrl: null,
      liveChannelId: payload.liveChannelId || null,
      sizeMb: payload.file ? payload.file.size / MB : null,
      durationSec: null,
      uploadProgress: 0,
      createdAt: now,
      updatedAt: now,
      liveChannel: null,
    };

    setUploadingVideos((current) => [localVideo, ...current]);

    void videoService.create({
      ...payload,
      onUploadProgress: (progress) => {
        setUploadingVideos((current) => current.map((item) => (
          item.id === localId ? { ...item, uploadProgress: progress, updatedAt: new Date().toISOString() } : item
        )));
      },
    })
      .then(async () => {
        setUploadingVideos((current) => current.filter((item) => item.id !== localId));
        if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
        await Promise.all([load(), loadPageMeta()]);
      })
      .catch((err) => {
        setUploadingVideos((current) => current.map((item) => (
          item.id === localId
            ? { ...item, status: 'FAILED', updatedAt: new Date().toISOString() }
            : item
        )));
        console.error(err);
      });
  };

  const handleUpdate = async (id: string, payload: UpdateVideoPayload) => {
    await updateVideo(id, payload);
  };

  const handleDelete = (id: string) => {
    setDeleteTarget(items.find((item) => item.id === id) ?? null);
  };

  const confirmDeleteVideo = async () => {
    if (!deleteTarget) return;
    await removeVideo(deleteTarget.id);
    setDeleteTarget(null);
    await loadPageMeta();
  };

  return (
    <AppShell>
      <div className="page-pad">
        {error ? (
          <div className="mb-5 rounded-xl border border-[#0b79ff]/35 bg-[#071d3f] px-5 py-3 text-[13px] font-semibold text-[#ffd0d0]">
            {error}
          </div>
        ) : null}
        <CenterPopupNotice notice={quotaNotice} onClose={() => setQuotaNotice(null)} />
        {deleteTarget ? (
          <div className="fixed inset-0 z-[80] grid place-items-center bg-black/78 px-4 backdrop-blur-[7px]">
            <div className="relative w-full max-w-[460px] overflow-hidden rounded-[20px] border border-[#c7962d]/60 bg-[radial-gradient(circle_at_8%_0%,rgba(45,167,255,.24),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(242,189,75,.18),transparent_32%),linear-gradient(135deg,#07111f_0%,#05070b_54%,#171004_100%)] p-6 text-white shadow-[0_32px_100px_rgba(0,0,0,.62),0_0_38px_rgba(45,167,255,.10),inset_0_1px_0_rgba(255,255,255,.08)]">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-[12px] border border-[#c7962d]/35 bg-black/[0.25] text-[#d8c8a1] transition hover:border-[#ffd46c] hover:text-[#ffd46c]"
                aria-label="ปิด"
              >
                <X size={20} />
              </button>
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-[14px] border border-[#ff766f]/35 bg-[#3a0d11]/60 text-[#ffaaa1] shadow-[0_0_20px_rgba(255,118,111,.12)]">
                <Trash2 size={20} />
              </div>
              <h3 className="pr-12 text-[24px] font-black text-white drop-shadow-[0_2px_12px_rgba(45,167,255,.16)]">ลบวิดีโอนี้ใช่ไหม?</h3>
              <p className="mt-2 text-[13px] font-semibold leading-6 text-[#9fb1c9]">
                วิดีโอ <span className="font-black text-[#ffd46c]">{deleteTarget.title || deleteTarget.fileKey || deleteTarget.id}</span> จะถูกลบออกจากคลังวิดีโอ
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="h-10 rounded-[10px] border border-[#c7962d]/30 bg-black/[0.28] px-5 text-[13px] font-black text-[#d8c8a1] transition hover:border-[#2da7ff]/60 hover:text-white"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDeleteVideo()}
                  className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#ff766f]/35 bg-[#3a0d11]/80 px-5 text-[13px] font-black text-[#ffaaa1] transition hover:border-[#ffaaa1] hover:bg-[#4a1116]"
                >
                  <Trash2 size={15} /> ลบวิดีโอ
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <section>
          <h2 className="flex items-center gap-3 text-[20px] font-black text-[#f7f1e7]">
            <Archive size={18} className="text-[#e3aa3a]" /> แพ็คเกจพื้นที่จัดเก็บ
          </h2>

          <div className="mt-5">
            <CurrentPackageCard
              videoUsed={videoUsed}
              videoLimit={videoLimit}
              fileCount={items.length}
              usedBytes={usedBytes}
              maxFileSizeGb={maxFileSizeGb}
              daysLeft={daysLeft}
              expiresAt={expiryLabel}
            />
          </div>
        </section>

        <section id="video-library" className="mt-11">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="relative w-full max-w-[330px]">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7f786f]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 w-full rounded-lg border border-[#5b4118] bg-[#0d0d0c] pl-11 pr-4 text-[13px] text-[#f7f1e7] outline-none placeholder:text-[#7f786f] focus:border-[#e3aa3a]"
                placeholder="ค้นหาตามชื่อไฟล์..."
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[13px] text-[#c9c2b6]">
              <Button onClick={handleUploadClick} disabled={saving}>
                <CloudUpload size={16} /> อัพโหลดวิดีโอ
              </Button>
              <span>เรียงตาม:</span>
              <select
                value={sortField}
                onChange={(event) => setSortField(event.target.value as SortField)}
                className="h-10 rounded-lg border border-[#5b4118] bg-[#0d0d0c] px-3 text-[#f7f1e7] outline-none"
              >
                <option value="date">วันที่</option>
                <option value="name">ชื่อ</option>
                <option value="size">ขนาด</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDirection((value) => value === 'desc' ? 'asc' : 'desc')}
                className="grid h-10 w-8 place-items-center text-[#e3aa3a]"
                aria-label="สลับลำดับการเรียง"
              >
                {sortDirection === 'desc' ? <ArrowDown size={17} /> : <ArrowUp size={17} />}
              </button>
            </div>
          </div>

          <VideoTable
            videos={sortedVideos}
            loading={loading}
            saving={saving}
            onEdit={setEditingVideo}
            onDelete={handleDelete}
          />
        </section>

        <UploadVideoDialog
          open={uploadOpen}
          saving={saving}
          canCreate={usage?.canCreate !== false}
          maxFileSizeBytes={maxFileSizeBytes}
          onClose={() => setUploadOpen(false)}
          onSubmit={handleCreate}
        />

        <EditVideoDialog
          open={Boolean(editingVideo)}
          video={editingVideo}
          saving={saving}
          liveChannels={liveChannels}
          onClose={() => setEditingVideo(null)}
          onSubmit={handleUpdate}
        />

      </div>
    </AppShell>
  );
}
