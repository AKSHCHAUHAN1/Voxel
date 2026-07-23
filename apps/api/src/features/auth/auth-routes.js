import oauthPlugin from '@fastify/oauth2';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { createRequestId } from '@voxel/contracts';
import { success } from '../../lib/api-response.js';
import { AuthService } from './auth-service.js';

const GOOGLE_USER_INFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const googleIdentitySchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.boolean(),
  name: z.string().min(1).catch('Voxel member'),
  picture: z.string().url().optional(),
});

const signupSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  displayName: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80),
});

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

const ACCESS_COOKIE = 'voxel_access';
const REFRESH_COOKIE = 'voxel_refresh';
const accessCookieAge = 15 * 60;
const refreshCookieAge = 30 * 24 * 60 * 60;

class AuthenticationError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 401;
  }
}

const applySessionCookies = (reply, tokens, environment) => {
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

export const registerAuthRoutes = async (app, environment) => {
  const authService = new AuthService(prisma, environment);

  // Production Real Google OAuth 2.0 PKCE Flow
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

  app.post('/api/v1/auth/signup', async (request, reply) => {
    const input = signupSchema.parse(request.body);
    const result = await authService.signUpWithEmail(input, {
      ip: request.ip,
      ...(request.headers['user-agent'] ? { userAgent: request.headers['user-agent'] } : {}),
    });

    applySessionCookies(reply, result, environment);
    return reply.status(201).send(
      success(
        {
          authenticated: true,
          user: result.user,
        },
        createRequestId(request.id),
      ),
    );
  });

  app.post('/api/v1/auth/login', async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const result = await authService.loginWithEmail(input, {
      ip: request.ip,
      ...(request.headers['user-agent'] ? { userAgent: request.headers['user-agent'] } : {}),
    });

    applySessionCookies(reply, result, environment);
    return reply.send(
      success(
        {
          authenticated: true,
          user: result.user,
        },
        createRequestId(request.id),
      ),
    );
  });

  app.get('/api/v1/auth/google/callback', async (request, reply) => {
    try {
      const oauthClient = app.oauth2GoogleOAuth2;
      if (!oauthClient) throw new Error('Google OAuth is not registered.');
      const { token } = await oauthClient.getAccessTokenFromAuthorizationCodeFlow(request, reply);
      const response = await fetch(GOOGLE_USER_INFO_URL, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (!response.ok) throw new AuthenticationError('Google identity could not be verified.');
      const rawIdentity = await response.json();
      const parsed = googleIdentitySchema.parse(rawIdentity);
      const identity = {
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
    } catch (error) {
      request.log.error(error, 'Google OAuth callback error');
      return reply.redirect(`${environment.VOXEL_PUBLIC_APP_URL}/login?error=google_oauth_failed`);
    }
  });

  app.post('/api/v1/auth/refresh', async (request, reply) => {
    const refreshToken = request.cookies[REFRESH_COOKIE];
    if (!refreshToken) throw new AuthenticationError('A refresh session is required.');
    const tokens = await authService.rotateSession(refreshToken);
    applySessionCookies(reply, tokens, environment);
    return reply.send(success({ refreshed: true }, createRequestId(request.id)));
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    const refreshToken = request.cookies[REFRESH_COOKIE];
    const accessToken = request.cookies[ACCESS_COOKIE];

    if (accessToken) {
      const user = await authService.getAuthenticatedUser(accessToken).catch(() => null);
      if (user && (user.email === 'guest@voxel.com' || user.googleSubject === 'guest-google-sub')) {
        // Find all guest workspaces
        const guestWorkspaces = await prisma.workspace.findMany({
          where: { ownerId: user.id },
          select: { id: true },
        });
        const workspaceIds = guestWorkspaces.map((w) => w.id);

        if (workspaceIds.length > 0) {
          // Delete all dashboards, version histories, and workspace members in guest workspaces
          await prisma.dashboard.deleteMany({
            where: { workspaceId: { in: workspaceIds } },
          });
          await prisma.workspaceMember.deleteMany({
            where: { workspaceId: { in: workspaceIds } },
          });
          await prisma.workspace.deleteMany({
            where: { id: { in: workspaceIds } },
          });
        }

        // Delete any orphan dashboards owned by guest
        await prisma.dashboard.deleteMany({
          where: { ownerId: user.id },
        });
      }
    }

    await authService.revokeSession(refreshToken);
    reply.clearCookie(ACCESS_COOKIE, { path: '/' });
    reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    return reply.status(204).send();
  });

  app.post('/api/v1/auth/guest-login', async (request, reply) => {
    if (environment.NODE_ENV !== 'development' && environment.NODE_ENV !== 'test') {
      throw new AuthenticationError('Guest login is only available in development.');
    }
    const identity = {
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
