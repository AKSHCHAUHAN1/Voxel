import oauthPlugin from '@fastify/oauth2';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import type { Environment } from '../../config/environment.js';
import { createRequestId } from '@voxel/contracts';
import { success } from '../../lib/api-response.js';
import { AuthService, type GoogleIdentity, type SessionTokens } from './auth-service.js';

const GOOGLE_USER_INFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const googleIdentitySchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.boolean(),
  name: z.string().min(1).catch('Voxel member'),
  picture: z.string().url().optional(),
});

const ACCESS_COOKIE = 'voxel_access';
const REFRESH_COOKIE = 'voxel_refresh';
const accessCookieAge = 15 * 60;
const refreshCookieAge = 30 * 24 * 60 * 60;

class AuthenticationError extends Error {
  public readonly statusCode = 401;
}

const applySessionCookies = (
  reply: FastifyReply,
  tokens: SessionTokens,
  environment: Environment,
): void => {
  const secure = environment.NODE_ENV === 'production';
  reply.setCookie(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: accessCookieAge,
  });
  reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure,
    path: '/api/v1/auth',
    maxAge: refreshCookieAge,
  });
};

export const registerAuthRoutes = async (
  app: FastifyInstance,
  environment: Environment,
): Promise<void> => {
  const authService = new AuthService(prisma, environment);
  await app.register(oauthPlugin, {
    name: 'googleOAuth2',
    scope: ['openid', 'profile', 'email'],
    credentials: {
      client: { id: environment.GOOGLE_CLIENT_ID, secret: environment.GOOGLE_CLIENT_SECRET },
      auth: {
        tokenHost: 'https://oauth2.googleapis.com',
        tokenPath: '/token',
        authorizeHost: 'https://accounts.google.com',
        authorizePath: '/o/oauth2/v2/auth',
      },
    },
    startRedirectPath: '/api/v1/auth/google',
    callbackUri: `${environment.VOXEL_PUBLIC_APP_URL}/api/v1/auth/google/callback`,
    pkce: 'S256',
  });

  app.get('/api/v1/auth/google/callback', async (request, reply) => {
    const oauthClient = app.oauth2GoogleOAuth2;
    if (!oauthClient) throw new Error('Google OAuth is not registered.');
    const { token } = await oauthClient.getAccessTokenFromAuthorizationCodeFlow(request, reply);
    const response = await fetch(GOOGLE_USER_INFO_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!response.ok) throw new AuthenticationError('Google identity could not be verified.');
    const rawIdentity: unknown = await response.json();
    const parsed = googleIdentitySchema.parse(rawIdentity);
    const identity: GoogleIdentity = {
      subject: parsed.sub,
      email: parsed.email,
      emailVerified: parsed.email_verified,
      displayName: parsed.name,
      ...(parsed.picture ? { avatarUrl: parsed.picture } : {}),
    };
    const tokens = await authService.createSession(identity, {
      ip: request.ip,
      ...(request.headers['user-agent'] ? { userAgent: request.headers['user-agent'] } : {}),
    });
    applySessionCookies(reply, tokens, environment);
    return reply.redirect(`${environment.VOXEL_PUBLIC_APP_URL}/workspaces`);
  });

  app.post('/api/v1/auth/refresh', async (request, reply) => {
    const refreshToken = request.cookies[REFRESH_COOKIE];
    if (!refreshToken) throw new AuthenticationError('A refresh session is required.');
    const tokens = await authService.rotateSession(refreshToken);
    applySessionCookies(reply, tokens, environment);
    return reply.send(success({ refreshed: true }, createRequestId(request.id)));
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    await authService.revokeSession(request.cookies[REFRESH_COOKIE]);
    reply.clearCookie(ACCESS_COOKIE, { path: '/' });
    reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    return reply.status(204).send();
  });

  app.post('/api/v1/auth/guest-login', async (request, reply) => {
    if (environment.NODE_ENV !== 'development') {
      throw new AuthenticationError('Guest login is only available in development.');
    }
    const identity: GoogleIdentity = {
      subject: 'guest-google-sub',
      email: 'guest@voxel.com',
      emailVerified: true,
      displayName: 'Guest User',
    };
    const tokens = await authService.createSession(identity, {
      ip: request.ip,
      ...(request.headers['user-agent'] ? { userAgent: request.headers['user-agent'] } : {}),
    });
    applySessionCookies(reply, tokens, environment);
    return reply.send(success({ authenticated: true }, createRequestId(request.id)));
  });

  app.get('/api/v1/auth/me', async (request, reply) => {
    const user = await authService.getAuthenticatedUser(request.cookies[ACCESS_COOKIE]);
    if (!user) throw new AuthenticationError('Authentication is required.');
    return reply.send(
      success(
        {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
        createRequestId(request.id),
      ),
    );
  });
};
