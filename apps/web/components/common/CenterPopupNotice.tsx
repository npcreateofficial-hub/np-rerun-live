'use client';

import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

export type CenterPopupNoticePayload = {
  id: number;
  message: string;
};

type CenterPopupNoticeProps = {
  notice: CenterPopupNoticePayload | null;
  onClose: () => void;
  durationMs?: number;
};

export default function CenterPopupNotice({
  notice,
  onClose,
  durationMs = 2400,
}: CenterPopupNoticeProps) {
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [notice, onClose, durationMs]);

  if (!notice) return null;

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/68 px-4 backdrop-blur-[7px]">
      <div className="w-full max-w-[460px] overflow-hidden rounded-[20px] border border-[#c7962d]/60 bg-[radial-gradient(circle_at_8%_0%,rgba(45,167,255,.24),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(242,189,75,.18),transparent_32%),linear-gradient(135deg,#07111f_0%,#05070b_54%,#171004_100%)] p-6 text-center shadow-[0_32px_100px_rgba(0,0,0,.62),0_0_38px_rgba(45,167,255,.10),inset_0_1px_0_rgba(255,255,255,.08)]">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] border border-[#d6a93f]/55 bg-[#2d1e0e] text-[#ffc43d] shadow-[0_0_22px_rgba(242,189,75,.18)]">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="text-[24px] font-black text-white drop-shadow-[0_2px_12px_rgba(45,167,255,.16)]">แจ้งเตือน</div>
        <div className="mt-3 text-[14px] font-black leading-7 text-[#ffe0a3]">
          {notice.message}
        </div>
      </div>
    </div>
  );
}
