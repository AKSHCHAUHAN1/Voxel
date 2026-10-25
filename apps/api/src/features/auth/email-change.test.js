import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth-service.js';
import { createEmailChangeVerificationUrl, sendEmailChangeVerificationEmail } from './email-delivery.js';

const environment = {
  SESSION_SECRET: 'test-email-change-session-secret-with-more-than-32-characters',
  VOXEL_PUBLIC_APP_URL: 'https://app.voxel.example',
};

const makeDatabase = () => {
  const transaction = {
    emailChangeToken: {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: { update: vi.fn().mockResolvedValue({}) },
    session: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    refreshToken: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    mfaChallenge: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    passwordResetToken: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    emailVerificationToken: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  return {
    transaction,
    database: {
      session: { findFirst: vi.fn() },
      user: { findUnique: vi.fn() },
      $transaction: vi.fn(async (operation) => operation(transaction)),
    },
  };
};

describe('email change token lifecycle', () => {
  it('issues a one-use token digest only after recent authentication for an available address', async () => {
    const { database, transaction } = makeDatabase();
    database.session.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 60_000) });
    database.user.findUnique
      .mockResolvedValueOnce({
        id: 'user-id',
        email: 'old@example.com',
        displayName: 'Alex Rivers',
        passwordHash: 'password-hash',
        googleSubject: null,
        deletedAt: null,
      })
      .mockResolvedValueOnce(null);
    const auth = new AuthService(database, environment);

    const result = await auth.issueEmailChangeToken('user-id', 'session-id', ' New@Example.com ');

    expect(result).toMatchObject({ email: 'new@example.com', displayName: 'Alex Rivers' });
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(transaction.emailChangeToken.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-id' },
      create: expect.objectContaining({
        userId: 'user-id',
        email: 'new@example.com',
        tokenHash: createHash('sha256').update(result.token).digest('hex'),
        expiresAt: expect.any(Date),
      }),
      update: expect.objectContaining({
        email: 'new@example.com',
        tokenHash: createHash('sha256').update(result.token).digest('hex'),
      }),
    });
    const expiry = transaction.emailChangeToken.upsert.mock.calls[0][0].create.expiresAt;
    expect(expiry.getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1_000);
  });

  it('requires fresh sign-in and does not issue tokens to Google-managed accounts', async () => {
    const stale = makeDatabase();
    stale.database.session.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 11 * 60 * 1_000) });
    const staleAuth = new AuthService(stale.database, environment);
    await expect(staleAuth.issueEmailChangeToken('user-id', 'session-id', 'new@example.com'))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(stale.transaction.emailChangeToken.upsert).not.toHaveBeenCalled();

    const google = makeDatabase();
    google.database.session.findFirst.mockResolvedValue({ createdAt: new Date() });
    google.database.user.findUnique.mockResolvedValue({
      id: 'user-id', email: 'old@example.com', passwordHash: null, googleSubject: 'google-sub', deletedAt: null,
    });
    const googleAuth = new AuthService(google.database, environment);
    await expect(googleAuth.issueEmailChangeToken('user-id', 'session-id', 'new@example.com')).resolves.toBeNull();
    expect(google.transaction.emailChangeToken.upsert).not.toHaveBeenCalled();
  });

  it('confirms the address atomically and revokes sessions and outstanding security links', async () => {
    const { database, transaction } = makeDatabase();
    const token = 'f'.repeat(43);
    transaction.emailChangeToken.findUnique.mockResolvedValue({
      id: 'change-id',
      userId: 'user-id',
      email: 'new@example.com',
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'user-id', deletedAt: null, passwordHash: 'password-hash', googleSubject: null },
    });
    const auth = new AuthService(database, environment);

    const result = await auth.verifyEmailChangeToken(token);

    expect(result).toEqual({ email: 'new@example.com', updated: true, signedOutEverywhere: true });
    expect(transaction.emailChangeToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: createHash('sha256').update(token).digest('hex') },
      include: { user: true },
    });
    expect(transaction.emailChangeToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'change-id', consumedAt: null, expiresAt: { gt: expect.any(Date) } },
    }));
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: { email: 'new@example.com', emailVerified: true },
    });
    expect(transaction.session.updateMany).toHaveBeenCalledOnce();
    expect(transaction.refreshToken.updateMany).toHaveBeenCalledOnce();
    expect(transaction.mfaChallenge.updateMany).toHaveBeenCalledOnce();
    expect(transaction.passwordResetToken.updateMany).toHaveBeenCalledOnce();
    expect(transaction.emailVerificationToken.updateMany).toHaveBeenCalledOnce();
  });

  it('rejects expired or concurrently consumed links without changing the account', async () => {
    const { database, transaction } = makeDatabase();
    transaction.emailChangeToken.findUnique.mockResolvedValue({
      id: 'change-id',
      userId: 'user-id',
      email: 'new@example.com',
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'user-id', deletedAt: null, passwordHash: 'password-hash', googleSubject: null },
    });
    transaction.emailChangeToken.updateMany.mockResolvedValue({ count: 0 });
    const auth = new AuthService(database, environment);

    await expect(auth.verifyEmailChangeToken('g'.repeat(43))).rejects.toMatchObject({ statusCode: 400 });
    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(transaction.session.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an address that was claimed before confirmation', async () => {
    const { database, transaction } = makeDatabase();
    transaction.emailChangeToken.findUnique.mockResolvedValue({
      id: 'change-id',
      userId: 'user-id',
      email: 'new@example.com',
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'user-id', deletedAt: null, passwordHash: 'password-hash', googleSubject: null },
    });
    transaction.user.update.mockRejectedValue(Object.assign(new Error('Unique email constraint'), { code: 'P2002' }));
    const auth = new AuthService(database, environment);

    await expect(auth.verifyEmailChangeToken('h'.repeat(43))).rejects.toMatchObject({ statusCode: 409 });
    expect(transaction.session.updateMany).not.toHaveBeenCalled();
  });
});

describe('email change delivery', () => {
  it('keeps tokens out of request URLs and sends a confirmation to the new address', async () => {
    const url = createEmailChangeVerificationUrl('secret-token', environment);
    expect(new URL(url).search).toBe('');
    expect(new URLSearchParams(new URL(url).hash.slice(1)).get('token')).toBe('secret-token');

    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    const result = await sendEmailChangeVerificationEmail({
      email: 'new@example.com',
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
    expect(result.verificationUrl).toContain('#token=secret-token');
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.to).toBe('new@example.com');
    expect(body.subject).toBe('Confirm your new Voxel sign-in email');
    expect(body.html).toContain('&lt;Alex&gt;');
    expect(body.text).toContain('Your current address remains active until you confirm');
  });
});
