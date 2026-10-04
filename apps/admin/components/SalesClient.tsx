'use client';

import { useEffect, useMemo, useState } from 'react';
import { BellRing, CalendarClock, Check, Eye, Loader2, PhoneCall, RefreshCw, Send } from 'lucide-react';
import { adminService, type AdminNotificationPayload } from '@/services/admin.service';
import type { AdminSales, AdminUser } from '@/types/admin';
import { AdminButton } from './AdminButton';
import { AdminModal } from './AdminModal';
import { AdminPopupNotice } from './AdminPopupNotice';

const defaultStyle = {
  cardBg: '#fff7e8',
  titleColor: '#2a1707',
  textColor: '#60472c',
  textBg: '#ffffff',
  buttonBg: '#d9252c',
  buttonColor: '#ffffff',
  titleSize: 20,
  textSize: 14,
  radius: 10,
};

function baht(value: number) {
  return `฿${Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
}

function nameOf(user: AdminUser) {
  return user.displayName || user.username || user.email;
}

function dateInput(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('th-TH');
}

function daysLeft(value?: string | null) {
  if (!value) return null;
  const end = new Date(value);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / 86400000);
}

function baseNotice(mode: 'expiring3' | 'expiring7' | 'expired'): AdminNotificationPayload {
  if (mode === 'expired') {
    return {
      title: 'แพ็กเกจหมดอายุแล้ว',
      message: 'บัญชีของคุณหมดอายุแล้ว ต่ออายุเพื่อกลับมาใช้งาน NP LIVE ได้ทันที',
      type: 'ERROR',
      status: 'SENT',
      ctaLabel: 'ติดต่อแอดมิน',
      ctaUrl: '/packages',
      styleJson: JSON.stringify(defaultStyle),
    };
  }
  return {
    title: mode === 'expiring3' ? 'แพ็กเกจใกล้หมดอายุ 3 วัน' : 'แพ็กเกจใกล้หมดอายุ 7 วัน',
    message: 'แพ็กเกจของคุณใกล้ครบกำหนดใช้งานแล้ว ต่ออายุล่วงหน้าเพื่อให้ระบบไลฟ์ทำงานต่อได้ต่อเนื่อง',
    type: 'WARNING',
    status: 'SENT',
    ctaLabel: 'ต่ออายุแพ็กเกจ',
    ctaUrl: '/packages',
    styleJson: JSON.stringify(defaultStyle),
  };
}

function CustomerCard({ user, mode, onCalled, onNotify, onDetail }: { user: AdminUser; mode: 'expiring' | 'expired'; onCalled: (user: AdminUser) => void; onNotify: (user: AdminUser) => void; onDetail: (user: AdminUser) => void }) {
  const left = daysLeft(user.packageExpiresAt);
  return (
    <article className="rounded-[10px] border border-[#274262] bg-[#071320] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-black text-white">{nameOf(user)}</h3>
          <p className="mt-1 truncate text-[12px] font-semibold text-[#95a9c4]">{user.package?.name ?? 'ไม่มีแพ็กเกจ'} / {user.email}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${mode === 'expired' ? 'border-[#a51f28] bg-[#3b0d11] text-[#ffbbb5]' : 'border-[#d49c32] bg-[#181305] text-[#ffd37c]'}`}>
          {mode === 'expired' ? `เลย ${Math.abs(left ?? 0)} วัน` : `เหลือ ${left ?? '-'} วัน`}
        </span>
      </div>
      <div className="mt-4 grid gap-2 text-[12px] font-bold text-[#b9b0a3] sm:grid-cols-2">
        <span>โทร: <b className="text-white">{user.phone || '-'}</b></span>
        <span>LINE: <b className="text-white">{user.lineId || '-'}</b></span>
        <span>เริ่ม: <b className="text-white">{dateInput(user.packageStartedAt)}</b></span>
        <span>หมด: <b className="text-white">{dateInput(user.packageExpiresAt)}</b></span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <AdminButton variant="ghost" onClick={() => onDetail(user)}><Eye size={14} />ดูข้อมูล</AdminButton>
        <AdminButton variant="ghost" onClick={() => onCalled(user)}><PhoneCall size={14} />โทรแล้ว</AdminButton>
        <AdminButton variant="gold" onClick={() => onNotify(user)}><BellRing size={14} />ส่งแจ้งเตือน</AdminButton>
      </div>
    </article>
  );
}

export function SalesClient() {
  const [sales, setSales] = useState<AdminSales | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);
  const [notifyUsers, setNotifyUsers] = useState<AdminUser[]>([]);
  const [noticeDraft, setNoticeDraft] = useState<AdminNotificationPayload>(baseNotice('expiring3'));

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setSales(await adminService.sales());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดงานต่ออายุไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const expiring3 = useMemo(() => (sales?.expiringUsers ?? []).filter((user) => {
    const left = daysLeft(user.packageExpiresAt);
    return left !== null && left >= 0 && left <= 3;
  }), [sales]);

  const paidTotal = useMemo(() => sales?.recentPayments.reduce((sum, item) => item.status === 'PAID' ? sum + Number(item.amountBaht || 0) : sum, 0) ?? 0, [sales]);

  async function markCalled(user: AdminUser) {
    setSavingId(user.id);
    setError(null);
    setMessage(null);
    try {
      await adminService.updateUser(user.id, {
        marketingStatus: 'FOLLOW_UP',
        lastContactedAt: new Date().toISOString().slice(0, 10),
      });
      setMessage(`บันทึกการโทร ${nameOf(user)} แล้ว`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกสถานะโทรไม่สำเร็จ');
    } finally {
      setSavingId(null);
    }
  }

  function openNotify(users: AdminUser[], mode: 'expiring3' | 'expiring7' | 'expired') {
    setNotifyUsers(users);
    setNoticeDraft(baseNotice(mode));
  }

  async function sendNotice() {
    setSavingId('notice');
    setError(null);
    setMessage(null);
    try {
      await Promise.all(notifyUsers.map((user) => adminService.createNotification({ ...noticeDraft, userId: user.id })));
      setMessage(`ส่งแจ้งเตือนแล้ว ${notifyUsers.length} บัญชี`);
      setNotifyUsers([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งแจ้งเตือนไม่สำเร็จ');
    } finally {
      setSavingId(null);
    }
  }

  if (loading && !sales) {
    return <div className="rounded-[10px] border border-[#274262] bg-[#071320] p-8 text-center text-[#95a9c4]"><Loader2 className="mx-auto mb-2 animate-spin text-[#f0b728]" />กำลังโหลด...</div>;
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#274262] bg-[#071320] p-4">
        <div>
          <h2 className="text-[18px] font-black">ต่ออายุและขายซ้ำ</h2>
          <p className="mt-1 text-[13px] font-semibold text-[#95a9c4]">เห็นทันทีว่าบัญชีไหนใกล้หมด แล้วส่งแจ้งเตือนหรือโทรตามได้ถูกคน</p>
        </div>
        <AdminButton variant="ghost" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />รีเฟรช</AdminButton>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <button onClick={() => openNotify(expiring3, 'expiring3')} className="rounded-[10px] border border-[#a51f28] bg-[#2a0d10] p-5 text-left hover:border-[#ff6b63]">
          <div className="text-[12px] font-black text-[#95a9c4]">ใกล้หมด 3 วัน</div>
          <div className="mt-3 text-[32px] font-black">{expiring3.length}</div>
          <div className="mt-2 text-[12px] font-bold text-[#ffbbb5]">กดเพื่อส่งแจ้งเตือนกลุ่มนี้</div>
        </button>
        <button onClick={() => openNotify(sales?.expiringUsers ?? [], 'expiring7')} className="rounded-[10px] border border-[#d49c32] bg-[#181305] p-5 text-left hover:border-[#0b79ff]">
          <div className="text-[12px] font-black text-[#95a9c4]">ใกล้หมด 7 วัน</div>
          <div className="mt-3 text-[32px] font-black">{sales?.expiringUsers.length ?? 0}</div>
          <div className="mt-2 text-[12px] font-bold text-[#ffd37c]">กดเพื่อส่งแจ้งเตือนกลุ่มนี้</div>
        </button>
        <button onClick={() => openNotify(sales?.expiredUsers ?? [], 'expired')} className="rounded-[10px] border border-[#a51f28] bg-[#2a0d10] p-5 text-left hover:border-[#ff6b63]">
          <div className="text-[12px] font-black text-[#95a9c4]">หมดอายุแล้ว</div>
          <div className="mt-3 text-[32px] font-black">{sales?.expiredUsers.length ?? 0}</div>
          <div className="mt-2 text-[12px] font-bold text-[#ffbbb5]">ควรตามกลับมา</div>
        </button>
      </div>

      <article className="rounded-[10px] border border-[#274262] bg-[#071320] p-5">
        <div className="text-[12px] font-black text-[#95a9c4]">ยอดชำระล่าสุด</div>
        <div className="mt-3 text-[32px] font-black">{baht(paidTotal)}</div>
        <div className="mt-2 text-[12px] font-bold text-[#b9b0a3]">{sales?.recentPayments.length ?? 0} รายการล่าสุด</div>
      </article>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[18px] font-black"><CalendarClock size={18} className="text-[#f0b728]" />ใกล้หมดอายุ</div>
            <AdminButton variant="ghost" onClick={() => openNotify(sales?.expiringUsers ?? [], 'expiring7')}><Send size={14} />ส่งกลุ่มนี้</AdminButton>
          </div>
          {(sales?.expiringUsers ?? []).map((user) => <CustomerCard key={user.id} user={user} mode="expiring" onCalled={(u) => void markCalled(u)} onNotify={(u) => openNotify([u], 'expiring3')} onDetail={setDetailUser} />)}
          {(sales?.expiringUsers.length ?? 0) === 0 ? <div className="rounded-[10px] border border-[#274262] bg-[#071320] p-8 text-center text-sm font-bold text-[#95a9c4]">ยังไม่มีลูกค้าใกล้หมดอายุ</div> : null}
        </section>
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[18px] font-black"><RefreshCw size={18} className="text-[#f0b728]" />หมดอายุแล้ว</div>
            <AdminButton variant="ghost" onClick={() => openNotify(sales?.expiredUsers ?? [], 'expired')}><Send size={14} />ส่งกลุ่มนี้</AdminButton>
          </div>
          {(sales?.expiredUsers ?? []).map((user) => <CustomerCard key={user.id} user={user} mode="expired" onCalled={(u) => void markCalled(u)} onNotify={(u) => openNotify([u], 'expired')} onDetail={setDetailUser} />)}
          {(sales?.expiredUsers.length ?? 0) === 0 ? <div className="rounded-[10px] border border-[#274262] bg-[#071320] p-8 text-center text-sm font-bold text-[#95a9c4]">ยังไม่มีลูกค้าหมดอายุ</div> : null}
        </section>
      </div>

      <AdminModal open={Boolean(detailUser)} title="ข้อมูลลูกค้า" description={detailUser ? nameOf(detailUser) : ''} onClose={() => setDetailUser(null)} widthClass="max-w-2xl">
        {detailUser ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Info label="อีเมล" value={detailUser.email} />
            <Info label="แพ็กเกจ" value={detailUser.package?.name ?? '-'} />
            <Info label="เบอร์โทร" value={detailUser.phone || '-'} />
            <Info label="LINE" value={detailUser.lineId || '-'} />
            <Info label="วันเริ่มใช้งาน" value={dateInput(detailUser.packageStartedAt)} />
            <Info label="วันหมดอายุ" value={dateInput(detailUser.packageExpiresAt)} />
            <div className="rounded-[8px] border border-[#203a5a] bg-[#081421] p-3 md:col-span-2"><div className="text-[12px] text-[#95a9c4]">โน้ต</div><div className="mt-1 whitespace-pre-wrap font-black text-white">{detailUser.adminNote || '-'}</div></div>
            <AdminButton className="md:col-span-2" variant="gold" onClick={() => openNotify([detailUser], daysLeft(detailUser.packageExpiresAt) !== null && (daysLeft(detailUser.packageExpiresAt) ?? 9) < 0 ? 'expired' : 'expiring3')}><BellRing size={14} />ส่งแจ้งเตือนบัญชีนี้</AdminButton>
          </div>
        ) : null}
      </AdminModal>

      <AdminModal open={notifyUsers.length > 0} title="ส่งแจ้งเตือนต่ออายุ" description={`เป้าหมาย ${notifyUsers.length} บัญชี`} onClose={() => setNotifyUsers([])} widthClass="max-w-3xl">
        <div className="grid gap-4">
          <div className="max-h-36 overflow-auto rounded-[8px] border border-[#203a5a] bg-[#081421] p-3 text-[12px] font-bold text-[#c9c2b6]">
            {notifyUsers.map((user) => <div key={user.id} className="flex justify-between gap-3 border-b border-[#203a5a] py-2 last:border-0"><span>{nameOf(user)}</span><span className="text-[#f0b728]">{dateInput(user.packageExpiresAt)}</span></div>)}
          </div>
          <input value={noticeDraft.title} onChange={(e) => setNoticeDraft((p) => ({ ...p, title: e.target.value }))} className="h-10 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white" />
          <textarea value={noticeDraft.message} onChange={(e) => setNoticeDraft((p) => ({ ...p, message: e.target.value }))} className="min-h-[120px] rounded-[8px] border border-[#274262] bg-[#081421] px-3 py-3 text-white" />
          <div className="grid gap-3 md:grid-cols-2">
            <input value={noticeDraft.ctaLabel ?? ''} onChange={(e) => setNoticeDraft((p) => ({ ...p, ctaLabel: e.target.value }))} placeholder="ข้อความบนปุ่ม" className="h-10 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white" />
            <input value={noticeDraft.ctaUrl ?? ''} onChange={(e) => setNoticeDraft((p) => ({ ...p, ctaUrl: e.target.value }))} placeholder="/packages" className="h-10 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white" />
          </div>
          <AdminButton variant="gold" onClick={() => void sendNotice()} disabled={savingId === 'notice' || !noticeDraft.title || !noticeDraft.message || notifyUsers.length === 0}>
            {savingId === 'notice' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}ส่งแจ้งเตือน
          </AdminButton>
        </div>
      </AdminModal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#203a5a] bg-[#081421] p-3">
      <div className="text-[12px] font-bold text-[#95a9c4]">{label}</div>
      <div className="mt-1 break-words font-black text-white">{value}</div>
    </div>
  );
}
