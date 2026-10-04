"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import type { LiveChannel } from "@/types/account";
import type { UpdateVideoPayload, VideoItem } from "@/types/video";

type EditVideoDialogProps = {
  open: boolean;
  video: VideoItem | null;
  saving?: boolean;
  liveChannels: LiveChannel[];
  onClose: () => void;
  onSubmit: (id: string, payload: UpdateVideoPayload) => Promise<void>;
};

export function EditVideoDialog({
  open,
  video,
  saving = false,
  liveChannels,
  onClose,
  onSubmit,
}: EditVideoDialogProps) {
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [liveChannelId, setLiveChannelId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !video) return;
    setTitle(video.title ?? "");
    setSourceUrl(video.sourceUrl ?? "");
    setLiveChannelId(video.liveChannelId ?? "");
    setError(null);
  }, [open, video]);

  if (!open || !video) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const nextTitle = title.trim();
    if (!nextTitle) {
      setError("กรุณากรอกชื่อวิดีโอ");
      return;
    }

    await onSubmit(video.id, {
      title: nextTitle,
      sourceUrl: sourceUrl.trim() || null,
      liveChannelId: liveChannelId || null,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 px-4 backdrop-blur-[5px]">
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-[640px] overflow-hidden rounded-[20px] border border-[#c7962d]/60 bg-[radial-gradient(circle_at_8%_0%,rgba(45,167,255,.24),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(242,189,75,.18),transparent_32%),linear-gradient(135deg,#07111f_0%,#05070b_54%,#171004_100%)] p-6 shadow-[0_32px_100px_rgba(0,0,0,.62),0_0_38px_rgba(45,167,255,.10),inset_0_1px_0_rgba(255,255,255,.08)]"
      >
        <div className="mb-5 flex items-center justify-between border-b border-[#4b3615] pb-4">
          <h2 className="text-[22px] font-black text-white drop-shadow-[0_2px_12px_rgba(45,167,255,.16)]">แก้ไขวิดีโอ</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#c9c2b6] hover:text-white"
          >
            <X size={22} />
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-[#ff766f]/35 bg-[#3a0d11]/60 px-5 py-3 text-[13px] font-bold text-[#ffaaa1]">
            {error}
          </div>
        ) : null}

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-[13px] font-bold text-[#9fb1c9]">
              ชื่อวิดีโอ
            </label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-lg border border-[#c7962d]/32 bg-black/[0.38] px-4 py-3 text-[13px] text-white outline-none placeholder:text-[#8d9bb0] focus:border-[#2da7ff] focus:shadow-[0_0_0_3px_rgba(45,167,255,.14)]"
            />
          </div>

          <div>
            <label className="mb-2 block text-[13px] font-bold text-[#9fb1c9]">
              Source URL
            </label>
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              className="w-full rounded-lg border border-[#c7962d]/32 bg-black/[0.38] px-4 py-3 text-[13px] text-white outline-none placeholder:text-[#8d9bb0] focus:border-[#2da7ff] focus:shadow-[0_0_0_3px_rgba(45,167,255,.14)]"
              placeholder="วาง URL ไฟล์วิดีโอจริง หรือ /uploads/videos/ชื่อไฟล์.mp4"
            />
          </div>

          <div>
            <label className="mb-2 block text-[13px] font-bold text-[#9fb1c9]">
              ผูกกับช่องไลฟ์
            </label>
            <select
              value={liveChannelId}
              onChange={(event) => setLiveChannelId(event.target.value)}
              className="h-11 w-full rounded-lg border border-[#c7962d]/32 bg-black/[0.38] px-4 text-[13px] text-white outline-none focus:border-[#2da7ff] focus:shadow-[0_0_0_3px_rgba(45,167,255,.14)]"
            >
              <option value="">ไม่ผูกช่องไลฟ์</option>
              {liveChannels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-4">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-5 text-[13px] font-bold text-white"
          >
            ยกเลิก
          </button>
          <button
            disabled={saving}
            className="flex h-11 items-center gap-2 rounded-lg bg-[linear-gradient(135deg,#ffd46c,#e5a928)] px-6 text-[13px] font-extrabold text-[#0b0b0a] disabled:opacity-50"
          >
            <Check size={16} /> {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </form>
    </div>
  );
}
