'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { useDashboard } from '@/hooks/useDashboard';
import { notificationService } from '@/services/notification.service';
import type { NotificationItem } from '@/types/notification';

const defaultNoticeStyle = {
  cardBg: '#0b0b0a',
  titleColor: '#ffffff',
  textColor: '#d8d0c3',
  textBg: 'transparent',
  buttonBg: '#e3aa3a',
  buttonColor: '#120d05',
  titleSize: 22,
  textSize: 14,
  radius: 14,
  cardWidth: 520,
  imageOnly: false,
  displayMode: 'CARD',
  noticeMode: 'card',
  bannerLayout: 'hero_strip',
  bannerImages: [] as string[],
  previewScale: 100,
};

type NoticeStyle = typeof defaultNoticeStyle;

function parseStyle(value?: string | null): NoticeStyle {
  if (!value) return defaultNoticeStyle;
  try {
    return { ...defaultNoticeStyle, ...JSON.parse(value) };
  } catch {
    return defaultNoticeStyle;
  }
}

function isBannerNotice(item: NotificationItem) {
  const style = parseStyle(item.styleJson);
  const bannerImages = Array.isArray(style.bannerImages) ? style.bannerImages.filter(Boolean) : [];
  return item.title.includes('แบนเนอร์') || style.noticeMode === 'banner' || style.displayMode === 'BANNER' || bannerImages.length > 0;
}

function DashboardNoticeModal({ item, onClose, onHideForever }: { item: NotificationItem; onClose: (id: string) => void; onHideForever: (id: string) => void }) {
  const style = parseStyle(item.styleJson);
  const imageOnly = style.displayMode === 'IMAGE' || Boolean(style.imageOnly);
  const displayScale = Math.max(55, Math.min(140, Number(style.previewScale || 100)));

  function closeForNow() {
    onClose(item.id);
  }

  async function hideForever() {
    await notificationService.markRead(item.id).catch(() => undefined);
    onHideForever(item.id);
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-hidden bg-black/55 p-4">
      <section
        className={`relative max-h-[88vh] rounded-[12px] ${imageOnly ? 'border border-transparent bg-transparent p-0 shadow-none' : 'border border-[#5b4219] bg-[#0b0b0a]/96 p-4 shadow-[0_24px_80px_rgba(0,0,0,.55)]'}`}
        style={{ width: imageOnly ? 'auto' : style.cardWidth + 32, maxWidth: 'calc(100vw - 32px)', transform: `scale(${displayScale / 100})`, transformOrigin: 'center' }}
        role="dialog"
        aria-modal="true"
      >
        <div className={`relative overflow-hidden ${imageOnly ? 'border border-transparent shadow-none' : 'border border-black/10 shadow-xl'}`} style={{ backgroundColor: imageOnly ? 'transparent' : style.cardBg, borderRadius: style.radius }}>
          <button type="button" onClick={closeForNow} className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-full border border-black/10 bg-black/45 text-white" aria-label="ปิดแจ้งเตือน">
            <X size={15} />
          </button>

          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.title} className="mx-auto max-h-[520px] w-auto max-w-full object-contain" />
          ) : imageOnly ? (
            <div className="grid h-36 place-items-center bg-[#efe5d2] text-sm font-black text-[#8a7651]">ยังไม่ได้เลือกรูป</div>
          ) : null}

          {imageOnly ? (
            <button type="button" onClick={() => void hideForever()} className="absolute bottom-3 right-3 z-20 inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-black/15 bg-black/55 px-3 text-[12px] font-black text-white shadow-sm">
              <span className="h-4 w-4 rounded-[3px] border border-white/80 bg-white/10" />
              ไม่แสดงอีก
            </button>
          ) : null}

          {!imageOnly ? (
            <div className="p-5">
              <div className="mb-2 text-[11px] font-black text-[#d84930]">NP LIVE</div>
              <div className="rounded-[8px] p-3" style={{ backgroundColor: style.textBg }}>
                <h3 className="font-black" style={{ color: style.titleColor, fontSize: style.titleSize }}>{item.title}</h3>
                <p className="mt-2 whitespace-pre-wrap font-semibold leading-6" style={{ color: style.textColor, fontSize: style.textSize }}>{item.message}</p>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <button type="button" onClick={() => void hideForever()} className="inline-flex h-10 min-w-[116px] items-center justify-center gap-2 rounded-[8px] border border-[#5b4219] bg-[#15130f] px-4 text-[13px] font-black text-[#f7f1e7] shadow-sm">
                  <span className="h-4 w-4 rounded-[3px] border border-[#f7f1e7]/70 bg-white/10" />
                  ไม่แสดงอีก
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  {item.ctaLabel ? (
                    <Link href={item.ctaUrl || '/packages'} onClick={closeForNow} className="inline-flex h-10 items-center justify-center rounded-[8px] px-4 text-[13px] font-black" style={{ backgroundColor: style.buttonBg, color: style.buttonColor }}>
                      {item.ctaLabel}
                    </Link>
                  ) : null}
                  <button type="button" onClick={closeForNow} className="inline-flex h-10 min-w-[116px] items-center justify-center gap-2 rounded-[8px] border border-[#5b4219] bg-[#15130f] px-4 text-[13px] font-black text-[#f7f1e7]">
                    <Check size={15} />รับทราบ
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export function DashboardPageClient() {
  const { summary, loading, error, refresh } = useDashboard();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dismissedNoticeId, setDismissedNoticeId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    notificationService
      .list()
      .then((items) => {
        if (mounted) setNotifications(items);
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  const activeNotice = useMemo(() => {
    return notifications.find((item) => !isBannerNotice(item) && !item.isRead && item.id !== dismissedNoticeId) ?? null;
  }, [dismissedNoticeId, notifications]);

  return (
    <div className="space-y-5">
      <DashboardStats summary={summary} loading={loading} error={error} onRefresh={() => void refresh()} />
      {activeNotice ? <DashboardNoticeModal item={activeNotice} onClose={(id) => { setDismissedNoticeId(id); }} onHideForever={(id) => { setDismissedNoticeId(id); setNotifications((items) => items.map((item) => item.id === id ? { ...item, isRead: true } : item)); }} /> : null}
    </div>
  );
}

