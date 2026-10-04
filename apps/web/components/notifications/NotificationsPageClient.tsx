'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BellRing, Check, Loader2, X } from 'lucide-react';
import { notificationService } from '@/services/notification.service';
import { API_BASE_URL } from '@/lib/constants';
import type { NotificationItem } from '@/types/notification';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function tone(type: string) {
  if (type === 'ERROR') return 'border-[#a51f28] bg-[#2b0d10] text-[#ffbbb5]';
  if (type === 'WARNING') return 'border-[#d49c32] bg-[#181305] text-[#ffd37c]';
  if (type === 'SUCCESS') return 'border-[#2d8b55] bg-[#0b2917] text-[#9df0bd]';
  return 'border-[#4b3615] bg-[#10100f] text-[#f7f1e7]';
}

const defaultNoticeStyle = {
  cardBg: '',
  titleColor: '#ffffff',
  textColor: '#d8d0c3',
  textBg: 'transparent',
  buttonBg: '#e3aa3a',
  buttonColor: '#120d05',
  titleSize: 20,
  textSize: 14,
  bannerLayout: 'hero_strip',
  bannerImages: [] as string[],
};

type BannerLayout = 'hero_strip' | 'hero_wide' | 'duo_feature' | 'trio_story' | 'quad_showcase' | 'five_editorial' | 'six_magazine';

const localReadKey = 'np-live-notification-read-ids';
const hiddenKey = 'np-live-notification-hidden-ids';

function readStoredIds(key: string) {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeStoredIds(key: string, ids: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(Array.from(new Set(ids))));
}

function parseStyle(value?: string | null) {
  if (!value) return defaultNoticeStyle;
  try {
    return { ...defaultNoticeStyle, ...JSON.parse(value) };
  } catch {
    return defaultNoticeStyle;
  }
}

function mediaUrl(value?: string | null) {
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('/uploads/')) return `${API_BASE_URL}${value}`;
  return value;
}

function bannerImagesFor(item: NotificationItem, style: typeof defaultNoticeStyle) {
  const images = Array.isArray(style.bannerImages) ? style.bannerImages.filter(Boolean).map((value) => mediaUrl(value)) : [];
  if (images.length > 0) return images;
  const legacyImage = mediaUrl(item.imageUrl);
  return legacyImage ? [legacyImage] : [];
}

function collectImages(items: NotificationItem[]) {
  const urls = items.flatMap((item) => bannerImagesFor(item, parseStyle(item.styleJson)));
  return Array.from(new Set(urls.filter(Boolean)));
}

function preloadImages(urls: string[]) {
  if (typeof window === 'undefined') return;
  urls.slice(0, 12).forEach((url) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);

    const image = new Image();
    image.decoding = 'async';
    image.src = url;
  });
}

function BannerCell({ image, className = '', priority = false }: { image?: string; className?: string; priority?: boolean }) {
  return (
    <div className={`min-h-0 overflow-hidden rounded-[10px] bg-[#070707] ${className}`}>
      {image ? (
        <img
          src={image}
          alt=""
          className="h-full w-full object-cover"
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          loading={priority ? 'eager' : 'lazy'}
        />
      ) : null}
    </div>
  );
}

function BannerScene({ layout, images }: { layout: BannerLayout; images: string[] }) {
  if (layout === 'hero_wide' || images.length <= 1) {
    return <BannerCell image={images[0]} className="h-full" priority />;
  }
  if (layout === 'duo_feature') {
    return (
      <div className="grid h-full grid-cols-[1.7fr_.75fr] gap-2">
        <BannerCell image={images[0]} className="rounded-[12px]" priority />
        <BannerCell image={images[1]} className="rounded-[12px]" priority />
      </div>
    );
  }
  if (layout === 'trio_story') {
    return (
      <div className="grid h-full grid-cols-[1.5fr_.95fr] gap-2">
        <BannerCell image={images[0]} className="row-span-2 rounded-[12px]" priority />
        <div className="grid gap-2">
          <BannerCell image={images[1]} className="rounded-[12px]" priority />
          <BannerCell image={images[2]} className="rounded-[12px]" />
        </div>
      </div>
    );
  }
  if (layout === 'quad_showcase') {
    return (
      <div className="grid h-full grid-cols-[1.55fr_.85fr] gap-2">
        <BannerCell image={images[0]} className="rounded-[12px]" priority />
        <div className="grid gap-2">
          <BannerCell image={images[1]} className="rounded-[12px]" priority />
          <BannerCell image={images[2]} className="rounded-[12px]" />
          <BannerCell image={images[3]} className="rounded-[12px]" />
        </div>
      </div>
    );
  }
  if (layout === 'five_editorial') {
    return (
      <div className="grid h-full grid-cols-[.75fr_1.35fr_.75fr] grid-rows-2 gap-2">
        <BannerCell image={images[1]} className="rounded-[12px]" />
        <BannerCell image={images[0]} className="row-span-2 rounded-[12px]" priority />
        <BannerCell image={images[2]} className="rounded-[12px]" />
        <BannerCell image={images[3]} className="rounded-[12px]" />
        <BannerCell image={images[4]} className="rounded-[12px]" />
      </div>
    );
  }
  if (layout === 'six_magazine') {
    return (
    <div className="grid h-full grid-cols-[1.45fr_1fr] gap-2">
      <BannerCell image={images[0]} className="row-span-2 rounded-[12px]" priority />
      <div className="grid grid-cols-2 grid-rows-3 gap-2">
          {[1, 2, 3, 4, 5].map((index) => (
            <BannerCell key={index} image={images[index]} className={index === 5 ? 'col-span-2 rounded-[12px]' : 'rounded-[12px]'} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="grid h-full grid-rows-[2.9fr_1fr] gap-2">
      <BannerCell image={images[0]} className="rounded-[12px]" priority />
      <div className="grid grid-cols-3 gap-2">
        <BannerCell image={images[1]} priority />
        <BannerCell image={images[2]} />
        <BannerCell image={images[3]} />
      </div>
    </div>
  );
}

function EmptyBanner() {
  return (
    <div className="rounded-[12px] border border-dashed border-[#6e4d18] bg-[#10100f] p-6">
      <div className="grid min-h-[220px] place-items-center rounded-[10px] border border-[#2b2113] bg-[linear-gradient(135deg,#15110a,#070707_55%,#17110a)] px-6 text-center">
        <div>
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-[10px] border border-[#6e4d18] bg-[#181305] text-[#e3aa3a]">
            <BellRing size={22} />
          </div>
          <p className="text-lg font-black text-white">ยังไม่มีแบนเนอร์ข่าวสาร</p>
          <p className="mt-2 text-sm font-semibold text-[#9f978c]">
            ถ้าแอดมินเพิ่มรูปประกาศ ระบบจะแสดงเป็นแบนเนอร์ใหญ่ตรงนี้
          </p>
        </div>
      </div>
    </div>
  );
}

export function NotificationsPageClient() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [localReadIds, setLocalReadIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [closedIds, setClosedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const nextItems = await notificationService.list();
      preloadImages(collectImages(nextItems));
      setItems(nextItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดข่าวสารไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLocalReadIds(readStoredIds(localReadKey));
    setHiddenIds(readStoredIds(hiddenKey));
    void load();
  }, []);

  const visibleItems = useMemo(
    () => items.filter((item) => !hiddenIds.includes(item.id) && !closedIds.includes(item.id)),
    [closedIds, hiddenIds, items],
  );

  useEffect(() => {
    preloadImages(collectImages(visibleItems));
  }, [visibleItems]);
  async function markRead(item: NotificationItem) {
    setSavingId(item.id);
    setError(null);
    const nextReadIds = [...localReadIds, item.id];
    setLocalReadIds(nextReadIds);
    writeStoredIds(localReadKey, nextReadIds);
    try {
      if (item.userId) await notificationService.markRead(item.id, true);
      setItems((prev) => prev.map((row) => row.id === item.id ? { ...row, isRead: true } : row));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อัปเดตข่าวสารไม่สำเร็จ');
    } finally {
      setSavingId(null);
    }
  }

  async function hideForever(item: NotificationItem) {
    const nextHiddenIds = [...hiddenIds, item.id];
    const nextReadIds = [...localReadIds, item.id];
    setHiddenIds(nextHiddenIds);
    setLocalReadIds(nextReadIds);
    writeStoredIds(hiddenKey, nextHiddenIds);
    writeStoredIds(localReadKey, nextReadIds);
    if (item.userId) await markRead(item);
  }

  function closeForNow(item: NotificationItem) {
    setClosedIds((prev) => [...prev, item.id]);
  }

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-[10px] border border-[#a51f28] bg-[#3b0d11] px-4 py-3 text-sm font-bold text-[#ffbbb5]">{error}</div> : null}

      <main className="space-y-4">

          {loading ? (
            <div className="rounded-[12px] border border-[#4b3615] bg-[#10100f] p-8 text-center text-[#9f978c]">
              <Loader2 className="mx-auto mb-2 animate-spin text-[#e3aa3a]" />
              กำลังโหลด...
            </div>
          ) : null}

          {!loading && visibleItems.length === 0 ? <EmptyBanner /> : null}

          {!loading && visibleItems.map((item) => {
            const style = parseStyle(item.styleJson);
            const isRead = item.isRead || localReadIds.includes(item.id);
            const bannerImages = bannerImagesFor(item, style);
            const hasBanner = bannerImages.length > 0;
            const bannerLayout = (style.bannerLayout || 'hero_strip') as BannerLayout;
            return (
              <article
                key={item.id}
                className={`relative overflow-hidden rounded-[12px] border ${hasBanner ? 'h-[calc(100vh-72px)] min-h-[520px] border-[#4b3615] bg-[#10100f]' : tone(item.type)}`}
              >
                {!hasBanner ? (
                  <button
                    type="button"
                    onClick={() => closeForNow(item)}
                    className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur hover:bg-black/70"
                    aria-label="ปิดข่าวสาร"
                  >
                    <X size={15} />
                  </button>
                ) : null}

                {hasBanner ? (
                  <div className="h-full min-h-0 bg-[#070707] p-2">
                    <BannerScene layout={bannerLayout} images={bannerImages} />
                  </div>
                ) : (
                  <div className="p-5">
                    <div className="rounded-[10px] p-4" style={{ backgroundColor: style.textBg }}>
                      <h3 className="font-black" style={{ color: style.titleColor, fontSize: style.titleSize }}>{item.title}</h3>
                      <p className="mt-2 whitespace-pre-wrap font-semibold leading-6" style={{ color: style.textColor, fontSize: style.textSize }}>{item.message}</p>
                    </div>
                  </div>
                )}

                {!hasBanner ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#2b2113] bg-[#0b0a08] px-4 py-3">
                    <div className="min-w-0">
                      <p className="mt-1 text-xs font-bold text-[#8f8578]">{formatDate(item.createdAt)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => void hideForever(item)} className="inline-flex h-9 items-center justify-center rounded-[8px] border border-[#5b4219] bg-[#15130f] px-3 text-xs font-black text-[#f7f1e7] hover:border-[#e3aa3a]">
                        ไม่แสดงอีก
                      </button>
                      {item.ctaLabel ? (
                        <Link href={item.ctaUrl || '/packages'} className="inline-flex h-9 items-center rounded-[8px] px-3 text-xs font-black" style={{ backgroundColor: style.buttonBg, color: style.buttonColor }}>
                          {item.ctaLabel}
                        </Link>
                      ) : null}
                      {!isRead ? (
                        <button onClick={() => void markRead(item)} disabled={savingId === item.id} className="inline-flex h-9 min-w-[92px] items-center justify-center gap-2 rounded-[8px] border border-[#5b4219] bg-[#15130f] px-3 text-xs font-black text-[#f7f1e7] disabled:opacity-50">
                          {savingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          รับทราบ
                        </button>
                      ) : <span className="inline-flex h-9 min-w-[92px] items-center justify-center rounded-[8px] border border-[#2d8b55] bg-[#0b2917] px-3 text-xs font-black text-[#9df0bd]">รับทราบแล้ว</span>}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
      </main>
    </div>
  );
}



