'use client';

import { ArrowLeft, CheckCircle2, Crown, Wallet, X, Zap } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { usePackages } from '@/hooks/usePackages';
import { userService } from '@/services/user.service';
import type { CurrentPackage, PackageItem, PackageUsageItem } from '@/types/package';
import type { UserProfile } from '@/types/user';

function toNumber(value: number | string | null | undefined) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function formatPrice(priceBaht: number | string) {
  const price = toNumber(priceBaht);
  if (price <= 0) return 'ฟรี';
  return formatMoney(price);
}

function formatMoney(priceBaht: number | string | null | undefined) {
  return `${toNumber(priceBaht).toLocaleString()} บาท`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function packageCategory(item: PackageItem) {
  const category = (item.category || '').toUpperCase();
  const raw = `${item.code || ''} ${item.name || ''}`.toLowerCase().replace(/[_\s-]+/g, '');
  if (category === 'ULTRA_PRO' || category === 'ULTRAPRO' || raw.includes('ultra')) return 'UltraPro';
  if (category === 'PROMAX' || raw.includes('max')) return 'ProMax';
  if (category === 'PRO' || raw.includes('pro')) return 'Pro';
  return 'Starter';
}

function packageSlug(item: PackageItem) {
  return packageCategory(item).toLowerCase();
}

function getPlanTone(code?: string | null) {
  const planCode = (code || '').toUpperCase();
  if (planCode.includes('ULTRA')) return 'POPULAR';
  if (planCode.includes('MAX')) return 'SCALE';
  if (planCode.includes('PRO')) return 'CURRENT READY';
  if (planCode.includes('STARTER') || planCode.includes('FREE')) return 'STARTER';
  return null;
}

function progressPercent(usage?: PackageUsageItem) {
  const total = toNumber(usage?.total);
  if (total <= 0) return 0;
  return Math.min(100, Math.round((toNumber(usage?.used) / total) * 100));
}

function UsageBar({ label, usage, suffix = '' }: { label: string; usage?: PackageUsageItem; suffix?: string }) {
  const percent = progressPercent(usage);
  const used = toNumber(usage?.used);
  const total = toNumber(usage?.total);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-[12px] font-black text-[#f7f1e7]">
        <span>{label}</span>
        <span className="text-[#ffd46c]">
          {total > 0 ? `${used.toLocaleString()} / ${total.toLocaleString()} ${suffix}` : `${used.toLocaleString()} ${suffix}`}
        </span>
      </div>
      {total > 0 ? (
        <div className="h-2.5 overflow-hidden rounded-full bg-[#152235] shadow-[inset_0_1px_2px_rgba(0,0,0,.6)]">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,#0b79ff,#38bdf8,#ffd46c)] shadow-[0_0_18px_rgba(58,167,255,.34)]" style={{ width: `${percent}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function CurrentPackageCard({
  current,
  fallbackPackage,
  creditBaht,
}: {
  current: CurrentPackage | null;
  fallbackPackage?: PackageItem;
  creditBaht?: number | null;
}) {
  const item = current?.package ?? fallbackPackage ?? null;
  const daysLeft = current?.daysLeft;
  const creditText = formatMoney(creditBaht);
  const isLifetime = Boolean(item && toNumber(item.durationDays) <= 0);

  return (
    <section className="relative overflow-hidden rounded-[12px] border border-[#c7962d]/80 bg-[radial-gradient(circle_at_10%_0%,rgba(45,167,255,.28),transparent_34%),radial-gradient(circle_at_88%_10%,rgba(242,189,75,.24),transparent_32%),linear-gradient(135deg,#07182b_0%,#05070b_55%,#241804_100%)] p-5 shadow-[0_24px_70px_rgba(0,0,0,.46),inset_0_1px_0_rgba(255,255,255,.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-[12px] bg-[linear-gradient(135deg,#ffd46c,#0b79ff,#38bdf8)] text-white shadow-[0_16px_40px_rgba(242,189,75,.18)]">
            <Crown size={25} />
          </div>
          <div>
            <div className="text-sm font-black text-[#9cc7ff]">แพ็กเกจปัจจุบัน</div>
            <h2 className="mt-1 text-[28px] font-black leading-none text-white">{item?.name ?? 'ยังไม่ได้เลือกแพ็กเกจ'}</h2>
            <p className="mt-2 text-sm font-bold text-[#b9cbe2]">
              {item ? (isLifetime ? 'ใช้งานตลอดชีพ ไม่มีวันหมดอายุ' : `หมดอายุ ${formatDate(current?.expiresAt)}`) : 'เลือกแพ็กเกจเพื่อเริ่มใช้งานสิทธิ์ของระบบ'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <div className="min-w-[128px] rounded-[12px] border border-[#c7962d]/55 bg-[#090b10]/80 px-5 py-3 text-right">
            <div className="text-xs font-black text-[#b9cbe2]">ยอดเงิน</div>
            <div className="mt-1 text-2xl font-black text-[#ffd46c]">{creditText}</div>
          </div>
          <div className="min-w-[104px] rounded-[12px] border border-[#c7962d]/55 bg-[#090b10]/80 px-5 py-3 text-right">
            <div className="text-xs font-black text-[#b9cbe2]">เหลืออีก</div>
            <div className="mt-1 text-2xl font-black text-[#ffd46c]">{isLifetime ? 'ตลอดชีพ' : typeof daysLeft === 'number' ? `${daysLeft} วัน` : '-'}</div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <UsageBar label="บัญชี" usage={current?.usage?.accounts ?? (item ? { used: 0, total: toNumber(item.maxAccounts) } : undefined)} />
        <UsageBar label="ช่องไลฟ์" usage={current?.usage?.live ?? (item ? { used: 0, total: toNumber(item.maxLiveChannels) } : undefined)} />
        <UsageBar label="วิดีโอ" usage={current?.usage?.videos ?? (item ? { used: 0, total: toNumber(item.maxVideos) } : undefined)} />
        <UsageBar label="เพิ่มวิดีโอได้" usage={item ? { used: toNumber(item.maxVideos), total: 0 } : undefined} suffix="คลิป" />
      </div>
    </section>
  );
}

function packageSortValue(item: PackageItem) {
  const explicitOrder = toNumber(item.sortOrder);
  if (explicitOrder > 0) return explicitOrder;
  return toNumber(item.priceBaht);
}

function uniquePackageGroups(packages: PackageItem[]) {
  const seen = new Set<string>();
  return packages.filter((item) => {
    const slug = packageSlug(item);
    if (seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });
}

function PackageTabs({ packages, activeSlug, onOpen }: { packages: PackageItem[]; activeSlug: string | null; onOpen: (item: PackageItem | null) => void }) {
  const groups = uniquePackageGroups(packages);

  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      <button
        type="button"
        onClick={() => onOpen(null)}
        className={`h-10 w-full rounded-[9px] border px-4 text-xs font-black transition ${!activeSlug ? 'border-[#ffd46c] bg-[linear-gradient(135deg,#ffd46c,#e5a928)] text-[#120d05]' : 'border-[#c7962d]/45 bg-[#070a10] text-[#f4ead2] hover:border-[#ffd46c]'}`}
      >
        ทั้งหมด
      </button>
      {groups.map((item) => {
        const slug = packageSlug(item);
        return (
          <button
            key={slug}
            type="button"
            onClick={() => onOpen(item)}
            className={`h-10 w-full rounded-[9px] border px-4 text-xs font-black transition ${activeSlug === slug ? 'border-[#2da7ff]/80 bg-[#08264f] text-white shadow-[0_0_24px_rgba(11,121,255,.26)]' : 'border-[#c7962d]/45 bg-[#070a10] text-[#f4ead2] hover:border-[#ffd46c]'}`}
          >
            {packageCategory(item)}
          </button>
        );
      })}
    </div>
  );
}

function PackageDetailPanel({ titleItem, items, highlightFromBanner, focusedPackageId, currentPackageId, selectingId, onSelect, onClose }: { titleItem: PackageItem; items: PackageItem[]; highlightFromBanner: boolean; focusedPackageId: string | null; currentPackageId: string | null; selectingId: string | null; onSelect: (id: string) => void; onClose: () => void }) {
  const targetPackageId = highlightFromBanner ? focusedPackageId ?? titleItem.id : null;
  const sortedItems = [...items].sort((a, b) => {
    if (targetPackageId && a.id === targetPackageId) return -1;
    if (targetPackageId && b.id === targetPackageId) return 1;
    return packageSortValue(a) - packageSortValue(b);
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/72 p-4 backdrop-blur-[6px]" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="ปิดหน้ารายละเอียดแพ็กเกจ" onClick={onClose} />
      <section className="relative flex max-h-[86vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-[18px] border border-[#d4a53b]/75 bg-[#080807] shadow-[0_30px_90px_rgba(0,0,0,.72),0_0_0_1px_rgba(242,189,75,.15)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_0%,rgba(11,121,255,.26),transparent_30%),radial-gradient(circle_at_100%_0%,rgba(242,189,75,.24),transparent_32%),linear-gradient(135deg,rgba(7,11,18,.96),rgba(7,7,6,.99)_58%,rgba(31,21,5,.88))]" />
        <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[#ffd46c] to-transparent" />
        <button type="button" onClick={onClose} className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-xl border border-[#c7962d]/35 bg-black/45 text-[#d8c8a1] hover:border-[#ffd46c] hover:text-white" aria-label="ปิดหน้ารายละเอียดแพ็กเกจ">
          <X size={18} />
        </button>

        <div className="relative border-b border-[#c7962d]/35 p-5 pr-16">
          <div className="inline-flex h-8 items-center gap-2 rounded-full border border-[#ffd46c]/45 bg-black/[0.35] px-3 text-[11px] font-black uppercase tracking-[.18em] text-[#ffd46c]">
            <Zap size={13} /> {packageCategory(titleItem)}
          </div>
          <h1 className="mt-3 text-[34px] font-black leading-none text-white">แพ็กเกจ {packageCategory(titleItem)}</h1>
          <p className="mt-2 text-sm font-semibold text-[#a9a197]">{sortedItems.length.toLocaleString()} รายการ</p>
        </div>

        <div className="relative overflow-y-auto p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedItems.map((item) => {
              const features = [
                `บัญชีสูงสุด ${toNumber(item.maxAccounts).toLocaleString()} บัญชี`,
                `ช่องไลฟ์สูงสุด ${toNumber(item.maxLiveChannels).toLocaleString()} ช่อง`,
                `วิดีโอสูงสุด ${toNumber(item.maxVideos).toLocaleString()} รายการ`,
                `เพิ่มวิดีโอได้ ${toNumber(item.maxVideos).toLocaleString()} คลิป`,
              ];
              const isCurrent = item.id === currentPackageId;
              const isSelecting = selectingId === item.id;
              const isFocused = item.id === targetPackageId;
              const badge = isFocused ? 'จากประกาศ' : isCurrent ? 'CURRENT PLAN' : getPlanTone(item.code);

              return (
                <article key={item.id} className={`relative flex min-h-[430px] flex-col overflow-hidden rounded-[16px] border bg-black/[0.34] p-4 ${isFocused ? 'border-[#ffd166] shadow-[0_0_0_2px_rgba(255,209,102,.55),0_0_28px_rgba(27,167,255,.22)]' : isCurrent ? 'border-[#d4a53b] shadow-[0_0_0_1px_rgba(242,189,75,.35)]' : 'border-[#c7962d]/35'}`}>
                  {isFocused ? (
                    <div className="pointer-events-none absolute inset-0 z-0 rounded-[16px] bg-[linear-gradient(135deg,rgba(27,167,255,.1),transparent_40%,rgba(242,189,75,.12))]" />
                  ) : null}
                  {isFocused ? (
                    <div className="relative z-10 -mx-4 -mt-4 mb-4 flex items-center justify-center bg-[linear-gradient(135deg,#ffd46c,#e5a928)] px-4 py-2 text-[12px] font-black text-[#120d05] shadow-[0_8px_20px_rgba(242,189,75,.18)]">แพ็กเกจที่เลือกจากประกาศ</div>
                  ) : null}
                  {badge ? (
                    <span className={`absolute right-4 top-4 z-20 rounded-full px-2.5 py-0.5 text-[10px] font-black ${isFocused ? 'border border-[#ffd166] bg-[#14100a] text-[#ffd166] shadow-[0_0_14px_rgba(242,189,75,.25)]' : isCurrent ? 'bg-[linear-gradient(135deg,#ffd46c,#e5a928)] text-[#0b0b0a]' : 'bg-[#2d1e0e] text-[#ffd46c]'}`}>
                      {badge}
                    </span>
                  ) : null}
                  <div className="relative z-10 pr-24">
                    <div className="text-[12px] font-black uppercase tracking-[0.18em] text-[#ffd46c]">{item.code}</div>
                    <h2 className="mt-1 text-[25px] font-black text-white">{item.name}</h2>
                    <p className="mt-1 min-h-[40px] text-[12px] leading-5 text-[#9fb1c9]">{item.description || 'แพ็กเกจสำหรับใช้งานระบบ NP LIVE'}</p>
                  </div>

                  <div className="relative z-10 mt-4 rounded-[10px] border border-[#c7962d]/55 bg-[#05070b] p-4">
                    <div className="text-[30px] font-black text-[#ffd46c]">{formatPrice(item.priceBaht)}</div>
                    <div className="mt-1 text-xs font-semibold text-[#d8c8a1]">{toNumber(item.durationDays) > 0 ? `ต่อรอบการใช้งาน ${toNumber(item.durationDays).toLocaleString('th-TH')} วัน` : 'ใช้งานตลอดชีพ'}</div>
                  </div>

                  <ul className="relative z-10 mt-4 flex-1 space-y-2">
                    {features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 rounded-[10px] border border-[#c7962d]/18 bg-black/[0.24] px-3 py-2 text-[12px] font-semibold text-[#e9dcc0]">
                        <CheckCircle2 size={14} className="text-[#ffd46c]" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    disabled={isSelecting || !item.isActive || isCurrent}
                    className={`relative z-10 mt-5 h-11 rounded-xl text-sm font-black shadow-[0_14px_34px_rgba(242,189,75,.2)] disabled:cursor-not-allowed disabled:opacity-80 ${isCurrent ? 'bg-[linear-gradient(135deg,#ffd46c,#e5a928)] text-[#160d04]' : 'border border-[#1ba7ff] bg-gradient-to-b from-[#0b79ff] to-[#08264f] text-white hover:brightness-110'}`}
                  >
                    {isCurrent ? '✓ กำลังใช้งานอยู่' : isSelecting ? 'กำลังเลือก...' : item.isActive ? 'เลือกแพ็กเกจนี้' : 'ปิดใช้งาน'}
                  </button>
                </article>
              );
            })}
          </div>
        </div>

        <div className="relative border-t border-[#c7962d]/35 p-4">
          <button type="button" onClick={onClose} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#c7962d]/35 bg-black/[0.35] px-5 text-sm font-black text-white hover:border-[#ffd46c]">
            <ArrowLeft size={15} /> ย้อนกลับ
          </button>
        </div>
      </section>
    </div>
  );
}
function PackagePlanCard({ item, isCurrent, isActiveDetail, selectingId, onSelect, onOpenDetail }: { item: PackageItem; isCurrent: boolean; isActiveDetail: boolean; selectingId: string | null; onSelect: (id: string) => void; onOpenDetail: (item: PackageItem) => void }) {
  const features = [
    `บัญชีสูงสุด ${toNumber(item.maxAccounts).toLocaleString()} บัญชี`,
    `ช่องไลฟ์สูงสุด ${toNumber(item.maxLiveChannels).toLocaleString()} ช่อง`,
    `วิดีโอสูงสุด ${toNumber(item.maxVideos).toLocaleString()} รายการ`,
    `เพิ่มวิดีโอได้ ${toNumber(item.maxVideos).toLocaleString()} คลิป`,
  ];

  const isSelecting = selectingId === item.id;
  const badge = isCurrent ? 'CURRENT PLAN' : getPlanTone(item.code);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(item)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpenDetail(item);
      }}
      className={`relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[12px] border bg-[radial-gradient(circle_at_10%_0%,rgba(45,167,255,.16),transparent_34%),linear-gradient(145deg,rgba(7,17,31,.98),rgba(3,5,10,.99)_58%,rgba(18,12,5,.98))] p-5 outline-none shadow-[0_18px_46px_rgba(0,0,0,.32),inset_0_1px_0_rgba(255,255,255,.04)] transition hover:-translate-y-0.5 hover:border-[#2da7ff]/55 hover:shadow-[0_24px_60px_rgba(0,0,0,.42),0_0_26px_rgba(45,167,255,.12)] ${isCurrent || isActiveDetail ? 'border-[#ffd46c] shadow-[0_0_0_1px_rgba(242,189,75,.35),0_0_28px_rgba(45,167,255,.12)]' : 'border-[#c7962d]/38'}`}
    >
      {badge ? (
        <span className={`absolute right-4 top-4 rounded-full border border-[#ffd46c]/55 bg-[#2b210b] px-2.5 py-0.5 text-[10px] font-black text-[#ffd46c]`}>
          {badge}
        </span>
      ) : null}

      <div className="pr-20">
        <div className="text-[12px] font-black uppercase tracking-[0.18em] text-[#ffd46c]">{item.code}</div>
        <h3 className="mt-1 text-[26px] font-black leading-none text-white">{item.name}</h3>
        <p className="mt-2 min-h-[40px] text-[13px] font-semibold leading-5 text-[#b9cbe2]">{item.description || 'แพ็กเกจสำหรับใช้งานระบบ Live Streaming'}</p>
      </div>

      <div className="relative z-10 mt-4 rounded-[10px] border border-[#c7962d]/55 bg-[#05070b] p-4">
        <div className="text-[30px] font-black text-[#ffd46c]">{formatPrice(item.priceBaht)}</div>
        <div className="mt-1 text-xs font-bold text-[#b9cbe2]">{toNumber(item.durationDays) > 0 ? `ต่อรอบการใช้งาน ${toNumber(item.durationDays).toLocaleString('th-TH')} วัน` : 'ใช้งานตลอดชีพ'}</div>
      </div>

      <ul className="relative z-10 mt-4 flex-1 space-y-2">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-[13px] font-black text-[#f7f1e7]">
            <CheckCircle2 size={14} className="text-[#ffd46c]" />
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-5 grid grid-cols-[1fr_1.15fr] gap-2">
        <button type="button" onClick={(event) => { event.stopPropagation(); onOpenDetail(item); }} className="h-10 rounded-[8px] border border-[#c7962d]/55 bg-[#05070b] text-[12px] font-black text-white hover:border-[#ffd46c]">
          ดูรายละเอียด
        </button>
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onSelect(item.id); }}
          disabled={isSelecting || !item.isActive || isCurrent}
          className={`h-10 rounded-[8px] text-[12px] font-black shadow-[0_12px_30px_rgba(242,189,75,.18)] disabled:cursor-not-allowed disabled:opacity-80 ${
            isCurrent ? 'bg-[linear-gradient(135deg,#ffd46c,#e5a928)] text-[#160d04]' : 'border border-[#1ba7ff] bg-gradient-to-b from-[#0b79ff] to-[#08264f] text-white hover:brightness-110'
          }`}
        >
          {isCurrent ? '✓ ใช้งานอยู่' : isSelecting ? 'กำลังเลือก...' : item.isActive ? 'เลือกแพ็กเกจ' : 'ปิดใช้งาน'}
        </button>
      </div>
    </article>
  );
}

export function PackagesPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { packages, current, loading, selectingId, error, success, selectPackage } = usePackages();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [checkoutPackage, setCheckoutPackage] = useState<PackageItem | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const currentPackageId = current?.package?.id ?? null;
  const activeSlug = searchParams.get('plan');
  const highlightFromBanner = searchParams.get('highlight') === '1';
  const focusedPackageId = searchParams.get('package');
  const selectedPackage = useMemo(() => packages.find((item) => packageSlug(item) === activeSlug) ?? null, [packages, activeSlug]);
  const selectedPackageItems = useMemo(() => packages.filter((item) => packageSlug(item) === activeSlug), [packages, activeSlug]);
  const fallbackCurrentPackage = useMemo(() => packages.find((item) => item.id === currentPackageId), [packages, currentPackageId]);
  const availableCredit = toNumber(profile?.credit);
  const checkoutPrice = toNumber(checkoutPackage?.priceBaht);
  const checkoutBalance = availableCredit - checkoutPrice;
  const canConfirmCheckout = Boolean(checkoutPackage) && checkoutBalance >= 0 && selectingId !== checkoutPackage?.id;

  useEffect(() => {
    if (!successNotice) return;
    const timer = window.setTimeout(() => setSuccessNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [successNotice]);

  useEffect(() => {
    let mounted = true;
    userService
      .me()
      .then((next) => {
        if (mounted) setProfile(next);
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, [success]);

  function handleSelect(packageId: string) {
    const item = packages.find((currentItem) => currentItem.id === packageId);
    if (item) setCheckoutPackage(item);
  }

  async function confirmCheckout() {
    if (!checkoutPackage) return;
    const packageName = checkoutPackage.name;
    await selectPackage(checkoutPackage.id);
    const nextProfile = await userService.me().catch(() => null);
    if (nextProfile) setProfile(nextProfile);
    setCheckoutPackage(null);
    setSuccessNotice('สมัครแพ็กเกจ ' + packageName + ' สำเร็จ');
    router.refresh();
  }


  function openPackageDetail(item: PackageItem | null) {
    router.push(item ? `/packages?plan=${packageSlug(item)}` : '/packages');
  }

  return (
    <div className="min-h-screen space-y-6 bg-[radial-gradient(circle_at_12%_0%,rgba(11,121,255,.08),transparent_28%),radial-gradient(circle_at_92%_4%,rgba(242,189,75,.08),transparent_28%)]">
      <CurrentPackageCard current={current} fallbackPackage={fallbackCurrentPackage} creditBaht={profile?.credit ?? 0} />

      {checkoutPackage ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/78 p-4 backdrop-blur-md" role="dialog" aria-modal="true" onClick={() => setCheckoutPackage(null)}>
          <section className="w-[min(620px,calc(100vw-32px))] overflow-hidden rounded-[22px] border border-[#c7962d]/65 bg-[radial-gradient(circle_at_14%_0%,rgba(45,167,255,.25),transparent_34%),radial-gradient(circle_at_95%_4%,rgba(255,212,108,.18),transparent_30%),linear-gradient(145deg,#07111f,#060708_58%,#171004)] shadow-[0_32px_100px_rgba(0,0,0,.76),0_0_0_1px_rgba(255,212,108,.08)]" onClick={(event) => event.stopPropagation()}>
            <div className="relative border-b border-[#c7962d]/35 p-5">
              <button type="button" onClick={() => setCheckoutPackage(null)} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl border border-[#c7962d]/35 bg-black/[0.32] text-[#ffd46c] hover:border-[#ffd46c]" aria-label="ปิดหน้าชำระแพ็กเกจ">
                <X size={18} />
              </button>
              <div className="flex items-center gap-4 pr-12">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#ffd46c,#0b79ff)] text-white shadow-[0_16px_40px_rgba(242,189,75,.24)]">
                  <Wallet size={25} />
                </div>
                <div>
                  <div className="inline-flex h-7 items-center rounded-full border border-[#ffd46c]/40 bg-black/[0.35] px-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#ffd46c]">NP LIVE CHECKOUT</div>
                  <h2 className="mt-2 text-[28px] font-black leading-tight text-white">ยืนยันและชำระแพ็กเกจ</h2>
                  <p className="mt-1 text-sm font-semibold text-[#9fb1c9]">ระบบจะตัดยอดเงินคงเหลือ แล้วเปิดสิทธิ์ให้ทันทีหลังยืนยัน</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-2xl border border-[#2da7ff]/35 bg-[linear-gradient(135deg,rgba(6,26,52,.78),rgba(0,0,0,.3))] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-[#ffd46c]">{checkoutPackage.code}</div>
                    <div className="mt-1 text-[27px] font-black text-white">{checkoutPackage.name}</div>
                    <div className="mt-1 text-sm font-bold text-[#9fb1c9]">{toNumber(checkoutPackage.durationDays) > 0 ? `ใช้งาน ${toNumber(checkoutPackage.durationDays).toLocaleString('th-TH')} วัน สำหรับร้านของคุณ` : 'ใช้งานตลอดชีพสำหรับร้านของคุณ'}</div>
                  </div>
                  <div className="rounded-xl border border-[#ffd46c]/35 bg-black/[0.35] px-4 py-3 text-right">
                    <div className="text-[11px] font-black text-[#9fb1c9]">ราคาแพ็กเกจ</div>
                    <div className="mt-1 text-2xl font-black text-[#ffd46c]">{formatPrice(checkoutPrice)}</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-[#c7962d]/25 bg-black/[0.28] p-3"><div className="text-[11px] font-black text-[#9fb1c9]">บัญชี</div><div className="mt-1 text-xl font-black text-white">{toNumber(checkoutPackage.maxAccounts).toLocaleString()}</div></div>
                <div className="rounded-xl border border-[#c7962d]/25 bg-black/[0.28] p-3"><div className="text-[11px] font-black text-[#9fb1c9]">ช่องไลฟ์</div><div className="mt-1 text-xl font-black text-white">{toNumber(checkoutPackage.maxLiveChannels).toLocaleString()}</div></div>
                <div className="rounded-xl border border-[#c7962d]/25 bg-black/[0.28] p-3"><div className="text-[11px] font-black text-[#9fb1c9]">วิดีโอ</div><div className="mt-1 text-xl font-black text-white">{toNumber(checkoutPackage.maxVideos).toLocaleString()}</div></div>
                <div className="rounded-xl border border-[#c7962d]/25 bg-black/[0.28] p-3"><div className="text-[11px] font-black text-[#9fb1c9]">เพิ่มคลิป</div><div className="mt-1 text-xl font-black text-white">{toNumber(checkoutPackage.maxVideos).toLocaleString()} คลิป</div></div>
              </div>

              <div className="rounded-2xl border border-[#c7962d]/35 bg-black/[0.32] p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  <div className="rounded-xl bg-[#07111f] p-3 text-center"><div className="text-[11px] font-black text-[#9fb1c9]">ยอดเงินปัจจุบัน</div><div className="mt-1 text-xl font-black text-[#ffd46c]">{formatMoney(availableCredit)}</div></div>
                  <div className="hidden text-center text-xl font-black text-[#9fb1c9] sm:block">-</div>
                  <div className="rounded-xl bg-[#10100f] p-3 text-center"><div className="text-[11px] font-black text-[#9fb1c9]">ราคาแพ็กเกจ</div><div className="mt-1 text-xl font-black text-white">{formatPrice(checkoutPrice)}</div></div>
                </div>
              </div>

              {checkoutBalance < 0 ? (
                <div className="rounded-xl border border-[#ff766f]/35 bg-[#3a0d11]/60 px-4 py-3 text-sm font-bold text-[#ffaaa1]">ยอดเงินไม่พอ ต้องเติมเพิ่มอีก {formatMoney(Math.abs(checkoutBalance))} ก่อนเลือกแพ็กเกจนี้</div>
              ) : null}
            </div>

            <div className="grid gap-3 border-t border-[#c7962d]/35 p-5 sm:grid-cols-[1fr_1.35fr]">
              <button type="button" onClick={() => setCheckoutPackage(null)} className="h-11 rounded-xl border border-[#c7962d]/35 bg-black/[0.35] text-sm font-black text-white hover:border-[#ffd46c]">ยกเลิก</button>
              <button type="button" onClick={() => void confirmCheckout()} disabled={!canConfirmCheckout} className="h-11 rounded-xl bg-[linear-gradient(135deg,#ffd46c,#e5a928)] text-sm font-black text-[#120d05] shadow-[0_14px_34px_rgba(242,189,75,.22)] disabled:cursor-not-allowed disabled:opacity-55">
                {selectingId === checkoutPackage.id ? 'กำลังตัดยอด...' : 'ยืนยัน ชำระเงิน และเปิดแพ็กเกจ'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-[12px] border border-[#c7962d]/55 bg-[radial-gradient(circle_at_5%_0%,rgba(45,167,255,.18),transparent_30%),linear-gradient(145deg,rgba(5,15,28,.98),rgba(3,4,7,.98)_58%,rgba(24,16,5,.96))] p-4 shadow-[0_22px_64px_rgba(0,0,0,.34),inset_0_1px_0_rgba(255,255,255,.05)]">
        {packages.length > 0 ? <PackageTabs packages={packages} activeSlug={activeSlug} onOpen={openPackageDetail} /> : null}
      </div>

      {selectedPackage ? (
        <PackageDetailPanel titleItem={selectedPackage} items={selectedPackageItems} highlightFromBanner={highlightFromBanner} focusedPackageId={focusedPackageId} currentPackageId={currentPackageId} selectingId={selectingId} onSelect={(id) => void handleSelect(id)} onClose={() => openPackageDetail(null)} />
      ) : null}

      {error ? <div className="rounded-[14px] border border-[#ff766f]/35 bg-[#3a0d11]/60 px-4 py-3 text-sm font-bold text-[#ffaaa1]">{error}</div> : null}
      {successNotice ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/35 p-4 backdrop-blur-[2px] pointer-events-none">
          <div className="w-[min(420px,calc(100vw-32px))] rounded-[20px] border border-[#ffd46c]/70 bg-[radial-gradient(circle_at_18%_0%,rgba(45,167,255,.28),transparent_34%),linear-gradient(145deg,#07111f,#060708_58%,#171004)] p-6 text-center shadow-[0_30px_90px_rgba(0,0,0,.72),0_0_0_1px_rgba(255,212,108,.12)]">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,#ffd46c,#0b79ff)] text-white shadow-[0_16px_40px_rgba(242,189,75,.25)]">
              <CheckCircle2 size={28} />
            </div>
            <div className="mt-4 text-[24px] font-black text-white">{successNotice}</div>
            <div className="mt-2 text-sm font-bold text-[#9fb1c9]">ระบบตัดเครดิตและเปิดสิทธิ์ให้เรียบร้อยแล้ว</div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[18px] border border-[#c7962d]/30 bg-black/[0.35] p-8 text-center text-[#d8c8a1]">กำลังโหลดข้อมูลแพ็กเกจ...</div>
      ) : packages.length === 0 ? (
        <div className="rounded-[18px] border border-[#c7962d]/30 bg-black/[0.35] p-8 text-center text-[#d8c8a1]">ยังไม่มีแพ็กเกจในระบบ<br /><span className="mt-2 block text-xs text-[#8d9bb0]">ให้รัน npx prisma db seed ใน apps/api แล้วโหลดหน้าใหม่</span></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {packages.map((item) => (
            <PackagePlanCard key={item.id} item={item} isCurrent={item.id === currentPackageId} isActiveDetail={packageSlug(item) === activeSlug} selectingId={selectingId} onSelect={(id) => void handleSelect(id)} onOpenDetail={openPackageDetail} />
          ))}
        </div>
      )}
    </div>
  );
}










