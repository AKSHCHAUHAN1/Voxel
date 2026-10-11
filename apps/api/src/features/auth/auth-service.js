import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60;
const REFRESH_TOKEN_LIFETIME_SECONDS = 30 * 24 * 60 * 60;
const EMAIL_VERIFICATION_LIFETIME_HOURS = 24;

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
    return this.generateSessionForUser(user, metadata);
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
