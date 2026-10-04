'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  CopyCheck,
  Gauge,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  UserCircle,
  WalletCards,
  Zap,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/common/Button';
import { AddAdsAccountDialog } from './AddAdsAccountDialog';
import { accountService } from '@/services/account.service';
import { adsAccountService } from '@/services/ads-account.service';
import type { AdsAccountRecord, AdsLiveCampaignRecord, CheckCookieResult, CreateLiveCampaignResult, LiveCampaignHistoryResult, UpdateLiveCampaignResult } from '@/types/account';

const stats = [
  { label: 'บัญชีทั้งหมด', value: '1', sub: 'เชื่อม Ads Center', icon: UserCircle, tone: 'blue' },
  { label: 'พร้อมยิงแอด', value: '1', sub: 'Cookie ใช้งานได้', icon: CheckCircle2, tone: 'gold' },
  { label: 'ต้องแก้ไข', value: '0', sub: 'Cookie หมดอายุ/ไม่ครบ', icon: AlertTriangle, tone: 'red' },
];

const presets = [
  { name: 'ROI 17', budget: '50,000', roi: '17', note: 'คุมเข้ม เหมาะกับเทสต์' },
  { name: 'ROI 18', budget: '70,000', roi: '18', note: 'กลาง ๆ สำหรับไลฟ์ปกติ' },
  { name: 'ROI 19', budget: '90,000', roi: '19', note: 'ดันแรงเมื่อไลฟ์เริ่มนิ่ง' },
];

type AdsAccount = {
  uid: string;
  id: string;
  name: string;
  account: string;
  status: string;
  checkedAt: string;
};

const accountRows: AdsAccount[] = [];

const decisionSteps = [
  'เช็กไลฟ์ว่ายังเดินอยู่',
  'ดูงบคงเหลือและเวลาที่อนุญาตให้ตบงบ',
  'เช็ก ROI / ค่าออเดอร์ / ยอดขาย',
  'ถ้าไม่คุ้ม ให้ปิดตัวเดิมแล้วขึ้นตัวใหม่',
];

function toneClass(tone: string) {
  if (tone === 'gold') return 'border-[#d4a53b] bg-gradient-to-br from-[#e9b84c] to-[#8d601a] text-[#160d04]';
  if (tone === 'red') return 'border-[#68361b] bg-gradient-to-br from-[#25120f] to-[#0d0d0c] text-[#f7f1e7]';
  return 'border-[#1b6dd8] bg-gradient-to-br from-[#0b2a52] to-[#07111f] text-white';
}

function TextInput({ label, placeholder, value, onChange }: { label: string; placeholder: string; value?: string; onChange?: (value: string) => void }) {
  return (
    <label className="text-[12px] font-bold text-[#c9c2b6]">
      {label}
      <input value={value} onChange={(event) => onChange?.(event.target.value)} className="mt-1.5 h-9 w-full rounded-md border border-[#365879] bg-[#060606] px-3 text-[12px] text-[#f7f1e7] outline-none transition placeholder:text-[#756d63] focus:border-[#f5bd37] focus:shadow-[0_0_0_3px_rgba(245,189,55,.14)]" placeholder={placeholder} />
    </label>
  );
}

function ToggleCard({ children, checked = false }: { children: string; checked?: boolean }) {
  return (
    <label className="flex min-h-[58px] cursor-pointer items-start gap-3 rounded-[10px] border border-[#3b2a12] bg-[#070707] p-4 text-[13px] font-bold leading-5 transition hover:border-[#8a641d]">
      <input type="checkbox" defaultChecked={checked} className="mt-1" /> {children}
    </label>
  );
}

function TimeSelect({ value, onChange, max }: { value: string; onChange: (value: string) => void; max: number }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-md border border-[#365879] bg-[#060606] px-2 text-[12px] font-bold text-[#f7f1e7] outline-none [color-scheme:dark] focus:border-[#f5bd37]">
      <option value="">—</option>
      {Array.from({ length: max }, (_, index) => {
        const option = String(index).padStart(2, '0');
        return <option key={option} value={option}>{option}</option>;
      })}
    </select>
  );
}

function MiniButton({ children, tone = 'blue', onClick }: { children: string; tone?: 'blue' | 'yellow' | 'danger' | 'dark'; onClick?: () => void }) {
  const toneClass = tone === 'danger'
    ? 'border-[#7c2830] bg-[#23070b] text-[#ffb5b5]'
    : tone === 'yellow'
      ? 'border-[#f5bd37]/70 bg-[#11180f] text-[#f5bd37]'
      : tone === 'dark'
        ? 'border-[#365879] bg-[#060606] text-[#f7f1e7]'
        : 'border-[#365879] bg-[#09111b] text-[#8dc7ff]';
  return (
    <button type="button" onClick={onClick} className={`rounded-md border px-3 py-1.5 text-[11px] font-black ${toneClass}`}>
      {children}
    </button>
  );
}

function RuleBuilder({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid gap-5">
      <section className="rounded-[12px] border border-[#244a70] bg-[#071321] p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-[#2d77c7] bg-[#0b2f5f] text-[#8dc7ff]"><Sparkles size={19} /></span>
          <div>
            <h4 className="text-[17px] font-black text-[#f7f1e7]">สูตรงบสำเร็จรูป</h4>
            <p className="text-[12px] font-semibold text-[#9bb7d6]">เลือกสูตรแล้วระบบเติมค่า ROI และงบเริ่มต้นให้ทันที</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {presets.map((preset) => (
            <button key={preset.name} type="button" className="min-h-[112px] rounded-[10px] border border-[#2d77c7] bg-[#0b1827] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#f5bd37] hover:bg-[#10140b]">
              <b className="text-[#f5bd37]">{preset.name}</b>
              <span className="mt-2 block text-[22px] font-black text-[#f7f1e7]">฿{preset.budget}</span>
              <span className="mt-1 block text-[12px] font-semibold text-[#9bb7d6]">{preset.note}</span>
            </button>
          ))}
        </div>
      </section>

      <div className={compact ? 'grid gap-5' : 'grid gap-5 2xl:grid-cols-[1.05fr_.95fr]'}>
        <section className="rounded-[12px] border border-[#4b3615] bg-[#10100f] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3"><WalletCards className="text-[#f5bd37]" size={20} /><h4 className="text-[17px] font-black text-[#f7f1e7]">ตบงบ / เพิ่มงบ</h4></div>
            <span className="rounded-full bg-[#241803] px-3 py-1 text-[11px] font-black text-[#f5bd37]">AUTO BUDGET</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {['เติมที่เหลือจากงบ', 'ตาม % งบที่เหลือ', 'หลายขั้นตามงบต่อวัน'].map((mode, index) => (
              <label key={mode} className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-[#3b2a12] bg-[#070707] px-3 py-3 text-[12px] font-bold text-[#f7f1e7]">
                <input type="radio" name={compact ? 'modalBudgetMode' : 'budgetMode'} defaultChecked={index === 0} /> {mode}
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextInput label="เติมเมื่อเหลือจากงบ (THB)" placeholder="เช่น 50" />
            <TextInput label="เพิ่มงบต่อวัน (THB)" placeholder="เช่น 100" />
            <TextInput label="เพดานงบต่อวัน (THB)" placeholder="ว่าง = ไม่จำกัด" />
            <TextInput label="พักกี่นาทีหลังเปิดตัวใหม่" placeholder="เช่น 60" />
          </div>
          <div className="mt-4 rounded-[10px] border border-[#3b2a12] bg-black/20 p-4">
            <p className="text-[13px] font-black text-[#f5bd37]">ช่วงเวลาที่ให้ตบงบได้</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="rounded-lg border border-[#584017] bg-[#070707] px-3 py-3 text-[12px] font-bold text-[#f7f1e7]"><input type="radio" name={compact ? 'modalBudgetWindow' : 'budgetWindow'} defaultChecked /> ทั้งวัน</label>
              <label className="rounded-lg border border-[#584017] bg-[#070707] px-3 py-3 text-[12px] font-bold text-[#f7f1e7]"><input type="radio" name={compact ? 'modalBudgetWindow' : 'budgetWindow'} /> เฉพาะเวลาที่กำหนด</label>
            </div>
          </div>
        </section>

        <section className="rounded-[12px] border border-[#4b3615] bg-[#10100f] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3"><Gauge className="text-[#f5bd37]" size={20} /><h4 className="text-[17px] font-black text-[#f7f1e7]">เช็กว่าคุ้มไหม</h4></div>
            <span className="rounded-full bg-[#06220d] px-3 py-1 text-[11px] font-black text-[#8ef09e]">ROI / CPO</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="ROI ขั้นต่ำ" placeholder="เช่น 1.8" />
            <TextInput label="ค่าออเดอร์สูงสุดที่รับได้" placeholder="เช่น 120" />
            <TextInput label="เริ่มเช็กหลังรันกี่นาที" placeholder="เช่น 10" />
            <TextInput label="จำนวนออเดอร์ขั้นต่ำ" placeholder="เช่น 1" />
          </div>
          <div className="mt-4 grid gap-3">
            <ToggleCard checked>ถ้า ROI ต่ำ หรือค่าออเดอร์แพงเกิน ให้ปิดตัวเดิมแล้วสร้างตัวใหม่</ToggleCard>
            <ToggleCard checked>ถ้าใช้เงินถึงเพดานแล้วยังไม่มีออเดอร์ ให้ขึ้นตัวใหม่</ToggleCard>
          </div>
        </section>
      </div>

      <section className="rounded-[12px] border border-[#4b3615] bg-[#10100f] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><RefreshCw className="text-[#f5bd37]" size={20} /><h4 className="text-[17px] font-black text-[#f7f1e7]">ปิดตัวเดิม แล้วขึ้นตัวใหม่</h4></div>
          <span className="rounded-full border border-[#3d6f35] bg-[#06220d] px-3 py-1 text-[12px] font-black text-[#8ef09e]">กันยิงซ้ำด้วย cooldown</span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <ToggleCard>ตัวเดิมไม่เดินภายในเวลาที่กำหนด</ToggleCard>
          <ToggleCard>ยอดขายไม่เข้าเป้าหรือค่าออเดอร์แพง</ToggleCard>
          <ToggleCard>ปิด/สร้างใหม่เฉพาะช่วงเวลาที่กำหนด</ToggleCard>
        </div>
      </section>
    </div>
  );
}

type SelectedAdsAccount = {
  id: string;
  name: string;
  shopId?: string;
};

type EditingLiveCampaign = {
  campaignId: number;
  name: string;
  objective: 'max_gmv_roi_two' | 'max_view';
  dailyBudgetBaht?: number | null;
  automationSettings?: LiveCampaignAutomationSettings | null;
  startTime?: number | null;
  endTime?: number | null;
  timeSlotList?: Array<{ start_time?: number; end_time?: number }> | null;
  roiTwoTargetValue?: number | null;
};

type TimeWindowSetting = { startHour: string; startMinute: string; endHour: string; endMinute: string };
type TimeBoostRowSetting = { hour: string; minute: string; addAmount: string; multiplier: string };
type TierSetting = { min: string; max: string; cap: string; add: string };
type RecreateScheduleRowSetting = { closeHour: string; closeMinute: string; createHour: string; createMinute: string };

type LiveCampaignAutomationSettings = {
  budgetSlapEnabled: boolean;
  budgetScaleEnabled: boolean;
  budgetAutomationMode: 'simple' | 'budget_cost' | 'tiered_budget_cost';
  budgetTimeMode: 'always' | 'scheduled';
  budgetTimeWindows: TimeWindowSetting[];
  tiers: TierSetting[];
  specialBoostEnabled: boolean;
  specialBoostRows: TimeBoostRowSetting[];
  profitCheckEnabled: boolean;
  profitCheckDays: string[];
  cpoRoiWindows: TimeWindowSetting[];
  timeBoostEnabled: boolean;
  timeBoostRows: TimeBoostRowSetting[];
  timeBoostRepeatEnabled: boolean;
  timeBoostRepeatAddAmount: string;
  timeBoostRepeatHours: string;
  timeBoostRepeatMinutes: string;
  recreateInactiveEnabled: boolean;
  noOrderGuardEnabled: boolean;
  badResultGuardEnabled: boolean;
  recreateCpoTimeMode: 'always' | 'scheduled';
  recreateNoOrderAfterBudget: boolean;
  scheduleRecreateEnabled: boolean;
  recreateScheduleRows: RecreateScheduleRowSetting[];
  advancedEnabled: boolean;
  textValues: Record<string, string>;
  checkValues: Record<string, boolean>;
};

type DraftLiveCampaign = {
  name?: string;
};

function CampaignWorkspace({ onOpenRules }: { onOpenRules: (view?: 'live' | 'product', account?: SelectedAdsAccount, campaign?: EditingLiveCampaign, draft?: DraftLiveCampaign) => void }) {
  return (
    <section className="rounded-[14px] border border-[#5b4118] bg-[#090c0f] p-6 shadow-[0_22px_70px_rgba(0,0,0,.28)]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.35em] text-[#f5bd37]">CREATE LIVE ADS</p>
          <h2 className="mt-2 text-[24px] font-black text-[#f7f1e7]">สร้างโฆษณา LIVE GMV Max</h2>
          <p className="mt-1 text-[13px] font-semibold text-[#9bb7d6]">จัดครบตั้งแต่ตั้งงบ เช็กความคุ้ม จนถึงกฎปิดตัวเดิมขึ้นตัวใหม่</p>
        </div>
        <Button onClick={() => onOpenRules('live')}><Zap size={16} /> เปิดหน้าสร้างแคมเปญ</Button>
      </div>

      <CampaignManagerList onOpenRules={onOpenRules} />

      <div className="mt-5 grid gap-5 2xl:grid-cols-[.9fr_1.1fr]">
        <section className="rounded-[12px] border border-[#4b3615] bg-[#10100f] p-5">
          <div className="mb-4 flex items-center gap-3"><TrendingUp className="text-[#f5bd37]" size={20} /><h3 className="text-[17px] font-black text-[#f7f1e7]">ตั้งค่าแคมเปญ</h3></div>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
            <TextInput label="ชื่อแคมเปญ" placeholder="เช่น Live Q4 Boost" />
            <TextInput label="งบต่อวัน (THB)" placeholder="300" />
            <TextInput label="ยอดขายเป้า (ROI)" placeholder="0.1" />
            <label className="flex items-center gap-3 rounded-[10px] border border-[#3b2a12] bg-[#070707] p-4 text-[13px] font-bold text-[#f7f1e7]"><input type="checkbox" /> รีเซ็ตงบต่อวันตามเวลา</label>
          </div>
        </section>

        <section className="rounded-[12px] border border-[#4b3615] bg-[#10100f] p-5">
          <div className="mb-4 flex items-center gap-3"><CopyCheck className="text-[#f5bd37]" size={20} /><h3 className="text-[17px] font-black text-[#f7f1e7]">แผนการตัดสินใจของระบบ</h3></div>
          <div className="grid gap-3 md:grid-cols-2">
            {decisionSteps.map((item, index) => (
              <div key={item} className="flex min-h-[70px] items-center gap-3 rounded-[10px] border border-[#3b2a12] bg-black/20 px-4 py-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f5bd37] text-[12px] font-black text-black">{index + 1}</span>
                <b className="text-[13px] leading-5 text-[#f7f1e7]">{item}</b>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-5">
        <RuleBuilder />
      </div>
    </section>
  );
}


type CampaignRow = {
  id: string;
  detailId: string;
  name: string;
  detailName: string;
  type: 'live-gmv' | 'visibility';
  typeLabel: string;
  shop: string;
  account: string;
  state?: string | null;
  status: string;
  delivery: string;
  updatedAt: string;
  createdAt: string;
  dailyBudget: string;
  dailyBudgetBaht?: number | null;
  automationSettings?: LiveCampaignAutomationSettings | null;
  startTime?: number | null;
  endTime?: number | null;
  timeSlotList?: Array<{ start_time?: number; end_time?: number }> | null;
  roiTwoTargetValue?: number | null;
  cost: string;
  roi: string;
  liveViews: string;
  optimizeBudget: string;
  skuOrders: string;
  conversionRate: string;
  sales: string;
};

const initialCampaignRows: CampaignRow[] = [];
const liveCampaignStorageKey = 'np-live-created-live-campaigns';
const liveCampaignMinDailyBudgetBaht = 200;
const liveCampaignBudgetStepBaht = 25;

type HistoryTableRow = {
  id: string;
  openedAt: string;
  openedAtMs: number;
  operator: string;
  device: string;
  actionType: string;
  detail: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asHistoryText(value: unknown, fallback = '-') {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'เปิด' : 'ปิด';
  return fallback;
}

function pickHistoryValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') return record[key];
  }
  return undefined;
}

function flattenHistoryRecords(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 5) return [];
  if (Array.isArray(value)) return value.flatMap((item) => flattenHistoryRecords(item, depth + 1));
  if (!isRecord(value)) return [];
  const directList = pickHistoryValue(value, ['list', 'items', 'records', 'history', 'logs', 'data_list', 'operation_list', 'operationLogList']);
  if (Array.isArray(directList)) return directList.flatMap((item) => flattenHistoryRecords(item, depth + 1));
  const hasHistoryShape = ['time', 'timestamp', 'ctime', 'create_time', 'operate_time', 'operation_time', 'operator', 'operator_name', 'user_name', 'type', 'action', 'action_type', 'operation_type', 'detail', 'description', 'content'].some((key) => value[key] !== undefined);
  if (hasHistoryShape) return [value];
  return Object.values(value).flatMap((item) => flattenHistoryRecords(item, depth + 1));
}

function formatHistoryTime(value: unknown) {
  let date: Date | null = null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    date = new Date(value < 10000000000 ? value * 1000 : value);
  } else if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && /^\d+$/.test(value.trim())) {
      date = new Date(numeric < 10000000000 ? numeric * 1000 : numeric);
    } else {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) date = parsed;
    }
  }
  if (!date || Number.isNaN(date.getTime())) return { label: '-', ms: 0 };
  return { label: new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date), ms: date.getTime() };
}

function formatHistoryMoney(value: unknown) {
  const amount = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(amount)) return asHistoryText(value);
  const baht = amount >= 100000 ? amount / 100000 : amount;
  return '฿' + baht.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function translateHistoryType(value: unknown) {
  const raw = asHistoryText(value, 'แก้ไขแคมเปญ');
  const normalized = raw.toLowerCase();
  if (normalized.includes('budget') || normalized.includes('งบ')) return 'แก้ไขงบประมาณ';
  if (normalized.includes('pause') || normalized.includes('suspend') || normalized.includes('หยุด')) return 'หยุดโฆษณา';
  if (normalized.includes('resume') || normalized.includes('start') || normalized.includes('เริ่ม')) return 'เริ่มโฆษณา';
  if (normalized.includes('stop') || normalized.includes('end') || normalized.includes('ปิด')) return 'ปิดโฆษณา';
  if (normalized.includes('create') || normalized.includes('สร้าง')) return 'สร้างแคมเปญ';
  if (normalized.includes('roi') || normalized.includes('roas')) return 'แก้ไข ROAS';
  return raw;
}

function keyLooksLikeBudget(key: string) {
  const normalized = key.toLowerCase();
  return normalized.includes('budget') || normalized.includes('งบ');
}

function valueLooksLikeBudget(value: unknown) {
  return typeof value === 'string' && (value.toLowerCase().includes('budget') || value.includes('งบ'));
}

function findBudgetChange(value: unknown, depth = 0): { before?: unknown; after?: unknown } | null {
  if (depth > 6) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findBudgetChange(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;

  const fieldValue = pickHistoryValue(value, ['field', 'field_name', 'name', 'key', 'label', 'title', 'type', 'action_type', 'operation_type']);
  const recordIsBudget = Object.keys(value).some(keyLooksLikeBudget) || valueLooksLikeBudget(fieldValue);
  const before = pickHistoryValue(value, ['old_daily_budget', 'oldDailyBudget', 'old_budget', 'before_budget', 'original_budget', 'previous_budget', 'old_value', 'oldValue', 'before', 'from', 'from_value', 'origin_value']);
  const after = pickHistoryValue(value, ['new_daily_budget', 'newDailyBudget', 'new_budget', 'after_budget', 'current_budget', 'updated_budget', 'new_value', 'newValue', 'after', 'to', 'to_value', 'target_value']);
  if (recordIsBudget && (before !== undefined || after !== undefined)) return { before, after };

  for (const [key, nested] of Object.entries(value)) {
    if (keyLooksLikeBudget(key) && isRecord(nested)) {
      const nestedBefore = pickHistoryValue(nested, ['old', 'old_value', 'oldValue', 'before', 'from']);
      const nestedAfter = pickHistoryValue(nested, ['new', 'new_value', 'newValue', 'after', 'to']);
      if (nestedBefore !== undefined || nestedAfter !== undefined) return { before: nestedBefore, after: nestedAfter };
    }
    const found = findBudgetChange(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

function findReadableDetail(value: unknown, depth = 0): string | null {
  if (depth > 5) return null;
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    const normalized = trimmed.toLowerCase();
    if (['change_budget', 'budget'].includes(normalized)) return null;
    if (trimmed.includes('->') || trimmed.includes('เป็น') || trimmed.includes('จาก') || trimmed.includes('งบ') || normalized.includes('budget')) return trimmed;
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findReadableDetail(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  for (const key of ['detail', 'description', 'content', 'message', 'desc', 'text', 'remark']) {
    const found = findReadableDetail(value[key], depth + 1);
    if (found) return found;
  }
  for (const nested of Object.values(value)) {
    const found = findReadableDetail(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

function historyDetailFromRecord(record: Record<string, unknown>) {
  const budgetChange = findBudgetChange(record);
  if (budgetChange) return 'งบประมาณรายวัน: ' + formatHistoryMoney(budgetChange.before) + ' -> ' + formatHistoryMoney(budgetChange.after);

  const readableDetail = findReadableDetail(record);
  if (readableDetail) return readableDetail;

  const field = asHistoryText(pickHistoryValue(record, ['field', 'field_name', 'name', 'label']), 'รายละเอียด');
  const oldValue = pickHistoryValue(record, ['old', 'oldValue', 'old_value', 'before', 'from']);
  const newValue = pickHistoryValue(record, ['new', 'newValue', 'new_value', 'after', 'to']);
  if (oldValue !== undefined || newValue !== undefined) return field + ': ' + asHistoryText(oldValue) + ' -> ' + asHistoryText(newValue);

  const actionType = translateHistoryType(pickHistoryValue(record, ['type', 'action', 'action_type', 'operation_type', 'event_type', 'title']));
  if (actionType === 'แก้ไขงบประมาณ') return 'แก้ไขงบประมาณแคมเปญ แต่ Shopee ไม่ส่งค่าก่อน/หลังมาในรายการนี้';
  return actionType === 'แก้ไขแคมเปญ' ? 'มีการแก้ไขแคมเปญ' : actionType;
}

function normalizeCampaignHistoryRows(history: unknown, source?: 'shopee' | 'local', budgetContext?: { currentBudgetBaht?: number | null; stepBaht?: number | null }): HistoryTableRow[] {
  const records = flattenHistoryRecords(history);
  if (!records.length && isRecord(history)) {
    const settings = history;
    const rows: HistoryTableRow[] = [];
    if (settings.repeatBudgetBoostEnabled) rows.push({ id: 'local-repeat-budget', openedAt: '-', openedAtMs: 0, operator: 'NP LIVE', device: 'ระบบ', actionType: 'ตั้งเวลาเพิ่มงบ', detail: 'เพิ่มงบ ' + asHistoryText(settings.repeatBudgetBoostAddBaht) + ' บาท ทุก ' + asHistoryText(settings.repeatBudgetBoostIntervalMinutes) + ' นาที' });
    if (settings.budgetTimeBoostEnabled) rows.push({ id: 'local-time-budget', openedAt: '-', openedAtMs: 0, operator: 'NP LIVE', device: 'ระบบ', actionType: 'ตั้งเวลาเพิ่มงบ', detail: 'ตั้งเวลาเพิ่มงบตามช่วงเวลาที่กำหนด' });
    if (settings.budgetSlapEnabled || settings.budgetScaleEnabled) rows.push({ id: 'local-budget-rule', openedAt: '-', openedAtMs: 0, operator: 'NP LIVE', device: 'ระบบ', actionType: 'ตั้งกฎงบประมาณ', detail: 'ตั้งค่าตบงบ/เพิ่มงบอัตโนมัติ' });
    return rows;
  }
  const rows = records.map((record, index) => {
    const time = formatHistoryTime(pickHistoryValue(record, ['time', 'timestamp', 'ctime', 'create_time', 'created_at', 'operate_time', 'operation_time', 'update_time']));
    return { id: asHistoryText(pickHistoryValue(record, ['id', 'log_id', 'operation_id']), (source ?? 'history') + '-' + index), openedAt: time.label, openedAtMs: time.ms, operator: asHistoryText(pickHistoryValue(record, ['operator', 'operator_name', 'user_name', 'username', 'account_name', 'shop_name']), source === 'local' ? 'NP LIVE' : '-'), device: asHistoryText(pickHistoryValue(record, ['device', 'platform', 'source_device']), '-'), actionType: translateHistoryType(pickHistoryValue(record, ['type', 'action', 'action_type', 'operation_type', 'event_type', 'title'])), detail: historyDetailFromRecord(record) };
  }).sort((a, b) => b.openedAtMs - a.openedAtMs);

  const currentBudget = budgetContext?.currentBudgetBaht;
  const step = budgetContext?.stepBaht && budgetContext.stepBaht > 0 ? budgetContext.stepBaht : 50;
  let nextAfter = typeof currentBudget === 'number' && Number.isFinite(currentBudget) && currentBudget > 0 ? currentBudget : null;
  return rows.map((row) => {
    const rawDetail = row.detail.trim().toLowerCase();
    const isRawBudgetDetail = rawDetail === 'change_budget' || rawDetail === 'budget' || rawDetail === 'แก้ไขงบประมาณ';
    if (row.actionType === 'แก้ไขงบประมาณ' && isRawBudgetDetail && nextAfter !== null) {
      const after = nextAfter;
      const before = Math.max(0, after - step);
      nextAfter = before;
      return { ...row, detail: 'งบประมาณรายวัน: ' + formatHistoryMoney(before) + ' -> ' + formatHistoryMoney(after) };
    }
    if (row.actionType === 'แก้ไขงบประมาณ' && isRawBudgetDetail) {
      return { ...row, detail: 'แก้ไขงบประมาณแคมเปญ' };
    }
    return row;
  });
}

function filterHistoryByDate(row: HistoryTableRow, value: 'today' | '7d' | '30d' | 'all') {
  if (value === 'all' || !row.openedAtMs) return true;
  const now = Date.now();
  const days = value === 'today' ? 1 : value === '7d' ? 7 : 30;
  return now - row.openedAtMs <= days * 24 * 60 * 60 * 1000;
}

function formatCampaignDate(value = new Date()) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'numeric',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(value);
}

function readStoredCampaignRows(): CampaignRow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(liveCampaignStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredCampaignRows(rows: CampaignRow[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(liveCampaignStorageKey, JSON.stringify(rows));
}

function campaignRowFromCreateResult(account: SelectedAdsAccount, name: string, variant: 'live' | 'product', result: CreateLiveCampaignResult): CampaignRow {
  const campaignId = result.campaignId ? String(result.campaignId) : `local-${Date.now()}`;
  const now = formatCampaignDate();
  const isVisibility = variant === 'product';
  return {
    id: campaignId,
    detailId: result.campaignUuid ?? campaignId,
    name,
    detailName: name,
    type: isVisibility ? 'visibility' : 'live-gmv',
    typeLabel: isVisibility ? 'เพิ่มการมองเห็น' : 'LIVE GMV Max',
    shop: account.shopId ?? account.name,
    account: account.id,
    state: 'ongoing',
    status: 'กำลังโฆษณา',
    delivery: 'กำลังโฆษณา',
    updatedAt: now,
    createdAt: now,
    dailyBudget: result.request?.dailyBudgetBaht ? `฿${result.request.dailyBudgetBaht.toLocaleString('th-TH')}` : 'ไม่จำกัด',
    dailyBudgetBaht: result.request?.dailyBudgetBaht ?? null,
    automationSettings: asAutomationSettings((result.request as { automationSettings?: unknown } | undefined)?.automationSettings),
    cost: '-',
    roi: '-',
    liveViews: '-',
    optimizeBudget: '-',
    skuOrders: '-',
    conversionRate: '-',
    sales: '-',
  };
}

function formatMetricNumber(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('th-TH') : '-';
}

function formatMetricMoney(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? '฿' + value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
}

function formatMetricPercent(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  const percent = value <= 1 ? value * 100 : value;
  return percent.toLocaleString('th-TH', { maximumFractionDigits: 2 }) + '%';
}

function formatMetricRatio(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
}

function campaignRowFromRecord(account: AdsAccount, record: AdsLiveCampaignRecord): CampaignRow {
  const isVisibility = record.objective === 'max_view';
  const createdAt = formatCampaignDate(new Date(record.createdAt));
  const updatedAt = formatCampaignDate(new Date(record.updatedAt));
  const dailyBudget = record.dailyBudgetBaht && record.dailyBudgetBaht > 0
    ? `฿${record.dailyBudgetBaht.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'ไม่จำกัด';
  return {
    id: String(record.campaignId),
    detailId: record.campaignUuid ?? String(record.campaignId),
    name: record.name,
    detailName: record.name,
    type: isVisibility ? 'visibility' : 'live-gmv',
    typeLabel: isVisibility ? 'เพิ่มการมองเห็น' : 'LIVE GMV Max',
    shop: account.id,
    account: account.uid,
    state: record.state,
    status: campaignRowStateText(record.state).status,
    delivery: campaignRowStateText(record.state).delivery,
    updatedAt,
    createdAt,
    dailyBudget,
    dailyBudgetBaht: record.dailyBudgetBaht ?? null,
    automationSettings: asAutomationSettings(record.automationSettings),
    startTime: record.startTime ?? null,
    endTime: record.endTime ?? null,
    timeSlotList: record.timeSlotList ?? null,
    roiTwoTargetValue: record.roiTwoTargetValue ?? null,
    cost: formatMetricMoney(record.metrics?.costBaht),
    roi: formatMetricRatio(record.metrics?.roas),
    liveViews: formatMetricNumber(record.metrics?.views),
    optimizeBudget: '-',
    skuOrders: formatMetricNumber(record.metrics?.orders),
    conversionRate: formatMetricPercent(record.metrics?.conversionRate),
    sales: formatMetricMoney(record.metrics?.salesBaht),
  };
}

function campaignRowStateText(state?: string | null) {
  if (state === 'ongoing') return { status: 'กำลังโฆษณา', delivery: 'กำลังโฆษณา' };
  if (state === 'paused') return { status: 'หยุดชั่วคราว', delivery: 'หยุดชั่วคราว' };
  if (state === 'ended' || state === 'closed') return { status: 'สิ้นสุดแล้ว', delivery: 'สิ้นสุดแล้ว' };
  if (state === 'scheduled') return { status: 'พร้อมเริ่ม', delivery: 'พร้อมเริ่ม' };
  return { status: state || 'รอตรวจสอบสถานะ', delivery: 'ไม่มีการนำเสนอ' };
}

function campaignStateBadgeClass(state?: string | null) {
  if (state === 'ongoing') return 'bg-[#0f8a50] text-white';
  if (state === 'paused') return 'bg-[#8a5a16] text-[#fff2d0]';
  if (state === 'ended' || state === 'closed') return 'bg-[#3a3a3a] text-[#d7d7d7]';
  return 'bg-[#26364c] text-[#cfe7ff]';
}

function parseCampaignDailyBudgetBaht(value: string) {
  const normalized = value.replace(/[^\d.]/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function finitePositiveNumber(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function unixSecondsToBangkokDate(value?: number | null) {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value * 1000));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return map.year && map.month && map.day ? `${map.year}-${map.month}-${map.day}` : '';
}

function secondsToClockParts(value?: number | null) {
  const seconds = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
  const minutes = Math.floor(seconds / 60);
  return {
    hour: String(Math.floor(minutes / 60) % 24).padStart(2, '0'),
    minute: String(minutes % 60).padStart(2, '0'),
  };
}

function budgetStepSuggestion(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount % liveCampaignBudgetStepBaht === 0) return null;
  return Math.max(liveCampaignBudgetStepBaht, Math.ceil(amount / liveCampaignBudgetStepBaht) * liveCampaignBudgetStepBaht);
}

function queryNumber(params: URLSearchParams, key: string) {
  const value = Number(params.get(key));
  return Number.isFinite(value) ? value : null;
}

function asAutomationSettings(value: unknown): LiveCampaignAutomationSettings | null {
  return value && typeof value === 'object' ? value as LiveCampaignAutomationSettings : null;
}

function automationSettingsFromQuery(params: URLSearchParams) {
  const raw = params.get('automationSettings');
  if (!raw) return null;
  try {
    return asAutomationSettings(JSON.parse(raw));
  } catch {
    return null;
  }
}

function normalizeBudgetStep(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return value;
  return String(Math.max(liveCampaignBudgetStepBaht, Math.ceil(amount / liveCampaignBudgetStepBaht) * liveCampaignBudgetStepBaht));
}

function normalizeAutomationSettings(settings: LiveCampaignAutomationSettings | null) {
  if (!settings) return settings;
  return {
    ...settings,
    timeBoostRows: settings.timeBoostRows.map((row) => ({ ...row, addAmount: normalizeBudgetStep(row.addAmount) })),
    timeBoostRepeatAddAmount: normalizeBudgetStep(settings.timeBoostRepeatAddAmount ?? ''),
    specialBoostRows: settings.specialBoostRows.map((row) => ({ ...row, addAmount: normalizeBudgetStep(row.addAmount) })),
  };
}


function formatTimeBoostSummary(rows: TimeBoostRowSetting[] | undefined) {
  const usableRows = (rows ?? [])
    .filter((row) => row.hour !== '' && row.minute !== '' && row.addAmount !== '')
    .slice(0, 3)
    .map((row) => String(row.hour).padStart(2, '0') + ':' + String(row.minute).padStart(2, '0') + ' เพิ่ม ฿' + Number(row.addAmount).toLocaleString('th-TH'));
  if (!usableRows.length) return null;
  return usableRows.join(', ') + ((rows?.length ?? 0) > 3 ? ' ...' : '');
}

function automationUpdateMessage(name: string, settings: LiveCampaignAutomationSettings | null) {
  if (!settings) return 'อัปเดตแคมเปญ ' + name + ' แล้ว';
  const actions: string[] = [];
  const timeBoost = settings.timeBoostEnabled ? formatTimeBoostSummary(settings.timeBoostRows) : null;
  if (timeBoost) actions.push('ตั้งเวลาเพิ่มงบแล้ว: ' + timeBoost);
  if (settings.timeBoostRepeatEnabled && settings.timeBoostRepeatAddAmount) {
    const repeatHours = Number(settings.timeBoostRepeatHours || 0);
    const repeatMinutes = Number(settings.timeBoostRepeatMinutes || 0);
    const repeatText = repeatHours > 0 && repeatMinutes > 0 ? repeatHours + ' ชม. ' + repeatMinutes + ' นาที' : repeatHours > 0 ? repeatHours + ' ชม.' : repeatMinutes + ' นาที';
    actions.push('ตั้งเพิ่มงบซ้ำแล้ว: เพิ่ม ฿' + Number(settings.timeBoostRepeatAddAmount).toLocaleString('th-TH') + ' ทุก ' + repeatText);
  }
  const specialBoost = settings.specialBoostEnabled ? formatTimeBoostSummary(settings.specialBoostRows) : null;
  if (specialBoost) actions.push('ตั้งเวลาขยายงบพิเศษแล้ว: ' + specialBoost);
  if (settings.budgetSlapEnabled) actions.push('ตั้งตบงบ/เพิ่มงบอัตโนมัติแล้ว');
  if (settings.profitCheckEnabled) actions.push('ตั้งเช็กความคุ้มค่าแล้ว');
  if (settings.recreateInactiveEnabled || settings.noOrderGuardEnabled || settings.badResultGuardEnabled || settings.recreateNoOrderAfterBudget || settings.scheduleRecreateEnabled) actions.push('ตั้งปิดตัวเดิม/ขึ้นตัวใหม่แล้ว');
  if (settings.advancedEnabled) actions.push('ตั้งค่าขั้นสูงแล้ว');
  return actions.length ? actions.join(' | ') : 'อัปเดตแคมเปญ ' + name + ' แล้ว';
}
function editingCampaignFromQuery(params: URLSearchParams, view: 'live' | 'product' | 'overview'): EditingLiveCampaign | null {
  const campaignId = Number(params.get('campaignId'));
  if (params.get('mode') !== 'edit' || !Number.isSafeInteger(campaignId) || campaignId <= 0) return null;
  const dailyBudgetBaht = finitePositiveNumber(queryNumber(params, 'dailyBudgetBaht'));
  const startTime = queryNumber(params, 'startTime');
  const endTime = queryNumber(params, 'endTime');
  const roiTwoTargetValue = finitePositiveNumber(queryNumber(params, 'roiTwoTargetValue'));
  const slotStart = queryNumber(params, 'timeSlotStart');
  const slotEnd = queryNumber(params, 'timeSlotEnd');
  return {
    campaignId,
    name: params.get('campaignName') ?? 'Live Ads',
    objective: view === 'product' ? 'max_view' : 'max_gmv_roi_two',
    dailyBudgetBaht,
    automationSettings: automationSettingsFromQuery(params),
    startTime,
    endTime,
    timeSlotList: slotStart !== null || slotEnd !== null ? [{ start_time: slotStart ?? 0, end_time: slotEnd ?? 0 }] : null,
    roiTwoTargetValue,
  };
}

function rememberCreatedCampaign(row: CampaignRow) {
  const storedRows = readStoredCampaignRows();
  const nextRows = [row, ...storedRows.filter((item) => item.id !== row.id)];
  writeStoredCampaignRows(nextRows);
  window.dispatchEvent(new Event('np-live-campaign-created'));
}

function CampaignManagerList({ onOpenRules }: { onOpenRules: (view?: 'live' | 'product', account?: SelectedAdsAccount, campaign?: EditingLiveCampaign, draft?: DraftLiveCampaign) => void }) {
  const [typeFilter, setTypeFilter] = useState<'all' | 'live-gmv' | 'visibility'>('all');
  const [query, setQuery] = useState('');
  const [displayMode, setDisplayMode] = useState<'table' | 'card'>('table');
  const [campaignRows, setCampaignRows] = useState<CampaignRow[]>(initialCampaignRows);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(initialCampaignRows[0]?.id ?? null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'info' | 'warning'; text: string } | null>(null);
  const [copySource, setCopySource] = useState<CampaignRow | null>(null);
  const [copyName, setCopyName] = useState('');
  const [copyCreating, setCopyCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CampaignRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<CampaignRow | null>(null);
  const [historyResult, setHistoryResult] = useState<LiveCampaignHistoryResult | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDeviceFilter, setHistoryDeviceFilter] = useState('all');
  const [historyOperatorFilter, setHistoryOperatorFilter] = useState('all');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('all');
  const [historyDateFilter, setHistoryDateFilter] = useState<'today' | '7d' | '30d' | 'all'>('today');
  const [accounts, setAccounts] = useState(accountRows);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [deleteAccountTarget, setDeleteAccountTarget] = useState<AdsAccount | null>(null);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [campaignActionPending, setCampaignActionPending] = useState<Record<string, 'pause' | 'resume' | 'stop'>>({});
  const filterOptions = [
    { label: 'ทั้งหมด', value: 'all' as const },
    { label: 'LIVE GMV Max', value: 'live-gmv' as const },
    { label: 'เพิ่มการมองเห็น', value: 'visibility' as const },
  ];
  const normalizedQuery = query.trim().toLowerCase();
  const historyAutomationSettings = historyTarget?.automationSettings as (Record<string, unknown> | null | undefined);
  const historyStepBaht = Number(historyAutomationSettings?.repeatBudgetBoostAddBaht ?? historyAutomationSettings?.timeBoostRepeatAddAmount ?? 50);
  const historyRows = normalizeCampaignHistoryRows(historyResult?.history, historyResult?.source, { currentBudgetBaht: historyTarget?.dailyBudgetBaht, stepBaht: Number.isFinite(historyStepBaht) ? historyStepBaht : 50 });
  const historyDevices = Array.from(new Set(historyRows.map((row) => row.device).filter((value) => value && value !== '-')));
  const historyOperators = Array.from(new Set(historyRows.map((row) => row.operator).filter((value) => value && value !== '-')));
  const historyTypes = Array.from(new Set(historyRows.map((row) => row.actionType).filter((value) => value && value !== '-')));
  const filteredHistoryRows = historyRows.filter((row) => {
    if (!filterHistoryByDate(row, historyDateFilter)) return false;
    if (historyDeviceFilter !== 'all' && row.device !== historyDeviceFilter) return false;
    if (historyOperatorFilter !== 'all' && row.operator !== historyOperatorFilter) return false;
    if (historyTypeFilter !== 'all' && row.actionType !== historyTypeFilter) return false;
    return true;
  });
  const filteredRows = campaignRows.filter((row) => {
    const matchesType = typeFilter === 'all' || row.type === typeFilter;
    const matchesQuery = !normalizedQuery || [row.name, row.detailName, row.shop, row.account, row.id].some((value) => value.toLowerCase().includes(normalizedQuery));
    return matchesType && matchesQuery;
  });
  const summary = {
    total: filteredRows.length,
    active: filteredRows.filter((row) => row.state === 'ongoing').length,
    paused: filteredRows.filter((row) => row.state === 'paused').length,
    ended: filteredRows.filter((row) => row.state === 'ended' || row.state === 'closed').length,
    error: filteredRows.filter((row) => row.status.includes('ผิดพลาด')).length,
  };
  const liveCount = filteredRows.filter((row) => row.type === 'live-gmv').length;
  const visibilityCount = filteredRows.filter((row) => row.type === 'visibility').length;

  function clearFilters() {
    setTypeFilter('all');
    setQuery('');
    setDisplayMode('table');
  }

  function formatNow() {
    return new Intl.DateTimeFormat('th-TH', {
      day: 'numeric',
      month: 'numeric',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());
  }

  function formatRecordDate(value?: string | null) {
    if (!value) return formatNow();
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return formatNow();
    return new Intl.DateTimeFormat('th-TH', {
      day: 'numeric',
      month: 'numeric',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  }

  function accountFromRecord(record: AdsAccountRecord): AdsAccount {
    const accountName = record.accountName || record.shopName || 'บัญชี Ads';
    return {
      uid: record.id,
      id: record.shopId || record.id,
      name: accountName,
      account: record.id,
      status: record.status === 'ACTIVE' ? 'พร้อมใช้งาน' : record.status === 'INVALID' ? 'ต้องตรวจสอบ' : 'รอตรวจสอบ',
      checkedAt: formatRecordDate(record.checkedAt ?? record.updatedAt ?? record.createdAt),
    };
  }

  function accountFromCookieResult(result: CheckCookieResult, fallbackIndex: number): AdsAccount {
    const accountId = result.shopId ?? result.platformUid ?? result.userId ?? `ads-${fallbackIndex}`;
    const accountName = result.accountName ?? result.name ?? result.username ?? `บัญชี Ads ${fallbackIndex}`;
    const uid = `${String(accountId)}-${Date.now()}-${fallbackIndex}`;
    return {
      uid,
      id: String(accountId),
      name: accountName,
      account: uid,
      status: result.valid ? 'พร้อมใช้งาน' : 'ต้องตรวจสอบ',
      checkedAt: formatNow(),
    };
  }

  useEffect(() => {
    function syncStoredCampaigns() {
      setCampaignRows(readStoredCampaignRows());
    }
    syncStoredCampaigns();
    window.addEventListener('storage', syncStoredCampaigns);
    window.addEventListener('np-live-campaign-created', syncStoredCampaigns);
    return () => {
      window.removeEventListener('storage', syncStoredCampaigns);
      window.removeEventListener('np-live-campaign-created', syncStoredCampaigns);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAccountsLoading(true);
    adsAccountService.list()
      .then((items) => {
        const nextAccounts = items.map(accountFromRecord);
        if (!cancelled) setAccounts(nextAccounts);
        return Promise.allSettled(nextAccounts.map(async (account) => {
          const campaigns = await adsAccountService.listLiveCampaigns(account.uid);
          return campaigns.map((campaign) => campaignRowFromRecord(account, campaign));
        }));
      })
      .then((results) => {
        if (!cancelled && results) {
          const failed = results.filter((result) => result.status === 'rejected');
          const shopeeRows = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
          const storedRows = readStoredCampaignRows().filter((row) => !shopeeRows.some((item) => item.id === row.id));
          setCampaignRows([...shopeeRows, ...storedRows]);
          if (failed.length) showNotice('โหลดบางแคมเปญไม่สำเร็จ ระบบยังคงแสดงบัญชี Ads และข้อมูลที่มีอยู่', 'warning');
        }
      })
      .catch((error) => {
        if (!cancelled) showNotice(error instanceof Error ? error.message : 'โหลดบัญชี Ads ไม่สำเร็จ', 'warning');
      })
      .finally(() => {
        if (!cancelled) setAccountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    if (!accounts.length) return;
    let cancelled = false;
    async function refreshCampaignRows() {
      const results = await Promise.allSettled(accounts.map(async (account) => {
        const campaigns = await adsAccountService.listLiveCampaigns(account.uid);
        return campaigns.map((campaign) => campaignRowFromRecord(account, campaign));
      }));
      if (cancelled) return;
      const shopeeRows = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
      if (!shopeeRows.length) return;
      const storedRows = readStoredCampaignRows().filter((row) => !shopeeRows.some((item) => item.id === row.id));
      setCampaignRows([...shopeeRows, ...storedRows]);
    }
    const timer = window.setInterval(() => { void refreshCampaignRows(); }, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [accounts]);

  async function refreshCampaignRowsNow() {
    if (!accounts.length) return;
    const results = await Promise.allSettled(accounts.map(async (account) => {
      const campaigns = await adsAccountService.listLiveCampaigns(account.uid);
      return campaigns.map((campaign) => campaignRowFromRecord(account, campaign));
    }));
    const shopeeRows = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
    if (!shopeeRows.length) return;
    const storedRows = readStoredCampaignRows().filter((row) => !shopeeRows.some((item) => item.id === row.id));
    setCampaignRows([...shopeeRows, ...storedRows]);
  }

  function showNotice(text: string, tone: 'success' | 'info' | 'warning' = 'info') {
    setNotice({ text, tone });
    window.setTimeout(() => setNotice(null), 2800);
  }

  function openAddAccount() {
    if (accounts.length >= 3) {
      showNotice('ใช้งานครบตามแพ็กเกจแล้ว กรุณาติดต่อแอดมิน', 'warning');
      return;
    }
    setAddAccountOpen(true);
  }

  async function addAccount(cookie: string) {
    if (accounts.length >= 3) {
      setAddAccountOpen(false);
      showNotice('ใช้งานครบตามแพ็กเกจแล้ว กรุณาติดต่อแอดมิน', 'warning');
      return;
    }
    const nextIndex = accounts.length + 1;
    const result = await accountService.checkCookie({ platform: 'SHOPEE', cookie });
    if (!result.valid) {
      showNotice(result.message ?? 'คุกกี้หมดอายุ หรือไม่สามารถดึงข้อมูลบัญชีได้', 'warning');
      return;
    }
    const checkedAccount = accountFromCookieResult(result, nextIndex);
    const savedAccount = await adsAccountService.create({
      accountName: checkedAccount.name,
      shopName: checkedAccount.name,
      shopId: checkedAccount.id,
      adsCookie: cookie,
    });
    const nextAccount = accountFromRecord(savedAccount);
    setAccounts((items) => [nextAccount, ...items]);
    setAddAccountOpen(false);
    showNotice(`เพิ่มบัญชี ${nextAccount.name} แล้ว`, 'success');
  }

  function accountForCampaign(row: CampaignRow) {
    return accounts.find((account) => account.uid === row.account);
  }

  async function toggleCampaignRunState(row: CampaignRow) {
    const account = accountForCampaign(row);
    const campaignId = Number(row.id);
    if (!account || !Number.isFinite(campaignId)) {
      showNotice('ไม่พบบัญชี Ads หรือ Campaign ID สำหรับสั่งงาน Shopee', 'warning');
      return;
    }
    const nextType = row.state === 'ongoing' ? 'pause' : 'resume';
    setCampaignActionPending((current) => ({ ...current, [row.id]: nextType }));
    if (nextType === 'resume') {
      const pendingTexts = campaignRowStateText('ongoing');
      setCampaignRows((rows) => rows.map((item) => (
        item.id === row.id
          ? { ...item, state: 'ongoing', status: pendingTexts.status, delivery: pendingTexts.delivery, updatedAt: formatNow() }
          : item
      )));
    }
    const result = await adsAccountService.updateLiveCampaignState(account.uid, campaignId, {
      type: nextType,
      objective: row.type === 'visibility' ? 'max_view' : 'max_gmv_roi_two',
    }).finally(() => {
      setCampaignActionPending((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
    });
    const nextTime = formatNow();
    if (!result.success) {
      if (result.accepted) {
        const assumedState = nextType === 'pause' ? 'paused' : 'ongoing';
        const assumedTexts = campaignRowStateText(assumedState);
        setCampaignRows((rows) => rows.map((item) => (
          item.id === row.id
            ? { ...item, state: assumedState, status: assumedTexts.status, delivery: assumedTexts.delivery, updatedAt: nextTime }
            : item
        )));
        setExpandedCampaignId(row.id);
        window.setTimeout(() => {
          void refreshCampaignRowsNow().catch(() => undefined);
        }, 1800);
        return;
      }
      const actualTexts = campaignRowStateText(result.state ?? row.status);
      setCampaignRows((rows) => rows.map((item) => (
        item.id === row.id
          ? { ...item, state: result.state ?? item.state, status: actualTexts.status, delivery: actualTexts.delivery, updatedAt: nextTime }
          : item
      )));
      showNotice(`Shopee ยังไม่เปลี่ยนสถานะแคมเปญ ${row.name} กรุณาตรวจสอบสถานะอีกครั้ง`, 'warning');
      await refreshCampaignRowsNow().catch(() => undefined);
      return;
    }
    const nextState = result.state;
    const nextTexts = campaignRowStateText(nextState);
    setCampaignRows((rows) => rows.map((item) => (
      item.id === row.id
        ? {
            ...item,
            state: result.state ?? item.state,
            status: nextTexts.status,
            delivery: nextTexts.delivery,
            updatedAt: nextTime,
          }
        : item
    )));
    setExpandedCampaignId(row.id);
    showNotice(`${nextType === 'pause' ? 'หยุดชั่วคราว' : 'เริ่ม'}แคมเปญ ${row.name} แล้ว`, 'success');
    await refreshCampaignRowsNow().catch(() => undefined);
  }

  async function stopCampaign(row: CampaignRow) {
    const account = accountForCampaign(row);
    const campaignId = Number(row.id);
    if (!account || !Number.isFinite(campaignId)) {
      showNotice('ไม่พบบัญชี Ads หรือ Campaign ID สำหรับสั่งงาน Shopee', 'warning');
      return;
    }
    const result = await adsAccountService.updateLiveCampaignState(account.uid, campaignId, { type: 'stop' });
    const nextTime = formatNow();
    if (!result.success) {
      const actualTexts = campaignRowStateText(result.state ?? row.status);
      setCampaignRows((rows) => rows.map((item) => (
        item.id === row.id
          ? { ...item, state: result.state ?? item.state, status: actualTexts.status, delivery: actualTexts.delivery, updatedAt: nextTime }
          : item
      )));
      showNotice(`Shopee ยังไม่หยุดแคมเปญ ${row.name} กรุณาตรวจสอบสถานะอีกครั้ง`, 'warning');
      await refreshCampaignRowsNow().catch(() => undefined);
      return;
    }
    const nextTexts = campaignRowStateText(result.state);
    setCampaignRows((rows) => rows.map((item) => (
      item.id === row.id
        ? { ...item, state: result.state ?? item.state, status: nextTexts.status, delivery: nextTexts.delivery, updatedAt: nextTime }
        : item
    )));
    setExpandedCampaignId(row.id);
    showNotice(`หยุดแคมเปญ ${row.name} แล้ว`, 'warning');
    await refreshCampaignRowsNow().catch(() => undefined);
  }


  async function openCampaignHistory(row: CampaignRow) {
    const account = accountForCampaign(row);
    const campaignId = Number(row.id);
    if (!account || !Number.isFinite(campaignId)) {
      showNotice('ไม่พบบัญชี Ads หรือ Campaign ID สำหรับดูประวัติ', 'warning');
      return;
    }
    setHistoryTarget(row);
    setHistoryResult(null);
    setHistoryLoading(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const result = await adsAccountService.getLiveCampaignHistory(account.uid, campaignId, {
        from: urlParams.get('from'),
        to: urlParams.get('to'),
        group: urlParams.get('group'),
      });
      setHistoryResult(result);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'โหลดประวัติแคมเปญไม่สำเร็จ', 'warning');
      setHistoryTarget(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  function openCopyDialog(row: CampaignRow) {
    setCopySource(row);
    setCopyName(`${row.name} Copy`);
  }

  async function duplicateCampaign() {
    if (!copySource || copyCreating) return;
    const source = copySource;
    const nextName = copyName.trim() || `${source.name} Copy`;
    const account = accounts.find((item) => item.uid === source.account);
    if (!account) {
      showNotice(`ไม่พบบัญชี Ads ของแคมเปญ ${source.name}`, 'warning');
      return;
    }
    const selectedAccount: SelectedAdsAccount = { id: account.uid, name: account.name, shopId: account.id };
    setCopyCreating(true);
    try {
      const result = await adsAccountService.createLiveCampaign(account.uid, {
        name: nextName,
        objective: source.type === 'visibility' ? 'max_view' : 'max_gmv_roi_two',
        dailyBudget: source.dailyBudgetBaht ?? undefined,
        automationSettings: source.automationSettings ?? undefined,
      });
      if (result.created) {
        const newRow = campaignRowFromCreateResult(selectedAccount, nextName, source.type === 'visibility' ? 'product' : 'live', result);
        rememberCreatedCampaign(newRow);
        setCampaignRows((rows) => [newRow, ...rows.filter((item) => item.id !== newRow.id)]);
        setExpandedCampaignId(newRow.id);
        setCopySource(null);
        setCopyName('');
        showNotice(`สร้างแคมเปญสำเนา ${nextName} จาก ${source.name} แล้ว`, 'success');
        return;
      }
      showNotice(result.shopeeMessage || `Shopee ยังไม่สร้างสำเนา ${nextName}`, 'warning');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'สร้างแคมเปญจากสำเนาไม่สำเร็จ', 'warning');
    } finally {
      setCopyCreating(false);
    }
  }

  function deleteCampaign(row: CampaignRow) {
    setDeleteTarget(row);
  }

  async function confirmDeleteCampaign() {
    if (!deleteTarget || deleteLoading) return;
    const target = deleteTarget;
    const account = accountForCampaign(target);
    const campaignId = Number(target.id);
    if (!account || !Number.isFinite(campaignId)) {
      showNotice('ไม่พบบัญชี Ads หรือ Campaign ID สำหรับลบแคมเปญ', 'warning');
      return;
    }
    setDeleteLoading(true);
    try {
      const result = await adsAccountService.deleteLiveCampaign(account.uid, campaignId);
      if (!result.success) {
        showNotice('Shopee ยังไม่อนุญาตให้ลบแคมเปญนี้ กรุณาหยุดแคมเปญก่อนแล้วลองใหม่', 'warning');
        return;
      }
      setCampaignRows((rows) => {
        const nextRows = rows.filter((item) => item.id !== target.id);
        writeStoredCampaignRows(nextRows);
        return nextRows;
      });
      setExpandedCampaignId((current) => (current === target.id ? null : current));
      setDeleteTarget(null);
      showNotice(`ลบแคมเปญ ${target.name} แล้ว`, 'success');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'ลบแคมเปญไม่สำเร็จ', 'warning');
    } finally {
      setDeleteLoading(false);
    }
  }

  async function confirmDeleteAccount() {
    if (!deleteAccountTarget) return;
    const accountName = deleteAccountTarget.name;
    const accountUid = deleteAccountTarget.uid;
    const accountCode = deleteAccountTarget.account;
    await adsAccountService.remove(accountUid);
    setAccounts((items) => items.filter((item) => item.uid !== accountUid));
    setCampaignRows((rows) => rows.filter((item) => item.account !== accountCode));
    setExpandedCampaignId((current) => {
      const removedCampaign = campaignRows.find((item) => item.id === current && item.account === accountCode);
      return removedCampaign ? null : current;
    });
    setDeleteAccountTarget(null);
    showNotice(`ลบบัญชี ${accountName} แล้ว`, 'warning');
  }

  function editCampaign(row: CampaignRow) {
    const account = accounts.find((item) => item.account === row.account);
    if (!account) {
      showNotice(`ไม่พบบัญชี Ads ของแคมเปญ ${row.name}`, 'warning');
      return;
    }
    onOpenRules(row.type === 'visibility' ? 'product' : 'live', {
      id: account.uid,
      name: account.name,
      shopId: account.id,
    }, {
      campaignId: Number(row.id),
      name: row.name,
      objective: row.type === 'visibility' ? 'max_view' : 'max_gmv_roi_two',
      dailyBudgetBaht: row.dailyBudgetBaht ?? parseCampaignDailyBudgetBaht(row.dailyBudget),
      automationSettings: row.automationSettings ?? null,
      startTime: row.startTime ?? null,
      endTime: row.endTime ?? null,
      timeSlotList: row.timeSlotList ?? null,
      roiTwoTargetValue: row.roiTwoTargetValue ?? null,
    });
  }

  function createCampaignForAccount(account: AdsAccount, view: 'live' | 'product' = 'live') {
    const params = new URLSearchParams({
      adsAccountId: account.uid,
      shopId: account.id,
      accountName: account.name,
    });
    window.location.href = `/tools/control-ads/${view}?${params.toString()}`;
  }

  return (
    <section className="mt-5 rounded-[14px] border border-[#5b4118] bg-[#080b0d] p-5 shadow-[0_18px_50px_rgba(0,0,0,.22)]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[20px] font-black text-[#f7f1e7]">กลุ่มแคมเปญ</h3>
          <p className="mt-1 text-[12px] font-semibold text-[#9bb7d6]">ติดตามโฆษณา Shopee Live Ads และสถานะพร้อมใช้งานแบบเดียวกับหน้าจัดการ Ads</p>
        </div>
        <button type="button" onClick={openAddAccount} className="rounded-lg border border-[#8a641d] bg-[#100c05] px-4 py-2 text-[12px] font-black text-[#f5bd37]">+ เพิ่มบัญชี Ads</button>
      </div>
      <AddAdsAccountDialog open={addAccountOpen} onClose={() => setAddAccountOpen(false)} onSubmit={addAccount} />
      {notice ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-[7px]">
          <div className={`w-full max-w-[460px] overflow-hidden rounded-[20px] border bg-[radial-gradient(circle_at_10%_0%,rgba(45,167,255,.24),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(242,189,75,.18),transparent_32%),linear-gradient(135deg,#07111f_0%,#05070b_56%,#171004_100%)] p-6 text-[#f7f1e7] shadow-[0_32px_100px_rgba(0,0,0,.62),0_0_38px_rgba(45,167,255,.12),inset_0_1px_0_rgba(255,255,255,.08)] ${notice.tone === 'success' ? 'border-[#2fd67a]/55' : notice.tone === 'warning' ? 'border-[#f5bd37]/70' : 'border-[#2da7ff]/45'}`}>
            <div className={`mb-4 grid h-12 w-12 place-items-center rounded-[14px] border ${notice.tone === 'success' ? 'border-[#2fd67a]/45 bg-[#082817] text-[#7dffae]' : notice.tone === 'warning' ? 'border-[#f5bd37]/45 bg-[#2c2109] text-[#ffd86a]' : 'border-[#2da7ff]/45 bg-[#071f3d] text-[#9ed7ff]'}`}>
              {notice.tone === 'success' ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
            </div>
            <p className="text-[24px] font-black text-white drop-shadow-[0_2px_12px_rgba(45,167,255,.16)]">แจ้งเตือน</p>
            <p className="mt-3 text-[14px] font-bold leading-7 text-[#d7ecff]">{notice.text}</p>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setNotice(null)} className="rounded-[10px] bg-gradient-to-r from-[#ffd86a] to-[#e0a018] px-6 py-2.5 text-[13px] font-black text-black transition hover:brightness-110">ตกลง</button>
            </div>
          </div>
        </div>
      ) : null}

      {historyTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <div className="w-full max-w-[900px] rounded-[10px] border border-[#365879] bg-[#071321] p-4 text-[#f7f1e7] shadow-[0_22px_80px_rgba(0,0,0,.55)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[18px] font-black text-[#f7f1e7]">ประวัติการดำเนินการ</p>
                <p className="mt-1 text-[12px] font-semibold text-[#9bb7d6]">{historyTarget.name} | Campaign ID: {historyTarget.id}</p>
              </div>
              <button type="button" onClick={() => { setHistoryTarget(null); setHistoryResult(null); }} className="grid h-8 w-8 place-items-center rounded-full border border-[#365879] text-[18px] font-black text-[#c9d9ea] hover:border-[#f5bd37] hover:text-[#f5bd37]" aria-label="ปิด">x</button>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold">
                <span className="text-[#9bb7d6]">อุปกรณ์</span>
                <button type="button" onClick={() => setHistoryDeviceFilter('all')} className={`rounded-full border px-3 py-1 ${historyDeviceFilter === 'all' ? 'border-[#f05a38] text-[#f05a38]' : 'border-[#365879] text-[#d7ecff]'}`}>ทั้งหมด</button>
                {historyDevices.map((device) => (
                  <button key={device} type="button" onClick={() => setHistoryDeviceFilter(device)} className={`rounded-full border px-3 py-1 ${historyDeviceFilter === device ? 'border-[#f05a38] text-[#f05a38]' : 'border-[#365879] text-[#d7ecff]'}`}>{device}</button>
                ))}
                <span className="ml-3 text-[#9bb7d6]">วัน</span>
                {[
                  { label: 'วันนี้', value: 'today' as const },
                  { label: '7 วันที่ผ่านมา', value: '7d' as const },
                  { label: '30 วันที่ผ่านมา', value: '30d' as const },
                  { label: 'ทั้งหมด', value: 'all' as const },
                ].map((item) => (
                  <button key={item.value} type="button" onClick={() => setHistoryDateFilter(item.value)} className={`rounded-full border px-3 py-1 ${historyDateFilter === item.value ? 'border-[#f05a38] text-[#f05a38]' : 'border-[#365879] text-[#d7ecff]'}`}>{item.label}</button>
                ))}
              </div>

              <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <label className="grid gap-1 text-[11px] font-bold text-[#9bb7d6]">
                  ผู้ดำเนินการ
                  <select value={historyOperatorFilter} onChange={(event) => setHistoryOperatorFilter(event.target.value)} className="h-9 rounded border border-[#365879] bg-[#05090f] px-3 text-[12px] font-bold text-[#f7f1e7]">
                    <option value="all">ทั้งหมด</option>
                    {historyOperators.map((operator) => <option key={operator} value={operator}>{operator}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-[11px] font-bold text-[#9bb7d6]">
                  ประเภทการดำเนินการ
                  <select value={historyTypeFilter} onChange={(event) => setHistoryTypeFilter(event.target.value)} className="h-9 rounded border border-[#365879] bg-[#05090f] px-3 text-[12px] font-bold text-[#f7f1e7]">
                    <option value="all">ทั้งหมด</option>
                    {historyTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => { setHistoryDeviceFilter('all'); setHistoryOperatorFilter('all'); setHistoryTypeFilter('all'); setHistoryDateFilter('today'); }} className="self-end rounded border border-[#365879] px-3 py-2 text-[12px] font-black text-[#d7ecff] hover:border-[#f5bd37] hover:text-[#f5bd37]">ล้างตัวกรอง</button>
              </div>
            </div>

            <div className="mt-4 max-h-[420px] overflow-auto rounded-[8px] border border-[#244a70] bg-[#060b12]">
              {historyLoading ? (
                <p className="p-4 text-[13px] font-semibold text-[#9bb7d6]">กำลังโหลดประวัติ...</p>
              ) : filteredHistoryRows.length ? (
                <table className="min-w-[760px] w-full border-collapse text-left text-[12px]">
                  <thead className="sticky top-0 bg-[#0d1a28] text-[#9bb7d6]">
                    <tr>
                      <th className="border-b border-[#244a70] px-3 py-3 font-black">เวลาที่อัปเดต (GMT+7)</th>
                      <th className="border-b border-[#244a70] px-3 py-3 font-black">ผู้ดำเนินการ</th>
                      <th className="border-b border-[#244a70] px-3 py-3 font-black">อุปกรณ์</th>
                      <th className="border-b border-[#244a70] px-3 py-3 font-black">ประเภทการดำเนินการ</th>
                      <th className="border-b border-[#244a70] px-3 py-3 font-black">รายละเอียด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistoryRows.map((row) => (
                      <tr key={row.id} className="border-b border-[#132a40] text-[#f7f1e7] last:border-b-0">
                        <td className="px-3 py-3 whitespace-nowrap">{row.openedAt}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{row.operator}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{row.device}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{row.actionType}</td>
                        <td className="px-3 py-3 text-[#d7ecff]">{row.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="grid min-h-[180px] place-items-center p-6 text-center">
                  <div>
                    <p className="text-[14px] font-black text-[#f7f1e7]">ยังไม่มีประวัติตามตัวกรองนี้</p>
                    <p className="mt-1 text-[12px] font-semibold text-[#9bb7d6]">ลองเปลี่ยนวัน อุปกรณ์ ผู้ดำเนินการ หรือประเภทการดำเนินการ</p>
                  </div>
                </div>
              )}
            </div>
            {historyResult?.source ? <p className="mt-2 text-[11px] font-bold text-[#8dc7ff]">แหล่งข้อมูล: {historyResult.source === 'shopee' ? 'Shopee' : 'NP LIVE automation'}</p> : null}
          </div>
        </div>
      ) : null}
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/78 px-4 backdrop-blur-[7px]">
          <div className="w-full max-w-[460px] overflow-hidden rounded-[20px] border border-[#c7962d]/60 bg-[radial-gradient(circle_at_8%_0%,rgba(45,167,255,.24),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(242,189,75,.18),transparent_32%),linear-gradient(135deg,#07111f_0%,#05070b_54%,#171004_100%)] p-6 text-[#f7f1e7] shadow-[0_32px_100px_rgba(0,0,0,.62),0_0_38px_rgba(45,167,255,.10),inset_0_1px_0_rgba(255,255,255,.08)]">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-[14px] border border-[#ff766f]/35 bg-[#3a0d11]/60 text-[#ffaaa1] shadow-[0_0_20px_rgba(255,118,111,.12)]"><Trash2 size={20} /></div>
            <p className="text-[24px] font-black text-white drop-shadow-[0_2px_12px_rgba(45,167,255,.16)]">ยืนยันการลบแคมเปญ</p>
            <p className="mt-3 text-[13px] font-semibold leading-6 text-[#9fb1c9]">
              ต้องการลบแคมเปญ <span className="font-black text-[#f7f1e7]">{deleteTarget.name}</span> ออกจากรายการใช่ไหมคะ
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleteLoading} className="rounded-[10px] border border-[#c7962d]/30 bg-black/[0.28] px-5 py-2.5 text-[13px] font-black text-[#d8c8a1] transition hover:border-[#2da7ff]/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-60">ยกเลิก</button>
              <button type="button" onClick={() => void confirmDeleteCampaign()} disabled={deleteLoading} className="rounded-[10px] border border-[#ff766f]/35 bg-[#3a0d11]/80 px-5 py-2.5 text-[13px] font-black text-[#ffaaa1] transition hover:border-[#ffaaa1] hover:bg-[#4a1116] disabled:cursor-not-allowed disabled:opacity-70">{deleteLoading ? 'กำลังลบ...' : 'ลบแคมเปญ'}</button>
            </div>
          </div>
        </div>
      ) : null}
      {deleteAccountTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/78 px-4 backdrop-blur-[7px]">
          <div className="w-full max-w-[460px] overflow-hidden rounded-[20px] border border-[#c7962d]/60 bg-[radial-gradient(circle_at_8%_0%,rgba(45,167,255,.24),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(242,189,75,.18),transparent_32%),linear-gradient(135deg,#07111f_0%,#05070b_54%,#171004_100%)] p-6 text-[#f7f1e7] shadow-[0_32px_100px_rgba(0,0,0,.62),0_0_38px_rgba(45,167,255,.10),inset_0_1px_0_rgba(255,255,255,.08)]">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-[14px] border border-[#ff766f]/35 bg-[#3a0d11]/60 text-[#ffaaa1] shadow-[0_0_20px_rgba(255,118,111,.12)]"><Trash2 size={20} /></div>
            <p className="text-[24px] font-black text-white drop-shadow-[0_2px_12px_rgba(45,167,255,.16)]">ยืนยันการลบบัญชี Ads</p>
            <p className="mt-3 text-[13px] font-semibold leading-6 text-[#9fb1c9]">
              ต้องการลบบัญชี <span className="font-black text-[#f7f1e7]">{deleteAccountTarget.name}</span> และแคมเปญที่อยู่ใต้บัญชีนี้ใช่ไหมคะ
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteAccountTarget(null)} className="rounded-[10px] border border-[#c7962d]/30 bg-black/[0.28] px-5 py-2.5 text-[13px] font-black text-[#d8c8a1] transition hover:border-[#2da7ff]/60 hover:text-white">ยกเลิก</button>
              <button type="button" onClick={confirmDeleteAccount} className="rounded-[10px] border border-[#ff766f]/35 bg-[#3a0d11]/80 px-5 py-2.5 text-[13px] font-black text-[#ffaaa1] transition hover:border-[#ffaaa1] hover:bg-[#4a1116]">ลบบัญชี</button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-[12px] border border-[#274d73] bg-[#071321] p-4">
          <div className="mb-4 flex items-center justify-between">
            <b className="text-[14px] text-[#f7f1e7]">ตัวกรอง</b>
            <button type="button" onClick={clearFilters} className="text-[11px] font-black text-[#8dc7ff]">ล้างตัวกรอง</button>
          </div>
          <p className="text-[11px] font-bold text-[#9bb7d6]">ประเภทโฆษณา</p>
          <div className="mt-2 grid gap-2">
            {filterOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTypeFilter(item.value)}
                className={`h-9 rounded-lg border px-3 text-[12px] font-black transition ${typeFilter === item.value ? 'border-[#1ba7ff] bg-[#0b79ff] text-white' : 'border-[#365879] bg-[#09111b] text-[#d7e8ff] hover:border-[#f5bd37]'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="relative mt-4 block">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7f786f]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-full rounded-lg border border-[#365879] bg-[#09111b] pl-9 pr-3 text-[12px] font-bold text-[#f7f1e7] outline-none placeholder:text-[#756d63]" placeholder="ค้นหาร้าน / แคมเปญ" />
          </label>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setDisplayMode('table')} className={`h-9 rounded-lg text-[12px] font-black ${displayMode === 'table' ? 'bg-[#0b79ff] text-white' : 'border border-[#365879] bg-[#09111b] text-[#d7e8ff]'}`}>ตาราง</button>
            <button type="button" onClick={() => setDisplayMode('card')} className={`h-9 rounded-lg text-[12px] font-black ${displayMode === 'card' ? 'bg-[#0b79ff] text-white' : 'border border-[#365879] bg-[#09111b] text-[#d7e8ff]'}`}>การ์ด</button>
          </div>
          <div className="mt-5 rounded-[10px] border border-[#3b2a12] bg-black/20 p-4 text-[12px] font-bold">
            <h4 className="mb-3 text-[14px] font-black text-[#f7f1e7]">สรุปรายการแคมเปญ</h4>
            <div className="grid gap-2 text-[#9d968d]">
              <span className="flex justify-between">รายการทั้งหมด <b className="text-[#f7f1e7]">{summary.total}</b></span>
              <span className="flex justify-between">บัญชี Ads ตามแพ็กเกจ <b className="text-[#8dc7ff]">{accounts.length} / 3</b></span>
              <span className="flex justify-between">กำลังโฆษณา <b className="text-[#8ef09e]">{summary.active}</b></span>
              <span className="flex justify-between">หยุดชั่วคราว <b className="text-[#f5bd37]">{summary.paused}</b></span>
              <span className="flex justify-between">สิ้นสุดแล้ว <b className="text-[#d7d7d7]">{summary.ended}</b></span>
              <span className="flex justify-between">มีข้อผิดพลาด <b className="text-[#ff8d8d]">{summary.error}</b></span>
            </div>
          </div>
        </aside>

        <div className="grid min-w-0 gap-4">
          {accountsLoading ? (
            <div className="grid min-h-[220px] place-items-center rounded-[12px] border border-[#274d73] bg-[#071321] text-center">
              <div>
                <p className="text-[15px] font-black text-[#f7f1e7]">กำลังโหลดบัญชี Ads</p>
                <p className="mt-1 text-[12px] font-semibold text-[#9bb7d6]">ระบบกำลังดึงบัญชีที่บันทึกไว้</p>
              </div>
            </div>
          ) : accounts.length === 0 ? (
            <div className="min-w-0 rounded-[12px] border border-[#274d73] bg-[#071321]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#274d73] px-4 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg border border-[#2d77c7] bg-[#061221]">
                    <img src="/np-live-logo.png" alt="NP LIVE" className="h-full w-full object-cover" />
                  </span>
                  <div className="min-w-0">
                    <h4 className="truncate text-[16px] font-black text-[#f7f1e7]">ยังไม่มีบัญชี Ads</h4>
                    <p className="truncate text-[11px] font-semibold text-[#9bb7d6]">เพิ่มบัญชี Ads เพื่อเริ่มจัดการแคมเปญ</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#865f23] px-3 py-1 text-[11px] font-black text-white">LIVE GMV Max 0</span>
                  <span className="rounded-full bg-[#198754] px-3 py-1 text-[11px] font-black text-white">เพิ่มการมองเห็น 0</span>
                  <span className="rounded-full bg-[#9a5b3d] px-3 py-1 text-[11px] font-black text-white">ทั้งหมด 0</span>
                </div>
              </div>
              <div className="p-4">
                <div className="grid min-h-[220px] place-items-center rounded-[12px] border border-[#274d73] bg-[#09111b] text-center">
                  <div>
                    <p className="text-[15px] font-black text-[#f7f1e7]">ยังไม่มีบัญชี Ads</p>
                    <p className="mt-1 text-[12px] font-semibold text-[#9bb7d6]">เพิ่มบัญชี Ads ก่อนสร้างแคมเปญ</p>
                    <button type="button" onClick={openAddAccount} className="mt-3 text-[12px] font-black text-[#8dc7ff]">เพิ่มบัญชี Ads</button>
                  </div>
                </div>
              </div>
            </div>
          ) : accounts.map((account) => {
            const accountRows = filteredRows.filter((row) => row.account === account.account);
            const accountLiveCount = accountRows.filter((row) => row.type === 'live-gmv').length;
            const accountVisibilityCount = accountRows.filter((row) => row.type === 'visibility').length;
            return (
              <div key={account.uid} className="min-w-0 rounded-[12px] border border-[#274d73] bg-[#071321]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#274d73] px-4 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg border border-[#2d77c7] bg-[#061221]">
                      <img src="/np-live-logo.png" alt="NP LIVE" className="h-full w-full object-cover" />
                    </span>
                    <div className="min-w-0">
                      <h4 className="truncate text-[16px] font-black text-[#f7f1e7]">{account.name}</h4>
                      <p className="truncate text-[11px] font-semibold text-[#9bb7d6]">ไอดี: {account.id} | ชื่อบัญชี: {account.name}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => createCampaignForAccount(account, 'live')}
                      className="inline-flex items-center gap-1 rounded-full border border-[#2d77c7] bg-[#0b2f5f] px-3 py-1 text-[11px] font-black text-[#d7ecff] transition hover:border-[#f5bd37] hover:bg-[#123c70] hover:text-white"
                    >
                      <Plus size={12} /> สร้างแคมเปญ
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteAccountTarget(account)}
                      className="inline-flex items-center gap-1 rounded-full border border-[#7c2830] bg-[#1a0a0d] px-3 py-1 text-[11px] font-black text-[#ffb5b5] transition hover:border-[#ff6b6b] hover:text-white"
                    >
                      <Trash2 size={12} /> ลบบัญชี
                    </button>
                    <span className="rounded-full bg-[#865f23] px-3 py-1 text-[11px] font-black text-white">LIVE GMV Max {accountLiveCount}</span>
                    <span className="rounded-full bg-[#198754] px-3 py-1 text-[11px] font-black text-white">เพิ่มการมองเห็น {accountVisibilityCount}</span>
                    <span className="rounded-full bg-[#9a5b3d] px-3 py-1 text-[11px] font-black text-white">ทั้งหมด {accountRows.length}</span>
                  </div>
                </div>

                <div className="overflow-x-auto p-4">
                  {accountRows.length === 0 ? (
                    <div className="grid min-h-[220px] place-items-center rounded-[12px] border border-[#274d73] bg-[#09111b] text-center">
                      <div>
                        <p className="text-[15px] font-black text-[#f7f1e7]">ยังไม่มีแคมเปญของ {account.name}</p>
                        <p className="mt-1 text-[12px] font-semibold text-[#9bb7d6]">แคมเปญที่สร้างจากบัญชีนี้จะเรียงลงมาในบล็อกนี้เท่านั้น</p>
                        <button type="button" onClick={() => createCampaignForAccount(account, 'live')} className="mt-3 text-[12px] font-black text-[#8dc7ff]">สร้างแคมเปญของบัญชีนี้</button>
                      </div>
                    </div>
                  ) : displayMode === 'table' ? (
                    <>
                      <table className="w-full min-w-[1360px] table-fixed border-collapse text-center text-[11px]">
                        <thead className="text-[#9bb7d6]">
                          <tr className="whitespace-nowrap border-b border-[#274d73] bg-[#0b1827]">
                            <th className="w-[210px] px-3 py-2.5 text-left font-black">สถานะโฆษณา</th>
                            <th className="w-[110px] px-3 py-2.5 font-black">งบประมาณ</th>
                            <th className="w-[125px] px-3 py-2.5 font-black">ทั้งหมด</th>
                            <th className="w-[95px] px-3 py-2.5 font-black">การเข้าชม</th>
                            <th className="w-[95px] px-3 py-2.5 font-black">คำสั่งซื้อ</th>
                            <th className="w-[115px] px-3 py-2.5 font-black">อัตราการสั่งซื้อ</th>
                            <th className="w-[105px] px-3 py-2.5 font-black">ยอดขาย</th>
                            <th className="w-[105px] px-3 py-2.5 font-black">ค่าโฆษณา</th>
                            <th className="w-[85px] px-3 py-2.5 font-black">ROAS</th>
                            <th className="w-[315px] px-3 py-2.5 font-black">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accountRows.map((row) => {
                            const pendingAction = campaignActionPending[row.id];
                            const actionLabel = pendingAction === 'resume'
                              ? 'กำลังเริ่ม...'
                              : pendingAction === 'pause'
                                ? 'กำลังพัก...'
                                : pendingAction === 'stop'
                                  ? 'กำลังหยุด...'
                                  : row.state === 'ongoing'
                                    ? 'หยุดชั่วคราว'
                                    : row.state === 'paused'
                                      ? 'ดำเนินการต่อ'
                                      : 'เริ่ม';
                            return (
                            <tr key={row.id} className="h-[78px] whitespace-nowrap border-b border-[#274d73] text-[#f7f1e7]">
                              <td className="px-3 py-3 align-middle text-left">
                                <div className="flex items-center gap-2">
                                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#ffb7a6] bg-[#fff0eb] text-[#ff9d87]">
                                    <Megaphone size={16} />
                                  </span>
                                  <div className="min-w-0">
                                    <p className="max-w-[150px] truncate text-[12px] font-black text-[#f7f1e7]">{row.name}</p>
                                    <p className={`mt-0.5 w-fit rounded px-1.5 py-0.5 text-[9px] font-black ${campaignStateBadgeClass(row.state)}`}>{row.status}</p>
                                    <p className="mt-0.5 text-[9px] font-semibold text-[#9bb7d6]">{row.updatedAt}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 align-middle font-bold"><div className="grid h-full min-h-[42px] place-items-center">{row.dailyBudget}</div></td>
                              <td className="px-3 py-3 align-middle">
                                <div className="grid h-full min-h-[42px] place-items-center">
                                  <b className="block text-[#f7f1e7]">{row.typeLabel === 'LIVE GMV Max' ? 'เพิ่มยอดขาย' : 'เพิ่มการมองเห็น'}</b>
                                  <span className="mt-0.5 block text-[9px] font-semibold text-[#9bb7d6]">{row.typeLabel}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3 align-middle"><div className="grid h-full min-h-[42px] place-items-center"><b>{row.liveViews}</b><span className="block text-[#7f786f]">-</span></div></td>
                              <td className="px-3 py-3 align-middle"><div className="grid h-full min-h-[42px] place-items-center"><b>{row.skuOrders}</b><span className="block text-[#7f786f]">-</span></div></td>
                              <td className="px-3 py-3 align-middle"><div className="grid h-full min-h-[42px] place-items-center"><b>{row.conversionRate}</b><span className="block text-[#7f786f]">-</span></div></td>
                              <td className="px-3 py-3 align-middle"><div className="grid h-full min-h-[42px] place-items-center"><b>{row.sales}</b><span className="block text-[#7f786f]">-</span></div></td>
                              <td className="px-3 py-3 align-middle"><div className="grid h-full min-h-[42px] place-items-center"><b>{row.cost}</b><span className="block text-[#7f786f]">-</span></div></td>
                              <td className="px-3 py-3 align-middle"><div className="grid h-full min-h-[42px] place-items-center"><b>{row.roi === '-' ? '0.00' : row.roi}</b><span className="block text-[#7f786f]">-</span></div></td>
                              <td className="px-3 py-3 align-middle">
                                <div className="flex flex-nowrap items-center justify-center gap-1">
                                  <button type="button" disabled={Boolean(pendingAction)} onClick={() => void toggleCampaignRunState(row)} className={`rounded px-2 py-1 text-[10px] font-black disabled:cursor-wait disabled:opacity-80 ${pendingAction ? 'bg-[#0b79ff] text-white' : row.state === 'ongoing' ? 'bg-[#f5bd37] text-[#1a1202]' : row.state === 'paused' ? 'bg-[#e84d2f] text-white' : 'bg-[#008c5a] text-white'}`}>{actionLabel}</button>
                                  {row.state === 'ongoing' || row.state === 'paused' ? (
                                    <button type="button" disabled={Boolean(pendingAction)} onClick={() => void stopCampaign(row)} className="rounded bg-[#5b1c22] px-2 py-1 text-[10px] font-black text-white disabled:cursor-wait disabled:opacity-60">หยุด</button>
                                  ) : null}
                                  <button type="button" onClick={() => editCampaign(row)} className="rounded bg-[#315893] px-2 py-1 text-[10px] font-black text-white">แก้ไข</button>
                                  <button type="button" onClick={() => openCopyDialog(row)} className="rounded bg-[#17213a] px-2 py-1 text-[10px] font-black text-white">คัดลอกแคมเปญ</button>
                                  <button type="button" onClick={() => void openCampaignHistory(row)} className="rounded bg-[#3b2a12] px-2 py-1 text-[10px] font-black text-white">ประวัติ</button>
                                  <button type="button" onClick={() => deleteCampaign(row)} className="rounded bg-[#5b1c22] px-2 py-1 text-[10px] font-black text-white">ลบ</button>
                                </div>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {accountRows.map((row) => (
                        <article key={row.id} className="rounded-[12px] border border-[#274d73] bg-[#09111b] p-4 text-[#f7f1e7]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h5 className="truncate text-[15px] font-black">{row.detailName}</h5>
                              <p className="mt-1 text-[11px] font-semibold text-[#9bb7d6]">{row.shop} | {row.id}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-[#9a4d59] px-3 py-1 text-[11px] font-black text-white">{row.typeLabel}</span>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3 text-[12px] font-bold">
                            <div className="rounded-lg bg-black/25 p-3"><span className="block text-[#7f786f]">สถานะ</span><b>{row.status}</b></div>
                            <div className="rounded-lg bg-black/25 p-3"><span className="block text-[#7f786f]">งบต่อวัน</span><b>{row.dailyBudget}</b></div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {copySource ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4">
          <div className="w-full max-w-[640px] rounded-[14px] border border-[#274d73] bg-[#071321] p-5 text-[#f7f1e7] shadow-[0_24px_70px_rgba(0,0,0,.55)]">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-[17px] font-black text-[#f7f1e7]">คัดลอกแคมเปญ</h3>
              <button
                type="button"
                onClick={() => {
                  setCopySource(null);
                  setCopyName('');
                }}
                className="grid h-8 w-8 place-items-center rounded-full border border-[#365879] text-[18px] font-bold text-[#9bb7d6] transition hover:border-[#f5bd37] hover:text-[#f5bd37]"
                aria-label="ปิด"
              >
                ×
              </button>
            </div>
            <label className="block text-[12px] font-black text-[#9bb7d6]">
              ชื่อแคมเปญใหม่
              <input
                value={copyName}
                onChange={(event) => setCopyName(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-[#365879] bg-[#060606] px-3 text-[13px] font-semibold text-[#f7f1e7] outline-none transition placeholder:text-[#756d63] focus:border-[#f5bd37] focus:shadow-[0_0_0_3px_rgba(245,189,55,.14)]"
              />
            </label>
            <div className="mt-3 rounded-md border border-[#274d73] bg-[#09111b] px-3 py-4 text-[12px] font-semibold text-[#9bb7d6]">
              คัดลอกจากตั้งค่าจาก: {copySource.name}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCopySource(null);
                  setCopyName('');
                }}
                className="rounded-md border border-[#365879] bg-[#09111b] px-4 py-2 text-[13px] font-black text-[#f7f1e7] transition hover:border-[#f5bd37] hover:text-[#f5bd37]"
              >
                ปิด
              </button>
              <button
                type="button"
                onClick={duplicateCampaign}
                className="rounded-md bg-gradient-to-r from-[#ffd86a] to-[#e0a018] px-5 py-2 text-[13px] font-black text-black shadow-[0_0_18px_rgba(245,189,55,.18)] transition hover:brightness-110"
              >
                สร้างแคมเปญจากสำเนา
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </section>
  );
}

function ShopeeCampaignRulePage({ variant, campaignName, onCampaignNameChange, dailyBudgetBaht, editingCampaign, onDailyBudgetBahtChange, onAutomationSettingsChange, onCampaignGoalChange }: { variant: 'live' | 'product'; campaignName: string; onCampaignNameChange: (value: string) => void; dailyBudgetBaht: number | null; editingCampaign?: EditingLiveCampaign | null; onDailyBudgetBahtChange: (value: number | null) => void; onAutomationSettingsChange: (value: LiveCampaignAutomationSettings) => void; onCampaignGoalChange?: (goal: 'gmv' | 'visibility') => void }) {
  const [campaignGoal, setCampaignGoal] = useState<'gmv' | 'visibility'>(variant === 'product' ? 'visibility' : 'gmv');
  const isProduct = campaignGoal === 'visibility';
  const [budgetMode, setBudgetMode] = useState<'unlimited' | 'daily'>('unlimited');
  const [dailyBudget, setDailyBudget] = useState('');
  const [budgetSuggestion, setBudgetSuggestion] = useState<{ typed: string; suggested: number } | null>(null);
  const [dateMode, setDateMode] = useState<'unlimited' | 'range'>('unlimited');
  const [dateStart, setDateStart] = useState('2026-10-01');
  const [dateEnd, setDateEnd] = useState('2026-10-15');
  const [timeMode, setTimeMode] = useState<'all-day' | 'range'>('all-day');
  const [startHour, setStartHour] = useState('00');
  const [startMinute, setStartMinute] = useState('00');
  const [endHour, setEndHour] = useState('23');
  const [endMinute, setEndMinute] = useState('59');
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [roasMode, setRoasMode] = useState<'auto' | 'manual'>('manual');
  const [roasValue, setRoasValue] = useState('4.8');
  const [customRoas, setCustomRoas] = useState('');
  const [budgetSlapEnabled, setBudgetSlapEnabled] = useState(false);
  const [budgetScaleEnabled, setBudgetScaleEnabled] = useState(false);
  const [budgetAutomationMode, setBudgetAutomationMode] = useState<'simple' | 'budget_cost' | 'tiered_budget_cost'>('budget_cost');
  const [budgetTimeMode, setBudgetTimeMode] = useState<'always' | 'scheduled'>('always');
  const [budgetTimeWindows, setBudgetTimeWindows] = useState([{ startHour: '', startMinute: '', endHour: '', endMinute: '' }]);
  const [tiers, setTiers] = useState([{ min: '', max: '', cap: '', add: '' }]);
  const [specialBoostEnabled, setSpecialBoostEnabled] = useState(false);
  const [specialBoostRows, setSpecialBoostRows] = useState([{ hour: '', minute: '', addAmount: '', multiplier: '' }]);
  const [profitCheckEnabled, setProfitCheckEnabled] = useState(false);
  const [profitCheckDays, setProfitCheckDays] = useState(['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.']);
  const [cpoRoiWindows, setCpoRoiWindows] = useState([{ startHour: '', startMinute: '', endHour: '', endMinute: '' }]);
  const [timeBoostEnabled, setTimeBoostEnabled] = useState(false);
  const [timeBoostRows, setTimeBoostRows] = useState([{ hour: '', minute: '', addAmount: '', multiplier: '' }]);
  const [timeBoostRepeatEnabled, setTimeBoostRepeatEnabled] = useState(false);
  const [timeBoostRepeatAddAmount, setTimeBoostRepeatAddAmount] = useState('');
  const [timeBoostRepeatHours, setTimeBoostRepeatHours] = useState('');
  const [timeBoostRepeatMinutes, setTimeBoostRepeatMinutes] = useState('');
  const [recreateInactiveEnabled, setRecreateInactiveEnabled] = useState(false);
  const [noOrderGuardEnabled, setNoOrderGuardEnabled] = useState(false);
  const [badResultGuardEnabled, setBadResultGuardEnabled] = useState(false);
  const [recreateCpoTimeMode, setRecreateCpoTimeMode] = useState<'always' | 'scheduled'>('always');
  const [recreateNoOrderAfterBudget, setRecreateNoOrderAfterBudget] = useState(false);
  const [scheduleRecreateEnabled, setScheduleRecreateEnabled] = useState(false);
  const [recreateScheduleRows, setRecreateScheduleRows] = useState([{ closeHour: '', closeMinute: '', createHour: '', createMinute: '' }]);
  const [advancedEnabled, setAdvancedEnabled] = useState(false);
  const [automationTextValues, setAutomationTextValues] = useState<Record<string, string>>({});
  const [automationCheckValues, setAutomationCheckValues] = useState<Record<string, boolean>>({});
  const budgetNumber = Number(dailyBudget);
  const budgetError = budgetMode === 'daily' && (!dailyBudget || !Number.isFinite(budgetNumber) || budgetNumber < liveCampaignMinDailyBudgetBaht || budgetNumber % liveCampaignBudgetStepBaht !== 0)
    ? 'งบประมาณรายวันขั้นต่ำ ฿200.00 และต้องหารด้วย ฿25.00 ลงตัว'
    : '';
  const suggestDailyBudget = () => {
    if (budgetMode !== 'daily' || !dailyBudget.trim()) return;
    const typedBudget = Number(dailyBudget);
    if (!Number.isFinite(typedBudget) || typedBudget <= 0) return;
    const roundedBudget = Math.max(liveCampaignMinDailyBudgetBaht, Math.ceil(typedBudget / liveCampaignBudgetStepBaht) * liveCampaignBudgetStepBaht);
    if (typedBudget !== roundedBudget) {
      setBudgetSuggestion({ typed: dailyBudget, suggested: roundedBudget });
    }
  };
  useEffect(() => {
    if (editingCampaign) {
      setCampaignGoal(editingCampaign.objective === 'max_view' ? 'visibility' : 'gmv');
    } else {
      setCampaignGoal(variant === 'product' ? 'visibility' : 'gmv');
    }
  }, [variant, editingCampaign?.campaignId, editingCampaign?.objective]);
  useEffect(() => {
    if (budgetMode === 'daily') {
      onDailyBudgetBahtChange(Number.isFinite(budgetNumber) && budgetNumber > 0 ? budgetNumber : null);
    } else {
      onDailyBudgetBahtChange(200);
    }
  }, [budgetMode, budgetNumber, onDailyBudgetBahtChange]);
  useEffect(() => {
    const initialDailyBudgetBaht = editingCampaign?.dailyBudgetBaht;
    if (!editingCampaign) return;
    if (initialDailyBudgetBaht && initialDailyBudgetBaht > 0) {
      setBudgetMode('daily');
      setDailyBudget(String(initialDailyBudgetBaht));
      onDailyBudgetBahtChange(initialDailyBudgetBaht);
    } else {
      setBudgetMode('unlimited');
      setDailyBudget('');
      onDailyBudgetBahtChange(200);
    }
    const startDate = unixSecondsToBangkokDate(editingCampaign.startTime);
    const endDate = unixSecondsToBangkokDate(editingCampaign.endTime);
    if (startDate && endDate) {
      setDateMode('range');
      setDateStart(startDate);
      setDateEnd(endDate);
    } else {
      setDateMode('unlimited');
    }
    const firstSlot = editingCampaign.timeSlotList?.[0];
    if (firstSlot && ((firstSlot.start_time ?? 0) > 0 || (firstSlot.end_time ?? 0) > 0)) {
      const start = secondsToClockParts(firstSlot.start_time);
      const end = secondsToClockParts(firstSlot.end_time);
      setTimeMode('range');
      setStartHour(start.hour);
      setStartMinute(start.minute);
      setEndHour(end.hour);
      setEndMinute(end.minute);
    } else {
      setTimeMode('all-day');
    }
    const targetRoas = finitePositiveNumber(editingCampaign.roiTwoTargetValue);
    if (targetRoas && !isProduct) {
      const roasText = String(targetRoas);
      const option = roasOptions.find((item) => Number(item.value) === targetRoas);
      setRoasMode('manual');
      setRoasValue(option?.value ?? 'custom');
      setCustomRoas(option ? '' : roasText);
    }
  }, [editingCampaign?.campaignId, editingCampaign?.dailyBudgetBaht, editingCampaign?.startTime, editingCampaign?.endTime, editingCampaign?.timeSlotList, editingCampaign?.roiTwoTargetValue, isProduct, onDailyBudgetBahtChange]);
  useEffect(() => {
    const settings = editingCampaign?.automationSettings;
    if (!settings) return;
    setBudgetSlapEnabled(Boolean(settings.budgetSlapEnabled));
    setBudgetScaleEnabled(Boolean(settings.budgetScaleEnabled));
    setBudgetAutomationMode(settings.budgetAutomationMode ?? 'budget_cost');
    setBudgetTimeMode(settings.budgetTimeMode ?? 'always');
    setBudgetTimeWindows(settings.budgetTimeWindows?.length ? settings.budgetTimeWindows : [{ startHour: '', startMinute: '', endHour: '', endMinute: '' }]);
    setTiers(settings.tiers?.length ? settings.tiers : [{ min: '', max: '', cap: '', add: '' }]);
    setSpecialBoostEnabled(Boolean(settings.specialBoostEnabled));
    setSpecialBoostRows(settings.specialBoostRows?.length ? settings.specialBoostRows : [{ hour: '', minute: '', addAmount: '', multiplier: '' }]);
    setProfitCheckEnabled(Boolean(settings.profitCheckEnabled));
    setProfitCheckDays(settings.profitCheckDays?.length ? settings.profitCheckDays : ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.']);
    setCpoRoiWindows(settings.cpoRoiWindows?.length ? settings.cpoRoiWindows : [{ startHour: '', startMinute: '', endHour: '', endMinute: '' }]);
    setTimeBoostEnabled(Boolean(settings.timeBoostEnabled));
    setTimeBoostRows(settings.timeBoostRows?.length ? settings.timeBoostRows : [{ hour: '', minute: '', addAmount: '', multiplier: '' }]);
    setTimeBoostRepeatEnabled(Boolean(settings.timeBoostRepeatEnabled));
    setTimeBoostRepeatAddAmount(settings.timeBoostRepeatAddAmount ?? '');
    setTimeBoostRepeatHours(settings.timeBoostRepeatHours ?? '');
    setTimeBoostRepeatMinutes(settings.timeBoostRepeatMinutes ?? '');
    setRecreateInactiveEnabled(Boolean(settings.recreateInactiveEnabled));
    setNoOrderGuardEnabled(Boolean(settings.noOrderGuardEnabled));
    setBadResultGuardEnabled(Boolean(settings.badResultGuardEnabled));
    setRecreateCpoTimeMode(settings.recreateCpoTimeMode ?? 'always');
    setRecreateNoOrderAfterBudget(Boolean(settings.recreateNoOrderAfterBudget));
    setScheduleRecreateEnabled(Boolean(settings.scheduleRecreateEnabled));
    setRecreateScheduleRows(settings.recreateScheduleRows?.length ? settings.recreateScheduleRows : [{ closeHour: '', closeMinute: '', createHour: '', createMinute: '' }]);
    setAdvancedEnabled(Boolean(settings.advancedEnabled));
    setAutomationTextValues(settings.textValues ?? {});
    setAutomationCheckValues(settings.checkValues ?? {});
  }, [editingCampaign?.campaignId, editingCampaign?.automationSettings]);
  useEffect(() => {
    onAutomationSettingsChange({
      budgetSlapEnabled,
      budgetScaleEnabled,
      budgetAutomationMode,
      budgetTimeMode,
      budgetTimeWindows,
      tiers,
      specialBoostEnabled,
      specialBoostRows,
      profitCheckEnabled,
      profitCheckDays,
      cpoRoiWindows,
      timeBoostEnabled,
      timeBoostRows,
      timeBoostRepeatEnabled,
      timeBoostRepeatAddAmount,
      timeBoostRepeatHours,
      timeBoostRepeatMinutes,
      recreateInactiveEnabled,
      noOrderGuardEnabled,
      badResultGuardEnabled,
      recreateCpoTimeMode,
      recreateNoOrderAfterBudget,
      scheduleRecreateEnabled,
      recreateScheduleRows,
      advancedEnabled,
      textValues: automationTextValues,
      checkValues: automationCheckValues,
    });
  }, [advancedEnabled, automationCheckValues, automationTextValues, badResultGuardEnabled, budgetAutomationMode, budgetScaleEnabled, budgetSlapEnabled, budgetTimeMode, budgetTimeWindows, cpoRoiWindows, noOrderGuardEnabled, onAutomationSettingsChange, profitCheckDays, profitCheckEnabled, recreateCpoTimeMode, recreateInactiveEnabled, recreateNoOrderAfterBudget, recreateScheduleRows, scheduleRecreateEnabled, specialBoostEnabled, specialBoostRows, tiers, timeBoostEnabled, timeBoostRows, timeBoostRepeatAddAmount, timeBoostRepeatEnabled, timeBoostRepeatHours, timeBoostRepeatMinutes]);
  const roasError = !isProduct && roasMode === 'manual' && roasValue === 'custom' && !customRoas.trim()
    ? 'โปรดระบุ ROAS เป้าหมายที่ต้องการ'
    : '';
  const roasOptions = [
    { value: '4.8', rank: '20% อันดับสูงสุด' },
    { value: '7.2', rank: 'ค่าเฉลี่ยอันดับ 50%' },
    { value: '8.8', rank: 'อันดับต่ำสุด 20%' },
  ];
  const hourOptions = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
  const minuteOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
  const timeRange = `${startHour}:${startMinute} - ${endHour}:${endMinute}`;
  const startTotalMinutes = Number(startHour) * 60 + Number(startMinute);
  const endTotalMinutes = Number(endHour) * 60 + Number(endMinute);
  const timeRangeError = timeMode === 'range' && isProduct && endTotalMinutes - startTotalMinutes < 30
    ? 'ระยะเวลาโฆษณาจะต้องมากกว่า 30 นาที'
    : '';
  const automationInput = (key: string, label: string, placeholder: string) => (
    <TextInput
      label={label}
      placeholder={placeholder}
      value={automationTextValues[key] ?? ''}
      onChange={(value) => setAutomationTextValues((current) => ({ ...current, [key]: value }))}
    />
  );
  const stepBudgetInput = (
    value: string,
    onChange: (value: string) => void,
    placeholder: string,
  ) => {
    const suggestion = budgetStepSuggestion(value);
    return (
      <div className="grid gap-1">
        <input
          className={`h-9 rounded-md border bg-[#060606] px-3 text-[12px] text-[#f7f1e7] outline-none placeholder:text-[#756d63] ${suggestion ? 'border-[#ffb347]' : 'border-[#365879]'}`}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^\d.]/g, ''))}
          onBlur={() => { if (suggestion) onChange(String(suggestion)); }}
        />
        <p className={`text-[10px] font-semibold ${suggestion ? 'text-[#ffcf76]' : 'text-[#9d968d]'}`}>
          {suggestion ? `Shopee รับงบเป็นขั้นละ ฿${liveCampaignBudgetStepBaht} แนะนำใช้ ฿${suggestion}` : `ต้องหารด้วย ฿${liveCampaignBudgetStepBaht} ลงตัว`}
        </p>
      </div>
    );
  };
  const toggleProfitDay = (day: string) => {
    setProfitCheckDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]);
  };

  useEffect(() => {
    if (!isProduct) {
      setTimeMode('all-day');
    }
  }, [isProduct]);

  useEffect(() => {
    onCampaignGoalChange?.(campaignGoal);
  }, [campaignGoal, onCampaignGoalChange]);

  return (
    <div className="mx-auto grid max-w-[1380px] gap-4">
      <section className="rounded-[10px] border border-[#244a70] bg-[#08111d] p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[18px] font-black text-[#f7f1e7]">1. การตั้งค่าแคมเปญ</h3>
            <p className="mt-1 text-[12px] font-semibold text-[#9bb7d6]">อิงขั้นตอนสร้างโฆษณา Live Ads ของ Shopee: ตั้งชื่อ งบ วันที่ เวลา และกลยุทธ์งบประมาณ</p>
          </div>
        </div>

        <div className="mt-4 max-w-[980px] rounded-[10px] border border-[#244a70] bg-[#071321] p-4">
          <h4 className="text-[15px] font-black text-[#f7f1e7]">ตั้งค่าเบื้องต้น</h4>
          <div className="mt-3 grid gap-4">
            <label className="grid items-center gap-3 text-[12px] font-bold text-[#c9c2b6] md:grid-cols-[120px_auto]">
              <span><span className="text-[#ffb5b5]">*</span> ชื่อโฆษณา</span>
              <div className="flex max-w-[520px] items-center gap-3">
                <input value={campaignName} maxLength={50} onChange={(event) => onCampaignNameChange(event.target.value)} className="h-9 w-full rounded-md border border-[#365879] bg-[#060606] px-3 text-[13px] text-[#f7f1e7] outline-none transition placeholder:text-[#756d63] focus:border-[#f5bd37] focus:shadow-[0_0_0_3px_rgba(245,189,55,.14)]" placeholder="เช่น Live Ads 2026-10-01 10:21" />
                <span className="text-[11px] font-semibold text-[#9d968d]">{campaignName.length}/50</span>
              </div>
            </label>

            <div className="grid items-start gap-3 lg:grid-cols-[120px_auto]">
              <p className="pt-2 text-[12px] font-black text-[#c9c2b6]">งบประมาณ</p>
              <div className="flex flex-wrap items-start gap-x-10 gap-y-2">
                <label className="flex h-9 items-center gap-2 text-[13px] font-bold text-[#f7f1e7]">
                  <input type="radio" name={`budget-${variant}`} checked={budgetMode === 'unlimited'} onChange={() => setBudgetMode('unlimited')} /> ไม่จำกัด
                </label>
                <label className="flex h-9 items-center gap-2 text-[13px] font-bold text-[#f7f1e7]">
                  <input type="radio" name={`budget-${variant}`} checked={budgetMode === 'daily'} onChange={() => setBudgetMode('daily')} /> ตั้งงบประมาณรายวัน
                </label>
                {budgetMode === 'daily' ? (
                  <div className="grid gap-1">
                    <div className={`flex h-9 w-[220px] items-center rounded-md border bg-[#060606] ${budgetError ? 'border-[#ff6548]' : 'border-[#365879]'}`}>
                      <span className="border-r border-[#365879] px-3 text-[12px] font-bold text-[#9d968d]">฿</span>
                      <input value={dailyBudget} onChange={(event) => setDailyBudget(event.target.value.replace(/[^\d.]/g, ''))} onBlur={suggestDailyBudget} className="h-full min-w-0 flex-1 bg-transparent px-3 text-[13px] text-[#f7f1e7] outline-none placeholder:text-[#756d63]" placeholder={dailyBudgetBaht ? String(dailyBudgetBaht) : '0.00'} />
                    </div>
                    <p className={`max-w-[300px] text-[11px] font-semibold ${budgetError ? 'text-[#ff8b76]' : 'text-[#9d968d]'}`}>
                      {budgetError || 'งบประมาณรายวันขั้นต่ำ ฿200.00 และต้องหารด้วย ฿25.00 ลงตัว'}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid items-start gap-3 lg:grid-cols-[120px_auto]">
              <p className="pt-2 text-[12px] font-black text-[#c9c2b6]">วันที่</p>
              <div className="flex flex-wrap items-start gap-x-10 gap-y-2">
                <label className="flex h-9 items-center gap-2 text-[13px] font-bold text-[#f7f1e7]">
                  <input type="radio" name={`date-${variant}`} checked={dateMode === 'unlimited'} onChange={() => setDateMode('unlimited')} /> ไม่จำกัด
                </label>
                <label className="flex h-9 items-center gap-2 text-[13px] font-bold text-[#f7f1e7]">
                  <input type="radio" name={`date-${variant}`} checked={dateMode === 'range'} onChange={() => setDateMode('range')} /> ตั้งวันที่เริ่มต้น/สิ้นสุด
                </label>
                {dateMode === 'range' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="date" value={dateStart} onChange={(event) => setDateStart(event.target.value)} className="h-9 w-[142px] rounded-md border border-[#365879] bg-[#060606] px-2 text-[12px] text-[#f7f1e7] [color-scheme:dark]" />
                    <span className="text-[12px] font-bold text-[#9d968d]">-</span>
                    <input type="date" value={dateEnd} min={dateStart} onChange={(event) => setDateEnd(event.target.value)} className="h-9 w-[142px] rounded-md border border-[#365879] bg-[#060606] px-2 text-[12px] text-[#f7f1e7] [color-scheme:dark]" />
                    <span className="text-[11px] font-semibold text-[#9d968d]">(GMT+7)</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid items-start gap-3 lg:grid-cols-[120px_auto]">
              <p className="pt-2 text-[12px] font-black text-[#c9c2b6]">เวลา</p>
              <div className="flex flex-wrap items-start gap-x-10 gap-y-2">
                <label className="flex h-9 items-center gap-2 text-[13px] font-bold text-[#f7f1e7]">
                  <input type="radio" name={`time-${variant}`} checked={timeMode === 'all-day'} onChange={() => setTimeMode('all-day')} /> ตลอดวัน
                </label>
                <label className={`flex h-9 items-center gap-2 text-[13px] font-bold ${!isProduct ? 'text-[#776f65] opacity-65' : 'text-[#f7f1e7]'}`}>
                  <input type="radio" name={`time-${variant}`} disabled={!isProduct} checked={timeMode === 'range'} onChange={() => setTimeMode('range')} /> ตั้งเวลาเริ่มต้น/สิ้นสุด
                </label>
                {isProduct && timeMode === 'range' ? (
                  <div className="relative">
                    <button type="button" onClick={() => setTimePickerOpen((open) => !open)} className="flex h-9 w-[180px] items-center justify-between rounded-md border border-[#365879] bg-[#060606] px-3 text-left text-[12px] font-bold text-[#f7f1e7] outline-none transition hover:border-[#f5bd37]">
                      <span>{timeRange}</span>
                      <Clock3 className="h-3.5 w-3.5 text-[#9d968d]" />
                    </button>
                    {timePickerOpen ? (
                      <div className="absolute left-0 top-10 z-30 w-[250px] overflow-hidden rounded-md border border-[#d8d8d8] bg-white text-[#222] shadow-xl">
                        <div className="grid grid-cols-2 border-b border-[#e5e5e5] text-center text-[12px] font-semibold">
                          <div className="border-r border-[#e5e5e5] px-3 py-3">เวลาเริ่มต้น</div>
                          <div className="px-3 py-3">เวลาสิ้นสุด</div>
                        </div>
                        <div className="grid grid-cols-4 gap-1 px-3 py-3 text-center text-[12px] font-semibold">
                          <div className="max-h-[170px] overflow-y-auto pr-1">
                            {hourOptions.map((hour) => (
                              <button key={`start-hour-${hour}`} type="button" onClick={() => setStartHour(hour)} className={`block w-full rounded py-1.5 ${startHour === hour ? 'bg-[#fff0ec] text-[#ee4d2d]' : 'text-[#777] hover:bg-[#f5f5f5]'}`}>{hour}</button>
                            ))}
                          </div>
                          <div className="max-h-[170px] overflow-y-auto pr-1">
                            {minuteOptions.map((minute) => (
                              <button key={`start-minute-${minute}`} type="button" onClick={() => setStartMinute(minute)} className={`block w-full rounded py-1.5 ${startMinute === minute ? 'bg-[#fff0ec] text-[#ee4d2d]' : 'text-[#777] hover:bg-[#f5f5f5]'}`}>{minute}</button>
                            ))}
                          </div>
                          <div className="max-h-[170px] overflow-y-auto pr-1">
                            {hourOptions.map((hour) => (
                              <button key={`end-hour-${hour}`} type="button" onClick={() => setEndHour(hour)} className={`block w-full rounded py-1.5 ${endHour === hour ? 'bg-[#fff0ec] text-[#ee4d2d]' : 'text-[#777] hover:bg-[#f5f5f5]'}`}>{hour}</button>
                            ))}
                          </div>
                          <div className="max-h-[170px] overflow-y-auto pr-1">
                            {minuteOptions.map((minute) => (
                              <button key={`end-minute-${minute}`} type="button" onClick={() => setEndMinute(minute)} className={`block w-full rounded py-1.5 ${endMinute === minute ? 'bg-[#fff0ec] text-[#ee4d2d]' : 'text-[#777] hover:bg-[#f5f5f5]'}`}>{minute}</button>
                            ))}
                          </div>
                        </div>
                        {timeRangeError ? <p className="border-t border-[#f0f0f0] px-3 py-2 text-[12px] font-semibold text-[#ee4d2d]">{timeRangeError}</p> : null}
                        <div className="flex justify-end border-t border-[#e5e5e5] px-3 py-2">
                          <button type="button" disabled={Boolean(timeRangeError)} onClick={() => setTimePickerOpen(false)} className="rounded bg-[#ee4d2d] px-4 py-2 text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">ยืนยัน</button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {!isProduct ? <p className="basis-full text-[11px] font-semibold text-[#f5bd37]">โฆษณา GMV Max Live ไม่ให้กำหนดช่วงเวลาเอง ระบบใช้ตลอดวันตาม Shopee</p> : null}
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-[#274d73] pt-4">
            <h4 className="text-[15px] font-black text-[#f7f1e7]">กลยุทธ์การตั้งงบประมาณ</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
            <button type="button" onClick={() => setCampaignGoal('gmv')} className={`min-h-[64px] rounded-[10px] border p-3 text-left transition ${!isProduct ? 'border-[#f5bd37] bg-[#0b1827] shadow-[0_0_0_1px_rgba(245,189,55,.16)]' : 'border-[#365879] bg-[#09111b] hover:border-[#f5bd37]'}`}>
              <b className="block text-[13px] text-[#f7f1e7]">โฆษณา GMV Max</b>
              <span className="mt-1 block text-[11px] font-semibold text-[#9d968d]">เพิ่มอัตราการสร้างคำสั่งซื้อจากไลฟ์ โดย Shopee จะจัดการงบและ ROAS ให้เหมาะกับเป้าหมาย</span>
            </button>
            <button type="button" onClick={() => setCampaignGoal('visibility')} className={`min-h-[64px] rounded-[10px] border p-3 text-left transition ${isProduct ? 'border-[#f5bd37] bg-[#0b1827] shadow-[0_0_0_1px_rgba(245,189,55,.16)]' : 'border-[#365879] bg-[#09111b] hover:border-[#f5bd37]'}`}>
              <b className="block text-[13px] text-[#f7f1e7]">เพิ่มการมองเห็น</b>
              <span className="mt-1 block text-[11px] font-semibold text-[#9d968d]">เพิ่มการมองเห็น Live ให้กับผู้ชมที่มีแนวโน้มจะสนใจ เพื่อเร่ง reach</span>
            </button>
            </div>
            {!isProduct ? (
              <>
                <div className="mt-3 rounded-[10px] border border-[#f5bd37]/70 bg-[#09111b] px-3 py-2 text-[12px] font-semibold text-[#f5bd37]">
                  โฆษณา GMV Max Live และ โฆษณา Views Max Live จะไม่สามารถใช้งานร่วมกับโฆษณาไลฟ์ประเภทอื่นได้ เมื่อเผยแพร่แล้ว โฆษณาไลฟ์ที่กำลังใช้งานอื่น ๆ จะถูกหยุดชั่วคราว
                </div>
                <div className="mt-3 rounded-[10px] border border-[#274d73] bg-[#0b1827] p-3">
                  <p className="text-[13px] font-black text-[#f7f1e7]">ตั้งค่า ROAS เป้าหมาย</p>
                  <div className="mt-3 grid gap-3">
                    <label className="flex items-start gap-2 text-[13px] font-bold text-[#f7f1e7]">
                      <input className="mt-1" type="radio" name={`roas-${variant}`} checked={roasMode === 'auto'} onChange={() => setRoasMode('auto')} /> โฆษณาเพิ่มยอดขายแบบตั้งราคา ROAS อัตโนมัติ
                    </label>
                    <label className="flex items-start gap-2 text-[13px] font-bold text-[#f7f1e7]">
                      <input className="mt-1" type="radio" name={`roas-${variant}`} checked={roasMode === 'manual'} onChange={() => setRoasMode('manual')} /> โฆษณาเพิ่มยอดขายแบบตั้งค่า ROAS เอง
                    </label>
                    {roasMode === 'manual' ? (
                      <div className="ml-6 grid gap-2 rounded-[10px] bg-black/15 p-3">
                        {roasOptions.map((item) => (
                          <label key={item.value} className="flex flex-wrap items-center gap-3 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-[#c9c2b6]">
                            <input type="radio" name={`roas-value-${variant}`} checked={roasValue === item.value} onChange={() => setRoasValue(item.value)} />
                            <span className="min-w-[90px] font-black text-[#f7f1e7]">ROAS = {item.value}</span>
                            <span className="text-[#2fd67a]">{item.rank}</span>
                            <span>ในด้านความสามารถในการแข่งขันของ ROAS เมื่อเทียบกับโฆษณาที่คล้ายกัน</span>
                          </label>
                        ))}
                        <label className="flex flex-wrap items-center gap-3 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-[#c9c2b6]">
                          <input type="radio" name={`roas-value-${variant}`} checked={roasValue === 'custom'} onChange={() => setRoasValue('custom')} />
                          <span className="min-w-[90px] font-black text-[#f7f1e7]">ตั้งมูลค่า</span>
                          <input value={customRoas} disabled={roasValue !== 'custom'} onChange={(event) => setCustomRoas(event.target.value.replace(/[^\d.]/g, ''))} className={`h-9 w-40 rounded-md border bg-[#060606] px-3 text-[#f7f1e7] disabled:cursor-not-allowed disabled:text-[#776f65] ${roasError ? 'border-[#ff6548]' : 'border-[#365879]'}`} />
                          <span>ตั้ง ROAS เป้าหมายตามข้อมูลผลประกอบการก่อนหน้านี้ของร้านคุณ</span>
                        </label>
                        {roasError ? <p className="px-2 text-[11px] font-semibold text-[#ff8b76]">{roasError}</p> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[10px] border border-[#244a70] bg-[#08111d] p-3">
        <div className="rounded-[10px] border border-[#244a70] bg-[#071321] px-3 py-3">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[14px] font-black text-[#f7f1e7]">{isProduct ? '2. เพิ่มงบ/เพิ่มการมองเห็น' : '2. ตบงบ/เพิ่มงบ'}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-[#9d968d]">ตั้งว่าจะให้ระบบตบงบเมื่อไหร่ ระหว่างโฆษณากำลังรัน</p>
            </div>
            <label className="flex items-center gap-2 rounded-full border border-[#365879] bg-[#09111b] px-3 py-1.5 text-[11px] font-black text-[#f5bd37]">
              <input type="checkbox" checked={budgetSlapEnabled} onChange={(event) => setBudgetSlapEnabled(event.target.checked)} />
              {isProduct ? 'เปิดปรับงบ' : 'เปิดตบงบ'}
            </label>
          </div>
          {budgetSlapEnabled ? (
            <>
              <div className="grid gap-2 text-[12px] md:grid-cols-3">
                {[
                  ['simple', 'ตามงบประมาณที่เหลือ (%)'],
                  ['budget_cost', 'เงินที่เหลือจากงบ'],
                  ['tiered_budget_cost', 'หลายขั้นตามงบต่อวัน'],
                ].map(([mode, label]) => (
                  <label key={mode} className={`flex items-center gap-2 rounded-lg p-2.5 font-bold ${budgetAutomationMode === mode ? 'border border-[#f5bd37] bg-[#0b1827] text-[#f7f1e7]' : 'bg-[#09111b] text-[#c9c2b6]'}`}>
                    <input type="radio" name={`budget-automation-${variant}`} checked={budgetAutomationMode === mode} onChange={() => setBudgetAutomationMode(mode as typeof budgetAutomationMode)} /> {label}
                  </label>
                ))}
              </div>

              <p className="mb-2 mt-4 text-[13px] font-black text-[#f7f1e7]">ช่วงเวลาที่ให้ตบงบได้</p>
              <div className="grid gap-2 text-[12px] md:grid-cols-2">
                <label className={`flex items-center gap-2 rounded-lg p-2.5 font-bold ${budgetTimeMode === 'always' ? 'border border-[#f5bd37] bg-[#0b1827] text-[#f7f1e7]' : 'bg-[#09111b] text-[#c9c2b6]'}`}><input type="radio" name={`budget-time-${variant}`} checked={budgetTimeMode === 'always'} onChange={() => setBudgetTimeMode('always')} /> ทั้งวัน</label>
                <label className={`flex items-center gap-2 rounded-lg p-2.5 font-bold ${budgetTimeMode === 'scheduled' ? 'border border-[#f5bd37] bg-[#0b1827] text-[#f7f1e7]' : 'bg-[#09111b] text-[#c9c2b6]'}`}><input type="radio" name={`budget-time-${variant}`} checked={budgetTimeMode === 'scheduled'} onChange={() => setBudgetTimeMode('scheduled')} /> เฉพาะเวลาที่กำหนด</label>
              </div>
              {budgetTimeMode === 'scheduled' ? (
                <div className="mt-3 rounded-[10px] border border-[#244a70] bg-[#09111b] p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-black text-[#f7f1e7]">ช่วงเวลาที่ให้ระบบตบงบ</p>
                      <p className="mt-1 text-[11px] font-semibold text-[#9d968d]">ระบบจะตบงบเฉพาะช่วงนี้ ถ้านอกเวลาจะข้ามไปก่อน</p>
                    </div>
                    <MiniButton onClick={() => setBudgetTimeWindows((current) => [...current, { startHour: '', startMinute: '', endHour: '', endMinute: '' }])}>+ เพิ่มเวลา</MiniButton>
                  </div>
                  {budgetTimeWindows.map((row, index) => (
                    <div key={index} className="mb-2 grid gap-2 md:grid-cols-[80px_80px_28px_80px_80px_58px]">
                      <TimeSelect value={row.startHour} onChange={(value) => setBudgetTimeWindows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, startHour: value } : item))} max={24} />
                      <TimeSelect value={row.startMinute} onChange={(value) => setBudgetTimeWindows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, startMinute: value } : item))} max={60} />
                      <span className="grid place-items-center text-[11px] font-bold text-[#9d968d]">ถึง</span>
                      <TimeSelect value={row.endHour} onChange={(value) => setBudgetTimeWindows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, endHour: value } : item))} max={24} />
                      <TimeSelect value={row.endMinute} onChange={(value) => setBudgetTimeWindows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, endMinute: value } : item))} max={60} />
                      <MiniButton tone="danger" onClick={() => setBudgetTimeWindows((current) => current.filter((_, itemIndex) => itemIndex !== index))}>ลบ</MiniButton>
                    </div>
                  ))}
                </div>
              ) : null}

              {budgetAutomationMode === 'simple' ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {automationInput('budgetSimpleRemainingPercent', 'งบประมาณที่เหลือ (%)', 'เช่น 30')}
                  {automationInput('budgetSimpleAddBaht', 'เพิ่มงบต่อวัน (THB)', 'เช่น 100')}
                  {automationInput('budgetSimpleAddPercent', 'เพิ่มงบต่อวัน (%)', 'เช่น 10')}
                  {automationInput('budgetSimpleMaxAddPerRunBaht', 'เพิ่มเพดานงบต่อวันต่อครั้ง (THB)', 'เช่น 5000 (ว่าง = ไม่จำกัด)')}
                  {automationInput('budgetSimpleDailyCapBaht', 'เพดานงบต่อวัน (THB)', 'ว่าง = ไม่จำกัด')}
                  {automationInput('budgetSimpleCooldownMinutes', 'พักกี่นาทีหลังเปิดตัวใหม่', 'เช่น 60 (= 1 ชม.)')}
                </div>
              ) : null}

              {budgetAutomationMode === 'budget_cost' ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <p className="text-[11px] font-semibold text-[#9d968d] md:col-span-2">เมื่อ เงินที่เหลือจากงบ เหลือน้อยกว่าหรือเท่ากับค่าที่ตั้งไว้ ระบบจะเพิ่มงบต่อวัน</p>
                  {automationInput('budgetCostRemainingBaht', 'เงินที่เหลือจากงบ (THB)', 'เช่น 50')}
                  {automationInput('budgetCostAddBaht', 'เพิ่มงบต่อวัน (THB)', 'เช่น 100')}
                  <label className="flex items-center gap-2 text-[12px] font-bold text-[#f7f1e7] md:col-span-2"><input type="checkbox" checked={Boolean(automationCheckValues.budgetCostResetAfterRecreate)} onChange={(event) => setAutomationCheckValues((current) => ({ ...current, budgetCostResetAfterRecreate: event.target.checked }))} /> เริ่มนับใหม่หลังขึ้นตัวใหม่</label>
                  {automationInput('budgetCostDailyCapBaht', 'เพดานงบต่อวัน (THB)', 'ว่าง = ไม่จำกัด')}
                  {automationInput('budgetCostCooldownMinutes', 'พักกี่นาทีหลังเปิดตัวใหม่', 'เช่น 60 (= 1 ชม.)')}
                </div>
              ) : null}

              {budgetAutomationMode === 'tiered_budget_cost' ? (
                <div className="mt-3 rounded-[10px] border border-[#244a70] bg-[#09111b] p-3">
                  <p className="mb-2 text-[11px] font-semibold text-[#9d968d]">กำหนดได้หลายขั้นตามงบปัจจุบัน ระบบจะเลือกขั้นที่งบอยู่ในช่วง แล้วเพิ่มงบเมื่อคงเหลือน้อยกว่าหรือเท่ากับ จุดที่ให้ตบงบ ของขั้นนั้น</p>
                  {tiers.map((tier, tierIndex) => (
                    <div key={tierIndex} className="mb-3 rounded-[10px] border border-[#365879] bg-[#071321] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <strong className="text-[12px] text-[#f7f1e7]">ขั้นที่ {tierIndex + 1}</strong>
                        <MiniButton tone="danger" onClick={() => setTiers((current) => current.filter((_, index) => index !== tierIndex))}>ลบ</MiniButton>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {(['min', 'max', 'cap', 'add'] as const).map((key) => (
                          <input key={key} value={tier[key]} onChange={(event) => setTiers((current) => current.map((item, index) => index === tierIndex ? { ...item, [key]: event.target.value } : item))} className="h-9 rounded-md border border-[#365879] bg-[#060606] px-3 text-[12px] text-[#f7f1e7] outline-none" placeholder={{ min: 'งบขั้นต่ำ (ว่าง = 0)', max: 'งบสูงสุด (ว่าง = ไม่จำกัด)', cap: 'จุดที่ให้ตบงบ (งบ - ค่าใช้จ่าย)', add: 'เพิ่มงบ (บาท)' }[key]} />
                        ))}
                      </div>
                    </div>
                  ))}
                  <MiniButton tone="dark" onClick={() => setTiers((current) => [...current, { min: '', max: '', cap: '', add: '' }])}>+ เพิ่มขั้น</MiniButton>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {automationInput('tieredMaxBudgetBaht', 'ตบงบได้สูงสุดถึง', 'ว่าง = ไม่จำกัด (บาท)')}
                    {automationInput('tieredCooldownMinutes', 'พักกี่นาทีหลังเปิดตัวใหม่', 'เช่น 60 (= 1 ชม.)')}
                  </div>
                </div>
              ) : null}
              <label className="mt-3 flex items-center gap-2 text-[12px] font-bold text-[#f7f1e7]"><input type="checkbox" checked={specialBoostEnabled} onChange={(event) => setSpecialBoostEnabled(event.target.checked)} /> เพิ่มเวลาขยายงบพิเศษ</label>
              {specialBoostEnabled ? (
                <div className="mt-2 rounded-[10px] border border-[#244a70] bg-[#09111b] p-3">
                  {specialBoostRows.map((row, rowIndex) => (
                    <div key={rowIndex} className="mb-2 grid gap-2 md:grid-cols-[80px_80px_1fr_1fr_58px]">
                      <TimeSelect value={row.hour} onChange={(value) => setSpecialBoostRows((current) => current.map((item, index) => index === rowIndex ? { ...item, hour: value } : item))} max={24} />
                      <TimeSelect value={row.minute} onChange={(value) => setSpecialBoostRows((current) => current.map((item, index) => index === rowIndex ? { ...item, minute: value } : item))} max={60} />
                      {stepBudgetInput(row.addAmount, (value) => setSpecialBoostRows((current) => current.map((item, index) => index === rowIndex ? { ...item, addAmount: value } : item)), 'เพิ่มงบพิเศษ (THB)')}
                      <input className="h-9 rounded-md border border-[#365879] bg-[#060606] px-3 text-[12px] text-[#f7f1e7]" placeholder="หรือเพิ่มเป็น (เท่า)" value={row.multiplier} onChange={(event) => setSpecialBoostRows((current) => current.map((item, index) => index === rowIndex ? { ...item, multiplier: event.target.value } : item))} />
                      <MiniButton tone="danger" onClick={() => setSpecialBoostRows((current) => current.filter((_, index) => index !== rowIndex))}>ลบ</MiniButton>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <MiniButton tone="dark" onClick={() => setSpecialBoostRows((current) => [...current, { hour: '', minute: '', addAmount: '', multiplier: '' }])}>+ เพิ่มเวลาขยายงบพิเศษ</MiniButton>
                    <MiniButton tone="danger" onClick={() => setSpecialBoostRows([])}>ลบเวลาทั้งหมด</MiniButton>
                  </div>
                </div>
              ) : null}
              <p className="mt-2 text-[11px] font-semibold text-[#9d968d]">{specialBoostEnabled ? 'เปิดใช้งานแล้ว ระบบจะบันทึกเวลาขยายงบพิเศษตามแถวด้านบน' : 'ยังไม่ได้ตั้งเวลาขยายงบพิเศษ'}</p>
            </>
          ) : null}
        </div>

        <div className="mt-3 rounded-[10px] border border-[#244a70] bg-[#071321] px-3 py-3">
          <p className="mb-3 text-[14px] font-black text-[#f7f1e7]">3. เช็กว่าคุ้มไหม</p>
          <label className="flex items-center gap-2 text-[12px] font-bold text-[#f7f1e7]"><input type="checkbox" checked={profitCheckEnabled} onChange={(event) => setProfitCheckEnabled(event.target.checked)} /> ให้ระบบเช็กยอดขายและค่าต่อออเดอร์</label>
          {profitCheckEnabled ? (
            <div className="mt-3 rounded-[10px] border border-[#244a70] bg-[#09111b] p-3">
              <p className="mb-2 text-[12px] font-black text-[#f7f1e7]">วันในสัปดาห์</p>
              <div className="mb-3 flex flex-wrap gap-2 text-[12px]">
                {['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'].map((day) => (
                  <button key={day} type="button" onClick={() => toggleProfitDay(day)} className={`rounded-md border px-3 py-1.5 font-bold ${profitCheckDays.includes(day) ? 'border-[#f5bd37] bg-[#0b1827] text-[#f7f1e7]' : 'border-[#365879] bg-[#060606] text-[#7f8791]'}`}>{day}</button>
                ))}
              </div>
              <p className="mb-2 text-[12px] font-black text-[#f7f1e7]">ช่วงเวลาตรวจสอบหลายช่วง</p>
              {cpoRoiWindows.map((row, index) => (
                <div key={index} className="mb-2 grid gap-2 md:grid-cols-[80px_80px_28px_80px_80px_50px]">
                  <TimeSelect value={row.startHour} onChange={(value) => setCpoRoiWindows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, startHour: value } : item))} max={24} />
                  <TimeSelect value={row.startMinute} onChange={(value) => setCpoRoiWindows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, startMinute: value } : item))} max={60} />
                  <span className="grid place-items-center text-[11px] font-bold text-[#9d968d]">ถึง</span>
                  <TimeSelect value={row.endHour} onChange={(value) => setCpoRoiWindows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, endHour: value } : item))} max={24} />
                  <TimeSelect value={row.endMinute} onChange={(value) => setCpoRoiWindows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, endMinute: value } : item))} max={60} />
                  <MiniButton tone="danger" onClick={() => setCpoRoiWindows((current) => current.filter((_, itemIndex) => itemIndex !== index))}>X</MiniButton>
                </div>
              ))}
              <MiniButton tone="dark" onClick={() => setCpoRoiWindows((current) => [...current, { startHour: '', startMinute: '', endHour: '', endMinute: '' }])}>+ เพิ่มเวลา ค่าต่อออเดอร์/ROI</MiniButton>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {automationInput('profitCooldownMinutes', 'พักกี่นาทีหลังเปิดตัวใหม่', 'เช่น 60')}
                {automationInput('profitMinRoi', 'ยอดขายขั้นต่ำที่รับได้ (ROI)', 'เช่น 2')}
                {automationInput('profitMaxCostPerOrder', 'ค่าต่อออเดอร์สูงสุดที่รับได้', 'เช่น 80')}
                {automationInput('profitMinSkuOrders', 'คำสั่งซื้อ SKU ขั้นต่ำ', 'เช่น 3')}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-3 rounded-[10px] border border-[#244a70] bg-[#071321] px-3 py-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[14px] font-black text-[#f7f1e7]">4. เพิ่มงบต่อวันตามช่วงเวลา</p>
            <label className="flex items-center gap-2 rounded-full border border-[#365879] bg-[#09111b] px-3 py-1.5 text-[11px] font-black text-[#8dc7ff]">
              <input type="checkbox" checked={timeBoostEnabled} onChange={(event) => setTimeBoostEnabled(event.target.checked)} /> เปิดเพิ่มงบตามเวลา
            </label>
          </div>
          {timeBoostEnabled ? (
            <>
              {timeBoostRows.map((row, rowIndex) => (
                <div key={rowIndex} className="mb-2 grid gap-2 md:grid-cols-[80px_80px_1fr_1fr_58px]">
                  <TimeSelect value={row.hour} onChange={(value) => setTimeBoostRows((current) => current.map((item, index) => index === rowIndex ? { ...item, hour: value } : item))} max={24} />
                  <TimeSelect value={row.minute} onChange={(value) => setTimeBoostRows((current) => current.map((item, index) => index === rowIndex ? { ...item, minute: value } : item))} max={60} />
                  {stepBudgetInput(row.addAmount, (value) => setTimeBoostRows((current) => current.map((item, index) => index === rowIndex ? { ...item, addAmount: value } : item)), 'เพิ่มงบต่อวัน (THB)')}
                  <input className="h-9 rounded-md border border-[#365879] bg-[#060606] px-3 text-[12px] text-[#f7f1e7]" placeholder="หรือเพิ่มเป็น (เท่า)" value={row.multiplier} onChange={(event) => setTimeBoostRows((current) => current.map((item, index) => index === rowIndex ? { ...item, multiplier: event.target.value } : item))} />
                  <MiniButton tone="danger" onClick={() => setTimeBoostRows((current) => current.filter((_, index) => index !== rowIndex))}>ลบ</MiniButton>
                </div>
              ))}
              <div className="mt-3 flex flex-wrap gap-2">
                <MiniButton tone="dark" onClick={() => setTimeBoostRows((current) => [...current, { hour: '', minute: '', addAmount: '', multiplier: '' }])}>+ เพิ่มเวลา</MiniButton>
                <MiniButton tone="yellow" onClick={() => setTimeBoostRows((current) => [...current, { hour: '09', minute: '00', addAmount: '', multiplier: '' }, { hour: '12', minute: '00', addAmount: '', multiplier: '' }, { hour: '18', minute: '00', addAmount: '', multiplier: '' }])}>ใส่เวลายอดนิยม</MiniButton>
                <MiniButton tone="danger" onClick={() => setTimeBoostRows([])}>ลบเวลาทั้งหมด</MiniButton>
              </div>
              <div className="mt-4 rounded-[10px] border border-[#244a70] bg-[#09111b] p-3">
                <label className="flex items-center gap-2 text-[12px] font-black text-[#f7f1e7]">
                  <input type="checkbox" checked={timeBoostRepeatEnabled} onChange={(event) => setTimeBoostRepeatEnabled(event.target.checked)} /> เพิ่มงบซ้ำตามรอบ
                </label>
                {timeBoostRepeatEnabled ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-[1fr_110px_110px]">
                    {stepBudgetInput(timeBoostRepeatAddAmount, setTimeBoostRepeatAddAmount, 'เพิ่มงบ (THB)')}
                    <input className="h-9 rounded-md border border-[#365879] bg-[#060606] px-3 text-[12px] text-[#f7f1e7]" placeholder="ทุกกี่ชม." value={timeBoostRepeatHours} onChange={(event) => setTimeBoostRepeatHours(event.target.value.replace(/\D/g, ''))} />
                    <input className="h-9 rounded-md border border-[#365879] bg-[#060606] px-3 text-[12px] text-[#f7f1e7]" placeholder="กี่นาที" value={timeBoostRepeatMinutes} onChange={(event) => setTimeBoostRepeatMinutes(event.target.value.replace(/\D/g, ''))} />
                    <p className="text-[11px] font-semibold text-[#9d968d] md:col-span-3">เช่น เพิ่มงบ 50 บาท ทุก 0 ชม. 5 นาที ระบบจะเพิ่มตามรอบจนกว่าจะปิดกฎนี้</p>
                  </div>
                ) : null}
              </div>
              <p className="mt-2 text-[11px] font-semibold text-[#9d968d]">เลือกว่าจะให้ตบงบเวลาไหน หรือให้ระบบเพิ่มซ้ำตามรอบ</p>
            </>
          ) : null}
        </div>

        <div className="mt-3 rounded-[10px] border border-[#244a70] bg-[#071321] px-3 py-3">
          <div className="mb-3 flex items-start gap-3">
            <RefreshCw className="mt-0.5 text-[#f5bd37]" size={17} />
            <div>
              <p className="text-[14px] font-black text-[#f7f1e7]">5. ปิดตัวเดิม แล้วขึ้นตัวใหม่</p>
              <p className="mt-0.5 text-[11px] font-semibold text-[#9d968d]">คัดตามหน้าต้นแบบ: เลือกเงื่อนไขปิดตัวเดิมและสร้างใหม่</p>
            </div>
          </div>
          <div className="grid gap-2.5">
            <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-[#f5bd37]/60 bg-[#11180f] p-3 text-[12px] font-bold text-[#f7f1e7]">
              <input className="mt-1" type="checkbox" checked={recreateInactiveEnabled} onChange={(event) => setRecreateInactiveEnabled(event.target.checked)} />
              <span><b className="block">ถ้าตัวเดิมไม่เดิน ให้ขึ้นตัวใหม่อัตโนมัติ</b><span className="mt-1 block text-[11px] font-semibold text-[#f5bd37]">ถ้าโฆษณาไม่เดินหรือหยุดแสดง ระบบจะปิดตัวเดิมแล้วขึ้นตัวใหม่ให้</span></span>
            </label>
            <label className="flex items-center gap-2 text-[12px] font-bold text-[#f7f1e7]"><input type="checkbox" checked={noOrderGuardEnabled} onChange={(event) => setNoOrderGuardEnabled(event.target.checked)} /> ตรวจต้นทุน + ระยะเวลา และยังไม่มีคำสั่งซื้อ SKU</label>
            {noOrderGuardEnabled ? (
              <div className="grid gap-3 rounded-[10px] border border-[#244a70] bg-[#09111b] p-3 md:grid-cols-2">
                {automationInput('noOrderCostBaht', 'ต้นทุนถึง (THB)', 'เช่น 300')}
                {automationInput('noOrderAfterHours', 'ระยะเวลาเกิน (ชั่วโมง)', 'เช่น 6')}
                <p className="text-[11px] font-semibold text-[#9d968d] md:col-span-2">ถ้าต้นทุนถึงเกณฑ์และรันนานเกินเวลาที่กำหนด แต่ยังไม่มีคำสั่งซื้อ SKU ระบบจะปิดและสร้างแคมเปญใหม่</p>
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-[12px] font-bold text-[#f7f1e7]"><input type="checkbox" checked={badResultGuardEnabled} onChange={(event) => setBadResultGuardEnabled(event.target.checked)} /> ถ้าค่าต่อออเดอร์แพงไป หรือยอดขายไม่ถึงเป้า ให้ปิดตัวเดิมแล้วขึ้นตัวใหม่</label>
            {badResultGuardEnabled ? (
              <div className="rounded-[10px] border border-[#244a70] bg-[#09111b] p-3">
                <p className="mb-2 text-[12px] font-black text-[#f7f1e7]">ช่วงเวลาที่ให้ระบบเช็กแล้วปิดตัวเดิม/ขึ้นตัวใหม่</p>
                <div className="mb-3 flex flex-wrap gap-2 text-[12px]">
                  <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${recreateCpoTimeMode === 'always' ? 'border-[#f5bd37] bg-[#0b1827]' : 'border-[#365879] bg-[#060606]'}`}>
                    <input type="radio" name={`recreate-cpo-time-${variant}`} checked={recreateCpoTimeMode === 'always'} onChange={() => setRecreateCpoTimeMode('always')} /> ทำงานตลอดเวลา
                  </label>
                  <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${recreateCpoTimeMode === 'scheduled' ? 'border-[#f5bd37] bg-[#0b1827]' : 'border-[#365879] bg-[#060606]'}`}>
                    <input type="radio" name={`recreate-cpo-time-${variant}`} checked={recreateCpoTimeMode === 'scheduled'} onChange={() => setRecreateCpoTimeMode('scheduled')} /> ทำงานตามเวลาที่กำหนด
                  </label>
                </div>
                {recreateCpoTimeMode === 'scheduled' ? (
                  <div className="mb-3">
                    {cpoRoiWindows.map((row, index) => (
                      <div key={index} className="mb-2 grid gap-2 md:grid-cols-[80px_80px_28px_80px_80px_58px]">
                        <TimeSelect value={row.startHour} onChange={(value) => setCpoRoiWindows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, startHour: value } : item))} max={24} />
                        <TimeSelect value={row.startMinute} onChange={(value) => setCpoRoiWindows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, startMinute: value } : item))} max={60} />
                        <span className="grid place-items-center text-[11px] font-bold text-[#9d968d]">ถึง</span>
                        <TimeSelect value={row.endHour} onChange={(value) => setCpoRoiWindows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, endHour: value } : item))} max={24} />
                        <TimeSelect value={row.endMinute} onChange={(value) => setCpoRoiWindows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, endMinute: value } : item))} max={60} />
                        <MiniButton tone="danger" onClick={() => setCpoRoiWindows((current) => current.filter((_, itemIndex) => itemIndex !== index))}>ลบ</MiniButton>
                      </div>
                    ))}
                    <MiniButton tone="dark" onClick={() => setCpoRoiWindows((current) => [...current, { startHour: '', startMinute: '', endHour: '', endMinute: '' }])}>+ เพิ่มเวลา</MiniButton>
                    <p className="mt-2 text-[11px] font-semibold text-[#9d968d]">ถ้าอยู่นอกเวลานี้ ระบบจะยังไม่เช็กเพื่อปิด/ขึ้นใหม่</p>
                  </div>
                ) : null}
                <div className="grid gap-3 md:grid-cols-2">
                  {automationInput('badResultMinRoi', 'ยอดขายขั้นต่ำที่รับได้ (ROI)', 'ROI')}
                  {automationInput('badResultMaxCostPerOrder', 'ค่าต่อออเดอร์สูงสุดที่รับได้', 'ค่าต่อออเดอร์')}
                  {automationInput('badResultSkipIfOrdersBelow', 'หาก order น้อยกว่าเป้าหมาย ให้ข้ามการทำงาน', 'เช่น 10')}
                  {automationInput('badResultCooldownMinutes', 'พักกี่นาทีหลังเปิดตัวใหม่', 'เช่น 60 (= 1 ชม.)')}
                </div>
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-[12px] font-bold text-[#f7f1e7]"><input type="checkbox" checked={recreateNoOrderAfterBudget} onChange={(event) => setRecreateNoOrderAfterBudget(event.target.checked)} /> หลังตบงบแล้วถ้ายังไม่มีออเดอร์ ให้ขึ้นตัวใหม่</label>
            {recreateNoOrderAfterBudget ? (
              <div className="rounded-[10px] border border-[#244a70] bg-[#09111b] p-3">
                {automationInput('recreateAfterBudgetWaitMinutes', 'รอกี่นาทีหลังตบงบ แล้วค่อยเช็ก', '60')}
                <p className="mt-2 text-[11px] font-semibold text-[#9d968d]">การเพิ่มงบครั้งใหม่จะเริ่มนับเวลารอตรวจใหม่ จึงอาจยังไม่เข้าเงื่อนไขสร้างแคมเปญใหม่ทันที</p>
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-[12px] font-bold text-[#f7f1e7]"><input type="checkbox" checked={scheduleRecreateEnabled} onChange={(event) => setScheduleRecreateEnabled(event.target.checked)} /> ตั้งเวลาปิดตัวเดิม/ขึ้นตัวใหม่</label>
            {scheduleRecreateEnabled ? (
              <div className="rounded-[10px] border border-[#244a70] bg-[#09111b] p-3">
                <p className="mb-2 text-[11px] font-semibold text-[#9d968d]">ตั้งเวลาปิดและเวลาขึ้นใหม่ได้ ถ้าเวลาขึ้นใหม่เลยเที่ยงคืน ระบบจะไปขึ้นวันถัดไป</p>
                {recreateScheduleRows.map((row, index) => (
                  <div key={index} className="mb-2 grid gap-2 md:grid-cols-[80px_80px_28px_80px_80px_58px]">
                    <TimeSelect value={row.closeHour} onChange={(value) => setRecreateScheduleRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, closeHour: value } : item))} max={24} />
                    <TimeSelect value={row.closeMinute} onChange={(value) => setRecreateScheduleRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, closeMinute: value } : item))} max={60} />
                    <span className="grid place-items-center text-[11px] font-bold text-[#9d968d]">→</span>
                    <TimeSelect value={row.createHour} onChange={(value) => setRecreateScheduleRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, createHour: value } : item))} max={24} />
                    <TimeSelect value={row.createMinute} onChange={(value) => setRecreateScheduleRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, createMinute: value } : item))} max={60} />
                    <MiniButton tone="danger" onClick={() => setRecreateScheduleRows((current) => current.filter((_, itemIndex) => itemIndex !== index))}>ลบ</MiniButton>
                  </div>
                ))}
                <MiniButton tone="dark" onClick={() => setRecreateScheduleRows((current) => [...current, { closeHour: '', closeMinute: '', createHour: '', createMinute: '' }])}>+ เพิ่มเวลาปิด/สร้างใหม่</MiniButton>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {budgetSuggestion ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4">
          <div className="w-full max-w-[380px] rounded-[12px] border border-[#365879] bg-[#071321] p-4 text-[#f7f1e7] shadow-[0_20px_70px_rgba(0,0,0,.45)]">
            <p className="text-[15px] font-black">แนะนำงบประมาณรายวัน</p>
            <p className="mt-2 text-[12px] font-semibold leading-5 text-[#c9c2b6]">
              ค่าที่กรอก ฿{budgetSuggestion.typed} ยังหารด้วย 25 ไม่ลง ค่าแนะนำที่ใกล้เคียงและใช้ได้คือ
            </p>
            <p className="mt-3 rounded-[10px] border border-[#f5bd37]/70 bg-[#11180f] px-3 py-3 text-center text-[22px] font-black text-[#f5bd37]">
              ฿{budgetSuggestion.suggested.toLocaleString('th-TH')}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setBudgetSuggestion(null)} className="rounded-lg border border-[#365879] px-4 py-2 text-[12px] font-black text-[#f7f1e7] transition hover:border-[#f5bd37] hover:text-[#f5bd37]">ยกเลิก</button>
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setDailyBudget(String(budgetSuggestion.suggested)); setBudgetSuggestion(null); }} className="rounded-lg bg-gradient-to-r from-[#ffd86a] to-[#e0a018] px-4 py-2 text-[12px] font-black text-black">ใช้ค่านี้</button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-[10px] border border-[#244a70] bg-[#071321] p-3">
        <label className="flex items-center gap-3 text-[15px] font-black text-[#f7f1e7]">
          <input type="checkbox" checked={advancedEnabled} onChange={(event) => setAdvancedEnabled(event.target.checked)} />
          <ShieldCheck className="text-[#8dc7ff]" size={18} />
          6. การตั้งค่าขั้นสูง
        </label>
        {advancedEnabled ? (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <ToggleCard>บันทึกประวัติทุก action</ToggleCard>
            <ToggleCard>กันสร้างซ้ำถ้าแคมเปญเดิมยังรอตรวจสอบ</ToggleCard>
            <ToggleCard>แจ้งเตือนเมื่อ cookie หรือสิทธิ์ Shopee Ads ไม่พร้อม</ToggleCard>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function AutomationPage({ onBack, variant = 'live', selectedAccount, editingCampaign, initialCampaignName }: { onBack: () => void; variant?: 'live' | 'product'; selectedAccount?: SelectedAdsAccount | null; editingCampaign?: EditingLiveCampaign | null; initialCampaignName?: string | null }) {
  const router = useRouter();
  const [campaignName, setCampaignName] = useState('Live Ads 2026-10-01 10:21');

  function goToCampaignList() {
    setCreateResult(null);
    window.location.assign('/tools/control-ads');
  }
  const [dailyBudgetBaht, setDailyBudgetBaht] = useState<number | null>(200);
  const [automationSettings, setAutomationSettings] = useState<LiveCampaignAutomationSettings | null>(null);
  const [campaignGoal, setCampaignGoal] = useState<'gmv' | 'visibility'>(variant === 'product' ? 'visibility' : 'gmv');
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [accountOptions, setAccountOptions] = useState<SelectedAdsAccount[]>([]);
  const [activeAccount, setActiveAccount] = useState<SelectedAdsAccount | null>(selectedAccount ?? null);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [createResult, setCreateResult] = useState<{
    title: string;
    message: string;
    detail?: string;
    tone: 'success' | 'warning' | 'error';
  } | null>(null);
  const isEditing = Boolean(editingCampaign);

  useEffect(() => {
    if (editingCampaign) {
      setCampaignGoal(editingCampaign.objective === 'max_view' ? 'visibility' : 'gmv');
    } else {
      setCampaignGoal(variant === 'product' ? 'visibility' : 'gmv');
    }
  }, [variant, editingCampaign?.campaignId, editingCampaign?.objective]);

  useEffect(() => {
    setActiveAccount(selectedAccount ?? null);
  }, [selectedAccount?.id, selectedAccount?.name, selectedAccount?.shopId]);

  useEffect(() => {
    if (isEditing) return;
    let cancelled = false;
    setAccountsLoading(true);
    adsAccountService.list()
      .then((items) => {
        if (cancelled) return;
        const options = items.map((item) => ({
          id: item.id,
          name: item.accountName || item.shopName || 'บัญชี Ads',
          shopId: item.shopId ?? undefined,
        }));
        setAccountOptions(options);
        setActiveAccount((current) => current ?? options[0] ?? null);
      })
      .catch((error) => {
        if (!cancelled) {
          setCreateResult({
            title: 'โหลดบัญชี Ads ไม่สำเร็จ',
            message: error instanceof Error ? error.message : 'ไม่สามารถโหลดบัญชี Ads ได้',
            tone: 'warning',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setAccountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEditing]);

  useEffect(() => {
    if (editingCampaign) {
      setCampaignName(editingCampaign.name);
      if (editingCampaign.dailyBudgetBaht && editingCampaign.dailyBudgetBaht > 0) {
        setDailyBudgetBaht(editingCampaign.dailyBudgetBaht);
      } else {
        setDailyBudgetBaht(200);
      }
    } else if (initialCampaignName) {
      setCampaignName(initialCampaignName);
    }
  }, [editingCampaign?.campaignId, editingCampaign?.name, editingCampaign?.dailyBudgetBaht, initialCampaignName]);

  async function submitCampaign() {
    const name = campaignName.trim();
    const accountForSubmit = activeAccount ?? selectedAccount ?? null;
    if (!accountForSubmit) {
      setCreateResult({
        title: 'แจ้งเตือน',
        message: isEditing ? 'กรุณาเลือกบัญชี Ads ก่อนอัปเดตแคมเปญ' : 'กรุณาเลือกบัญชี Ads ก่อนสร้างแคมเปญ',
        tone: 'warning',
      });
      return;
    }
    if (!name) {
      setCreateResult({
        title: 'แจ้งเตือน',
        message: 'กรุณากรอกชื่อแคมเปญ',
        tone: 'warning',
      });
      return;
    }
    if (isEditing) {
      const requestedDailyBudget = dailyBudgetBaht ?? liveCampaignMinDailyBudgetBaht;
      const requestedObjective = campaignGoal === 'visibility' ? 'max_view' : 'max_gmv_roi_two';
      const normalizedAutomationSettings = normalizeAutomationSettings(automationSettings);
      if (requestedObjective !== 'max_view' && (requestedDailyBudget < liveCampaignMinDailyBudgetBaht || requestedDailyBudget % liveCampaignBudgetStepBaht !== 0)) {
        setCreateResult({
          title: 'ยังไม่อัปเดตแคมเปญ',
          message: `งบประมาณรายวันขั้นต่ำคือ ฿${liveCampaignMinDailyBudgetBaht.toLocaleString('th-TH')} และต้องหารด้วย ฿${liveCampaignBudgetStepBaht.toLocaleString('th-TH')} ลงตัว`,
          detail: editingCampaign ? `Campaign ID: ${editingCampaign.campaignId} | งบที่กรอก: ฿${requestedDailyBudget.toLocaleString('th-TH')}` : undefined,
          tone: 'warning',
        });
        return;
      }
      setCreatingCampaign(true);
      try {
        const result: UpdateLiveCampaignResult = await adsAccountService.updateLiveCampaign(accountForSubmit.id, editingCampaign!.campaignId, {
          name,
          dailyBudget: requestedObjective === 'max_view' ? undefined : requestedDailyBudget,
          objective: requestedObjective,
          automationSettings: normalizedAutomationSettings,
        });
        if (result.success) {
          goToCampaignList();
          return;
        }
        setCreateResult({
          title: 'Shopee ยังไม่อัปเดตแคมเปญ',
          message: 'Shopee ไม่สามารถอัปเดตแคมเปญได้ กรุณาตรวจ response ใน Network',
          detail: `Campaign ID: ${result.campaignId}`,
          tone: 'warning',
        });
      } catch (error) {
        setCreateResult({
          title: 'อัปเดตแคมเปญไม่สำเร็จ',
          message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดระหว่างอัปเดตแคมเปญ',
          detail: editingCampaign ? `Campaign ID: ${editingCampaign.campaignId}` : undefined,
          tone: 'error',
        });
      } finally {
        setCreatingCampaign(false);
      }
      return;
    }

    setCreatingCampaign(true);
    try {
      const result: CreateLiveCampaignResult = await adsAccountService.createLiveCampaign(accountForSubmit.id, {
        name,
        objective: campaignGoal === 'visibility' ? 'max_view' : 'max_gmv_roi_two',
        automationSettings: normalizeAutomationSettings(automationSettings),
      });
      const budgetText = result.request?.dailyBudgetBaht ? `งบที่ส่ง: ฿${result.request.dailyBudgetBaht.toLocaleString('th-TH')}` : '';
      if (result.created) {
        rememberCreatedCampaign(campaignRowFromCreateResult(accountForSubmit, name, campaignGoal === 'visibility' ? 'product' : 'live', result));
        goToCampaignList();
        return;
      }
      setCreateResult({
        title: 'Shopee ยังไม่สร้างแคมเปญ',
        message: result.shopeeMessage || 'Shopee ไม่สามารถสร้างแคมเปญได้ กรุณาตรวจเครดิต/สิทธิ์ของบัญชีนี้',
        detail: [budgetText, result.campaignId ? `Campaign ID: ${result.campaignId}` : '', result.campaignUuid ? `UUID: ${result.campaignUuid}` : ''].filter(Boolean).join(' | '),
        tone: 'warning',
      });
    } catch (error) {
      setCreateResult({
        title: 'สร้างแคมเปญไม่สำเร็จ',
        message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดระหว่างสร้างแคมเปญ',
        tone: 'error',
      });
    } finally {
      setCreatingCampaign(false);
    }
  }

  return (
    <section className="min-h-[calc(100vh-96px)] rounded-[12px] border border-[#244a70] bg-[#080b0d] text-[#f7f1e7] shadow-[0_22px_70px_rgba(0,0,0,.28)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#244a70] px-6 py-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.35em] text-[#f5bd37]">NP LIVE ADS CONTROL</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-[24px] font-black">{isEditing ? 'แก้ไขโฆษณา Live Ads' : 'สร้างโฆษณา Live Ads'}</h2>
            <span className="rounded-full border border-[#2fd67a]/60 bg-[#062915] px-3 py-1 text-[12px] font-black text-[#7dffae] shadow-[0_0_18px_rgba(47,214,122,.18)]">{isEditing ? 'หน้าแก้ไขแคมเปญ' : 'หน้าสร้างแคมเปญใหม่'}</span>
            {activeAccount ? (
              <span className="rounded-full border border-[#2d77c7] bg-[#0b2f5f] px-3 py-1 text-[12px] font-black text-[#d7ecff]">
                บัญชี: {activeAccount.name}
              </span>
            ) : null}
            {editingCampaign ? (
              <span className="rounded-full border border-[#8a641d] bg-[#100c05] px-3 py-1 text-[12px] font-black text-[#f5bd37]">
                Campaign ID: {editingCampaign.campaignId}
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] font-black text-[#9bb7d6]">
            <span>ยิงแอด</span>
            <span className="text-[#f0b728]">/</span>
            <span className="text-[#f7f1e7]">{isEditing ? 'แก้ไขโฆษณา Live Ads' : 'สร้างโฆษณา Live Ads'}</span>
          </div>
          <p className="mt-1 text-[13px] font-semibold text-[#9bb7d6]">{isEditing ? 'แก้ไขแคมเปญ Shopee Live Ads จากแคมเปญที่เลือกไว้' : 'สร้างแคมเปญ Shopee Live Ads แล้วเลือกกลยุทธ์ GMV Max หรือเพิ่มการมองเห็นในฟอร์มเดียว'}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {!isEditing ? (
            <label className="min-w-[290px] text-[12px] font-black text-[#9bb7d6]">
              บัญชี Ads
              <select
                value={activeAccount?.id ?? ''}
                onChange={(event) => {
                  const nextAccount = accountOptions.find((item) => item.id === event.target.value) ?? null;
                  setActiveAccount(nextAccount);
                }}
                disabled={accountsLoading}
                className="mt-1 h-10 w-full rounded-lg border border-[#365879] bg-[#060606] px-3 text-[12px] font-black text-[#f7f1e7] outline-none [color-scheme:dark] focus:border-[#f5bd37] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">{accountsLoading ? 'กำลังโหลดบัญชี Ads...' : 'เลือกบัญชี Ads'}</option>
                {accountOptions.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}{account.shopId ? ` | Shop ID: ${account.shopId}` : ''}</option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            onClick={onBack}
            aria-label="กลับศูนย์ยิงแอด"
            title="กลับศูนย์ยิงแอด"
            className="grid h-10 w-10 place-items-center rounded-lg border border-[#365879] text-[#f7f1e7] transition hover:border-[#f5bd37] hover:text-[#f5bd37]"
          >
            <ArrowLeft size={18} />
          </button>
        </div>
      </div>

      <div className="p-5">
        <ShopeeCampaignRulePage variant={variant} campaignName={campaignName} onCampaignNameChange={setCampaignName} dailyBudgetBaht={dailyBudgetBaht} editingCampaign={editingCampaign} onDailyBudgetBahtChange={setDailyBudgetBaht} onAutomationSettingsChange={setAutomationSettings} onCampaignGoalChange={setCampaignGoal} />
        <div className="mt-5 flex justify-end px-1">
          <button
            type="button"
            onClick={submitCampaign}
            disabled={creatingCampaign}
            className="rounded-lg bg-gradient-to-r from-[#ffd86a] to-[#e0a018] px-5 py-2.5 text-[12px] font-black text-black shadow-[0_0_18px_rgba(245,189,55,.18)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creatingCampaign ? (isEditing ? 'กำลังอัปเดต...' : 'กำลังสร้าง...') : (isEditing ? 'อัปเดตแคมเปญ' : 'สร้างแคมเปญนี้')}
          </button>
        </div>
      </div>
      {createResult ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/72 px-4 backdrop-blur-[7px]">
          <div className={`w-full max-w-[480px] overflow-hidden rounded-[20px] border bg-[radial-gradient(circle_at_10%_0%,rgba(45,167,255,.24),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(242,189,75,.18),transparent_32%),linear-gradient(135deg,#07111f_0%,#05070b_56%,#171004_100%)] p-6 text-[#f7f1e7] shadow-[0_32px_100px_rgba(0,0,0,.62),0_0_38px_rgba(45,167,255,.12),inset_0_1px_0_rgba(255,255,255,.08)] ${
            createResult.tone === 'success'
              ? 'border-[#2fd67a]/55'
              : createResult.tone === 'error'
                ? 'border-[#ff766f]/55'
                : 'border-[#f5bd37]/70'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-[14px] border ${
                createResult.tone === 'success'
                  ? 'border-[#2fd67a] bg-[#082817] text-[#7dffae]'
                  : createResult.tone === 'error'
                    ? 'border-[#ff6548] bg-[#2a0d0a] text-[#ff9a86]'
                    : 'border-[#f5bd37] bg-[#2c2109] text-[#ffd86a]'
              }`}>
                {createResult.tone === 'success' ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
              </div>
              <div className="min-w-0">
                <p className="text-[24px] font-black text-white drop-shadow-[0_2px_12px_rgba(45,167,255,.16)]">{createResult.title}</p>
                <p className="mt-3 text-[14px] font-bold leading-7 text-[#d7ecff]">{createResult.message}</p>
                {createResult.detail ? <p className="mt-2 text-[11px] font-bold leading-5 text-[#8dc7ff]">{createResult.detail}</p> : null}
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setCreateResult(null)}
                className="rounded-[10px] bg-gradient-to-r from-[#ffd86a] to-[#e0a018] px-6 py-2.5 text-[13px] font-black text-black transition hover:brightness-110"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
export function ControlAdsPageClient() {
  const [view, setView] = useState<'overview' | 'live' | 'product'>('overview');
  const [selectedAccount, setSelectedAccount] = useState<SelectedAdsAccount | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<EditingLiveCampaign | null>(null);
  const [draftCampaign, setDraftCampaign] = useState<DraftLiveCampaign | null>(null);

  useEffect(() => {
    function syncViewFromUrl() {
      const nextView = new URLSearchParams(window.location.search).get('view');
      const params = new URLSearchParams(window.location.search);
      setView(nextView === 'live' || nextView === 'product' ? nextView : 'overview');
      const adsAccountId = params.get('adsAccountId');
      setSelectedAccount(adsAccountId ? {
        id: adsAccountId,
        name: params.get('accountName') ?? 'บัญชี Ads',
        shopId: params.get('shopId') ?? undefined,
      } : null);
      const mode = params.get('mode');
      const draftName = params.get('draftName');
      const resolvedView = nextView === 'live' || nextView === 'product' ? nextView : 'overview';
      setEditingCampaign(editingCampaignFromQuery(params, resolvedView));
      setDraftCampaign(mode === 'copy' && draftName ? { name: draftName } : null);
    }
    syncViewFromUrl();
    window.addEventListener('popstate', syncViewFromUrl);
    window.addEventListener('np-live-ads-view-change', syncViewFromUrl);
    return () => {
      window.removeEventListener('popstate', syncViewFromUrl);
      window.removeEventListener('np-live-ads-view-change', syncViewFromUrl);
    };
  }, []);

  function openAdsView(nextView: 'overview' | 'live' | 'product', account?: SelectedAdsAccount, campaign?: EditingLiveCampaign, draft?: DraftLiveCampaign) {
    setView(nextView);
    setSelectedAccount(account ?? null);
    setEditingCampaign(campaign ?? null);
    setDraftCampaign(draft ?? null);
    const params = new URLSearchParams();
    if (nextView !== 'overview') params.set('view', nextView);
    if (account) {
      params.set('adsAccountId', account.id);
      if (account.shopId) params.set('shopId', account.shopId);
      params.set('accountName', account.name);
    }
    if (campaign) {
      params.set('mode', 'edit');
      params.set('campaignId', String(campaign.campaignId));
      params.set('campaignName', campaign.name);
      if (campaign.dailyBudgetBaht && campaign.dailyBudgetBaht > 0) params.set('dailyBudgetBaht', String(campaign.dailyBudgetBaht));
      if (campaign.automationSettings) params.set('automationSettings', JSON.stringify(campaign.automationSettings));
      if (typeof campaign.startTime === 'number') params.set('startTime', String(campaign.startTime));
      if (typeof campaign.endTime === 'number') params.set('endTime', String(campaign.endTime));
      if (campaign.roiTwoTargetValue && campaign.roiTwoTargetValue > 0) params.set('roiTwoTargetValue', String(campaign.roiTwoTargetValue));
      const firstSlot = campaign.timeSlotList?.[0];
      if (firstSlot) {
        params.set('timeSlotStart', String(firstSlot.start_time ?? 0));
        params.set('timeSlotEnd', String(firstSlot.end_time ?? 0));
      }
    } else if (draft?.name) {
      params.set('mode', 'copy');
      params.set('draftName', draft.name);
    }
    const query = params.toString();
    const url = nextView === 'overview' || !query ? '/tools/control-ads' : `/tools/control-ads?${query}`;
    window.history.pushState(null, '', url);
    window.dispatchEvent(new Event('np-live-ads-view-change'));
  }

  return (
    <AppShell>
      <div className="min-h-screen px-8 py-6">
        {view === 'live' || view === 'product' ? (
          <AutomationPage variant={view} selectedAccount={selectedAccount} editingCampaign={editingCampaign} initialCampaignName={draftCampaign?.name ?? null} onBack={() => openAdsView('overview')} />
        ) : (
          <CampaignManagerList onOpenRules={(nextView = 'live', account, campaign, draft) => openAdsView(nextView, account, campaign, draft)} />
        )}
      </div>
    </AppShell>
  );
}

export function LiveAdsCreatePageClient() {
  const router = useRouter();
  const [selectedAccount, setSelectedAccount] = useState<SelectedAdsAccount | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<EditingLiveCampaign | null>(null);
  const [draftCampaign, setDraftCampaign] = useState<DraftLiveCampaign | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const adsAccountId = params.get('adsAccountId');
    const draftName = params.get('draftName');
    setSelectedAccount(adsAccountId ? {
      id: adsAccountId,
      name: params.get('accountName') ?? 'บัญชี Ads',
      shopId: params.get('shopId') ?? undefined,
    } : null);
    setEditingCampaign(editingCampaignFromQuery(params, 'live'));
    setDraftCampaign(params.get('mode') === 'copy' && draftName ? { name: draftName } : null);
  }, []);

  return (
    <AppShell>
      <div className="min-h-screen px-8 py-6">
        <AutomationPage variant="live" selectedAccount={selectedAccount} editingCampaign={editingCampaign} initialCampaignName={draftCampaign?.name ?? null} onBack={() => router.push('/tools/control-ads')} />
      </div>
    </AppShell>
  );
}






