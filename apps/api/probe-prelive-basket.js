require('dotenv').config();

const { prisma } = require('./dist/prisma');
const { shopee, parseShopeeBasketItems } = require('./dist/shopee');

function sanitize(value, seen = new Set()) {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 10).map((item) => sanitize(item, seen));

  const output = {};
  for (const [key, child] of Object.entries(value)) {
    if (/cookie|token|secret|signature|csrf|streamKey|rtmp|push/i.test(key)) {
      output[key] = '[redacted]';
    } else {
      output[key] = sanitize(child, seen);
    }
  }
  return output;
}

async function main() {
  const channel = await prisma.liveChannel.findFirst({
    where: {
      platform: 'SHOPEE',
      OR: [
        { accountName: process.argv[2] || 'johnxxx370' },
        { name: process.argv[2] || 'johnxxx370' },
      ],
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!channel) throw new Error('ไม่พบบัญชี Shopee ที่จะทดสอบ');
  const basketItems = parseShopeeBasketItems(channel.basketLinks, channel.basketItemsJson);
  if (!basketItems.length) throw new Error('บัญชีนี้ยังไม่มีรายการตะกร้าที่จะทดสอบ');

  const title = channel.caption?.trim() || 'โปรโมตเฉพาะในไลฟ์';
  const description = channel.description?.trim() || title;
  const result = await shopee.createSession(
    channel.cookie,
    title,
    channel.coverImageUrl,
    description,
    channel.liveSessionId,
    channel.platformUid,
    basketItems,
  );

  console.log(JSON.stringify(sanitize({
    account: channel.accountName || channel.name,
    requestedBasketItems: basketItems.length,
    liveSessionId: result.liveSessionId,
    hasRtmp: Boolean(result.rtmpUrl),
    raw: result.raw,
  }), null, 2));
}

main()
  .catch((error) => {
    const details = error && typeof error === 'object' && 'details' in error ? error.details : undefined;
    console.error(JSON.stringify(sanitize({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      details,
    }), null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
