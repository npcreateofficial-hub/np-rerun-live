import { api } from '@/lib/api';

export type AdsAccount = {
  id: string;
  accountName: string;
  shopName?: string | null;
  shopId?: string | null;
  status: 'UNKNOWN' | 'ACTIVE' | 'INVALID' | string;
  note?: string | null;
  checkedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  cookiePresent?: boolean;
  cookieMasked?: string | null;
};

export type AdsSummary = {
  total: number;
  active: number;
  invalid: number;
  unchecked: number;
};

export type AdsCapabilityItem = {
  label: string;
  method: string;
  path: string;
  risk: string;
  implemented: boolean;
};

export type AdsCapabilityGroup = {
  key: string;
  group: string;
  auth: string;
  status: string;
  summary: string;
  items: AdsCapabilityItem[];
};

export type AdsCapabilities = {
  updatedAt: string;
  note: string;
  groups: AdsCapabilityGroup[];
};

export type AdsAccountPayload = {
  accountName: string;
  shopName?: string | null;
  shopId?: string | null;
  adsCookie?: string | null;
  note?: string | null;
};

export type LiveAdsCampaignPayload = {
  objective: 'gmv' | 'views';
  campaignName: string;
  budgetMode: 'unlimited' | 'daily';
  dailyBudget?: number | null;
  scheduleMode: 'unlimited' | 'range';
  startDate?: string | null;
  endDate?: string | null;
  timeMode: 'all_day' | 'range';
  startTime?: string | null;
  endTime?: string | null;
  roasMode?: 'auto' | 'manual' | null;
  targetRoas?: number | null;
};


export type LiveAdsRemoteCampaign = {
  campaignId: string;
  name: string;
  objective: string;
  status: 'กำลังโฆษณา' | 'หยุดชั่วคราว' | 'สิ้นสุดแล้ว' | string;
  budget: number;
  total: number;
  visits: number;
  orders: number;
  orderRate: number;
  sales: number;
  adCost: number;
  roas: number;
};
export type LiveAdsCampaignDraft = LiveAdsCampaignPayload & {
  id: string;
  accountId: string;
  accountName: string;
  status: 'READY_TO_PUBLISH';
  createdAt: string;
};
export function listAdsAccounts() {
  return api<AdsAccount[]>('/ads-accounts');
}

export function getAdsSummary() {
  return api<AdsSummary>('/ads-accounts/summary');
}

export function getAdsCapabilities() {
  return api<AdsCapabilities>('/ads-accounts/capabilities');
}

export function createAdsAccount(payload: AdsAccountPayload) {
  return api<AdsAccount>('/ads-accounts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAdsAccount(id: string, payload: Partial<AdsAccountPayload>) {
  return api<AdsAccount>(`/ads-accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function checkAdsAccount(id: string) {
  return api<AdsAccount>(`/ads-accounts/${id}/check`, { method: 'POST' });
}

export function deleteAdsAccount(id: string) {
  return api<{ deleted: boolean }>(`/ads-accounts/${id}`, { method: 'DELETE' });
}
export function listLiveAdsCampaigns(accountId: string) {
  return api<{ accountId: string; campaigns: LiveAdsRemoteCampaign[] }>(`/ads-accounts/${accountId}/campaigns`);
}
export function createLiveAdsCampaign(accountId: string, payload: LiveAdsCampaignPayload) {
  return api<LiveAdsCampaignDraft>(`/ads-accounts/${accountId}/campaigns/publish`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
export function controlLiveAdsCampaign(accountId: string, campaignId: string | number, action: 'pause' | 'resume' | 'stop') {
  return api<{ accountId: string; campaignId: number; action: string; shopee: unknown }>(`/ads-accounts/${accountId}/campaigns/${campaignId}/action`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}


export function updateLiveAdsCampaignBudget(accountId: string, campaignId: string | number, dailyBudget: number) {
  return api<{ accountId: string; campaignId: number; dailyBudget: number; shopee: unknown }>(`/ads-accounts/${accountId}/campaigns/${campaignId}`, {
    method: 'PATCH',
    body: JSON.stringify({ dailyBudget }),
  });
}

export function getLiveAdsCampaignStatus(accountId: string, campaignId: string | number) {
  return api<{ accountId: string; campaignId: number; campaign: LiveAdsRemoteCampaign }>(`/ads-accounts/${accountId}/campaigns/${campaignId}/status`);
}




