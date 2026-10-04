import WebSocket from 'ws';
import { PrismaClient } from '@prisma/client';

const sessionId = process.env.SESSION_ID || '27631686';
const channelId = process.env.CHANNEL_ID || 'cmuc6aoj0000knw01kygej894';
const debugBase = process.env.CHROME_DEBUG_BASE || 'http://127.0.0.1:9223';
const prisma = new PrismaClient();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCookie(cookie) {
  const out = {};
  for (const part of String(cookie || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name && value) out[name] = value;
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
    const listeners = new Set();
    ws.on('message', (data) => {
      const message = JSON.parse(String(data));
      if (message.id && pending.has(message.id)) {
        const waiter = pending.get(message.id);
        pending.delete(message.id);
        clearTimeout(waiter.timer);
        if (message.error) waiter.reject(new Error(message.error.message || 'CDP error'));
        else waiter.resolve(message.result);
        return;
      }
      for (const listener of listeners) listener(message);
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
        onMessage(fn) {
          listeners.add(fn);
        },
        close() {
          ws.close();
        },
      });
    });
  });
}

function compact(text) {
  return String(text || '').replace(/\s+/g, ' ');
}

function getSample(text, index, before = 700, after = 1100) {
  return compact(text.slice(Math.max(0, index - before), index + after));
}

function findNeedles(url, text) {
  const strongPatterns = [
    /\/(?:webapi|api)\/v\d\/[^"'`\s)]*(?:message|comment|chatroom)[^"'`\s)]*/gi,
    /https?:\/\/[^"'`\s)]*(?:message|comment|chatroom)[^"'`\s)]*/gi,
    /\b(?:sendMessage|send_message|post_comment|postComment|sendComment|send_comment)\b/g,
    /\b(?:usersig|user_sig|chatroom_id|chatroomId|SPIM-[A-Z0-9-]+)\b/g,
  ];
  const hits = [];
  for (const pattern of strongPatterns) {
    for (const match of text.matchAll(pattern)) {
      const index = match.index || 0;
      const sample = getSample(text, index);
      const looksLikeSend =
        /(?:fetch|request|axios|post|method|POST|send|message|content|usersig|uuid|chatroom)/i.test(sample);
      if (!looksLikeSend && !/SPIM-|usersig|user_sig/i.test(match[0])) continue;
      hits.push({ match: match[0], index, sample });
      if (hits.length >= 50) break;
    }
    if (hits.length >= 50) break;
  }
  return hits;
}

async function main() {
  const channel = await prisma.liveChannel.findUnique({ where: { id: channelId } });
  if (!channel?.cookie) throw new Error(`No cookie for channel ${channelId}`);

  const target = await chromeJson(`/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
  const client = await connect(target.webSocketDebuggerUrl);
  const responseBodies = [];
  const resourceUrls = new Set();

  client.onMessage((message) => {
    if (message.method !== 'Network.responseReceived') return;
    const url = String(message.params?.response?.url || '');
    resourceUrls.add(url);
    if (!/live|shopee|chat|message|comment|bundle|assets|js|webapi|api\/v1/i.test(url)) return;
    void client
      .send('Network.getResponseBody', { requestId: message.params.requestId }, 10_000)
      .then((body) => {
        const text = body.base64Encoded
          ? Buffer.from(body.body || '', 'base64').toString('utf8')
          : String(body.body || '');
        if (text) responseBodies.push({ url, text });
      })
      .catch(() => undefined);
  });

  await client.send('Page.enable').catch(() => undefined);
  await client.send('Runtime.enable').catch(() => undefined);
  await client.send('Network.enable');
  await client.send('Emulation.setUserAgentOverride', {
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 Shopee Beeshop locale/th version=33450 appver=33450',
    platform: 'Android',
  }).catch(() => undefined);
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
  }).catch(() => undefined);

  const cookies = Object.entries(parseCookie(channel.cookie)).map(([name, value]) => ({
    name,
    value,
    domain: '.shopee.co.th',
    path: '/',
    secure: true,
  }));
  await client.send('Network.clearBrowserCookies').catch(() => undefined);
  await client.send('Network.setCookies', { cookies }).catch(() => undefined);

  const url = `https://live.shopee.co.th/p/share?from=live&session=${encodeURIComponent(sessionId)}&in=1`;
  console.log('[NAVIGATE]', url);
  await client.send('Page.navigate', { url }, 15_000).catch((error) => console.log('[NAV ERR]', error.message));
  await sleep(12_000);

  const pageInfo = await client.send('Runtime.evaluate', {
    expression: `({
      href: location.href,
      title: document.title,
      scripts: [...document.scripts].map(s => s.src).filter(Boolean),
      resources: performance.getEntriesByType('resource').map(e => e.name).filter(Boolean),
      text: document.body ? document.body.innerText.slice(0, 1000) : ''
    })`,
    returnByValue: true,
  });
  const info = pageInfo.result?.value || {};
  console.log('[PAGE]', JSON.stringify({ href: info.href, title: info.title, scripts: info.scripts?.length, resources: info.resources?.length, text: info.text }, null, 2));

  const urls = [...new Set([...(info.scripts || []), ...(info.resources || []), ...resourceUrls])];
  console.log('[URL_COUNT]', urls.length);

  const allHits = [];
  for (const entry of responseBodies) {
    const hits = findNeedles(entry.url, entry.text);
    for (const hit of hits) allHits.push({ url: entry.url, ...hit });
  }

  for (const scriptUrl of urls.filter((item) => /\.(js|mjs)(\?|$)/i.test(item)).slice(0, 150)) {
    if (responseBodies.some((entry) => entry.url === scriptUrl)) continue;
    try {
      const response = await fetch(scriptUrl);
      if (!response.ok) continue;
      const text = await response.text();
      const hits = findNeedles(scriptUrl, text);
      for (const hit of hits) allHits.push({ url: scriptUrl, ...hit });
    } catch {
      // keep scanning other resources
    }
  }

  const uniqueHits = [];
  const seen = new Set();
  for (const hit of allHits) {
    const key = `${hit.url}|${hit.match}|${hit.sample.slice(0, 250)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueHits.push(hit);
  }

  console.log('[STRONG_HITS]', JSON.stringify(uniqueHits.slice(0, 30), null, 2));
  console.log('[SUMMARY]', JSON.stringify({ resources: urls.length, responseBodies: responseBodies.length, hitCount: uniqueHits.length }, null, 2));
  client.close();
}

main()
  .catch((error) => {
    console.error('[scan failed]', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

