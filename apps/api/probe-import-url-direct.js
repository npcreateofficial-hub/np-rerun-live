require('dotenv').config();

const { prisma } = require('./dist/prisma');

const sessionId = process.argv[2];
const productUrl = process.argv[3] || 'https://shopee.co.th/product/250362237/46810364281';
if (!sessionId) throw new Error('usage: node probe-import-url-direct.js <sessionId> [productUrl]');

function summarize(json, status) {
  const base = Array.isArray(json) ? (json[1] || json[0]) : json;
  const data = base?.data || base || {};
  return {
    status,
    code: base?.err_code ?? base?.code ?? null,
    msg: base?.err_msg || base?.msg || base?.message || '',
    keys: data && typeof data === 'object' ? Object.keys(data).slice(0, 12) : [],
    count: Array.isArray(data?.items) ? data.items.length : null,
    total: data?.total_count ?? data?.items_cnt ?? data?.total ?? data?.all_total ?? null,
  };
}

async function main() {
  const channel = await prisma.liveChannel.findFirst({
    where: { platform: 'SHOPEE', OR: [{ accountName: 'johnxxx370' }, { name: 'johnxxx370' }] },
    orderBy: { updatedAt: 'desc' },
    select: { cookie: true },
  });
  if (!channel?.cookie) throw new Error('ไม่พบ cookie');
  const headers = {
    cookie: channel.cookie,
    accept: 'application/json, text/plain, */*',
    'content-type': 'application/json',
    'user-agent': process.env.SHOPEE_USER_AGENT || 'Mozilla/5.0',
    referer: `https://live.shopee.co.th/p/product-select?session=${encodeURIComponent(sessionId)}&from_source=streamer_add_product`,
    origin: 'https://live.shopee.co.th',
    'x-livestreaming-source': 'shopee',
    'x-shopee-language': 'th',
  };
  const call = async (path, body) => {
    const resp = await fetch(`https://live.shopee.co.th${path}`, {
      method: body ? 'POST' : 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await resp.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { path, summary: summarize(json, resp.status), text: json ? '' : text.slice(0, 160) };
  };

  const bodies = [
    { name: 'links', body: { links: [productUrl] } },
    { name: 'urls', body: { urls: [productUrl] } },
    { name: 'url', body: { url: productUrl } },
    { name: 'items_url', body: { items: [{ url: productUrl }] } },
  ];
  const ops = [await call(`/api/v1/session/${sessionId}/host/items?offset=0&limit=20`)];
  for (const item of bodies) {
    for (const path of [
      '/webapi/v1/item/parse_url',
      '/api/v1/item/parse_url',
      `/webapi/v1/session/${sessionId}/import_items/detail`,
      `/api/v1/session/${sessionId}/import_items/detail`,
      `/webapi/v1/session/${sessionId}/import_items`,
      `/api/v1/session/${sessionId}/import_items`,
      `/webapi/v1/session/${sessionId}/add_items_by_url`,
      `/api/v1/session/${sessionId}/add_items_by_url`,
    ]) {
      ops.push({ name: item.name, ...(await call(path, item.body)) });
    }
  }
  ops.push(await call(`/api/v1/session/${sessionId}/host/items?offset=0&limit=20`));
  console.log(JSON.stringify(ops, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, message: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
