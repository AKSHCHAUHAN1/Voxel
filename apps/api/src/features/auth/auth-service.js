import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60;
const REFRESH_TOKEN_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

const digest = (value) => createHash('sha256').update(value).digest('hex');
const secret = (environment) => new TextEncoder().encode(environment.SESSION_SECRET);
const newRefreshToken = () => randomBytes(48).toString('base64url');

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
      where: { userId, workspace: { deletedAt: null } },
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

  async signUpWithEmail(input, metadata) {
    const existingUser = await this.database.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser && existingUser.passwordHash) {
      const err = new Error('An account with this email already exists. Please sign in.');
      err.statusCode = 400;
      throw err;
    }

    const passwordHash = hashPassword(input.password);

    let user;
    if (existingUser) {
      user = await this.database.user.update({
        where: { id: existingUser.id },
        data: {
          passwordHash,
          displayName: input.displayName || existingUser.displayName,
          emailVerified: true,
          deletedAt: null,
        },
      });
    } else {
      user = await this.database.user.create({
        data: {
          email: input.email,
          passwordHash,
          displayName: input.displayName,
          emailVerified: true,
        },
      });
    }

    await this.ensureDefaultWorkspace(user.id, user.displayName);
    return this.generateSessionForUser(user, metadata);
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

    await this.ensureDefaultWorkspace(user.id, user.displayName);
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

    const user = await this.database.user.upsert({
      where: { email: identity.email },
      create: {
        email: identity.email,
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
    return this.generateSessionForUser(user, metadata);
  }

  async rotateSession(refreshToken) {
    const existing = await this.database.refreshToken.findUnique({
      where: { tokenHash: digest(refreshToken) },
      include: { session: { include: { user: true } } },
    });

    if (
      !existing ||
      existing.revokedAt ||
      existing.expiresAt <= new Date() ||
      existing.session.expiresAt <= new Date()
    ) {
      if (existing)
        await this.database.session.update({
          where: { id: existing.sessionId },
          data: { expiresAt: new Date() },
        });
      throw new Error('The session is no longer valid.');
    }

    const replacement = newRefreshToken();
    await this.database.$transaction([
      this.database.refreshToken.update({
        where: { id: existing.id },
        data: { rotatedAt: new Date(), revokedAt: new Date() },
      }),
      this.database.refreshToken.create({
        data: {
          sessionId: existing.sessionId,
          tokenHash: digest(replacement),
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_LIFETIME_SECONDS * 1_000),
        },
      }),
      this.database.session.update({
        where: { id: existing.sessionId },
        data: { lastSeenAt: new Date() },
      }),
    ]);

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

  async getAuthenticatedUser(accessToken) {
    if (!accessToken) return null;
    const payload = await this.verifyAccessToken(accessToken).catch(() => null);
    if (!payload) return null;
    return this.database.user.findFirst({ where: { id: payload.subject, deletedAt: null } });
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
}
