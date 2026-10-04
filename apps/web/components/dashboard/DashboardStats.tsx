'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  PackageCheck,
  Radio,
  RefreshCw,
  ShoppingBag,
  Target,
  TrendingUp,
  Users,
  Video,
  Zap,
} from 'lucide-react';
import type { DashboardSummary } from '@/types/dashboard';

type Props = { summary?: DashboardSummary | null; loading?: boolean; error?: string | null; onRefresh?: () => void };
type HealthTone = 'good' | 'warn' | 'info';

const fallbackTrend = [
  { label: 'จันทร์', sales: 0, orders: 0, liveHours: 0 },
  { label: 'อังคาร', sales: 0, orders: 0, liveHours: 0 },
  { label: 'พุธ', sales: 0, orders: 0, liveHours: 0 },
  { label: 'พฤหัส', sales: 0, orders: 0, liveHours: 0 },
  { label: 'ศุกร์', sales: 0, orders: 0, liveHours: 0 },
  { label: 'เสาร์', sales: 0, orders: 0, liveHours: 0 },
  { label: 'วันนี้', sales: 0, orders: 0, liveHours: 0 },
];

function n(value?: number | null) {
  return Number(value || 0).toLocaleString('th-TH');
}

function money(value?: number | null) {
  return `฿${Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
}

function pct(value?: number | null, target?: number | null) {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((Number(value || 0) / target) * 100));
}

function daysLeft(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}

function panelClass(extra = '') {
  return `rounded-[18px] border border-[#c7962d]/40 bg-[linear-gradient(135deg,#07111f,#05070b_58%,#151006)] shadow-[0_20px_58px_rgba(0,0,0,.34)] ${extra}`;
}

function StatCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[14px] border border-[#2b7fc7]/35 bg-[linear-gradient(145deg,rgba(7,20,35,.96),rgba(3,9,18,.98))] p-3 shadow-[0_12px_30px_rgba(0,0,0,.18)] sm:rounded-[16px] sm:p-4">
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-black leading-tight text-[#9fc8f4] sm:text-[12px]">{label}</p>
          <b className="mt-2 block truncate text-[22px] font-black leading-none text-white sm:text-[26px]">{value}</b>
          <p className="mt-2 truncate text-[10px] font-semibold text-[#8f9fb3] sm:text-[11px]">{detail}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-[#f0b429]/35 bg-[#f0b429]/10 text-[#ffd76a] sm:h-10 sm:w-10 sm:rounded-[12px]">{icon}</span>
      </div>
    </div>
  );
}

function HealthItem({ tone, title, detail, href, action }: { tone: HealthTone; title: string; detail: string; href: string; action: string }) {
  const style = tone === 'good'
    ? 'border-[#c7962d]/40 bg-[linear-gradient(135deg,#171008,#07111f_58%,#2a1d08)] text-[#ffd76a]'
    : tone === 'warn'
      ? 'border-[#f0b429]/45 bg-[#2a2108]/80 text-[#ffd76a]'
      : 'border-[#2da7ff]/32 bg-[#082033]/70 text-[#bde6ff]';
  return (
    <Link href={href} className={`group block rounded-[14px] border p-4 transition hover:brightness-110 ${style}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-black text-white">{title}</p>
          <p className="mt-1 text-[12px] font-semibold leading-5 opacity-85">{detail}</p>
        </div>
        <ArrowRight size={17} className="mt-1 shrink-0 transition group-hover:translate-x-1" />
      </div>
      <div className="mt-3 text-[11px] font-black uppercase tracking-[0.12em]">{action}</div>
    </Link>
  );
}

function ProgressRow({ label, value, total, icon }: { label: string; value: number; total: number; icon: ReactNode }) {
  const percent = pct(value, total);
  return (
    <div className="rounded-[14px] border border-white/10 bg-[#040a12]/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-[12px] font-black">
        <span className="flex items-center gap-2 text-[#dceeff]">{icon}{label}</span>
        <span className="text-[#ffd76a]">{n(value)} / {n(total)}</span>
      </div>
      <div className="h-2.5 rounded-full bg-[#1a2636]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#2da7ff,#f0b429)]" style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

function TrendBars({ trend }: { trend: DashboardSummary['performance']['trend'] }) {
  const maxSales = Math.max(1, ...trend.map((item) => item.sales));
  const totalSales = trend.reduce((sum, item) => sum + item.sales, 0);
  const totalOrders = trend.reduce((sum, item) => sum + item.orders, 0);

  return (
    <section className={panelClass('flex h-full flex-col p-5')}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#c7962d]/25 pb-4">
        <div>
          <h2 className="flex items-center gap-2 text-[18px] font-black text-white"><BarChart3 size={19} className="text-[#ffd76a]" /> สรุป 7 วันล่าสุด</h2>
          <p className="mt-1 text-[12px] font-semibold text-[#8f9fb3]">ดูแนวโน้มพอให้รู้ทิศทาง ไม่ถมพื้นที่ด้วยกราฟว่าง</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right">
          <div className="rounded-[12px] border border-[#c7962d]/30 bg-black/25 px-3 py-2"><p className="text-[10px] font-black text-[#9fc8f4]">ยอดรวม</p><b className="text-sm text-[#ffd76a]">{money(totalSales)}</b></div>
          <div className="rounded-[12px] border border-[#2da7ff]/30 bg-[#08264f]/50 px-3 py-2"><p className="text-[10px] font-black text-[#9fc8f4]">ออเดอร์</p><b className="text-sm text-white">{n(totalOrders)}</b></div>
        </div>
      </div>
      <div className="grid min-h-[360px] flex-1 grid-cols-7 items-end gap-3 rounded-[14px] border border-white/10 bg-[#030912]/75 px-4 pb-4 pt-8">
        {trend.map((item) => {
          const height = item.sales <= 0 ? 8 : Math.max(14, Math.round((item.sales / maxSales) * 280));
          return (
            <div key={item.label} className="flex h-full min-w-0 flex-col justify-end gap-2 text-center">
              <div className="text-[11px] font-black text-[#ffd76a]">{money(item.sales)}</div>
              <div className="mx-auto w-full max-w-[54px] rounded-t-[10px] border border-[#2da7ff]/30 bg-[linear-gradient(180deg,#f0b429,#2da7ff)] shadow-[0_0_22px_rgba(45,167,255,.18)]" style={{ height }} />
              <div>
                <div className="truncate text-[12px] font-black text-white">{item.label}</div>
                <div className="text-[10px] font-semibold text-[#8f9fb3]">{n(item.orders)} ออเดอร์</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function DashboardStats({ summary, loading, error, onRefresh }: Props) {
  const stats = summary?.stats;
  const perf = summary?.performance;
  const pkg = summary?.package;
  const trend = perf?.trend?.length ? perf.trend.slice(0, 7) : fallbackTrend;
  const liveLimit = pkg?.limits.liveChannels || 1;
  const videoLimit = pkg?.limits.videos || 1;
  const accountLimit = pkg?.limits.accounts || 1;
  const expireLeft = daysLeft(pkg?.expiresAt);
  const revenueTarget = perf?.revenueTarget ?? 0;
  const orderTarget = perf?.orderTarget ?? 0;
  const revenueProgress = pct(perf?.totalSales, revenueTarget);
  const orderProgress = pct(perf?.orders, orderTarget);
  const missingRevenue = Math.max(0, revenueTarget - (perf?.totalSales ?? 0));
  const missingOrders = Math.max(0, orderTarget - (perf?.orders ?? 0));
  const hasLive = (perf?.activeLives ?? 0) > 0;
  const hasVideo = (stats?.videos ?? 0) > 0;
  const hasAccount = (stats?.accounts ?? 0) > 0;

  return (
    <div className="space-y-4 pb-8 text-white sm:space-y-5">
      {error ? <div className="rounded-[12px] border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">{error}</div> : null}

      <section className="overflow-hidden rounded-[18px] border border-[#c7962d]/45 bg-[radial-gradient(circle_at_12%_0%,rgba(45,167,255,.20),transparent_34%),linear-gradient(135deg,#071a31_0%,#05070b_56%,#211604_100%)] p-4 shadow-[0_22px_58px_rgba(0,0,0,.38)] sm:rounded-[20px] sm:p-6 sm:shadow-[0_28px_76px_rgba(0,0,0,.42)]">
        <div className="flex items-center justify-between gap-3 sm:flex-wrap sm:gap-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] border border-[#2da7ff]/45 bg-[#08264f] text-[#bde6ff] sm:h-14 sm:w-14 sm:rounded-[14px]"><Radio size={22} /></span>
            <div>
              <p className="hidden rounded-full border border-[#f0b429]/35 bg-[#f0b429]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#ffd76a] sm:inline-flex">NP LIVE Command Center</p>
              <h1 className="text-[27px] font-black leading-none text-white sm:mt-3 sm:text-[34px]">แดชบอร์ดวันนี้</h1>
              <p className="mt-1 max-w-[250px] text-[12px] font-semibold leading-5 text-[#9fc8f4] sm:mt-2 sm:max-w-none sm:text-[13px]">พร้อมขายแค่ไหน ดูตรงนี้ก่อน</p>
            </div>
          </div>
          <button type="button" onClick={onRefresh} disabled={loading} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[12px] border border-[#ffe08a]/35 bg-[linear-gradient(135deg,#f7c33d,#e49b13)] px-3 text-[0px] font-black text-[#130d00] shadow-[0_12px_28px_rgba(228,155,19,.22)] transition hover:brightness-110 disabled:opacity-60 sm:px-5 sm:text-[13px]"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /><span className="hidden sm:inline">รีเฟรชข้อมูล</span></button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={<TrendingUp size={20} />} label="ยอดขายวันนี้" value={loading ? '...' : money(perf?.totalSales)} detail={`เป้าหมาย ${money(revenueTarget)}`} />
        <StatCard icon={<ShoppingBag size={20} />} label="ออเดอร์วันนี้" value={loading ? '...' : `${n(perf?.orders)} รายการ`} detail={`ขาดอีก ${n(missingOrders)} รายการ`} />
        <StatCard icon={<Users size={20} />} label="ผู้ชมรวม" value={loading ? '...' : `${n(perf?.viewers)} คน`} detail={`Conversion ${n(perf?.conversionRate)}%`} />
        <StatCard icon={<Clock3 size={20} />} label="ชั่วโมงไลฟ์" value={loading ? '...' : `${n(perf?.liveHours)} ชม.`} detail={`ยอด/ชม. ${money(perf?.salesPerHour)}`} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.08fr_.92fr]">
        <div className="grid gap-5 xl:grid-rows-[auto_1fr]">
          <section className={panelClass('p-5')}>
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#c7962d]/25 pb-4">
              <div>
                <h2 className="flex items-center gap-2 text-[18px] font-black text-white"><Zap size={19} className="text-[#ffd76a]" /> งานที่ควรทำก่อน</h2>
                <p className="mt-1 text-[12px] font-semibold text-[#8f9fb3]">ตัดของฟุ้งออก เหลือแค่ action ที่พาไปทำงานต่อ</p>
              </div>
              <span className="rounded-full border border-[#2da7ff]/35 bg-[#08264f]/60 px-3 py-1 text-[11px] font-black text-[#bde6ff]">วันนี้</span>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <HealthItem tone={hasAccount ? 'good' : 'warn'} title={hasAccount ? 'บัญชีพร้อม' : 'เพิ่มบัญชีร้าน'} detail={hasAccount ? `มีบัญชี ${n(stats?.accounts)} บัญชี` : 'ยังไม่มีบัญชีสำหรับเริ่มงาน'} href="/accounts" action="เปิดบัญชีร้าน" />
              <HealthItem tone={hasVideo ? 'good' : 'warn'} title={hasVideo ? 'คลังพร้อมใช้' : 'เติมวิดีโอ'} detail={hasVideo ? `มีวิดีโอ ${n(stats?.videos)} คลิป` : 'ยังไม่มีวิดีโอสำหรับไลฟ์'} href="/storage" action="เปิดคลังวิดีโอ" />
              <HealthItem tone={hasLive ? 'good' : 'info'} title={hasLive ? 'กำลังไลฟ์อยู่' : 'เริ่มไลฟ์'} detail={hasLive ? `${n(perf?.activeLives)} ช่องกำลังทำงาน` : 'ยังไม่มีช่องที่กำลังไลฟ์'} href="/accounts" action="จัดการช่องไลฟ์" />
            </div>
          </section>

          <TrendBars trend={trend} />
        </div>

        <aside className="grid gap-5 xl:grid-rows-[auto_1fr]">
          <section className={panelClass('p-5')}>
            <h2 className="mb-4 flex items-center gap-2 border-b border-[#c7962d]/25 pb-4 text-[18px] font-black text-white"><Target size={19} className="text-[#ffd76a]" /> เป้าหมายวันนี้</h2>
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-[12px] font-black"><span className="text-[#dceeff]">ยอดขาย</span><span className="text-[#ffd76a]">{revenueProgress}%</span></div>
                <div className="h-3 rounded-full bg-[#1a2636]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#2da7ff,#f0b429)]" style={{ width: `${revenueProgress}%` }} /></div>
                <p className="mt-2 text-[12px] font-semibold text-[#8f9fb3]">ขาดอีก {money(missingRevenue)}</p>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-[12px] font-black"><span className="text-[#dceeff]">ออเดอร์</span><span className="text-[#ffd76a]">{orderProgress}%</span></div>
                <div className="h-3 rounded-full bg-[#1a2636]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#f0b429,#2da7ff)]" style={{ width: `${orderProgress}%` }} /></div>
                <p className="mt-2 text-[12px] font-semibold text-[#8f9fb3]">ขาดอีก {n(missingOrders)} รายการ</p>
              </div>
            </div>
          </section>

          <section className={panelClass('flex h-full flex-col p-5')}>
            <h2 className="mb-4 flex items-center gap-2 border-b border-[#c7962d]/25 pb-4 text-[18px] font-black text-white"><PackageCheck size={19} className="text-[#ffd76a]" /> แพ็กเกจและโควตา</h2>
            <div className="mb-4 rounded-[14px] border border-[#f0b429]/35 bg-[#2a2108]/60 p-4">
              <p className="text-[12px] font-black text-[#ffd76a]">แพ็กเกจปัจจุบัน</p>
              <div className="mt-1 flex items-end justify-between gap-3"><b className="text-[24px] font-black text-white">{pkg?.name || '-'}</b><span className="text-[12px] font-bold text-[#9fc8f4]">เหลือ {expireLeft === null ? '-' : Math.max(0, expireLeft)} วัน</span></div>
            </div>
            <div className="space-y-3">
              <ProgressRow label="บัญชีร้าน" value={stats?.accounts ?? 0} total={accountLimit} icon={<Users size={15} />} />
              <ProgressRow label="ช่องไลฟ์" value={stats?.liveChannels ?? 0} total={liveLimit} icon={<Radio size={15} />} />
              <ProgressRow label="คลังวิดีโอ" value={stats?.videos ?? 0} total={videoLimit} icon={<Video size={15} />} />
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

