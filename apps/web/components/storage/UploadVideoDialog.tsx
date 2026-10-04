'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Box, Video, X } from 'lucide-react';
import type { CreateVideoPayload } from '@/types/video';

type UploadVideoDialogProps = {
  open: boolean;
  saving?: boolean;
  canCreate?: boolean;
  maxFileSizeBytes?: number;
  onClose: () => void;
  onSubmit: (payload: CreateVideoPayload) => Promise<void>;
};

export function UploadVideoDialog({ open, saving = false, canCreate = true, maxFileSizeBytes = 0, onClose, onSubmit }: UploadVideoDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setTitle('');
    setError(null);
    setPreviewUrl('');
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [file]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const nextTitle = title.trim();
    if (!nextTitle) {
      setError('กรุณากรอกชื่อวิดีโอ');
      return;
    }

    if (!file) {
      setError('กรุณาเลือกไฟล์ MP4 เพื่ออัปโหลดขึ้น server');
      return;
    }

    if (file && maxFileSizeBytes > 0 && file.size > maxFileSizeBytes) {
      setError('ไฟล์นี้มีขนาดเกินสิทธิ์ของแพ็กเกจ');
      return;
    }

    void onSubmit({
      title: nextTitle,
      sourceUrl: null,
      liveChannelId: null,
      file,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 py-5 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="relative max-h-[calc(100vh-40px)] w-full max-w-[820px] overflow-y-auto rounded-[16px] border border-[#1e4d83] bg-[linear-gradient(135deg,#071320,#060b12_58%,#110d06)] p-5 shadow-[0_28px_90px_rgba(0,0,0,.55)] sm:p-6">
        <button type="button" onClick={onClose} className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full border border-[#31587e] bg-[#07111f] text-[#c8d7ea] transition hover:border-[#f0b728] hover:text-[#f0b728]">
          <X size={22} />
        </button>

        <h2 className="mb-5 flex items-center gap-2 text-[18px] font-extrabold text-white"><Box size={18} className="text-[#f0b728]" /> เพิ่มวิดีโอใหม่เข้าคลัง</h2>

        {error ? <div className="mb-4 rounded-xl border border-[#b4233a]/60 bg-[#210b14] px-5 py-3 text-[13px] font-semibold text-[#ffd0d0]">{error}</div> : null}

        <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(240px,340px)_minmax(0,1fr)]">
          {previewUrl ? (
            <div className="relative mx-auto aspect-[9/16] w-full max-w-[320px] overflow-hidden rounded-xl border border-[#274262] bg-[#02060b] text-[#95a9c4] shadow-[0_18px_42px_rgba(0,0,0,.28)]">
              <video
                src={previewUrl}
                controls
                muted
                playsInline
                preload="metadata"
                className="absolute inset-0 block h-full w-full object-contain"
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="absolute bottom-3 right-3 rounded-lg bg-[#f0b728] px-3 py-2 text-[12px] font-extrabold text-[#07111f] shadow-[0_8px_24px_rgba(0,0,0,.35)]"
              >
                เปลี่ยนไฟล์
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="relative mx-auto grid aspect-[9/16] w-full max-w-[320px] place-items-center overflow-hidden rounded-xl border border-dashed border-[#31587e] bg-[#07111f] px-5 text-[#95a9c4] transition hover:border-[#f0b728] hover:bg-[#0a1727] hover:text-[#f0b728]"
            >
              <div className="text-center">
                <Video size={44} className="mx-auto mb-4" />
                <p className="font-semibold">เลือกไฟล์ MP4 เพื่ออัปโหลดขึ้น server</p>
              </div>
            </button>
          )}

          <div className="space-y-4">
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4"
              className="hidden"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
                if (selected && !title) setTitle(selected.name.replace(/\.mp4$/i, ''));
              }}
            />

            <div>
              <label className="mb-2 block text-[13px] font-bold text-[#b8c7da]">ชื่อวิดีโอ <span className="text-[#f0b728]">*</span></label>
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full min-w-0 rounded-lg border border-[#274262] bg-[#081421] px-4 py-3 text-[13px] text-white outline-none placeholder:text-[#6f849d] focus:border-[#f0b728]" placeholder="เช่น วิดีโอสินค้า 1" />
            </div>

            <div className="space-y-3 rounded-xl border border-[#203a5a] bg-[#07111f] p-4 text-[13px]">
              <div><p className="text-[#95a9c4]">ชื่อไฟล์</p><b className="break-all text-white">{file?.name ?? 'ยังไม่ได้เลือกไฟล์'}</b></div>
              <div><p className="text-[#95a9c4]">ขนาด</p><b className="text-white">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}</b></div>
            </div>

            <button disabled={saving || !canCreate || !title.trim() || !file} className="h-11 w-full rounded-lg border border-[#9b6f12] bg-[#17304d] text-[13px] font-extrabold text-[#7f93aa] transition enabled:bg-[#f0b728] enabled:text-[#07111f] enabled:hover:brightness-110 disabled:cursor-not-allowed">
              {saving ? 'กำลังเพิ่มคิว...' : canCreate ? 'เพิ่มคิวอัปโหลดขึ้น server' : 'แพ็กเกจวิดีโอเต็มแล้ว'}
            </button>
            <p className="text-center text-[11px] font-bold text-[#95a9c4]">กดแล้วระบบจะแสดงสถานะในคลังวิดีโอ สามารถไปทำงานอื่นต่อได้ทันที</p>
          </div>
        </div>
      </form>
    </div>
  );
}

