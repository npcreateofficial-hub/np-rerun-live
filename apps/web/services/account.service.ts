import { api } from '@/lib/api';
import type {
  CheckCookiePayload,
  CheckCookieResult,
  CreateLiveChannelPayload,
  LiveChannel,
  LiveChannelInsights,
  LiveChannelUsage,
  ShopeeBasketItemsResult,
  ShopeeProductDetailsPayload,
  ShopeeProductDetailsResult,
  ShopeeScreenRankingsResult,
  ShowShopeeBasketItemPayload,
  ShowShopeeBasketItemResult,
  ShopeeShowLoopResult,
  UpdateLiveChannelPayload,
  UpdateLiveChannelStatusPayload,
} from '@/types/account';

export const accountService = {
  list() {
    return api<LiveChannel[]>('/live-channels');
  },

  getOne(id: string) {
    return api<LiveChannel>(`/live-channels/${id}`);
  },

  usage() {
    return api<LiveChannelUsage>('/live-channels/usage');
  },

  insights(id: string) {
    return api<LiveChannelInsights>(`/live-channels/${id}/insights`);
  },

  basketItems(id: string) {
    return api<ShopeeBasketItemsResult>(`/live-channels/${id}/basket-items`);
  },

  sessionItems(id: string, payload: { sessionId?: string | null; liveUrl?: string | null; cookie?: string | null }) {
    return api<ShopeeBasketItemsResult>(`/live-channels/${id}/session-items`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  productDetails(id: string, payload: ShopeeProductDetailsPayload) {
    return api<ShopeeProductDetailsResult>(`/live-channels/${id}/product-details`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  screenRankings(id: string, payload: ShopeeProductDetailsPayload) {
    return api<ShopeeScreenRankingsResult>(`/live-channels/${id}/screen-rankings`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  showBasketItem(id: string, payload: ShowShopeeBasketItemPayload) {
    return api<ShowShopeeBasketItemResult>(`/live-channels/${id}/show-item`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  showLoopStatus(id: string) {
    return api<ShopeeShowLoopResult>(`/live-channels/${id}/show-loop`);
  },

  startShowLoop(id: string, payload?: { defaultSeconds?: number }) {
    return api<ShopeeShowLoopResult>(`/live-channels/${id}/show-loop/start`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    });
  },

  stopShowLoop(id: string) {
    return api<ShopeeShowLoopResult>(`/live-channels/${id}/show-loop/stop`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  checkCookie(payload: CheckCookiePayload) {
    return api<CheckCookieResult>('/live-channels/check-cookie', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  checkAiKey(apiKey: string) {
    return api<{ valid: boolean; model: string }>('/live-channels/check-ai-key', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    });
  },

  create(payload: CreateLiveChannelPayload) {
    return api<LiveChannel>('/live-channels', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(id: string, payload: UpdateLiveChannelPayload) {
    return api<LiveChannel>(`/live-channels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  updateStatus(id: string, payload: UpdateLiveChannelStatusPayload) {
    return api<LiveChannel>(`/live-channels/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  remove(id: string) {
    return api<{ deleted: boolean }>(`/live-channels/${id}`, {
      method: 'DELETE',
    });
  },
};
