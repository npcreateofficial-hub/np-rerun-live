'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

export function AddAdsAccountDialog({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (cookie: string) => Promise<void> | void }) {
  const [cookie, setCookie] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  if (!open) return null;

  async function submitAccount() {
    const nextCookie = cookie.trim();
    if (!nextCookie) return;
    setSaving(true);
    setError('');
    try {
      await onSubmit(nextCookie);
      setCookie('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ตรวจสอบคุกกี้ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/62 px-4 backdrop-blur-[2px]">
      <div className="relative w-full max-w-[500px] rounded-[14px] bg-[#171613] px-7 py-7 text-[#f7f1e7] shadow-[0_24px_70px_rgba(0,0,0,.45)] ring-1 ring-white/5">
        <button type="button" onClick={onClose} className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full border border-slate-500/70 text-[#c9c2b6] transition hover:border-[#e3aa3a] hover:text-[#e3aa3a]" aria-label="ปิด"><X size={21} /></button>
        <h3 className="text-[20px] font-black tracking-tight text-[#f7f1e7]">เพิ่มบัญชี Shopee Ads</h3>
        <div className="mt-7">
          <label className="mb-2 block text-[15px] font-bold text-[#f7f1e7]">บัญชี Seller <span className="text-[#d94a54]">*</span></label>
          <textarea value={cookie} onChange={(event) => setCookie(event.target.value)} rows={4} placeholder="กรุณากรอก Cookie จาก Shopee Seller Center" className="w-full resize-none rounded-[8px] border border-[#5b4118] bg-[#151412] px-3.5 py-3 text-[14px] font-medium text-[#f7f1e7] outline-none transition placeholder:text-[#7f786f] focus:border-[#e3aa3a] focus:shadow-[0_0_0_3px_rgba(227,170,58,.16)]" />
          {error ? <p className="mt-2 text-[12px] font-bold text-[#ff8d8d]">{error}</p> : null}
        </div>
        <a href="#" className="mt-5 inline-block text-[13px] font-semibold text-[#e3aa3a] underline underline-offset-2">ไปที่ Shopee Seller Center</a>
        <div className="mt-8 flex justify-end gap-5">
          <button type="button" onClick={() => { if (saving) return; setCookie(''); setError(''); onClose(); }} className="rounded-[8px] px-4 py-2 text-[14px] font-bold text-[#e7ded2] transition hover:text-[#f7f1e7]">ยกเลิก</button>
          <button type="button" onClick={submitAccount} className="rounded-[8px] border border-[#1ba7ff] bg-gradient-to-b from-[#0b79ff] to-[#063c9a] px-6 py-2.5 text-[14px] font-black text-white shadow-[0_10px_24px_rgba(227,170,58,.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" disabled={!cookie.trim() || saving}>{saving ? 'กำลังตรวจ...' : 'เพิ่มบัญชี'}</button>
        </div>
      </div>
    </div>
  );
}
