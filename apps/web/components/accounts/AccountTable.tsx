'use client';

import { BarChart3, Copy, ExternalLink, Loader2, Pencil, PlayCircle, RefreshCw, Search, ShoppingBag, StopCircle, Trash2, Tv, Video, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccountStatusBadge } from './AccountStatusBadge';
import type { LiveChannel, LiveChannelInsights, ShopeeBasketItem, ShopeeProductDetail, ShopeeScreenRankingItem } from '@/types/account';
import type { ProxyItem } from '@/types/proxy';
import type { VideoItem } from '@/types/video';
import { accountService } from '@/services/account.service';

type AccountTableProps = {
  rows: LiveChannel[];
  proxies: ProxyItem[];
  query: string;
  loading?: boolean;
  saving?: boolean;
  videos?: VideoItem[];
  onQueryChange: (value: string) => void;
  onUpdate: (id: string, payload: { name?: string; proxyId?: string | null }) => Promise<void> | void;
  onEdit: (row: LiveChannel) => Promise<void> | void;
  onToggleStatus: (id: string, isOnline: boolean) => Promise<void> | void;
  onRemove: (id: string) => Promise<void> | void;
};

const PAGE_SIZE = 10;

function compactId(value: string) {
  const normalized = value.replace(/^demo-channel-/, '');
  if (normalized.length <= 9) return normalized;
  return normalized.slice(-9);
}

function getLiveUrl(row: LiveChannel, sessionId?: string | null) {
  const activeSessionId = row.liveSessionId ?? sessionId ?? null;
  if (!row.isOnline || !activeSessionId) return null;
  if (String(row.platform ?? 'SHOPEE').toUpperCase() === 'SHOPEE') {
    return `https://live.shopee.co.th/share?from=live&session=${encodeURIComponent(activeSessionId)}`;
  }
  return null;
}

function formatInt(value?: number | null) {
  return new Intl.NumberFormat('th-TH').format(Math.max(0, Math.round(Number(value) || 0)));
}

function formatMoney(value?: number | null) {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function formatDuration(seconds?: number | null) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function basename(value?: string | null) {
  const normalized = (value || '').trim();
  if (!normalized) return '';
  const clean = normalized.split('?')[0].split('#')[0];
  const name = clean.split(/[\\/]/).pop() || clean;
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function videoFileLabel(video?: VideoItem | null) {
  if (!video) return '-';
  return video.title?.trim() || basename(video.fileKey) || basename(video.sourceUrl) || '-';
}

function basketItemKey(item: Pick<ShopeeBasketItem, 'shop_id' | 'item_id'>) {
  return `${Number(item.shop_id) || 0}:${Number(item.item_id) || 0}`;
}

function detailKey(item: Pick<ShopeeProductDetail, 'shopId' | 'itemId'>) {
  return `${Number(item.shopId) || 0}:${Number(item.itemId) || 0}`;
}

function rankingKey(item: Pick<ShopeeScreenRankingItem, 'shopId' | 'itemId'>) {
  return `${Number(item.shopId) || 0}:${Number(item.itemId) || 0}`;
}

function LiveTimer({ startedAt, baseSeconds, online }: { startedAt?: string | null; baseSeconds?: number | null; online: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!online) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [online, startedAt]);

  const started = startedAt ? new Date(startedAt).getTime() : null;
  const seconds = online && started
    ? Math.max(0, Math.floor((now - started) / 1000))
    : Math.max(0, Math.floor(Number(baseSeconds) || 0));

  return <span>{formatDuration(seconds)}</span>;
}

function AccountRow({
  row,
  video,
  disabled,
  onCookieCopied,
  onEdit,
  onToggleStatus,
  onRemove,
}: {
  row: LiveChannel;
  video?: VideoItem | null;
  disabled?: boolean;
  onCookieCopied: () => void;
  onEdit: (row: LiveChannel) => Promise<void> | void;
  onToggleStatus: (id: string, isOnline: boolean) => Promise<void> | void;
  onRemove: (id: string) => Promise<void> | void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [startingLive, setStartingLive] = useState(false);
  const [optimisticStartedAt, setOptimisticStartedAt] = useState<string | null>(null);
  const [insights, setInsights] = useState<LiveChannelInsights | null>(null);
  const platform = String(row.platform ?? 'SHOPEE').toUpperCase();
  const stats = insights?.stats;
  const liveStartedAt = insights?.startedAt ?? optimisticStartedAt ?? null;
  const activeSessionId = row.liveSessionId ?? insights?.liveSessionId ?? null;
  const liveUrl = getLiveUrl(row, insights?.liveSessionId);
  const liveSessionLabel = row.isOnline ? (activeSessionId ?? '-') : '-';
  const currentVideoLabel = videoFileLabel(video);
  const status = startingLive ? 'STARTING' : row.isOnline ? 'LIVE' : 'NOTLIVE';

  useEffect(() => {
    if (!row.isOnline) {
      setOptimisticStartedAt(null);
      return;
    }
    if (!optimisticStartedAt && !insights?.startedAt) setOptimisticStartedAt(new Date().toISOString());
  }, [insights?.startedAt, optimisticStartedAt, row.isOnline]);

  useEffect(() => {
    let alive = true;
    async function loadInsights() {
      if (!row.isOnline && !row.liveSessionId) return;
      try {
        const next = await accountService.insights(row.id);
        if (alive) setInsights(next);
      } catch {
        if (alive) setInsights(null);
      }
    }
    void loadInsights();
    const timer = row.isOnline ? window.setInterval(loadInsights, 30000) : null;
    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
    };
  }, [row.id, row.isOnline, row.liveSessionId]);


  return (
    <article className="relative overflow-hidden rounded-[16px] border border-[#2b7fc7]/35 bg-[linear-gradient(145deg,rgba(7,25,47,.98),rgba(3,8,16,.99)_58%,rgba(8,18,34,.96))] shadow-[0_12px_30px_rgba(0,0,0,.20),inset_0_0_0_1px_rgba(74,163,232,.10),0_0_18px_rgba(11,121,255,.08)] transition hover:border-[#4aa3e8]/45 hover:bg-[linear-gradient(135deg,rgba(9,39,76,.98),rgba(4,10,20,.99)_58%,rgba(10,24,46,.96))] xl:overflow-visible xl:rounded-[12px]">
      <div className="grid items-center gap-3 p-4 text-[12px] font-semibold text-[#dce8f7] xl:min-h-[58px] xl:grid-cols-[28px_86px_minmax(160px,.9fr)_46px_minmax(145px,1fr)_70px_66px_70px_70px_58px_78px_82px_240px] xl:px-3 xl:py-2">
        <div className="absolute left-1/2 top-4 flex -translate-x-1/2 justify-center xl:static xl:translate-x-0">
          <span className={`h-5 w-5 rounded-full border ${row.isOnline ? 'border-sky-400/60 bg-sky-500/20' : 'border-[#c7962d]/20 bg-[#07111f]/60'}`} />
        </div>

        <div className="pt-8 font-black tabular-nums text-white xl:pt-0" title={row.id}>{compactId(row.id)}</div>

        <div className="min-w-0 border-l border-[#2da7ff]/24 pl-4 xl:border-[#2da7ff]/18">
          <div className="truncate text-[18px] font-black text-white xl:text-[13px]" title={row.accountName || row.name}>{row.accountName || row.name}</div>
        </div>

        <button
          type="button"
          disabled={!row.cookie}
          onClick={async () => {
            if (!row.cookie) return;
            await navigator.clipboard?.writeText(row.cookie);
            onCookieCopied();
          }}
          className="mx-auto grid h-11 w-12 place-items-center rounded-[12px] border border-[#2da7ff]/45 bg-[#071f3d] text-[#9ed7ff] transition hover:border-[#f2bd4b]/60 hover:text-[#ffd46c] disabled:cursor-not-allowed disabled:border-[#c7962d]/10 disabled:text-[#4c5868] xl:h-8 xl:w-9 xl:rounded-[8px]"
          title="คัดลอกคุกกี้"
        >
          <Copy size={15} />
        </button>

        <div className="min-w-0 rounded-[12px] border border-[#2b7fc7]/20 bg-black/15 px-3 py-2 xl:border-0 xl:bg-transparent xl:p-0">
          <div className="truncate text-[13px] text-white xl:text-[12px]" title={currentVideoLabel}>{currentVideoLabel}</div>
        </div>

        <div className="min-w-0 rounded-[12px] border border-[#2b7fc7]/22 bg-[#031021]/65 px-3 py-3 text-center xl:border-0 xl:bg-transparent xl:p-0">
          {liveUrl ? <a href={liveUrl} target="_blank" rel="noreferrer" className="block truncate text-[13px] font-black text-[#ffd46c] underline underline-offset-2">{liveSessionLabel}</a> : <span className="text-[#718199]">-</span>}
          <div className="mt-1 text-[10px] font-bold text-[#718199]">session</div>
        </div>

        <div className="w-[66px] text-center tabular-nums text-white"><LiveTimer startedAt={liveStartedAt} baseSeconds={stats?.liveSeconds} online={row.isOnline} /></div>
        <div className="grid grid-cols-3 gap-2 xl:contents">
          <div className="rounded-[10px] bg-black/18 py-2 text-center font-black tabular-nums text-[#ffd46c] xl:bg-transparent xl:py-0">{formatMoney(stats?.salesPerHour ?? stats?.gpm)}</div>
          <div className="rounded-[10px] bg-black/18 py-2 text-center font-black tabular-nums text-emerald-200 xl:bg-transparent xl:py-0">{formatMoney(stats?.totalSales)}</div>
          <div className="rounded-[10px] bg-black/18 py-2 text-center font-black tabular-nums text-white xl:bg-transparent xl:py-0">{formatInt(stats?.orders)}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:contents">
        <span className="inline-flex h-7 w-[78px] items-center justify-center gap-1.5 rounded-full border border-[#c7962d]/35 bg-[#f2bd4b]/10 px-3 text-[10px] font-black text-[#ffd46c]"><ShoppingBag size={12} /> {platform}</span>
        <AccountStatusBadge status={status} />
        </div>

        <div className="flex min-w-[240px] items-center justify-end gap-2 border-t border-[#2b7fc7]/24 pt-3 xl:border-l xl:border-t-0 xl:border-[#2da7ff]/18 xl:pl-4 xl:pt-0">
          <button
            type="button"
            disabled={disabled || startingLive}
            onClick={async () => {
              const nextOnline = !row.isOnline;
              if (nextOnline) {
                setStartingLive(true);
                setOptimisticStartedAt(new Date().toISOString());
              }
              try {
                await onToggleStatus(row.id, nextOnline);
              } catch (error) {
                if (nextOnline) setOptimisticStartedAt(null);
                throw error;
              } finally {
                if (nextOnline) setStartingLive(false);
              }
            }}
            className={`inline-flex h-8 w-[82px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] border px-2 text-[11px] font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${row.isOnline ? 'border-red-300/25 bg-red-400/10 text-red-100 hover:border-red-300/45' : 'border-[#2da7ff]/50 bg-[#0a2a55] text-[#d7efff] hover:border-[#f2bd4b]/65'}`}
            title={startingLive ? 'กำลังเริ่มไลฟ์' : row.isOnline ? 'หยุดไลฟ์' : 'ขึ้นไลฟ์'}
          >
            {startingLive ? <Loader2 size={13} className="animate-spin" /> : row.isOnline ? <StopCircle size={13} /> : <PlayCircle size={13} />}
            {startingLive ? 'กำลังเริ่ม' : row.isOnline ? 'หยุด' : 'ขึ้นไลฟ์'}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void onEdit(row)}
            className="inline-flex h-8 w-[58px] shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-[#c7962d]/35 bg-[#f2bd4b]/10 px-2 text-[11px] font-black text-[#ffd46c] transition hover:border-[#9f7a32]/45 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Pencil size={13} /> แก้ไข
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void onRemove(row.id)}
            className="inline-flex h-8 w-[48px] shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-red-300/20 bg-red-400/10 px-2 text-[11px] font-black text-red-100 transition hover:border-red-300/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={13} /> ลบ
          </button>
        </div>
      </div>
    </article>
  );
}

function ScreenRankingDialog({
  row,
  sessionId,
  onClose,
}: {
  row: LiveChannel;
  sessionId?: string | null;
  onClose: () => void;
}) {
  const [sessionInput, setSessionInput] = useState(sessionId ?? '');
  const [items, setItems] = useState<ShopeeBasketItem[]>([]);
  const [details, setDetails] = useState<Map<string, ShopeeProductDetail>>(() => new Map());
  const [rankings, setRankings] = useState<Map<string, ShopeeScreenRankingItem>>(() => new Map());
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedItems = useMemo(() => items
    .map((item) => ({
      ...item,
      shop_id: Number(item.shop_id) || 0,
      item_id: Number(item.item_id) || 0,
    }))
    .filter((item) => item.item_id > 0), [items]);

  const foundCount = useMemo(() => Array.from(rankings.values()).filter((item) => item.screenRank && item.screenRank <= 10).length, [rankings]);
  const uncheckedCount = useMemo(() => normalizedItems.filter((item) => !rankings.has(basketItemKey(item))).length, [normalizedItems, rankings]);

  async function loadSessionProducts(nextSession = sessionInput) {
    const targetSession = nextSession.trim();
    if (!targetSession) {
      setError('กรุณากรอก session หรือวางลิงก์ไลฟ์ก่อนเช็คอันดับจอ');
      return;
    }
    setLoading(true);
    setChecking(false);
    setError(null);
    setItems([]);
    setDetails(new Map());
    setRankings(new Map());
    try {
      const basket = await accountService.sessionItems(row.id, {
        sessionId: targetSession,
        liveUrl: targetSession,
        cookie: row.cookie ?? null,
      });
      const nextItems = (basket.items ?? []).slice(0, 200);
      setSessionInput(basket.sessionId || targetSession);
      setItems(nextItems);
      if (!nextItems.length) {
        setError('ไม่พบสินค้าใน session นี้');
        return;
      }
      await checkProducts(nextItems, basket.sessionId || targetSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดสินค้าใน session ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  async function checkProducts(sourceItems: ShopeeBasketItem[] = normalizedItems, targetSession = sessionInput) {
    const cleanItems = sourceItems
      .map((item) => ({
        ...item,
        shop_id: Number(item.shop_id) || 0,
        item_id: Number(item.item_id) || 0,
      }))
      .filter((item) => item.item_id > 0)
      .slice(0, 200);
    if (!cleanItems.length) {
      setError('ยังไม่มีรายการสินค้าให้เช็ค');
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const [detailResult, rankingResult] = await Promise.all([
        accountService.productDetails(row.id, {
          cookie: row.cookie ?? null,
          items: cleanItems,
        }),
        accountService.screenRankings(row.id, {
          cookie: row.cookie ?? null,
          items: cleanItems,
          productUrls: cleanItems.map((item) => String(item.url || '')).filter(Boolean),
        }),
      ]);

      setDetails(new Map((detailResult.items ?? []).map((item) => [detailKey(item), item])));
      setRankings(new Map((rankingResult.items ?? []).map((item) => [rankingKey(item), item])));
      if (rankingResult.sessionId && rankingResult.sessionId !== targetSession) setSessionInput(rankingResult.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เช็คอันดับจอไม่สำเร็จ');
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (sessionId) void loadSessionProducts(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id, sessionId]);

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/78 px-4 py-5 backdrop-blur-[7px]">
      <div className="flex max-h-[92vh] w-full max-w-[1540px] flex-col overflow-hidden rounded-[18px] border border-[#c7962d]/55 bg-[radial-gradient(circle_at_8%_0%,rgba(45,167,255,.20),transparent_28%),radial-gradient(circle_at_92%_0%,rgba(242,189,75,.14),transparent_30%),linear-gradient(135deg,#061323_0%,#03070d_58%,#150f05_100%)] text-white shadow-[0_32px_110px_rgba(0,0,0,.70),0_0_34px_rgba(45,167,255,.10),inset_0_1px_0_rgba(255,255,255,.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#c7962d]/24 bg-[linear-gradient(90deg,rgba(8,33,61,.86),rgba(16,11,5,.72))] px-5 py-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[12px] font-black uppercase tracking-[.16em] text-[#ffd46c]">
              <BarChart3 size={15} /> Screen Ranking
            </div>
            <h3 className="mt-1 text-[24px] font-black text-white">เช็คอันดับจอ</h3>
            <p className="mt-1 text-[12px] font-bold text-[#9fb1c9]">บัญชี {row.accountName || row.name} • ดึงสินค้าในไลฟ์จาก session แล้วเช็คว่าแต่ละสินค้าติดอันดับ 1-10 หรือไม่</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-[12px] border border-[#c7962d]/35 bg-black/[0.25] text-[#d8c8a1] transition hover:border-[#ffd46c] hover:text-[#ffd46c]"
            aria-label="ปิด"
          >
            <X size={20} />
          </button>
        </div>

        <div className="border-b border-[#2b7fc7]/28 px-5 py-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(360px,1fr)_auto_auto] xl:items-end">
            <label className="block">
              <span className="mb-2 block text-[12px] font-black text-[#bfe7ff]">Session หรือ Live URL</span>
              <input
                value={sessionInput}
                onChange={(event) => setSessionInput(event.target.value)}
                placeholder="เช่น 27648536 หรือ https://live.shopee.co.th/share?...session=27648536"
                className="h-11 w-full rounded-[10px] border border-[#2da7ff]/35 bg-[#030912]/80 px-4 text-[13px] font-bold text-white outline-none placeholder:text-[#718199] focus:border-[#f2bd4b]/70 focus:shadow-[0_0_0_3px_rgba(242,189,75,.12)]"
              />
            </label>
            <button
              type="button"
              disabled={loading || checking}
              onClick={() => void loadSessionProducts()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[#2da7ff]/45 bg-[#0a4fa3] px-5 text-[13px] font-black text-white transition hover:border-[#9ed7ff] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} โหลดสินค้าและเช็ค
            </button>
            <button
              type="button"
              disabled={checking || loading || normalizedItems.length === 0}
              onClick={() => void checkProducts()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[#c7962d]/35 bg-[#f2bd4b] px-5 text-[13px] font-black text-[#160f04] transition hover:bg-[#ffd46c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {checking ? <Loader2 size={16} className="animate-spin" /> : <BarChart3 size={16} />} รีเช็คอันดับ
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-[10px] border border-red-300/28 bg-red-500/12 px-4 py-3 text-[13px] font-bold text-red-100">
              {error}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-[10px] border border-[#2da7ff]/22 bg-black/22 px-4 py-3">
              <div className="text-[11px] font-black text-[#9fb1c9]">สินค้าทั้งหมด</div>
              <div className="mt-1 text-[24px] font-black text-white">{formatInt(normalizedItems.length)}</div>
            </div>
            <div className="rounded-[10px] border border-[#20c997]/24 bg-emerald-500/8 px-4 py-3">
              <div className="text-[11px] font-black text-emerald-100">ติดอันดับ 1-10</div>
              <div className="mt-1 text-[24px] font-black text-emerald-100">{formatInt(foundCount)}</div>
            </div>
            <div className="rounded-[10px] border border-[#c7962d]/24 bg-[#f2bd4b]/8 px-4 py-3">
              <div className="text-[11px] font-black text-[#ffd46c]">ยังไม่ได้เช็ค</div>
              <div className="mt-1 text-[24px] font-black text-[#ffd46c]">{formatInt(uncheckedCount)}</div>
            </div>
            <div className="rounded-[10px] border border-[#2da7ff]/22 bg-black/22 px-4 py-3">
              <div className="text-[11px] font-black text-[#9fb1c9]">สถานะ</div>
              <div className="mt-1 text-[15px] font-black text-white">{loading ? 'กำลังโหลดสินค้า' : checking ? 'กำลังเช็คอันดับ' : 'พร้อมใช้งาน'}</div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {loading && normalizedItems.length === 0 ? (
            <div className="grid min-h-[340px] place-items-center rounded-[14px] border border-[#2b7fc7]/28 bg-black/24 text-[14px] font-black text-[#bfe7ff]">
              <span className="inline-flex items-center gap-2"><Loader2 size={18} className="animate-spin" /> กำลังดึงสินค้าในไลฟ์...</span>
            </div>
          ) : normalizedItems.length === 0 ? (
            <div className="grid min-h-[340px] place-items-center rounded-[14px] border border-dashed border-[#c7962d]/28 bg-black/24 text-center text-[13px] font-bold text-[#9fb1c9]">
              กรอก session หรือวางลิงก์ไลฟ์ แล้วกดโหลดสินค้าและเช็ค
            </div>
          ) : (
            <div className="overflow-hidden rounded-[14px] border border-[#2b7fc7]/35 bg-[#030912]/72">
              <div className="grid min-w-[1180px] grid-cols-[54px_74px_minmax(260px,1.6fr)_minmax(190px,1fr)_104px_90px_96px_88px_110px] items-center gap-3 border-b border-[#2b7fc7]/35 bg-[#06182e] px-4 py-3 text-[11px] font-black text-[#ffd46c]">
                <span>ลำดับ</span>
                <span>รูป</span>
                <span>สินค้า</span>
                <span>ลิงก์</span>
                <span>อันดับจอ</span>
                <span>คลัง</span>
                <span>ราคาขาย</span>
                <span>ขาย</span>
                <span>สถานะ</span>
              </div>
              <div className="max-h-[52vh] min-w-[1180px] overflow-auto">
                {normalizedItems.map((item, index) => {
                  const key = basketItemKey(item);
                  const detail = details.get(key);
                  const ranking = rankings.get(key);
                  const image = detail?.imageUrl || detail?.image || ranking?.previewImage || '';
                  const title = detail?.name || `สินค้า ${item.item_id}`;
                  const productUrl = detail?.url || item.url || `https://shopee.co.th/product/${item.shop_id || 0}/${item.item_id}`;
                  const rankText = ranking?.error ? 'เช็กไม่ได้' : ranking?.screenRank ? `อันดับ ${ranking.screenRank}` : ranking ? 'ไม่ติดจอ' : '-';
                  const rankClass = ranking?.error
                    ? 'border-red-300/25 bg-red-500/12 text-red-100'
                    : ranking?.screenRank
                      ? 'border-emerald-300/30 bg-emerald-500/12 text-emerald-100'
                      : ranking
                        ? 'border-[#c7962d]/25 bg-[#f2bd4b]/10 text-[#ffd46c]'
                        : 'border-[#2da7ff]/20 bg-black/24 text-[#9fb1c9]';
                  return (
                    <div key={`${key}:${index}`} className="grid grid-cols-[54px_74px_minmax(260px,1.6fr)_minmax(190px,1fr)_104px_90px_96px_88px_110px] items-center gap-3 border-b border-[#c7962d]/12 px-4 py-3 text-[12px] font-bold text-[#dce8f7] last:border-b-0">
                      <div className="font-black tabular-nums text-[#ffd46c]">{index + 1}</div>
                      <div className="h-14 w-14 overflow-hidden rounded-[10px] border border-[#c7962d]/25 bg-black/30">
                        {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[#718199]"><ShoppingBag size={18} /></div>}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-black text-white" title={title}>{title}</div>
                        <div className="mt-1 text-[10px] text-[#718199]">shop {item.shop_id || '-'} • item {item.item_id}</div>
                        {ranking?.error ? <div className="mt-1 truncate text-[10px] text-red-100" title={ranking.error}>{ranking.error}</div> : null}
                      </div>
                      <a href={productUrl} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-2 text-[#9ed7ff] hover:text-[#ffd46c]">
                        <ExternalLink size={13} />
                        <span className="truncate">{productUrl}</span>
                      </a>
                      <span className={`inline-flex h-8 items-center justify-center rounded-full border px-3 text-[11px] font-black ${rankClass}`}>{rankText}</span>
                      <span className="tabular-nums text-white">{detail?.stock == null ? '-' : formatInt(detail.stock)}</span>
                      <span className="tabular-nums text-[#ffd46c]">{detail ? formatMoney(detail.price ?? detail.priceMin ?? 0) : '-'}</span>
                      <span className="tabular-nums text-white">{detail?.sold == null ? '-' : formatInt(detail.sold)}</span>
                      <span className="text-[#9fb1c9]">{ranking ? `${ranking.sessionCount || 0} live` : checking ? 'กำลังเช็ค' : '-'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AccountTable({
  rows,
  proxies,
  query,
  loading = false,
  saving = false,
  videos = [],
  onQueryChange,
  onEdit,
  onToggleStatus,
  onRemove,
}: AccountTableProps) {
  const [page, setPage] = useState(1);
  const [pendingDeleteAccount, setPendingDeleteAccount] = useState<LiveChannel | null>(null);
  const [rankingTarget, setRankingTarget] = useState<{ row: LiveChannel; sessionId?: string | null } | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const copyToastTimer = useRef<number | null>(null);
  const proxyMap = useMemo(
    () => new Map(proxies.map((proxy) => [proxy.id, `${proxy.host}:${proxy.port}`])),
    [proxies],
  );
  const videoByChannel = useMemo(() => {
    const map = new Map<string, VideoItem>();
    videos.forEach((video) => {
      if (video.liveChannelId && !map.has(video.liveChannelId)) map.set(video.liveChannelId, video);
    });
    return map;
  }, [videos]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function showCopyToast() {
    setCopyToast('คัดลอกคุกกี้แล้ว');
    if (copyToastTimer.current) window.clearTimeout(copyToastTimer.current);
    copyToastTimer.current = window.setTimeout(() => setCopyToast(null), 1600);
  }

  useEffect(() => {
    return () => {
      if (copyToastTimer.current) window.clearTimeout(copyToastTimer.current);
    };
  }, []);

  return (
    <section className="mt-4 rounded-[18px] border border-[#2b7fc7]/30 bg-[radial-gradient(circle_at_5%_0%,rgba(45,167,255,.18),transparent_30%),linear-gradient(145deg,rgba(6,19,35,.97),rgba(3,7,13,.99)_58%,rgba(5,16,31,.96))] p-3 shadow-[0_20px_56px_rgba(0,0,0,.36),inset_0_0_0_1px_rgba(74,163,232,.07),0_0_22px_rgba(11,121,255,.06)] sm:rounded-[16px]">
      {copyToast ? (
        <div className="pointer-events-none fixed inset-0 z-[70] grid place-items-center bg-black/45 px-4 backdrop-blur-[6px]">
          <div className="w-full max-w-[460px] overflow-hidden rounded-[20px] border border-[#c7962d]/60 bg-[radial-gradient(circle_at_10%_0%,rgba(45,167,255,.25),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(242,189,75,.20),transparent_34%),linear-gradient(135deg,#07111f_0%,#05070b_58%,#171004_100%)] p-6 text-center text-white shadow-[0_32px_100px_rgba(0,0,0,.62),0_0_38px_rgba(45,167,255,.14),inset_0_1px_0_rgba(255,255,255,.08)]">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-[14px] border border-[#2da7ff]/45 bg-[#071f3d] text-[#9ed7ff] shadow-[0_0_22px_rgba(45,167,255,.18)]">
              <Copy size={20} />
            </div>
            <div className="text-[22px] font-black text-white drop-shadow-[0_2px_12px_rgba(45,167,255,.16)]">
              {copyToast}
            </div>
          </div>
        </div>
      ) : null}
      {rankingTarget ? (
        <ScreenRankingDialog
          row={rankingTarget.row}
          sessionId={rankingTarget.sessionId ?? rankingTarget.row.liveSessionId ?? null}
          onClose={() => setRankingTarget(null)}
        />
      ) : null}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-black text-[#9fb1c9]">
          <span className="inline-flex h-8 items-center gap-2 rounded-full border border-[#c7962d]/36 bg-[#07111f]/85 px-3">
            <Tv size={14} className="text-[#ffd46c]" /> ทั้งหมด {rows.length} บัญชี
          </span>
          <span className="hidden h-8 items-center gap-2 rounded-full border border-[#c7962d]/36 bg-[#07111f]/85 px-3 sm:inline-flex">
            <Video size={14} className="text-[#ffd46c]" /> จัดการได้จากแถวบัญชีทันที
          </span>
        </div>

        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <button
            type="button"
            disabled={pageRows.length === 0}
            onClick={() => {
              const target = pageRows.find((item) => item.isOnline) ?? pageRows[0] ?? null;
              if (target) setRankingTarget({ row: target, sessionId: target.liveSessionId ?? null });
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-[#2da7ff]/45 bg-[#071f3d] px-4 text-[12px] font-black text-[#9ed7ff] transition hover:border-[#f2bd4b]/60 hover:text-[#ffd46c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <BarChart3 size={15} /> ดึงอันดับจอ
          </button>
          <label className="relative w-full sm:w-[340px] sm:max-w-full">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#718199]" size={15} />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              className="h-10 w-full rounded-[10px] border border-[#c7962d]/34 bg-[#030912]/75 pl-10 pr-3 text-[12px] text-white outline-none placeholder:text-[#718199] focus:border-[#2da7ff]/70 focus:shadow-[0_0_0_3px_rgba(45,167,255,.14)]"
              placeholder="ค้นหาชื่อบัญชี, ประเภท, สถานะ..."
            />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="grid min-h-[180px] place-items-center rounded-[12px] border border-[#c7962d]/14 bg-black/[0.35] text-[13px] font-bold text-[#9fb1c9]">
          <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> กำลังโหลดบัญชี...</span>
        </div>
      ) : pageRows.length === 0 ? (
        <div className="grid min-h-[180px] place-items-center rounded-[12px] border border-dashed border-[#c7962d]/25 bg-black/[0.35] text-center text-[13px] font-bold text-[#9fb1c9]">
          ยังไม่มีบัญชี กดเพิ่มบัญชีเพื่อเริ่มใช้งาน
        </div>
      ) : (
        <div className="overflow-visible rounded-[14px] border border-[#2b7fc7]/35 bg-[linear-gradient(135deg,rgba(4,15,29,.94),rgba(3,6,12,.97)_62%,rgba(4,15,30,.94))] shadow-[0_18px_45px_rgba(0,0,0,.24),inset_0_0_0_1px_rgba(74,163,232,.08)]">
          <div className="hidden min-h-11 items-center gap-3 border-b border-[#2b7fc7]/35 bg-[linear-gradient(90deg,rgba(5,23,45,.86),rgba(3,10,20,.80))] px-3 text-[11px] font-black text-[#bfe7ff] xl:grid xl:grid-cols-[28px_86px_minmax(160px,.9fr)_46px_minmax(145px,1fr)_70px_66px_70px_70px_58px_78px_82px_240px]">
            <span />
            <span>ไอดี</span>
            <span className="border-l border-[#2da7ff]/18 pl-4">ชื่อบัญชี</span>
            <span className="text-center">คุกกี้</span>
            <span>ชื่อไฟล์</span>
            <span>ลิงก์ไลฟ์</span>
            <span>เวลาไลฟ์</span>
            <span>ยอดขาย/ชม.</span>
            <span>ยอดขาย</span>
            <span>ออเดอร์</span>
            <span>ประเภท</span>
            <span>สถานะ</span>
            <span className="text-center">จัดการ</span>
          </div>
          <div className="grid gap-2 p-2">
            {pageRows.map((row) => (
              <AccountRow
                key={row.id}
                row={row}
                video={videoByChannel.get(row.id) ?? null}
                disabled={saving}
                onCookieCopied={showCopyToast}
                onEdit={onEdit}
                onToggleStatus={onToggleStatus}
                onRemove={(id) => { const target = rows.find((item) => item.id === id) ?? null; setPendingDeleteAccount(target); }}
              />
            ))}
          </div>
        </div>
      )}


      {pendingDeleteAccount ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/78 px-4 backdrop-blur-[5px]">
          <div className="relative w-full max-w-[460px] overflow-hidden rounded-[20px] border border-[#c7962d]/60 bg-[radial-gradient(circle_at_8%_0%,rgba(45,167,255,.24),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(242,189,75,.18),transparent_32%),linear-gradient(135deg,#07111f_0%,#05070b_54%,#171004_100%)] p-6 text-white shadow-[0_32px_100px_rgba(0,0,0,.62),0_0_38px_rgba(45,167,255,.10),inset_0_1px_0_rgba(255,255,255,.08)]">
            <button
              type="button"
              onClick={() => setPendingDeleteAccount(null)}
              disabled={saving}
              className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-[12px] border border-[#c7962d]/35 bg-black/[0.25] text-[#d8c8a1] transition hover:border-[#ffd46c] hover:text-[#ffd46c] disabled:opacity-50"
              aria-label="ปิด"
            >
              <X size={20} />
            </button>

            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#ff766f]/35 bg-[#3a0d11]/60 text-[#ffaaa1] shadow-[0_0_20px_rgba(255,118,111,.12)]">
              <Trash2 size={20} />
            </div>
            <h3 className="pr-12 text-[24px] font-black text-white drop-shadow-[0_2px_12px_rgba(45,167,255,.16)]">ลบบัญชีนี้ใช่ไหม?</h3>
            <p className="mt-2 text-[13px] font-semibold leading-6 text-[#9fb1c9]">บัญชี <span className="font-black text-[#ffd46c]">{pendingDeleteAccount.accountName || pendingDeleteAccount.name}</span> จะถูกลบออกจากระบบ</p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDeleteAccount(null)}
                disabled={saving}
                className="h-10 rounded-[10px] border border-[#c7962d]/30 bg-black/[0.28] px-5 text-[13px] font-black text-[#d8c8a1] transition hover:border-[#2da7ff]/60 hover:text-white disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!pendingDeleteAccount) return;
                  await onRemove(pendingDeleteAccount.id);
                  setPendingDeleteAccount(null);
                }}
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#ff766f]/35 bg-[#3a0d11]/80 px-5 text-[13px] font-black text-[#ffaaa1] transition hover:border-[#ffaaa1] hover:bg-[#4a1116] disabled:opacity-50"
              >
                <Trash2 size={15} /> ลบบัญชี
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-3 text-[12px] font-black text-white">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="h-8 min-w-10 rounded-[7px] bg-[#07111f]/60 px-3 transition enabled:hover:bg-[#0b2a52] disabled:cursor-not-allowed disabled:text-[#4c5868]"
          >
            ‹
          </button>
          <span className="grid h-9 min-w-10 place-items-center rounded-[8px] border border-[#2da7ff]/45 bg-[#08264f] px-3">{page}</span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages}
            className="h-8 min-w-10 rounded-[7px] bg-[#07111f]/60 px-3 transition enabled:hover:bg-[#0b2a52] disabled:cursor-not-allowed disabled:text-[#4c5868]"
          >
            ›
          </button>
        </div>
      ) : null}
    </section>
  );
}






