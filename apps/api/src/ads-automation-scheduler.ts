import crypto from 'node:crypto';
import { prisma } from './prisma';
import { revealSecret } from './secrets';

const TICK_MS = 30_000;
const BUDGET_STEP_BAHT = 25;
const CATCH_UP_MINUTES = 10;
const PROFIT_CHECK_INTERVAL_MINUTES = 10;
const BUDGET_SLAP_DEFAULT_COOLDOWN_MINUTES = 5;
const RECREATE_DEFAULT_COOLDOWN_MINUTES = 60;
const SHOPEE_TOKEN_BACKOFF_MS = 10 * 60 * 1000;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
const tokenBackoffUntilByCampaign = new Map<number, number>();

type TimeWindow = { startHour?: string; startMinute?: string; endHour?: string; endMinute?: string };
type TimeBoostRow = { hour?: string; minute?: string; addAmount?: string; multiplier?: string };
type TierSetting = { min?: string; max?: string; cap?: string; add?: string };
type RecreateScheduleRow = { closeHour?: string; closeMinute?: string; createHour?: string; createMinute?: string };

type AutomationSettings = {
  budgetSlapEnabled?: boolean;
  budgetAutomationMode?: 'simple' | 'budget_cost' | 'tiered_budget_cost';
  budgetTimeMode?: 'always' | 'scheduled';
  budgetTimeWindows?: TimeWindow[];
  tiers?: TierSetting[];
  specialBoostEnabled?: boolean;
  specialBoostRows?: TimeBoostRow[];
  profitCheckEnabled?: boolean;
  profitCheckDays?: string[];
  cpoRoiWindows?: TimeWindow[];
  timeBoostEnabled?: boolean;
  timeBoostRows?: TimeBoostRow[];
  timeBoostRepeatEnabled?: boolean;
  timeBoostRepeatAddAmount?: string;
  timeBoostRepeatHours?: string;
  timeBoostRepeatMinutes?: string;
  recreateInactiveEnabled?: boolean;
  noOrderGuardEnabled?: boolean;
  badResultGuardEnabled?: boolean;
  recreateCpoTimeMode?: 'always' | 'scheduled';
  recreateNoOrderAfterBudget?: boolean;
  scheduleRecreateEnabled?: boolean;
  recreateScheduleRows?: RecreateScheduleRow[];
  advancedEnabled?: boolean;
  textValues?: Record<string, string>;
  lastTimeBoostRuns?: Record<string, string>;
  lastSpecialBoostRuns?: Record<string, string>;
  lastTimeBoostRepeatAt?: string;
  lastBudgetSlapAt?: string;
  lastBudgetSlapBudgetBaht?: number;
  lastProfitChecks?: Record<string, string>;
  lastProfitIssues?: Record<string, unknown>;
  lastRecreateRuns?: Record<string, string>;
  pendingScheduledRecreate?: {
    reason: string;
    dateKey: string;
    createHour?: string;
    createMinute?: string;
    closedAt: string;
  } | null;
};

type ShopeeCampaign = {
  campaign_id?: number;
  name?: string;
  objective?: string;
  state?: string;
  daily_budget?: number;
  total_budget?: number | null;
  start_time?: number;
  end_time?: number;
  time_slot_list?: Array<{ start_time?: number; end_time?: number }> | null;
  roi_two?: { target?: number | null } | null;
  target_broad_roi?: number | null;
};

type CampaignContext = {
  id: string;
  userId: string;
  campaignId: number;
  name: string;
  objective: string;
  state: string;
  automationSettings: string | null;
  adsAccount: { id: string; userId: string; accountName: string; shopName?: string | null; shopId?: string | null; adsCookie?: string | null };
};

type CampaignMetrics = {
  costBaht: number | null;
  orders: number | null;
  skuOrders: number | null;
  salesBaht: number | null;
  roi: number | null;
  costPerOrderBaht: number | null;
};

function getCookieValue(cookie: string, key: string) {
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function shopeeSellerCsrfHeaders(cookie: string) {
  const csrfToken = getCookieValue(cookie, 'csrftoken') || getCookieValue(cookie, 'CTOKEN');
  return {
    ...(csrfToken ? { 'x-csrftoken': csrfToken } : {}),
    'x-requested-with': 'XMLHttpRequest',
    'x-shopee-language': 'th',
  };
}

function moneyToShopeeAmount(value: number) { return Math.round(value * 100000); }
function shopeeAmountToBaht(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount / 100000 : null;
}
function toNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[฿,\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
function positiveNumber(value: unknown) {
  const parsed = toNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}
function normalizeBudgetStep(value: number) { return Math.ceil(value / BUDGET_STEP_BAHT) * BUDGET_STEP_BAHT; }
function minutesSince(isoValue?: string) {
  if (!isoValue) return Number.POSITIVE_INFINITY;
  const time = new Date(isoValue).getTime();
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return (Date.now() - time) / 60_000;
}

function shopeeSellerPasToken(cookie: string) {
  return getCookieValue(cookie, 'SPC_CDS');
}

async function shopeePasPost(cookie: string, path: string, body: unknown) {
  const spcCds = shopeeSellerPasToken(cookie);
  if (!spcCds) return { httpStatus: 400, payload: { code: 400, msg: 'Cookie สำหรับ Shopee Ads ขาดค่า SPC_CDS' } };
  const url = new URL(`https://seller.shopee.co.th/api/pas/v1${path}`);
  url.searchParams.set('SPC_CDS', spcCds);
  url.searchParams.set('SPC_CDS_VER', '2');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
      origin: 'https://seller.shopee.co.th',
      referer: 'https://seller.shopee.co.th/portal/marketing/pas/live-stream',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      ...shopeeSellerCsrfHeaders(cookie),
      cookie,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload: unknown = text;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
  return { httpStatus: response.status, ok: response.ok, payload };
}

function parseSettings(value?: string | null): AutomationSettings | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as AutomationSettings : null;
  } catch { return null; }
}

function bangkokMinuteKey(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date).map((part) => [part.type, part.value]));
  const hour = String(parts.hour ?? '').padStart(2, '0');
  const minute = String(parts.minute ?? '').padStart(2, '0');
  return { dateKey: `${parts.year}-${parts.month}-${parts.day}`, hour, minute, weekday: parts.weekday ?? '', minutesOfDay: Number(hour) * 60 + Number(minute), minuteKey: `${parts.year}-${parts.month}-${parts.day}T${hour}:${minute}` };
}

function bangkokStartOfTodayUnix() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return Math.floor(new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00+07:00`).getTime() / 1000);
}

function bangkokEndOfRestartWindowUnix(startTime: number) {
  return startTime + (15 * 24 * 60 * 60) - 1;
}

async function resolveCookie(account: CampaignContext['adsAccount']) {
  const directCookie = revealSecret(account.adsCookie);
  if (directCookie) return directCookie;
  const matchCandidates: Array<Record<string, string>> = [];
  if (account.shopId) { matchCandidates.push({ shopId: account.shopId }); matchCandidates.push({ platformUid: account.shopId }); }
  if (account.accountName) matchCandidates.push({ accountName: account.accountName });
  if (account.shopName) { matchCandidates.push({ accountName: account.shopName }); matchCandidates.push({ name: account.shopName }); }
  if (!matchCandidates.length) return null;
  const channel = await prisma.liveChannel.findFirst({
    where: { userId: account.userId, platform: 'SHOPEE', cookie: { not: null }, OR: matchCandidates },
    orderBy: { updatedAt: 'desc' },
  });
  return revealSecret(channel?.cookie);
}

function rowMinutes(hour?: string, minute?: string) {
  const h = Number(hour), m = Number(minute);
  if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(m) || m < 0 || m > 59) return null;
  return h * 60 + m;
}
function isDueAt(row: { hour?: string; minute?: string }, now: ReturnType<typeof bangkokMinuteKey>) {
  const scheduledMinutes = rowMinutes(row.hour, row.minute);
  if (scheduledMinutes === null) return false;
  const minutesLate = now.minutesOfDay - scheduledMinutes;
  return minutesLate >= 0 && minutesLate <= CATCH_UP_MINUTES;
}
function isInTimeWindow(window: TimeWindow, now: ReturnType<typeof bangkokMinuteKey>) {
  const start = rowMinutes(window.startHour, window.startMinute), end = rowMinutes(window.endHour, window.endMinute);
  if (start === null || end === null) return false;
  if (start <= end) return now.minutesOfDay >= start && now.minutesOfDay <= end;
  return now.minutesOfDay >= start || now.minutesOfDay <= end;
}
function allowedByWindows(mode: 'always' | 'scheduled' | undefined, windows: TimeWindow[] | undefined, now: ReturnType<typeof bangkokMinuteKey>) {
  if (mode !== 'scheduled') return true;
  return (windows ?? []).some((window) => isInTimeWindow(window, now));
}
function thaiDayKey(weekday: string) {
  return ({ Mon: 'จ.', Tue: 'อ.', Wed: 'พ.', Thu: 'พฤ.', Fri: 'ศ.', Sat: 'ส.', Sun: 'อา.' } as Record<string, string>)[weekday] ?? '';
}
function matchingBoostRows(rows: TimeBoostRow[] | undefined, now: ReturnType<typeof bangkokMinuteKey>) {
  return (rows ?? []).filter((row) => {
    const addAmount = positiveNumber(row.addAmount);
    return isDueAt(row, now) && addAmount !== null && addAmount % BUDGET_STEP_BAHT === 0;
  });
}

function findNumericField(value: unknown, keys: string[]): number | null {
  if (!value || typeof value !== 'object') return null;
  const objectValue = value as Record<string, unknown>;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(objectValue, key)) {
      const parsed = toNumber(objectValue[key]);
      if (parsed !== null) return parsed;
    }
  }
  for (const child of Object.values(objectValue)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const parsed = findNumericField(item, keys);
        if (parsed !== null) return parsed;
      }
    } else if (child && typeof child === 'object') {
      const parsed = findNumericField(child, keys);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

async function getShopeeCampaign(cookie: string, campaignId: number) {
  const result = await shopeePasPost(cookie, '/live_stream/get/', { campaign_id: campaignId });
  const payload = result.payload as { code?: number; data?: { campaign?: ShopeeCampaign } } | null;
  if (payload?.code !== 0 || !payload.data?.campaign) return { campaign: null, raw: result.payload };
  return { campaign: payload.data.campaign, raw: result.payload };
}

async function getCampaignMetrics(cookie: string, campaign: CampaignContext): Promise<CampaignMetrics> {
  const today = bangkokStartOfTodayUnix();
  const result = await shopeePasPost(cookie, '/report/get/', { campaign_type: 'live_stream', campaign_id_list: [campaign.campaignId], campaign_id: campaign.campaignId, start_time: today, end_time: Math.floor(Date.now() / 1000) });
  const costRaw = findNumericField(result.payload, ['cost', 'expense', 'spend', 'ads_cost', 'ads_expense', 'cost_amount']);
  const salesRaw = findNumericField(result.payload, ['gmv', 'sales', 'revenue', 'direct_gmv', 'direct_sales', 'gmv_amount']);
  const ordersRaw = findNumericField(result.payload, ['orders', 'order', 'order_count', 'paid_order', 'paid_order_count', 'order_amount']);
  const skuOrdersRaw = findNumericField(result.payload, ['sku_orders', 'sku_order', 'sku_order_count', 'item_order_count']) ?? ordersRaw;
  const roiRaw = findNumericField(result.payload, ['roas', 'roi']);
  const costBaht = costRaw !== null && costRaw > 10000 ? shopeeAmountToBaht(costRaw) : costRaw;
  const salesBaht = salesRaw !== null && salesRaw > 10000 ? shopeeAmountToBaht(salesRaw) : salesRaw;
  const orders = ordersRaw !== null ? Math.round(ordersRaw) : null;
  const skuOrders = skuOrdersRaw !== null ? Math.round(skuOrdersRaw) : null;
  const roi = roiRaw ?? (costBaht && salesBaht !== null ? salesBaht / costBaht : null);
  const costPerOrderBaht = costBaht !== null && orders && orders > 0 ? costBaht / orders : null;
  return { costBaht, orders, skuOrders, salesBaht, roi, costPerOrderBaht };
}

async function updateDailyBudget(cookie: string, campaignId: number, nextBudgetBaht: number) {
  const normalized = normalizeBudgetStep(nextBudgetBaht);
  const result = await shopeePasPost(cookie, '/live_stream/edit/', { campaign_id: campaignId, type: 'change_budget', change_budget: { daily_budget: moneyToShopeeAmount(normalized), page: 'page_after_creation' } });
  const payload = result.payload as { code?: number; msg?: string } | null;
  return { success: payload?.code === 0, payload: result.payload, nextBudgetBaht: normalized };
}
async function changeCampaignState(cookie: string, campaignId: number, type: 'pause' | 'resume' | 'stop') {
  const result = await shopeePasPost(cookie, '/live_stream/edit/', { campaign_id: campaignId, type });
  const payload = result.payload as { code?: number; msg?: string } | null;
  return { success: payload?.code === 0, payload: result.payload };
}
function buildRestartPayload(source: ShopeeCampaign, name: string, referenceId: string) {
  const objective = source.objective || 'max_gmv_roi_two';
  const startTime = bangkokStartOfTodayUnix();
  const endTime = source.end_time && source.end_time > startTime ? source.end_time : bangkokEndOfRestartWindowUnix(startTime);
  return { reference_id: referenceId, is_restart: false, is_duplicate_name: false, name, pre_name: source.name ?? '', date_type: 'no', budget_type: source.daily_budget && source.daily_budget > 0 ? 'daily' : 'no', time_type: 'all_day', objective, upper_bound: 0, lower_bound: 0, need_to_show: false, time_slot_list: source.time_slot_list?.length ? source.time_slot_list : [{ start_time: 0, end_time: 0 }], end_time: endTime, daily_budget: source.daily_budget ?? 0, start_time: startTime, target_roas_type: 'no', target_broad_roi: source.target_broad_roi ?? 0, enable_gmv_max: objective === 'max_gmv' || objective === 'max_gmv_roi_two', roi_two_target: source.roi_two?.target ? { target: source.roi_two.target } : null, target_roas_option: 'lower_bound', roi_option: 'lower_bound', simple_mode_roi_type: 'no' };
}
async function publishReplacement(cookie: string, campaign: CampaignContext, source: ShopeeCampaign, reason: string) {
  const referenceId = crypto.randomUUID();
  const name = `${(source.name || campaign.name).slice(0, 38)} Rerun`;
  const payload = buildRestartPayload(source, name, referenceId);
  const publishResult = await shopeePasPost(cookie, '/live_stream/publish/', { reference_id: referenceId, campaign: payload });
  const publishPayload = publishResult.payload as { code?: number; msg?: string; data?: { campaign_id?: number; result_list?: Array<{ campaign_uuid?: string }> } } | null;
  const newCampaignId = Number(publishPayload?.data?.campaign_id ?? 0);
  if (publishPayload?.code !== 0 || !Number.isSafeInteger(newCampaignId) || newCampaignId <= 0) return { success: false, payload: publishResult.payload, newCampaignId: null };
  await prisma.adsLiveCampaign.upsert({
    where: { userId_campaignId: { userId: campaign.userId, campaignId: newCampaignId } },
    create: { userId: campaign.userId, adsAccountId: campaign.adsAccount.id, campaignId: newCampaignId, campaignUuid: publishPayload.data?.result_list?.[0]?.campaign_uuid ?? null, name, objective: source.objective ?? campaign.objective, state: 'ongoing', automationSettings: JSON.stringify({ ...(parseSettings(campaign.automationSettings) ?? {}), lastRecreateRuns: {} }) },
    update: { adsAccountId: campaign.adsAccount.id, campaignUuid: publishPayload.data?.result_list?.[0]?.campaign_uuid ?? null, name, objective: source.objective ?? campaign.objective, state: 'ongoing' },
  });
  await changeCampaignState(cookie, campaign.campaignId, 'stop');
  await prisma.adsLiveCampaign.update({ where: { id: campaign.id }, data: { state: 'closed' } });
  console.info('[ads-automation] replacement campaign created', { oldCampaignId: campaign.campaignId, newCampaignId, reason });
  return { success: true, payload: publishResult.payload, newCampaignId };
}
async function saveSettings(campaignId: string, settings: AutomationSettings) {
  await prisma.adsLiveCampaign.update({ where: { id: campaignId }, data: { automationSettings: JSON.stringify(settings) } });
}

async function applyTimedBoosts(options: { cookie: string; campaign: CampaignContext; settings: AutomationSettings; shopeeCampaign: ShopeeCampaign; now: ReturnType<typeof bangkokMinuteKey>; rows: TimeBoostRow[]; runKeyName: 'lastTimeBoostRuns' | 'lastSpecialBoostRuns'; label: string }) {
  for (const row of options.rows) {
    const rowKey = `${options.campaign.campaignId}:${row.hour}:${row.minute}:${row.addAmount}:${options.label}`;
    const scheduledRunKey = `${options.now.dateKey}T${String(row.hour ?? '').padStart(2, '0')}:${String(row.minute ?? '').padStart(2, '0')}`;
    if (options.settings[options.runKeyName]?.[rowKey] === scheduledRunKey) continue;
    const currentBudgetBaht = shopeeAmountToBaht(options.shopeeCampaign.daily_budget);
    const addBaht = positiveNumber(row.addAmount);
    if (currentBudgetBaht === null || addBaht === null) continue;
    const edit = await updateDailyBudget(options.cookie, options.campaign.campaignId, currentBudgetBaht + addBaht);
    if (!edit.success) { console.warn(`[ads-automation] ${options.label} failed`, { campaignId: options.campaign.campaignId, row, shopee: edit.payload }); continue; }
    options.shopeeCampaign.daily_budget = moneyToShopeeAmount(edit.nextBudgetBaht);
    options.settings[options.runKeyName] = { ...(options.settings[options.runKeyName] ?? {}), [rowKey]: scheduledRunKey };
    options.settings.lastBudgetSlapAt = new Date().toISOString();
    options.settings.lastBudgetSlapBudgetBaht = edit.nextBudgetBaht;
    await saveSettings(options.campaign.id, options.settings);
    console.info(`[ads-automation] ${options.label} applied`, { campaignId: options.campaign.campaignId, campaignName: options.campaign.name, at: `${options.now.hour}:${options.now.minute}`, addBaht, nextBudgetBaht: edit.nextBudgetBaht });
  }
}

async function applyRepeatTimeBoost(cookie: string, campaign: CampaignContext, settings: AutomationSettings, shopeeCampaign: ShopeeCampaign, now: ReturnType<typeof bangkokMinuteKey>) {
  if (!settings.timeBoostEnabled || !settings.timeBoostRepeatEnabled) return;
  const addBaht = positiveNumber(settings.timeBoostRepeatAddAmount);
  const repeatHours = toNumber(settings.timeBoostRepeatHours) ?? 0;
  const repeatMinutes = toNumber(settings.timeBoostRepeatMinutes) ?? 0;
  const intervalMinutes = repeatHours * 60 + repeatMinutes;
  if (addBaht === null || addBaht <= 0 || addBaht % BUDGET_STEP_BAHT !== 0 || intervalMinutes <= 0) return;
  if (settings.lastTimeBoostRepeatAt && minutesSince(settings.lastTimeBoostRepeatAt) < intervalMinutes) return;
  const currentBudgetBaht = shopeeAmountToBaht(shopeeCampaign.daily_budget);
  if (currentBudgetBaht === null || currentBudgetBaht <= 0) return;
  const edit = await updateDailyBudget(cookie, campaign.campaignId, currentBudgetBaht + addBaht);
  if (!edit.success) {
    console.warn('[ads-automation] repeat time boost failed', { campaignId: campaign.campaignId, addBaht, intervalMinutes, shopee: edit.payload });
    return;
  }
  shopeeCampaign.daily_budget = moneyToShopeeAmount(edit.nextBudgetBaht);
  settings.lastTimeBoostRepeatAt = new Date().toISOString();
  settings.lastBudgetSlapAt = settings.lastTimeBoostRepeatAt;
  settings.lastBudgetSlapBudgetBaht = edit.nextBudgetBaht;
  await saveSettings(campaign.id, settings);
  console.info('[ads-automation] repeat time boost applied', {
    campaignId: campaign.campaignId,
    campaignName: campaign.name,
    addBaht,
    intervalMinutes,
    nextBudgetBaht: edit.nextBudgetBaht,
    at: now.minuteKey,
  });
}

function budgetSlapAddBaht(settings: AutomationSettings, metrics: CampaignMetrics, currentBudgetBaht: number) {
  const mode = settings.budgetAutomationMode ?? 'simple';
  const values = settings.textValues ?? {};
  const remainingBaht = metrics.costBaht === null ? null : currentBudgetBaht - metrics.costBaht;
  const remainingPercent = remainingBaht === null ? null : (remainingBaht / currentBudgetBaht) * 100;
  if (mode === 'simple') {
    const threshold = positiveNumber(values.budgetSimpleRemainingPercent);
    if (threshold === null || remainingPercent === null || remainingPercent > threshold) return null;
    const addBaht = positiveNumber(values.budgetSimpleAddBaht);
    const addPercent = positiveNumber(values.budgetSimpleAddPercent);
    const maxAdd = positiveNumber(values.budgetSimpleMaxAddPerRunBaht);
    const dailyCap = positiveNumber(values.budgetSimpleDailyCapBaht);
    const rawAdd = addBaht ?? (addPercent ? currentBudgetBaht * (addPercent / 100) : null);
    if (!rawAdd) return null;
    const cappedAdd = maxAdd ? Math.min(rawAdd, maxAdd) : rawAdd;
    const nextBudget = dailyCap ? Math.min(currentBudgetBaht + cappedAdd, dailyCap) : currentBudgetBaht + cappedAdd;
    return Math.max(0, normalizeBudgetStep(nextBudget) - currentBudgetBaht);
  }
  if (mode === 'budget_cost') {
    const threshold = positiveNumber(values.budgetCostRemainingBaht);
    const addBaht = positiveNumber(values.budgetCostAddBaht);
    const dailyCap = positiveNumber(values.budgetCostDailyCapBaht);
    if (threshold === null || addBaht === null || remainingBaht === null || remainingBaht > threshold) return null;
    const nextBudget = dailyCap ? Math.min(currentBudgetBaht + addBaht, dailyCap) : currentBudgetBaht + addBaht;
    return Math.max(0, normalizeBudgetStep(nextBudget) - currentBudgetBaht);
  }
  const tier = (settings.tiers ?? []).find((item) => {
    const min = toNumber(item.min) ?? 0;
    const max = positiveNumber(item.max);
    return currentBudgetBaht >= min && (max === null || currentBudgetBaht <= max);
  });
  if (!tier || remainingBaht === null) return null;
  const cap = positiveNumber(tier.cap), add = positiveNumber(tier.add);
  if (cap === null || add === null || remainingBaht > cap) return null;
  const maxBudget = positiveNumber(values.tieredMaxBudgetBaht);
  const nextBudget = maxBudget ? Math.min(currentBudgetBaht + add, maxBudget) : currentBudgetBaht + add;
  return Math.max(0, normalizeBudgetStep(nextBudget) - currentBudgetBaht);
}

async function applyBudgetSlap(cookie: string, campaign: CampaignContext, settings: AutomationSettings, shopeeCampaign: ShopeeCampaign, metrics: CampaignMetrics, now: ReturnType<typeof bangkokMinuteKey>) {
  if (!settings.budgetSlapEnabled) return;
  if (!allowedByWindows(settings.budgetTimeMode, settings.budgetTimeWindows, now)) return;
  const currentBudgetBaht = shopeeAmountToBaht(shopeeCampaign.daily_budget);
  if (currentBudgetBaht === null || currentBudgetBaht <= 0) return;
  const values = settings.textValues ?? {};
  const cooldown = positiveNumber(settings.budgetAutomationMode === 'budget_cost' ? values.budgetCostCooldownMinutes : settings.budgetAutomationMode === 'tiered_budget_cost' ? values.tieredCooldownMinutes : values.budgetSimpleCooldownMinutes) ?? BUDGET_SLAP_DEFAULT_COOLDOWN_MINUTES;
  if (minutesSince(settings.lastBudgetSlapAt) < cooldown) return;
  const addBaht = budgetSlapAddBaht(settings, metrics, currentBudgetBaht);
  if (!addBaht || addBaht <= 0) return;
  if (addBaht % BUDGET_STEP_BAHT !== 0) { console.warn('[ads-automation] budget slap add amount invalid step', { campaignId: campaign.campaignId, addBaht }); return; }
  const edit = await updateDailyBudget(cookie, campaign.campaignId, currentBudgetBaht + addBaht);
  if (!edit.success) { console.warn('[ads-automation] budget slap failed', { campaignId: campaign.campaignId, shopee: edit.payload }); return; }
  shopeeCampaign.daily_budget = moneyToShopeeAmount(edit.nextBudgetBaht);
  settings.lastBudgetSlapAt = new Date().toISOString();
  settings.lastBudgetSlapBudgetBaht = edit.nextBudgetBaht;
  await saveSettings(campaign.id, settings);
  console.info('[ads-automation] budget slap applied', { campaignId: campaign.campaignId, addBaht, nextBudgetBaht: edit.nextBudgetBaht, metrics });
}

function profitIssues(settings: AutomationSettings, metrics: CampaignMetrics, prefix: 'profit' | 'badResult') {
  const values = settings.textValues ?? {};
  const minRoi = positiveNumber(values[`${prefix}MinRoi`]);
  const maxCpo = positiveNumber(values[`${prefix}MaxCostPerOrder`]);
  const minSkuOrders = prefix === 'profit' ? positiveNumber(values.profitMinSkuOrders) : null;
  const skipBelowOrders = prefix === 'badResult' ? positiveNumber(values.badResultSkipIfOrdersBelow) : null;
  if (skipBelowOrders !== null && (metrics.orders ?? 0) < skipBelowOrders) return [];
  const issues: string[] = [];
  if (minRoi !== null && metrics.roi !== null && metrics.roi < minRoi) issues.push('roi_below_min');
  if (maxCpo !== null && metrics.costPerOrderBaht !== null && metrics.costPerOrderBaht > maxCpo) issues.push('cost_per_order_above_max');
  if (minSkuOrders !== null && metrics.skuOrders !== null && metrics.skuOrders < minSkuOrders) issues.push('sku_orders_below_min');
  return issues;
}
async function applyProfitCheck(campaign: CampaignContext, settings: AutomationSettings, metrics: CampaignMetrics, now: ReturnType<typeof bangkokMinuteKey>) {
  if (!settings.profitCheckEnabled) return;
  const today = thaiDayKey(now.weekday);
  if (settings.profitCheckDays?.length && !settings.profitCheckDays.includes(today)) return;
  if (settings.cpoRoiWindows?.length && !allowedByWindows('scheduled', settings.cpoRoiWindows, now)) return;
  const key = `${campaign.campaignId}:${now.dateKey}:${Math.floor(now.minutesOfDay / PROFIT_CHECK_INTERVAL_MINUTES)}`;
  if (settings.lastProfitChecks?.[key]) return;
  const issues = profitIssues(settings, metrics, 'profit');
  settings.lastProfitChecks = { ...(settings.lastProfitChecks ?? {}), [key]: new Date().toISOString() };
  if (issues.length) {
    settings.lastProfitIssues = { ...(settings.lastProfitIssues ?? {}), [key]: { issues, metrics } };
    console.warn('[ads-automation] profit check found issues', { campaignId: campaign.campaignId, issues, metrics });
  }
  await saveSettings(campaign.id, settings);
}

function scheduledRecreateDue(settings: AutomationSettings, now: ReturnType<typeof bangkokMinuteKey>) {
  if (!settings.scheduleRecreateEnabled) return null;
  for (const row of settings.recreateScheduleRows ?? []) {
    if (isDueAt({ hour: row.closeHour, minute: row.closeMinute }, now)) return {
      reason: `schedule:${row.closeHour}:${row.closeMinute}`,
      row,
    };
  }
  return null;
}
async function maybeRecreate(cookie: string, campaign: CampaignContext, settings: AutomationSettings, shopeeCampaign: ShopeeCampaign, metrics: CampaignMetrics, now: ReturnType<typeof bangkokMinuteKey>) {
  const runToday = (reason: string) => `${now.dateKey}:${reason}`;
  const alreadyRan = (reason: string) => settings.lastRecreateRuns?.[`${campaign.campaignId}:${reason}`] === runToday(reason);
  const markRan = async (reason: string) => { settings.lastRecreateRuns = { ...(settings.lastRecreateRuns ?? {}), [`${campaign.campaignId}:${reason}`]: runToday(reason) }; await saveSettings(campaign.id, settings); };
  const run = async (reason: string) => { if (alreadyRan(reason)) return; const result = await publishReplacement(cookie, campaign, shopeeCampaign, reason); if (result.success) await markRan(reason); };
  const pending = settings.pendingScheduledRecreate;
  if (pending) {
    if (isDueAt({ hour: pending.createHour, minute: pending.createMinute }, now)) {
      const result = await publishReplacement(cookie, campaign, shopeeCampaign, pending.reason);
      if (result.success) {
        settings.pendingScheduledRecreate = null;
        await markRan(pending.reason);
      }
    }
    return;
  }
  const scheduledReason = scheduledRecreateDue(settings, now);
  if (scheduledReason) {
    if (alreadyRan(scheduledReason.reason)) return;
    const hasCreateTime = scheduledReason.row.createHour !== '' && scheduledReason.row.createMinute !== '';
    if (hasCreateTime) {
      const stop = await changeCampaignState(cookie, campaign.campaignId, 'stop');
      if (!stop.success) { console.warn('[ads-automation] scheduled close failed', { campaignId: campaign.campaignId, shopee: stop.payload }); return; }
      await prisma.adsLiveCampaign.update({ where: { id: campaign.id }, data: { state: 'closed' } });
      settings.pendingScheduledRecreate = {
        reason: scheduledReason.reason,
        dateKey: now.dateKey,
        createHour: scheduledReason.row.createHour,
        createMinute: scheduledReason.row.createMinute,
        closedAt: new Date().toISOString(),
      };
      await saveSettings(campaign.id, settings);
      console.info('[ads-automation] scheduled campaign closed; waiting to recreate', { campaignId: campaign.campaignId, campaignName: campaign.name, reason: scheduledReason.reason, createHour: scheduledReason.row.createHour, createMinute: scheduledReason.row.createMinute });
      return;
    }
    await run(scheduledReason.reason);
    return;
  }
  if (settings.recreateInactiveEnabled && shopeeCampaign.state && !['ongoing', 'scheduled'].includes(shopeeCampaign.state)) { await run(`inactive:${shopeeCampaign.state}`); return; }
  if (settings.noOrderGuardEnabled) {
    const values = settings.textValues ?? {};
    const costThreshold = positiveNumber(values.noOrderCostBaht);
    const hoursThreshold = positiveNumber(values.noOrderAfterHours);
    const createdAt = new Date(Number(shopeeCampaign.start_time ?? 0) * 1000);
    const runningHours = Number.isFinite(createdAt.getTime()) ? (Date.now() - createdAt.getTime()) / 3_600_000 : null;
    if (costThreshold !== null && hoursThreshold !== null && metrics.costBaht !== null && runningHours !== null && metrics.skuOrders !== null && metrics.costBaht >= costThreshold && runningHours >= hoursThreshold && metrics.skuOrders <= 0) { await run('no_order_guard'); return; }
  }
  if (settings.badResultGuardEnabled) {
    if (settings.recreateCpoTimeMode === 'scheduled' && !allowedByWindows('scheduled', settings.cpoRoiWindows, now)) return;
    const cooldown = positiveNumber(settings.textValues?.badResultCooldownMinutes) ?? RECREATE_DEFAULT_COOLDOWN_MINUTES;
    if (minutesSince(settings.lastRecreateRuns?.[`${campaign.campaignId}:bad_result_guard:lastAt`]) < cooldown) return;
    const issues = profitIssues(settings, metrics, 'badResult');
    if (issues.length) {
      await run('bad_result_guard');
      settings.lastRecreateRuns = { ...(settings.lastRecreateRuns ?? {}), [`${campaign.campaignId}:bad_result_guard:lastAt`]: new Date().toISOString() };
      await saveSettings(campaign.id, settings);
      return;
    }
  }
  if (settings.recreateNoOrderAfterBudget && settings.lastBudgetSlapAt) {
    const waitMinutes = positiveNumber(settings.textValues?.recreateAfterBudgetWaitMinutes) ?? 60;
    if (minutesSince(settings.lastBudgetSlapAt) >= waitMinutes && metrics.orders !== null && metrics.orders <= 0) await run('no_order_after_budget');
  }
}

async function processCampaign(campaign: CampaignContext, now: ReturnType<typeof bangkokMinuteKey>) {
  const settings = parseSettings(campaign.automationSettings);
  if (!settings) return;
  const tokenBackoffUntil = tokenBackoffUntilByCampaign.get(campaign.campaignId) ?? 0;
  if (tokenBackoffUntil > Date.now()) return;
  const cookie = await resolveCookie(campaign.adsAccount);
  if (!cookie) { if (settings.advancedEnabled) console.warn('[ads-automation] missing cookie', { campaignId: campaign.campaignId }); return; }
  const { campaign: shopeeCampaign, raw } = await getShopeeCampaign(cookie, campaign.campaignId);
  if (!shopeeCampaign) {
    const shopeePayload = raw as { errcode?: number; message?: string; msg?: string } | null;
    const message = String(shopeePayload?.message ?? shopeePayload?.msg ?? '').toLowerCase();
    if (shopeePayload?.errcode === 2 && message.includes('token')) {
      tokenBackoffUntilByCampaign.set(campaign.campaignId, Date.now() + SHOPEE_TOKEN_BACKOFF_MS);
      console.warn('[ads-automation] Shopee token missing; pausing automation reads temporarily', {
        campaignId: campaign.campaignId,
        backoffMinutes: Math.round(SHOPEE_TOKEN_BACKOFF_MS / 60_000),
      });
      return;
    }
    console.warn('[ads-automation] cannot read campaign', { campaignId: campaign.campaignId, shopee: raw });
    return;
  }
  tokenBackoffUntilByCampaign.delete(campaign.campaignId);
  const metrics = await getCampaignMetrics(cookie, campaign);
  await applyTimedBoosts({ cookie, campaign, settings, shopeeCampaign, now, rows: settings.timeBoostEnabled ? matchingBoostRows(settings.timeBoostRows, now) : [], runKeyName: 'lastTimeBoostRuns', label: 'time boost' });
  await applyRepeatTimeBoost(cookie, campaign, settings, shopeeCampaign, now);
  await applyTimedBoosts({ cookie, campaign, settings, shopeeCampaign, now, rows: settings.specialBoostEnabled ? matchingBoostRows(settings.specialBoostRows, now) : [], runKeyName: 'lastSpecialBoostRuns', label: 'special boost' });
  await applyBudgetSlap(cookie, campaign, settings, shopeeCampaign, metrics, now);
  await applyProfitCheck(campaign, settings, metrics, now);
  await maybeRecreate(cookie, campaign, settings, shopeeCampaign, metrics, now);
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const now = bangkokMinuteKey();
    const campaigns = await prisma.adsLiveCampaign.findMany({ where: { automationSettings: { not: null } }, include: { adsAccount: true } });
    for (const campaign of campaigns) {
      try { await processCampaign(campaign as CampaignContext, now); }
      catch (error) { console.error('[ads-automation] campaign failed', { campaignId: campaign.campaignId, error }); }
    }
  } catch (error) { console.error('[ads-automation] tick failed', error); }
  finally { running = false; }
}

export function startAdsAutomationScheduler() {
  if (timer) return;
  void tick();
  timer = setInterval(() => void tick(), TICK_MS);
  console.log(`  Ads automation scheduler: ON (${Math.round(TICK_MS / 1000)}s tick)`);
}
