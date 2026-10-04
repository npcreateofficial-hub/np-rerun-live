'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Loader2 } from 'lucide-react';
import { setAuthTokens, clearAuthTokens } from '@/lib/auth';
import { authService } from '@/services/auth.service';
import { AdminButton } from './AdminButton';
import { AdminPopupNotice } from './AdminPopupNotice';

export function LoginClient() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState('demo@nplive.local');
  const [password, setPassword] = useState('demo1234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const session = await authService.login(email, password);
      if (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF') {
        clearAuthTokens();
        setError('บัญชีนี้ไม่มีสิทธิ์เข้าเว็บหลังบ้าน');
        return;
      }
      setAuthTokens(session.accessToken, session.refreshToken);
      router.replace(search.get('redirect') || '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เข้าสู่ระบบหลังบ้านไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <AdminPopupNotice message={error} tone="error" onClose={() => setError(null)} />

      <form onSubmit={submit} className="w-full max-w-[460px] rounded-[14px] border border-[#274262] bg-[#071320] p-8 shadow-[0_24px_70px_rgba(0,0,0,.38)]">
        <div className="mb-7">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-[12px] border border-[#1ba7ff] bg-[#063c9a]">
            <Lock size={25} />
          </div>
          <h1 className="text-[30px] font-black">NP LIVE Admin</h1>
          <p className="mt-2 text-[13px] font-semibold text-[#95a9c4]">หลังบ้านแยกสำหรับจัดการลูกค้า แพ็กเกจ และระบบขายงาน</p>
        </div>
        <div className="space-y-4">
          <label className="block text-[13px] font-black text-[#c9c2b6]">
            อีเมล
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 h-11 w-full rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-[#f7f1e7]" />
          </label>
          <label className="block text-[13px] font-black text-[#c9c2b6]">
            รหัสผ่าน
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 h-11 w-full rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-[#f7f1e7]" />
          </label>
        </div>
        <AdminButton className="mt-6 w-full" disabled={loading || !email || !password}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
          เข้าหลังบ้าน
        </AdminButton>
      </form>
    </main>
  );
}
