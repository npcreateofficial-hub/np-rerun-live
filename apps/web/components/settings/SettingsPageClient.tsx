'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole } from 'lucide-react';
import { userService } from '@/services/user.service';
import { clearAuthTokens } from '@/lib/auth';

const fieldClass =
  'h-12 w-full rounded-[10px] border border-[#2c8fe8]/25 bg-[#040a12]/80 px-4 text-[13px] font-semibold text-[#f8fbff] outline-none placeholder:text-[#6d86a7] transition focus:border-[#f0b429] focus:shadow-[0_0_0_3px_rgba(240,180,41,.14)]';
const labelClass = 'mb-2 flex items-center gap-2 text-[12px] font-black text-[#b9d9ff]';

type PasswordField = {
  label: string;
  value: string;
  setter: (value: string) => void;
  show: boolean;
  setShow: (value: boolean) => void;
  placeholder: string;
};

export function SettingsPageClient() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fields: PasswordField[] = [
    { label: 'รหัสผ่านปัจจุบัน', value: currentPassword, setter: setCurrentPassword, show: showCurrentPassword, setShow: setShowCurrentPassword, placeholder: 'กรอกรหัสผ่านปัจจุบัน' },
    { label: 'รหัสผ่านใหม่', value: newPassword, setter: setNewPassword, show: showNewPassword, setShow: setShowNewPassword, placeholder: 'กรอกรหัสผ่านใหม่' },
    { label: 'ยืนยันรหัสผ่านใหม่', value: confirmPassword, setter: setConfirmPassword, show: showConfirmPassword, setShow: setShowConfirmPassword, placeholder: 'กรอกรหัสผ่านใหม่อีกครั้ง' },
  ];
  const passwordChecks = [
    { label: 'รหัสผ่านปัจจุบันครบถ้วน', ok: currentPassword.trim().length > 0 },
    { label: `${newPassword.length}/8 ตัวอักษร`, ok: newPassword.length >= 8 },
    { label: 'มีตัวอักษร', ok: /[A-Za-zก-ฮะ-์]/.test(newPassword) },
    { label: 'มีตัวเลข', ok: /\d/.test(newPassword) },
    { label: 'ยืนยันรหัสผ่านตรงกัน', ok: confirmPassword.length > 0 && newPassword === confirmPassword },
  ];

  async function onChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('ยืนยันรหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }

    setSaving(true);
    try {
      await userService.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่');
      clearAuthTokens();
      setTimeout(() => router.replace('/login'), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-110px)] max-w-[1180px] items-center px-6 py-10">
      <section className="w-full overflow-hidden rounded-[18px] border border-[#d6a51f]/45 bg-[#03070d] shadow-[0_30px_90px_rgba(0,0,0,.42)]">
        <div className="border-b border-[#d6a51f]/25 bg-[linear-gradient(135deg,#071a31_0%,#05080d_58%,#211604_100%)] px-7 py-6">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-[14px] border border-[#1da1ff]/45 bg-[#08213a] text-[#bde6ff] shadow-[0_0_30px_rgba(29,161,255,.14)]">
                <LockKeyhole size={25} />
              </span>
              <div>
                <p className="inline-flex rounded-full border border-[#d6a51f]/35 bg-[#d6a51f]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#f0b429]">
                  NP LIVE SECURITY
                </p>
                <h1 className="mt-3 text-[28px] font-black tracking-tight text-white">เปลี่ยนรหัสผ่าน</h1>
                <p className="mt-1 text-[13px] font-semibold text-[#9fc8f4]">จัดการรหัสผ่านบัญชีให้ปลอดภัยในโทนเดียวกับระบบทีมไลฟ์</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-7 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form onSubmit={onChangePassword} className="rounded-[16px] border border-[#2c8fe8]/35 bg-[#071423] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
            <div className="mb-5 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-[18px] font-black text-white">ตั้งรหัสผ่านใหม่</h2>
                <p className="mt-1 text-[12px] font-semibold text-[#8eb6df]">กรอกข้อมูลให้ครบ 3 ช่อง แล้วกดบันทึก</p>
              </div>
              <span className="rounded-full border border-[#f0b429]/35 bg-[#f0b429]/10 px-3 py-1 text-[11px] font-black text-[#ffd76a]">ACCOUNT</span>
            </div>

            <div className="space-y-5">
              {fields.map((field) => (
                <div key={field.label}>
                  <label className={labelClass}><KeyRound size={14} /> {field.label}</label>
                  <div className="relative">
                    <input
                      type={field.show ? 'text' : 'password'}
                      value={field.value}
                      onChange={(event) => field.setter(event.target.value)}
                      className={`${fieldClass} pr-11`}
                      placeholder={field.placeholder}
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => field.setShow(!field.show)}
                      className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-[8px] text-[#7f9ec0] transition hover:bg-[#0d2238] hover:text-[#f0b429]"
                      aria-label={field.show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    >
                      {field.show ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {error ? <div className="mt-5 rounded-[10px] border border-red-400/35 bg-red-500/10 px-4 py-3 text-[13px] font-semibold text-red-100">{error}</div> : null}
            {message ? <div className="mt-5 rounded-[10px] border border-[#27d17f]/35 bg-[#062818] px-4 py-3 text-[13px] font-semibold text-[#83f5b5]">{message}</div> : null}

            <button
              type="submit"
              disabled={saving}
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] border border-[#ffe08a]/35 bg-[linear-gradient(135deg,#f7c33d,#e49b13)] text-[13px] font-black text-[#130d00] shadow-[0_14px_34px_rgba(228,155,19,.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <KeyRound size={17} /> {saving ? 'กำลังเปลี่ยน...' : 'เปลี่ยนรหัสผ่าน'}
            </button>
          </form>

          <aside className="rounded-[16px] border border-[#d6a51f]/35 bg-[linear-gradient(180deg,#10100c,#06080d)] p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-[12px] border border-[#f0b429]/35 bg-[#f0b429]/10 text-[#ffd76a]">
                <KeyRound size={20} />
              </span>
              <div>
                <h2 className="text-[16px] font-black text-white">เช็กรหัสผ่าน</h2>
                <p className="mt-1 text-[12px] font-semibold text-[#9fc8f4]">ดูสถานะจากข้อมูลที่กรอก</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {passwordChecks.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-3 rounded-[10px] border px-3 py-3 text-[12px] font-bold transition ${
                    item.ok
                      ? 'border-[#27d17f]/35 bg-[#062818] text-[#dfffea]'
                      : 'border-white/10 bg-[#071423] text-[#9fc8f4]'
                  }`}
                >
                  {item.ok ? (
                    <CheckCircle2 size={16} className="text-[#6ff0aa]" />
                  ) : (
                    <span className="h-4 w-4 rounded-full border border-[#5b7190] bg-[#03070d]" />
                  )}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
