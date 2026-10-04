'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Check, Clock, Database, Edit3, Laptop, Loader2, Plus, RefreshCw, ShoppingBag, Video } from 'lucide-react';
import { adminService, type AdminPackagePayload } from '@/services/admin.service';
import type { AdminPackage } from '@/types/admin';
import { AdminButton } from './AdminButton';
import { AdminModal } from './AdminModal';
import { AdminPopupNotice } from './AdminPopupNotice';

type PackageForm = {
  name: string;
  priceBaht: string;
  durationDays: string;
  maxAccounts: string;
  maxDevices: string;
  maxVideos: string;
  storageGb: string;
  isActive: boolean;
};

const emptyPackage: PackageForm = {
  name: '',
  priceBaht: '',
  durationDays: '',
  maxAccounts: '',
  maxDevices: '',
  maxVideos: '',
  storageGb: '',
  isActive: true,
};

function baht(value: number) {
  return `฿${Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
}

function codeFromName(name: string) {
  const cleaned = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return (cleaned || `PACKAGE_${Date.now()}`).slice(0, 32);
}

function normalizeCategory(value?: string | null) {
  const normalized = String(value || 'STARTER').trim().toUpperCase().replace(/[-\s]+/g, '_');
  if (normalized === 'ULTRA_PRO' || normalized === 'ULTRAPRO') return 'PROMAX';
  if (normalized === 'PRO' || normalized === 'PROMAX') return normalized;
  return 'STARTER';
}

function positiveInt(value: number, fallback = 1) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 1) return fallback;
  return Math.trunc(numberValue);
}

function numberInputValue(value?: number | null) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? String(numberValue) : '';
}

function numberFromInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const numberValue = Number(trimmed);
  if (!Number.isFinite(numberValue) || numberValue < 0) return 0;
  return Math.trunc(numberValue);
}

function durationLabel(value: number) {
  return Number(value) > 0 ? `${value} วัน` : 'ตลอดชีพ';
}

function limitLabel(value: number) {
  return Number(value) > 0 ? value : 'ไม่จำกัด';
}

function formOf(item: AdminPackage): PackageForm {
  return {
    name: item.name,
    priceBaht: numberInputValue(item.priceBaht),
    durationDays: numberInputValue(item.durationDays),
    maxAccounts: numberInputValue(item.maxAccounts),
    maxDevices: numberInputValue(item.maxDevices),
    maxVideos: numberInputValue(item.maxVideos),
    storageGb: numberInputValue(item.storageGb),
    isActive: item.isActive,
  };
}

function payloadFromForm(form: PackageForm, source?: AdminPackage, sortOrder = 0): AdminPackagePayload {
  return {
    name: form.name,
    code: source?.code ?? codeFromName(form.name),
    category: normalizeCategory(source?.category),
    description: source?.description ?? null,
    priceBaht: numberFromInput(form.priceBaht),
    durationDays: numberFromInput(form.durationDays),
    maxAccounts: numberFromInput(form.maxAccounts),
    maxLiveChannels: numberFromInput(form.maxAccounts),
    maxDevices: numberFromInput(form.maxDevices),
    maxVideos: numberFromInput(form.maxVideos),
    storageGb: numberFromInput(form.storageGb),
    maxProxies: source?.maxProxies ?? 0,
    isActive: form.isActive,
    sortOrder: source?.sortOrder ?? sortOrder,
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

function NumberField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <Field label={label}>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 rounded-[8px] border border-[#274262] bg-[#071320] px-3 text-white placeholder:text-[#617089]" />
    </Field>
  );
}

function Feature({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 rounded-[8px] border border-[#203a5a] bg-[#081421] px-3 py-3">
      <Icon size={16} className="text-[#f0b728]" />
      <span className="min-w-0">
        <span className="block text-[11px] font-bold text-[#95a9c4]">{label}</span>
        <b className="block truncate text-[14px] text-white">{value}</b>
      </span>
    </div>
  );
}

export function PackagesClient() {
  const [items, setItems] = useState<AdminPackage[]>([]);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [activeItem, setActiveItem] = useState<AdminPackage | null>(null);
  const [draft, setDraft] = useState<PackageForm>(emptyPackage);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await adminService.packages());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดแพ็กเกจไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const totals = useMemo(() => ({
    active: items.filter((item) => item.isActive).length,
    users: items.reduce((sum, item) => sum + (item._count?.users ?? 0), 0),
  }), [items]);

  function closeModal() {
    setModal(null);
    setActiveItem(null);
    setDraft(emptyPackage);
  }

  function openCreate() {
    setDraft(emptyPackage);
    setModal('create');
  }

  function openEdit(item: AdminPackage) {
    setActiveItem(item);
    setDraft(formOf(item));
    setModal('edit');
  }

  async function createPackage() {
    setSavingId('new');
    setMessage(null);
    setError(null);
    try {
      await adminService.createPackage(payloadFromForm(draft, undefined, items.length + 1));
      setMessage('สร้างแพ็กเกจสำเร็จ');
      closeModal();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สร้างแพ็กเกจไม่สำเร็จ');
    } finally {
      setSavingId(null);
    }
  }

  async function savePackage() {
    if (!activeItem) return;
    setSavingId(activeItem.id);
    setMessage(null);
    setError(null);
    try {
      await adminService.updatePackage(activeItem.id, payloadFromForm(draft, activeItem));
      setMessage(`บันทึก ${draft.name} สำเร็จ`);
      closeModal();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกแพ็กเกจไม่สำเร็จ');
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#274262] bg-gradient-to-r from-[#071320] to-[#100d06] p-4 shadow-[0_18px_44px_rgba(0,0,0,.18)]">
        <div>
          <h2 className="text-[18px] font-black">แพ็กเกจทั้งหมด</h2>
          <p className="mt-1 text-[13px] font-bold text-[#95a9c4]">ชื่อ ราคา วันใช้งาน จำนวนเครื่อง บัญชี Shopee วิดีโอ และขนาดต่อคลิป</p>
        </div>
        <div className="flex gap-2">
          <AdminButton variant="ghost" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />รีเฟรช</AdminButton>
          <AdminButton variant="gold" onClick={openCreate}><Plus size={15} />เพิ่มแพ็กเกจ</AdminButton>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-[10px] border border-[#274262] bg-gradient-to-br from-[#071320] to-[#060b12] p-4"><div className="text-[12px] font-black text-[#95a9c4]">แพ็กเกจ</div><div className="mt-2 text-[28px] font-black">{items.length}</div></article>
        <article className="rounded-[10px] border border-[#2d8b55] bg-[#0b2917] p-4"><div className="text-[12px] font-black text-[#95a9c4]">เปิดขาย</div><div className="mt-2 text-[28px] font-black">{totals.active}</div></article>
        <article className="rounded-[10px] border border-[#274262] bg-gradient-to-br from-[#071320] to-[#060b12] p-4"><div className="text-[12px] font-black text-[#95a9c4]">ลูกค้าที่ใช้</div><div className="mt-2 text-[28px] font-black">{totals.users}</div></article>
      </div>

      <section className="grid gap-4 xl:grid-cols-3">
        {loading ? <div className="rounded-[10px] border border-[#274262] bg-[#071320] p-8 text-center text-[#95a9c4]"><Loader2 className="mx-auto mb-2 animate-spin text-[#f0b728]" />กำลังโหลด...</div> : null}
        {!loading && items.map((item) => (
          <article key={item.id} className="rounded-[10px] border border-[#274262] bg-gradient-to-br from-[#071320] via-[#060b12] to-[#100d06] p-5 shadow-[0_18px_44px_rgba(0,0,0,.22)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[22px] font-black text-white">{item.name}</h3>
                <p className="mt-1 text-[12px] font-bold text-[#95a9c4]">{durationLabel(item.durationDays)}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${item.isActive ? 'border-[#2d8b55] bg-[#0b2917] text-[#9df0bd]' : 'border-[#274262] bg-[#071320] text-[#b8c7da]'}`}>{item.isActive ? 'ขายอยู่' : 'ปิดขาย'}</span>
            </div>
            <div className="mt-4 text-[36px] font-black leading-none text-white">{baht(item.priceBaht)}</div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Feature icon={Clock} label="วันใช้งาน" value={durationLabel(item.durationDays)} />
              <Feature icon={Laptop} label="จำนวนเครื่อง" value={limitLabel(item.maxDevices)} />
              <Feature icon={ShoppingBag} label="บัญชี Shopee" value={limitLabel(item.maxAccounts)} />
              <Feature icon={Video} label="วิดีโอ" value={limitLabel(item.maxVideos)} />
              <Feature icon={Database} label="GB/คลิป" value={limitLabel(item.storageGb)} />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-[12px] font-bold text-[#95a9c4]">ลูกค้า {item._count?.users ?? 0} บัญชี</span>
              <AdminButton variant="ghost" onClick={() => openEdit(item)}><Edit3 size={14} />แก้ไข</AdminButton>
            </div>
          </article>
        ))}
      </section>

      <AdminModal open={modal === 'create' || modal === 'edit'} title={modal === 'create' ? 'เพิ่มแพ็กเกจ' : 'แก้แพ็กเกจ'} description="แสดงเฉพาะข้อมูลที่ใช้ขายและคุมสิทธิ์จริง" onClose={closeModal} widthClass="max-w-2xl">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="ชื่อ"><input value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} className="h-10 rounded-[8px] border border-[#274262] bg-[#071320] px-3 text-white" /></Field>
          <NumberField label="ราคา" value={draft.priceBaht} onChange={(value) => setDraft((p) => ({ ...p, priceBaht: value }))} placeholder="ว่าง = 0" />
          <NumberField label="วันใช้งาน" value={draft.durationDays} onChange={(value) => setDraft((p) => ({ ...p, durationDays: value }))} placeholder="ว่าง = ตลอดชีพ" />
          <NumberField label="จำนวนเครื่อง" value={draft.maxDevices} onChange={(value) => setDraft((p) => ({ ...p, maxDevices: value }))} placeholder="ว่าง = ไม่จำกัด" />
          <NumberField label="บัญชี Shopee" value={draft.maxAccounts} onChange={(value) => setDraft((p) => ({ ...p, maxAccounts: value }))} placeholder="ว่าง = ไม่จำกัด" />
          <NumberField label="วิดีโอ" value={draft.maxVideos} onChange={(value) => setDraft((p) => ({ ...p, maxVideos: value }))} placeholder="ว่าง = ไม่จำกัด" />
          <NumberField label="ขนาดต่อคลิป (GB)" value={draft.storageGb} onChange={(value) => setDraft((p) => ({ ...p, storageGb: value }))} placeholder="ว่าง = ไม่จำกัด" />
          <label className="flex h-10 items-center gap-2 self-end text-[13px] font-black text-white">
            <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft((p) => ({ ...p, isActive: e.target.checked }))} />
            เปิดขาย
          </label>
          <AdminButton className="md:col-span-2" variant="gold" onClick={() => modal === 'create' ? void createPackage() : void savePackage()} disabled={savingId !== null || !draft.name}>
            {savingId ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {modal === 'create' ? 'บันทึกแพ็กเกจใหม่' : 'บันทึกแพ็กเกจ'}
          </AdminButton>
        </div>
      </AdminModal>
    </div>
  );
}
