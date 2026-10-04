import WebSocket from 'ws';
import { PrismaClient } from '@prisma/client';

const channelId = process.env.CHANNEL_ID || 'cmuc6aoj0000knw01kygej894';
const debugBase = process.env.CHROME_DEBUG_BASE || 'http://127.0.0.1:9223';
const prisma = new PrismaClient();

function parseCookie(cookie) {
  const out = {};
  for (const part of String(cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    out[part.slice(0, index).trim()] = part.slice(index + 1).trim();
  }
  return out;
}

async function chromeJson(path, options) {
  const response = await fetch(`${debugBase}${path}`, options);
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
  return response.json();
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.on('message', (data) => {
      const message = JSON.parse(String(data));
      if (!message.id || !pending.has(message.id)) return;
      const waiter = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(waiter.timer);
      if (message.error) waiter.reject(new Error(message.error.message || 'CDP error'));
      else waiter.resolve(message.result);
    });
    ws.on('error', reject);
    ws.on('open', () => {
      resolve({
        send(method, params = {}, timeoutMs = 20_000) {
          return new Promise((done, fail) => {
            const callId = ++id;
            const timer = setTimeout(() => {
              pending.delete(callId);
              fail(new Error(`${method} timeout`));
            }, timeoutMs);
            pending.set(callId, { resolve: done, reject: fail, timer });
            ws.send(JSON.stringify({ id: callId, method, params }));
          });
        },
        close() {
          ws.close();
        },
      });
    });
  });
}

function summarize(json) {
  const data = json?.data?.item || json?.data || json?.item || json;
  return {
    status: json?.error ?? json?.err_code ?? json?.code ?? 0,
    keys: data && typeof data === 'object' ? Object.keys(data).slice(0, 80) : [],
    name: data?.name || data?.title || data?.item_name,
    models: data?.models || data?.item_models || data?.modelOptions || null,
    tierVariations: data?.tier_variations || data?.tierVariations || data?.variations || null,
    rawSample: JSON.stringify(json).slice(0, 1200),
  };
}

async function main() {
  const channel = await prisma.liveChannel.findUnique({ where: { id: channelId } });
  const raw = JSON.parse(channel?.basketItemsJson || '[]');
  const items = Array.isArray(raw) ? raw : raw.items || [];
  const item = items[8];
  const shopId = item.shopId || item.shop_id;
  const itemId = item.itemId || item.item_id;
  const target = await chromeJson(`/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
  const client = await connect(target.webSocketDebuggerUrl);
  await client.send('Page.enable').catch(() => undefined);
  await client.send('Runtime.enable').catch(() => undefined);
  await client.send('Network.enable').catch(() => undefined);
  const cookies = Object.entries(parseCookie(channel.cookie)).map(([name, value]) => ({
    name,
    value,
    domain: '.shopee.co.th',
    path: '/',
    secure: true,
  }));
  await client.send('Network.setCookies', { cookies }).catch(() => undefined);
  await client.send('Page.navigate', { url: `https://shopee.co.th/product/${shopId}/${itemId}` }, 15_000).catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const endpoints = [
    `https://shopee.co.th/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`,
    `https://shopee.co.th/api/v4/pdp/get_pc?shop_id=${shopId}&item_id=${itemId}`,
    `https://shopee.co.th/api/v2/item/get?itemid=${itemId}&shopid=${shopId}`,
    `https://shopee.co.th/api/v4/product/get_shop_info?shopid=${shopId}`,
    `https://mall.shopee.co.th/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`,
    `https://live.shopee.co.th/api/v1/session/${channel.liveSessionId}/import_items/detail`,
    `https://live.shopee.co.th/webapi/v1/session/${channel.liveSessionId}/import_items/detail`,
  ];

  for (const url of endpoints) {
    const expression = `fetch(${JSON.stringify(url)}, {
      method: ${JSON.stringify(url.includes('import_items') ? 'POST' : 'GET')},
      credentials: 'include',
      headers: {'content-type':'application/json','x-api-source':'pc','x-requested-with':'XMLHttpRequest'},
      body: ${url.includes('import_items') ? JSON.stringify(JSON.stringify({ items: [{ shop_id: Number(shopId), item_id: Number(itemId) }], links: [item.url] })) : 'undefined'}
    }).then(async r => ({status:r.status, text: await r.text()})).catch(e => ({status:0, text:String(e)}))`;
    const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, 20_000);
    const value = result.result?.value || {};
    let json = null;
    try { json = JSON.parse(value.text); } catch {}
    console.log('\nURL', url, 'HTTP', value.status);
    console.log(JSON.stringify(json ? summarize(json) : { text: String(value.text).slice(0, 500) }, null, 2));
  }
  const dom = await client.send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(() => {
      const scripts = [...document.scripts]
        .map((script) => script.textContent || '')
        .filter((text) => /tier|model|variation|25123052681|แป้ง|เบอร์|สี/.test(text));
      return {
        href: location.href,
        title: document.title,
        text: (document.body?.innerText || '').slice(0, 3000),
        scripts: scripts.slice(0, 5).map((text) => text.slice(0, 3000)),
        html: document.documentElement.outerHTML.slice(0, 3000),
      };
    })()`,
  }, 20_000);
  console.log('\nDOM');
  console.log(JSON.stringify(dom.result?.value || {}, null, 2));
  const store = await client.send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(() => {
      function findItem(value, seen = new Set()) {
        if (!value || typeof value !== 'object' || seen.has(value)) return null;
        seen.add(value);
        if (value.item_id === ${Number(itemId)} || value.itemid === ${Number(itemId)}) return value;
        for (const child of Object.values(value)) {
          const found = findItem(child, seen);
          if (found) return found;
        }
        return null;
      }
      let root = window.__STORE__ || null;
      if (!root) {
        const scripts = [...document.scripts].map((script) => script.textContent || '');
        const match = scripts.join('\\n').match(/window\\.__STORE__=JSON\\.parse\\("([\\s\\S]*?)"\\)/);
        if (match) root = JSON.parse(JSON.parse('"' + match[1] + '"'));
      }
      let found = findItem(root);
      if (!found) {
        for (const text of [...document.scripts].map((script) => (script.textContent || '').trim())) {
          if (!text.startsWith('{') || !text.includes('PDP_BFF_DATA')) continue;
          try {
            const parsed = JSON.parse(text);
            const itemFromMap = parsed?.initialState?.DOMAIN_PDP?.data?.PDP_BFF_DATA?.cachedMap?.[${JSON.stringify(`${shopId}/${itemId}`)}]?.item;
            found = itemFromMap || findItem(parsed);
            if (found) break;
          } catch {}
        }
      }
      return found ? {
        keys: Object.keys(found),
        title: found.title || found.name,
        models: found.models || found.item_models || found.item?.models || null,
        tierVariations: found.tier_variations || found.tierVariations || found.variations || found.item?.tier_variations || null,
        price: found.price || found.price_min || found.raw_price || null,
        priceMin: found.price_min || null,
        priceMax: found.price_max || null,
        description: found.description || found.rich_text_description || null,
        attributes: found.attributes || null,
      } : null;
    })()`,
  }, 20_000);
  console.log('\nSTORE_ITEM');
  console.log(JSON.stringify(store.result?.value || null, null, 2).slice(0, 12000));
  client.close();
}

main().finally(() => prisma.$disconnect());
