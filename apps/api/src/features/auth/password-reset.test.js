import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { AuthService, hashPassword, verifyPassword } from './auth-service.js';
import { createPasswordResetUrl, sendPasswordResetEmail } from './email-delivery.js';

const environment = {
  SESSION_SECRET: 'test-password-reset-session-secret-with-more-than-32-characters',
  VOXEL_PUBLIC_APP_URL: 'https://app.voxel.example',
};

const makeDatabase = () => {
  const transaction = {
    passwordResetToken: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: 'reset-token-id' }),
    },
    user: { update: vi.fn().mockResolvedValue({}) },
    session: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    refreshToken: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    mfaChallenge: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  return {
    transaction,
    database: {
      user: { findFirst: vi.fn(), update: vi.fn() },
      passwordResetToken: { findUnique: vi.fn() },
      session: { updateMany: vi.fn() },
      refreshToken: { updateMany: vi.fn() },
      mfaChallenge: { updateMany: vi.fn() },
      $transaction: vi.fn(async (operation) => operation(transaction)),
    },
  };
};

describe('password reset token lifecycle', () => {
  it('issues a random, hashed, one-hour token only for an active verified password account', async () => {
    const { database, transaction } = makeDatabase();
    database.user.findFirst.mockResolvedValue({ id: 'user-id', email: 'alex@example.com', displayName: 'Alex Rivers' });
    const auth = new AuthService(database, environment);

    const result = await auth.issuePasswordResetToken('alex@example.com');

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(transaction.passwordResetToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-id',
        tokenHash: createHash('sha256').update(result.token).digest('hex'),
        expiresAt: expect.any(Date),
      }),
    });
    const expiresAt = transaction.passwordResetToken.create.mock.calls[0][0].data.expiresAt;
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 59 * 60 * 1_000);
    expect(database.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: 'alex@example.com', deletedAt: null, emailVerified: true, passwordHash: { not: null } },
    }));
  });

  it('changes the password once and revokes sessions and pending MFA challenges', async () => {
    const { database, transaction } = makeDatabase();
    const token = 'reset-token-'.repeat(4);
    database.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-token-id',
      userId: 'user-id',
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'user-id', deletedAt: null, passwordHash: hashPassword('OldLongPassword123!') },
    });
    const auth = new AuthService(database, environment);

    const result = await auth.resetPassword(token, 'NewLongPassword123!');

    expect(result).toEqual({ updated: true, signedOutEverywhere: true });
    const updatedHash = transaction.user.update.mock.calls[0][0].data.passwordHash;
    expect(verifyPassword('NewLongPassword123!', updatedHash)).toBe(true);
    expect(transaction.passwordResetToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'reset-token-id', consumedAt: null, expiresAt: { gt: expect.any(Date) } },
    }));
    expect(transaction.session.updateMany).toHaveBeenCalledWith({ where: { userId: 'user-id' }, data: { expiresAt: expect.any(Date) } });
    expect(transaction.refreshToken.updateMany).toHaveBeenCalledOnce();
    expect(transaction.mfaChallenge.updateMany).toHaveBeenCalledOnce();
  });

  it('rejects expired, consumed, or concurrently consumed reset links without changing a password', async () => {
    const { database, transaction } = makeDatabase();
    const token = 'single-use-reset-token-'.repeat(2);
    database.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-token-id',
      userId: 'user-id',
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'user-id', deletedAt: null, passwordHash: hashPassword('OldLongPassword123!') },
    });
    transaction.passwordResetToken.updateMany.mockResolvedValueOnce({ count: 0 });
    const auth = new AuthService(database, environment);

    await expect(auth.resetPassword(token, 'NewLongPassword123!')).rejects.toMatchObject({ statusCode: 400 });
    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(transaction.session.updateMany).not.toHaveBeenCalled();
  });
});

describe('password reset email delivery', () => {
  it('keeps the reset token in the URL fragment and emails a single-use, one-hour link', async () => {
    const url = createPasswordResetUrl('secret-token', environment);
    expect(new URL(url).search).toBe('');
    expect(new URLSearchParams(new URL(url).hash.slice(1)).get('token')).toBe('secret-token');

    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const result = await sendPasswordResetEmail({
      email: 'alex@example.com',
      displayName: '<Alex>',
      token: 'secret-token',
      environment: {
        ...environment,
        VOXEL_EMAIL_DELIVERY_URL: 'https://mail.voxel.example/send',
        VOXEL_EMAIL_DELIVERY_TOKEN: 'mail-token',
        VOXEL_EMAIL_FROM: 'noreply@voxel.example',
      },
      fetchImpl,
    });

    expect(result.delivered).toBe(true);
    expect(result.resetUrl).toContain('#token=secret-token');
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.to).toBe('alex@example.com');
    expect(body.subject).toBe('Reset your Voxel password');
    expect(body.html).toContain('&lt;Alex&gt;');
    expect(body.text).toContain('works only once');
  });
});
