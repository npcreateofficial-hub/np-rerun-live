'use client';

import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useEffect } from 'react';

type AdminPopupNoticeProps = {
  message: string | null;
  tone?: 'success' | 'error';
  onClose: () => void;
  durationMs?: number;
};

export function AdminPopupNotice({ message, tone = 'success', onClose, durationMs = 2400 }: AdminPopupNoticeProps) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, message, onClose]);

  if (!message) return null;

  const Icon = tone === 'error' ? AlertTriangle : CheckCircle2;
  const accent = tone === 'error'
    ? 'border-[#a51f28]/70 bg-[#3b0d11] text-[#ffbbb5]'
    : 'border-[#2d8b55]/70 bg-[#0b2917] text-[#9df0bd]';

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/68 px-4 backdrop-blur-[7px]">
      <div className="relative w-full max-w-[460px] overflow-hidden rounded-[20px] border border-[#274262] bg-[radial-gradient(circle_at_8%_0%,rgba(11,121,255,.24),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(240,183,40,.18),transparent_32%),linear-gradient(135deg,#071a31_0%,#05070b_54%,#171004_100%)] p-6 text-center shadow-[0_32px_100px_rgba(0,0,0,.62),0_0_38px_rgba(11,121,255,.10),inset_0_1px_0_rgba(255,255,255,.08)]">
        <button type="button" onClick={onClose} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-[8px] border border-[#274262] bg-[#06111e] text-[#c9d7e8] hover:border-[#f0b728] hover:text-[#f0b728]" aria-label="ปิดแจ้งเตือน">
          <X size={16} />
        </button>
        <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] border shadow-[0_0_22px_rgba(240,183,40,.16)] ${accent}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="text-[24px] font-black text-white">แจ้งเตือน</div>
        <div className="mt-3 text-[14px] font-black leading-7 text-[#ffe0a3]">
          {message}
        </div>
      </div>
    </div>
  );
}
