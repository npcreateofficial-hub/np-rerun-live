import { AppError } from './http';
import { prisma } from './prisma';
import { parseShopeeBasketItems, shopee, type ShopeeBasketItem, type ShopeeLiveComment, type ShopeeProductDetail } from './shopee';

type AiCommentReplyJob = {
  liveChannelId: string;
  userId: string;
  stopped: boolean;
  timer: NodeJS.Timeout | null;
  seenCommentIds: Set<string>;
  repliedFingerprints: Set<string>;
  repliedTextFingerprints: Set<string>;
};

const jobs = new Map<string, AiCommentReplyJob>();
const recentReplyFingerprints = new Map<string, number>();
const recentReplyTextFingerprints = new Map<string, number>();
const REPLY_FINGERPRINT_TTL_MS = 10 * 60 * 1000;

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

function clearJob(liveChannelId: string) {
  const job = jobs.get(liveChannelId);
  if (!job) return false;
  job.stopped = true;
  if (job.timer) clearTimeout(job.timer);
  jobs.delete(liveChannelId);
  return true;
}

function formatValue(value: unknown) {
  if (value === undefined || value === null || value === '') return 'ไม่ระบุ';
  return String(value);
}

function basketSummary(basketLinks?: string | null, basketItemsJson?: string | null) {
  const parsed = parseShopeeBasketItems(basketLinks, basketItemsJson);
  const rows: Array<ShopeeBasketItem & {
    name?: string;
    price?: unknown;
    priceMin?: unknown;
    priceMax?: unknown;
    priceBeforeDiscount?: unknown;
    stock?: unknown;
    sold?: unknown;
    pinOrder?: unknown;
    rawOptions?: unknown;
  }> = [];

  if (basketItemsJson?.trim()) {
    try {
      const raw = JSON.parse(basketItemsJson);
      const items = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
      for (const item of items) {
        const itemId = Number(item?.item_id ?? item?.itemId);
        if (!Number.isSafeInteger(itemId) || itemId <= 0) continue;
        rows.push({
          shop_id: Number(item?.shop_id ?? item?.shopId) || undefined,
          item_id: itemId,
          url: item?.url ? String(item.url) : undefined,
          campaign_token: item?.campaign_token ?? item?.campaignToken,
          name: item?.name ?? item?.title,
          price: item?.price,
          priceMin: item?.priceMin ?? item?.price_min,
          priceMax: item?.priceMax ?? item?.price_max,
          priceBeforeDiscount: item?.priceBeforeDiscount ?? item?.price_before_discount,
          stock: item?.stock,
          sold: item?.sold,
          pinOrder: item?.pinOrder,
          rawOptions: item?.models ?? item?.modelOptions ?? item?.options ?? item?.tierVariations ?? item?.tier_variations,
        });
      }
    } catch {
      // Use parsed links below.
    }
  }

  const source = rows.length ? rows : parsed;
  return source.slice(0, 20).map((item, index) => {
    const order = Number(item.pinOrder) || index + 1;
    const name = item.name ? `ชื่อ: ${item.name}` : 'ชื่อ: ไม่ระบุ';
    const price = `ราคาจริงจาก API: ${formatValue(item.price)} | ต่ำสุด: ${formatValue(item.priceMin)} | สูงสุด: ${formatValue(item.priceMax)} | ก่อนลด: ${formatValue(item.priceBeforeDiscount)}`;
    const stock = `สต๊อก: ${formatValue(item.stock)} | ขายแล้ว: ${formatValue(item.sold)}`;
    const options = item.rawOptions ? ` | ตัวเลือก/เฉด/ไซส์จาก API: ${JSON.stringify(item.rawOptions).slice(0, 600)}` : '';
    return `ตะกร้า ${order}: item_id ${item.item_id} ${name} ${price} ${stock}${item.url ? ` ลิงก์: ${item.url}` : ''}${options}`;
  }).join('\n');
}

function compactOptionData(value: unknown) {
  if (!value) return '';
  try {
    return JSON.stringify(value)
      .replace(/\s+/g, ' ')
      .slice(0, 1200);
  } catch {
    return String(value).replace(/\s+/g, ' ').slice(0, 1200);
  }
}

async function enrichedBasketSummary(params: {
  cookie: string;
  liveSessionId: string | null;
  basketLinks?: string | null;
  basketItemsJson?: string | null;
}) {
  const parsed = parseShopeeBasketItems(params.basketLinks, params.basketItemsJson);
  const fallback = basketSummary(params.basketLinks, params.basketItemsJson);
  if (!parsed.length) return fallback;

  try {
    const details = await shopee.productDetails(params.cookie, params.liveSessionId, parsed);
    const byItemId = new Map<number, ShopeeProductDetail>();
    for (const detail of details.items) byItemId.set(Number(detail.itemId), detail);

    return parsed.slice(0, 28).map((item, index) => {
      const detail = byItemId.get(Number(item.item_id));
      const order = index + 1;
      const name = detail?.name || `item_id ${item.item_id}`;
      const price = `ราคาจริงจาก API: ${formatValue(detail?.price)} | ต่ำสุด: ${formatValue(detail?.priceMin)} | สูงสุด: ${formatValue(detail?.priceMax)} | ก่อนลด: ${formatValue(detail?.priceBeforeDiscount)}`;
      const stock = `สต๊อก: ${formatValue(detail?.stock)} | ขายแล้ว: ${formatValue(detail?.sold)}`;
      const optionText = compactOptionData({
        variationOptions: detail?.variationOptions,
        tierVariations: detail?.tierVariations,
        modelOptions: detail?.modelOptions,
      });
      const options = optionText && optionText !== '{}' ? ` | ตัวเลือก/เฉด/ไซส์/รุ่นจาก Shopee: ${optionText}` : ' | ตัวเลือก/เฉด/ไซส์/รุ่นจาก Shopee: ไม่พบใน API';
      const error = detail?.error ? ` | หมายเหตุ: ${detail.error}` : '';
      return `ตะกร้า ${order}: item_id ${item.item_id} ชื่อ: ${name} ${price} ${stock}${options}${item.url ? ` ลิงก์: ${item.url}` : ''}${error}`;
    }).join('\n');
  } catch (error) {
    console.warn('[ai-comment-reply] product detail enrichment failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

const LIVE_SELLER_PROMPT = `
คุณเป็นแม่ค้า/แอดมินไลฟ์ Shopee ที่คุยเหมือนคนจริง เน้นปิดการขายในไลฟ์ ไม่ตอบแข็ง ไม่ตอบเหมือนบอท

สไตล์ภาษา:
- ภาษาไทยธรรมชาติ ฟิวแม่ค้าไลฟ์ เป็นกันเอง มีพลัง ขายของเก่ง แต่ไม่เว่อร์จนดูปลอม
- ใช้คำปิดการขาย เช่น "สั่งซื้อในตะกร้าได้เลยนะคะ", "จัดได้เลยค่ะ", "ตัวนี้ดีจริงค่ะ", "ราคาลดอยู่ค่ะ"
- ห้ามใช้คำว่า "กดที่นี่", "รับตัวนี้ใส่ตะกร้า", "มีอะไรให้แอดมินช่วยไหมคะ"
- ถ้ามีชื่อลูกค้า ให้เรียกชื่อบัญชีลูกค้าในคำตอบแบบธรรมชาติ โดยเฉพาะตอนทักทาย ถามกลับ หรือถามว่าหมายถึงตะกร้าไหน เช่น "สวัสดีค่า คุณ t8gqxcatzj ..." หรือ "สนใจตะกร้าไหนคะคุณ t8gqxcatzj"
- อย่าใส่ชื่อลูกค้าทุกประโยคจนรก แต่ต้องใส่เมื่อช่วยให้รู้ว่าตอบใครในไลฟ์ที่มีหลายคน
- ถ้าทักทายเฉย ๆ ให้ชวนดูสินค้าแบบธรรมชาติ เช่น "สวัสดีค่า คุณลูกค้า เลือกดูสินค้าในตะกร้าได้เลยนะคะ ลดแรงมากค่ะ"
- ถ้าชมว่าน่ารัก/ดี ให้ขอบคุณแล้วปิดการขายนุ่ม ๆ เช่น "ขอบคุณมากค่า ตัวนี้น่ารักจริงค่ะ ราคากำลังดี สั่งในตะกร้าได้เลยนะคะ"

กฎข้อมูลสินค้า:
- ใช้ราคา/สต๊อก/ยอดขายจาก "ข้อมูลสินค้าในตะกร้า" เท่านั้น โดยเฉพาะช่อง "ราคาจริงจาก API", "ต่ำสุด", "สูงสุด", "ก่อนลด"
- ห้ามเดาราคาเอง ห้ามดึงราคาจากชื่อสินค้า ห้ามบอกโปร/ส่วนลด/ของแถม ถ้าไม่มีในข้อมูล
- ถ้าลูกค้าระบุตะกร้า เช่น "ตะกร้า 9" ให้ดูข้อมูลของตะกร้านั้นโดยตรง และตอบจากตัวเลือก/เฉด/ไซส์/รุ่นของตะกร้านั้นก่อน
- ถ้าสินค้ามีหลายเฉด เบอร์ สี ไซส์ ขนาด รุ่น ให้ตอบจากข้อมูลตัวเลือกที่มี ถ้าข้อมูลตัวเลือกไม่พอให้ถามกลับก่อน
- คำว่า อันนี้/ตัวนี้/ชิ้นนี้/แบบนี้/รุ่นนี้/สีนี้/เบอร์นี้/เฉดนี้/ไซส์นี้/เซ็ตนี้/แพ็กนี้/กระปุกนี้/ขวดนี้/ซองนี้/ตัวที่โชว์/ตัวที่ปัก/ตัวเมื่อกี้/ตัวบนจอ ให้ตีความจากบริบทตะกร้าที่ลูกค้าระบุ ถ้าไม่ชัดให้ถามกลับ

วิธีตอบ:
- ถ้าถาม "ขอดูตะกร้า 16/20/30" หรือขอให้รันตะกร้า ให้ตอบแนว "ได้ค่ะ แอดมินรันให้ทีละรายการนะคะ รอดูตะกร้าได้เลยค่า"
- ถ้าถาม "ใช้ดีมั้ย" ให้ตอบแนวแม่ค้า เช่น "ดีมากค่ะลูกค้า งานดีจริง ใช้ง่าย/ใช้ได้เลยค่ะ สั่งในตะกร้าได้เลยนะคะ" โดยอิงประเภทสินค้าเท่าที่รู้
- ถ้าถาม "คุมมันมั้ย" ให้ตอบเฉพาะเมื่อสินค้าน่าจะเป็นเมคอัพ/สกินแคร์ ถ้าไม่ชัดให้ถามว่าสนใจตะกร้าไหน
- ถ้าถาม "ผิวสองสีใช้เบอร์ไหน" แต่ไม่บอกตะกร้า และมีหลายสินค้า ให้ถามกลับว่า "ลูกค้าสนใจสินค้าตะกร้าไหนคะ เดี๋ยวแอดมินแนะนำเฉดให้ตรงผิวเลยค่ะ"
- ถ้ารู้ตะกร้า/สินค้า ให้แนะนำเบอร์/สี/ไซส์/ขนาดตามข้อมูลและปิดการขาย
- ถ้าถามราคาแต่ไม่ชัดว่าสินค้าไหน ให้ถามกลับสั้น ๆ ว่า "หมายถึงตะกร้าไหนคะลูกค้า เดี๋ยวแอดมินดูราคาให้ตรงตัวเลยค่ะ"
- ตอบเป็นข้อความเดียว สั้น กระชับ เหมาะกับช่องแชตไลฟ์ ไม่เกิน 160 ตัวอักษร
`;

async function createAiReply(params: {
  apiKey: string;
  accountName: string;
  comment: ShopeeLiveComment;
  basketText: string;
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${params.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 90,
        messages: [
          {
            role: 'system',
            content: LIVE_SELLER_PROMPT,
          },
          {
            role: 'user',
            content:
              `บัญชีไลฟ์: ${params.accountName}\n` +
              `ข้อมูลสินค้าในตะกร้า:\n${params.basketText || 'ไม่มีข้อมูลสินค้า'}\n\n` +
              `ชื่อลูกค้า/บัญชีที่คอมเมนต์: ${params.comment.customerName || 'ไม่ทราบชื่อ'}\n` +
              `คอมเมนต์ลูกค้า: ${params.comment.text}\n` +
              'ตอบกลับเป็นภาษาแม่ค้าไลฟ์ธรรมชาติ ปิดการขายในตะกร้า ถ้าไม่รู้ว่าสินค้าไหนให้ถามกลับแบบคนจริง และถ้ามีชื่อลูกค้าให้เรียกชื่อเขาเมื่อเหมาะสม',
          },
        ],
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // fall through
    }
    if (!response.ok) {
      throw new Error(json?.error?.message || text.slice(0, 300) || `OpenAI HTTP ${response.status}`);
    }
    const reply = String(json?.choices?.[0]?.message?.content || '').trim();
    if (!reply) throw new Error('OpenAI ไม่คืนข้อความตอบกลับ');
    return reply.replace(/\s+/g, ' ').slice(0, 240);
  } finally {
    clearTimeout(timer);
  }
}

function commentKey(comment: ShopeeLiveComment) {
  return comment.id || `${comment.customerName || 'unknown'}:${comment.text}:${comment.createdAt || ''}`;
}

function normalizeReplyText(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[😀😃😄😁😆😅😂🤣🙂😊😍🥰😘❤❤️💕💖✨⭐️]/g, '')
    .trim()
    .toLowerCase();
}

function commentFingerprint(comment: ShopeeLiveComment) {
  return `${comment.customerName || 'unknown'}:${normalizeReplyText(comment.text)}`;
}

function commentTextFingerprint(comment: ShopeeLiveComment) {
  return normalizeReplyText(comment.text);
}

function isRecentlyRepliedInMap(map: Map<string, number>, liveChannelId: string, fingerprint: string) {
  const now = Date.now();
  for (const [key, expiresAt] of map) {
    if (expiresAt <= now) map.delete(key);
  }
  const key = `${liveChannelId}:${fingerprint}`;
  const expiresAt = map.get(key);
  return Boolean(expiresAt && expiresAt > now);
}

function markRecentlyRepliedInMap(map: Map<string, number>, liveChannelId: string, fingerprint: string) {
  map.set(`${liveChannelId}:${fingerprint}`, Date.now() + REPLY_FINGERPRINT_TTL_MS);
}

function isRecentlyReplied(liveChannelId: string, fingerprint: string) {
  return isRecentlyRepliedInMap(recentReplyFingerprints, liveChannelId, fingerprint);
}

function isRecentlyRepliedText(liveChannelId: string, fingerprint: string) {
  return isRecentlyRepliedInMap(recentReplyTextFingerprints, liveChannelId, fingerprint);
}

function markRecentlyReplied(liveChannelId: string, fingerprint: string, textFingerprint: string) {
  markRecentlyRepliedInMap(recentReplyFingerprints, liveChannelId, fingerprint);
  markRecentlyRepliedInMap(recentReplyTextFingerprints, liveChannelId, textFingerprint);
}

function shouldIgnoreComment(text: string) {
  const normalized = text.trim();
  if (!normalized) return true;
  if (normalized.length > 500) return true;
  return false;
}

function normalizeAccountName(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function isOwnAccountComment(comment: ShopeeLiveComment, accountNames: Array<string | null | undefined>) {
  const customerName = normalizeAccountName(comment.customerName);
  if (!customerName) return false;
  return accountNames.some((name) => normalizeAccountName(name) === customerName);
}

export function isAiCommentReplyLoopRunning(liveChannelId: string) {
  return jobs.has(liveChannelId);
}

export async function stopAiCommentReplyLoopForChannel(liveChannelId: string) {
  return clearJob(liveChannelId);
}

export async function startAiCommentReplyLoopForChannel(userId: string, liveChannelId: string) {
  const channel = await prisma.liveChannel.findFirst({ where: { id: liveChannelId, userId } });
  if (!channel) throw new AppError('ไม่พบช่องไลฟ์', 404);
  if (channel.platform !== 'SHOPEE') throw new AppError('บัญชีนี้ไม่ใช่ Shopee', 400);
  if (!channel.aiCommentAutoReply) throw new AppError('ยังไม่ได้เปิดตอบคอมเมนต์อัตโนมัติ', 400);
  if (!channel.aiCommentApiKey) throw new AppError('ยังไม่มี OpenAI API key สำหรับบัญชีนี้', 400);
  if (channel.cookieValid === false) throw new AppError('คุกกี้ของบัญชีนี้ใช้ไม่ได้ กรุณาเชื่อมบัญชีใหม่', 400);
  if (!channel.cookie) throw new AppError('บัญชีนี้ไม่มีคุกกี้ Shopee', 400);
  if (!channel.liveSessionId) throw new AppError('ยังไม่มี Shopee Live session สำหรับบัญชีนี้', 400);

  clearJob(liveChannelId);
  const job: AiCommentReplyJob = {
    liveChannelId,
    userId,
    stopped: false,
    timer: null,
    seenCommentIds: new Set(),
    repliedFingerprints: new Set(),
    repliedTextFingerprints: new Set(),
  };
  jobs.set(liveChannelId, job);

  let basketText = basketSummary(channel.basketLinks, channel.basketItemsJson);
  void enrichedBasketSummary({
    cookie: channel.cookie,
    liveSessionId: channel.liveSessionId,
    basketLinks: channel.basketLinks,
    basketItemsJson: channel.basketItemsJson,
  }).then((nextBasketText) => {
    if (nextBasketText?.trim()) basketText = nextBasketText;
    console.info('[ai-comment-reply] product context enriched', { liveChannelId });
  }).catch((error) => {
    console.warn('[ai-comment-reply] product context enrichment skipped', {
      liveChannelId,
      message: error instanceof Error ? error.message : String(error),
    });
  });

  void (async () => {
    console.info('[ai-comment-reply] started', { liveChannelId, sessionId: channel.liveSessionId });
    let initialScanDone = false;
    while (!job.stopped && jobs.get(liveChannelId) === job) {
      try {
        const comments = await shopee.liveComments(channel.cookie!, channel.liveSessionId!);
        if (!initialScanDone) {
          for (const comment of comments) {
            job.seenCommentIds.add(commentKey(comment));
            job.repliedFingerprints.add(commentFingerprint(comment));
            job.repliedTextFingerprints.add(commentTextFingerprint(comment));
          }
          initialScanDone = true;
          if (comments.length) {
            console.info('[ai-comment-reply] initial comments marked as seen', {
              liveChannelId,
              count: comments.length,
            });
          }
          await sleep(5_000);
          continue;
        }
        for (const comment of comments) {
          const key = commentKey(comment);
          if (job.seenCommentIds.has(key)) continue;
          job.seenCommentIds.add(key);

          const text = comment.text.trim();
          const fingerprint = commentFingerprint(comment);
          const textFingerprint = commentTextFingerprint(comment);
          if (
            shouldIgnoreComment(text) ||
            isOwnAccountComment(comment, [channel.accountName, channel.name]) ||
            job.repliedFingerprints.has(fingerprint) ||
            job.repliedTextFingerprints.has(textFingerprint) ||
            isRecentlyReplied(liveChannelId, fingerprint) ||
            isRecentlyRepliedText(liveChannelId, textFingerprint)
          ) {
            continue;
          }
          job.repliedFingerprints.add(fingerprint);
          job.repliedTextFingerprints.add(textFingerprint);
          markRecentlyReplied(liveChannelId, fingerprint, textFingerprint);

          console.info('[ai-comment-reply] received comment', {
            liveChannelId,
            commentId: comment.id,
            customerName: comment.customerName,
            text,
          });

          const reply = await createAiReply({
            apiKey: channel.aiCommentApiKey!,
            accountName: channel.accountName || channel.name,
            comment,
            basketText,
          });
          const sent = await shopee.sendLiveComment(channel.cookie!, channel.liveSessionId!, reply);
          console.info('[ai-comment-reply] replied', {
            liveChannelId,
            commentId: comment.id,
            customerName: comment.customerName,
            reply,
            sent: sent.sent,
            endpoint: sent.endpoint,
          });
        }
      } catch (error) {
        console.warn('[ai-comment-reply] tick failed', {
          liveChannelId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      await sleep(5_000);
    }
    console.info('[ai-comment-reply] stopped', { liveChannelId });
  })();

  return {
    liveChannelId,
    running: true,
    pollSeconds: 5,
  };
}

export async function resumeAiCommentReplyLoopsOnBoot() {
  const activeChannels = await prisma.liveChannel.findMany({
    where: {
      isOnline: true,
      aiCommentAutoReply: true,
      aiCommentApiKey: { not: null },
      cookie: { not: null },
      liveSessionId: { not: null },
    },
    select: { id: true, userId: true },
  });

  for (const channel of activeChannels) {
    await startAiCommentReplyLoopForChannel(channel.userId, channel.id).catch((error) => {
      console.warn('[ai-comment-reply] resume after boot skipped', {
        liveChannelId: channel.id,
        message: error instanceof Error ? error.message : String(error),
      });
    });
  }
}
