'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, CircleDollarSign, Loader2, RefreshCw, Wallet, X } from 'lucide-react';
import { adminService } from '@/services/admin.service';
import type { AdminPayment } from '@/types/admin';
import { AdminButton } from './AdminButton';
import { AdminPopupNotice } from './AdminPopupNotice';

function baht(value: number) {
  return `฿${Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
}

function nameOf(item: AdminPayment) {
  return item.user?.displayName || item.user?.username || item.user?.email || 'ไม่พบลูกค้า';
}

function dateText(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function statusClass(status: string) {
  if (status === 'PAID') return 'border-[#2d8b55] bg-[#0b2917] text-[#9df0bd]';
  if (status === 'REJECTED') return 'border-[#a51f28] bg-[#3b0d11] text-[#ffbbb5]';
  return 'border-[#b88122] bg-[#2b2113] text-[#ffd37c]';
}

export function PaymentsClient() {
  const [items, setItems] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await adminService.payments());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดรายการชำระเงินไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => {
    const pending = items.filter((item) => item.status === 'PENDING').length;
    const paid = items.filter((item) => item.status === 'PAID');
    const rejected = items.filter((item) => item.status === 'REJECTED').length;
    return {
      pending,
      rejected,
      paidCount: paid.length,
      paidTotal: paid.reduce((sum, item) => sum + Number(item.amountBaht || 0), 0),
    };
  }, [items]);

  async function updateStatus(item: AdminPayment, status: 'PAID' | 'REJECTED' | 'PENDING') {
    setSavingId(item.id);
    setMessage(null);
    setError(null);
    try {
      await adminService.updatePayment(item.id, { status });
      setMessage(`บันทึกสถานะ ${nameOf(item)} เป็น ${status} แล้ว`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกรายการชำระเงินไม่สำเร็จ');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <AdminPopupNotice
        message={error ?? message}
        tone={error ? 'error' : 'success'}
        onClose={() => {
          setError(null);
          setMessage(null);
        }}
      />

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#274262] bg-[#071320] p-4">
        <div>
          <h2 className="text-[18px] font-black">ตรวจรายการเติมเงิน</h2>
          <p className="mt-1 text-[13px] font-bold text-[#95a9c4]">ดูยอด ลูกค้า ช่องทาง อ้างอิง และสถานะรายการ</p>
        </div>
        <AdminButton variant="ghost" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> รีเฟรช
        </AdminButton>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <article className="rounded-[10px] border border-[#274262] bg-[#071320] p-4"><div className="text-[12px] font-black text-[#95a9c4]">รอตรวจ</div><div className="mt-2 text-[28px] font-black">{stats.pending}</div></article>
        <article className="rounded-[10px] border border-[#2d8b55] bg-[#0b2917] p-4"><div className="text-[12px] font-black text-[#95a9c4]">ชำระแล้ว</div><div className="mt-2 text-[28px] font-black">{stats.paidCount}</div></article>
        <article className="rounded-[10px] border border-[#274262] bg-[#071320] p-4"><div className="text-[12px] font-black text-[#95a9c4]">ยอดรับแล้ว</div><div className="mt-2 text-[28px] font-black">{baht(stats.paidTotal)}</div></article>
        <article className="rounded-[10px] border border-[#a51f28] bg-[#3b0d11] p-4"><div className="text-[12px] font-black text-[#ffbbb5]">ปฏิเสธ</div><div className="mt-2 text-[28px] font-black">{stats.rejected}</div></article>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        {loading ? <div className="rounded-[10px] border border-[#274262] bg-[#071320] p-8 text-center text-[#95a9c4]"><Loader2 className="mx-auto mb-2 animate-spin text-[#f0b728]" />กำลังโหลด...</div> : null}
        {!loading && items.length === 0 ? (
          <div className="rounded-[10px] border border-[#274262] bg-[#071320] p-8 text-center text-sm font-bold text-[#95a9c4]">ยังไม่มีรายการชำระเงิน</div>
        ) : null}
        {!loading && items.map((item) => (
          <article key={item.id} className="rounded-[10px] border border-[#274262] bg-[#071320] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-[9px] bg-[#071a31] text-[#f0b728]"><Wallet size={19} /></span>
                <div>
                  <h3 className="text-[18px] font-black text-white">{nameOf(item)}</h3>
                  <p className="mt-1 text-[12px] font-bold text-[#95a9c4]">{item.user?.email ?? '-'} · {dateText(item.createdAt)}</p>
                </div>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${statusClass(item.status)}`}>{item.status}</span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-[8px] border border-[#203a5a] bg-[#081421] p-3"><div className="text-[11px] font-black text-[#95a9c4]">ยอดเงิน</div><b className="mt-1 block text-[22px] text-white">{baht(item.amountBaht)}</b></div>
              <div className="rounded-[8px] border border-[#203a5a] bg-[#081421] p-3"><div className="text-[11px] font-black text-[#95a9c4]">ช่องทาง</div><b className="mt-1 block truncate text-[14px] text-white">{item.method || '-'}</b></div>
              <div className="rounded-[8px] border border-[#203a5a] bg-[#081421] p-3"><div className="text-[11px] font-black text-[#95a9c4]">อ้างอิง</div><b className="mt-1 block truncate text-[14px] text-white">{item.reference || '-'}</b></div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <AdminButton variant="gold" onClick={() => void updateStatus(item, 'PAID')} disabled={savingId === item.id || item.status === 'PAID'}>
                {savingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} ชำระแล้ว
              </AdminButton>
              <AdminButton
                variant="ghost"
                className="border-[#a51f28] bg-[#3b0d11] text-[#ffbbb5] hover:border-[#e0525b]"
                onClick={() => void updateStatus(item, 'REJECTED')}
                disabled={savingId === item.id || item.status === 'REJECTED'}
              >
                <X size={14} /> ปฏิเสธ
              </AdminButton>
              <AdminButton variant="ghost" onClick={() => void updateStatus(item, 'PENDING')} disabled={savingId === item.id || item.status === 'PENDING'}>
                <CircleDollarSign size={14} /> รอตรวจ
              </AdminButton>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
