import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { PrismaClient, User } from '@prisma/client';
import type { Environment } from '../../config/environment.js';

const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60;
const REFRESH_TOKEN_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

export interface GoogleIdentity {
  readonly subject: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly displayName: string;
  readonly avatarUrl?: string;
}

export interface SessionTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

interface AccessTokenPayload {
  readonly subject: string;
  readonly sessionId: string;
}

const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
const secret = (environment: Environment): Uint8Array =>
  new TextEncoder().encode(environment.SESSION_SECRET);
const newRefreshToken = (): string => randomBytes(48).toString('base64url');

export class AuthService {
  public constructor(
    private readonly database: PrismaClient,
    private readonly environment: Environment,
  ) {}

  public async createSession(
    identity: GoogleIdentity,
    metadata: { ip?: string; userAgent?: string },
  ): Promise<SessionTokens> {
    if (!identity.emailVerified) {
      throw new Error('The Google account email address must be verified.');
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

    return { accessToken: await this.signAccessToken(user, session.id), refreshToken };
  }

  public async rotateSession(refreshToken: string): Promise<SessionTokens> {
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

  public async revokeSession(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    await this.database.refreshToken.updateMany({
      where: { tokenHash: digest(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  public async getAuthenticatedUser(accessToken?: string): Promise<User | null> {
    if (!accessToken) return null;
    const payload = await this.verifyAccessToken(accessToken).catch(() => null);
    if (!payload) return null;
    return this.database.user.findFirst({ where: { id: payload.subject, deletedAt: null } });
  }

  private async signAccessToken(user: User, sessionId: string): Promise<string> {
    return new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer('voxel-api')
      .setAudience('voxel-web')
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_LIFETIME_SECONDS}s`)
      .sign(secret(this.environment));
  }

  private async verifyAccessToken(accessToken: string): Promise<AccessTokenPayload> {
    const { payload } = await jwtVerify(accessToken, secret(this.environment), {
      issuer: 'voxel-api',
      audience: 'voxel-web',
    });
    if (!payload.sub || typeof payload.sid !== 'string')
      throw new Error('Invalid access token payload.');
    return { subject: payload.sub, sessionId: payload.sid };
  }
}
