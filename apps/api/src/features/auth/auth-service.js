import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import {
  createRecoveryCodes,
  createTotpSecret,
  createTotpUri,
  decryptTotpSecret,
  encryptTotpSecret,
  normalizeRecoveryCode,
  verifyTotp,
} from './totp.js';

const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60;
const REFRESH_TOKEN_LIFETIME_SECONDS = 30 * 24 * 60 * 60;
const EMAIL_VERIFICATION_LIFETIME_HOURS = 24;
const EMAIL_CHANGE_LIFETIME_HOURS = 24;
const PASSWORD_RESET_LIFETIME_MINUTES = 60;

const digest = (value) => createHash('sha256').update(value).digest('hex');
const secret = (environment) => new TextEncoder().encode(environment.SESSION_SECRET);
const newRefreshToken = () => randomBytes(48).toString('base64url');
const mfaEncryptionSecret = (environment) => environment.MFA_ENCRYPTION_KEY || environment.SESSION_SECRET;

const mfaError = (message = 'The authenticator code is invalid or has expired.') => {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
};

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string' || !storedHash.includes(':')) {
    return false;
  }
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const targetHash = scryptSync(password, salt, 64);
  const sourceHash = Buffer.from(hash, 'hex');
  if (targetHash.length !== sourceHash.length) return false;
  return timingSafeEqual(targetHash, sourceHash);
}

export class AuthService {
  constructor(database, environment) {
    this.database = database;
    this.environment = environment;
  }

  async ensureDefaultWorkspace(userId, displayName) {
    const existing = await this.database.workspaceMember.findFirst({
      where: { userId, workspace: { deletedAt: null, archivedAt: null } },
    });
    if (!existing) {
      const workspaceName = `${displayName.trim() || 'Personal'}'s Workspace`;
      const slug = `${workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${randomBytes(4).toString('hex')}`;
      await this.database.workspace.create({
        data: {
          ownerId: userId,
          name: workspaceName,
          slug,
          icon: 'grid',
          accentColor: 'violet',
          members: {
            create: {
              userId,
              role: 'OWNER',
            },
          },
        },
      });
    }
  }

  async signUpWithEmail(input) {
    const existingUser = await this.database.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      const err = new Error(
        existingUser.passwordHash
          ? 'An account with this email already exists. Please sign in.'
          : 'This email already uses Google sign-in. Please continue with Google.',
      );
      err.statusCode = 400;
      throw err;
    }

    const passwordHash = hashPassword(input.password);
    const user = await this.database.user.create({
      data: {
        email: input.email,
        passwordHash,
        displayName: input.displayName,
      },
    });
    const verificationToken = await this.issueEmailVerificationToken(user.id);
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      verificationToken,
    };
  }

  async issueEmailVerificationToken(userId) {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.database.$transaction(async (transaction) => {
      await transaction.emailVerificationToken.updateMany({
        where: { userId, consumedAt: null },
        data: { consumedAt: now },
      });
      await transaction.emailVerificationToken.create({
        data: {
          userId,
          tokenHash: digest(token),
          expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_LIFETIME_HOURS * 60 * 60 * 1_000),
        },
      });
    });
    return token;
  }

  async verifyEmailToken(token) {
    const now = new Date();
    const verificationError = new Error('This verification link is invalid or has expired.');
    verificationError.statusCode = 400;
    const user = await this.database.$transaction(async (transaction) => {
      const record = await transaction.emailVerificationToken.findUnique({
        where: { tokenHash: digest(token) },
        include: { user: true },
      });
      if (!record || record.consumedAt || record.expiresAt <= now || record.user.deletedAt) throw verificationError;
      const consumed = await transaction.emailVerificationToken.updateMany({
        where: { id: record.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw verificationError;
      return transaction.user.update({ where: { id: record.userId }, data: { emailVerified: true } });
    });
    await this.ensureDefaultWorkspace(user.id, user.displayName);
    return user;
  }

  async issueEmailChangeToken(userId, sessionId, requestedEmail) {
    const session = await this.database.session.findFirst({
      where: { id: sessionId, userId },
      select: { createdAt: true },
    });
    if (!session || Date.now() - session.createdAt.getTime() > 10 * 60 * 1_000) {
      const error = new Error('Sign in again before changing your account email.');
      error.statusCode = 403;
      throw error;
    }

    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, passwordHash: true, googleSubject: true, deletedAt: true },
    });
    if (!user || user.deletedAt || !user.passwordHash || user.googleSubject) return null;

    const email = requestedEmail.trim().toLowerCase();
    if (email === user.email.toLowerCase()) return null;
    const existingUser = await this.database.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) return null;

    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.database.emailChangeToken.upsert({
      where: { userId },
      create: {
        userId,
        email,
        tokenHash: digest(token),
        expiresAt: new Date(now.getTime() + EMAIL_CHANGE_LIFETIME_HOURS * 60 * 60 * 1_000),
      },
      update: {
        email,
        tokenHash: digest(token),
        expiresAt: new Date(now.getTime() + EMAIL_CHANGE_LIFETIME_HOURS * 60 * 60 * 1_000),
        consumedAt: null,
        createdAt: now,
      },
    });
    return { email, displayName: user.displayName, token };
  }

  async verifyEmailChangeToken(token) {
    const changeError = new Error('This email change link is invalid, expired, or already used.');
    changeError.statusCode = 400;
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,100}$/.test(token)) throw changeError;

    const now = new Date();
    try {
      const record = await this.database.$transaction(async (transaction) => {
        const pending = await transaction.emailChangeToken.findUnique({
          where: { tokenHash: digest(token) },
          include: { user: true },
        });
        if (
          !pending || pending.consumedAt || pending.expiresAt <= now || pending.user.deletedAt ||
          !pending.user.passwordHash || pending.user.googleSubject
        ) throw changeError;

        const consumed = await transaction.emailChangeToken.updateMany({
          where: { id: pending.id, consumedAt: null, expiresAt: { gt: now } },
          data: { consumedAt: now },
        });
        if (consumed.count !== 1) throw changeError;

        await transaction.user.update({
          where: { id: pending.userId },
          data: { email: pending.email, emailVerified: true },
        });
        await transaction.session.updateMany({ where: { userId: pending.userId }, data: { expiresAt: now } });
        await transaction.refreshToken.updateMany({
          where: { session: { userId: pending.userId }, revokedAt: null },
          data: { revokedAt: now },
        });
        await transaction.mfaChallenge.updateMany({
          where: { userId: pending.userId, consumedAt: null },
          data: { consumedAt: now },
        });
        await transaction.passwordResetToken.updateMany({
          where: { userId: pending.userId, consumedAt: null },
          data: { consumedAt: now },
        });
        await transaction.emailVerificationToken.updateMany({
          where: { userId: pending.userId, consumedAt: null },
          data: { consumedAt: now },
        });
        return { email: pending.email, updated: true, signedOutEverywhere: true };
      });
      return record;
    } catch (error) {
      if (error?.code === 'P2002') {
        const conflict = new Error('This email address is no longer available. Request a new link.');
        conflict.statusCode = 409;
        throw conflict;
      }
      throw error;
    }
  }

  async issuePasswordResetToken(email) {
    const user = await this.database.user.findFirst({
      where: { email, deletedAt: null, emailVerified: true, passwordHash: { not: null } },
      select: { id: true, email: true, displayName: true },
    });
    if (!user) return null;

    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.database.$transaction(async (transaction) => {
      await transaction.passwordResetToken.deleteMany({
        where: { userId: user.id, OR: [{ consumedAt: { not: null } }, { expiresAt: { lte: now } }] },
      });
      await transaction.passwordResetToken.updateMany({
        where: { userId: user.id, consumedAt: null },
        data: { consumedAt: now },
      });
      await transaction.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: digest(token),
          expiresAt: new Date(now.getTime() + PASSWORD_RESET_LIFETIME_MINUTES * 60 * 1_000),
        },
      });
    });
    return { email: user.email, displayName: user.displayName, token };
  }

  async resetPassword(token, nextPassword) {
    const resetError = new Error('This password reset link is invalid or has expired. Request a new link and try again.');
    resetError.statusCode = 400;
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,100}$/.test(token)) throw resetError;

    const now = new Date();
    const record = await this.database.passwordResetToken.findUnique({
      where: { tokenHash: digest(token) },
      include: { user: true },
    });
    if (!record || record.consumedAt || record.expiresAt <= now || record.user.deletedAt || !record.user.passwordHash) {
      throw resetError;
    }

    const passwordHash = hashPassword(nextPassword);
    await this.database.$transaction(async (transaction) => {
      const consumedAt = new Date();
      const consumed = await transaction.passwordResetToken.updateMany({
        where: { id: record.id, consumedAt: null, expiresAt: { gt: consumedAt } },
        data: { consumedAt },
      });
      if (consumed.count !== 1) throw resetError;
      await transaction.user.update({ where: { id: record.userId }, data: { passwordHash } });
      await transaction.passwordResetToken.updateMany({
        where: { userId: record.userId, consumedAt: null },
        data: { consumedAt },
      });
      await transaction.session.updateMany({ where: { userId: record.userId }, data: { expiresAt: consumedAt } });
      await transaction.refreshToken.updateMany({
        where: { session: { userId: record.userId }, revokedAt: null },
        data: { revokedAt: consumedAt },
      });
      await transaction.mfaChallenge.updateMany({
        where: { userId: record.userId, consumedAt: null },
        data: { consumedAt },
      });
    });
    return { updated: true, signedOutEverywhere: true };
  }

  async loginWithEmail(input, metadata) {
    const user = await this.database.user.findUnique({
      where: { email: input.email },
    });

    if (!user || user.deletedAt) {
      const err = new Error('Invalid email or password.');
      err.statusCode = 401;
      throw err;
    }

    if (!user.passwordHash) {
      const err = new Error('This account uses Google Sign In. Please click "Continue with Google".');
      err.statusCode = 401;
      throw err;
    }

    const isValid = verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      const err = new Error('Invalid email or password.');
      err.statusCode = 401;
      throw err;
    }

    if (!user.emailVerified) {
      const err = new Error('Please verify your email before signing in. You can resend the verification email below.');
      err.statusCode = 403;
      throw err;
    }

    await this.ensureDefaultWorkspace(user.id, user.displayName);
    if (user.mfaTotpEnabledAt) return this.beginMfaChallenge(user.id);
    return this.generateSessionForUser(user, metadata);
  }

  async generateSessionForUser(user, metadata) {
    const refreshToken = newRefreshToken();
    const session = await this.database.session.create({
      data: {
        userId: user.id,
        userAgent: metadata.userAgent ?? null,
        ipAddress: metadata.ip ?? null,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_LIFETIME_SECONDS * 1_000),
        tokens: {
          create: {
            tokenHash: digest(refreshToken),
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_LIFETIME_SECONDS * 1_000),
          },
        },
      },
    });

    return {
      accessToken: await this.signAccessToken(user, session.id),
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async createSession(identity, metadata) {
    if (!identity.emailVerified) {
      throw new Error('The email address must be verified.');
    }

    const email = identity.email.trim().toLowerCase();
    const user = await this.database.user.upsert({
      where: { email },
      create: {
        email,
        googleSubject: identity.subject,
        displayName: identity.displayName,
        avatarUrl: identity.avatarUrl ?? null,
        emailVerified: true,
      },
      update: {
        googleSubject: identity.subject,
        displayName: identity.displayName,
        avatarUrl: identity.avatarUrl ?? null,
        emailVerified: true,
        deletedAt: null,
      },
    });

    await this.ensureDefaultWorkspace(user.id, user.displayName);
    if (user.mfaTotpEnabledAt) return this.beginMfaChallenge(user.id);
    return this.generateSessionForUser(user, metadata);
  }

  async getMfaStatus(userId) {
    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: { mfaTotpEnabledAt: true },
    });
    if (!user) throw mfaError();
    const recoveryCodesRemaining = user.mfaTotpEnabledAt
      ? await this.database.mfaRecoveryCode.count({ where: { userId, usedAt: null } })
      : 0;
    return { enabled: Boolean(user.mfaTotpEnabledAt), recoveryCodesRemaining };
  }

  async startTotpSetup(userId, sessionId, currentPassword) {
    const [user, session] = await Promise.all([
      this.database.user.findUnique({ where: { id: userId } }),
      this.database.session.findFirst({ where: { id: sessionId, userId }, select: { createdAt: true } }),
    ]);
    if (!user || !session) throw mfaError();
    if (user.mfaTotpEnabledAt) {
      const error = new Error('Two-factor authentication is already enabled.');
      error.statusCode = 409;
      throw error;
    }
    const recentlyAuthenticated = Date.now() - session.createdAt.getTime() <= 10 * 60 * 1_000;
    if (!recentlyAuthenticated && (!currentPassword || !verifyPassword(currentPassword, user.passwordHash))) {
      const error = new Error('Enter your current password or sign in again before setting up two-factor authentication.');
      error.statusCode = 403;
      throw error;
    }

    const secret = createTotpSecret();
    await this.database.user.update({
      where: { id: userId },
      data: {
        mfaTotpSecretEnc: encryptTotpSecret(secret, mfaEncryptionSecret(this.environment)),
        mfaTotpEnabledAt: null,
      },
    });
    return { secret, otpauthUrl: createTotpUri({ secret, email: user.email }) };
  }

  async confirmTotpSetup(userId, sessionId, code) {
    const user = await this.database.user.findUnique({ where: { id: userId } });
    if (!user?.mfaTotpSecretEnc || user.mfaTotpEnabledAt) {
      const error = new Error('Start authenticator setup before confirming it.');
      error.statusCode = 409;
      throw error;
    }
    const secret = decryptTotpSecret(user.mfaTotpSecretEnc, mfaEncryptionSecret(this.environment));
    if (!verifyTotp(secret, code)) throw mfaError();

    const recoveryCodes = createRecoveryCodes();
    await this.database.$transaction(async (transaction) => {
      const enabled = await transaction.user.updateMany({
        where: { id: userId, mfaTotpSecretEnc: user.mfaTotpSecretEnc, mfaTotpEnabledAt: null },
        data: { mfaTotpEnabledAt: new Date() },
      });
      if (enabled.count !== 1) throw mfaError('Authenticator setup has changed. Start again.');
      await transaction.mfaRecoveryCode.deleteMany({ where: { userId } });
      await transaction.mfaRecoveryCode.createMany({
        data: recoveryCodes.map((recoveryCode) => ({ userId, codeHash: digest(normalizeRecoveryCode(recoveryCode)) })),
      });
      const now = new Date();
      await transaction.mfaChallenge.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: now } });
      await transaction.session.updateMany({ where: { userId, id: { not: sessionId } }, data: { expiresAt: now } });
      await transaction.refreshToken.updateMany({
        where: { session: { userId, id: { not: sessionId } }, revokedAt: null },
        data: { revokedAt: now },
      });
    });
    return { recoveryCodes };
  }

  async beginMfaChallenge(userId) {
    const token = newRefreshToken();
    const now = new Date();
    await this.database.$transaction(async (transaction) => {
      await transaction.mfaChallenge.deleteMany({
        where: { userId, OR: [{ consumedAt: { not: null } }, { expiresAt: { lte: now } }] },
      });
      await transaction.mfaChallenge.updateMany({
        where: { userId, consumedAt: null },
        data: { consumedAt: now },
      });
      await transaction.mfaChallenge.create({
        data: {
          userId,
          tokenHash: digest(token),
          expiresAt: new Date(now.getTime() + 5 * 60 * 1_000),
        },
      });
    });
    return { mfaRequired: true, challengeToken: token };
  }

  async completeMfaChallenge(token, code, metadata) {
    const now = new Date();
    const challenge = await this.database.mfaChallenge.findUnique({
      where: { tokenHash: digest(token) },
      include: { user: true },
    });
    if (!challenge || challenge.consumedAt || challenge.expiresAt <= now || challenge.user.deletedAt || !challenge.user.emailVerified) {
      throw mfaError();
    }

    const normalizedCode = normalizeRecoveryCode(code);
    const isTotp = Boolean(challenge.user.mfaTotpEnabledAt && challenge.user.mfaTotpSecretEnc && /^\d{6}$/.test(code)
      && verifyTotp(decryptTotpSecret(challenge.user.mfaTotpSecretEnc, mfaEncryptionSecret(this.environment)), code));
    const recoveryCode = !isTotp && challenge.user.mfaTotpEnabledAt
      ? await this.database.mfaRecoveryCode.findFirst({
        where: {
          userId: challenge.userId,
          codeHash: digest(normalizedCode),
          usedAt: null,
        },
      })
      : null;
    if (!isTotp && !recoveryCode) throw mfaError();

    await this.database.$transaction(async (transaction) => {
      const consumedChallenge = await transaction.mfaChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumedChallenge.count !== 1) throw mfaError();
      if (recoveryCode) {
        const consumedCode = await transaction.mfaRecoveryCode.updateMany({
          where: { id: recoveryCode.id, userId: challenge.userId, usedAt: null },
          data: { usedAt: now },
        });
        if (consumedCode.count !== 1) throw mfaError();
      }
    });
    return this.generateSessionForUser(challenge.user, metadata);
  }

  async rotateMfaRecoveryCodes(userId, code) {
    const user = await this.database.user.findUnique({ where: { id: userId } });
    if (!user?.mfaTotpEnabledAt || !user.mfaTotpSecretEnc) throw mfaError('Two-factor authentication is not enabled.');
    if (!verifyTotp(decryptTotpSecret(user.mfaTotpSecretEnc, mfaEncryptionSecret(this.environment)), code)) throw mfaError();
    const recoveryCodes = createRecoveryCodes();
    await this.database.$transaction(async (transaction) => {
      await transaction.mfaRecoveryCode.deleteMany({ where: { userId } });
      await transaction.mfaRecoveryCode.createMany({
        data: recoveryCodes.map((recoveryCode) => ({ userId, codeHash: digest(normalizeRecoveryCode(recoveryCode)) })),
      });
    });
    return { recoveryCodes };
  }

  async disableTotp(userId, sessionId, { code, currentPassword }) {
    const user = await this.database.user.findUnique({ where: { id: userId } });
    if (!user?.mfaTotpEnabledAt || !user.mfaTotpSecretEnc) throw mfaError('Two-factor authentication is not enabled.');
    const validTotp = Boolean(code && verifyTotp(decryptTotpSecret(user.mfaTotpSecretEnc, mfaEncryptionSecret(this.environment)), code));
    const validPassword = Boolean(currentPassword && verifyPassword(currentPassword, user.passwordHash));
    if (!validTotp && !validPassword) throw mfaError('Enter a valid authenticator code or current password to turn off two-factor authentication.');
    const now = new Date();
    await this.database.$transaction(async (transaction) => {
      await transaction.user.update({ where: { id: userId }, data: { mfaTotpSecretEnc: null, mfaTotpEnabledAt: null } });
      await transaction.mfaRecoveryCode.deleteMany({ where: { userId } });
      await transaction.mfaChallenge.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: now } });
      await transaction.session.updateMany({ where: { userId, id: { not: sessionId } }, data: { expiresAt: now } });
      await transaction.refreshToken.updateMany({
        where: { session: { userId, id: { not: sessionId } }, revokedAt: null },
        data: { revokedAt: now },
      });
    });
    return { disabled: true };
  }

  async rotateSession(refreshToken) {
    const sessionError = new Error('The session is no longer valid.');
    sessionError.statusCode = 401;
    const existing = await this.database.refreshToken.findUnique({
      where: { tokenHash: digest(refreshToken) },
      include: { session: { include: { user: true } } },
    });

    if (
      !existing ||
      existing.revokedAt ||
      existing.expiresAt <= new Date() ||
      existing.session.expiresAt <= new Date() ||
      existing.session.user.deletedAt ||
      !existing.session.user.emailVerified
    ) {
      if (existing)
        await this.database.session.update({
          where: { id: existing.sessionId },
          data: { expiresAt: new Date() },
        });
      throw sessionError;
    }

    const replacement = newRefreshToken();
    const now = new Date();
    try {
      await this.database.$transaction(async (transaction) => {
        const consumed = await transaction.refreshToken.updateMany({
          where: {
            id: existing.id,
            revokedAt: null,
            rotatedAt: null,
            expiresAt: { gt: now },
          },
          data: { rotatedAt: now, revokedAt: now },
        });
        if (consumed.count !== 1) throw sessionError;

        const session = await transaction.session.updateMany({
          where: { id: existing.sessionId, expiresAt: { gt: now } },
          data: { lastSeenAt: now },
        });
        if (session.count !== 1) throw sessionError;

        await transaction.refreshToken.create({
          data: {
            sessionId: existing.sessionId,
            tokenHash: digest(replacement),
            expiresAt: new Date(now.getTime() + REFRESH_TOKEN_LIFETIME_SECONDS * 1_000),
          },
        });
      });
    } catch (error) {
      if (error === sessionError) {
        const revokedAt = new Date();
        await this.database.$transaction([
          this.database.session.updateMany({ where: { id: existing.sessionId }, data: { expiresAt: revokedAt } }),
          this.database.refreshToken.updateMany({
            where: { sessionId: existing.sessionId, revokedAt: null },
            data: { revokedAt },
          }),
        ]);
      }
      throw error;
    }

    return {
      accessToken: await this.signAccessToken(existing.session.user, existing.sessionId),
      refreshToken: replacement,
    };
  }

  async revokeSession(refreshToken) {
    if (!refreshToken) return;
    await this.database.refreshToken.updateMany({
      where: { tokenHash: digest(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAccessSession(accessToken) {
    if (!accessToken) return;
    const payload = await this.verifyAccessToken(accessToken).catch(() => null);
    if (!payload) return;
    await this.database.session.updateMany({
      where: { id: payload.sessionId, userId: payload.subject, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    });
    await this.database.refreshToken.updateMany({
      where: { sessionId: payload.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async updatePassword(userId, currentSessionId, currentPassword, nextPassword) {
    const user = await this.database.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user || !user.passwordHash || !verifyPassword(currentPassword, user.passwordHash)) {
      const err = new Error('Current password is incorrect.');
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    await this.database.$transaction([
      this.database.user.update({
        where: { id: userId },
        data: { passwordHash: hashPassword(nextPassword) },
      }),
      this.database.session.updateMany({
        where: { userId, id: { not: currentSessionId }, expiresAt: { gt: now } },
        data: { expiresAt: now },
      }),
      this.database.refreshToken.updateMany({
        where: { session: { userId, id: { not: currentSessionId } }, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  async listSessions(userId, currentSessionId) {
    return this.database.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
      },
    }).then((sessions) => sessions.map((session) => ({
      ...session,
      current: session.id === currentSessionId,
    })));
  }

  async revokeSessionById(userId, sessionId) {
    const now = new Date();
    const result = await this.database.session.updateMany({
      where: { id: sessionId, userId, expiresAt: { gt: now } },
      data: { expiresAt: now },
    });
    if (result.count > 0) {
      await this.database.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: now },
      });
    }
    return result.count > 0;
  }

  async revokeAllSessions(userId) {
    const now = new Date();
    await this.database.$transaction([
      this.database.session.updateMany({ where: { userId }, data: { expiresAt: now } }),
      this.database.refreshToken.updateMany({
        where: { session: { userId }, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  async getAuthenticatedContext(accessToken) {
    if (!accessToken) return null;
    const payload = await this.verifyAccessToken(accessToken).catch(() => null);
    if (!payload) return null;
    const session = await this.database.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });
    if (
      !session ||
      session.userId !== payload.subject ||
      session.expiresAt <= new Date() ||
      session.user.deletedAt ||
      !session.user.emailVerified
    ) {
      return null;
    }
    return { user: session.user, sessionId: session.id };
  }

  async getAuthenticatedUser(accessToken) {
    const context = await this.getAuthenticatedContext(accessToken);
    return context?.user ?? null;
  }

  async createRealtimeToken(accessToken, dashboardId) {
    const context = await this.getAuthenticatedContext(accessToken);
    if (!context) return null;

    const dashboard = await this.database.dashboard.findFirst({
      where: { id: dashboardId, deletedAt: null, status: { not: 'ARCHIVED' }, workspace: { deletedAt: null, archivedAt: null } },
      select: { workspaceId: true },
    });
    if (!dashboard) return null;

    const membership = await this.database.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: dashboard.workspaceId, userId: context.user.id } },
      select: { role: true },
    });
    if (!membership) return null;

    return new SignJWT({
      purpose: 'realtime',
      dashboardId,
      sessionId: context.sessionId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(context.user.id)
      .setIssuer('voxel-api')
      .setAudience('voxel-realtime')
      .setIssuedAt()
      .setExpirationTime('2m')
      .sign(secret(this.environment));
  }

  async verifyRealtimeToken(token, dashboardId) {
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret(this.environment), {
      issuer: 'voxel-api',
      audience: 'voxel-realtime',
    }).catch(() => ({ payload: null }));
    if (
      !payload ||
      payload.purpose !== 'realtime' ||
      payload.dashboardId !== dashboardId ||
      typeof payload.sub !== 'string' ||
      typeof payload.sessionId !== 'string'
    ) {
      return null;
    }

    const session = await this.database.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });
    if (
      !session ||
      session.userId !== payload.sub ||
      session.expiresAt <= new Date() ||
      session.user.deletedAt ||
      !session.user.emailVerified
    ) {
      return null;
    }

    const dashboard = await this.database.dashboard.findFirst({
      where: { id: dashboardId, deletedAt: null, status: { not: 'ARCHIVED' }, workspace: { deletedAt: null, archivedAt: null } },
      select: { workspaceId: true },
    });
    if (!dashboard) return null;
    const membership = await this.database.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: dashboard.workspaceId, userId: session.userId } },
      select: { role: true },
    });
    if (!membership) return null;
    return { user: session.user, role: membership.role, sessionId: session.id };
  }

  async isRealtimeSessionActive(userId, sessionId, dashboardId) {
    const session = await this.database.session.findFirst({
      where: {
        id: sessionId,
        userId,
        expiresAt: { gt: new Date() },
        user: { deletedAt: null, emailVerified: true },
      },
      select: { id: true },
    });
    if (!session) return null;
    const dashboard = await this.database.dashboard.findFirst({
      where: {
        id: dashboardId,
        deletedAt: null,
        status: { not: 'ARCHIVED' },
        workspace: { deletedAt: null, archivedAt: null },
      },
      select: { workspaceId: true },
    });
    if (!dashboard) return null;
    const membership = await this.database.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: dashboard.workspaceId, userId } },
      select: { role: true },
    });
    return membership?.role ?? null;
  }

  async signAccessToken(user, sessionId) {
    return new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer('voxel-api')
      .setAudience('voxel-web')
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_LIFETIME_SECONDS}s`)
      .sign(secret(this.environment));
  }

  async verifyAccessToken(accessToken) {
    const { payload } = await jwtVerify(accessToken, secret(this.environment), {
      issuer: 'voxel-api',
      audience: 'voxel-web',
    });
    if (!payload.sub || typeof payload.sid !== 'string')
      throw new Error('Invalid access token payload.');
    return { subject: payload.sub, sessionId: payload.sid };
  }

  async deleteAccount(userId) {
    if (!userId) return;

    const ownedWorkspaces = await this.database.workspace.findMany({
      where: { ownerId: userId },
      select: { id: true, members: { where: { userId: { not: userId } }, select: { id: true } } },
    });
    if (ownedWorkspaces.some((workspace) => workspace.members.length > 0)) {
      const err = new Error('Transfer ownership or remove other members from your workspaces before deleting your account.');
      err.statusCode = 409;
      throw err;
    }
    const workspaceIds = ownedWorkspaces.map((w) => w.id);
    const dashboardsToReassign = await this.database.dashboard.findMany({
      where: { ownerId: userId, ...(workspaceIds.length ? { workspaceId: { notIn: workspaceIds } } : {}) },
      select: { id: true, workspace: { select: { ownerId: true } } },
    });

    await this.database.$transaction(async (transaction) => {
      for (const dashboard of dashboardsToReassign) {
        await transaction.dashboard.update({
          where: { id: dashboard.id },
          data: { ownerId: dashboard.workspace.ownerId },
        });
      }
      await transaction.dashboardShare.updateMany({
        where: { createdById: userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await transaction.workspaceInvite.updateMany({
        where: { createdById: userId, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await transaction.dashboardVersion.deleteMany({ where: { dashboard: { workspaceId: { in: workspaceIds } } } });
      await transaction.dashboard.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
      await transaction.workspaceMember.deleteMany({ where: { OR: [{ workspaceId: { in: workspaceIds } }, { userId }] } });
      await transaction.auditEvent.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
      await transaction.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
      await transaction.refreshToken.deleteMany({ where: { session: { userId } } });
      await transaction.session.deleteMany({ where: { userId } });
      await transaction.user.delete({ where: { id: userId } });
    });
  }
}
