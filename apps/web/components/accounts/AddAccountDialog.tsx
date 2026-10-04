'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Loader2, Server, ShieldCheck, X } from 'lucide-react';
import type { CheckCookieResult, CreateLiveChannelPayload, StreamPlatform } from '@/types/account';
import type { ProxyItem } from '@/types/proxy';

type AddAccountDialogProps = {
  open: boolean;
  proxies: ProxyItem[];
  saving?: boolean;
  onClose: () => void;
  onCheckCookie: (payload: CreateLiveChannelPayload) => Promise<CheckCookieResult>;
  onSubmit: (payload: CreateLiveChannelPayload) => Promise<void> | void;
};

const PLATFORM: StreamPlatform = 'SHOPEE';

export function AddAccountDialog({ open, proxies, saving = false, onClose, onCheckCookie, onSubmit }: AddAccountDialogProps) {
  const [cookie, setCookie] = useState('');
  const [proxyId, setProxyId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkedPayloadKey, setCheckedPayloadKey] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<CheckCookieResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCookie('');
      setProxyId(null);
      setChecking(false);
      setCheckedPayloadKey(null);
      setCheckResult(null);
      setFormError(null);
    }
  }, [open]);

  const busy = saving || checking;
  const trimmedCookie = cookie.trim();
  const payloadKey = `${PLATFORM}|${trimmedCookie}|${proxyId ?? 'no-proxy'}`;
  const canSave = Boolean(checkResult?.valid && checkedPayloadKey === payloadKey);

  if (!open) return null;

  const close = () => {
    if (busy) return;
    onClose();
  };

  const buildPayload = (): CreateLiveChannelPayload => ({
    platform: PLATFORM,
    cookie: trimmedCookie,
  });

  const validateCookie = () => {
    if (!trimmedCookie) {
      setFormError('กรุณาวางคุกกี้ก่อนตรวจสอบ');
      return false;
    }

    if (!trimmedCookie.includes('=')) {
      setFormError('รูปแบบคุกกี้ไม่ถูกต้อง ควรเป็น key=value; key=value');
      return false;
    }

    return true;
  };

  const checkCookie = async () => {
    if (!validateCookie()) return;

    setChecking(true);
    setFormError(null);
    setCheckResult(null);

    try {
      const result = await onCheckCookie(buildPayload());
      setCheckResult(result);
      setCheckedPayloadKey(payloadKey);

      if (!result.valid) {
        setFormError(result.message ?? 'คุกกี้หมดอายุ หรือไม่สามารถดึงข้อมูลบัญชีได้');
      }
    } catch (err) {
      setCheckedPayloadKey(null);
      setCheckResult(null);
      setFormError(err instanceof Error ? err.message : 'ตรวจสอบคุกกี้ไม่สำเร็จ');
    } finally {
      setChecking(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateCookie()) return;

    if (!canSave) {
      await checkCookie();
      return;
    }

    setFormError(null);
    await onSubmit(buildPayload());
  };

  const accountName = checkResult?.accountName ?? checkResult?.name;
  const accountId = checkResult?.shopId ?? checkResult?.platformUid ?? checkResult?.userId;
  const username = checkResult?.username;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/78 px-4 backdrop-blur-[5px]">
      <form onSubmit={submit} className="relative w-full max-w-[620px] overflow-hidden rounded-[20px] border border-[#c7962d]/65 bg-[radial-gradient(circle_at_8%_0%,rgba(45,167,255,.24),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(242,189,75,.20),transparent_32%),linear-gradient(135deg,#07111f_0%,#05070b_52%,#171004_100%)] px-7 py-7 text-[#f7f1e7] shadow-[0_32px_100px_rgba(0,0,0,.62),0_0_38px_rgba(45,167,255,.10),inset_0_1px_0_rgba(255,255,255,.08)]">
        <button
          type="button"
          onClick={close}
          className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-[12px] border border-[#c7962d]/35 bg-black/25 text-[#d8c8a1] transition hover:border-[#ffd46c] hover:text-[#ffd46c]"
          aria-label="ปิด"
        >
          <X size={20} />
        </button>

        <div className="pr-12"><div className="mb-3 inline-flex items-center rounded-full border border-[#f2bd4b]/45 bg-[#f2bd4b]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-[#ffd46c]">SHOPEE CONNECT</div><h3 className="text-[25px] font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(45,167,255,.18)]">เพิ่มบัญชี Shopee</h3></div>

        <div className="mt-6">
          <label className="mb-2 block text-[15px] font-black text-white">
            คุกกี้ <span className="text-[#ff766f]">*</span>
          </label>
          <textarea
            value={cookie}
            onChange={(event) => {
              setCookie(event.target.value);
              setCheckResult(null);
              setCheckedPayloadKey(null);
            }}
            className="min-h-[170px] w-full resize-y rounded-[14px] border border-[#c7962d]/38 bg-black/45 px-4 py-3 text-[13px] font-medium leading-6 text-white outline-none placeholder:text-[#718199] transition focus:border-[#2da7ff]/75 focus:shadow-[0_0_0_3px_rgba(45,167,255,.16),0_0_24px_rgba(242,189,75,.10)]"
            placeholder="วางคุกกี้จากเบราว์เซอร์ที่ล็อกอิน Shopee อยู่ เช่น SPC_EC=...; SPC_ST=...;"
            disabled={busy}
          />
          <p className="mt-2 text-[12px] font-semibold text-[#9fb1c9]">ชื่อร้าน, Username และ Shop ID จะดึงจาก Shopee API หลังตรวจคุกกี้สำเร็จ</p>
        </div>


        {checkResult?.valid ? (
          <div className="mt-5 rounded-[14px] border border-[#2da7ff]/35 bg-[#061a34]/75 px-4 py-3 text-[13px] font-bold text-[#d7efff] shadow-[0_0_22px_rgba(45,167,255,.12)]">
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="mt-0.5 text-[#f0c15a]" />
              <div>
                <p className="text-[#f0c15a]">ตรวจสอบคุกกี้สำเร็จ พร้อมใช้สร้างสตรีม</p>
                <p className="mt-1 text-[#e7ded2]">ชื่อบัญชี: {accountName || '-'}</p>
                <p className="mt-1 text-[#c9c2b6]">Username: {username || '-'}</p>
                <p className="mt-1 text-[#c9c2b6]">รหัสร้าน/บัญชี: {accountId || '-'}</p>
                <p className="mt-1 text-[#9d968d]">Source: {checkResult.source || '-'}</p>
              </div>
            </div>
          </div>
        ) : null}

        {formError ? <p className="mt-4 rounded-[12px] border border-[#ff766f]/35 bg-[#3a0d11]/55 px-4 py-2 text-[13px] font-bold text-[#ffaaa1]">{formError}</p> : null}

        <div className="mt-7 flex items-center justify-end gap-5">
          <button type="button" onClick={close} disabled={busy} className="rounded-[10px] px-4 py-2 text-[14px] font-bold text-[#d8c8a1] transition hover:text-white disabled:opacity-60">
            ยกเลิก
          </button>
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-[10px] bg-[linear-gradient(135deg,#ffd46c,#e5a928)] px-6 py-2.5 text-[14px] font-black text-[#171004] shadow-[0_12px_28px_rgba(242,189,75,.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70">
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {canSave ? 'บันทึกบัญชี' : 'ตรวจสอบคุกกี้'}
          </button>
        </div>
      </form>
    </div>
  );
}







