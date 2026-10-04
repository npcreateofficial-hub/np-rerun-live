import { api } from '@/lib/api';
import type { NotificationItem } from '@/types/notification';

export const notificationService = {
  list() {
    return api<NotificationItem[]>('/notifications');
  },
  markRead(id: string, isRead = true) {
    return api<{ updated: number }>(`/notifications/${id}/read`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead }),
    });
  },
};
