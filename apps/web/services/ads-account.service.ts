import { api } from '@/lib/api';
import type {
  AdsAccountRecord,
  AdsLiveCampaignRecord,
  CreateAdsAccountPayload,
  CreateLiveCampaignPayload,
  CreateLiveCampaignResult,
  UpdateLiveCampaignPayload,
  UpdateLiveCampaignResult,
  LiveCampaignHistoryResult,
  UpdateLiveCampaignStatePayload,
  UpdateLiveCampaignStateResult,
  DeleteLiveCampaignResult,
} from '@/types/account';

export const adsAccountService = {
  list() {
    return api<AdsAccountRecord[]>('/ads-accounts');
  },

  create(payload: CreateAdsAccountPayload) {
    return api<AdsAccountRecord>('/ads-accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  remove(id: string) {
    return api<{ deleted: boolean }>(`/ads-accounts/${id}`, {
      method: 'DELETE',
    });
  },

  listLiveCampaigns(id: string) {
    return api<AdsLiveCampaignRecord[]>(`/ads-accounts/${id}/live-campaigns`);
  },

  createLiveCampaign(id: string, payload: CreateLiveCampaignPayload) {
    return api<CreateLiveCampaignResult>(`/ads-accounts/${id}/live-campaigns`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateLiveCampaign(id: string, campaignId: number, payload: UpdateLiveCampaignPayload) {
    return api<UpdateLiveCampaignResult>(`/ads-accounts/${id}/live-campaigns/${campaignId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  updateLiveCampaignState(id: string, campaignId: number, payload: UpdateLiveCampaignStatePayload) {
    return api<UpdateLiveCampaignStateResult>(`/ads-accounts/${id}/live-campaigns/${campaignId}/state`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteLiveCampaign(id: string, campaignId: number) {
    return api<DeleteLiveCampaignResult>(`/ads-accounts/${id}/live-campaigns/${campaignId}`, {
      method: 'DELETE',
    });
  },

  getLiveCampaignHistory(id: string, campaignId: number, params?: { from?: string | null; to?: string | null; group?: string | null }) {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.group) query.set('group', params.group);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return api<LiveCampaignHistoryResult>(`/ads-accounts/${id}/live-campaigns/${campaignId}/history${suffix}`);
  },
};
