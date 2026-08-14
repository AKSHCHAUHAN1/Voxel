import { runtime } from '@/config/runtime';
import { request } from '@/lib/http';

export const authService = {
  me: () => request('/api/v1/auth/me'),
  deleteAccount: () => request('/api/v1/auth/me', { method: 'DELETE' }),
  logout: () => request('/api/v1/auth/logout', { method: 'POST', body: JSON.stringify({}) }),
  loginUrl: (email, name) => {
    const params = new URLSearchParams();
    if (email) params.set('email', email);
    if (name) params.set('name', name);
    const qs = params.toString();
    return `${runtime.apiBaseUrl}/api/v1/auth/google${qs ? `?${qs}` : ''}`;
  },
  guestLogin: () =>
    request('/api/v1/auth/guest-login', { method: 'POST', body: JSON.stringify({}) }),
  signup: ({ email, password, displayName }) =>
    request('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    }),
  login: ({ email, password }) =>
    request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
};
