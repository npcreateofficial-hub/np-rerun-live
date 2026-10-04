import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { AppError, asyncHandler, ok } from '../http';
import { requireAuth, type AuthedRequest } from '../auth';
import { maskSecret, protectSecret, revealSecret } from '../secrets';

export const adsAccountsRouter = Router();

adsAccountsRouter.use(requireAuth);

const writeSchema = z.object({
  accountName: z.string().trim().min(1, 'กรุณากรอกชื่อบัญชี Ads'),
  shopName: z.string().trim().optional().nullable(),
  shopId: z.string().trim().optional().nullable(),
  adsCookie: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable(),
});

const liveCampaignCreateSchema = z.object({
  name: z.string().trim().min(1, 'กรุณากรอกชื่อแคมเปญ').max(50, 'ชื่อแคมเปญยาวเกิน 50 ตัวอักษร'),
  dailyBudget: z.coerce.number().positive().optional(),
  objective: z.enum(['max_gmv', 'max_view', 'max_gmv_roi_two']).optional().default('max_gmv_roi_two'),
  dryRun: z.boolean().optional().default(false),
  automationSettings: z.unknown().optional(),
});

const liveCampaignStateSchema = z.object({
  type: z.enum(['pause', 'resume', 'stop']),
  startTime: z.coerce.number().int().positive().optional(),
  endTime: z.coerce.number().int().positive().optional(),
  objective: z.enum(['max_gmv', 'max_view', 'max_gmv_roi_two']).optional(),
});

const liveCampaignUpdateSchema = z.object({
  name: z.string().trim().min(1, 'กรุณากรอกชื่อแคมเปญ').max(50, 'ชื่อแคมเปญยาวเกิน 50 ตัวอักษร').optional(),
  dailyBudget: z.coerce.number().positive('กรุณากรอกงบประมาณรายวัน').optional(),
  objective: z.enum(['max_gmv', 'max_view', 'max_gmv_roi_two']).optional(),
  automationSettings: z.unknown().optional(),
});

type LiveCampaignAction = z.infer<typeof liveCampaignStateSchema>['type'];

function normalizeShopeeLiveCampaignState(value?: string | null) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (['ongoing', 'running', 'active', 'started', 'advertising', 'live', 'กำลังโฆษณา', 'กำลังใช้งาน'].includes(normalized)) return 'ongoing';
  if (['paused', 'pause', 'suspended', 'หยุดชั่วคราว', 'พัก', 'ไม่แสดงผลชั่วคราว'].includes(normalized)) return 'paused';
  if (['ended', 'end', 'closed', 'stopped', 'stop', 'finished', 'terminated', 'สิ้นสุดแล้ว', 'หยุดแล้ว'].includes(normalized)) return 'ended';
  if (['scheduled', 'pending', 'ready', 'รอเริ่ม', 'พร้อมใช้งาน'].includes(normalized)) return 'scheduled';
  return normalized;
}

function liveCampaignStateMatchesAction(action: LiveCampaignAction, state?: string | null) {
  const normalized = normalizeShopeeLiveCampaignState(state);
  if (action === 'resume') return normalized === 'ongoing' || normalized === 'scheduled';
  if (action === 'pause') return normalized === 'paused';
  return normalized === 'ended' || normalized === 'closed';
}

const adsCapabilities = [
  {
    key: 'np-live-safe-layer',
    group: 'NP LIVE Safe Layer',
    auth: 'NP LIVE',
    status: 'READY',
    summary: 'ชั้นควบคุมในระบบเรา: เก็บบัญชี Ads แยกจากบัญชีไลฟ์, เข้ารหัส Cookie, ตรวจความพร้อม และซ่อน endpoint ใต้ /api/NP',
    items: [
      { label: 'จัดการบัญชี Ads', method: 'CRUD', path: '/api/NP/y13', risk: 'LOW', implemented: true },
      { label: 'ตรวจ Cookie พร้อมใช้', method: 'POST', path: '/api/NP/y13/:id/k30', risk: 'LOW', implemented: true },
      { label: 'แผนที่ความสามารถ Ads', method: 'GET', path: '/api/NP/y13/k33', risk: 'LOW', implemented: true },
    ],
  },
  {
    key: 'shopee-ads-open-platform',
    group: 'Shopee Open Platform - Ads',
    auth: 'OPEN_PLATFORM',
    status: 'NEEDS_TOKEN',
    summary: 'เหมาะกับงาน Product Ads/GMS เช่น ดูแคมเปญ, ดู performance, keyword, เปิด/ปิด/ลบแคมเปญ ต้องใช้ partner credentials และ shop access token',
    items: [
      { label: 'ตรวจสิทธิ์สร้าง GMS campaign', method: 'GET', path: '/api/v2/ads/check_create_gms_product_campaign_eligibility', risk: 'READ', implemented: false },
      { label: 'ดึง campaign id ระดับสินค้า', method: 'GET', path: '/api/v2/ads/get_product_level_campaign_id_list', risk: 'READ', implemented: false },
      { label: 'ดึงข้อมูลตั้งค่า campaign', method: 'GET', path: '/api/v2/ads/get_product_level_campaign_setting_info', risk: 'READ', implemented: false },
      { label: 'ดึงข้อมูล performance ของแคมเปญ', method: 'POST', path: '/api/v2/ads/get_gms_campaign_performance', risk: 'READ', implemented: false },
      { label: 'ดึง performance รายสินค้า', method: 'POST', path: '/api/v2/ads/get_gms_item_performance', risk: 'READ', implemented: false },
      { label: 'ดึง performance รายวัน/รายชั่วโมง', method: 'GET', path: '/api/v2/ads/get_product_campaign_daily_performance, /api/v2/ads/get_product_campaign_hourly_performance', risk: 'READ', implemented: false },
      { label: 'ดึง keyword ที่ Shopee แนะนำ', method: 'GET', path: '/api/v2/ads/get_recommended_keyword_list', risk: 'READ', implemented: false },
      { label: 'ดึงสินค้าแนะนำสำหรับลง Ads', method: 'GET', path: '/api/v2/ads/get_recommended_item_list', risk: 'READ', implemented: false },
      { label: 'ดึงยอดเงินคงเหลือ Ads', method: 'GET', path: '/api/v2/ads/get_total_balance', risk: 'READ', implemented: false },
      { label: 'สร้าง Product Ads campaign', method: 'POST', path: '/api/v2/ads/create_gms_product_campaign', risk: 'WRITE', implemented: false },
      { label: 'สร้าง Manual/Auto Product Ads', method: 'POST', path: '/api/v2/ads/create_manual_product_ads, /api/v2/ads/create_auto_product_ads', risk: 'WRITE', implemented: false },
      { label: 'แก้ GMS/Product Ads campaign', method: 'POST', path: '/api/v2/ads/edit_gms_product_campaign, /api/v2/ads/edit_gms_item_product_campaign', risk: 'WRITE', implemented: false },
      { label: 'แก้ keyword/Manual/Auto Ads', method: 'POST', path: '/api/v2/ads/edit_manual_product_ad_keywords, /api/v2/ads/edit_manual_product_ads, /api/v2/ads/edit_auto_product_ads', risk: 'WRITE', implemented: false },
      { label: 'เปลี่ยนสถานะแคมเปญ', method: 'POST', path: '/api/v2/ads/update_gms_campaign_status', risk: 'WRITE', implemented: false },
      { label: 'ลบแคมเปญ', method: 'POST', path: '/api/v2/ads/delete_gms_campaign', risk: 'DANGEROUS', implemented: false },
    ],
  },
  {
    key: 'shopee-ams-open-platform',
    group: 'Shopee Open Platform - AMS',
    auth: 'OPEN_PLATFORM',
    status: 'NEEDS_TOKEN',
    summary: 'เหมาะกับงาน Affiliate/Marketing campaign เช่น targeted campaign/open campaign, เพิ่มสินค้า, แก้ commission, terminate campaign ต้องใช้ token เช่นกัน',
    items: [
      { label: 'ดูเวลาอัปเดต performance', method: 'GET', path: '/api/v2/ams/get_performance_data_update_time', risk: 'READ', implemented: false },
      { label: 'ดู performance ร้าน/สินค้า/affiliate/content', method: 'GET', path: '/api/v2/ams/get_shop_performance, /api/v2/ams/get_product_performance, /api/v2/ams/get_affiliate_performance, /api/v2/ams/get_content_performance', risk: 'READ', implemented: false },
      { label: 'ดู key metrics ของ campaign', method: 'GET', path: '/api/v2/ams/get_campaign_key_metrics_performance', risk: 'READ', implemented: false },
      { label: 'ดู targeted campaign', method: 'GET', path: '/api/v2/ams/get_targeted_campaign_list', risk: 'READ', implemented: false },
      { label: 'ดู targeted campaign settings', method: 'GET', path: '/api/v2/ams/get_targeted_campaign_settings', risk: 'READ', implemented: false },
      { label: 'ดู performance ของ targeted/open campaign', method: 'GET', path: '/api/v2/ams/get_targeted_campaign_performance, /api/v2/ams/get_open_campaign_performance', risk: 'READ', implemented: false },
      { label: 'ดูสินค้าที่เพิ่มได้ใน targeted campaign', method: 'GET', path: '/api/v2/ams/get_targeted_campaign_addable_product_list', risk: 'READ', implemented: false },
      { label: 'ดู rate แนะนำของร้าน', method: 'GET', path: '/api/v2/ams/get_shop_suggested_rate', risk: 'READ', implemented: false },
      { label: 'สร้าง targeted campaign', method: 'POST', path: '/api/v2/ams/create_new_targeted_campaign', risk: 'WRITE', implemented: false },
      { label: 'แก้ข้อมูล targeted campaign', method: 'POST', path: '/api/v2/ams/update_basic_info_of_targeted_campaign', risk: 'WRITE', implemented: false },
      { label: 'แก้สินค้า/affiliate ใน targeted campaign', method: 'POST', path: '/api/v2/ams/edit_product_list_of_targeted_campaign, /api/v2/ams/edit_affiliate_list_of_targeted_campaign', risk: 'WRITE', implemented: false },
      { label: 'เพิ่ม/แก้/ลบสินค้าใน open campaign', method: 'POST', path: '/api/v2/ams/batch_add_products_open_campaign_setting, /api/v2/ams/batch_edit_products_open_campaign_setting, /api/v2/ams/batch_remove_products_open_campaign_setting', risk: 'WRITE', implemented: false },
      { label: 'แก้/ลบสินค้าทั้งหมดใน open campaign', method: 'POST', path: '/api/v2/ams/edit_all_products_open_campaign_setting, /api/v2/ams/remove_all_products_open_campaign_setting', risk: 'DANGEROUS', implemented: false },
      { label: 'ปิด targeted campaign', method: 'POST', path: '/api/v2/ams/terminate_targeted_campaign', risk: 'DANGEROUS', implemented: false },
    ],
  },
  {
    key: 'seller-center-private',
    group: 'Seller Centre Private Routes - Shopee Live Ads',
    auth: 'COOKIE',
    status: 'CAPTURED_DRY_RUN',
    summary:
      'จับจาก Shopee Seller bundle pas-livestream-v2.42.0 แล้ว เส้นทั้งหมดอยู่ใต้โมดูล /portal/marketing/pas/live-stream และยิงผ่าน cookie Seller Centre + SPC_CDS; งานเขียนต้องเปิดใช้แบบ dry-run/ยืนยันแคมเปญทดสอบก่อนเท่านั้น',
    items: [
      { label: 'อ่าน meta บัญชี Ads/เครดิต/สถานะ Live Ads', method: 'POST', path: '/api/pas/v1/meta/get/ -> info_type_list: ads_credit, ads_toggle, has_ads, live_stream_account', risk: 'READ', implemented: false },
      { label: 'อ่าน config หน้า Live Ads', method: 'POST', path: '/api/pas/v1/config/get/ -> ads_config, bid_price, currency, education_link, sc_config', risk: 'READ', implemented: false },
      { label: 'อ่านรายงานตาราง/เส้นข้อมูลแอด', method: 'POST', path: '/api/pas/v1/report/get/', risk: 'READ', implemented: true },
      { label: 'อ่านกราฟรายเวลา', method: 'POST', path: '/api/pas/v1/report/get_time_graph/', risk: 'READ', implemented: false },
      { label: 'อ่าน config metric ที่เลือก', method: 'POST', path: '/api/pas/v1/report/get_config/, /api/pas/v1/report/update_selected_metric_config/', risk: 'READ', implemented: false },
      { label: 'อ่านข้อมูลแคมเปญ Live Ads', method: 'POST', path: '/api/pas/v1/live_stream/get/ -> campaign_id', risk: 'READ', implemented: true },
      { label: 'อ่านสถานะตั้งค่า/ตรวจซ้ำก่อนสร้าง', method: 'POST', path: '/api/pas/v1/live_stream/get_setup_status/, /api/pas/v1/live_stream/check_active_campaign_threshold/', risk: 'READ', implemented: false },
      { label: 'อ่านงบแนะนำตอนสร้าง/แก้', method: 'POST', path: '/api/pas/v1/live_stream/get_budget_data_for_creation/, /api/pas/v1/setup_helper/get_budget_data_for_edit/', risk: 'READ', implemented: false },
      { label: 'อ่าน ROAS เป้าหมายแนะนำ', method: 'POST', path: '/api/pas/v1/setup_helper/get_recommended_target_roi/', risk: 'READ', implemented: false },
      { label: 'สร้างแคมเปญ Live Ads', method: 'POST', path: '/api/pas/v1/live_stream/publish/ -> { reference_id, campaign }', risk: 'DANGEROUS', implemented: true },
      { label: 'แก้ไข/ปิด/รีสตาร์ทแคมเปญ Live Ads', method: 'POST', path: '/api/pas/v1/live_stream/edit/ -> campaign_id, type, change_budget/change_time_slot/status action', risk: 'DANGEROUS', implemented: true },
    ],
  },
  {
    key: 'seller-center-live-ads-fields',
    group: 'Captured Live Ads Metrics',
    auth: 'COOKIE',
    status: 'CAPTURED',
    summary:
      'คอลัมน์ข้อมูลที่ต้อง map จาก report/get และ report/get_time_graph สำหรับหน้าเรา ได้แก่สถานะ งบประมาณ การเข้าชม คำสั่งซื้อ อัตราการสั่งซื้อ ยอดขาย ค่าโฆษณา และ ROAS',
    items: [
      { label: 'สถานะโฆษณา', method: 'FIELD', path: 'campaign.state จาก live_stream/get', risk: 'READ', implemented: true },
      { label: 'งบประมาณ', method: 'FIELD', path: 'campaign.daily_budget จาก live_stream/get', risk: 'READ', implemented: true },
      { label: 'ทั้งหมด', method: 'FIELD', path: 'objective/type จาก live_stream/get', risk: 'READ', implemented: true },
      { label: 'การเข้าชม', method: 'FIELD', path: 'view/impression metric จาก report/get', risk: 'READ', implemented: true },
      { label: 'คำสั่งซื้อ', method: 'FIELD', path: 'order metric จาก report/get', risk: 'READ', implemented: true },
      { label: 'อัตราการสั่งซื้อ', method: 'FIELD', path: 'conversion/order rate metric จาก report/get', risk: 'READ', implemented: true },
      { label: 'ยอดขาย', method: 'FIELD', path: 'gmv/sales metric จาก report/get', risk: 'READ', implemented: true },
      { label: 'ค่าโฆษณา', method: 'FIELD', path: 'expense/cost metric จาก report/get', risk: 'READ', implemented: true },
      { label: 'ROAS', method: 'FIELD', path: 'roas metric จาก report/get หรือคำนวณจากยอดขาย/ค่าโฆษณาเมื่อ Shopee ไม่ส่ง roas', risk: 'READ', implemented: true },
    ],
  },
] as const;

function adsStatusFromCookie(cookie?: string | null) {
  const text = String(cookie ?? '').trim();
  if (!text) return 'UNKNOWN';
  return /(?:^|;\s*)SPC_(?:EC|ST|SC_SESSION|T_ID)=/i.test(text) ? 'ACTIVE' : 'INVALID';
}

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

function shopeeSellerPasToken(cookie: string) {
  return getCookieValue(cookie, 'SPC_CDS');
}

function moneyToShopeeAmount(value: number) {
  return Math.round(value * 100000);
}

function shopeeAmountToBaht(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount / 100000 : null;
}


function toReportNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[฿,\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function findReportNumber(value: unknown, keys: string[]): number | null {
  if (!value || typeof value !== 'object') return null;
  const objectValue = value as Record<string, unknown>;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(objectValue, key)) {
      const parsed = toReportNumber(objectValue[key]);
      if (parsed !== null) return parsed;
    }
  }
  for (const child of Object.values(objectValue)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const parsed = findReportNumber(item, keys);
        if (parsed !== null) return parsed;
      }
    } else if (child && typeof child === 'object') {
      const parsed = findReportNumber(child, keys);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

function moneyMetricToBaht(value: number | null) {
  if (value === null) return null;
  return value > 10000 ? shopeeAmountToBaht(value) : value;
}

function parseLiveReportMetrics(payload: unknown) {
  const views = findReportNumber(payload, ['view', 'views', 'impression', 'impressions', 'live_views', 'click']);
  const orders = findReportNumber(payload, ['orders', 'order', 'order_count', 'paid_order', 'paid_order_count', 'order_amount']);
  const sales = moneyMetricToBaht(findReportNumber(payload, ['gmv', 'sales', 'revenue', 'direct_gmv', 'direct_sales', 'gmv_amount']));
  const cost = moneyMetricToBaht(findReportNumber(payload, ['cost', 'expense', 'spend', 'ads_cost', 'ads_expense', 'cost_amount']));
  const roas = findReportNumber(payload, ['roas', 'roi']);
  const conversionRate = findReportNumber(payload, ['conversion_rate', 'order_rate', 'ctr_order_rate']);
  return {
    views,
    orders,
    conversionRate,
    salesBaht: sales,
    costBaht: cost,
    roas: roas ?? (cost && sales !== null ? sales / cost : null),
  };
}

async function readLiveCampaignReport(cookie: string, campaignId: number) {
  const from = bangkokStartOfTodayUnix();
  const result = await shopeePasPost(cookie, '/report/get/', {
    campaign_type: 'live_stream',
    campaign_id: campaignId,
    campaign_id_list: [campaignId],
    start_time: from,
    end_time: Math.floor(Date.now() / 1000),
  });
  return parseLiveReportMetrics(result.payload);
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

function bangkokEndOfRestartWindowUnix(startTime: number) {
  return startTime + (15 * 24 * 60 * 60) - 1;
}

async function shopeePasGet(cookie: string, path: string, params: Record<string, unknown>) {
  const spcCds = shopeeSellerPasToken(cookie);
  if (!spcCds) throw new AppError('Cookie สำหรับ Shopee Ads ขาดค่า SPC_CDS กรุณาบันทึก Cookie จากหน้า Shopee Ads/Seller Centre ใหม่', 400);

  const url = new URL(`https://seller.shopee.co.th/api/pas/v1${path}`);
  url.searchParams.set('SPC_CDS', spcCds);
  url.searchParams.set('SPC_CDS_VER', '2');
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json, text/plain, */*',
      origin: 'https://seller.shopee.co.th',
      referer: 'https://seller.shopee.co.th/portal/marketing/pas/live-stream/detail',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      ...shopeeSellerCsrfHeaders(cookie),
      cookie,
    },
  });

  const responseText = await response.text();
  let payload: unknown = responseText;
  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    payload = { raw: responseText };
  }

  return { httpStatus: response.status, ok: response.ok, payload };
}

async function shopeePasPost(cookie: string, path: string, body: unknown) {
  const spcCds = shopeeSellerPasToken(cookie);
  if (!spcCds) throw new AppError('Cookie สำหรับ Shopee Ads ขาดค่า SPC_CDS กรุณาบันทึก Cookie จากหน้า Shopee Ads/Seller Centre ใหม่', 400);

  const url = new URL(`https://seller.shopee.co.th/api/pas/v1${path}`);
  url.searchParams.set('SPC_CDS', spcCds);
  url.searchParams.set('SPC_CDS_VER', '2');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
      origin: 'https://seller.shopee.co.th',
      referer: 'https://seller.shopee.co.th/portal/marketing/pas/live-stream/create?source_page_id=2',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      ...shopeeSellerCsrfHeaders(cookie),
      cookie,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let payload: unknown = text;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  return { httpStatus: response.status, ok: response.ok, payload };
}

function buildLiveCampaignPayload(options: {
  name: string;
  referenceId: string;
  dailyBudget: number;
  objective: 'max_gmv' | 'max_view' | 'max_gmv_roi_two';
}) {
  const gmvMax = options.objective === 'max_gmv' || options.objective === 'max_gmv_roi_two';
  const roiTwo = options.objective === 'max_gmv_roi_two';
  const startTime = bangkokStartOfTodayUnix();
  return {
    reference_id: options.referenceId,
    is_restart: false,
    is_duplicate_name: false,
    name: options.name,
    pre_name: '',
    date_type: 'no',
    budget_type: 'daily',
    time_type: 'all_day',
    objective: roiTwo ? 'max_gmv_roi_two' : gmvMax ? 'max_gmv' : 'max_view',
    upper_bound: 0,
    lower_bound: 0,
    need_to_show: false,
    time_slot_list: [{ start_time: 0, end_time: 0 }],
    end_time: bangkokEndOfRestartWindowUnix(startTime),
    daily_budget: options.dailyBudget,
    start_time: startTime,
    target_roas_type: 'no',
    target_broad_roi: 0,
    enable_gmv_max: gmvMax,
    roi_two_target: null,
    target_roas_option: 'lower_bound',
    roi_option: 'lower_bound',
    simple_mode_roi_type: 'no',
  };
}

type ShopeeLiveCampaignForRestart = {
  campaign_id?: number;
  campaign_uuid?: string | null;
  name?: string | null;
  objective?: string | null;
  state?: string | null;
  daily_budget?: number | null;
  end_time?: number | null;
  time_slot_list?: Array<{ start_time?: number; end_time?: number }> | null;
  target_broad_roi?: number | null;
  roi_two?: { target?: number | null } | null;
};

function buildRestartLiveCampaignPayload(options: {
  source?: ShopeeLiveCampaignForRestart | null;
  fallback: StoredLiveCampaign;
  referenceId: string;
  name?: string;
  startTime?: number;
  endTime?: number;
}) {
  const source = options.source;
  const dailyBudget = Number(source?.daily_budget ?? options.fallback.dailyBudget ?? 0);
  const startTime = options.startTime ?? bangkokStartOfTodayUnix();
  const endTime = options.endTime ?? bangkokEndOfRestartWindowUnix(startTime);
  const campaignId = Number(source?.campaign_id ?? options.fallback.campaignId);

  return {
    daily_budget: dailyBudget > 0 ? dailyBudget : 0,
    start_time: startTime,
    end_time: endTime,
    time_slot_list: source?.time_slot_list?.length ? source.time_slot_list : [{ start_time: 0, end_time: 0 }],
    campaign_id: campaignId,
  };
}

const DEFAULT_LIVE_ROI_TWO_TARGET = 720000;

function buildLiveCampaignRoiTwoPayload(options: { name: string; referenceId: string; roiTwoTarget: number }) {
  const startTime = bangkokStartOfTodayUnix();
  return {
    daily_budget: 0,
    start_time: startTime,
    end_time: bangkokEndOfRestartWindowUnix(startTime),
    time_slot_list: [{ start_time: 0, end_time: 0 }],
    name: options.name,
    objective: 'max_gmv_roi_two',
    roi_two_target: options.roiTwoTarget,
  };
}

function buildLiveCampaignVisibilityPayload(options: { name: string }) {
  const startTime = bangkokStartOfTodayUnix();
  return {
    daily_budget: 0,
    start_time: startTime,
    end_time: bangkokEndOfRestartWindowUnix(startTime),
    time_slot_list: [{ start_time: 0, end_time: 0 }],
    name: options.name,
    objective: 'max_view',
  };
}

function parseRecommendedRoiTwoTarget(payload: unknown) {
  const data = payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    payload.data &&
    typeof payload.data === 'object'
    ? payload.data as {
        exact?: { value?: unknown };
        lower_bound?: { value?: unknown };
        upper_bound?: { value?: unknown };
      }
    : null;
  const value = Number(data?.exact?.value ?? data?.lower_bound?.value ?? data?.upper_bound?.value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

type ShopeePublishPayload = {
  code?: number;
  msg?: string;
  data?: {
    campaign_id?: number;
    result_list?: Array<{ campaign_uuid?: string; msg?: string; code?: number }>;
  };
};

type StoredLiveCampaign = {
  id: string;
  campaignId: number;
  campaignUuid?: string | null;
  name: string;
  objective: string;
  state: string;
  automationSettings?: string | null;
  createdAt: Date;
  updatedAt: Date;
  dailyBudget?: number | null;
  dailyBudgetBaht?: number | null;
  totalBudget?: number | null;
  totalBudgetBaht?: number | null;
  startTime?: number | null;
  endTime?: number | null;
  timeSlotList?: Array<{ start_time?: number; end_time?: number }> | null;
  roiTwoTarget?: number | null;
  roiTwoTargetValue?: number | null;
  targetBroadRoi?: number | null;
};

function stringifyAutomationSettings(settings: unknown) {
  if (settings === undefined) return undefined;
  try {
    return JSON.stringify(settings ?? null);
  } catch {
    throw new AppError('รูปแบบการตั้งค่า automation ไม่ถูกต้อง', 400);
  }
}

function parseAutomationSettings(settings?: string | null) {
  if (!settings) return null;
  try {
    return JSON.parse(settings);
  } catch {
    return null;
  }
}

function serializeLiveCampaign(campaign: StoredLiveCampaign) {
  return {
    id: campaign.id,
    campaignId: campaign.campaignId,
    campaignUuid: campaign.campaignUuid ?? null,
    name: campaign.name,
    objective: campaign.objective,
    state: campaign.state,
    automationSettings: parseAutomationSettings(campaign.automationSettings),
    dailyBudget: campaign.dailyBudget ?? null,
    dailyBudgetBaht: campaign.dailyBudgetBaht ?? null,
    totalBudget: campaign.totalBudget ?? null,
    totalBudgetBaht: campaign.totalBudgetBaht ?? null,
    startTime: campaign.startTime ?? null,
    endTime: campaign.endTime ?? null,
    timeSlotList: campaign.timeSlotList ?? null,
    roiTwoTarget: campaign.roiTwoTarget ?? null,
    roiTwoTargetValue: campaign.roiTwoTargetValue ?? null,
    targetBroadRoi: campaign.targetBroadRoi ?? null,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
}

function parseShopeePublishResult(payload: unknown) {
  const publishPayload = payload as ShopeePublishPayload | null;
  const campaignId = publishPayload?.data?.campaign_id ?? 0;
  const firstResult = publishPayload?.data?.result_list?.[0];
  const created = publishPayload?.code === 0 && Number(campaignId) > 0;
  const message = firstResult?.msg || publishPayload?.msg || (created ? 'สร้างแคมเปญสำเร็จ' : 'Shopee ไม่สามารถสร้างแคมเปญได้');
  return {
    publishPayload,
    campaignId,
    firstResult,
    created,
    message,
  };
}

function serializeAdsAccount<T extends { adsCookie?: string | null }>(account: T) {
  return {
    ...account,
    adsCookie: undefined,
    cookiePresent: Boolean(account.adsCookie),
    cookieMasked: maskSecret(account.adsCookie),
  };
}

async function resolveShopeeCookieForAdsAccount(account: {
  id: string;
  userId: string;
  accountName?: string | null;
  shopName?: string | null;
  shopId?: string | null;
  adsCookie?: string | null;
}) {
  const directCookie = revealSecret(account.adsCookie);
  if (directCookie) return { cookie: directCookie, source: 'ads-account' as const };

  const matchCandidates: Array<Record<string, string>> = [];
  if (account.shopId) {
    matchCandidates.push({ shopId: account.shopId });
    matchCandidates.push({ platformUid: account.shopId });
  }
  if (account.accountName) matchCandidates.push({ accountName: account.accountName });
  if (account.shopName) {
    matchCandidates.push({ accountName: account.shopName });
    matchCandidates.push({ name: account.shopName });
  }

  if (!matchCandidates.length) return { cookie: null, source: null };

  const channel = await prisma.liveChannel.findFirst({
    where: {
      userId: account.userId,
      platform: 'SHOPEE',
      cookie: { not: null },
      OR: matchCandidates,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const channelCookie = revealSecret(channel?.cookie);
  return channelCookie ? { cookie: channelCookie, source: 'live-channel' as const, channelId: channel?.id } : { cookie: null, source: null };
}

adsAccountsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const items = await prisma.adsAccount.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, items.map(serializeAdsAccount));
  }),
);

adsAccountsRouter.get(
  '/summary',
  asyncHandler(async (req: AuthedRequest, res) => {
    const [total, active, invalid] = await Promise.all([
      prisma.adsAccount.count({ where: { userId: req.userId } }),
      prisma.adsAccount.count({ where: { userId: req.userId, status: 'ACTIVE' } }),
      prisma.adsAccount.count({ where: { userId: req.userId, status: 'INVALID' } }),
    ]);

    return ok(res, {
      total,
      active,
      invalid,
      unchecked: Math.max(0, total - active - invalid),
    });
  }),
);

adsAccountsRouter.get(
  '/capabilities',
  asyncHandler(async (_req: AuthedRequest, res) => {
    return ok(
      res,
      {
        updatedAt: new Date().toISOString(),
        note: 'ใช้รายการนี้เป็นแผนที่พัฒนา Ads เท่านั้น เส้น Shopee official ต้องต่อ Open Platform token ก่อนใช้งานจริง',
        groups: adsCapabilities,
      },
      'โหลดแผนที่ Ads API ครบแล้ว',
    );
  }),
);

adsAccountsRouter.get(
  '/:id/campaign-api-map',
  asyncHandler(async (req: AuthedRequest, res) => {
    const account = await prisma.adsAccount.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!account) throw new AppError('ไม่พบบัญชี Ads', 404);

    const sellerPrivate = adsCapabilities.find((group) => group.key === 'seller-center-private');
    const metrics = adsCapabilities.find((group) => group.key === 'seller-center-live-ads-fields');

    return ok(res, {
      account: serializeAdsAccount(account),
      sellerOrigin: 'https://seller.shopee.co.th',
      portalPath: '/portal/marketing/pas/live-stream',
      createPath: '/portal/marketing/pas/live-stream/create?source_page_id=2',
      module: {
        name: 'pas-livestream',
        version: 'pas-livestream-v2.42.0',
        source: 'Shopee Seller bundle app-config + pas-livestream entry',
      },
      requestHints: {
        auth: 'Seller Centre cookie',
        query: 'SPC_CDS=<cookie SPC_CDS>&SPC_CDS_VER=2',
        headers: ['content-type: application/json', 'sc-fe-ver: <Seller Centre FE version>', 'sc-fe-session: <Seller Centre session hash>'],
      },
      endpointGroups: sellerPrivate ? [sellerPrivate] : [],
      metricGroups: metrics ? [metrics] : [],
      writeSafety: {
        defaultMode: 'dry-run',
        reason: 'create/edit/close ส่งผลกับงบโฆษณาจริง ต้องยืนยันแคมเปญทดสอบก่อนเปิดใช้งานจริง',
      },
    });
  }),
);

adsAccountsRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = writeSchema.parse(req.body);
    const rawCookie = body.adsCookie ?? null;
    const account = await prisma.adsAccount.create({
      data: {
        userId: req.userId!,
        accountName: body.accountName,
        shopName: body.shopName || null,
        shopId: body.shopId || null,
        adsCookie: protectSecret(rawCookie),
        status: adsStatusFromCookie(rawCookie),
        note: body.note || null,
        checkedAt: rawCookie ? new Date() : null,
      },
    });

    return ok(res, serializeAdsAccount(account), 'เพิ่มบัญชี Ads สำเร็จ', 201);
  }),
);

adsAccountsRouter.patch(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const account = await prisma.adsAccount.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!account) throw new AppError('ไม่พบบัญชี Ads', 404);

    const body = writeSchema.partial().parse(req.body);
    const hasCookieUpdate = Object.prototype.hasOwnProperty.call(body, 'adsCookie');
    const rawCookie = hasCookieUpdate ? body.adsCookie ?? null : undefined;

    const updated = await prisma.adsAccount.update({
      where: { id: account.id },
      data: {
        accountName: body.accountName,
        shopName: body.shopName === undefined ? undefined : body.shopName || null,
        shopId: body.shopId === undefined ? undefined : body.shopId || null,
        adsCookie: hasCookieUpdate ? protectSecret(rawCookie) : undefined,
        status: hasCookieUpdate ? adsStatusFromCookie(rawCookie) : undefined,
        note: body.note === undefined ? undefined : body.note || null,
        checkedAt: hasCookieUpdate ? new Date() : undefined,
      },
    });

    return ok(res, serializeAdsAccount(updated), 'บันทึกบัญชี Ads สำเร็จ');
  }),
);

adsAccountsRouter.get(
  '/:id/live-campaigns',
  asyncHandler(async (req: AuthedRequest, res) => {
    const account = await prisma.adsAccount.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!account) throw new AppError('ไม่พบบัญชี Ads', 404);

    const cookieResult = await resolveShopeeCookieForAdsAccount(account);
    const storedCampaigns = await prisma.adsLiveCampaign.findMany({
      where: { userId: req.userId!, adsAccountId: account.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!cookieResult.cookie) {
      return ok(res, storedCampaigns.map(serializeLiveCampaign));
    }

    const campaigns = await Promise.all(storedCampaigns.map(async (campaign) => {
      try {
        const getResult = await shopeePasPost(cookieResult.cookie!, '/live_stream/get/', {
          campaign_id: campaign.campaignId,
        });
        const getPayload = getResult.payload as {
          code?: number;
          errcode?: number;
          message?: string;
          msg?: string;
          data?: {
            campaign?: {
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
          };
        } | null;
        const shopeeCampaign = getPayload?.code === 0 ? getPayload?.data?.campaign : null;
        if (!shopeeCampaign) {
          console.warn('[ads-accounts] cannot refresh Shopee campaign; using stored row', {
            accountId: account.id,
            campaignId: campaign.campaignId,
            shopee: getPayload,
          });
          return campaign;
        }
        const metrics = await readLiveCampaignReport(cookieResult.cookie!, campaign.campaignId).catch((error) => {
          console.warn('[ads-accounts] cannot refresh Shopee campaign metrics', {
            accountId: account.id,
            campaignId: campaign.campaignId,
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        });
        const updated = await prisma.adsLiveCampaign.update({
          where: { id: campaign.id },
          data: {
            name: campaign.name,
            objective: shopeeCampaign.objective ?? campaign.objective,
            state: normalizeShopeeLiveCampaignState(shopeeCampaign.state) ?? campaign.state,
          },
        });
        return {
          ...updated,
          dailyBudget: shopeeCampaign.daily_budget ?? null,
          dailyBudgetBaht: shopeeAmountToBaht(shopeeCampaign.daily_budget),
          totalBudget: shopeeCampaign.total_budget ?? null,
          totalBudgetBaht: shopeeAmountToBaht(shopeeCampaign.total_budget),
          startTime: shopeeCampaign.start_time ?? null,
          endTime: shopeeCampaign.end_time ?? null,
          timeSlotList: shopeeCampaign.time_slot_list ?? null,
          roiTwoTarget: shopeeCampaign.roi_two?.target ?? null,
          roiTwoTargetValue: shopeeAmountToBaht(shopeeCampaign.roi_two?.target),
          targetBroadRoi: shopeeCampaign.target_broad_roi ?? null,
          metrics,
        };
      } catch (error) {
        console.warn('[ads-accounts] live campaign refresh failed; using stored row', {
          accountId: account.id,
          campaignId: campaign.campaignId,
          error: error instanceof Error ? error.message : String(error),
        });
        return campaign;
      }
    }));

    return ok(res, campaigns.map(serializeLiveCampaign));
  }),
);

adsAccountsRouter.post(
  '/:id/live-campaigns',
  asyncHandler(async (req: AuthedRequest, res) => {
    const account = await prisma.adsAccount.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!account) throw new AppError('ไม่พบบัญชี Ads', 404);

    const cookieResult = await resolveShopeeCookieForAdsAccount(account);
    if (!cookieResult.cookie) throw new AppError('ไม่พบคุกกี้ของช่องนี้ กรุณาตรวจสอบว่าบัญชี Ads นี้ตรงกับช่องไลฟ์ที่เพิ่มไว้แล้ว', 400);

    const body = liveCampaignCreateSchema.parse(req.body);
    const referenceId = crypto.randomUUID();
    const useRoiTwoFlow = body.objective === 'max_gmv_roi_two';
    const useVisibilityFlow = body.objective === 'max_view';
    const useZeroBudgetFlow = useRoiTwoFlow || useVisibilityFlow;
    const requestedBudget = body.dailyBudget ? moneyToShopeeAmount(body.dailyBudget) : moneyToShopeeAmount(200);
    const budgetProbePayload = useZeroBudgetFlow
      ? { campaign_type: 'live_stream', reference_id: referenceId }
      : buildLiveCampaignPayload({
          name: body.name,
          referenceId,
          dailyBudget: requestedBudget,
          objective: body.objective,
        });
    const [metaResult, thresholdResult, estimatedResult, bannerResult, roiTargetResult, budgetResult] = await Promise.all([
      shopeePasPost(cookieResult.cookie, '/meta/get/', {
        info_type_list: ['ads_credit', 'ads_toggle', 'has_ads', 'live_stream_account'],
      }),
      shopeePasPost(cookieResult.cookie, '/live_stream/check_active_campaign_threshold/', {}),
      shopeePasPost(cookieResult.cookie, '/live_stream/get_estimated_data/', {
        campaign_type: 'live_stream',
        reference_id: referenceId,
      }),
      shopeePasPost(cookieResult.cookie, '/banner/get/', {
        requested_banner_list: ['live_stream_roi_two_creation_page'],
      }),
      shopeePasPost(cookieResult.cookie, '/setup_helper/get_recommended_roi_two_target/', {
        objective: useRoiTwoFlow ? 'max_view' : body.objective,
        is_use_custom_target_broad_roi: false,
        reference_id: referenceId,
      }),
      shopeePasPost(
        cookieResult.cookie,
        '/live_stream/get_budget_data_for_creation/',
        budgetProbePayload,
      ),
    ]);

    const budgetData =
      budgetResult.payload &&
      typeof budgetResult.payload === 'object' &&
      'data' in budgetResult.payload &&
      budgetResult.payload.data &&
      typeof budgetResult.payload.data === 'object'
        ? (budgetResult.payload.data as { daily_budget?: { min?: number; default?: number; multiple?: number } }).daily_budget
        : null;

    const minBudget = Number(budgetData?.min ?? moneyToShopeeAmount(200));
    const budgetStep = Number(budgetData?.multiple ?? moneyToShopeeAmount(25));
    const dailyBudget = useZeroBudgetFlow ? 0 : Math.max(minBudget, Math.ceil(requestedBudget / budgetStep) * budgetStep);
    let roiTwoTarget = useRoiTwoFlow ? parseRecommendedRoiTwoTarget(roiTargetResult.payload) : null;
    if (useRoiTwoFlow && !roiTwoTarget) {
      const retryRoiTargetResult = await shopeePasPost(cookieResult.cookie, '/setup_helper/get_recommended_roi_two_target/', {
        objective: 'max_view',
        is_use_custom_target_broad_roi: false,
        reference_id: referenceId,
      });
      roiTwoTarget = parseRecommendedRoiTwoTarget(retryRoiTargetResult.payload);
      if (!roiTwoTarget) {
        console.warn('[shopee live roi target fallback]', JSON.stringify({
          accountId: account.id,
          accountName: account.accountName,
          referenceId,
          first: roiTargetResult.payload,
          retry: retryRoiTargetResult.payload,
          fallback: DEFAULT_LIVE_ROI_TWO_TARGET,
        }));
      }
    }
    const campaign = useRoiTwoFlow
      ? buildLiveCampaignRoiTwoPayload({ name: body.name, referenceId, roiTwoTarget: roiTwoTarget ?? DEFAULT_LIVE_ROI_TWO_TARGET })
      : useVisibilityFlow
        ? buildLiveCampaignVisibilityPayload({ name: body.name })
      : buildLiveCampaignPayload({
          name: body.name,
          referenceId,
          dailyBudget,
          objective: body.objective,
        });
    const overlapResult = useRoiTwoFlow || useVisibilityFlow
      ? await shopeePasPost(cookieResult.cookie, '/live_stream/check_overlapping_ads_for_roi_two/', {
          start_time: campaign.start_time,
          end_time: campaign.end_time,
          objective: campaign.objective,
        })
      : null;

    if (body.dryRun) {
      return ok(res, {
        created: false,
        dryRun: true,
        account: serializeAdsAccount(account),
        cookieSource: cookieResult.source,
        liveChannelId: cookieResult.channelId ?? null,
        request: {
          referenceId,
          name: body.name,
          objective: body.objective,
          dailyBudget,
          dailyBudgetBaht: shopeeAmountToBaht(dailyBudget),
        },
        meta: metaResult.payload,
        threshold: thresholdResult.payload,
        estimated: estimatedResult.payload,
        banner: bannerResult.payload,
        roiTarget: roiTargetResult.payload,
        budget: budgetResult.payload,
        overlap: overlapResult?.payload ?? null,
        campaign,
      }, 'ตรวจ payload สร้างแคมเปญแล้ว');
    }

    const publishResult = await shopeePasPost(cookieResult.cookie, '/live_stream/publish/', {
      reference_id: referenceId,
      campaign,
    });
    console.log('[shopee live publish]', JSON.stringify({
      accountId: account.id,
      accountName: account.accountName,
      referenceId,
      overlap: overlapResult?.payload ?? null,
      campaign,
      httpStatus: publishResult.httpStatus,
      shopee: publishResult.payload,
    }));
    const publishPayload = publishResult.payload as { code?: number; msg?: string; data?: { campaign_id?: number; result_list?: Array<{ campaign_uuid?: string; msg?: string; code?: number }> } } | null;
    const campaignId = publishPayload?.data?.campaign_id ?? 0;
    const firstResult = publishPayload?.data?.result_list?.[0];
    const created = publishPayload?.code === 0 && Number(campaignId) > 0;
    const shopeeMessage = firstResult?.msg || publishPayload?.msg || (created ? 'สร้างแคมเปญสำเร็จ' : 'Shopee ไม่สามารถสร้างแคมเปญได้');
    const automationSettings = stringifyAutomationSettings(body.automationSettings);
    if (created) {
      await prisma.adsLiveCampaign.upsert({
        where: {
          userId_campaignId: {
            userId: req.userId!,
            campaignId: Number(campaignId),
          },
        },
        create: {
          userId: req.userId!,
          adsAccountId: account.id,
          campaignId: Number(campaignId),
          campaignUuid: firstResult?.campaign_uuid ?? null,
          name: body.name,
          objective: campaign.objective,
          state: 'ongoing',
          automationSettings,
        },
        update: {
          adsAccountId: account.id,
          campaignUuid: firstResult?.campaign_uuid ?? null,
          name: body.name,
          objective: campaign.objective,
          state: 'ongoing',
          automationSettings,
        },
      });
    }

    return ok(res, {
      created,
      account: serializeAdsAccount(account),
      cookieSource: cookieResult.source,
      liveChannelId: cookieResult.channelId ?? null,
      request: {
        referenceId,
        name: body.name,
        objective: body.objective,
        dailyBudget,
        dailyBudgetBaht: shopeeAmountToBaht(dailyBudget),
      },
      campaignId,
      campaignUuid: firstResult?.campaign_uuid ?? null,
      shopeeMessage,
      meta: metaResult.payload,
      threshold: thresholdResult.payload,
      estimated: estimatedResult.payload,
      banner: bannerResult.payload,
      roiTarget: roiTargetResult.payload,
      budget: budgetResult.payload,
      overlap: overlapResult?.payload ?? null,
      shopee: publishResult.payload,
    }, created ? 'สร้างแคมเปญ Shopee Live Ads สำเร็จ' : shopeeMessage);
  }),
);

adsAccountsRouter.patch(
  '/:id/live-campaigns/:campaignId',
  asyncHandler(async (req: AuthedRequest, res) => {
    const account = await prisma.adsAccount.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!account) throw new AppError('ไม่พบบัญชี Ads', 404);

    const campaignId = Number(req.params.campaignId);
    if (!Number.isSafeInteger(campaignId) || campaignId <= 0) throw new AppError('Campaign ID ไม่ถูกต้อง', 400);

    const cookieResult = await resolveShopeeCookieForAdsAccount(account);
    if (!cookieResult.cookie) throw new AppError('ไม่พบคุกกี้ของช่องนี้ กรุณาตรวจสอบว่าบัญชี Ads นี้ตรงกับช่องไลฟ์ที่เพิ่มไว้แล้ว', 400);

    const body = liveCampaignUpdateSchema.parse(req.body);
    const automationSettings = stringifyAutomationSettings(body.automationSettings);
    const getBeforeResult = await shopeePasPost(cookieResult.cookie, '/live_stream/get/', {
      campaign_id: campaignId,
    });
    const getBeforePayload = getBeforeResult.payload as {
      code?: number;
      data?: { campaign?: { daily_budget?: number; name?: string; objective?: string; state?: string; campaign_id?: number } };
    } | null;
    const currentCampaign = getBeforePayload?.data?.campaign;
    const dailyBudget = body.dailyBudget ? moneyToShopeeAmount(body.dailyBudget) : Number(currentCampaign?.daily_budget ?? moneyToShopeeAmount(200));
    const requestedName = body.name?.trim();
    const requestedObjective = body.objective;
    const currentName = currentCampaign?.name ?? null;
    const shouldRename = Boolean(requestedName && requestedName !== currentName);

    const editResult = await shopeePasPost(cookieResult.cookie, '/live_stream/edit/', {
      campaign_id: campaignId,
      type: 'change_budget',
      name: requestedName ?? currentName ?? undefined,
      pre_name: currentName ?? undefined,
      change_budget: {
        daily_budget: dailyBudget,
        page: 'page_after_creation',
      },
    });
    const renameAttempts = [] as Array<{ path: string; body: unknown; payload: unknown }>;
    if (shouldRename && requestedName) {
      const renameBodies = [
        { campaign_id: campaignId, type: 'change_name', name: requestedName, pre_name: currentName ?? '' },
        { campaign_id: campaignId, type: 'change_campaign_name', name: requestedName, pre_name: currentName ?? '' },
        { campaign_id: campaignId, type: 'edit_name', name: requestedName, pre_name: currentName ?? '' },
        { campaign_id: campaignId, type: 'update_basic_info', name: requestedName, pre_name: currentName ?? '', campaign: { name: requestedName } },
      ];
      for (const renameBody of renameBodies) {
        const renameResult = await shopeePasPost(cookieResult.cookie, '/live_stream/edit/', renameBody).catch((error) => ({
          payload: { error: error instanceof Error ? error.message : String(error) },
        }));
        renameAttempts.push({ path: '/live_stream/edit/', body: renameBody, payload: renameResult.payload });
        const renamePayload = renameResult.payload as { code?: number } | null;
        if (renamePayload?.code === 0) break;
      }
    }
    const getResult = await shopeePasPost(cookieResult.cookie, '/live_stream/get/', {
      campaign_id: campaignId,
    });
    const editPayload = editResult.payload as { code?: number; msg?: string; data?: { campaign_id?: number } } | null;
    const getPayload = getResult.payload as {
      code?: number;
      msg?: string;
      data?: { campaign?: { campaign_id?: number; name?: string; objective?: string; state?: string; daily_budget?: number } };
    } | null;
    const shopeeCampaign = getPayload?.code === 0 ? getPayload?.data?.campaign : null;

    let stored = await prisma.adsLiveCampaign.findFirst({
      where: { userId: req.userId!, adsAccountId: account.id, campaignId },
    });
    if (stored && requestedName) {
      stored = await prisma.adsLiveCampaign.update({
        where: { id: stored.id },
        data: { name: requestedName, objective: requestedObjective, automationSettings },
      });
    }
    const campaign = stored && shopeeCampaign
      ? await prisma.adsLiveCampaign.update({
          where: { id: stored.id },
          data: {
            name: requestedName ?? shopeeCampaign.name ?? stored.name,
            objective: requestedObjective ?? shopeeCampaign.objective ?? stored.objective,
          state: normalizeShopeeLiveCampaignState(shopeeCampaign.state) ?? stored.state,
            automationSettings,
          },
        })
      : stored && automationSettings !== undefined
        ? await prisma.adsLiveCampaign.update({
            where: { id: stored.id },
            data: { name: requestedName ?? stored.name, objective: requestedObjective, automationSettings },
          })
      : stored;
    const success = editPayload?.code === 0 || Boolean(requestedObjective && campaign);

    return ok(res, {
      success,
      account: serializeAdsAccount(account),
      cookieSource: cookieResult.source,
      liveChannelId: cookieResult.channelId ?? null,
      campaign: campaign ? serializeLiveCampaign(campaign) : null,
      campaignId,
      dailyBudget,
      dailyBudgetBaht: shopeeAmountToBaht(dailyBudget),
      shopee: {
        edit: editResult.payload,
        rename: renameAttempts,
        getBefore: getBeforeResult.payload,
        get: getResult.payload,
      },
    }, success ? 'อัปเดตแคมเปญสำเร็จ' : (editPayload?.msg ?? 'Shopee ไม่สามารถอัปเดตแคมเปญได้'));
  }),
);


adsAccountsRouter.get(
  '/:id/live-campaigns/:campaignId/history',
  asyncHandler(async (req: AuthedRequest, res) => {
    const account = await prisma.adsAccount.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!account) throw new AppError('ไม่พบบัญชี Ads', 404);
    const campaignId = Number(req.params.campaignId);
    if (!Number.isSafeInteger(campaignId) || campaignId <= 0) throw new AppError('Campaign ID ไม่ถูกต้อง', 400);
    const cookieResult = await resolveShopeeCookieForAdsAccount(account);
    if (!cookieResult.cookie) throw new AppError('ไม่พบคุกกี้ของช่องนี้', 400);

    const now = Math.floor(Date.now() / 1000);
    const fromQuery = Number(req.query.from);
    const toQuery = Number(req.query.to);
    const from = Number.isFinite(fromQuery) && fromQuery > 0 ? Math.floor(fromQuery) : bangkokStartOfTodayUnix();
    const to = Number.isFinite(toQuery) && toQuery > 0 ? Math.floor(toQuery) : now;
    const limitQuery = Number(req.query.limit);
    const limit = Number.isFinite(limitQuery) && limitQuery > 0 ? Math.min(Math.floor(limitQuery), 100) : 10;
    const offsetQuery = Number(req.query.offset);
    const offset = Number.isFinite(offsetQuery) && offsetQuery >= 0 ? Math.floor(offsetQuery) : 0;
    const filter = {
      operator_list: [],
      event_type_list: [],
      device_list: [],
    };
    const countBody = {
      offset,
      limit,
      campaign_id: campaignId,
      filter,
      start_time: from,
      end_time: to,
    };
    const queryBody = {
      ...countBody,
      language: 'th',
    };

    const countResult = await shopeePasPost(cookieResult.cookie, '/operation_log/query_result_count/', countBody)
      .catch((error) => ({ payload: { error: error instanceof Error ? error.message : String(error) } }));
    const queryResult = await shopeePasPost(cookieResult.cookie, '/operation_log/query/', queryBody)
      .catch((error) => ({ payload: { error: error instanceof Error ? error.message : String(error) } }));
    const countPayload = countResult.payload as { code?: number; data?: { total?: number }; msg?: string; message?: string; error?: string } | null;
    const queryPayload = queryResult.payload as { code?: number; data?: unknown; msg?: string; message?: string; error?: string } | null;
    const shopee = {
      count: { path: '/operation_log/query_result_count/', body: countBody, payload: countResult.payload },
      query: { path: '/operation_log/query/', body: queryBody, payload: queryResult.payload },
    };

    if (countPayload?.code !== 0 || queryPayload?.code !== 0) {
      const message = queryPayload?.msg ?? queryPayload?.message ?? queryPayload?.error
        ?? countPayload?.msg ?? countPayload?.message ?? countPayload?.error
        ?? 'Shopee ไม่สามารถโหลดประวัติแคมเปญได้';
      return ok(res, {
        source: 'shopee',
        campaignId,
        success: false,
        history: { operation_list: [], next_cursor: '', total: countPayload?.data?.total ?? 0 },
        shopee,
      }, message);
    }

    return ok(res, {
      source: 'shopee',
      campaignId,
      success: true,
      history: {
        ...(queryPayload.data && typeof queryPayload.data === 'object' ? queryPayload.data : {}),
        total: countPayload.data?.total ?? 0,
      },
      shopee,
    }, 'โหลดประวัติแคมเปญจาก Shopee สำเร็จ');
  }),
);

adsAccountsRouter.post(
  '/:id/live-campaigns/:campaignId/state',
  asyncHandler(async (req: AuthedRequest, res) => {
    const account = await prisma.adsAccount.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!account) throw new AppError('ไม่พบบัญชี Ads', 404);

    const campaignId = Number(req.params.campaignId);
    if (!Number.isSafeInteger(campaignId) || campaignId <= 0) throw new AppError('Campaign ID ไม่ถูกต้อง', 400);

    const cookieResult = await resolveShopeeCookieForAdsAccount(account);
    if (!cookieResult.cookie) throw new AppError('ไม่พบคุกกี้ของช่องนี้ กรุณาตรวจสอบว่าบัญชี Ads นี้ตรงกับช่องไลฟ์ที่เพิ่มไว้แล้ว', 400);

    const body = liveCampaignStateSchema.parse(req.body);
    const storedCampaign = await prisma.adsLiveCampaign.findFirst({
      where: { userId: req.userId!, adsAccountId: account.id, campaignId },
    });
    let overlap: unknown = null;
    if (body.type === 'resume' && body.startTime && body.endTime && body.objective) {
      overlap = (await shopeePasPost(cookieResult.cookie, '/live_stream/check_overlapping_ads_for_roi_two/', {
        campaign_id: campaignId,
        start_time: body.startTime,
        end_time: body.endTime,
        objective: body.objective,
      })).payload;
    }

    let getBeforeResult = await shopeePasPost(cookieResult.cookie, '/live_stream/get/', {
      campaign_id: campaignId,
    }).catch((error) => ({ payload: { error: error instanceof Error ? error.message : String(error) } }));
    let getBeforePayload = getBeforeResult.payload as {
      code?: number;
      msg?: string;
      errcode?: number;
      message?: string;
      data?: { campaign?: ShopeeLiveCampaignForRestart };
    } | null;
    let sourceCampaign = getBeforePayload?.code === 0 ? getBeforePayload.data?.campaign ?? null : null;
    let state = sourceCampaign?.state ?? storedCampaign?.state ?? null;
    const localState = normalizeShopeeLiveCampaignState(storedCampaign?.state);
    const beforeState = normalizeShopeeLiveCampaignState(state);
    const shouldRestartInsteadOfResume = body.type === 'resume' && (localState === 'ended' || localState === 'closed' || beforeState === 'ended' || beforeState === 'closed');

    if (shouldRestartInsteadOfResume && storedCampaign) {
      const publishAttempts = [] as Array<{ body: unknown; payload: unknown }>;
      const referenceId = crypto.randomUUID();
      const restartStartTime = body.startTime ?? bangkokStartOfTodayUnix();
      const restartEndTime = body.endTime ?? bangkokEndOfRestartWindowUnix(restartStartTime);
      const restartObjective = body.objective ?? (sourceCampaign?.objective as 'max_gmv' | 'max_view' | 'max_gmv_roi_two' | undefined) ?? storedCampaign.objective;
      overlap = await shopeePasPost(cookieResult.cookie, '/live_stream/check_overlapping_ads_for_roi_two/', {
        campaign_id: campaignId,
        start_time: restartStartTime,
        end_time: restartEndTime,
        objective: restartObjective,
      }).then((result) => result.payload).catch((error) => ({ error: error instanceof Error ? error.message : String(error) }));
      const campaign = buildRestartLiveCampaignPayload({
        source: sourceCampaign,
        fallback: storedCampaign,
        referenceId,
        startTime: restartStartTime,
        endTime: restartEndTime,
      });
      const publishResult = await shopeePasPost(cookieResult.cookie, '/live_stream/publish/', {
        reference_id: referenceId,
        campaign,
      }).catch((error) => ({ payload: { error: error instanceof Error ? error.message : String(error) } }));
      publishAttempts.push({ body: { reference_id: referenceId, campaign }, payload: publishResult.payload });
      const parsed = parseShopeePublishResult(publishResult.payload);
      const restartedCampaignId = Number(parsed.campaignId);
      if (parsed.created && restartedCampaignId === campaignId) {
        const updatedCampaign = await prisma.adsLiveCampaign.update({
          where: { id: storedCampaign.id },
          data: {
            campaignUuid: parsed.firstResult?.campaign_uuid ?? storedCampaign.campaignUuid,
            objective: sourceCampaign?.objective ?? storedCampaign.objective,
            state: 'ongoing',
          },
        });

        return ok(res, {
          success: true,
          account: serializeAdsAccount(account),
          cookieSource: cookieResult.source,
          liveChannelId: cookieResult.channelId ?? null,
          campaignId,
          campaign: serializeLiveCampaign(updatedCampaign),
          action: body.type,
          accepted: true,
          state: 'ongoing',
          rawState: sourceCampaign?.state ?? storedCampaign.state,
          campaignName: sourceCampaign?.name ?? storedCampaign.name,
          overlap,
          restarted: true,
          shopee: {
            getBefore: getBeforeResult.payload,
            publishAttempts,
          },
        }, 'เริ่มใหม่แคมเปญสำเร็จ');
      }

      const lastPayload = publishAttempts.at(-1)?.payload as { msg?: string; message?: string; error?: string } | undefined;
      return ok(res, {
        success: false,
        account: serializeAdsAccount(account),
        cookieSource: cookieResult.source,
        liveChannelId: cookieResult.channelId ?? null,
        campaignId,
        action: body.type,
        accepted: false,
        state: beforeState ?? localState ?? state,
        rawState: state,
        campaignName: sourceCampaign?.name ?? storedCampaign.name,
        overlap,
        restarted: false,
        shopee: {
          getBefore: getBeforeResult.payload,
          publishAttempts,
        },
      }, lastPayload?.msg ?? lastPayload?.message ?? lastPayload?.error ?? 'Shopee ไม่สามารถเริ่มใหม่แคมเปญได้');
    }

    const editResult = await shopeePasPost(cookieResult.cookie, '/live_stream/edit/', {
      campaign_id: campaignId,
      type: body.type,
    });
    const editPayload = editResult.payload as { code?: number; msg?: string; data?: { campaign_id?: number } } | null;

    let getResult = await shopeePasPost(cookieResult.cookie, '/live_stream/get/', {
      campaign_id: campaignId,
    });
    let getPayload = getResult.payload as { code?: number; msg?: string; data?: { campaign?: { state?: string; name?: string; campaign_id?: number } } } | null;
    state = getPayload?.data?.campaign?.state ?? state ?? null;
    for (let attempt = 0; editPayload?.code === 0 && !liveCampaignStateMatchesAction(body.type, state) && attempt < 2; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      getResult = await shopeePasPost(cookieResult.cookie, '/live_stream/get/', { campaign_id: campaignId });
      getPayload = getResult.payload as { code?: number; msg?: string; data?: { campaign?: { state?: string; name?: string; campaign_id?: number } } } | null;
      state = getPayload?.data?.campaign?.state ?? null;
    }
    const normalizedState = normalizeShopeeLiveCampaignState(state);
    const accepted = editPayload?.code === 0;
    const success = accepted && liveCampaignStateMatchesAction(body.type, state);

    if (state) {
      await prisma.adsLiveCampaign.updateMany({
        where: { userId: req.userId!, adsAccountId: account.id, campaignId },
        data: { state: normalizedState ?? state },
      });
    }

    const successMessage = body.type === 'pause'
      ? 'หยุดพักแคมเปญสำเร็จ'
      : body.type === 'resume'
        ? 'ดำเนินการต่อแคมเปญสำเร็จ'
        : 'หยุดแคมเปญสำเร็จ';

    return ok(res, {
      success,
      account: serializeAdsAccount(account),
      cookieSource: cookieResult.source,
      liveChannelId: cookieResult.channelId ?? null,
      campaignId,
      action: body.type,
      accepted,
      state: normalizedState ?? state,
      rawState: state,
      campaignName: getPayload?.data?.campaign?.name ?? null,
      overlap,
      shopee: {
        getBefore: getBeforeResult.payload,
        edit: editResult.payload,
        get: getResult.payload,
      },
    }, success ? successMessage : (editPayload?.msg ?? 'Shopee ไม่สามารถเปลี่ยนสถานะแคมเปญได้'));
  }),
);

adsAccountsRouter.delete(
  '/:id/live-campaigns/:campaignId',
  asyncHandler(async (req: AuthedRequest, res) => {
    const account = await prisma.adsAccount.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!account) throw new AppError('ไม่พบบัญชี Ads', 404);

    const campaignId = Number(req.params.campaignId);
    if (!Number.isSafeInteger(campaignId) || campaignId <= 0) throw new AppError('Campaign ID ไม่ถูกต้อง', 400);

    const cookieResult = await resolveShopeeCookieForAdsAccount(account);
    if (!cookieResult.cookie) throw new AppError('ไม่พบคุกกี้ของช่องนี้ กรุณาตรวจสอบว่าบัญชี Ads นี้ตรงกับช่องไลฟ์ที่เพิ่มไว้แล้ว', 400);

    const getBeforeResult = await shopeePasPost(cookieResult.cookie, '/live_stream/get/', {
      campaign_id: campaignId,
    }).catch((error) => ({ payload: { error: error instanceof Error ? error.message : String(error) } }));
    const getBeforePayload = getBeforeResult.payload as { code?: number; data?: { campaign?: { state?: string; name?: string; campaign_id?: number } } } | null;
    const beforeState = normalizeShopeeLiveCampaignState(getBeforePayload?.data?.campaign?.state);
    const attempts = beforeState === 'ended'
      ? []
      : [{ path: '/live_stream/edit/', body: { campaign_id: campaignId, type: 'stop' } }];
    const shopeeAttempts = [] as Array<{ path: string; body: unknown; payload: unknown }>;
    let successPayload: unknown = beforeState === 'ended' ? { code: 0, msg: 'campaign already ended' } : null;
    for (const attempt of attempts) {
      const result = await shopeePasPost(cookieResult.cookie, attempt.path, attempt.body).catch((error) => ({
        payload: { error: error instanceof Error ? error.message : String(error) },
      }));
      shopeeAttempts.push({ path: attempt.path, body: attempt.body, payload: result.payload });
      const payload = result.payload as { code?: number; msg?: string; message?: string } | null;
      if (payload?.code === 0) {
        successPayload = result.payload;
        break;
      }
    }

    const getResult = await shopeePasPost(cookieResult.cookie, '/live_stream/get/', {
      campaign_id: campaignId,
    }).catch((error) => ({ payload: { error: error instanceof Error ? error.message : String(error) } }));
    const getPayload = getResult.payload as { code?: number; data?: { campaign?: { state?: string; name?: string; campaign_id?: number } } } | null;
    const localCampaign = await prisma.adsLiveCampaign.findFirst({
      where: { userId: req.userId, adsAccountId: account.id, campaignId },
    });

    if (!successPayload) {
      const lastPayload = shopeeAttempts.at(-1)?.payload as { msg?: string; message?: string; error?: string } | undefined;
      return ok(res, {
        success: false,
        account: serializeAdsAccount(account),
        cookieSource: cookieResult.source,
        liveChannelId: cookieResult.channelId ?? null,
        campaignId,
        campaignName: getPayload?.data?.campaign?.name ?? localCampaign?.name ?? null,
        state: normalizeShopeeLiveCampaignState(getPayload?.data?.campaign?.state) ?? localCampaign?.state ?? null,
        deletedLocal: false,
        shopee: { getBefore: getBeforeResult.payload, attempts: shopeeAttempts, get: getResult.payload },
      }, lastPayload?.msg ?? lastPayload?.message ?? lastPayload?.error ?? 'Shopee ไม่สามารถหยุดแคมเปญได้');
    }

    if (localCampaign) {
      await prisma.adsLiveCampaign.delete({ where: { id: localCampaign.id } });
    }

    return ok(res, {
      success: true,
      account: serializeAdsAccount(account),
      cookieSource: cookieResult.source,
      liveChannelId: cookieResult.channelId ?? null,
      campaignId,
      campaignName: getPayload?.data?.campaign?.name ?? localCampaign?.name ?? null,
      state: normalizeShopeeLiveCampaignState(getPayload?.data?.campaign?.state) ?? null,
      deletedLocal: Boolean(localCampaign),
      shopee: { getBefore: getBeforeResult.payload, attempts: shopeeAttempts, get: getResult.payload },
    }, 'หยุดแคมเปญบน Shopee และลบออกจากระบบสำเร็จ');
  }),
);

adsAccountsRouter.post(
  '/:id/check',
  asyncHandler(async (req: AuthedRequest, res) => {
    const account = await prisma.adsAccount.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!account) throw new AppError('ไม่พบบัญชี Ads', 404);

    const cookieResult = await resolveShopeeCookieForAdsAccount(account);
    const status = adsStatusFromCookie(cookieResult.cookie);
    const updated = await prisma.adsAccount.update({
      where: { id: account.id },
      data: { status, checkedAt: new Date() },
    });

    return ok(res, serializeAdsAccount(updated), status === 'ACTIVE' ? 'บัญชี Ads พร้อมใช้งาน' : 'บัญชี Ads ต้องตรวจสอบ Cookie');
  }),
);

adsAccountsRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const account = await prisma.adsAccount.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!account) throw new AppError('ไม่พบบัญชี Ads', 404);
    await prisma.adsAccount.delete({ where: { id: account.id } });
    return ok(res, { deleted: true }, 'ลบบัญชี Ads สำเร็จ');
  }),
);

