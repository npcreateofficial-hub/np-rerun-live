'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BellRing, Loader2, Send, UserPlus, Users } from 'lucide-react';
import { adminService } from '@/services/admin.service';
import type { AdminSummary } from '@/types/admin';
import { AdminPopupNotice } from './AdminPopupNotice';

function StatTile({ label, value, hint, tone = 'normal' }: { label: string; value: string; hint: string; tone?: 'normal' | 'danger' | 'gold' }) {
  return (
    <article className={`rounded-[10px] border p-5 shadow-[0_18px_44px_rgba(0,0,0,.18)] ${tone === 'danger' ? 'border-[#a51f28] bg-[#2a0d10]' : tone === 'gold' ? 'border-[#f0b728] bg-gradient-to-br from-[#0b1d32] to-[#1c1608]' : 'border-[#274262] bg-gradient-to-br from-[#071320] to-[#060b12]'}`}>
      <div className="text-[12px] font-black text-[#95a9c4]">{label}</div>
      <div className="mt-3 text-[32px] font-black leading-none text-white">{value}</div>
      <div className="mt-3 text-[12px] font-bold text-[#b8c7da]">{hint}</div>
    </article>
  );
}

function ActionCard({ href, icon: Icon, title, detail }: { href: string; icon: typeof Send; title: string; detail: string }) {
  return (
    <Link href={href} className="group flex min-h-[92px] items-center justify-between rounded-[10px] border border-[#274262] bg-gradient-to-br from-[#071320] to-[#060b12] px-5 py-4 shadow-[0_18px_44px_rgba(0,0,0,.18)] hover:border-[#0b79ff]">
      <div className="flex items-center gap-4">
        <span className="grid h-11 w-11 place-items-center rounded-[9px] border border-[#274262] bg-[#071a31] text-[#f0b728]">
          <Icon size={19} />
        </span>
        <span>
          <b className="block text-[15px]">{title}</b>
          <span className="mt-1 block text-[12px] font-semibold text-[#95a9c4]">{detail}</span>
        </span>
      </div>
      <ArrowRight size={18} className="text-[#5e7da2] group-hover:text-[#f0b728]" />
    </Link>
  );
}

export function DashboardClient() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setSummary(await adminService.summary());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลหลังบ้านไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const maxPackageCount = useMemo(() => Math.max(1, ...(summary?.packageBreakdown.map((item) => item.count) ?? [1])), [summary]);
  const marketing = summary?.marketing ?? {};
  const pipeline = [
    { label: 'ใหม่', key: 'NEW', color: '#e3aa3a' },
    { label: 'ต้องตาม', key: 'FOLLOW_UP', color: '#ff6b4a' },
    { label: 'สนใจ', key: 'INTERESTED', color: '#58d68d' },
    { label: 'ใช้งานถาวร', key: 'RENEWED', color: '#5dade2' },
  ];

  if (loading && !summary) {
    return <div className="rounded-[10px] border border-[#274262] bg-[#071320] p-8 text-center text-[#95a9c4]"><Loader2 className="mx-auto mb-2 animate-spin text-[#f0b728]" />กำลังโหลด...</div>;
  }

  return (
    <div className="space-y-6">
      <AdminPopupNotice message={error} tone="error" onClose={() => setError(null)} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatTile label="ลูกค้าทั้งหมด" value={String(summary?.users.total ?? 0)} hint={`เปิดใช้งาน ${summary?.users.active ?? 0} บัญชี`} />
        <StatTile label="เปิดใช้งาน" value={String(summary?.users.active ?? 0)} hint="พร้อมใช้งานด้วยไลเซนส์" tone="gold" />
        <StatTile label="หยุดใช้งาน" value={String(Math.max(0, (summary?.users.total ?? 0) - (summary?.users.active ?? 0)))} hint="บัญชีที่แอดมินปิดไว้" />
        <StatTile label="ช่องไลฟ์ออนไลน์" value={String(summary?.live.online ?? 0)} hint="กำลังทำงานตอนนี้" tone="gold" />
        <StatTile label="วิดีโอพร้อมใช้" value={String(summary?.videos.ready ?? 0)} hint="ไฟล์พร้อมรันไลฟ์" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[10px] border border-[#274262] bg-gradient-to-br from-[#071320] to-[#060b12] p-5 shadow-[0_18px_44px_rgba(0,0,0,.18)]">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-[18px] font-black">สิทธิ์ที่ลูกค้าใช้อยู่</h2>
            <Link href="/packages" className="text-[12px] font-black text-[#f0b728]">จัดสิทธิ์</Link>
          </div>
          <div className="space-y-4">
            {(summary?.packageBreakdown ?? []).map((item) => (
              <div key={item.packageId ?? 'none'} className="grid gap-2">
                <div className="flex justify-between text-sm">
                  <span className="font-black">{item.packageName}</span>
                  <span className="text-[#f0b728]">{item.count} บัญชี</span>
                </div>
                <div className="h-3 rounded-full bg-[#0b2238]">
                  <div className="h-3 rounded-full bg-gradient-to-r from-[#0b79ff] to-[#f0b728]" style={{ width: `${Math.max(8, (item.count / maxPackageCount) * 100)}%` }} />
                </div>
              </div>
            ))}
            {(summary?.packageBreakdown.length ?? 0) === 0 ? <div className="py-8 text-center text-sm font-semibold text-[#95a9c4]">ยังไม่มีข้อมูลสิทธิ์ใช้งาน</div> : null}
          </div>
        </section>

        <section className="rounded-[10px] border border-[#274262] bg-gradient-to-br from-[#071320] to-[#060b12] p-5 shadow-[0_18px_44px_rgba(0,0,0,.18)]">
          <h2 className="mb-5 text-[18px] font-black">สถานะการขาย</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {pipeline.map((item) => (
              <div key={item.key} className="rounded-[9px] border border-[#203a5a] bg-[#081421] p-4">
                <div className="text-[12px] font-bold text-[#95a9c4]">{item.label}</div>
                <div className="mt-2 flex items-end justify-between">
                  <b className="text-[28px] leading-none">{marketing[item.key] ?? 0}</b>
                  <span className="h-8 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="grid gap-4 lg:grid-cols-4">
        <ActionCard href="/users" icon={Users} title="จัดการลูกค้า" detail="ออกไลเซนส์ User และ Password จากหลังบ้าน" />
        <ActionCard href="/users?filter=active" icon={UserPlus} title="บัญชีพร้อมใช้งาน" detail="ดูบัญชีที่เปิดใช้งานอยู่ตอนนี้" />
        <ActionCard href="/notifications" icon={BellRing} title="ส่งประกาศ" detail="แจ้งข่าวหรือข้อความถึงลูกค้าในระบบ" />
      </section>
    </div>
  );
}
