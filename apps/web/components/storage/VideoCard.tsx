'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Edit3,
  FileVideo,
  Loader2,
  MoreVertical,
  PauseCircle,
  PlayCircle,
  RefreshCcw,
  Trash2,
} from 'lucide-react';
import { MEDIA_BASE_URL } from '@/lib/constants';
import type { VideoItem, VideoStatus } from '@/types/video';

type VideoCardProps = {
  video: VideoItem;
  saving?: boolean;
  onEdit: (video: VideoItem) => void;
  onStatus?: (id: string, status: VideoStatus) => void;
  onConvert?: (id: string) => void;
  onDelete: (id: string) => void;
};

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatSize(value?: number | null) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return '-';

  return `${size.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MB`;
}

function formatDuration(seconds?: number | null) {
  const totalSeconds = Number(seconds);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;

  const rounded = Math.floor(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getVideoPreviewUrl(video: VideoItem) {
  const source = (video.sourceUrl || video.fileKey || '').trim();
  if (!source || /example\.com/i.test(source)) return '';
  if (/^(https?:|blob:)/i.test(source)) return source;
  if (source.startsWith('/uploads/')) return `${MEDIA_BASE_URL}${source}`;
  if (source.startsWith('/')) return source;
  return `${MEDIA_BASE_URL}/${source.replace(/^\/+/, '')}`;
}

function ActionMenu({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onToggle();
    };

    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open, onToggle]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="grid h-8 w-8 place-items-center rounded-md text-[#7f786f] transition hover:bg-white/5 hover:text-[#f7f1e7]"
        aria-label="เมนูจัดการวิดีโอ"
      >
        <MoreVertical size={17} />
      </button>

      {open ? (
        <div className="absolute right-0 top-9 z-30 min-w-[154px] overflow-hidden rounded-xl border border-[#4b3615] bg-[#151412] py-1 shadow-[0_18px_45px_rgba(0,0,0,.42)]">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function VideoCard({
  video,
  saving = false,
  onEdit,
  onStatus,
  onConvert,
  onDelete,
}: VideoCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewUrl = getVideoPreviewUrl(video);
  const duration = formatDuration(video.durationSec);
  const isProcessing = video.status === 'PROCESSING';
  const isUploading = video.id.startsWith('local-upload-');
  const uploadProgress = Math.max(0, Math.min(100, Number(video.uploadProgress ?? 0)));
  const isFailed = video.status === 'FAILED';

  const togglePlayback = async () => {
    const element = videoRef.current;
    if (!element || !previewUrl || isProcessing) return;

    if (!element.paused) {
      element.pause();
      setIsPlaying(false);
      return;
    }

    try {
      document.querySelectorAll<HTMLVideoElement>('video[data-storage-card-video]').forEach((candidate) => {
        if (candidate !== element && !candidate.paused) candidate.pause();
      });
      element.muted = false;
      await element.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  return (
    <article className="w-full min-w-0 overflow-visible rounded-[14px] border border-[#f4f0e8]/80 bg-[#151412] shadow-[0_15px_38px_rgba(0,0,0,.18)]">
      <div className="relative aspect-[9/16] overflow-hidden rounded-t-[14px] bg-[#0b0b0a]">
        {!isPlaying ? (
          <span className="absolute left-3 top-3 z-20 rounded-full bg-[#e3aa3a] px-3 py-1 text-[11px] font-black leading-none text-[#0b0b0a]">
            MP4
          </span>
        ) : null}

        {previewUrl ? (
          <video
            ref={videoRef}
            data-storage-card-video
            src={previewUrl}
            preload="metadata"
            muted={!isPlaying}
            playsInline
            onClick={() => void togglePlayback()}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onLoadedMetadata={(event) => {
              const element = event.currentTarget;
              if (!isPlaying && Number.isFinite(element.duration) && element.duration > 0.2) {
                try {
                  element.currentTime = 0.1;
                } catch {
                  // The browser may block seeking before enough data is buffered.
                }
              }
            }}
            className="block h-full w-full cursor-pointer object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-slate-600">
            <FileVideo size={38} strokeWidth={1.5} />
          </div>
        )}

        {!isPlaying ? <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,8,.05),rgba(8,8,8,.10)_48%,rgba(8,8,8,.78))]" /> : null}

        {!isPlaying ? (
          <button
            type="button"
            onClick={() => void togglePlayback()}
            disabled={!previewUrl || isProcessing}
            className="absolute left-1/2 top-1/2 z-20 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#e3aa3a] text-[#0b0b0a] shadow-[0_8px_20px_rgba(227,170,58,.25)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="เล่นวิดีโอ"
          >
            {isProcessing ? <Loader2 size={23} className="animate-spin" /> : <PlayCircle size={28} fill="currentColor" strokeWidth={1.7} />}
          </button>
        ) : null}

        {duration && !isPlaying ? (
          <span className="absolute bottom-3 right-3 z-20 rounded-md bg-[#201b12] px-2 py-1 text-[11px] font-bold text-[#e7ded2]">
            {duration}
          </span>
        ) : null}
      </div>

      <div className="rounded-b-[14px] bg-[#151412] p-3">
        <div className="mb-3 flex min-w-0 items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate text-[15px] font-extrabold text-[#f7f1e7]" title={video.title}>
            {video.title}
          </h3>

          <ActionMenu open={menuOpen} onToggle={() => setMenuOpen((value) => !value)}>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setMenuOpen(false);
                onEdit(video);
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-semibold text-[#e7ded2] transition hover:bg-white/5 disabled:opacity-50"
            >
              <Edit3 size={14} /> แก้ไข
            </button>
            {onStatus ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setMenuOpen(false);
                  onStatus(video.id, video.status === 'READY' ? 'PENDING' : 'READY');
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-semibold text-[#e7ded2] transition hover:bg-white/5 disabled:opacity-50"
              >
                <PlayCircle size={14} /> เปลี่ยนสถานะ
              </button>
            ) : null}
            {onConvert ? (
              <button
                type="button"
                disabled={saving || isProcessing}
                onClick={() => {
                  setMenuOpen(false);
                  onConvert(video.id);
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-semibold text-[#e7ded2] transition hover:bg-white/5 disabled:opacity-50"
              >
                <RefreshCcw size={14} /> ประมวลผลใหม่
              </button>
            ) : null}
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setMenuOpen(false);
                onDelete(video.id);
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-semibold text-[#ff86a4] transition hover:bg-white/5 disabled:opacity-50"
            >
              <Trash2 size={14} /> ลบ
            </button>
          </ActionMenu>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="min-h-[58px] rounded-lg bg-[#0d0d0c] px-2.5 py-2.5">
            <p className="text-[#7f786f]">ขนาดไฟล์</p>
            <b className="mt-1 block break-words text-[#f7f1e7]">{formatSize(video.sizeMb)}</b>
          </div>
          <div className="min-h-[58px] rounded-lg bg-[#0d0d0c] px-2.5 py-2.5">
            <p className="text-[#7f786f]">{isProcessing || isFailed ? 'สถานะ' : 'วันที่อัป'}</p>
            <b className={`mt-1 block whitespace-nowrap text-[10px] leading-tight ${isFailed ? 'text-[#ff7999]' : isProcessing ? 'text-[#ffc04c]' : 'text-[#f7f1e7]'}`}>
              {isFailed ? 'ไม่สำเร็จ' : isUploading ? `${uploadProgress}%` : isProcessing ? 'กำลังประมวลผล' : formatDate(video.createdAt)}
            </b>
          </div>
        </div>

        {isProcessing ? (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-[#4b3615]">
              <div className="h-full rounded-full bg-[#e3aa3a] transition-all" style={{ width: `${isUploading ? uploadProgress : 50}%` }} />
            </div>
            <div className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#4b3615] text-[13px] font-bold text-[#9d968d]">
              <Loader2 size={15} className="animate-spin" /> {isUploading ? 'กำลังอัปโหลดขึ้น server' : 'วิดีโอกำลังประมวลผล'}
            </div>
          </div>
        ) : isFailed ? (
          <button
            type="button"
            onClick={() => onConvert?.(video.id)}
            disabled={saving || !onConvert}
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#ff6d93] text-[13px] font-bold text-[#0b0b0a] transition hover:brightness-110 disabled:opacity-50"
          >
            <RefreshCcw size={15} /> ลองประมวลผลอีกครั้ง
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void togglePlayback()}
            disabled={!previewUrl || saving}
            className={`mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-[13px] font-bold text-[#0b0b0a] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 ${isPlaying ? 'bg-[#ff6d88]' : 'bg-[#e3aa3a]'}`}
          >
            {isPlaying ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
            {isPlaying ? 'หยุดเล่น' : 'เล่นวิดีโอ'}
          </button>
        )}
      </div>
    </article>
  );
}


