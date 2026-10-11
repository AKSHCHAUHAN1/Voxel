import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService, hashPassword } from './auth-service.js';
import { sendVerificationEmail } from './email-delivery.js';

const makeDatabase = () => {
  const transaction = {
    emailVerificationToken: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    user: { update: vi.fn() },
  };
  return {
    transaction,
    database: {
      user: { findUnique: vi.fn(), create: vi.fn() },
      workspaceMember: { findFirst: vi.fn() },
      workspace: { create: vi.fn() },
      $transaction: vi.fn(async (operation) => typeof operation === 'function' ? operation(transaction) : undefined),
    },
  };
};

describe('email verification lifecycle', () => {
  let database;
  let transaction;
  let auth;

  beforeEach(() => {
    ({ database, transaction } = makeDatabase());
    auth = new AuthService(database, { SESSION_SECRET: 'test-session-secret-with-at-least-32-characters' });
  });

  it('creates a password account without issuing a session and stores only a token digest', async () => {
    database.user.findUnique.mockResolvedValue(null);
    database.user.create.mockResolvedValue({ id: 'user-id', email: 'alex@example.com', displayName: 'Alex' });
    transaction.emailVerificationToken.create.mockResolvedValue({});

    const result = await auth.signUpWithEmail({ email: 'alex@example.com', displayName: 'Alex', password: 'LongEnoughPassword123!' });

    expect(result.user).toEqual({ id: 'user-id', email: 'alex@example.com', displayName: 'Alex' });
    expect(result.verificationToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    const storedDigest = transaction.emailVerificationToken.create.mock.calls[0][0].data.tokenHash;
    expect(storedDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(storedDigest).not.toBe(result.verificationToken);
    expect(database.session).toBeUndefined();
    expect(database.workspace.create).not.toHaveBeenCalled();
  });

  it('consumes a valid token once, verifies the account, and creates its first workspace', async () => {
    transaction.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'token-id',
      userId: 'user-id',
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'user-id', deletedAt: null },
    });
    transaction.emailVerificationToken.updateMany.mockResolvedValue({ count: 1 });
    transaction.user.update.mockResolvedValue({ id: 'user-id', email: 'alex@example.com', displayName: 'Alex', emailVerified: true });
    database.workspaceMember.findFirst.mockResolvedValue({ id: 'membership' });

    const user = await auth.verifyEmailToken('a'.repeat(43));

    expect(transaction.emailVerificationToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { consumedAt: expect.any(Date) } }));
    expect(transaction.user.update).toHaveBeenCalledWith({ where: { id: 'user-id' }, data: { emailVerified: true } });
    expect(user.emailVerified).toBe(true);
  });

  it('rejects a token if another request has already consumed it', async () => {
    transaction.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'token-id', userId: 'user-id', consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000), user: { id: 'user-id', deletedAt: null },
    });
    transaction.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(auth.verifyEmailToken('b'.repeat(43))).rejects.toMatchObject({ statusCode: 400 });
    expect(transaction.user.update).not.toHaveBeenCalled();
  });

  it('does not start an unverified password session', async () => {
    database.user.findUnique.mockResolvedValue({ id: 'user-id', email: 'alex@example.com', displayName: 'Alex', emailVerified: false, passwordHash: hashPassword('LongEnoughPassword123!') });
    await expect(auth.loginWithEmail({ email: 'alex@example.com', password: 'LongEnoughPassword123!' }, {})).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('verification message delivery', () => {
  it('uses an application verification link during local development', async () => {
    const result = await sendVerificationEmail({
      email: 'alex@example.com', displayName: 'Alex', token: 'a'.repeat(43),
      environment: { NODE_ENV: 'development', VOXEL_PUBLIC_APP_URL: 'http://localhost:5173' },
    });
    expect(result.delivered).toBe(false);
    expect(result.verificationUrl).toContain('/verify-email?token=');
  });

  it('delivers verification through the configured provider-neutral webhook', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    const result = await sendVerificationEmail({
      email: 'alex@example.com', displayName: '<Alex>', token: 'a'.repeat(43), fetchImpl,
      environment: {
        VOXEL_PUBLIC_APP_URL: 'https://app.example.com',
        VOXEL_EMAIL_DELIVERY_URL: 'https://mail.example.com/send',
        VOXEL_EMAIL_DELIVERY_TOKEN: 'secret',
        VOXEL_EMAIL_FROM: 'voxel@example.com',
      },
    });
    expect(result).toEqual({ delivered: true });
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe('Bearer secret');
    const payload = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(payload.to).toBe('alex@example.com');
    expect(payload.html).toContain('&lt;Alex&gt;');
  });
});
