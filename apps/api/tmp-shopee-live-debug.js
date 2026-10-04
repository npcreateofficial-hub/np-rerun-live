const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { revealSecret } = require('./dist/secrets');

const prisma = new PrismaClient();

function getCookieValue(cookie, key) {
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function bangkokStartOfTodayUnix() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  return Math.floor(new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00+07:00`).getTime() / 1000);
}

async function shopeePasPost(cookie, path, body) {
  const spcCds = getCookieValue(cookie, 'SPC_CDS');
  const url = new URL(`https://seller.shopee.co.th/api/pas/v1${path}`);
  if (spcCds) url.searchParams.set('SPC_CDS', spcCds);
  url.searchParams.set('SPC_CDS_VER', '2');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
      origin: 'https://seller.shopee.co.th',
      referer: 'https://seller.shopee.co.th/portal/marketing/pas/live-stream/create?source_page_id=2',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      cookie,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  try {
    return { status: response.status, payload: text ? JSON.parse(text) : null };
  } catch {
    return { status: response.status, payload: text };
  }
}

async function resolveCookie(account) {
  const direct = revealSecret(account.adsCookie);
  if (direct) return direct;
  const candidates = [];
  if (account.shopId) {
    candidates.push({ shopId: account.shopId });
    candidates.push({ platformUid: account.shopId });
  }
  if (account.accountName) candidates.push({ accountName: account.accountName });
  if (account.shopName) {
    candidates.push({ accountName: account.shopName });
    candidates.push({ name: account.shopName });
  }
  const channel = await prisma.liveChannel.findFirst({
    where: { userId: account.userId, platform: 'SHOPEE', cookie: { not: null }, OR: candidates },
    orderBy: { updatedAt: 'desc' },
  });
  return revealSecret(channel && channel.cookie);
}

(async () => {
  const accountId = process.argv[2];
  const name = process.argv[3] || `test-codex-${Date.now()}`;
  const account = await prisma.adsAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error(`AdsAccount not found: ${accountId}`);
  const cookie = await resolveCookie(account);
  if (!cookie) throw new Error('No Shopee cookie found for account');
  const referenceId = crypto.randomUUID();
  const campaign = {
    daily_budget: 0,
    start_time: bangkokStartOfTodayUnix(),
    end_time: 0,
    time_slot_list: [{ start_time: 0, end_time: 0 }],
    name,
    objective: 'max_gmv_roi_two',
    roi_two_target: null,
  };
  const overlap = await shopeePasPost(cookie, '/live_stream/check_overlapping_ads_for_roi_two/', {
    start_time: campaign.start_time,
    end_time: campaign.end_time,
    objective: campaign.objective,
  });
  const publish = await shopeePasPost(cookie, '/live_stream/publish/', { reference_id: referenceId, campaign });
  console.log(JSON.stringify({
    accountId,
    name,
    referenceId,
    spcCdsPresent: Boolean(getCookieValue(cookie, 'SPC_CDS')),
    campaign,
    overlap,
    publish,
  }, null, 2));
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
