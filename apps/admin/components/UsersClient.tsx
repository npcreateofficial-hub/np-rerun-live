'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Check, Edit3, Eye, Loader2, Plus, RotateCcw, Search } from 'lucide-react';
import { adminService, type AdminUserPayload } from '@/services/admin.service';
import type { AdminPackage, AdminUser } from '@/types/admin';
import { AdminButton } from './AdminButton';
import { AdminModal } from './AdminModal';
import { AdminPopupNotice } from './AdminPopupNotice';

type CreateUserForm = {
  username: string;
  password: string;
  licenseKey: string;
  packageId: string;
  packageStartedAt: string;
  packageExpiresAt: string;
};

const emptyUser: CreateUserForm = {
  username: '',
  password: '',
  licenseKey: '',
  packageId: '',
  packageStartedAt: '',
  packageExpiresAt: '',
};

const filters = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'active', label: 'ใช้งาน' },
  { key: 'paused', label: 'ระงับ' },
] as const;

function dateInput(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function isoDate(value?: string | null) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : null;
}

function nameOf(user: AdminUser) {
  return user.displayName || user.username || user.licenseKey || user.id;
}

function statusOf(user: AdminUser) {
  if (!user.isActive) return { label: 'ระงับ', tone: 'border-[#274262] bg-[#081421] text-[#b9b0a3]' };
  if (user.deviceId) return { label: 'ใช้งานแล้ว', tone: 'border-[#2d8b55] bg-[#0b2917] text-[#9df0bd]' };
  return { label: 'ใช้งานถาวร', tone: 'border-[#2d8b55] bg-[#0b2917] text-[#9df0bd]' };
}

function usageText(user: AdminUser) {
  if (!user.isActive) return 'ระงับ';
  if (user.deviceId) return 'ใช้งานแล้ว';
  return 'พร้อมใช้งาน';
}

function deviceText(user: AdminUser) {
  if (!user.deviceLockEnabled) return 'ไม่ล็อกเครื่อง';
  if (!user.deviceId) return 'ยังไม่ผูกเครื่อง';
  return user.deviceName || 'ผูกเครื่องแล้ว';
}

function makeLicenseKey() {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NP-SP-${part()}${part()}-${part()}`;
}

function draftOf(u: AdminUser): AdminUserPayload {
  return {
    username: u.username ?? '',
    displayName: u.displayName ?? '',
    phone: u.phone ?? '',
    lineId: u.lineId ?? '',
    licenseKey: u.licenseKey?.trim() || makeLicenseKey(),
    role: u.role === 'ADMIN' || u.role === 'STAFF' ? u.role : 'USER',
    isActive: u.isActive,
    credit: u.credit,
    packageId: u.packageId ?? '',
    packageStartedAt: dateInput(u.packageStartedAt),
    packageExpiresAt: null,
    marketingStatus: ['NEW', 'FOLLOW_UP', 'INTERESTED', 'RENEWED', 'PAUSED'].includes(u.marketingStatus)
      ? (u.marketingStatus as AdminUserPayload['marketingStatus'])
      : 'NEW',
    lastContactedAt: dateInput(u.lastContactedAt),
    adminNote: u.adminNote ?? '',
    deviceLockEnabled: u.deviceLockEnabled,
    deviceMoveLimit: u.deviceMoveLimit,
  };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-[12px] font-black text-[#95a9c4]">
      {label}
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#203a5a] bg-[#081421] p-3">
      <div className="text-[12px] text-[#95a9c4]">{label}</div>
      <div className="mt-1 break-words font-black text-white">{value}</div>
    </div>
  );
}

export function UsersClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [packages, setPackages] = useState<AdminPackage[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof filters)[number]['key']>('all');
  const [modal, setModal] = useState<'create' | 'edit' | 'detail' | 'deviceMove' | null>(null);
  const [activeUser, setActiveUser] = useState<AdminUser | null>(null);
  const [createDraft, setCreateDraft] = useState<CreateUserForm>(emptyUser);
  const [editDraft, setEditDraft] = useState<AdminUserPayload | null>(null);
  const [deviceMoveCount, setDeviceMoveCount] = useState('1');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(options?: { silent?: boolean }) {
    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const [nextUsers, nextPackages] = await Promise.all([adminService.users(), adminService.packages()]);
      setUsers(nextUsers);
      setPackages(nextPackages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดลูกค้าไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const initial = new URLSearchParams(window.location.search).get('filter');
      if (filters.some((item) => item.key === initial)) setFilter(initial as (typeof filters)[number]['key']);
    }
    void load();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load({ silent: true });
    }, 8000);
    return () => window.clearInterval(timer);
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const text = `${user.username ?? ''} ${user.displayName ?? ''} ${user.phone ?? ''} ${user.lineId ?? ''} ${user.licenseKey ?? ''}`.toLowerCase();
      const matchText = !query.trim() || text.includes(query.trim().toLowerCase());
      const matchFilter =
        filter === 'all' ||
        (filter === 'active' && user.isActive) ||
        (filter === 'paused' && !user.isActive);
      return matchText && matchFilter;
    });
  }, [filter, query, users]);

  function closeModal() {
    setModal(null);
    setActiveUser(null);
    setEditDraft(null);
    setDeviceMoveCount('1');
  }

  function openCreate() {
    setCreateDraft({ ...emptyUser, username: '', password: '', licenseKey: makeLicenseKey() });
    setModal('create');
  }

  function openEdit(user: AdminUser) {
    setActiveUser(user);
    setEditDraft(draftOf(user));
    setModal('edit');
  }

  async function createUser() {
    setSavingId('new');
    setError(null);
    setMessage(null);
    try {
      await adminService.createUser({
        username: createDraft.username || null,
        password: createDraft.password,
        licenseKey: createDraft.licenseKey || makeLicenseKey(),
        role: 'USER',
        packageId: createDraft.packageId || null,
        packageStartedAt: isoDate(createDraft.packageStartedAt || new Date().toISOString().slice(0, 10)),
        packageExpiresAt: null,
        marketingStatus: 'RENEWED',
        isActive: true,
        deviceLockEnabled: true,
        deviceMoveLimit: 0,
      });
      setMessage('เพิ่มลูกค้าและออกไลเซนส์สำเร็จ');
      closeModal();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เพิ่มลูกค้าไม่สำเร็จ');
    } finally {
      setSavingId(null);
    }
  }

  async function saveUser(user: AdminUser, draft: AdminUserPayload) {
    setSavingId(user.id);
    setError(null);
    setMessage(null);
    try {
      await adminService.updateUser(user.id, {
        ...draft,
        licenseKey: draft.licenseKey?.trim() || makeLicenseKey(),
        role: draft.role === 'ADMIN' || draft.role === 'STAFF' ? draft.role : 'USER',
        isActive: true,
        credit: Number(draft.credit ?? 0),
        packageId: draft.packageId || null,
        packageStartedAt: isoDate(String(draft.packageStartedAt ?? '')),
        packageExpiresAt: null,
        marketingStatus: 'RENEWED',
        lastContactedAt: null,
        deviceLockEnabled: true,
        deviceMoveLimit: 0,
      });
      setMessage(`บันทึก ${nameOf(user)} สำเร็จ`);
      closeModal();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกลูกค้าไม่สำเร็จ');
    } finally {
      setSavingId(null);
    }
  }

  function openDeviceMove(user: AdminUser) {
    setActiveUser(user);
    setDeviceMoveCount('1');
    setModal('deviceMove');
  }

  async function allowDeviceMove(user: AdminUser) {
    const moves = Number(deviceMoveCount);
    if (!Number.isInteger(moves) || moves < 1) {
      setError('กรุณากรอกจำนวนเครื่องอย่างน้อย 1');
      return;
    }
    setSavingId(user.id);
    setError(null);
    try {
      await adminService.allowUserDeviceMove(user.id, moves);
      setMessage(`อนุญาตให้ ${nameOf(user)} ล็อกอินเครื่องอื่นเพิ่ม ${moves} ครั้งแล้ว`);
      closeModal();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ปลดเครื่องไม่สำเร็จ');
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

      <header className="rounded-[10px] border border-[#274262] bg-gradient-to-r from-[#071a31] via-[#07111f] to-[#1f1708] px-6 py-5 shadow-[0_22px_55px_rgba(0,0,0,.28)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#f0b728]">NP LIVE ADMIN</div>
            <h1 className="mt-2 text-[28px] font-black">ลูกค้า</h1>
            <p className="mt-1 text-[13px] font-semibold text-[#bcdcff]">เพิ่มลูกค้า ออกไลเซนส์ User Password และจัดการล็อกเครื่อง</p>
          </div>
          <AdminButton variant="gold" onClick={openCreate}>
            <Plus size={15} />เพิ่มลูกค้า
          </AdminButton>
        </div>
      </header>

      <section className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f0b728]" size={17} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาชื่อ อีเมล เบอร์ LINE หรือไลเซนส์" className="h-11 w-full rounded-[9px] border border-[#274262] bg-[#06111e] pl-10 pr-3 text-white placeholder:text-[#7e8794]" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map((item) => (
            <button key={item.key} type="button" onClick={() => setFilter(item.key)} className={`h-9 shrink-0 rounded-full border px-4 text-[12px] font-black ${filter === item.key ? 'border-[#f0b728] bg-gradient-to-r from-[#ffd766] to-[#f0a913] text-[#120d05]' : 'border-[#274262] bg-[#06111e] text-[#c9d7e8] hover:border-[#0b79ff]'}`}>{item.label}</button>
          ))}
        </div>

        <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
          {loading ? <div className="rounded-[10px] border border-[#274262] bg-[#07111f] p-8 text-center text-[#bcdcff]"><Loader2 className="mx-auto mb-2 animate-spin text-[#f0b728]" />กำลังโหลด...</div> : null}
          {!loading && filteredUsers.map((user) => {
            const status = statusOf(user);
            return (
              <article key={user.id} className="rounded-[10px] border border-[#274262] bg-gradient-to-br from-[#071320] via-[#060b12] to-[#100d06] p-4 shadow-[0_18px_44px_rgba(0,0,0,.22)]">
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => { setActiveUser(user); setModal('detail'); }} className="min-w-0 text-left">
                    <h3 className="truncate text-[16px] font-black text-white">{nameOf(user)}</h3>
                    <p className="mt-1 truncate text-[12px] font-semibold text-[#9bbde8]">ไลเซนส์: {user.licenseKey ?? '-'}</p>
                  </button>
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-black ${status.tone}`}>{status.label}</span>
                </div>
                <div className="mt-4 grid gap-2 text-[12px] font-bold text-[#b9c7d8] sm:grid-cols-2">
                  <span>ไลเซนส์: <b className="text-[#f0b728]">{user.licenseKey ?? '-'}</b></span>
                  <span>User: <b className="text-white">{user.username || '-'}</b></span>
                  <span>สิทธิ์: <b className="text-[#f0b728]">{user.package?.name ?? '-'}</b></span>
                  <span>เครื่อง: <b className="text-white">{deviceText(user)}</b></span>
                  <span>LINE: <b className="text-white">{user.lineId || '-'}</b></span>
                  <span>โทร: <b className="text-white">{user.phone || '-'}</b></span>
                  <span>สถานะ: <b className="text-white">{usageText(user)}</b></span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <AdminButton variant="ghost" onClick={() => openDeviceMove(user)} disabled={savingId === user.id}><RotateCcw size={14} />ปลดเครื่อง</AdminButton>
                  <AdminButton variant="ghost" onClick={() => openEdit(user)}><Edit3 size={14} />แก้ไข</AdminButton>
                  <AdminButton variant="ghost" onClick={() => { setActiveUser(user); setModal('detail'); }}><Eye size={14} />ดูข้อมูล</AdminButton>
                </div>
              </article>
            );
          })}
          {!loading && filteredUsers.length === 0 ? <div className="rounded-[10px] border border-[#274262] bg-[#07111f] p-8 text-center text-sm font-bold text-[#bcdcff]">ไม่มีลูกค้าในเงื่อนไขนี้</div> : null}
        </div>
      </section>

      <AdminModal open={modal === 'create'} title="เพิ่มลูกค้า" description="กรอก License, User และ Password เพื่อออกสิทธิ์ใช้งานถาวรให้ลูกค้า" onClose={closeModal}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="License"><input name="np-live-new-license" autoComplete="off" value={createDraft.licenseKey} onChange={(e) => setCreateDraft((p) => ({ ...p, licenseKey: e.target.value }))} className="h-10 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white" /></Field>
          <Field label="User"><input name="np-live-new-user" autoComplete="off" value={createDraft.username} onChange={(e) => setCreateDraft((p) => ({ ...p, username: e.target.value }))} className="h-10 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white" /></Field>
          <Field label="Password">
            <input name="np-live-new-password" autoComplete="new-password" type="password" value={createDraft.password} onChange={(e) => setCreateDraft((p) => ({ ...p, password: e.target.value }))} className="h-10 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white" />
            <span className="text-[11px] font-bold text-[#95a9c4]">จำนวนรหัสผ่าน: {createDraft.password.length} ตัวอักษร</span>
          </Field>
          <Field label="สิทธิ์ใช้งาน"><select value={createDraft.packageId} onChange={(e) => setCreateDraft((p) => ({ ...p, packageId: e.target.value }))} className="h-10 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white"><option value="">ไม่กำหนดสิทธิ์</option>{packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <AdminButton className="md:col-span-2" variant="gold" onClick={() => void createUser()} disabled={savingId === 'new' || !createDraft.username || !createDraft.password || !createDraft.licenseKey}>{savingId === 'new' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}บันทึกลูกค้า</AdminButton>
        </div>
      </AdminModal>

      <AdminModal open={modal === 'edit' && Boolean(activeUser && editDraft)} title="แก้ไขลูกค้า" description={activeUser ? nameOf(activeUser) : ''} onClose={closeModal}>
        {activeUser && editDraft ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="ไลเซนส์"><input value={String(editDraft.licenseKey ?? '')} onChange={(e) => setEditDraft((p) => ({ ...(p ?? {}), licenseKey: e.target.value }))} className="h-10 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white" /></Field>
            <Field label="User"><input value={String(editDraft.username ?? '')} onChange={(e) => setEditDraft((p) => ({ ...(p ?? {}), username: e.target.value }))} className="h-10 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white" /></Field>
            <Field label="ชื่อแสดงผล"><input value={String(editDraft.displayName ?? '')} onChange={(e) => setEditDraft((p) => ({ ...(p ?? {}), displayName: e.target.value }))} className="h-10 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white" /></Field>
            <Field label="เบอร์โทร"><input value={String(editDraft.phone ?? '')} onChange={(e) => setEditDraft((p) => ({ ...(p ?? {}), phone: e.target.value }))} className="h-10 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white" /></Field>
            <Field label="LINE ID"><input value={String(editDraft.lineId ?? '')} onChange={(e) => setEditDraft((p) => ({ ...(p ?? {}), lineId: e.target.value }))} className="h-10 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white" /></Field>
            <Field label="สิทธิ์ใช้งาน"><select value={String(editDraft.packageId ?? '')} onChange={(e) => setEditDraft((p) => ({ ...(p ?? {}), packageId: e.target.value }))} className="h-10 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white"><option value="">ไม่กำหนดสิทธิ์</option>{packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Info label="สถานะ" value="ใช้งานตลอดชีพ" />
            <Field label="โน้ต"><textarea value={String(editDraft.adminNote ?? '')} onChange={(e) => setEditDraft((p) => ({ ...(p ?? {}), adminNote: e.target.value }))} className="min-h-[72px] rounded-[8px] border border-[#274262] bg-[#081421] px-3 py-3 text-white" /></Field>
            <AdminButton className="md:col-span-2" variant="gold" onClick={() => void saveUser(activeUser, editDraft)} disabled={savingId === activeUser.id}>{savingId === activeUser.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}บันทึกข้อมูลลูกค้า</AdminButton>
          </div>
        ) : null}
      </AdminModal>

      <AdminModal open={modal === 'detail' && Boolean(activeUser)} title="ข้อมูลลูกค้า" description={activeUser ? nameOf(activeUser) : ''} onClose={closeModal} widthClass="max-w-2xl">
        {activeUser ? (
          <div className="grid gap-3 text-sm font-bold text-[#c9c2b6]">
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="ไลเซนส์" value={activeUser.licenseKey ?? '-'} />
              <Info label="User" value={activeUser.username ?? '-'} />
              <Info label="สิทธิ์ใช้งาน" value={activeUser.package?.name ?? '-'} />
              <Info label="เครื่องที่ผูก" value={deviceText(activeUser)} />
              <Info label="สิทธิ์ย้ายเครื่อง" value={`${Math.max(0, activeUser.deviceMoveLimit - activeUser.deviceMoveUsed)} ครั้งคงเหลือ`} />
              <Info label="เบอร์โทร" value={activeUser.phone || '-'} />
              <Info label="LINE" value={activeUser.lineId || '-'} />
            </div>
            <div className="rounded-[8px] border border-[#203a5a] bg-[#081421] p-3"><div className="text-[12px] text-[#95a9c4]">โน้ต</div><div className="mt-1 whitespace-pre-wrap text-white">{activeUser.adminNote || '-'}</div></div>
            <div className="flex flex-wrap gap-2">
              <AdminButton variant="ghost" onClick={() => openDeviceMove(activeUser)}><RotateCcw size={14} />ปลดเครื่อง</AdminButton>
              <AdminButton variant="ghost" onClick={() => openEdit(activeUser)}><Edit3 size={14} />แก้ไข</AdminButton>
            </div>
          </div>
        ) : null}
      </AdminModal>

      <AdminModal open={modal === 'deviceMove' && Boolean(activeUser)} title="ปลดเครื่อง" description={activeUser ? nameOf(activeUser) : ''} onClose={closeModal}>
        {activeUser ? (
          <div className="grid gap-4 text-sm font-bold text-[#c9d7e8]">
            <div className="rounded-[8px] border border-[#203a5a] bg-[#081421] p-4">
              <div className="text-[12px] text-[#95a9c4]">เครื่องปัจจุบัน</div>
              <div className="mt-1 text-white">{deviceText(activeUser)}</div>
              <div className="mt-3 text-[12px] text-[#95a9c4]">สิทธิ์ย้ายเครื่องคงเหลือ</div>
              <div className="mt-1 text-[#f0b728]">{Math.max(0, activeUser.deviceMoveLimit - activeUser.deviceMoveUsed)} ครั้ง</div>
            </div>
            <Field label="เพิ่มจำนวนเครื่องที่อนุญาตให้ล็อกอิน">
              <input
                type="number"
                min={1}
                max={50}
                value={deviceMoveCount}
                onChange={(e) => setDeviceMoveCount(e.target.value.replace(/[^\d]/g, ''))}
                className="h-11 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white"
              />
              <span className="text-[11px] font-bold text-[#95a9c4]">ใส่ 1 = เพิ่มได้อีก 1 เครื่อง, ใส่ 2 = เพิ่มได้อีก 2 เครื่อง</span>
            </Field>
            <AdminButton variant="gold" onClick={() => void allowDeviceMove(activeUser)} disabled={savingId === activeUser.id || !deviceMoveCount}>
              {savingId === activeUser.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              ยืนยันปลดเครื่อง
            </AdminButton>
          </div>
        ) : null}
      </AdminModal>
    </div>
  );
}
