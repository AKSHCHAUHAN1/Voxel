import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { AuthService, hashPassword } from './auth-service.js';
import { createTotpSecret, encryptTotpSecret, getTotpCode, normalizeRecoveryCode } from './totp.js';

const environment = {
  SESSION_SECRET: 'a-mfa-test-session-secret-long-enough-for-jwt-signing',
  MFA_ENCRYPTION_KEY: 'a-stable-test-encryption-key-that-is-long-enough',
};

const makeDatabase = () => {
  const transaction = {
    mfaChallenge: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: 'challenge-id' }),
      findUnique: vi.fn(),
    },
    mfaRecoveryCode: {
      findFirst: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      createMany: vi.fn().mockResolvedValue({ count: 10 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    session: { findFirst: vi.fn(), create: vi.fn().mockResolvedValue({ id: 'session-id' }), updateMany: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
  };
  return {
    ...transaction,
    workspaceMember: { findFirst: vi.fn().mockResolvedValue({ id: 'member-id' }) },
    $transaction: vi.fn(async (operation) => operation(transaction)),
  };
};

describe('TOTP sign-in lifecycle', () => {
  it('does not create a full session after a valid password when TOTP is enabled', async () => {
    const database = makeDatabase();
    database.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'alex@example.com',
      displayName: 'Alex Rivers',
      passwordHash: hashPassword('LongEnoughPassword123!'),
      emailVerified: true,
      deletedAt: null,
      mfaTotpEnabledAt: new Date(),
    });
    const auth = new AuthService(database, environment);

    const result = await auth.loginWithEmail({ email: 'alex@example.com', password: 'LongEnoughPassword123!' }, {});

    expect(result).toMatchObject({ mfaRequired: true });
    expect(result.challengeToken).toBeTypeOf('string');
    expect(database.session.create).not.toHaveBeenCalled();
    const challenge = database.mfaChallenge.create.mock.calls[0][0].data;
    expect(challenge.userId).toBe('user-id');
    expect(challenge.tokenHash).not.toBe(result.challengeToken);
  });

  it('creates a session only after a valid, one-time TOTP challenge', async () => {
    const database = makeDatabase();
    const secret = createTotpSecret();
    const user = {
      id: 'user-id',
      email: 'alex@example.com',
      displayName: 'Alex Rivers',
      avatarUrl: null,
      emailVerified: true,
      deletedAt: null,
      mfaTotpEnabledAt: new Date(),
      mfaTotpSecretEnc: encryptTotpSecret(secret, environment.MFA_ENCRYPTION_KEY),
    };
    database.mfaChallenge.findUnique.mockResolvedValue({
      id: 'challenge-id',
      userId: user.id,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user,
    });
    const auth = new AuthService(database, environment);

    const session = await auth.completeMfaChallenge('challenge-token', getTotpCode(secret), {});

    expect(session.user).toEqual({ id: user.id, email: user.email, displayName: user.displayName, avatarUrl: null });
    expect(session.accessToken).toBeTypeOf('string');
    expect(database.mfaChallenge.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'challenge-id', consumedAt: null }),
    }));
    expect(database.session.create).toHaveBeenCalledOnce();
  });

  it('rejects an invalid code without consuming the challenge or creating a session', async () => {
    const database = makeDatabase();
    const secret = createTotpSecret();
    database.mfaChallenge.findUnique.mockResolvedValue({
      id: 'challenge-id',
      userId: 'user-id',
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-id',
        email: 'alex@example.com',
        emailVerified: true,
        deletedAt: null,
        mfaTotpEnabledAt: new Date(),
        mfaTotpSecretEnc: encryptTotpSecret(secret, environment.MFA_ENCRYPTION_KEY),
      },
    });
    const auth = new AuthService(database, environment);

    await expect(auth.completeMfaChallenge('challenge-token', 'ABCDEF', {})).rejects.toMatchObject({ statusCode: 401 });

    expect(database.mfaChallenge.updateMany).not.toHaveBeenCalled();
    expect(database.session.create).not.toHaveBeenCalled();
  });

  it('consumes a recovery code atomically before creating a session', async () => {
    const database = makeDatabase();
    const recoveryCode = '12345678-9ABC-DEF0-12345678';
    database.mfaChallenge.findUnique.mockResolvedValue({
      id: 'challenge-id',
      userId: 'user-id',
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-id',
        email: 'alex@example.com',
        displayName: 'Alex Rivers',
        emailVerified: true,
        deletedAt: null,
        mfaTotpEnabledAt: new Date(),
        mfaTotpSecretEnc: encryptTotpSecret(createTotpSecret(), environment.MFA_ENCRYPTION_KEY),
      },
    });
    database.mfaRecoveryCode.findFirst.mockResolvedValue({ id: 'recovery-code-id' });
    const auth = new AuthService(database, environment);

    const result = await auth.completeMfaChallenge('challenge-token', recoveryCode, {});

    expect(result.user.email).toBe('alex@example.com');
    expect(database.mfaRecoveryCode.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        codeHash: createHash('sha256').update(normalizeRecoveryCode(recoveryCode)).digest('hex'),
        usedAt: null,
      }),
    }));
    expect(database.mfaRecoveryCode.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'recovery-code-id', userId: 'user-id', usedAt: null },
    }));
  });
});
