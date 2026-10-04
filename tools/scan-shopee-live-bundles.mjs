const sessionId = process.argv[2] || '';
const debugBase = process.env.CHROME_DEBUG_BASE || 'http://127.0.0.1:9223';

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
  const url = `https://live.shopee.co.th/p/share?from=live&session=${encodeURIComponent(sessionId)}`;
  const target = await json(`${debugBase}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  return target.webSocketDebuggerUrl;
}

function send(ws, method, params = {}, timeoutMs = 15000) {
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

const ws = new WebSocket(await createTarget());
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const waiter = pending.get(message.id);
  pending.delete(message.id);
  clearTimeout(waiter.timer);
  if (message.error) waiter.reject(new Error(message.error.message || 'CDP error'));
  else waiter.resolve(message.result);
});

await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
await send(ws, 'Page.enable');
await send(ws, 'Runtime.enable');
await send(ws, 'Network.enable');
await send(ws, 'Network.setUserAgentOverride', {
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
  platform: 'Android',
});
await send(ws, 'Page.navigate', { url: `https://live.shopee.co.th/p/share?from=live&session=${encodeURIComponent(sessionId)}` });
await new Promise((resolve) => setTimeout(resolve, 12000));

const result = await send(ws, 'Runtime.evaluate', {
  awaitPromise: true,
  returnByValue: true,
  expression: `
    (async () => {
      const urls = performance.getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((url) => /\\.(?:js)(?:\\?|$)/.test(url) && /live\\.shopee\\.co\\.th/.test(url));
      const interesting = [];
      const endpointRe = /["']((?:https?:\\/\\/[^"']+)?\\/(?:api|webapi)\\/[^"' ]{0,180})["']/g;
      for (const url of urls) {
        let text = '';
        try {
          const response = await fetch(url, { credentials: 'include' });
          text = await response.text();
        } catch (error) {
          interesting.push({ url, error: String(error) });
          continue;
        }
        const lower = text.toLowerCase();
        if (!/(comment|message|msg|chat|usersig|websocket|socket|im)/.test(lower)) continue;
        const endpoints = [];
        let match;
        while ((match = endpointRe.exec(text)) && endpoints.length < 80) {
          if (/(comment|message|msg|chat|session|preview|webapi)/i.test(match[1])) endpoints.push(match[1]);
        }
        const snippets = [];
        for (const term of ['comment', 'message', 'usersig', 'websocket', 'chatroom', 'post']) {
          const index = lower.indexOf(term);
          if (index >= 0) snippets.push(text.slice(Math.max(0, index - 260), index + 520));
        }
        interesting.push({ url, length: text.length, endpoints: [...new Set(endpoints)].slice(0, 60), snippets });
      }
      return interesting;
    })()
  `,
}, 120000);

console.log(JSON.stringify(result.result?.value || [], null, 2));
ws.close();
