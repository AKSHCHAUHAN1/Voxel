import { runtime } from '@/config/runtime';
import { request } from '@/lib/http';

export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
}

export const authService = {
  me: (): Promise<AuthenticatedUser> => request('/api/v1/auth/me'),
  logout: (): Promise<void> => request('/api/v1/auth/logout', { method: 'POST', body: JSON.stringify({}) }),
  loginUrl: (): string => `${runtime.apiBaseUrl}/api/v1/auth/google`,
  guestLogin: (): Promise<{ authenticated: boolean }> =>
    request('/api/v1/auth/guest-login', { method: 'POST', body: JSON.stringify({}) }),
};
