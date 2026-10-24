import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';

const { prismaMock, authMock } = vi.hoisted(() => ({
  prismaMock: { user: { findFirst: vi.fn() } },
  authMock: {
    signUpWithEmail: vi.fn(), issueEmailVerificationToken: vi.fn(), verifyEmailToken: vi.fn(),
    issueEmailChangeToken: vi.fn(), verifyEmailChangeToken: vi.fn(),
    issuePasswordResetToken: vi.fn(), resetPassword: vi.fn(),
    generateSessionForUser: vi.fn(), loginWithEmail: vi.fn(), completeMfaChallenge: vi.fn(),
    getAuthenticatedContext: vi.fn(), getMfaStatus: vi.fn(), startTotpSetup: vi.fn(),
    confirmTotpSetup: vi.fn(), rotateMfaRecoveryCodes: vi.fn(), disableTotp: vi.fn(),
  },
}));

vi.mock('../../database/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('./auth-service.js', () => ({ AuthService: class {
  signUpWithEmail(...args) { return authMock.signUpWithEmail(...args); }
  issueEmailVerificationToken(...args) { return authMock.issueEmailVerificationToken(...args); }
  issueEmailChangeToken(...args) { return authMock.issueEmailChangeToken(...args); }
  verifyEmailChangeToken(...args) { return authMock.verifyEmailChangeToken(...args); }
  issuePasswordResetToken(...args) { return authMock.issuePasswordResetToken(...args); }
  resetPassword(...args) { return authMock.resetPassword(...args); }
  verifyEmailToken(...args) { return authMock.verifyEmailToken(...args); }
  generateSessionForUser(...args) { return authMock.generateSessionForUser(...args); }
  loginWithEmail(...args) { return authMock.loginWithEmail(...args); }
  completeMfaChallenge(...args) { return authMock.completeMfaChallenge(...args); }
  getAuthenticatedContext(...args) { return authMock.getAuthenticatedContext(...args); }
  getMfaStatus(...args) { return authMock.getMfaStatus(...args); }
  startTotpSetup(...args) { return authMock.startTotpSetup(...args); }
    confirmTotpSetup(...args) { return authMock.confirmTotpSetup(...args); }
  rotateMfaRecoveryCodes(...args) { return authMock.rotateMfaRecoveryCodes(...args); }
  disableTotp(...args) { return authMock.disableTotp(...args); }
} }));

const { registerAuthRoutes } = await import('./auth-routes.js');

const environment = {
  NODE_ENV: 'test',
  VOXEL_PUBLIC_APP_URL: 'http://localhost:5173',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  SESSION_SECRET: 'a-test-secret-with-at-least-thirty-two-characters',
};
let app;

beforeEach(async () => {
  vi.clearAllMocks();
  app = Fastify({ logger: false });
  await app.register(cookie);
  await registerAuthRoutes(app, environment);
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('email verification routes', () => {
  it('creates a pending account and returns only a local-development verification link', async () => {
    authMock.signUpWithEmail.mockResolvedValue({
      user: { id: 'user-id', email: 'alex@example.com', displayName: 'Alex Rivers' },
      verificationToken: 'a'.repeat(43),
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'alex@example.com', password: 'LongEnoughPassword123!', displayName: 'Alex Rivers' },
    });

    expect(response.statusCode).toBe(202);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.json().data).toMatchObject({ authenticated: false, verificationRequired: true, email: 'alex@example.com' });
    expect(response.json().data.verificationUrl).toContain('http://localhost:5173/verify-email?token=');
  });

  it('verifies the token and establishes a session only after verification', async () => {
    const user = { id: 'user-id', email: 'alex@example.com', displayName: 'Alex Rivers', avatarUrl: null };
    authMock.verifyEmailToken.mockResolvedValue(user);
    authMock.generateSessionForUser.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh', user });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email-verification/verify',
      payload: { token: 'b'.repeat(43) },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ authenticated: true, user: { email: 'alex@example.com' } });
    expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([expect.stringContaining('voxel_access=access')]));
    expect(authMock.generateSessionForUser).toHaveBeenCalledWith(user, expect.objectContaining({ ip: expect.any(String) }));
  });

  it('returns the same response when the resend address does not match an account', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email-verification/resend',
      payload: { email: 'unknown@example.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({ sent: true });
    expect(authMock.issueEmailVerificationToken).not.toHaveBeenCalled();
  });
});

describe('email change routes', () => {
  it('requires an authenticated recently signed-in user and returns only a local fragment link', async () => {
    authMock.getAuthenticatedContext.mockResolvedValue({
      user: { id: 'user-id' },
      sessionId: 'session-id',
    });
    authMock.issueEmailChangeToken.mockResolvedValue({
      email: 'new@example.com',
      displayName: 'Alex Rivers',
      token: 'c'.repeat(43),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email-change/request',
      headers: { cookie: 'voxel_access=access-token' },
      payload: { email: ' New@Example.com ' },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().data.verificationUrl).toContain('/change-email#token=');
    expect(new URL(response.json().data.verificationUrl).search).toBe('');
    expect(authMock.issueEmailChangeToken).toHaveBeenCalledWith('user-id', 'session-id', 'new@example.com');
  });

  it('confirms the one-time token without issuing a new session', async () => {
    authMock.verifyEmailChangeToken.mockResolvedValue({
      updated: true,
      email: 'new@example.com',
      signedOutEverywhere: true,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/email-change/verify',
      payload: { token: 'd'.repeat(43) },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.json().data).toEqual({ updated: true, email: 'new@example.com', signedOutEverywhere: true });
    expect(authMock.verifyEmailChangeToken).toHaveBeenCalledWith('d'.repeat(43));
  });

  it('keeps the production response generic when the requested address is unavailable', async () => {
    authMock.getAuthenticatedContext.mockResolvedValue({ user: { id: 'user-id' }, sessionId: 'session-id' });
    authMock.issueEmailChangeToken.mockResolvedValue(null);
    environment.NODE_ENV = 'production';
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/email-change/request',
        headers: { cookie: 'voxel_access=access-token' },
        payload: { email: 'taken@example.com' },
      });
      expect(response.statusCode).toBe(202);
      expect(response.json().data).toEqual({ sent: true });
    } finally {
      environment.NODE_ENV = 'test';
    }
  });
});

describe('password reset routes', () => {
  it('returns the same production response for an unknown email and an eligible account', async () => {
    authMock.issuePasswordResetToken.mockResolvedValueOnce(null).mockResolvedValueOnce({
      email: 'alex@example.com', displayName: 'Alex Rivers', token: 'c'.repeat(43),
    });
    environment.NODE_ENV = 'production';
    try {
      const unknown = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/password-reset/request',
        payload: { email: 'unknown@example.com' },
      });
      const account = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/password-reset/request',
        payload: { email: 'alex@example.com' },
      });

      expect(unknown.statusCode).toBe(202);
      expect(account.statusCode).toBe(202);
      expect(unknown.json().data).toEqual({ sent: true });
      expect(account.json().data).toEqual({ sent: true });
    } finally {
      environment.NODE_ENV = 'test';
    }
  });

  it('returns a development-only reset link and completes a password reset without creating a session', async () => {
    authMock.issuePasswordResetToken.mockResolvedValue({
      email: 'alex@example.com', displayName: 'Alex Rivers', token: 'd'.repeat(43),
    });
    authMock.resetPassword.mockResolvedValue({ updated: true, signedOutEverywhere: true });

    const request = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-reset/request',
      payload: { email: 'alex@example.com' },
    });
    expect(request.json().data.resetUrl).toContain('/reset-password#token=');

    const reset = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-reset/complete',
      payload: { token: 'd'.repeat(43), password: 'NewLongPassword123!' },
    });
    expect(reset.statusCode).toBe(200);
    expect(reset.json().data).toEqual({ updated: true, signedOutEverywhere: true });
    expect(reset.headers['set-cookie']).toBeUndefined();
    expect(authMock.resetPassword).toHaveBeenCalledWith('d'.repeat(43), 'NewLongPassword123!');
  });
});

describe('multi-factor authentication routes', () => {
  it('keeps a password login in a short-lived challenge until the authenticator code is verified', async () => {
    authMock.loginWithEmail.mockResolvedValue({ mfaRequired: true, challengeToken: 'challenge-token' });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'alex@example.com', password: 'LongEnoughPassword123!' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({ mfaRequired: true });
    const setCookies = [].concat(response.headers['set-cookie'] || []).join(';');
    expect(setCookies).toContain('voxel_mfa_challenge=challenge-token');
    expect(setCookies).toContain('HttpOnly');
    expect(setCookies).toContain('Max-Age=300');
    expect(setCookies).not.toContain('voxel_access=');
  });

  it('exchanges the one-time challenge for an authenticated session', async () => {
    const user = { id: 'user-id', email: 'alex@example.com', displayName: 'Alex Rivers', avatarUrl: null };
    authMock.completeMfaChallenge.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh', user });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      headers: { cookie: 'voxel_mfa_challenge=challenge-token' },
      payload: { code: '123456' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ authenticated: true, user: { email: 'alex@example.com' } });
    expect(authMock.completeMfaChallenge).toHaveBeenCalledWith(
      'challenge-token', '123456', expect.objectContaining({ ip: expect.any(String) }),
    );
    expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([expect.stringContaining('voxel_access=access')]));
  });
});
