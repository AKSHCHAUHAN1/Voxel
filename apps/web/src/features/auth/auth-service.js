import { runtime } from '@/config/runtime';
import { request } from '@/lib/http';

export const authService = {
  me: () => request('/api/v1/auth/me'),
  logout: () => request('/api/v1/auth/logout', { method: 'POST', body: JSON.stringify({}) }),
  loginUrl: () => `${runtime.apiBaseUrl}/api/v1/auth/google`,
  guestLogin: () =>
    request('/api/v1/auth/guest-login', { method: 'POST', body: JSON.stringify({}) }),
};
