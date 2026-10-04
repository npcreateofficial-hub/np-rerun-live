require('dotenv').config();

const { prisma } = require('./dist/prisma');

const offerIds = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['25305467607', '28436940692', '44554247573', '25336411639', '28684230227'];

function dataOf(payload) {
  return payload?.data ?? payload ?? {};
}

function productPairFromText(text) {
  const decoded = String(text || '').replace(/\\\//g, '/');
  const matches = [...decoded.matchAll(/(?:shopee\.co\.th\/)?product\/(\d+)\/(\d+)/gi)];
  const pair = matches.find((match) => match[1] && match[2]);
  return pair ? { shop_id: Number(pair[1]), item_id: Number(pair[2]) } : null;
}

function findPair(value, seen = new Set()) {
  if (!value || typeof value !== 'object') return null;
  if (seen.has(value)) return null;
  seen.add(value);

  const fromUrl = productPairFromText(value.product_link || value.long_link || value.url || value.link);
  if (fromUrl) return fromUrl;

  const shop = Number(value.shop_id ?? value.shopid ?? value.shopId);
  const item = Number(value.item_id ?? value.itemid ?? value.itemId);
  if (Number.isFinite(shop) && Number.isFinite(item) && shop > 0 && item > 0) {
    return { shop_id: shop, item_id: item };
  }

  for (const child of Object.values(value)) {
    const pair = findPair(child, seen);
    if (pair) return pair;
  }
  return null;
}

function summarizeJson(json) {
  const data = dataOf(json);
  return {
    errCode: json?.err_code ?? json?.code ?? null,
    errMsg: json?.err_msg || json?.msg || json?.message || '',
    dataKeys: data && typeof data === 'object' ? Object.keys(data).slice(0, 20) : [],
    pair: findPair(data),
    listCount: Array.isArray(data?.list) ? data.list.length : Array.isArray(data?.items) ? data.items.length : null,
  };
}

async function fetchText(url, cookie) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      accept: 'application/json, text/plain, */*',
      cookie,
      referer: 'https://affiliate.shopee.co.th/dashboard',
      'x-requested-with': 'XMLHttpRequest',
    },
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: response.status, contentType: response.headers.get('content-type'), text, json };
}

async function main() {
  const channel = await prisma.liveChannel.findFirst({
    where: { platform: 'SHOPEE', OR: [{ accountName: 'johnxxx370' }, { name: 'johnxxx370' }] },
    orderBy: { updatedAt: 'desc' },
  });
  if (!channel?.cookie) throw new Error('ไม่พบ cookie ของบัญชี Shopee');

  const output = [];
  for (const id of offerIds) {
    const urls = [
      `https://affiliate.shopee.co.th/offer/product_offer/${encodeURIComponent(id)}`,
      `https://affiliate.shopee.co.th/api/v3/offer/product?item_id=${encodeURIComponent(id)}`,
      `https://affiliate.shopee.co.th/api/v3/offer/product/list?keyword=${encodeURIComponent(id)}&page=1&page_size=20`,
      `https://affiliate.shopee.co.th/api/v3/offer/product/list?keyword=${encodeURIComponent(id)}&page=1&limit=20`,
    ];

    const results = [];
    for (const url of urls) {
      try {
        const response = await fetchText(url, channel.cookie);
        results.push({
          url: url.replace(id, '<offer_id>'),
          status: response.status,
          contentType: response.contentType,
          summary: response.json ? summarizeJson(response.json) : { pairFromHtml: productPairFromText(response.text) },
        });
      } catch (error) {
        results.push({ url: url.replace(id, '<offer_id>'), error: error instanceof Error ? error.message : String(error) });
      }
    }
    output.push({ offerId: id, results });
  }

  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, message: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
