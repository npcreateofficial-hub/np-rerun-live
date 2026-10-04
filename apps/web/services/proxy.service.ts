import { api } from '@/lib/api';
import type { CreateProxyPayload, ProxyItem, ProxyUsage } from '@/types/proxy';

export const proxyService = {
  list() {
    return api<ProxyItem[]>('/proxies');
  },

  usage() {
    return api<ProxyUsage>('/proxies/usage');
  },

  create(payload: CreateProxyPayload) {
    return api<ProxyItem>('/proxies', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  check(id: string) {
    return api<ProxyItem>(`/proxies/${id}/check`, {
      method: 'POST',
    });
  },

  remove(id: string) {
    return api<{ deleted: boolean }>(`/proxies/${id}`, {
      method: 'DELETE',
    });
  },
};
