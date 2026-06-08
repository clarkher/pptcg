import { api } from './client';
import type { NotificationItem } from '../types/catalog';

export const notificationsApi = {
  mine: () => api.get<NotificationItem[]>('/notifications/mine').then((r) => r.data),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.post('/notifications/read-all').then((r) => r.data),
};
