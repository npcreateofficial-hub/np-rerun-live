'use client';

import { ChangeEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { BellRing, Check, ImagePlus, Loader2, Maximize2, Send, Sparkles, Trash2, X } from 'lucide-react';
import { AdminButton } from './AdminButton';
import { AdminModal } from './AdminModal';
import { AdminPopupNotice } from './AdminPopupNotice';
import { API_BASE_URL, FRONTEND_URL } from '@/lib/constants';
import { adminService, type AdminNotificationPayload } from '@/services/admin.service';
import type { AdminNotification, AdminUser } from '@/types/admin';

type NoticeStyle = {
  cardBg: string;
  titleColor: string;
  textColor: string;
  textBg: string;
  buttonBg: string;
  buttonColor: string;
  cardWidth: number;
  titleSize: number;
  textSize: number;
  radius: number;
  imageOnly: boolean;
  noticeMode?: NoticeMode;
  bannerLayout?: BannerLayout;
  bannerImages?: string[];
};

type NoticeMode = 'banner' | 'image' | 'mixed';
type BannerLayout = 'hero_strip' | 'hero_wide' | 'duo_feature' | 'trio_story' | 'quad_showcase' | 'five_editorial' | 'six_magazine';

const bannerLayouts: { key: BannerLayout; label: string; desc: string; slots: number }[] = [
  { key: 'hero_strip', label: 'ภาพหลัก + แถบย่อย', desc: 'ภาพหลักใหญ่ด้านบน พร้อมภาพย่อย 3 รูปด้านล่าง', slots: 4 },
  { key: 'hero_wide', label: 'Hero เต็มจอ', desc: 'รูปเด่น 1 รูปเต็มแบนเนอร์', slots: 1 },
  { key: 'duo_feature', label: 'ภาพเด่น + แนวตั้ง', desc: 'ภาพหลักกว้าง พร้อมภาพย่อยด้านขวา', slots: 2 },
  { key: 'trio_story', label: 'Story 3 ช่อง', desc: 'ภาพเด่นใหญ่ และภาพย่อย 2 ช่อง', slots: 3 },
  { key: 'quad_showcase', label: 'Showcase 4 รูป', desc: 'ภาพหลักใหญ่ พร้อม 3 ภาพย่อย', slots: 4 },
  { key: 'five_editorial', label: 'Editorial 5 รูป', desc: 'ภาพหลักกลาง พร้อมภาพย่อยรอบ ๆ', slots: 5 },
  { key: 'six_magazine', label: 'Magazine 6 รูป', desc: 'ภาพเด่นซ้าย พร้อมกริดย่อย 5 รูป', slots: 6 },
];

const defaultStyle: NoticeStyle = {
  cardBg: '#f8f4ec',
  titleColor: '#1d1a16',
  textColor: '#51483c',
  textBg: '#ffffff',
  buttonBg: '#d9252c',
  buttonColor: '#ffffff',
  cardWidth: 420,
  titleSize: 20,
  textSize: 14,
  radius: 10,
  imageOnly: false,
  noticeMode: 'mixed',
  bannerLayout: 'hero_strip',
  bannerImages: [],
};

const templates = [
  {
    key: 'expiring3',
    label: 'ใกล้หมด 3 วัน',
    title: 'แพ็กเกจใกล้หมดอายุ',
    message: 'แพ็กเกจของคุณใกล้หมดอายุแล้ว ต่ออายุเพื่อใช้งาน NP LIVE ต่อเนื่องได้เลย',
    type: 'WARNING' as const,
    ctaLabel: 'ต่ออายุ',
    target: 'expiring3',
  },
  {
    key: 'expiring7',
    label: 'ใกล้หมด 7 วัน',
    title: 'เตรียมต่ออายุ NP LIVE',
    message: 'สิทธิ์ใช้งานของคุณกำลังจะหมดอายุ แนะนำต่ออายุไว้ก่อนเพื่อให้ไลฟ์ต่อได้ไม่สะดุด',
    type: 'INFO' as const,
    ctaLabel: 'ดูแพ็กเกจ',
    target: 'expiring7',
  },
  {
    key: 'expired',
    label: 'หมดอายุแล้ว',
    title: 'แพ็กเกจหมดอายุแล้ว',
    message: 'แพ็กเกจของคุณหมดอายุแล้ว กรุณาต่ออายุเพื่อกลับมาใช้งานระบบได้ตามปกติ',
    type: 'ERROR' as const,
    ctaLabel: 'ต่ออายุทันที',
    target: 'expired',
  },
  {
    key: 'renew',
    label: 'โปรต่ออายุ',
    title: 'โปรต่ออายุสุดคุ้มสำหรับลูกค้าเดิม',
    message: 'มีโปรต่ออายุสำหรับลูกค้า NP LIVE รีบต่ออายุก่อนหมดรอบเพื่อใช้งานได้ต่อเนื่อง',
    type: 'SUCCESS' as const,
    ctaLabel: 'รับโปรต่ออายุ',
    target: 'all',
  },
] as const;

const emptyNotice: AdminNotificationPayload = {
  userId: '',
  title: '',
  message: '',
  imageUrl: null,
  styleJson: JSON.stringify(defaultStyle),
  ctaLabel: '',
  ctaUrl: '/dashboard',
  type: 'INFO',
  status: 'SENT',
};

function recipient(n: AdminNotification) {
  if (!n.userId) return 'ทุกคน';
  return n.user?.displayName || n.user?.username || n.user?.email || 'รายลูกค้า';
}

function nameOf(user: AdminUser) {
  return user.displayName || user.username || user.email;
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

function parseStyle(value?: string | null): NoticeStyle {
  if (!value) return defaultStyle;
  try {
    return { ...defaultStyle, ...JSON.parse(value) };
  } catch {
    return defaultStyle;
  }
}

function noticeKind(item: AdminNotification) {
  const style = parseStyle(item.styleJson);
  if (style.noticeMode === 'banner' || style.noticeMode === 'image' || style.noticeMode === 'mixed') return style.noticeMode;
  if (!style.imageOnly) return 'mixed';
  return item.title.includes('แบนเนอร์') ? 'banner' : 'image';
}

function noticeThumb(n: AdminNotification) {
  if (n.imageUrl) return n.imageUrl;
  return null;
}

function mediaUrl(value?: string | null) {
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('/uploads/')) return `${API_BASE_URL}${value}`;
  return value;
}

function bannerSlotCount(layout?: BannerLayout) {
  return bannerLayouts.find((item) => item.key === (layout ?? 'hero_strip'))?.slots ?? 4;
}

function normalizeBannerImages(images: string[] | undefined, count: number) {
  return Array.from({ length: count }, (_, index) => images?.[index] || '');
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-[12px] font-black text-[#95a9c4]">
      {label}
      {children}
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex h-10 items-center justify-between gap-3 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-[12px] font-black text-[#95a9c4]">
      {label}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-10 cursor-pointer rounded bg-transparent" />
    </label>
  );
}

function BannerSlot({ index, className = '', image }: { index: number; className?: string; image?: string }) {
  return (
    <div className={`relative grid min-h-0 place-items-center overflow-hidden rounded-[8px] border border-[#31577f] bg-[linear-gradient(135deg,#0c1f35,#07121f_55%,#241b08)] ${className}`}>
      {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : null}
      <div className="absolute left-2 top-2 rounded-full border border-[#6caee7]/50 bg-[#071320]/90 px-2 py-1 text-[10px] font-black text-[#bcdcff]">
        รูป {index}
      </div>
      {!image ? (
        <div className="text-center">
          <ImagePlus size={18} className="mx-auto mb-1 text-[#f0b728]" />
          <div className="text-[11px] font-black text-[#95a9c4]">ช่องรูป {index}</div>
        </div>
      ) : null}
    </div>
  );
}

function BannerScene({ layout, images = [] }: { layout: BannerLayout; images?: string[] }) {
  if (layout === 'hero_strip') {
    return (
      <div className="grid h-full grid-rows-[2.9fr_1fr] gap-2">
        <BannerSlot index={1} image={images[0]} className="rounded-[14px]" />
        <div className="grid grid-cols-3 gap-2">
          <BannerSlot index={2} image={images[1]} className="rounded-[10px]" />
          <BannerSlot index={3} image={images[2]} className="rounded-[10px]" />
          <BannerSlot index={4} image={images[3]} className="rounded-[10px]" />
        </div>
      </div>
    );
  }
  if (layout === 'hero_wide') {
    return <BannerSlot index={1} image={images[0]} className="h-full" />;
  }
  if (layout === 'duo_feature') {
    return (
      <div className="grid h-full grid-cols-[1.7fr_.75fr] gap-2">
        <BannerSlot index={1} image={images[0]} className="rounded-[12px]" />
        <BannerSlot index={2} image={images[1]} className="rounded-[12px]" />
      </div>
    );
  }
  if (layout === 'trio_story') {
    return (
      <div className="grid h-full grid-cols-[1.5fr_.95fr] gap-2">
        <BannerSlot index={1} image={images[0]} className="row-span-2 rounded-[12px]" />
        <div className="grid gap-2">
          <BannerSlot index={2} image={images[1]} className="rounded-[12px]" />
          <BannerSlot index={3} image={images[2]} className="rounded-[12px]" />
        </div>
      </div>
    );
  }
  if (layout === 'quad_showcase') {
    return (
      <div className="grid h-full grid-cols-[1.55fr_.85fr] gap-2">
        <BannerSlot index={1} image={images[0]} className="rounded-[14px]" />
        <div className="grid gap-2">
          <BannerSlot index={2} image={images[1]} className="rounded-[12px]" />
          <BannerSlot index={3} image={images[2]} className="rounded-[12px]" />
          <BannerSlot index={4} image={images[3]} className="rounded-[12px]" />
        </div>
      </div>
    );
  }
  if (layout === 'five_editorial') {
    return (
      <div className="grid h-full grid-cols-[.75fr_1.35fr_.75fr] grid-rows-2 gap-2">
        <BannerSlot index={2} image={images[1]} className="rounded-[12px]" />
        <BannerSlot index={1} image={images[0]} className="row-span-2 rounded-[14px]" />
        <BannerSlot index={3} image={images[2]} className="rounded-[12px]" />
        <BannerSlot index={4} image={images[3]} className="rounded-[12px]" />
        <BannerSlot index={5} image={images[4]} className="rounded-[12px]" />
      </div>
    );
  }
  return (
    <div className="grid h-full grid-cols-[1.45fr_1fr] gap-2">
      <BannerSlot index={1} image={images[0]} className="row-span-2 rounded-[14px]" />
      <div className="grid grid-cols-2 grid-rows-3 gap-2">
        {[2, 3, 4, 5, 6].map((index) => (
          <BannerSlot key={index} index={index} image={images[index - 1]} className={index === 6 ? 'col-span-2 rounded-[12px]' : 'rounded-[12px]'} />
        ))}
        </div>
    </div>
  );
}

function PreviewCard({ draft, style, previewScale }: { draft: AdminNotificationPayload; style: NoticeStyle; previewScale: number }) {
  const imageOnly = style.imageOnly;
  const mode = style.noticeMode ?? (imageOnly ? 'banner' : 'mixed');
  const bannerLayout = style.bannerLayout ?? 'hero_strip';
  const previewPath = mode === 'image' ? '/dashboard' : '/notifications';
  const previewUrl = FRONTEND_URL.startsWith('http') ? FRONTEND_URL.replace(/\/$/, '') + previewPath : previewPath;
  const previewImage = mediaUrl(draft.imageUrl);
  const bannerImages = normalizeBannerImages(style.bannerImages, bannerSlotCount(bannerLayout)).map((item) => mediaUrl(item));
  if (!bannerImages.some(Boolean) && previewImage) bannerImages[0] = previewImage;

  return (
    <div className="flex h-full flex-col rounded-[12px] border border-[#203a5a] bg-[#070707] p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-[12px] font-black text-white">
            {mode === 'banner' ? 'ตัวอย่างหน้าแบนเนอร์' : mode === 'image' ? 'ตัวอย่างหน้ารูปภาพ' : 'ตัวอย่างรูป+ข้อความ'}
          </div>
          <div className="mt-1 text-[11px] font-bold text-[#95a9c4]">แต่ละหัวข้อแยกข้อมูลกัน ไม่ปนกับหัวข้ออื่น</div>
        </div>
        <div className="rounded-[8px] border border-[#274262] bg-[#071320] px-3 py-2 text-[10px] font-black text-[#8cc8ff]">
          {mode === 'banner' ? 'แบนเนอร์' : mode === 'image' ? 'รูปภาพ' : 'รูป+ข้อความ'}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[12px] border border-[#274262] bg-[#080808] shadow-2xl">
        <div className="flex h-9 items-center gap-2 border-b border-[#203a5a] bg-[#071320] px-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#1ba7ff]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#e3aa3a]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#2d8b55]" />
          <span className="ml-2 rounded bg-[#081421] px-2 py-1 text-[10px] font-black text-[#95a9c4]">{previewUrl}</span>
        </div>

        <div className="relative min-h-0 flex-1 bg-[#090909]">
          <aside className="absolute inset-y-0 left-0 w-[118px] border-r border-[#203a5a] bg-[#0b0b0a] p-3">
            <div className="mb-5 text-[16px] font-black leading-none text-white">NP LIVE</div>
            {['แดชบอร์ด', 'สตรีม', 'พื้นที่', 'แจ้งเตือน'].map((label) => (
              <div key={label} className={`mb-2 h-8 rounded-[8px] px-2 py-2 text-[10px] font-black ${(mode === 'image' ? label === 'แดชบอร์ด' : label === 'แจ้งเตือน') ? 'bg-[#063c9a] text-white' : 'bg-[#071320] text-[#95a9c4]'}`}>{label}</div>
            ))}
          </aside>

          <main className="relative ml-[118px] h-full p-4 pr-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[22px] font-black text-white">
                  {mode === 'banner' ? 'แบนเนอร์ประกาศ' : mode === 'image' ? 'แดชบอร์ด' : 'ข้อความแจ้งเตือน'}
                </div>
                <div className="mt-1 text-[11px] font-bold text-[#95a9c4]">
                  {mode === 'image' ? 'ข้อมูลภาพรวมของบัญชีและระบบ Live Streaming' : previewUrl}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-full border border-[#274262] bg-[#071320] text-[#f0b728]">
                  <BellRing size={17} />
                </div>
              </div>
            </div>

            {mode === 'image' ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {['เครดิตคงเหลือ', 'จำนวนช่องไลฟ์', 'จำนวนบัญชี', 'แพ็กเกจปัจจุบัน'].map((label) => (
                    <div key={label} className="rounded-[10px] border border-[#274262] bg-[#071320] p-4">
                      <div className="text-[10px] font-black text-[#95a9c4]">{label}</div>
                      <div className="mt-3 h-6 w-16 rounded bg-[#312613]" />
                    </div>
                  ))}
                </div>
                <section
                  className="absolute left-1/2 top-1/2 max-w-[calc(100%-32px)] rounded-[12px] border border-[#274262] bg-[#0b0b0a]/96 p-2 shadow-[0_24px_80px_rgba(0,0,0,.55)] backdrop-blur"
                  style={{ transform: `translate(-50%, -50%) scale(${previewScale / 100})`, transformOrigin: 'center' }}
                >
                  <div className="relative overflow-hidden border border-black/10 shadow-xl" style={{ backgroundColor: style.cardBg, borderRadius: style.radius }}>
                    <button className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border border-black/10 bg-black/45 text-white backdrop-blur" aria-label="ปิดตัวอย่าง">
                      <X size={15} />
                    </button>
                    {previewImage ? (
                      <img src={previewImage} alt="" className="mx-auto max-h-[420px] w-auto max-w-full object-contain" />
                    ) : (
                      <div className="grid h-36 min-w-[120px] place-items-center bg-[#efe5d2] px-6 text-sm font-black text-[#8a7651]">ยังไม่ได้เลือกรูป</div>
                    )}
                  </div>
                </section>
              </>
            ) : mode === 'banner' ? (
              <div className="rounded-[12px] border border-[#274262] bg-[#0b0b0a] p-3">
                <div className="h-[310px] overflow-hidden" style={{ borderRadius: style.radius }}>
                  <BannerScene layout={bannerLayout} images={bannerImages} />
                </div>
                <div className="mt-3 flex items-center justify-between rounded-[9px] border border-[#203a5a] bg-[#071320] px-3 py-2">
                  <div className="text-[11px] font-black text-[#95a9c4]">ฉากที่เลือก</div>
                  <div className="text-[12px] font-black text-[#f0b728]">{bannerLayouts.find((item) => item.key === bannerLayout)?.label}</div>
                </div>
              </div>
            ) : imageOnly ? (
              <div className="grid min-h-[320px] place-items-center rounded-[12px] border border-[#274262] bg-[#0b0b0a] p-3">
                {previewImage ? (
                  <div className="relative inline-block max-h-full max-w-full">
                    <img src={previewImage} alt="" className="block max-h-[430px] max-w-full object-contain" style={{ borderRadius: style.radius }} />
                    <div className="absolute right-3 top-3 rounded-full border border-black/10 bg-black/50 px-3 py-1 text-[10px] font-black text-white">ดู 0</div>
                  </div>
                ) : (
                  <div className="text-center text-[14px] font-black text-[#8a7651]">ยังไม่ได้เลือกรูป</div>
                )}
              </div>
            ) : null}

            {!imageOnly ? <section
              className="absolute left-1/2 top-1/2 max-w-[calc(100%-32px)] rounded-[12px] border border-[#274262] bg-[#0b0b0a]/96 p-4 shadow-[0_24px_80px_rgba(0,0,0,.55)] backdrop-blur"
              style={{ width: style.cardWidth + 32, transform: `translate(-50%, -50%) scale(${previewScale / 100})`, transformOrigin: 'center' }}
            >
              <div className="relative overflow-hidden border border-black/10 shadow-xl" style={{ backgroundColor: style.cardBg, borderRadius: style.radius }}>
                <button className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border border-black/10 bg-black/45 text-white backdrop-blur" aria-label="ปิดตัวอย่าง">
                  <X size={15} />
                </button>
                {previewImage ? (
                  <img src={previewImage} alt="" className="mx-auto max-h-[420px] w-auto max-w-full object-contain" />
                ) : (
                  <div className="grid h-36 place-items-center bg-[#efe5d2] text-sm font-black text-[#8a7651]">ยังไม่ได้เลือกรูป</div>
                )}
                <div className="p-5">
                  <div className="mb-2 text-[11px] font-black text-[#d84930]">NP LIVE</div>
                  <div className="rounded-[8px] p-3" style={{ backgroundColor: style.textBg }}>
                    <h3 className="font-black" style={{ color: style.titleColor, fontSize: style.titleSize }}>{draft.title || 'หัวข้อแจ้งเตือน'}</h3>
                    <p className="mt-2 whitespace-pre-wrap font-semibold leading-6" style={{ color: style.textColor, fontSize: style.textSize }}>
                      {draft.message || 'รายละเอียดแจ้งเตือนจะแสดงตรงนี้'}
                    </p>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <label className="inline-flex h-10 min-w-[116px] cursor-pointer items-center justify-center gap-2 rounded-[8px] border border-[#274262] bg-[#071320] px-4 text-[13px] font-black text-[#f7f1e7] shadow-sm">
                      <span className="h-4 w-4 rounded-[3px] border border-[#f7f1e7]/70 bg-white/10" />
                      ไม่แสดงอีก
                    </label>
                    <div className="flex shrink-0 items-center gap-2">
                    {draft.ctaLabel ? (
                      <button className="h-10 rounded-[8px] px-4 text-[13px] font-black" style={{ backgroundColor: style.buttonBg, color: style.buttonColor }}>
                        {draft.ctaLabel}
                      </button>
                    ) : null}
                      <button className="inline-flex h-10 min-w-[116px] items-center justify-center gap-2 rounded-[8px] border border-[#274262] bg-[#071320] px-4 text-[13px] font-black text-[#f7f1e7]">
                        <Check size={15} />รับทราบ
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section> : null}
          </main>
        </div>
      </div>
    </div>
  );
}

export function NotificationsClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [draft, setDraft] = useState<AdminNotificationPayload>(emptyNotice);
  const [styleDraft, setStyleDraft] = useState<NoticeStyle>({ ...defaultStyle, imageOnly: true, noticeMode: 'banner', bannerLayout: 'hero_strip', cardWidth: 560, titleSize: 24, textSize: 15 });
  const [noticeMode, setNoticeMode] = useState<NoticeMode>('banner');
  const [target, setTarget] = useState('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminNotification | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [nextUsers, nextItems] = await Promise.all([adminService.users(), adminService.notifications()]);
      setUsers(nextUsers);
      setItems(nextItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดแจ้งเตือนไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const userId = params.get('userId');
      const template = params.get('template');
      const found = templates.find((item) => item.key === template);
      if (found || userId) {
        if (found) applyTemplate(found, false);
        if (userId) {
          setTarget('single');
          setDraft((prev) => ({ ...prev, userId }));
        }
        setComposerOpen(true);
      }
    }
    void load();
  }, []);

  const targetUsers = useMemo(() => {
    if (target === 'single') return draft.userId ? users.filter((u) => u.id === draft.userId) : [];
    if (target === 'expiring3') return users.filter((u) => {
      const left = daysLeft(u.packageExpiresAt);
      return left !== null && left >= 0 && left <= 3;
    });
    if (target === 'expiring7') return users.filter((u) => {
      const left = daysLeft(u.packageExpiresAt);
      return left !== null && left >= 0 && left <= 7;
    });
    if (target === 'expired') return users.filter((u) => {
      const left = daysLeft(u.packageExpiresAt);
      return left !== null && left < 0;
    });
    return users;
  }, [draft.userId, target, users]);

  const summary = useMemo(() => {
    const sent = items.filter((item) => item.status === 'SENT').length;
    const allUsers = items.filter((item) => !item.userId).length;
    return { total: items.length, sent, allUsers };
  }, [items]);

  const groupedItems = useMemo(() => ({
    banner: items.filter((item) => noticeKind(item) === 'banner'),
    image: items.filter((item) => noticeKind(item) === 'image'),
    mixed: items.filter((item) => noticeKind(item) === 'mixed'),
  }), [items]);
  const currentBannerSlots = bannerSlotCount(styleDraft.bannerLayout);
  const currentBannerImages = normalizeBannerImages(styleDraft.bannerImages, currentBannerSlots);
  const hasImageForCurrentMode = noticeMode === 'banner'
    ? currentBannerImages.some(Boolean)
    : Boolean(draft.imageUrl);

  async function readImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('เลือกได้เฉพาะไฟล์รูปภาพ');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError('ไฟล์รูปใหญ่เกิน 6MB');
      return;
    }
    setUploadingImage(true);
    setError(null);
    try {
      const uploaded = await adminService.uploadNotificationImage(file);
      if (noticeMode === 'banner') {
        const slotCount = bannerSlotCount(styleDraft.bannerLayout);
        const nextImages = normalizeBannerImages(styleDraft.bannerImages, slotCount);
        const nextSlot = nextImages.findIndex((item) => !item);
        if (nextSlot === -1) {
          setError(`ฉากนี้ใส่ได้ ${slotCount} รูปครบแล้ว`);
          return;
        }
        nextImages[nextSlot] = uploaded.imageUrl;
        setStyleDraft((prev) => ({ ...prev, bannerImages: nextImages }));
        if (nextSlot === 0 || !draft.imageUrl) setDraft((prev) => ({ ...prev, imageUrl: nextImages[0] || uploaded.imageUrl }));
        setMessage(`เพิ่มรูปที่ ${nextSlot + 1} แล้ว`);
      } else {
        setDraft((prev) => ({ ...prev, imageUrl: uploaded.imageUrl }));
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  }

  function applyTemplate(template: (typeof templates)[number], open = true) {
    setNoticeMode('mixed');
    setStyleDraft((prev) => ({ ...prev, imageOnly: false, noticeMode: 'mixed', cardWidth: 420, titleSize: 20, textSize: 14 }));
    setTarget(template.target);
    setDraft((prev) => ({
      ...prev,
      title: template.title,
      message: template.message,
      type: template.type,
      ctaLabel: template.ctaLabel,
      ctaUrl: '/dashboard',
    }));
    if (open) setComposerOpen(true);
  }

  async function createNotice() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const imageOnly = noticeMode !== 'mixed';
      const bannerImages = noticeMode === 'banner'
        ? normalizeBannerImages(styleDraft.bannerImages, bannerSlotCount(styleDraft.bannerLayout))
        : styleDraft.bannerImages;
      const primaryImage = noticeMode === 'banner' ? (bannerImages?.find(Boolean) || null) : draft.imageUrl;
      const payload: AdminNotificationPayload = {
        ...draft,
        imageUrl: imageOnly ? primaryImage : draft.imageUrl,
        title: imageOnly ? (noticeMode === 'banner' ? 'แบนเนอร์รูปภาพ' : 'รูปภาพแจ้งเตือน') : draft.title,
        message: imageOnly ? 'แจ้งเตือนรูปภาพจาก NP LIVE' : draft.message,
        styleJson: JSON.stringify({ ...styleDraft, bannerImages, imageOnly, noticeMode }),
        ctaLabel: imageOnly ? null : (draft.ctaLabel || null),
        ctaUrl: imageOnly ? null : (draft.ctaUrl || null),
      };

      if (target === 'all') {
        await adminService.createNotification({ ...payload, userId: null });
      } else if (target === 'single') {
        await adminService.createNotification({ ...payload, userId: draft.userId || null });
      } else {
        await Promise.all(targetUsers.map((user) => adminService.createNotification({ ...payload, userId: user.id })));
      }

      setDraft(emptyNotice);
      setStyleDraft({ ...defaultStyle, imageOnly: true, noticeMode: 'banner', bannerLayout: 'hero_strip', bannerImages: [], cardWidth: 560, titleSize: 24, textSize: 15 });
      setNoticeMode('banner');
      setTarget('all');
      setComposerOpen(false);
      setMessage(`บันทึกแจ้งเตือนสำเร็จ ${target === 'all' ? 'ทุกคน' : `${targetUsers.length} บัญชี`}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกแจ้งเตือนไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  async function deleteNotice(item: AdminNotification) {
    setDeletingId(item.id);
    setError(null);
    setMessage(null);
    try {
      await adminService.deleteNotification(item.id);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      setDeleteTarget(null);
      setMessage('ลบแจ้งเตือนสำเร็จ');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลบแจ้งเตือนไม่สำเร็จ');
    } finally {
      setDeletingId(null);
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

      <header className="rounded-[10px] border border-[#274262] bg-gradient-to-r from-[#071a31] via-[#07111f] to-[#1f1708] p-4 shadow-[0_22px_55px_rgba(0,0,0,.28)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-[12px] border border-[#79c7ff] bg-gradient-to-br from-[#0b79ff] to-[#0647b8] text-white shadow-[0_0_28px_rgba(11,121,255,.28)]">
              <BellRing size={22} />
            </span>
            <div>
              <div className="text-[12px] font-black text-[#8cc8ff]">ศูนย์แจ้งเตือน</div>
              <h2 className="text-[26px] font-black leading-tight">แจ้งเตือนลูกค้า</h2>
              <p className="mt-1 text-[13px] font-bold text-[#bcdcff]">สร้างประกาศ แบนเนอร์ และข้อความถึงทุกคนหรือเฉพาะลูกค้า</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AdminButton variant="gold" onClick={() => setComposerOpen(true)}><Send size={15} />สร้างแจ้งเตือน</AdminButton>
            {[
              ['ทั้งหมด', summary.total],
              ['ส่งแล้ว', summary.sent],
              ['ถึงทุกคน', summary.allUsers],
            ].map(([label, value]) => (
              <div key={label} className="min-w-[142px] rounded-[9px] border border-[#274262] bg-[#0a1018]/82 px-4 py-3">
                <div className="text-[12px] font-black text-[#c9d7e8]">{label}</div>
                <div className="mt-1 text-[28px] font-black leading-none text-[#ffd766]">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <section className="rounded-[10px] border border-[#274262] bg-gradient-to-br from-[#071320] to-[#100d06] p-5 shadow-[0_18px_44px_rgba(0,0,0,.18)]">
        <h2 className="text-[18px] font-black">เลือกแบบแจ้งเตือน</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {templates.map((template) => (
            <button key={template.key} onClick={() => applyTemplate(template)} className="rounded-[9px] border border-[#274262] bg-[#100d08] p-4 text-left hover:border-[#0b79ff]">
              <Sparkles size={16} className="mb-3 text-[#f0b728]" />
              <b className="block text-sm">{template.label}</b>
              <span className="mt-1 block text-[12px] font-semibold text-[#95a9c4]">{template.message}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[10px] border border-[#274262] bg-gradient-to-br from-[#071320] to-[#100d06] p-5 shadow-[0_18px_44px_rgba(0,0,0,.18)]">
        <div className="mb-4 flex justify-between"><h2 className="text-[18px] font-black">ประวัติแจ้งเตือน</h2></div>
        {loading ? <div className="p-8 text-center text-[#95a9c4]"><Loader2 className="mx-auto mb-2 animate-spin text-[#f0b728]" />กำลังโหลด...</div> : (
          <div className="space-y-5">
            {[
              { key: 'banner', title: 'แบนเนอร์', empty: 'ยังไม่มีแบนเนอร์' },
              { key: 'image', title: 'รูปภาพ', empty: 'ยังไม่มีรูปภาพแจ้งเตือน' },
              { key: 'mixed', title: 'รูป+ข้อความ', empty: 'ยังไม่มีรูป+ข้อความ' },
            ].map((section) => {
              const rows = groupedItems[section.key as NoticeMode];
              return (
                <div key={section.key} className="rounded-[10px] border border-[#1c324c] bg-[#071320]/45 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[15px] font-black text-white">{section.title}</h3>
                    <span className="rounded-full border border-[#274262] px-3 py-1 text-[11px] font-black text-[#8cc8ff]">{rows.length} รายการ</span>
                  </div>
                  {rows.length === 0 ? <div className="rounded-[9px] border border-dashed border-[#274262] px-4 py-6 text-center text-sm font-bold text-[#95a9c4]">{section.empty}</div> : null}
                  {rows.length > 0 ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {rows.map((n) => {
            const style = parseStyle(n.styleJson);
            const thumb = noticeThumb(n);
            const thumbUrl = mediaUrl(thumb);
            const imageOnly = style.imageOnly;
            return (
              <article key={n.id} className="group relative overflow-hidden rounded-[9px] border border-[#274262] bg-[#081421]">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(n)}
                  disabled={deletingId === n.id}
                  className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-[8px] border border-[#8f1d23] bg-[#65141c] text-[#ffd5d5] opacity-95 disabled:cursor-wait disabled:opacity-60"
                  aria-label="ลบแจ้งเตือน"
                >
                  {deletingId === n.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
                <div className="grid aspect-[16/9] place-items-center bg-[#f8f4ec]">
                  {thumbUrl ? (
                    <img src={thumbUrl} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <div className="px-8 text-center">
                      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[#d9252c] text-white"><BellRing size={20} /></div>
                      <div className="text-[16px] font-black text-[#1d1a16]">{n.title}</div>
                      <div className="mt-2 line-clamp-2 text-[12px] font-bold text-[#51483c]">{n.message}</div>
                    </div>
                  )}
                </div>
                {!imageOnly ? (
                  <div className="p-3">
                    <div className="text-[11px] font-black text-[#f0b728]">{n.type} / {n.status} / {recipient(n)}</div>
                    <h3 className="mt-1 truncate font-black" style={{ color: thumb ? '#fff' : style.titleColor }}>{n.title}</h3>
                  </div>
                ) : null}
              </article>
            );
          })}
                  </div> : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <AdminModal open={composerOpen} title="สร้างแจ้งเตือน" description={`เป้าหมาย ${target === 'all' ? 'ทุกคน' : `${targetUsers.length} บัญชี`}`} onClose={() => setComposerOpen(false)} widthClass="max-w-[96vw]">
        <div className="grid gap-5 xl:grid-cols-[minmax(430px,0.85fr)_minmax(760px,1.15fr)]">
          <section className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { key: 'banner', label: 'แบนเนอร์', desc: 'รูปแบบแบนเนอร์สำหรับประกาศใหญ่' },
                { key: 'image', label: 'รูปภาพ', desc: 'แสดงเฉพาะรูป ไม่มีกล่องข้อความ' },
                { key: 'mixed', label: 'รูป+ข้อความ', desc: 'รูปพร้อมหัวข้อ รายละเอียด และปุ่ม' },
              ].map((mode) => {
                const active = noticeMode === mode.key;
                return (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => {
                      setNoticeMode(mode.key as NoticeMode);
                      if (mode.key === 'image') {
                        setStyleDraft((prev) => ({ ...prev, imageOnly: true, noticeMode: 'image', cardWidth: 460 }));
                      } else if (mode.key === 'banner') {
                        setStyleDraft((prev) => ({ ...prev, imageOnly: true, noticeMode: 'banner', bannerLayout: 'hero_strip', bannerImages: normalizeBannerImages(prev.bannerImages, bannerSlotCount('hero_strip')), cardWidth: 560, titleSize: 24, textSize: 15 }));
                      } else {
                        setStyleDraft((prev) => ({ ...prev, imageOnly: false, noticeMode: 'mixed', cardWidth: 420, titleSize: 20, textSize: 14 }));
                      }
                    }}
                    className={`rounded-[10px] border p-4 text-left ${active ? 'border-[#f0b728] bg-[#2a2209] text-white' : 'border-[#274262] bg-[#100d08] text-[#f7f1e7] hover:border-[#0b79ff]'}`}
                  >
                    <b className="block text-[15px]">{mode.label}</b>
                    <span className="mt-2 block text-[12px] font-bold text-[#95a9c4]">{mode.desc}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="ส่งให้">
                <select value={target} onChange={(e) => setTarget(e.target.value)} className="h-10 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white">
                  <option value="all">ส่งถึงทุกคน</option>
                  <option value="single">เลือกรายลูกค้า</option>
                  <option value="expiring3">ใกล้หมด 3 วัน</option>
                  <option value="expiring7">ใกล้หมด 7 วัน</option>
                  <option value="expired">หมดอายุแล้ว</option>
                </select>
              </Field>
              <Field label="เลือกลูกค้า">
                <select value={draft.userId ?? ''} onChange={(e) => setDraft((p) => ({ ...p, userId: e.target.value }))} disabled={target !== 'single'} className="h-10 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white disabled:opacity-40">
                  <option value="">เลือกลูกค้า</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{nameOf(u)}</option>)}
                </select>
              </Field>
              <Field label="ประเภท">
                <select value={draft.type} onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value as AdminNotificationPayload['type'] }))} className="h-10 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white">
                  <option>INFO</option><option>SUCCESS</option><option>WARNING</option><option>ERROR</option>
                </select>
              </Field>
              <Field label="สถานะ">
                <select value={draft.status} onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value as AdminNotificationPayload['status'] }))} className="h-10 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white">
                  <option value="SENT">ส่งเลย</option><option value="DRAFT">แบบร่าง</option><option value="ARCHIVED">เก็บถาวร</option>
                </select>
              </Field>
              {noticeMode === 'mixed' ? (
                <>
                  <Field label="หัวข้อ"><input value={draft.title} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} className="h-10 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white" /></Field>
                  <Field label="ข้อความบนปุ่ม"><input value={draft.ctaLabel ?? ''} onChange={(e) => setDraft((p) => ({ ...p, ctaLabel: e.target.value }))} className="h-10 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white" /></Field>
                  <Field label="รายละเอียด"><textarea value={draft.message} onChange={(e) => setDraft((p) => ({ ...p, message: e.target.value }))} className="min-h-[132px] rounded-[8px] border border-[#274262] bg-[#081421] px-3 py-3 text-white md:col-span-2" /></Field>
              <Field label="ปลายทางปุ่มในระบบ"><input value={draft.ctaUrl ?? ''} onChange={(e) => setDraft((p) => ({ ...p, ctaUrl: e.target.value }))} placeholder="/dashboard" className="h-10 rounded-[8px] border border-[#274262] bg-[#081421] px-3 text-white" /></Field>
                </>
              ) : null}
              {noticeMode === 'banner' ? (
                <div className="md:col-span-2 rounded-[10px] border border-[#274262] bg-[#071320] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[14px] font-black text-white">เลือกฉากแบนเนอร์</div>
                      <div className="mt-1 text-[12px] font-bold text-[#95a9c4]">เลือกก่อนว่าจะสร้างแบนเนอร์กี่รูป แล้วค่อยเพิ่มรูปตามช่อง</div>
                    </div>
                    <span className="rounded-full border border-[#274262] px-3 py-1 text-[11px] font-black text-[#f0b728]">
                      {bannerLayouts.find((item) => item.key === (styleDraft.bannerLayout ?? 'hero_strip'))?.slots} รูป
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {bannerLayouts.map((layout) => {
                      const active = (styleDraft.bannerLayout ?? 'hero_strip') === layout.key;
                      return (
                        <button
                          key={layout.key}
                          type="button"
                          onClick={() => setStyleDraft((prev) => ({ ...prev, bannerLayout: layout.key, bannerImages: normalizeBannerImages(prev.bannerImages, layout.slots), imageOnly: true, noticeMode: 'banner' }))}
                          className={`rounded-[10px] border p-3 text-left transition ${active ? 'border-[#f0b728] bg-[#2a2209]' : 'border-[#274262] bg-[#081421] hover:border-[#0b79ff]'}`}
                        >
                          <div className="mb-2 h-20 overflow-hidden rounded-[8px] border border-[#203a5a] bg-[#05080d] p-1">
                            <BannerScene layout={layout.key} />
                          </div>
                          <b className="block text-[13px] text-white">{layout.label}</b>
                          <span className="mt-1 block text-[11px] font-bold text-[#95a9c4]">{layout.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 rounded-[9px] border border-[#1c324c] bg-[#081421] p-3">
                    <div className="mb-2 text-[12px] font-black text-[#95a9c4]">ช่องรูปของฉากนี้</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {currentBannerImages.map((image, index) => (
                        <div key={index} className="flex items-center gap-2 rounded-[8px] border border-[#274262] bg-[#071320] p-2">
                          <div className="grid h-10 w-16 shrink-0 place-items-center overflow-hidden rounded-[6px] border border-[#203a5a] bg-[#05080d]">
                            {image ? <img src={mediaUrl(image)} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={15} className="text-[#f0b728]" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[12px] font-black text-white">รูป {index + 1}</div>
                            <div className="truncate text-[10px] font-bold text-[#95a9c4]">{image ? 'มีรูปแล้ว' : 'ยังว่าง'}</div>
                          </div>
                          {image ? (
                            <button
                              type="button"
                              onClick={() => {
                                const nextImages = [...currentBannerImages];
                                nextImages[index] = '';
                                setStyleDraft((prev) => ({ ...prev, bannerImages: nextImages }));
                                if (index === 0) setDraft((prev) => ({ ...prev, imageUrl: nextImages.find(Boolean) || null }));
                              }}
                              className="grid h-8 w-8 place-items-center rounded-[7px] border border-[#8f1d23] bg-[#3b0d11] text-[#ffbbb5]"
                              aria-label={`ลบรูป ${index + 1}`}
                            >
                              <X size={14} />
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              <label className="flex min-h-[86px] cursor-pointer items-center justify-center gap-3 rounded-[9px] border border-dashed border-[#274262] bg-[#081421] px-4 text-sm font-black text-[#f0b728] hover:border-[#0b79ff]">
                {uploadingImage ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                {uploadingImage ? 'กำลังอัปโหลดรูป...' : noticeMode === 'banner' ? 'เพิ่มรูปลงช่องถัดไป' : 'เลือกรูปจากไฟล์'}
                <input type="file" accept="image/*" onChange={(event) => void readImage(event)} disabled={uploadingImage} className="hidden" />
              </label>
              <label className="flex min-h-[86px] cursor-pointer items-center justify-center gap-3 rounded-[9px] border border-[#274262] bg-[#081421] px-4 text-sm font-black text-[#f7f1e7] hover:border-[#0b79ff]">
                <input type="checkbox" checked={noticeMode !== 'mixed'} onChange={(e) => {
                  const imageOnly = e.target.checked;
                  setNoticeMode(imageOnly ? 'image' : 'mixed');
                  setStyleDraft((p) => ({ ...p, imageOnly, noticeMode: imageOnly ? 'image' : 'mixed' }));
                }} className="h-4 w-4 accent-[#e3aa3a]" />
                ส่งเฉพาะรูปภาพ
              </label>
            </div>

            <div className="rounded-[10px] border border-[#274262] bg-[#071320] p-4">
              <div className="mb-3 flex items-center gap-2 text-[14px] font-black text-white"><Maximize2 size={16} className="text-[#f0b728]" />แต่งหน้าการ์ด</div>
              <div className="grid gap-3 md:grid-cols-3">
                {noticeMode === 'mixed' ? (
                  <>
                    <ColorField label="พื้นการ์ด" value={styleDraft.cardBg} onChange={(value) => setStyleDraft((p) => ({ ...p, cardBg: value }))} />
                    <ColorField label="พื้นข้อความ" value={styleDraft.textBg} onChange={(value) => setStyleDraft((p) => ({ ...p, textBg: value }))} />
                    <ColorField label="สีหัวข้อ" value={styleDraft.titleColor} onChange={(value) => setStyleDraft((p) => ({ ...p, titleColor: value }))} />
                    <ColorField label="สีข้อความ" value={styleDraft.textColor} onChange={(value) => setStyleDraft((p) => ({ ...p, textColor: value }))} />
                    <ColorField label="สีปุ่ม" value={styleDraft.buttonBg} onChange={(value) => setStyleDraft((p) => ({ ...p, buttonBg: value }))} />
                    <ColorField label="ตัวอักษรปุ่ม" value={styleDraft.buttonColor} onChange={(value) => setStyleDraft((p) => ({ ...p, buttonColor: value }))} />
                    <Field label={`กว้างการ์ดจริง ${styleDraft.cardWidth}px`}><input type="range" min="360" max="560" value={styleDraft.cardWidth} onChange={(e) => setStyleDraft((p) => ({ ...p, cardWidth: Number(e.target.value) }))} /></Field>
                    <Field label={`หัวข้อ ${styleDraft.titleSize}px`}><input type="range" min="16" max="32" value={styleDraft.titleSize} onChange={(e) => setStyleDraft((p) => ({ ...p, titleSize: Number(e.target.value) }))} /></Field>
                    <Field label={`รายละเอียด ${styleDraft.textSize}px`}><input type="range" min="12" max="22" value={styleDraft.textSize} onChange={(e) => setStyleDraft((p) => ({ ...p, textSize: Number(e.target.value) }))} /></Field>
                  </>
                ) : null}
                <Field label={`${noticeMode !== 'mixed' ? 'มุมรูป' : 'มุมการ์ด'} ${styleDraft.radius}px`}><input type="range" min="0" max="22" value={styleDraft.radius} onChange={(e) => setStyleDraft((p) => ({ ...p, radius: Number(e.target.value) }))} /></Field>
              </div>
            </div>

            <AdminButton className="w-full" onClick={() => void createNotice()} disabled={saving || uploadingImage || (noticeMode !== 'mixed' ? !hasImageForCurrentMode : (!draft.title || !draft.message)) || (target === 'single' && !draft.userId)}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}บันทึกแจ้งเตือน
            </AdminButton>
          </section>

          <aside className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[16px] font-black text-white">พรีวิว</h3>
              <Field label={`ย่อ/ขยาย ${zoom}%`}>
                <input type="range" min="55" max="140" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
              </Field>
            </div>
            <div className="h-[560px] overflow-hidden rounded-[10px] border border-[#274262] bg-[#080807] p-4">
              <PreviewCard draft={draft} style={{ ...styleDraft, noticeMode }} previewScale={zoom} />
            </div>
            {hasImageForCurrentMode ? (
              <button onClick={() => {
                if (noticeMode === 'banner') {
                  setStyleDraft((p) => ({ ...p, bannerImages: normalizeBannerImages([], currentBannerSlots) }));
                  setDraft((p) => ({ ...p, imageUrl: null }));
                } else {
                  setDraft((p) => ({ ...p, imageUrl: null }));
                }
              }} className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-[#274262] bg-[#071320] px-3 text-[12px] font-black text-[#f7f1e7]">
                <X size={14} />{noticeMode === 'banner' ? 'ล้างรูปแบนเนอร์' : 'ลบรูป'}
              </button>
            ) : null}
            <div className="rounded-[9px] border border-[#203a5a] bg-[#081421] p-3 text-[12px] font-bold text-[#95a9c4]">รูปใช้จากไฟล์ในเครื่องเท่านั้น ไม่มีช่องวาง URL สำหรับรูปแจ้งเตือน</div>
          </aside>
        </div>
      </AdminModal>

      <AdminModal
        open={Boolean(deleteTarget)}
        title="ยืนยันการลบ"
        description="รายการนี้จะหายจากหน้าแจ้งเตือนของลูกค้าทันที"
        onClose={() => {
          if (!deletingId) setDeleteTarget(null);
        }}
        widthClass="max-w-[440px]"
      >
        <div className="space-y-4">
          <div className="rounded-[12px] border border-[#8f1d23] bg-gradient-to-br from-[#220b10] to-[#071320] p-4">
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-[10px] border border-[#a93a45] bg-[#65141c] text-[#ffd5d5]">
              <Trash2 size={20} />
            </div>
            <div className="text-[16px] font-black text-white">ลบแจ้งเตือนนี้ใช่ไหมคะ?</div>
            <div className="mt-2 rounded-[9px] border border-[#274262] bg-[#071320] px-3 py-2 text-sm font-bold text-[#bcdcff]">
              {deleteTarget?.title || 'แจ้งเตือน'}
            </div>
            <p className="mt-3 text-[12px] font-bold leading-5 text-[#95a9c4]">
              เมื่อลบแล้วรายการนี้จะไม่แสดงในประวัติแอดมิน และจะไม่ไปแสดงฝั่งลูกค้าอีก
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={Boolean(deletingId)}
              className="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#274262] bg-[#071320] px-4 text-sm font-black text-[#f7f1e7] hover:border-[#0b79ff] disabled:opacity-60"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => deleteTarget ? void deleteNotice(deleteTarget) : undefined}
              disabled={Boolean(deletingId)}
              className="inline-flex h-10 min-w-[132px] items-center justify-center gap-2 rounded-[8px] border border-[#a93a45] bg-[#8f1d23] px-4 text-sm font-black text-white shadow-[0_0_24px_rgba(143,29,35,.28)] hover:bg-[#a51f28] disabled:cursor-wait disabled:opacity-70"
            >
              {deletingId ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              ลบแจ้งเตือน
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
