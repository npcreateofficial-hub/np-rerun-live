import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { revealSecret } = require('./dist/secrets.js');

const prisma = new PrismaClient();
const accountId = process.env.ADS_ACCOUNT_ID || 'cmup8u5eu0009lb011qe26gbh';

function getCookieValue(cookie, key) {
  const match = String(cookie || '').match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function mergeSetCookies(cookie, setCookieHeaders) {
  const jar = new Map();
  for (const part of String(cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0) jar.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
  }
  for (const header of setCookieHeaders) {
    const first = String(header || '').split(';')[0] || '';
    const index = first.indexOf('=');
    if (index > 0) jar.set(first.slice(0, index).trim(), first.slice(index + 1).trim());
  }
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
}

try {
  const account = await prisma.adsAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error(`missing account ${accountId}`);
  let cookie = revealSecret(account.adsCookie);
  console.log('before', { hasSPC_CDS: Boolean(getCookieValue(cookie, 'SPC_CDS')) });

  const prime = await fetch('https://seller.shopee.co.th/portal/marketing/pas/live-stream', {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      cookie,
    },
    redirect: 'manual',
  });
  const setCookies = typeof prime.headers.getSetCookie === 'function'
    ? prime.headers.getSetCookie()
    : [prime.headers.get('set-cookie')].filter(Boolean);
  cookie = mergeSetCookies(cookie, setCookies);
  console.log('prime', {
    httpStatus: prime.status,
    location: prime.headers.get('location'),
    setCookieNames: setCookies.map((value) => String(value).split('=')[0]),
    hasSPC_CDS: Boolean(getCookieValue(cookie, 'SPC_CDS')),
  });

  const spcCds = getCookieValue(cookie, 'SPC_CDS');
  const url = new URL('https://seller.shopee.co.th/api/pas/v1/meta/get/');
  if (spcCds) url.searchParams.set('SPC_CDS', spcCds);
  url.searchParams.set('SPC_CDS_VER', '2');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
      origin: 'https://seller.shopee.co.th',
      referer: 'https://seller.shopee.co.th/portal/marketing/pas/live-stream',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      cookie,
    },
    body: JSON.stringify({ info_type_list: ['ads_credit', 'ads_toggle', 'has_ads', 'live_stream_account'] }),
  });
  const text = await response.text();
  console.log('meta', { httpStatus: response.status, body: text.slice(0, 800) });
} finally {
  await prisma.$disconnect();
}
