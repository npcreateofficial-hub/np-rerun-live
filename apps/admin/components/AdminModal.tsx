'use client';

import { ReactNode } from 'react';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  widthClass?: string;
};

export function AdminModal({ open, title, description, children, onClose, widthClass = 'max-w-3xl' }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm">
      <div className={`max-h-[92vh] w-full ${widthClass} overflow-hidden rounded-[10px] border border-[#274262] bg-gradient-to-br from-[#071a31] via-[#06101d] to-[#171006] shadow-2xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-[#203a5a] bg-[#071320]/86 px-5 py-4">
          <div>
            <h2 className="text-[20px] font-black text-white">{title}</h2>
            {description ? <p className="mt-1 text-[13px] font-bold text-[#bcdcff]">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border border-[#274262] bg-[#06111e] text-[#f7f1e7] hover:border-[#0b79ff] hover:bg-[#071a31]"
            aria-label="ปิด"
          >
            <X size={17} />
          </button>
        </div>
        <div className="max-h-[calc(92vh-78px)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
