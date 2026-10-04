const sessionId = process.argv[2];
const seconds = Number(process.argv[3] || 45);
const debugBase = process.env.CHROME_DEBUG_BASE || 'http://127.0.0.1:9223';

if (!sessionId) {
  console.error('Usage: node tools/capture-shopee-live-comments.mjs <sessionId> [seconds]');
  process.exit(1);
}

let nextId = 1;
const pending = new Map();

async function json(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function createTarget() {
  const target = await json(`${debugBase}/json/new?${encodeURIComponent('https://live.shopee.co.th/')}`, { method: 'PUT' });
  return target.webSocketDebuggerUrl;
}

function send(ws, method, params = {}, timeoutMs = 10000) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timeout`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
  });
}

function tryJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function looksRelevant(text) {
  return /comment|message|msg|chat|content|nickname|username|display_name|user_info|usersig|webapi\/v1\/session/i.test(String(text || ''));
}

function compact(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.replace(/\s+/g, ' ').slice(0, 1200);
}

const wsUrl = await createTarget();
const ws = new WebSocket(wsUrl);
const found = [];

ws.addEventListener('message', async (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(waiter.timer);
    if (message.error) waiter.reject(new Error(message.error.message || 'CDP error'));
    else waiter.resolve(message.result);
    return;
  }

  if (message.method === 'Network.webSocketFrameReceived') {
    const payload = message.params?.response?.payloadData || '';
    if (looksRelevant(payload)) {
      const row = { source: 'ws', payload: compact(payload) };
      found.push(row);
      console.log('[WS]', row.payload);
    }
    return;
  }

  if (message.method === 'Network.responseReceived') {
    const url = String(message.params?.response?.url || '');
    if (!/live|comment|message|chat|session|im|gateway|webapi/i.test(url)) return;
    try {
      const body = await send(ws, 'Network.getResponseBody', { requestId: message.params.requestId }, 5000);
      const text = body.base64Encoded ? Buffer.from(body.body || '', 'base64').toString('utf8') : String(body.body || '');
      if (looksRelevant(url) || looksRelevant(text)) {
        const row = { source: 'http', url, status: message.params?.response?.status, body: compact(tryJson(text) || text) };
        found.push(row);
        console.log('[HTTP]', row.status, row.url, row.body);
      }
    } catch {
      // Some responses are not available through CDP. Ignore and keep capturing.
    }
  }
});

await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

await send(ws, 'Network.enable');
await send(ws, 'Page.enable');
await send(ws, 'Runtime.enable');
await send(ws, 'Network.setCacheDisabled', { cacheDisabled: true });
const mobileUa = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
await send(ws, 'Network.setUserAgentOverride', { userAgent: mobileUa, platform: 'Android' });

const urls = [
  `https://live.shopee.co.th/p/share?from=live&session=${encodeURIComponent(sessionId)}`,
  `https://live.shopee.co.th/share?from=live&session=${encodeURIComponent(sessionId)}`,
];

for (const url of urls) {
  console.log('[NAVIGATE]', url);
  await send(ws, 'Page.navigate', { url });
  await new Promise((resolve) => setTimeout(resolve, Math.max(8000, Math.floor((seconds * 1000) / urls.length))));
}

console.log('[SUMMARY]', JSON.stringify({ count: found.length, sessionId }, null, 2));
ws.close();
