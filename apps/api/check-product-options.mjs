import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { shopee } = require('./dist/shopee.js');

const channelId = process.env.CHANNEL_ID || 'cmuc6aoj0000knw01kygej894';
const basketIndex = Number(process.env.BASKET_INDEX || 9);
const prisma = new PrismaClient();

try {
  const channel = await prisma.liveChannel.findUnique({ where: { id: channelId } });
  if (!channel) throw new Error(`channel not found: ${channelId}`);
  const raw = JSON.parse(channel.basketItemsJson || '[]');
  const items = Array.isArray(raw) ? raw : raw.items || [];
  const selected = items[basketIndex - 1];
  if (!selected) throw new Error(`basket ${basketIndex} not found`);
  const item = {
    shop_id: Number(selected.shop_id ?? selected.shopId),
    item_id: Number(selected.item_id ?? selected.itemId),
    url: selected.url,
  };
  const result = await shopee.productDetails(channel.cookie, channel.liveSessionId, [item]);
  const detail = result.items[0];
  console.log(JSON.stringify({
    sessionId: result.sessionId,
    basketIndex,
    item,
    name: detail?.name,
    price: detail?.price,
    priceMin: detail?.priceMin,
    priceMax: detail?.priceMax,
    stock: detail?.stock,
    variationOptions: detail?.variationOptions,
    tierVariations: detail?.tierVariations,
    modelOptions: detail?.modelOptions,
    error: detail?.error,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
