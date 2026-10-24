import { runtime } from '@/config/runtime';
import { request } from '@/lib/http';

export const authService = {
  me: () => request('/api/v1/auth/me'),
  updateProfile: (input) => request('/api/v1/auth/me', { method: 'PATCH', body: JSON.stringify(input) }),
  uploadAvatar: (file) => request('/api/v1/auth/me/avatar', {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent(file.name), 'x-file-content-type': file.type },
    body: file,
  }),
  updatePreferences: (input) => request('/api/v1/auth/preferences', { method: 'PATCH', body: JSON.stringify(input) }),
  updatePassword: (input) => request('/api/v1/auth/password', { method: 'POST', body: JSON.stringify(input) }),
  sessions: () => request('/api/v1/auth/sessions'),
  revokeSession: (sessionId) => request(`/api/v1/auth/sessions/${sessionId}`, { method: 'DELETE' }),
  logoutAll: () => request('/api/v1/auth/logout-all', { method: 'POST', body: JSON.stringify({}) }),
  deleteAccount: () => request('/api/v1/auth/me', { method: 'DELETE' }),
  logout: () => request('/api/v1/auth/logout', { method: 'POST', body: JSON.stringify({}) }),
  loginUrl: () => `${runtime.apiBaseUrl}/api/v1/auth/google`,
  guestLogin: () =>
    request('/api/v1/auth/guest-login', { method: 'POST', body: JSON.stringify({}) }),
  signup: ({ email, password, displayName }) =>
    request('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    }),
  resendEmailVerification: (email) => request('/api/v1/auth/email-verification/resend', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyEmail: (token) => request('/api/v1/auth/email-verification/verify', { method: 'POST', body: JSON.stringify({ token }) }),
  requestPasswordReset: (email) => request('/api/v1/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, password) => request('/api/v1/auth/password-reset/complete', { method: 'POST', body: JSON.stringify({ token, password }) }),
  mfaStatus: () => request('/api/v1/auth/mfa'),
  startTotpSetup: (currentPassword) => request('/api/v1/auth/mfa/totp/setup', { method: 'POST', body: JSON.stringify({ currentPassword }) }),
  confirmTotpSetup: (code) => request('/api/v1/auth/mfa/totp/confirm', { method: 'POST', body: JSON.stringify({ code }) }),
  rotateMfaRecoveryCodes: (code) => request('/api/v1/auth/mfa/recovery-codes', { method: 'POST', body: JSON.stringify({ code }) }),
  disableTotp: (input) => request('/api/v1/auth/mfa/disable', { method: 'POST', body: JSON.stringify(input) }),
  verifyMfa: (code) => request('/api/v1/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ code }) }),
  cancelMfa: () => request('/api/v1/auth/mfa/cancel', { method: 'POST', body: JSON.stringify({}) }),
  login: ({ email, password }) =>
    request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
};
