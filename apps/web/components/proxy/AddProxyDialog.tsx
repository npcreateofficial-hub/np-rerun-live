'use client';

import { FormEvent, useState } from 'react';
import { Globe2, Server, X } from 'lucide-react';
import type { CreateProxyPayload } from '@/types/proxy';

type AddProxyDialogProps = {
  open: boolean;
  saving?: boolean;
  onClose: () => void;
  onCreate: (payload: CreateProxyPayload) => Promise<void>;
};

const inputClass =
  'h-11 w-full rounded-xl border border-[#c7962d]/35 bg-black/35 px-3 text-sm font-semibold text-white outline-none placeholder:text-[#7d8da3] focus:border-[#2da7ff] focus:ring-1 focus:ring-[#2da7ff]/45';

export function AddProxyDialog({ open, saving = false, onClose, onCreate }: AddProxyDialogProps) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setHost('');
    setPort('');
    setNote('');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const portNumber = Number(port);
    if (!host.trim()) return setError('กรุณากรอก IP Address หรือ Host');
    if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
      return setError('Port ต้องเป็นตัวเลข 1 - 65535');
    }

    await onCreate({
      host: host.trim(),
      port: portNumber,
      note: note.trim() || undefined,
    });

    handleClose();
  };

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/72 p-4 backdrop-blur-[6px]">
      <form onSubmit={handleSubmit} className="relative w-full max-w-[640px] overflow-hidden rounded-[20px] border border-[#c7962d]/55 bg-[#070707] shadow-[0_30px_90px_rgba(0,0,0,.72),0_0_0_1px_rgba(242,189,75,.12)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(11,121,255,.24),transparent_32%),radial-gradient(circle_at_100%_0%,rgba(242,189,75,.22),transparent_34%),linear-gradient(135deg,rgba(7,17,31,.96),rgba(5,5,5,.98)_58%,rgba(28,18,4,.92))]" />
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-xl border border-[#c7962d]/35 bg-black/45 text-[#d8c8a1] transition hover:border-[#ffd46c] hover:text-white"
          aria-label="ปิด"
        >
          <X size={19} />
        </button>

        <div className="relative border-b border-[#c7962d]/30 p-5 pr-16">
          <div className="inline-flex h-8 items-center gap-2 rounded-full border border-[#ffd46c]/45 bg-black/35 px-3 text-[11px] font-black uppercase tracking-[.18em] text-[#ffd46c]">
            <Globe2 size={13} /> PROXY SETUP
          </div>
          <h2 className="mt-3 text-3xl font-black text-white">เพิ่มพร็อกซี่</h2>
        </div>

        <div className="relative p-5">
          <div className="rounded-[16px] border border-[#2da7ff]/25 bg-[#06111f]/70 p-4">
            <div className="flex items-center gap-3 text-white">
              <div className="grid h-11 w-11 place-items-center rounded-xl border border-[#2da7ff]/35 bg-[#061a34] text-[#7fd0ff]"><Server size={21} /></div>
              <div>
                <div className="text-base font-black">ข้อมูลเชื่อมต่อ</div>
                <div className="text-xs font-semibold text-[#9fb1c9]">ใช้ host และ port จากผู้ให้บริการ proxy</div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_140px]">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-[#e9dcc0]">IP Address / Host <span className="text-[#ff766f]">*</span></span>
                <input value={host} onChange={(e) => setHost(e.target.value)} className={inputClass} placeholder="เช่น 45.88.10.20" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-[#e9dcc0]">Port <span className="text-[#ff766f]">*</span></span>
                <input value={port} onChange={(e) => setPort(e.target.value)} className={inputClass} placeholder="8080" inputMode="numeric" />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-black text-[#e9dcc0]">หมายเหตุ</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="เช่น ใช้กับบัญชีร้าน A" />
            </label>
          </div>
        </div>

        {error ? <div className="relative mx-5 rounded-xl border border-[#ff766f]/35 bg-[#3a0d11]/70 px-4 py-3 text-sm font-bold text-[#ffaaa1]">{error}</div> : null}

        <div className="relative flex justify-end gap-3 border-t border-[#c7962d]/30 p-5">
          <button type="button" onClick={handleClose} className="h-11 rounded-xl border border-[#c7962d]/35 bg-black/35 px-6 text-sm font-black text-white hover:border-[#ffd46c]">ยกเลิก</button>
          <button type="submit" disabled={saving} className="h-11 min-w-[150px] rounded-xl border border-[#1ba7ff] bg-gradient-to-b from-[#0b79ff] to-[#063c9a] px-6 text-sm font-black text-white shadow-[0_16px_34px_rgba(11,121,255,.22)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'กำลังเพิ่ม...' : 'บันทึกพร็อกซี่'}</button>
        </div>
      </form>
    </div>
  );
}
