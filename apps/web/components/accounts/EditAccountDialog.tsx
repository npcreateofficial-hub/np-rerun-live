'use client';

import { FormEvent, useEffect, useMemo, useRef, useState, type ChangeEvent, type InputHTMLAttributes, type MouseEvent, type TextareaHTMLAttributes } from 'react';
import { Bot, Check, ChevronDown, Cookie, Database, FileImage, FileVideo, KeyRound, Link2, Loader2, PackageSearch, Pin, PlayCircle, Plus, Radio, Server, ShoppingBag, Trash2, UploadCloud, X } from 'lucide-react';
import { MEDIA_BASE_URL } from '@/lib/constants';
import { accountService } from '@/services/account.service';
import type { LiveChannel, UpdateLiveChannelPayload } from '@/types/account';
import type { ProxyItem } from '@/types/proxy';
import type { VideoItem } from '@/types/video';

const SHOPEE_MAX_LIVE_MINUTES = 23 * 60 + 59;

type EditAccountDialogProps = {
  open: boolean;
  account: LiveChannel | null;
  proxies: ProxyItem[];
  videos: VideoItem[];
  loadingVideos?: boolean;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    accountId: string;
    account: UpdateLiveChannelPayload;
    selectedVideoId?: string | null;
  }) => Promise<void> | void;
};

function FieldLabel({ children, required = false }: { children: string; required?: boolean }) {
  return (
    <label className="mb-2 block text-[13px] font-extrabold text-[#c9c2b6]">
      {children}{required ? <span className="text-[#ff766f]"> *</span> : null}
    </label>
  );
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-lg border border-[#c7962d]/32 bg-black/[0.38] px-4 text-[13px] text-[#f7f1e7] outline-none placeholder:text-[#7f786f] focus:border-[#2da7ff] ${props.className ?? ''}`}
    />
  );
}

function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-[88px] w-full rounded-lg border border-[#c7962d]/32 bg-black/[0.38] px-4 py-3 text-[13px] text-[#f7f1e7] outline-none placeholder:text-[#7f786f] focus:border-[#2da7ff] ${props.className ?? ''}`}
    />
  );
}

function formatSize(sizeMb?: number | null) {
  if (sizeMb === null || sizeMb === undefined) return '-';
  return `${Number(sizeMb).toFixed(2)} MB`;
}

function formatDuration(durationSec?: number | null) {
  if (!durationSec) return '-';
  const minutes = Math.floor(durationSec / 60);
  const seconds = Math.floor(durationSec % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getVideoPreviewUrl(video: VideoItem) {
  const raw = (video.sourceUrl || video.fileKey || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/uploads/')) return `${MEDIA_BASE_URL}${raw}`;
  if (raw.startsWith('/')) return raw;
  return `${MEDIA_BASE_URL}/${raw.replace(/^\/+/, '')}`;
}

function isPlaceholderSource(source: string) {
  return /example\.com/i.test(source);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('อ่านไฟล์รูปภาพหน้าปกไม่สำเร็จ'));
    image.src = url;
  });
}

async function resizeCoverImage(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const maxSide = 720;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('เตรียมรูปภาพหน้าปกไม่สำเร็จ');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.82, 0.72, 0.62, 0.52]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= 220_000 || quality === 0.52) return dataUrl;
    }

    return canvas.toDataURL('image/jpeg', 0.52);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDateTimeLocal(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function parseShopeeBasketLinks(value: string) {
  const rows = value.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
  const seen = new Set<string>();
  const items: Array<{ shop_id: number; item_id: number; url: string }> = [];
  const pending: string[] = [];
  const invalid: string[] = [];

  for (const row of rows) {
    const affiliateOffer = row.match(/affiliate\.shopee\.co\.th\/offer\/product_offer\/(\d+)/i);
    const product = row.match(/product\/(\d+)\/(\d+)/i);
    const iFormat = row.match(/(?:^|[\/?&#.-])i\.(\d+)\.(\d+)(?:$|[/?&#])/i);
    const queryShop = row.match(/[?&#](?:shopid|shop_id)=(\d+)/i);
    const queryItem = row.match(/[?&#](?:itemid|item_id)=(\d+)/i);
    const shopId = product?.[1] || iFormat?.[1] || queryShop?.[1];
    const itemId = product?.[2] || iFormat?.[2] || queryItem?.[1];

    if (!shopId || !itemId) {
      if (affiliateOffer?.[1] || /^https?:\/\/(s\.)?shopee\.co\.th\//i.test(row)) {
        pending.push(row);
      } else {
        invalid.push(row);
      }
      continue;
    }

    const key = `${shopId}:${itemId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ shop_id: Number(shopId), item_id: Number(itemId), url: row });
    if (items.length >= 200) break;
  }

  return { total: rows.length, items, pending, invalid };
}

type BasketProductDraft = {
  key: string;
  url: string;
  shopId?: number | null;
  itemId?: number | null;
  image?: string | null;
  name?: string | null;
  stock?: number | null;
  price?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  priceBeforeDiscount?: number | null;
  sold?: number | null;
  rating?: number | null;
  discount?: string | null;
  isOutOfStock?: boolean | null;
  error?: string | null;
  pinEnabled?: boolean | null;
  videoId?: string | null;
  videoTitle?: string | null;
  videoUrl?: string | null;
  videoThumbnailUrl?: string | null;
  videoDurationSec?: number | null;
  pinOrder: number;
  pinSeconds?: number | null;
};

function safeParseBasketItems(value?: string | null): BasketProductDraft[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
type VideoQueueRow = {
  id: string;
  videoId: string;
  durationHours: string;
  durationMinutes: string;
  restartDelayMinutes: string;
};

function safeParseVideoQueue(value?: string | null): VideoQueueRow[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    const items = Array.isArray(parsed) ? parsed : [];
    return items
      .map((item, index) => ({
        id: `queue-${index}-${item?.videoId ?? 'video'}`,
        videoId: typeof item?.videoId === 'string' ? item.videoId : '',
        durationHours: String(Math.floor(Math.max(1, Math.round(Number(item?.durationMinutes || 1) || 1)) / 60)),
        durationMinutes: String(Math.max(1, Math.round(Number(item?.durationMinutes || 1) || 1)) % 60),
        restartDelayMinutes: String(Math.max(0, Math.round(Number(item?.restartDelayMinutes || 0) || 0))),
      }))
      .filter((item) => item.videoId);
  } catch {
    return [];
  }
}
function formatMoney(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return `฿${Number(value).toLocaleString('th-TH')}`;
}

function pickRandomVideos(videos: VideoItem[], count: number) {
  const pool = [...videos];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, Math.max(0, count));
}

function videoMeta(video: VideoItem) {
  return {
    id: video.id,
    title: video.title,
    durationSec: video.durationSec ?? null,
    sourceUrl: video.sourceUrl ?? null,
    fileKey: video.fileKey ?? null,
  };
}
function StepPill({ index, title, active, onClick }: { index: number; title: string; active: boolean; done: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 items-center gap-2 rounded-[12px] border px-3 py-2 text-left transition ${active ? 'border-[#2da7ff]/70 bg-[#08264f] text-white shadow-[0_0_0_1px_rgba(45,167,255,.25),0_0_18px_rgba(45,167,255,.14)]' : 'border-[#c7962d]/28 bg-black/[0.38] text-[#9fb1c9] hover:border-[#f2bd4b]/65'}`}
    >
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-black ${active ? 'bg-[linear-gradient(135deg,#ffd46c,#e5a928)] text-[#1b1104]' : 'bg-[#1b1711] text-[#c9c2b6]'}`}>{index}</span>
      <span className="truncate text-[12px] font-black">{title}</span>
    </button>
  );
}

export function EditAccountDialog({ open, account, proxies, videos, loadingVideos = false, saving = false, onClose, onSubmit }: EditAccountDialogProps) {
  const [name, setName] = useState('');
  const [proxyId, setProxyId] = useState<string | null>(null);
  const [cookie, setCookie] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<VideoItem | null>(null);
  const [productPreview, setProductPreview] = useState<BasketProductDraft | null>(null);
const [caption, setCaption] = useState('');
  const [description, setDescription] = useState('');
  const [preparedLiveSession, setPreparedLiveSession] = useState('');
  const [basketLinks, setBasketLinks] = useState('');
  const [basketLinkInput, setBasketLinkInput] = useState('');
  const [basketProductDrafts, setBasketProductDrafts] = useState<BasketProductDraft[]>([]);
  const [basketPinSeconds, setBasketPinSeconds] = useState('');
  const [basketPinRunning, setBasketPinRunning] = useState(false);
  const [basketPinSyncing, setBasketPinSyncing] = useState(false);
  const [autoLive, setAutoLive] = useState(false);
  const [liveHours, setLiveHours] = useState('');
  const [liveMinutes, setLiveMinutes] = useState('');
  const [restartMinutes, setRestartMinutes] = useState('');
  const [videoQueue, setVideoQueue] = useState<VideoQueueRow[]>([]);
  const [queueVideoPickerId, setQueueVideoPickerId] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverFileName, setCoverFileName] = useState('');
  const [proxyOpen, setProxyOpen] = useState(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingBasketDetails, setLoadingBasketDetails] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [aiCommentAutoReply, setAiCommentAutoReply] = useState(false);
  const [aiCommentApiKey, setAiCommentApiKey] = useState('');
  const [aiCommentApiKeyDirty, setAiCommentApiKeyDirty] = useState(false);
  const [hasSavedAiCommentApiKey, setHasSavedAiCommentApiKey] = useState(false);
  const [aiKeyChecking, setAiKeyChecking] = useState(false);
  const [aiKeyStatus, setAiKeyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [aiKeyMessage, setAiKeyMessage] = useState('');

  useEffect(() => {
    if (!open || !account) return;

    setName(account.name ?? '');
    setProxyId(account.proxyId ?? null);
    setCookie(account.cookie ?? '');
    setSelectedVideoId(videos.find((video) => video.liveChannelId === account.id)?.id ?? null);
    setPreviewVideo(null);
    setProductPreview(null);
setCaption((account as any).caption ?? 'โปรโมตเฉพาะในไลฟ์');
    setDescription((account as any).description ?? '');
    setPreparedLiveSession((account as any).liveSessionId ?? '');
    setBasketLinks((account as any).basketLinks ?? '');
    setBasketLinkInput('');
    const savedBasketItems = safeParseBasketItems((account as any).basketItemsJson);
    setBasketProductDrafts(savedBasketItems);
    const savedPinSeconds = savedBasketItems.find((item) => item.pinEnabled !== false && Number(item.pinSeconds) > 0)?.pinSeconds;
    setBasketPinSeconds(savedPinSeconds ? String(savedPinSeconds) : '');
    setBasketPinRunning(false);
    setBasketPinSyncing(false);
    setAutoLive(Boolean((account as any).autoLive));
    const savedDuration = (account as any).liveDurationMinutes;
    const duration = Number(savedDuration ?? 0);
    setLiveHours(savedDuration === null || savedDuration === undefined ? '' : String(Math.floor(duration / 60)));
    setLiveMinutes(savedDuration === null || savedDuration === undefined ? '' : String(duration % 60));
    const savedRestartDelay = (account as any).restartDelayMinutes;
    setRestartMinutes(savedRestartDelay === null || savedRestartDelay === undefined ? '' : String(savedRestartDelay));
    const savedVideoQueue = safeParseVideoQueue((account as any).videoQueueJson);
    setVideoQueue(savedVideoQueue.length ? savedVideoQueue : [{
      id: `queue-${Date.now()}`,
      videoId: '',
      durationHours: '',
      durationMinutes: '',
      restartDelayMinutes: '',
    }]);
    setQueueVideoPickerId(null);
    setCoverImageUrl((account as any).coverImageUrl ?? '');
    setCoverFileName((account as any).coverImageUrl ? 'รูปหน้าปกเดิม' : '');
    setProxyOpen(false);
    setError(null);
    setLoadingBasketDetails(false);
    const hasSavedAiKey = Boolean((account as any).aiCommentApiKey);
    setHasSavedAiCommentApiKey(hasSavedAiKey);
    setAiCommentAutoReply(Boolean((account as any).aiCommentAutoReply));
    setAiCommentApiKey('');
    setAiCommentApiKeyDirty(false);
    setAiKeyChecking(false);
    setAiKeyStatus(hasSavedAiKey ? 'success' : 'idle');
    setAiKeyMessage(hasSavedAiKey ? 'บัญชีนี้มี key บันทึกไว้แล้ว ถ้าต้องการเปลี่ยน key ให้วาง key ใหม่แล้วกดบันทึก' : '');
    setActiveStep(1);
  }, [account, open, videos]);

  useEffect(() => {
    if (!open || !account) return;
    let alive = true;
    accountService.showLoopStatus(account.id)
      .then((status) => {
        if (alive) setBasketPinRunning(Boolean(status.running));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [account, open]);

  const readyVideos = useMemo(() => {
    return videos
      .filter((video) => {
        const source = video.sourceUrl || video.fileKey || '';
        return video.status === 'READY' && Boolean(source) && !isPlaceholderSource(source);
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [videos]);
  const selectedProxy = useMemo(() => proxies.find((proxy) => proxy.id === proxyId), [proxies, proxyId]);
  const parsedBasket = useMemo(() => parseShopeeBasketLinks(basketLinks), [basketLinks]);
  const basketProducts = useMemo(() => {
    const draftByKey = new Map(basketProductDrafts.map((item) => [item.key, item]));
    const selectedVideo = readyVideos.find((video) => video.id === selectedVideoId);
    const rows: BasketProductDraft[] = [
      ...parsedBasket.items.map((item, index) => {
        const key = `${item.shop_id}:${item.item_id}`;
        const draft = draftByKey.get(key);
        return {
          key,
          url: item.url,
          shopId: item.shop_id,
          itemId: item.item_id,
          image: draft?.image ?? null,
          name: draft?.name || `สินค้า Shopee ${item.item_id}`,
          stock: draft?.stock ?? null,
          price: draft?.price ?? null,
          priceMin: draft?.priceMin ?? null,
          priceMax: draft?.priceMax ?? null,
          priceBeforeDiscount: draft?.priceBeforeDiscount ?? null,
          sold: draft?.sold ?? null,
          rating: draft?.rating ?? null,
          discount: draft?.discount ?? null,
          isOutOfStock: draft?.isOutOfStock ?? null,
          pinEnabled: draft?.pinEnabled ?? true,
          videoId: draft?.videoId ?? null,
          videoTitle: draft?.videoTitle ?? null,
          videoUrl: draft?.videoUrl ?? null,
          videoThumbnailUrl: draft?.videoThumbnailUrl ?? null,
          videoDurationSec: draft?.videoDurationSec ?? null,
          pinOrder: draft?.pinOrder ?? index + 1,
          pinSeconds: draft?.pinSeconds ?? null,
        };
      }),
      ...parsedBasket.pending.map((url, index) => {
        const pendingKey = `pending:${url}`;
        const draft = draftByKey.get(pendingKey) || basketProductDrafts.find((item) => item.url === url);
        const key = draft?.key || pendingKey;
        return {
          key,
          url,
          shopId: draft?.shopId ?? null,
          itemId: draft?.itemId ?? null,
          image: draft?.image ?? null,
          name: draft?.name || 'รอดึงข้อมูลจากลิงก์สั้น',
          stock: draft?.stock ?? null,
          price: draft?.price ?? null,
          priceMin: draft?.priceMin ?? null,
          priceMax: draft?.priceMax ?? null,
          priceBeforeDiscount: draft?.priceBeforeDiscount ?? null,
          sold: draft?.sold ?? null,
          rating: draft?.rating ?? null,
          discount: draft?.discount ?? null,
          isOutOfStock: draft?.isOutOfStock ?? null,
          error: draft?.error ?? null,
          pinEnabled: draft?.pinEnabled ?? true,
          videoId: draft?.videoId ?? null,
          videoTitle: draft?.videoTitle ?? null,
          videoUrl: draft?.videoUrl ?? null,
          videoThumbnailUrl: draft?.videoThumbnailUrl ?? null,
          videoDurationSec: draft?.videoDurationSec ?? null,
          pinOrder: draft?.pinOrder ?? parsedBasket.items.length + index + 1,
          pinSeconds: draft?.pinSeconds ?? null,
        };
      }),
    ];
    return rows.slice(0, 200).sort((a, b) => a.pinOrder - b.pinOrder);
  }, [basketProductDrafts, parsedBasket, readyVideos, selectedVideoId]);

  const basketPinSecondValue = basketPinSeconds.trim() === ''
    ? null
    : Math.max(1, Math.round(Number(basketPinSeconds)) || 1);
  const selectedPinCount = basketProducts.filter((item) => item.pinEnabled !== false).length;
  const allBasketProductsSelected = basketProducts.length > 0 && selectedPinCount === basketProducts.length;

  if (!open || !account) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedName = (name || account.name || '').trim();

    if (!selectedVideoId) {
      setError('กรุณาเลือกวิดีโอ READY จากข้อมูลจริงในพื้นที่จัดเก็บก่อนบันทึก');
      return;
    }

    const requestedDuration = Number(liveHours || 0) * 60 + Number(liveMinutes || 0);
    if (autoLive && requestedDuration <= 0) {
      setError('กรุณากรอกเวลาลงไลฟ์ก่อนเปิดระบบลง/ขึ้นอัตโนมัติ');
      return;
    }
    if (autoLive && restartMinutes.trim() === '') {
      setError('กรุณากรอกเวลาขึ้นไลฟ์ใหม่ก่อนเปิดระบบลง/ขึ้นอัตโนมัติ');
      return;
    }
    if (requestedDuration > SHOPEE_MAX_LIVE_MINUTES) {
      setError('ระยะเวลาไลฟ์ต้องไม่เกิน 23 ชั่วโมง 59 นาที ตามลิมิต Shopee');
      return;
    }

    const normalizedVideoQueue = autoLive
      ? videoQueue
        .map((item) => ({
          videoId: item.videoId,
          durationMinutes: Math.round((Number(item.durationHours || 0) * 60) + Number(item.durationMinutes || 0)),
          restartDelayMinutes: Math.round(Number(item.restartDelayMinutes || restartMinutes || 0) || 0),
        }))
        .filter((item) => item.videoId)
      : [];

    const missingQueueDuration = normalizedVideoQueue.find((item) => item.durationMinutes <= 0);
    if (missingQueueDuration) {
      setError('กรุณากรอกเวลาลงไลฟ์ของคิววิดีโอให้ครบ');
      return;
    }

    const invalidQueueItem = normalizedVideoQueue.find((item) => item.durationMinutes > SHOPEE_MAX_LIVE_MINUTES);
    if (invalidQueueItem) {
      setError('ระยะเวลาไลฟ์ในคิวต้องไม่เกิน 23 ชั่วโมง 59 นาที');
      return;
    }

    const basketItemsForSubmit = basketProducts.map((item, index) => ({
      ...item,
      pinOrder: index + 1,
      pinSeconds: basketPinSecondValue ?? item.pinSeconds ?? null,
      pinEnabled: item.pinEnabled !== false,
    }));

    const accountPayload: UpdateLiveChannelPayload = {
      name: trimmedName,
      cookie: cookie.trim() || null,
      proxyId,
      coverImageUrl: coverImageUrl || null,
      liveSessionId: preparedLiveSession.trim() || null,
      basketLinks: basketLinks.trim() || null,
      basketItemsJson: JSON.stringify(basketItemsForSubmit),
      videoQueueJson: JSON.stringify(normalizedVideoQueue),
      caption: caption.trim() || null,
      description: description.trim() || null,
      autoLive,
      liveDurationMinutes: autoLive ? requestedDuration : null,
      restartDelayMinutes: autoLive ? Math.max(Number(restartMinutes || 0), 0) : null,
      scheduledStartAt: null,
      scheduledStopAt: null,
      aiCommentAutoReply,
    };

    if (aiCommentAutoReply && !hasSavedAiCommentApiKey && !aiCommentApiKey.trim()) {
      setError('กรุณากรอก OpenAI API key ก่อนเปิดตอบคอมเมนต์อัตโนมัติ');
      return;
    }

    if (aiCommentApiKeyDirty) {
      accountPayload.aiCommentApiKey = aiCommentApiKey.trim() || null;
    }

    await onSubmit({
      accountId: account.id,
      account: accountPayload,
      selectedVideoId,
    });
  };

  const close = () => {
    if (saving) return;
    setPreviewVideo(null);
    setProductPreview(null);
    setQueueVideoPickerId(null);
    onClose();
  };

  const goNextStep = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setError('');
    setActiveStep((step) => Math.min(5, step + 1));
  };

  const goPreviousStep = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveStep((step) => Math.max(1, step - 1));
  };

  const addVideoQueueRow = () => {
    if (!autoLive) return;
    setVideoQueue((items) => [
      ...items,
      {
        id: `queue-${Date.now()}`,
        videoId: '',
        durationHours: '',
        durationMinutes: '',
        restartDelayMinutes: '',
      },
    ]);
  };

  const updateVideoQueueRow = (id: string, patch: Partial<VideoQueueRow>) => {
    if (!autoLive) return;
    setVideoQueue((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const removeVideoQueueRow = (id: string) => {
    setVideoQueue((items) => {
      const next = items.filter((item) => item.id !== id);
      return next.length ? next : [{
        id: `queue-${Date.now()}`,
        videoId: '',
        durationHours: '',
        durationMinutes: '',
        restartDelayMinutes: '',
      }];
    });
    if (queueVideoPickerId === id) setQueueVideoPickerId(null);
  };
  const updateBasketProduct = (key: string, patch: Partial<BasketProductDraft>) => {
    setBasketProductDrafts((items) => {
      const current = basketProducts.find((item) => item.key === key);
      const existing = items.find((item) => item.key === key);
      const next = {
        ...(current ?? { key, url: '', pinEnabled: true, pinOrder: basketProducts.length + 1, pinSeconds: basketPinSecondValue }),
        ...(existing ?? {}),
        ...patch,
      };
      return [...items.filter((item) => item.key !== key), next];
    });
  };

  const setAllBasketPinEnabled = (enabled: boolean) => {
    setBasketProductDrafts(basketProducts.map((item) => ({
      ...item,
      pinEnabled: enabled,
      pinSeconds: basketPinSecondValue ?? item.pinSeconds ?? null,
    })));
  };

  const clearAllBasketProducts = () => {
    setBasketLinks('');
    setBasketLinkInput('');
    setBasketProductDrafts([]);
    setProductPreview(null);
    setError(null);
  };

  const toggleBasketPinLoop = async () => {
    if (!account || basketPinSyncing) return;
    setBasketPinSyncing(true);
    setError(null);
    try {
      const selectedItems = basketProducts.filter((item) => item.pinEnabled !== false);
      if (!selectedItems.length) {
        setError('กรุณาเลือกสินค้าที่ต้องการปักหมุดก่อน');
        return;
      }

      await accountService.update(account.id, {
        basketLinks: basketLinks.trim() || null,
        basketItemsJson: JSON.stringify(basketProducts.map((item, index) => ({
          ...item,
          pinOrder: index + 1,
          pinSeconds: basketPinSecondValue ?? item.pinSeconds ?? null,
          pinEnabled: item.pinEnabled !== false,
        }))),
      });

      if (basketPinRunning) {
        await accountService.stopShowLoop(account.id);
        setBasketPinRunning(false);
      } else {
        await accountService.startShowLoop(account.id, { defaultSeconds: basketPinSecondValue ?? 60 });
        setBasketPinRunning(true);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'ปักหมุดสินค้าไม่สำเร็จ');
    } finally {
      setBasketPinSyncing(false);
    }
  };

        const removeBasketProductRow = (item: BasketProductDraft) => {
    const nextLinks = basketLinks
      .split(/\r?\n/)
      .map((link) => link.trim())
      .filter((link) => link && link !== item.url);
    setBasketLinks(nextLinks.join('\n'));
    setBasketProductDrafts((drafts) => drafts.filter((draft) => draft.key !== item.key && draft.url !== item.url));
    setError(null);
  };
const addBasketLinkRows = () => {
    const incomingLinks = basketLinkInput.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    if (!incomingLinks.length) {
      setError('กรุณาวางลิงก์สินค้าอย่างน้อย 1 ลิงก์');
      return;
    }

    const currentLinks = basketLinks.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    const seen = new Set(currentLinks);
    const nextLinks = [...currentLinks];
    for (const link of incomingLinks) {
      if (nextLinks.length >= 200) break;
      if (!seen.has(link)) {
        seen.add(link);
        nextLinks.push(link);
      }
    }

    setBasketLinks(nextLinks.join('\n'));
    setBasketLinkInput('');
    setError(null);
  };
const syncBasketProductRows = async () => {
    if (!account) return;
    const links = basketLinks.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 200);
    if (!links.length && !parsedBasket.items.length) {
      setError('กรุณาวางลิงก์สินค้า Shopee ก่อนกดดึงข้อมูลสินค้า');
      return;
    }

    const hasProductDetail = (item: BasketProductDraft) => {
      const hasIdentity = Boolean(item.shopId && item.itemId);
      const hasRealName = Boolean(item.name && !item.name.startsWith('รอดึงข้อมูล') && !item.name.startsWith('สินค้า Shopee '));
      const hasAnyDetail = Boolean(item.image || item.price !== null && item.price !== undefined || item.stock !== null && item.stock !== undefined || item.sold !== null && item.sold !== undefined);
      return !item.error && hasIdentity && hasRealName && hasAnyDetail;
    };

    const rowsToFetch = basketProducts.filter((item) => !hasProductDetail(item));
    if (!rowsToFetch.length) {
      const stableRows = basketProducts.map((item, index) => ({
        ...item,
        pinOrder: index + 1,
        pinSeconds: basketPinSecondValue ?? item.pinSeconds ?? null,
      }));
      setBasketProductDrafts(stableRows);
      setBasketLinks(stableRows.map((item) => item.url).filter(Boolean).join('\n'));
      setError('ไม่มีสินค้าใหม่ที่ต้องดึงข้อมูลแล้ว');
      return;
    }

    const urlsToFetch = rowsToFetch.map((item) => item.url).filter(Boolean);
    const itemsToFetch = rowsToFetch
      .filter((item) => item.itemId)
      .map((item) => ({
        shop_id: item.shopId ?? 0,
        item_id: item.itemId!,
        url: item.url || undefined,
      }));

    setLoadingBasketDetails(true);
    setError(null);
    try {
      const batchSize = 5;
      const fetchedItems: Awaited<ReturnType<typeof accountService.productDetails>>['items'] = [];
      for (let index = 0; index < rowsToFetch.length; index += batchSize) {
        const batchRows = rowsToFetch.slice(index, index + batchSize);
        const batchUrls = batchRows.map((item) => item.url).filter(Boolean);
        const batchItems = batchRows
          .filter((item) => item.itemId)
          .map((item) => ({
            shop_id: item.shopId ?? 0,
            item_id: item.itemId!,
            url: item.url || undefined,
          }));
        const result = await accountService.productDetails(account.id, {
          cookie: cookie.trim() || null,
          productUrls: batchUrls,
          items: batchItems,
        });
        fetchedItems.push(...result.items);
      }

      const fetchedRows = fetchedItems.map((item, index) => {
        const fallbackUrl = urlsToFetch[index] || itemsToFetch[index]?.url || '';
        const key = item.shopId && item.itemId ? `${item.shopId}:${item.itemId}` : `link:${item.url || fallbackUrl || index}`;
        const old = basketProducts.find((entry) => entry.key === key || entry.url === item.url || entry.url === fallbackUrl);
        return {
          key,
          url: item.url || fallbackUrl,
          shopId: item.shopId || old?.shopId || undefined,
          itemId: item.itemId || old?.itemId || undefined,
          image: item.imageUrl ?? item.image ?? old?.image ?? null,
          name: item.name || old?.name || (item.error ? 'ดึงข้อมูลสินค้าไม่สำเร็จ' : `สินค้า Shopee ${item.itemId}`),
          stock: item.stock ?? old?.stock,
          price: item.price ?? old?.price,
          priceMin: item.priceMin ?? old?.priceMin,
          priceMax: item.priceMax ?? old?.priceMax,
          priceBeforeDiscount: item.priceBeforeDiscount ?? old?.priceBeforeDiscount,
          sold: item.sold ?? old?.sold,
          rating: item.rating ?? old?.rating,
          discount: item.discount === null || item.discount === undefined ? old?.discount ?? null : String(item.discount),
          isOutOfStock: item.isOutOfStock ?? old?.isOutOfStock,
          error: item.error,
          pinEnabled: old?.pinEnabled ?? true,
          videoId: item.videoId ?? old?.videoId ?? null,
          videoTitle: item.videoUrl ? 'วิดีโอสินค้า' : old?.videoTitle ?? null,
          videoUrl: item.videoUrl ?? old?.videoUrl ?? null,
          videoThumbnailUrl: item.videoThumbnailUrl ?? old?.videoThumbnailUrl ?? null,
          videoDurationSec: item.videoDurationSec ?? old?.videoDurationSec ?? null,
          pinOrder: old?.pinOrder ?? index + 1,
          pinSeconds: basketPinSecondValue ?? old?.pinSeconds ?? null,
        } satisfies BasketProductDraft;
      });

      if (!fetchedRows.length) throw new Error(fetchedItems[0]?.error || 'Shopee ไม่คืนรายละเอียดสินค้า');

      const fetchedByKey = new Map(fetchedRows.map((item) => [item.key, item]));
      const fetchedByUrl = new Map(fetchedRows.filter((item) => item.url).map((item) => [item.url, item]));
      const usedKeys = new Set<string>();
      const nextRows = basketProducts.map((row, index) => {
        const fetched = fetchedByKey.get(row.key) || (row.url ? fetchedByUrl.get(row.url) : undefined);
        if (!fetched) {
          return {
            ...row,
            pinOrder: index + 1,
            pinSeconds: basketPinSecondValue ?? row.pinSeconds ?? null,
          };
        }
        usedKeys.add(fetched.key);
        return {
          ...fetched,
          pinEnabled: row.pinEnabled ?? fetched.pinEnabled ?? true,
          pinOrder: index + 1,
          pinSeconds: basketPinSecondValue ?? row.pinSeconds ?? fetched.pinSeconds ?? null,
        };
      });

      for (const item of fetchedRows) {
        if (!usedKeys.has(item.key)) {
          nextRows.push({ ...item, pinOrder: nextRows.length + 1 });
        }
      }

      const failed = fetchedRows.filter((item) => item.error).length;
      if (failed) setError(`มีสินค้า ${failed} รายการที่ดึงไม่สำเร็จ ดูสาเหตุในแถวสินค้า`);
      setBasketProductDrafts(nextRows);
      setBasketLinks(nextRows.map((item) => item.url).filter(Boolean).join('\n'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ดึงข้อมูลสินค้าไม่สำเร็จ';
      setError(message);
    } finally {
      setLoadingBasketDetails(false);
    }
  };
  const handleCoverChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowTypes.includes(file.type)) {
      setError('รูปภาพหน้าปกต้องเป็น JPG, PNG หรือ WebP เท่านั้น');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('รูปภาพหน้าปกต้องมีขนาดไม่เกิน 5MB');
      event.target.value = '';
      return;
    }

    try {
      const resized = await resizeCoverImage(file);
      setCoverImageUrl(resized);
      setCoverFileName(`${file.name} (ย่อขนาดแล้ว)`);
      setError(null);
    } catch {
      setError('อ่านไฟล์รูปภาพหน้าปกไม่สำเร็จ กรุณาเลือกไฟล์ใหม่');
      event.target.value = '';
    }
  };

  const handleAiKeyChange = (value: string) => {
    setAiCommentApiKey(value);
    setAiCommentApiKeyDirty(true);
    setAiKeyStatus('idle');
    setAiKeyMessage('');
  };

  const checkAiKey = async () => {
    setAiKeyChecking(true);
    setAiKeyStatus('idle');
    try {
      const key = aiCommentApiKey.trim();
      if (!key) {
        setAiKeyStatus('error');
        setAiKeyMessage('กรุณากรอก OpenAI API key ก่อนตรวจสอบ');
        return;
      }
      await accountService.checkAiKey(key);
      setAiKeyStatus('success');
      setAiKeyMessage('พร้อมใช้งาน (gpt-4o-mini)');
    } catch (err) {
      setAiKeyStatus('error');
      setAiKeyMessage(err instanceof Error ? err.message : 'ตรวจสอบ OpenAI API key ไม่สำเร็จ');
    } finally {
      setAiKeyChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 px-6 py-6 backdrop-blur-[5px]">
      <form onSubmit={submit} className="relative flex h-[calc(100vh-170px)] min-h-[620px] w-full max-w-[1360px] flex-col overflow-hidden rounded-[22px] border border-[#c7962d]/65 bg-[radial-gradient(circle_at_8%_0%,rgba(45,167,255,.24),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(242,189,75,.20),transparent_32%),linear-gradient(135deg,#07111f_0%,#05070b_52%,#171004_100%)] shadow-[0_32px_100px_rgba(0,0,0,.66),0_0_40px_rgba(45,167,255,.10),inset_0_1px_0_rgba(255,255,255,.08)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[#c7962d]/30 bg-black/12 px-7 py-5">
          <div>
            <h2 className="text-[22px] font-black text-white drop-shadow-[0_2px_12px_rgba(45,167,255,.16)]">แก้ไขข้อมูลบัญชี</h2>
          </div>
          <button type="button" onClick={close} disabled={saving} className="text-[#c9c2b6] transition hover:text-[#f7f1e7] disabled:opacity-50"><X size={22} /></button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-7 py-5">
          {error ? <div className="mb-4 rounded-xl border border-[#ff766f]/40 bg-[#3a0d11] px-5 py-3 text-[13px] font-semibold text-[#ffaaa1]">{error}</div> : null}

          <div className="mb-3 grid shrink-0 gap-2 md:grid-cols-5">
            <StepPill index={1} title="คุกกี้" active={activeStep === 1} done={Boolean(cookie.trim())} onClick={() => setActiveStep(1)} />
            <StepPill index={2} title="เลือกวิดีโอ" active={activeStep === 2} done={Boolean(selectedVideoId)} onClick={() => setActiveStep(2)} />
            <StepPill index={3} title="ข้อมูลไลฟ์" active={activeStep === 3} done={Boolean(caption.trim() || description.trim() || coverImageUrl)} onClick={() => setActiveStep(3)} />
            <StepPill index={4} title="ตะกร้าสินค้า" active={activeStep === 4} done={parsedBasket.items.length > 0 || parsedBasket.pending.length > 0} onClick={() => setActiveStep(4)} />
            <StepPill index={5} title="ตอบคอมเมนต์ AI" active={activeStep === 5} done={aiCommentAutoReply || Boolean(aiCommentApiKey.trim())} onClick={() => setActiveStep(5)} />
          </div>

          {activeStep === 1 ? (
            <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[#c7962d]/32 bg-black/[0.38] p-5">
              <FieldLabel required>คุกกี้</FieldLabel>
              <div className="relative min-h-0 flex-1">
                <Cookie size={15} className="absolute left-3 top-3.5 text-[#ffd46c]" />
                <TextArea value={cookie} onChange={(event) => setCookie(event.target.value)} placeholder="คุกกี้ที่บันทึกไว้ตอนเพิ่มบัญชี" className="h-full min-h-0 resize-none overflow-y-auto pl-10 font-mono text-[12px] leading-5 text-[#e7ded2]" />
              </div>
            </section>
          ) : null}

          {activeStep === 2 ? (
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#c7962d]/32 bg-black/[0.38] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div><FieldLabel required>เลือกวิดีโอ</FieldLabel><div className="text-[12px] font-semibold text-[#8f877b]">เลือกไฟล์ READY ที่จะใช้ขึ้นไลฟ์</div></div>
                <div className="text-[12px] font-black text-[#ffd46c]">{readyVideos.length} วิดีโอพร้อมเล่น</div>
                {loadingVideos ? <Loader2 size={18} className="animate-spin text-[#ffd46c]" /> : null}
              </div>
              <div className="grid min-h-0 flex-1 auto-rows-max gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-4">
                {readyVideos.map((video) => {
                  const active = selectedVideoId === video.id;
                  const previewUrl = getVideoPreviewUrl(video);
                  return (
                    <div key={video.id} onClick={() => setSelectedVideoId(video.id)} className={`relative overflow-hidden rounded-xl border p-2 text-left transition ${active ? 'border-[#e3aa3a] bg-[#2a1d0b]' : 'border-[#c7962d]/32 bg-[#090908] hover:border-[#e3aa3a]/70'}`}>
                      <div className="relative overflow-hidden rounded-lg bg-black">
                        {previewUrl ? <video src={previewUrl} controls preload="metadata" playsInline className="aspect-video w-full bg-black object-contain" onClick={(event) => event.stopPropagation()} /> : <div className="grid aspect-video place-items-center text-[#8f877b]"><FileVideo size={28} /></div>}
                        <span className="absolute left-2 top-2 rounded-full bg-[linear-gradient(135deg,#ffd46c,#e5a928)] px-2 py-0.5 text-[9px] font-black text-[#1b1104]">READY</span>
                        <span className="absolute bottom-2 right-2 rounded-full bg-[#2a1608] px-2 py-0.5 text-[9px] font-black text-[#f7f1e7]">{formatDuration(video.durationSec)}</span>
                      </div>
                      <div className="mt-2 rounded-lg bg-[#17130f] p-3">
                        <div className="truncate text-[12px] font-black text-[#f7f1e7]">{video.title}</div>
                        <div className="mt-1 truncate font-mono text-[10px] font-bold text-[#8f877b]">ID: {video.id}</div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-[#07111f]/62 p-2"><div className="text-[10px] font-bold text-[#8f877b]">ขนาดไฟล์</div><div className="mt-1 text-[11px] font-black text-[#f7f1e7]">{formatSize(video.sizeMb)}</div></div>
                        <div className="rounded-lg bg-[#07111f]/62 p-2"><div className="text-[10px] font-bold text-[#8f877b]">เวลา</div><div className="mt-1 text-[11px] font-black text-[#f7f1e7]">{formatDuration(video.durationSec)}</div></div>
                      </div>
                      <span className={`absolute bottom-2 right-2 h-5 w-5 rounded-full border ${active ? 'border-[#e3aa3a] bg-[linear-gradient(135deg,#ffd46c,#e5a928)]' : 'border-[#8f877b] bg-[#090908]'}`}>{active ? <Check size={14} className="m-0.5 text-[#1b1104]" /> : null}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {activeStep === 3 ? (
            <section className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[#c7962d]/32 bg-black/[0.38] p-5">
              <div className="grid items-start gap-4 xl:grid-cols-3">
                <div><FieldLabel>แคปชั่น</FieldLabel><TextArea value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="แคปชั่นไลฟ์" className="min-h-[112px] resize-none" /></div>
                <div><FieldLabel>คำอธิบายวิดีโอ</FieldLabel><TextArea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="คำอธิบายวิดีโอ" className="min-h-[112px] resize-none" /></div>
                <div><FieldLabel>พร็อกซี่สำหรับช่องนี้</FieldLabel>
                  <div className="h-[88px] rounded-lg border border-[#c7962d]/32 bg-black/[0.38] p-2 focus-within:border-[#2da7ff]">
                    <select
                      value={proxyId ?? ''}
                      onChange={(event) => setProxyId(event.target.value || null)}
                      className="h-9 w-full rounded-md border border-[#c7962d]/28 bg-[#080807] px-3 text-[13px] font-black text-[#f7f1e7] outline-none"
                    >
                      <option value="">ไม่ใช้พร็อกซี่</option>
                      {proxies.map((proxy) => (
                        <option key={proxy.id} value={proxy.id}>{proxy.host + ':' + proxy.port + (proxy.note ? ' - ' + proxy.note : '') + (proxy.status === 'ACTIVE' ? ' (พร้อมใช้)' : proxy.status === 'INACTIVE' ? ' (ใช้ไม่ได้)' : ' (รอตรวจสอบ)')}</option>
                      ))}
                    </select>
                    <div className="mt-2 truncate px-1 text-[12px] font-black text-[#f7f1e7]">
                      {selectedProxy ? selectedProxy.host + ':' + selectedProxy.port : 'ไม่ใช้พร็อกซี่'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,610px)_minmax(420px,1fr)]">
                <div>
                  <label className="inline-flex items-center gap-2 rounded-lg border border-[#c7962d]/32 bg-[#07111f]/62 px-3 py-2 text-[12px] font-black text-[#f7f1e7]"><input type="checkbox" checked={autoLive} onChange={(event) => setAutoLive(event.target.checked)} className="h-4 w-4 accent-[#e3aa3a]" /> เปิดระบบลงไลฟ์และขึ้นไลฟ์ใหม่อัตโนมัติ</label>
                  <div className="mt-4 grid gap-4 sm:grid-cols-[max-content_max-content]">
                    <div>
                      <FieldLabel>เวลาลงไลฟ์</FieldLabel>
                      <div className="grid grid-cols-[110px_auto_110px_auto] items-center gap-2">
                        <TextInput disabled={!autoLive} value={liveHours} onChange={(event) => setLiveHours(event.target.value.replace(/\D/g, ''))} className="w-[110px]" />
                        <span className="text-[12px] font-bold text-[#9d968d]">ชม.</span>
                        <TextInput disabled={!autoLive} value={liveMinutes} onChange={(event) => setLiveMinutes(event.target.value.replace(/\D/g, ''))} className="w-[110px]" />
                        <span className="text-[12px] font-bold text-[#9d968d]">นาที</span>
                      </div>
                    </div>
                    <div>
                      <FieldLabel>ขึ้นไลฟ์ใหม่</FieldLabel>
                      <div className="grid grid-cols-[120px_auto] items-center gap-2">
                        <TextInput disabled={!autoLive} value={restartMinutes} onChange={(event) => setRestartMinutes(event.target.value.replace(/\D/g, ''))} className="w-[120px]" />
                        <span className="text-[12px] font-bold text-[#9d968d]">นาที</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <FieldLabel>ภาพปกไลฟ์</FieldLabel>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => void handleCoverChange(event)}
                    className="hidden"
                  />
                  <div className="flex min-h-[122px] items-center justify-between gap-4 rounded-xl border border-[#f7f1e7]/80 bg-black/[0.24] px-4 py-3">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="grid h-[92px] w-[92px] shrink-0 place-items-center overflow-hidden rounded-xl border border-[#c7962d]/45 bg-[#070706]">
                        {coverImageUrl ? (
                          <img src={coverImageUrl} alt="รูปภาพหน้าปก Shopee Live" className="h-full w-full object-cover" />
                        ) : (
                          <FileImage size={30} className="text-[#8f877b]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-black text-[#f7f1e7]">{coverFileName || 'ยังไม่มีรูปหน้าปก'}</div>
                        <div className="mt-1 text-[11px] font-bold text-[#9d968d]">JPG, PNG, WebP ไม่เกิน 5MB</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[linear-gradient(135deg,#ffd46c,#e5a928)] px-4 text-[12px] font-black text-[#1b1104]"
                      >
                        <UploadCloud size={15} /> เลือกภาพ
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCoverImageUrl('');
                          setCoverFileName('');
                          if (coverInputRef.current) coverInputRef.current.value = '';
                        }}
                        disabled={!coverImageUrl}
                        className="grid h-10 w-10 place-items-center rounded-lg border border-[#5b241f] bg-[#210d0b] text-[#ffaaa1] transition hover:border-[#ff766f] hover:text-[#ffd6d2] disabled:opacity-40"
                        aria-label="ลบรูปภาพหน้าปก"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-5 rounded-xl border border-[#c7962d]/32 bg-[#090908]">
                <div className="flex items-center justify-between gap-3 border-b border-[#c7962d]/32 bg-[#07111f]/62 px-4 py-3">
                  <div>
                    <div className="text-[13px] font-black text-[#f7f1e7]">คิววิดีโอถัดไป</div>
                    <div className="mt-1 text-[11px] font-bold text-[#8f877b]">ถ้ามีคิว ระบบจะเปลี่ยนคลิปให้ตอนขึ้นไลฟ์รอบถัดไป</div>
                  </div>
                  <button type="button" onClick={addVideoQueueRow} disabled={!autoLive} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[linear-gradient(135deg,#ffd46c,#e5a928)] px-4 text-[12px] font-black text-[#1b1104] disabled:opacity-40"><Plus size={15} /> เพิ่มคิว</button>
                </div>                <div className="p-3">
                  <div className="grid gap-3 lg:grid-cols-2">
                    {videoQueue.map((item, index) => {
                      const selectedQueueVideo = readyVideos.find((video) => video.id === item.videoId);
                      const previewUrl = selectedQueueVideo ? getVideoPreviewUrl(selectedQueueVideo) : '';
                      const openPicker = () => {
                        setQueueVideoPickerId(item.id);
                      };
                      return (
                        <div key={item.id} className="grid grid-cols-[34px_78px_minmax(0,1fr)_34px] items-center gap-3 rounded-xl border border-[#3b2a12] bg-[#070706] p-3 text-[12px] font-bold text-[#c9c2b6]">
                          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#17100a] text-[13px] font-black text-[#ffd46c]">{index + 1}</div>
                          <button type="button" onClick={openPicker} className="grid h-[116px] w-[66px] place-items-center overflow-hidden rounded-xl border border-[#c7962d]/32 bg-black shadow-[inset_0_0_0_1px_rgba(227,170,58,.08)] transition hover:border-[#e3aa3a]" title="เลือกวิดีโอ">
                            {previewUrl ? <video src={previewUrl} preload="metadata" muted playsInline className="h-full w-full object-contain" /> : <Plus size={24} className="text-[#ffd46c]" />}
                          </button>
                          <div className="grid min-w-0 gap-2">
                            <div className="grid grid-cols-[1fr_104px] gap-2">
                              <div className="rounded-lg border border-[#3b2a12] bg-[#0c0b09] px-2 py-1.5">
                                <div className="mb-1 text-[10px] font-black text-[#ffd46c]">ลงไลฟ์</div>
                                <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1.5">
                                  <input disabled={!autoLive} inputMode="numeric" pattern="[0-9]*" value={item.durationHours} onChange={(event) => updateVideoQueueRow(item.id, { durationHours: event.target.value.replace(/\D/g, '') })} className="h-7 min-w-0 bg-transparent text-center text-[13px] font-black text-[#f7f1e7] outline-none" />
                                  <span className="text-[10px] font-bold text-[#8f877b]">ชม.</span>
                                  <input disabled={!autoLive} inputMode="numeric" pattern="[0-9]*" value={item.durationMinutes} onChange={(event) => updateVideoQueueRow(item.id, { durationMinutes: event.target.value.replace(/\D/g, '') })} className="h-7 min-w-0 bg-transparent text-center text-[13px] font-black text-[#f7f1e7] outline-none" />
                                  <span className="text-[10px] font-bold text-[#8f877b]">นาที</span>
                                </div>
                              </div>
                              <label className="rounded-lg border border-[#3b2a12] bg-[#0c0b09] px-2 py-1.5">
                                <div className="mb-1 text-[10px] font-black text-[#ffd46c]">รอถัดไป</div>
                                <div className="grid grid-cols-[1fr_auto] items-center gap-1.5">
                                  <input disabled={!autoLive} inputMode="numeric" pattern="[0-9]*" value={item.restartDelayMinutes} onChange={(event) => updateVideoQueueRow(item.id, { restartDelayMinutes: event.target.value.replace(/\D/g, '') })} className="h-7 min-w-0 bg-transparent text-center text-[13px] font-black text-[#f7f1e7] outline-none" />
                                  <span className="text-[10px] font-bold text-[#8f877b]">นาที</span>
                                </div>
                              </label>
                            </div>
                            {!selectedQueueVideo && item.videoId ? <div className="rounded-lg border border-[#5b241f] bg-[#210d0b] px-3 py-2 text-[11px] text-[#ffaaa1]">วิดีโอในคิวนี้ไม่พร้อมหรือถูกลบแล้ว กรุณาเลือกใหม่</div> : null}
                          </div>
                          <button type="button" onClick={() => removeVideoQueueRow(item.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#5b241f] bg-[#210d0b] text-[#ffaaa1] transition hover:border-[#ff766f] hover:text-[#ffd6d2]" title="ลบคิว"><Trash2 size={13} /></button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {activeStep === 4 ? (
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#c7962d]/32 bg-black/[0.38]">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#c7962d]/32 bg-[#07111f]/62 px-5 py-3">
                <div>
                  <FieldLabel>ตะกร้าสินค้า</FieldLabel>
                  <div className="text-[13px] font-extrabold text-[#f7f1e7]">รายละเอียดสินค้าและปักหมุด</div>
                  <div className="mt-1 text-[11px] font-bold text-[#8f877b]">เลือกปัก {selectedPinCount}/{basketProducts.length} รายการ</div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <label className="inline-flex h-9 w-[108px] items-center justify-center gap-1.5 rounded-lg border border-[#c7962d]/32 bg-black/[0.38] px-2 text-[11px] font-black text-[#c9c2b6]"><input inputMode="numeric" pattern="[0-9]*" value={basketPinSeconds} onChange={(event) => setBasketPinSeconds(event.target.value.replace(/\D/g, ''))} className="h-6 w-10 bg-transparent px-0 text-center text-[12px] font-black text-[#f7f1e7] outline-none" />วินาที</label>
                  <button type="button" onClick={() => setAllBasketPinEnabled(!allBasketProductsSelected)} disabled={!basketProducts.length} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[#c7962d]/32 bg-[#171410] px-3 text-[12px] font-black text-[#f7f1e7] disabled:opacity-40">{allBasketProductsSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}</button>
                  <button type="button" onClick={clearAllBasketProducts} disabled={!basketProducts.length && !basketLinks.trim() && !basketLinkInput.trim()} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[#5b241f] bg-[#210d0b] px-3 text-[12px] font-black text-[#ffaaa1] transition hover:border-[#ff766f] hover:text-[#ffd6d2] disabled:opacity-40"><Trash2 size={14} /> ลบทั้งหมด</button>
                  <button type="button" onClick={toggleBasketPinLoop} disabled={!selectedPinCount || basketPinSyncing} className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-4 text-[12px] font-black ${basketPinRunning ? 'bg-[#5a1515] text-[#ffd6d2]' : 'bg-[linear-gradient(135deg,#ffd46c,#e5a928)] text-[#1b1104]'} disabled:opacity-40`}>{basketPinSyncing ? <Loader2 size={15} className="animate-spin" /> : <Pin size={15} />} {basketPinSyncing ? 'กำลัง...' : basketPinRunning ? 'กำลังปักหมุด' : 'ปักหมุด'}</button>
                  <button type="button" onClick={() => void syncBasketProductRows()} disabled={loadingBasketDetails} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[linear-gradient(135deg,#ffd46c,#e5a928)] px-4 text-[12px] font-black text-[#1b1104]">{loadingBasketDetails ? <Loader2 size={15} className="animate-spin" /> : <PackageSearch size={15} />} ดึงข้อมูลสินค้า</button>
                </div>
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px]">
                <div className="min-h-0 overflow-hidden bg-[#090908] p-4">
                  {basketProducts.length === 0 ? <div className="grid h-full place-items-center rounded-xl border border-dashed border-[#c7962d]/32 bg-black/[0.38] p-6 text-center text-[13px] font-bold text-[#8f877b]">วางลิงก์ด้านขวา แล้วกดเพิ่มลิงก์ รายละเอียดจะแสดงเป็นตารางตรงนี้</div> : (
                    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#c7962d]/32">
                      <div className="grid shrink-0 grid-cols-[46px_52px_minmax(210px,1.2fr)_minmax(140px,.8fr)_64px_80px_64px_70px_44px] border-b border-[#c7962d]/32 bg-[#15120d] px-3 py-2 text-[10px] font-black text-[#ffd46c] shadow-[0_8px_18px_rgba(0,0,0,.35)]"><span>ลำดับ</span><span>รูป</span><span>สินค้า</span><span>ลิงก์</span><span>คลัง</span><span>ราคา</span><span>ขาย</span><span>ปักหมุด</span><span>ลบ</span></div>
                      <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-[#2d2110]">{basketProducts.map((item, index) => (<div key={item.key} className="grid grid-cols-[46px_52px_minmax(210px,1.2fr)_minmax(140px,.8fr)_64px_80px_64px_70px_44px] items-center gap-0 px-3 py-2 text-[11px] font-bold text-[#c9c2b6]"><span className="text-[#ffd46c]">{index + 1}</span><div className="grid h-11 w-11 place-items-center overflow-hidden rounded-lg border border-[#4e3816] bg-[#080807]">{item.image ? <img src={item.image} alt={item.name ?? 'สินค้า'} className="h-full w-full object-contain" /> : <ShoppingBag size={18} className="text-[#7f786f]" />}</div><div className="min-w-0 pr-3"><div className="truncate text-[12px] font-black text-[#f7f1e7]">{item.name}</div><div className="mt-0.5 truncate font-mono text-[9px] text-[#7f786f]">{item.shopId && item.itemId ? `${item.shopId}/${item.itemId}` : 'รอแปลงลิงก์'}</div>{item.error ? <div className="mt-0.5 truncate text-[9px] text-[#ffaaa1]">สาเหตุ: {item.error}</div> : <div className="mt-0.5 truncate text-[9px] text-[#9d968d]">วิดีโอ: {item.videoUrl ? 'มีวิดีโอสินค้า' : 'ไม่มีวิดีโอสินค้า'}</div>}</div><div className="min-w-0 pr-2 font-mono text-[10px] text-[#9d968d]"><div className="truncate" title={item.url}>{item.url || '-'}</div>{item.videoUrl ? <button type="button" onClick={() => setProductPreview(item)} className="mt-1 inline-flex h-6 items-center justify-center rounded-md border border-[#c7962d]/32 bg-[#171410] px-2 text-[10px] font-black text-[#ffd46c]">ดูวิดีโอ</button> : null}</div><span>{item.error ? '-' : item.stock ?? '-'}</span><span className="text-[#ffd46c]">{item.error ? '-' : formatMoney(item.price ?? item.priceMin)}</span><span>{item.error ? '-' : item.sold ?? '-'}</span><label className="flex h-9 w-9 items-center justify-center rounded-md border border-[#c7962d]/32 bg-black/[0.38]"><input type="checkbox" checked={item.pinEnabled !== false} onChange={(event) => updateBasketProduct(item.key, { pinEnabled: event.target.checked, pinSeconds: basketPinSecondValue })} className="h-4 w-4 accent-[#e3aa3a]" /></label><button type="button" onClick={() => removeBasketProductRow(item)} className="grid h-9 w-9 place-items-center rounded-md border border-[#5b241f] bg-[#210d0b] text-[#ffaaa1] transition hover:border-[#ff766f] hover:text-[#ffd6d2]" title="ลบสินค้า"><Trash2 size={14} /></button></div>))}</div>
                    </div>
                  )}
                  {parsedBasket.invalid.length ? <div className="mt-2 rounded-xl border border-[#e3aa3a]/40 bg-[#2d1e0e] px-4 py-3 text-[12px] font-bold text-[#f3d48a]">มีข้อความที่ไม่ใช่ลิงก์ Shopee {parsedBasket.invalid.length} บรรทัด ระบบจะข้ามตอนขึ้นไลฟ์</div> : null}
                </div>
                <aside className="flex min-h-0 flex-col border-l border-[#c7962d]/32 bg-[#0a0a09] p-4">
                  <div className="mb-3 flex items-center gap-2 text-[13px] font-extrabold text-[#f7f1e7]"><Link2 size={16} className="text-[#ffd46c]" />เพิ่มลิงก์สินค้า</div>
                  <TextArea value={basketLinkInput} onChange={(event) => setBasketLinkInput(event.target.value)} placeholder={'วางลิงก์สินค้า Shopee\n1 บรรทัด / 1 ลิงก์'} className="min-h-0 flex-1 resize-none overflow-y-auto font-mono text-[12px] leading-5" />
                  <button type="button" onClick={addBasketLinkRows} className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[linear-gradient(135deg,#ffd46c,#e5a928)] px-4 text-[12px] font-black text-[#1b1104]"><Link2 size={15} /> เพิ่มลิงก์</button>
                  <div className="mt-3 rounded-lg border border-[#c7962d]/32 bg-[#07111f]/62 px-3 py-2 text-[11px] font-bold leading-5 text-[#9d968d]">เพิ่มได้สูงสุด 200 รายการ · ลิงก์ซ้ำจะถูกข้าม</div>
                  <div className="mt-3 min-h-0 overflow-y-auto rounded-lg border border-[#c7962d]/32 bg-[#080807] p-3 font-mono text-[10px] leading-5 text-[#9d968d]">{basketLinks ? basketLinks : 'ยังไม่มีลิงก์ในตะกร้า'}</div>
                </aside>
              </div>
            </section>
          ) : null}

          {activeStep === 5 ? (
            <section className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[#c7962d]/32 bg-black/[0.38] p-5">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#2da7ff]/40 bg-[#07111f]/75 px-3 py-1 text-[11px] font-black tracking-[0.16em] text-[#79c9ff]">
                    <Bot size={14} /> AI COMMENT REPLY
                  </div>
                  <h3 className="text-[28px] font-black leading-tight text-[#f7f1e7]">ตอบคอมเมนต์อัตโนมัติ</h3>
                  <p className="mt-3 max-w-3xl text-[13px] font-semibold leading-6 text-[#c9c2b6]">
                    ใช้ API key นี้สร้างคำตอบจากข้อมูลสินค้าในตะกร้าของบัญชีไลฟ์นี้ ลูกค้าถามราคา สต๊อก หรือชื่อสินค้า ระบบจะสร้างคำตอบให้ตามข้อมูลจริง
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAiCommentAutoReply((value) => !value)}
                  className={`inline-flex h-12 min-w-[210px] items-center justify-center gap-3 rounded-xl border px-5 text-[13px] font-black transition ${aiCommentAutoReply ? 'border-[#2da7ff] bg-[#083b76] text-white shadow-[0_0_22px_rgba(45,167,255,.18)]' : 'border-[#c7962d]/32 bg-[#171410] text-[#c9c2b6]'}`}
                >
                  <span className={`grid h-5 w-5 place-items-center rounded border ${aiCommentAutoReply ? 'border-[#2da7ff] bg-[#2da7ff]' : 'border-[#8f877b] bg-black/40'}`}>
                    {aiCommentAutoReply ? <Check size={14} /> : null}
                  </span>
                  เปิดตอบอัตโนมัติ
                </button>
              </div>

              <div className="rounded-2xl border border-[#f7f1e7]/70 bg-black/[0.22] p-4">
                <FieldLabel>OpenAI API key</FieldLabel>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-4 top-3.5 text-[#ffd46c]" />
                  <TextInput
                    type="password"
                    value={aiCommentApiKey}
                    onChange={(event) => handleAiKeyChange(event.target.value)}
                    placeholder="sk-..."
                    className="pl-11 font-mono tracking-[0.16em]"
                  />
                </div>
                <div className="mt-3 rounded-xl border border-[#f7f1e7]/55 bg-black/[0.32] px-4 py-3 text-[12px] font-bold text-[#9fb1c9]">
                  {hasSavedAiCommentApiKey
                    ? 'บัญชีนี้มี key บันทึกไว้แล้ว ช่องนี้จะเว้นว่างเพื่อความปลอดภัย ถ้าวาง key ใหม่จะเป็นการแทนที่ key เดิม'
                    : 'ยังไม่มี key บันทึกไว้ กรุณาวาง OpenAI API key จริงก่อนเปิดใช้งาน'}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void checkAiKey()}
                    disabled={aiKeyChecking}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#168cff] px-4 text-[12px] font-black text-white disabled:opacity-60"
                  >
                    {aiKeyChecking ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} ตรวจสอบ API key
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleAiKeyChange('');
                      setAiKeyStatus('idle');
                      setAiKeyMessage('');
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#f7f1e7]/70 bg-black/[0.28] px-4 text-[12px] font-black text-[#f7f1e7]"
                  >
                    ล้างช่องกรอก
                  </button>
                </div>
                {aiKeyStatus !== 'idle' ? (
                  <div className={`mt-3 rounded-xl border px-4 py-3 text-[12px] font-black ${aiKeyStatus === 'success' ? 'border-[#159a58] bg-[#04391f] text-[#9cf2b8]' : 'border-[#ff766f]/60 bg-[#4a0e12] text-[#ffaaa1]'}`}>
                    {aiKeyMessage}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-[#c7962d]/32 px-7 py-5">
          <button type="button" onClick={goPreviousStep} disabled={saving || activeStep === 1} className="rounded-lg px-4 py-2 text-[14px] font-bold text-[#e7ded2] transition hover:text-[#f7f1e7] disabled:opacity-35">ย้อนกลับ</button>
          <div className="flex items-center gap-4">
            <button type="button" onClick={close} disabled={saving} className="rounded-lg px-4 py-2 text-[14px] font-bold text-[#e7ded2] transition hover:text-[#f7f1e7] disabled:opacity-50">ยกเลิก</button>
            {activeStep < 5 ? (
              <button type="button" onClick={goNextStep} disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[linear-gradient(135deg,#ffd46c,#e5a928)] px-6 text-[13px] font-extrabold text-[#1b1104] disabled:opacity-50">ถัดไป <ChevronDown size={16} className="-rotate-90" /></button>
            ) : (
              <button type="submit" disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[linear-gradient(135deg,#ffd46c,#e5a928)] px-6 text-[13px] font-extrabold text-[#1b1104] disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}</button>
            )}
          </div>
        </div>
      </form>

        {queueVideoPickerId ? (() => {
          const queueItem = videoQueue.find((item) => item.id === queueVideoPickerId);
          if (!queueItem) return null;
          return (
            <div className="fixed inset-0 z-[70] grid place-items-center bg-black/72 px-4 py-6 backdrop-blur-sm" onClick={() => setQueueVideoPickerId(null)}>
              <div className="flex max-h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#c7962d]/32 bg-black/[0.38] shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <div className="flex shrink-0 items-center justify-between border-b border-[#c7962d]/32 px-5 py-4">
                  <div>
                    <div className="text-[15px] font-black text-[#f7f1e7]">เลือกวิดีโอสำหรับคิว</div>
                    <div className="mt-1 text-[12px] font-bold text-[#8f877b]">เลือกจากวิดีโอ READY ในระบบ</div>
                  </div>
                  <button type="button" onClick={() => setQueueVideoPickerId(null)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#c7962d]/32 text-[#c9c2b6] transition hover:border-[#e3aa3a] hover:text-[#f7f1e7]"><X size={18} /></button>
                </div>
                <div className="grid min-h-0 flex-1 auto-rows-max gap-3 overflow-y-auto p-5 md:grid-cols-2 xl:grid-cols-3">
                  {readyVideos.map((video) => {
                    const active = queueItem.videoId === video.id;
                    const previewUrl = getVideoPreviewUrl(video);
                    return (
                      <button key={video.id} type="button" onClick={() => { if (!autoLive) return; updateVideoQueueRow(queueVideoPickerId, { videoId: video.id }); setQueueVideoPickerId(null); }} className={`relative overflow-hidden rounded-xl border p-2 text-left transition ${active ? 'border-[#e3aa3a] bg-[#2a1d0b]' : 'border-[#c7962d]/32 bg-[#090908] hover:border-[#e3aa3a]/70'}`}>
                        <div className="relative overflow-hidden rounded-lg bg-black">
                          {previewUrl ? <video src={previewUrl} preload="metadata" muted playsInline className="aspect-video w-full bg-black object-contain" /> : <div className="grid aspect-video place-items-center text-[#8f877b]"><FileVideo size={28} /></div>}
                          <span className="absolute left-2 top-2 rounded-full bg-[linear-gradient(135deg,#ffd46c,#e5a928)] px-2 py-0.5 text-[9px] font-black text-[#1b1104]">READY</span>
                          <span className="absolute bottom-2 right-2 rounded-full bg-[#2a1608] px-2 py-0.5 text-[9px] font-black text-[#f7f1e7]">{formatDuration(video.durationSec)}</span>
                        </div>
                        <div className="mt-2 rounded-lg bg-[#17130f] p-3">
                          <div className="truncate text-[12px] font-black text-[#f7f1e7]">{video.title}</div>
                          <div className="mt-1 truncate font-mono text-[10px] font-bold text-[#8f877b]">ID: {video.id}</div>
                        </div>
                        <span className={`absolute bottom-3 right-3 grid h-5 w-5 place-items-center rounded-full border ${active ? 'border-[#e3aa3a] bg-[linear-gradient(135deg,#ffd46c,#e5a928)]' : 'border-[#8f877b] bg-[#090908]'}`}>{active ? <Check size={14} className="text-[#1b1104]" /> : null}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })() : null}
        {productPreview ? (
          <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/80 px-5 py-6 backdrop-blur-sm" onClick={() => setProductPreview(null)}>
            <div className="w-full max-w-[760px] overflow-hidden rounded-2xl border border-[#6c4e1c]/80 bg-[#07111f]/62 shadow-[0_28px_90px_rgba(0,0,0,.62)]" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-4 border-b border-[#c7962d]/32 px-5 py-4">
                <div className="min-w-0"><div className="truncate text-[14px] font-black text-[#f7f1e7]">{productPreview.name ?? 'วิดีโอสินค้า'}</div><div className="mt-1 text-[11px] font-bold text-[#8f877b]">วิดีโอที่ดึงจากลิงก์สินค้า · {formatDuration(productPreview.videoDurationSec)}</div></div>
                <button type="button" onClick={() => setProductPreview(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#c7962d]/32 text-[#c9c2b6] transition hover:border-[#e3aa3a] hover:text-[#f7f1e7]"><X size={18} /></button>
              </div>
              <div className="bg-black p-3">
                {productPreview.videoUrl ? <video src={productPreview.videoUrl} poster={productPreview.videoThumbnailUrl || undefined} controls autoPlay playsInline className="max-h-[72vh] w-full rounded-xl bg-black object-contain" /> : <div className="grid h-[360px] place-items-center text-[13px] font-bold text-[#9d968d]">ไม่มีวิดีโอสินค้าสำหรับพรีวิว</div>}
              </div>
            </div>
          </div>
        ) : null}

        {previewVideo ? (() => {
          const previewUrl = getVideoPreviewUrl(previewVideo);
          return (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-5 py-6 backdrop-blur-sm" onClick={() => setPreviewVideo(null)}>
              <div className="w-full max-w-[920px] overflow-hidden rounded-2xl border border-[#6c4e1c]/80 bg-[#07111f]/62 shadow-[0_28px_90px_rgba(0,0,0,.62)]" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between gap-4 border-b border-[#c7962d]/32 px-5 py-4">
                  <div className="min-w-0"><div className="truncate text-[14px] font-black text-[#f7f1e7]">{previewVideo.title}</div><div className="mt-1 text-[11px] font-bold text-[#8f877b]">{formatDuration(previewVideo.durationSec)} · {formatSize(previewVideo.sizeMb)}</div></div>
                  <button type="button" onClick={() => setPreviewVideo(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#c7962d]/32 text-[#c9c2b6] transition hover:border-[#e3aa3a] hover:text-[#f7f1e7]"><X size={18} /></button>
                </div>
                <div className="bg-black p-3">
                  {previewUrl ? <video src={previewUrl} controls autoPlay playsInline className="max-h-[72vh] w-full rounded-xl bg-black object-contain" /> : <div className="grid h-[420px] place-items-center text-[13px] font-bold text-[#9d968d]">ไม่มีไฟล์วิดีโอสำหรับพรีวิว</div>}
                </div>
              </div>
            </div>
          );
        })() : null}
    </div>
  );
}







































































