import { request } from '@/lib/http';

export const notificationService = {
  list: (scope = 'all') => request(`/api/v1/notifications?scope=${encodeURIComponent(scope)}`),
  update: (id, input) => request(`/api/v1/notifications/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  markAllRead: () => request('/api/v1/notifications/read-all', { method: 'POST', body: JSON.stringify({}) }),
  archiveAll: () => request('/api/v1/notifications/archive-all', { method: 'POST', body: JSON.stringify({}) }),
  delete: (id) => request(`/api/v1/notifications/${id}`, { method: 'DELETE' }),
};
