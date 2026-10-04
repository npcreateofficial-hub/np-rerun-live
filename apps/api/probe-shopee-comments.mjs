import WebSocket from 'ws';
import { PrismaClient } from '@prisma/client';

const sessionId = process.env.SESSION_ID || '27631686';
const channelId = process.env.CHANNEL_ID || 'cmuc6aoj0000knw01kygej894';
const debugBase = process.env.CHROME_DEBUG_BASE || 'http://127.0.0.1:9223';
const waitMs = Number(process.env.WAIT_MS || 60_000);

const prisma = new PrismaClient();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function short(value, max = 1500) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.replace(/\s+/g, ' ').slice(0, max);
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

async function createTarget(url) {
  return chromeJson(`/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
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

function looksRelevant(text) {
  return /comment|message|msgs|msg|chat|content|nickname|username|display_name|user_info|สวัสดี|น่ารัก|ตะกร้า/i.test(text);
}

async function main() {
  const channel = await prisma.liveChannel.findUnique({ where: { id: channelId } });
  if (!channel?.cookie) throw new Error(`No cookie for channel ${channelId}`);

  const target = await createTarget('about:blank');
  const client = await connect(target.webSocketDebuggerUrl);
  const found = [];

  client.onMessage((message) => {
    if (message.method === 'Network.webSocketFrameReceived' || message.method === 'Network.webSocketFrameSent') {
      const payload = String(message.params?.response?.payloadData || '');
      if (looksRelevant(payload)) {
        found.push({ kind: message.method, payload: short(payload) });
        console.log('\n[WS]', message.method, short(payload, 2200));
      }
      return;
    }

    if (message.method !== 'Network.responseReceived') return;
    const url = String(message.params?.response?.url || '');
    if (!/live|livetech|chat|comment|message|msg|im|gateway|session|poll/i.test(url)) return;
    void client
      .send('Network.getResponseBody', { requestId: message.params.requestId }, 10_000)
      .then((body) => {
        const text = body.base64Encoded
          ? Buffer.from(body.body || '', 'base64').toString('utf8')
          : String(body.body || '');
        if (looksRelevant(`${url}\n${text}`)) {
          found.push({ kind: 'response', url, body: short(text) });
          console.log('\n[RESPONSE]', url, short(text, 2200));
        }
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

  const urls = [
    `https://live.shopee.co.th/p/share?from=live&session=${encodeURIComponent(sessionId)}`,
    `https://live.shopee.co.th/share?from=live&session=${encodeURIComponent(sessionId)}`,
  ];

  for (const url of urls) {
    console.log('\n[NAVIGATE]', url);
    await client.send('Page.navigate', { url }, 15_000).catch((error) => console.log('[NAV ERR]', error.message));
    await sleep(Math.floor(waitMs / urls.length));
  }

  const dom = await client.send('Runtime.evaluate', {
    expression: `({ href: location.href, title: document.title, text: document.body ? document.body.innerText.slice(0, 2000) : '' })`,
    returnByValue: true,
  }).catch((error) => ({ result: { value: { error: error.message } } }));
  console.log('\n[DOM]', JSON.stringify(dom.result?.value || {}, null, 2));
  console.log('\n[SUMMARY]', JSON.stringify({ found: found.length }, null, 2));
  client.close();
}

main()
  .catch((error) => {
    console.error('[probe failed]', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
