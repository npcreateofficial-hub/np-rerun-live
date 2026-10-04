'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Globe2, Plus, RefreshCw, Search, ShieldCheck, Trash2, Wifi, XCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { AddProxyDialog } from '@/components/proxy/AddProxyDialog';
import { useProxies } from '@/hooks/useProxies';
import type { ProxyItem, ProxyStatus } from '@/types/proxy';

const statusLabel: Record<ProxyStatus, string> = {
  UNKNOWN: 'รอตรวจสอบ',
  ACTIVE: 'พร้อมใช้งาน',
  INACTIVE: 'ใช้ไม่ได้',
};

const statusClass: Record<ProxyStatus, string> = {
  UNKNOWN: 'border-[#c7962d]/35 bg-black/35 text-[#d8c8a1]',
  ACTIVE: 'border-[#51f0ba]/45 bg-[#05231c] text-[#9fffd9]',
  INACTIVE: 'border-[#ff766f]/45 bg-[#351015] text-[#ffaaa1]',
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function hostLabel(item: ProxyItem) {
  return `${item.host}:${item.port}`;
}

function ProxyStatCard({ label, value, tone }: { label: string; value: string | number; tone: 'gold' | 'blue' | 'green' }) {
  const toneClass = {
    gold: 'border-[#c7962d]/45 bg-[linear-gradient(145deg,rgba(26,18,6,.95),rgba(5,6,9,.98))] text-[#ffd46c]',
    blue: 'border-[#2da7ff]/40 bg-[linear-gradient(145deg,rgba(6,25,48,.95),rgba(5,6,9,.98))] text-[#7fd0ff]',
    green: 'border-[#51f0ba]/35 bg-[linear-gradient(145deg,rgba(5,32,25,.88),rgba(5,6,9,.98))] text-[#9fffd9]',
  }[tone];

  return (
    <div className={`rounded-[16px] border p-4 shadow-[0_18px_42px_rgba(0,0,0,.26)] ${toneClass}`}>
      <div className="text-xs font-bold text-[#9fb1c9]">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

export function ProxyPageClient() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProxyItem | null>(null);
  const {
    items,
    filteredItems,
    usage,
    query,
    setQuery,
    loading,
    saving,
    error,
    load,
    createProxy,
    checkProxy,
    removeProxy,
  } = useProxies();

  const activeCount = useMemo(() => items.filter((item) => item.status === 'ACTIVE').length, [items]);
  const unknownCount = useMemo(() => items.filter((item) => item.status === 'UNKNOWN').length, [items]);
  const proxyUnlimited = Boolean(usage?.unlimited);
  const usagePercent = proxyUnlimited ? 100 : usage && usage.limit && usage.limit > 0 ? Math.min(100, (usage.used / usage.limit) * 100) : 0;

  async function confirmRemove() {
    if (!deleteTarget) return;
    await removeProxy(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <AppShell>
      <div className="page-pad min-h-screen bg-[radial-gradient(circle_at_14%_0%,rgba(11,121,255,.08),transparent_28%),radial-gradient(circle_at_92%_2%,rgba(242,189,75,.08),transparent_30%)]">
        <section className="relative overflow-hidden rounded-[22px] border border-[#c7962d]/45 bg-[radial-gradient(circle_at_10%_0%,rgba(45,167,255,.22),transparent_34%),radial-gradient(circle_at_92%_10%,rgba(242,189,75,.22),transparent_32%),linear-gradient(135deg,#07111f_0%,#05070b_56%,#171004_100%)] p-6 shadow-[0_24px_70px_rgba(0,0,0,.42),inset_0_1px_0_rgba(255,255,255,.07)]">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,#ffd46c,#0b79ff,#38bdf8)] text-white shadow-[0_16px_40px_rgba(11,121,255,.22)]">
                <ShieldCheck size={27} />
              </div>
              <div>
                <div className="inline-flex h-7 items-center rounded-full border border-[#ffd46c]/35 bg-black/30 px-3 text-[11px] font-black uppercase tracking-[.18em] text-[#ffd46c]">NP LIVE PROXY</div>
                <h1 className="mt-3 text-3xl font-black text-white">จัดการพร็อกซี่สำหรับช่องไลฟ์</h1>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#9fb1c9]">เพิ่ม IP แยกสำหรับแต่ละบัญชี แล้วเลือกใช้ในเมนูแก้ไขบัญชี เพื่อลดการใช้ IP ซ้ำระหว่างช่อง</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              disabled={usage ? !usage.canCreate : false}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#1ba7ff] bg-gradient-to-b from-[#0b79ff] to-[#063c9a] px-5 text-sm font-black text-white shadow-[0_16px_34px_rgba(11,121,255,.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={17} /> เพิ่มพร็อกซี่
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <ProxyStatCard label="พร็อกซี่ทั้งหมด" value={proxyUnlimited ? `${usage?.used ?? items.length} / ไม่จำกัด` : `${usage?.used ?? items.length} / ${usage?.limit ?? 0}`} tone="gold" />
            <ProxyStatCard label="พร้อมใช้งาน" value={activeCount} tone="green" />
            <ProxyStatCard label="รอตรวจสอบ" value={unknownCount} tone="blue" />
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#d8c8a1]">
              <span>โควตาพร็อกซี่</span>
              <span>{proxyUnlimited ? 'เพิ่มได้ไม่จำกัด' : `${usage?.remaining ?? 0} รายการที่เพิ่มได้`}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/40">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#ffd46c,#3aa7ff,#0b6cff)] shadow-[0_0_18px_rgba(58,167,255,.24)]" style={{ width: `${usagePercent}%` }} />
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-5 rounded-[14px] border border-[#ff766f]/35 bg-[#3a0d11]/70 px-4 py-3 text-sm font-bold text-[#ffaaa1]">{error}</div>
        ) : null}

        <section className="mt-6 overflow-hidden rounded-[20px] border border-[#c7962d]/35 bg-[radial-gradient(circle_at_8%_0%,rgba(45,167,255,.12),transparent_30%),linear-gradient(145deg,rgba(5,11,20,.96),rgba(3,4,7,.98)_58%,rgba(20,13,4,.94))] p-5 shadow-[0_22px_64px_rgba(0,0,0,.34),inset_0_1px_0_rgba(255,255,255,.05)]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-[360px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7d8da3]" size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#c7962d]/35 bg-black/35 pl-10 pr-4 text-sm font-semibold text-white outline-none placeholder:text-[#7d8da3] focus:border-[#2da7ff]"
                placeholder="ค้นหา IP หรือหมายเหตุ..."
              />
            </div>
            <button type="button" onClick={() => void load()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#c7962d]/35 bg-black/35 px-4 text-xs font-black text-[#ffd46c] hover:border-[#ffd46c]">
              <RefreshCw size={15} /> โหลดข้อมูลใหม่
            </button>
          </div>

          <div className="overflow-hidden rounded-[16px] border border-[#c7962d]/25 bg-black/25">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#c7962d]/25 text-xs font-black uppercase tracking-[.08em] text-[#9fb1c9]">
                  <th className="px-5 py-4">Proxy</th>
                  <th className="px-5 py-4">สถานะ</th>
                  <th className="px-5 py-4">ตรวจล่าสุด</th>
                  <th className="px-5 py-4 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="h-[220px] text-center text-[#9fb1c9]">กำลังโหลดข้อมูล...</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="h-[260px] text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-3 text-[#9fb1c9]">
                        <div className="grid h-16 w-16 place-items-center rounded-2xl border border-[#c7962d]/35 bg-black/35 text-[#ffd46c]"><Globe2 size={30} /></div>
                        <div className="text-xl font-black text-white">ยังไม่มีพร็อกซี่</div>
                        <div className="text-sm font-semibold leading-6">เพิ่มพร็อกซี่ แล้วนำไปผูกกับบัญชีในหน้าแก้ไขบัญชีได้เลย</div>
                      </div>
                    </td>
                  </tr>
                ) : filteredItems.map((item) => (
                  <tr key={item.id} className="border-b border-[#c7962d]/15 text-sm font-semibold text-[#e9dcc0] last:border-b-0 hover:bg-[#07111f]/70">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#2da7ff]/35 bg-[#061a34] text-[#7fd0ff]"><Wifi size={18} /></div>
                        <div>
                          <div className="font-black text-white">{hostLabel(item)}</div>
                          <div className="mt-1 text-xs text-[#9fb1c9]">{item.note || 'ไม่มีหมายเหตุ'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4"><span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${statusClass[item.status]}`}>{item.status === 'ACTIVE' ? <CheckCircle2 size={13} /> : item.status === 'INACTIVE' ? <XCircle size={13} /> : null}{statusLabel[item.status]}</span></td>
                    <td className="px-5 py-4 text-[#9fb1c9]">{formatDateTime(item.checkedAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => void checkProxy(item.id)} className="h-9 rounded-lg border border-[#2da7ff]/35 bg-[#061a34] px-3 text-xs font-black text-[#7fd0ff] hover:border-[#2da7ff]">ตรวจสอบ</button>
                        <button type="button" onClick={() => setDeleteTarget(item)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#ff766f]/35 bg-[#2a0c10] text-[#ffaaa1] hover:border-[#ff766f]" aria-label="ลบพร็อกซี่"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <AddProxyDialog open={dialogOpen} saving={saving} onClose={() => setDialogOpen(false)} onCreate={createProxy} />

        {deleteTarget ? (
          <div className="fixed inset-0 z-[130] grid place-items-center bg-black/70 p-4 backdrop-blur-[5px]">
            <div className="w-full max-w-[430px] rounded-[18px] border border-[#c7962d]/55 bg-[linear-gradient(145deg,#07111f,#050505_58%,#1b1204)] p-5 shadow-[0_30px_90px_rgba(0,0,0,.7)]">
              <div className="text-xl font-black text-white">ลบพร็อกซี่นี้ไหม</div>
              <div className="mt-2 text-sm font-semibold text-[#9fb1c9]">{hostLabel(deleteTarget)}</div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setDeleteTarget(null)} className="h-11 rounded-xl border border-[#c7962d]/35 bg-black/35 text-sm font-black text-white hover:border-[#ffd46c]">ยกเลิก</button>
                <button type="button" onClick={() => void confirmRemove()} className="h-11 rounded-xl border border-[#ff766f]/45 bg-[#3a0d11] text-sm font-black text-[#ffaaa1] hover:border-[#ff766f]">ลบ</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
