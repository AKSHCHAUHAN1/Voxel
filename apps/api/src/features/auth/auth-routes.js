import oauthPlugin from '@fastify/oauth2';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { createRequestId } from '@voxel/contracts';
import { failure, success } from '../../lib/api-response.js';
import { AuthService } from './auth-service.js';
import { sendEmailChangeVerificationEmail, sendPasswordResetEmail, sendVerificationEmail } from './email-delivery.js';

const GOOGLE_USER_INFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const googleIdentitySchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.boolean(),
  name: z.string().min(1).catch('Voxel member'),
  picture: z.string().url().optional(),
});

const signupSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.').transform((email) => email.toLowerCase()),
  password: z.string().min(12, 'Password must be at least 12 characters.').max(128),
  displayName: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80),
});

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.').transform((email) => email.toLowerCase()),
  password: z.string().min(1, 'Password is required.'),
});
const emailVerificationSchema = z.object({ token: z.string().min(40).max(100) });
const resendVerificationSchema = z.object({
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
});
const passwordResetRequestSchema = z.object({
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
});
const emailChangeRequestSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.').transform((email) => email.toLowerCase()),
  mfaCode: z.string().trim().min(6).max(32).optional(),
}).strict();
const passwordResetSchema = z.object({
  token: z.string().min(40).max(100),
  password: z.string().min(12, 'Password must be at least 12 characters.').max(128),
}).strict();
const mfaCodeSchema = z.object({ code: z.string().trim().min(6).max(32) });
const mfaSetupSchema = z.object({ currentPassword: z.string().max(128).optional() });
const mfaDisableSchema = z.object({ code: z.string().trim().min(6).max(32), currentPassword: z.string().max(128).optional() }).strict();
const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE MY ACCOUNT'),
  mfaCode: z.string().trim().min(6).max(32).optional(),
}).strict();

const parseProfileUrl = (value) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};
const httpsProfileUrlSchema = z.string().trim().max(2048).url().refine((value) => {
  const url = parseProfileUrl(value);
  return Boolean(url && url.protocol === 'https:' && !url.username && !url.password);
}, 'Profile links must use HTTPS and cannot contain embedded credentials.');
const socialProfileUrl = (domains) => httpsProfileUrlSchema.refine(
  (value) => {
    const url = parseProfileUrl(value);
    return Boolean(url && domains.includes(url.hostname.toLowerCase()));
  },
  'Social profile links must point to the matching service.',
);
const socialLinksSchema = z.object({
  github: socialProfileUrl(['github.com', 'www.github.com']).nullable().optional(),
  linkedin: socialProfileUrl(['linkedin.com', 'www.linkedin.com']).nullable().optional(),
  x: socialProfileUrl(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com']).nullable().optional(),
}).strict();

const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  jobTitle: z.string().trim().max(100).nullable().optional(),
  bio: z.string().trim().max(280).nullable().optional(),
  website: httpsProfileUrlSchema.nullable().optional(),
  socialLinks: socialLinksSchema.optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  locale: z.string().trim().min(2).max(64).optional(),
}).strict().refine((input) => Object.keys(input).length > 0, 'At least one profile field is required.');

const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  accentColor: z.enum(['violet', 'indigo', 'cyan', 'emerald', 'rose']).optional(),
  defaultGridStyle: z.enum(['dots', 'lines', 'radial', 'mesh', 'blank']).optional(),
  snapToGrid: z.boolean().optional(),
  reducedMotion: z.boolean().optional(),
  autosaveEnabled: z.boolean().optional(),
  autosaveInterval: z.enum(['realtime', '5s', '30s', 'off']).optional(),
  notifications: z.object({
    emailDigest: z.boolean().optional(),
    mentions: z.boolean().optional(),
    desktop: z.boolean().optional(),
    productUpdates: z.boolean().optional(),
  }).partial().optional(),
}).refine((input) => Object.keys(input).length > 0, 'At least one preference is required.');

const ACCESS_COOKIE = 'voxel_access';
const REFRESH_COOKIE = 'voxel_refresh';
const MFA_COOKIE = 'voxel_mfa_challenge';
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

const applyMfaChallengeCookie = (reply, challengeToken, environment) => {
  reply.setCookie(MFA_COOKIE, challengeToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: environment.NODE_ENV === 'production',
    path: '/api/v1/auth',
    maxAge: 5 * 60,
  });
};

const allowCredentialRateLimit = async () => ({ allowed: true, retryAfterSeconds: 1 });

const credentialRateLimit = (accountRateLimiter, { scope, max, windowSeconds, timeWindow, getIdentifier }) => ({
  config: { rateLimit: { max, timeWindow } },
  preHandler: async (request, reply) => {
    try {
      const requestedIdentifier = await getIdentifier(request);
      const identifier = typeof requestedIdentifier === 'string' && requestedIdentifier.trim()
        ? requestedIdentifier
        : `ip:${request.ip}`;
      const result = await accountRateLimiter({ scope, identifier, max, windowSeconds });
      if (result.allowed) return;
      reply.header('retry-after', String(result.retryAfterSeconds));
      return reply.status(429).send(failure(
        createRequestId(request.id),
        'RATE_LIMITED',
        'Too many attempts. Try again later.',
        [],
      ));
    } catch (error) {
      request.log.error({ err: error, scope }, 'Credential rate limit could not be checked');
      return reply.status(503).send(failure(
        createRequestId(request.id),
        'SERVICE_UNAVAILABLE',
        'Sign-in services are temporarily unavailable. Try again shortly.',
        [],
      ));
    }
  },
});

const requestEmail = (request) => request.body?.email;
const requestToken = (request) => request.body?.token;

export const registerAuthRoutes = async (app, environment, { accountRateLimiter = allowCredentialRateLimit } = {}) => {
  const authService = new AuthService(prisma, environment);
  const getSessionContext = async (request) => {
    if (request.voxelSessionContext !== undefined) return request.voxelSessionContext;
    request.voxelSessionContext = await authService.getAuthenticatedContext(request.cookies[ACCESS_COOKIE]);
    return request.voxelSessionContext;
  };
  const getSessionAccountId = async (request) => (await getSessionContext(request))?.user.id;

  const googleOAuthEnabled = Boolean(environment.GOOGLE_CLIENT_ID && environment.GOOGLE_CLIENT_SECRET);
  if (googleOAuthEnabled) {
    // Official Google OAuth 2.0 PKCE Flow (accounts.google.com)
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
      callbackUri: `${environment.VOXEL_API_PUBLIC_URL}/api/v1/auth/google/callback`,
      pkce: 'S256',
    });

    app.get('/api/v1/auth/google/callback', async (request, reply) => {
      try {
        const { token } = await app.oauth2GoogleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request, reply);
        const response = await fetch(GOOGLE_USER_INFO_URL, {
          headers: { Authorization: `Bearer ${token.access_token}` },
        });
        if (!response.ok) throw new AuthenticationError('Google identity could not be verified.');
        const parsed = googleIdentitySchema.parse(await response.json());
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
        if (tokens.mfaRequired) {
          applyMfaChallengeCookie(reply, tokens.challengeToken, environment);
          return reply.redirect(`${environment.VOXEL_PUBLIC_APP_URL}/login?mfa=required`);
        }
        applySessionCookies(reply, tokens, environment);
        return reply.redirect(`${environment.VOXEL_PUBLIC_APP_URL}/workspaces`);
      } catch (error) {
        request.log.error(error, 'Google OAuth callback error');
        return reply.redirect(`${environment.VOXEL_PUBLIC_APP_URL}/login?error=google_oauth_failed`);
      }
    });
  } else {
    const unavailable = async (_request, reply) =>
      reply.redirect(`${environment.VOXEL_PUBLIC_APP_URL}/login?error=google_unconfigured`);
    app.get('/api/v1/auth/google', unavailable);
    app.get('/api/v1/auth/google/callback', unavailable);
  }

  app.post('/api/v1/auth/signup', credentialRateLimit(accountRateLimiter, {
    scope: 'signup', max: 8, windowSeconds: 15 * 60, timeWindow: '15 minutes', getIdentifier: requestEmail,
  }), async (request, reply) => {
    const input = signupSchema.parse(request.body);
    const result = await authService.signUpWithEmail(input);
    let delivery = { delivered: false };
    try {
      delivery = await sendVerificationEmail({
        email: result.user.email,
        displayName: result.user.displayName,
        token: result.verificationToken,
        environment,
      });
    } catch (error) {
      request.log.warn({ err: error }, 'Signup verification email could not be delivered');
    }
    return reply.status(202).send(success({
      authenticated: false,
      verificationRequired: true,
      email: result.user.email,
      ...(environment.NODE_ENV !== 'production' && delivery.verificationUrl ? { verificationUrl: delivery.verificationUrl } : {}),
    }, createRequestId(request.id)));
  });

  app.post('/api/v1/auth/email-verification/resend', credentialRateLimit(accountRateLimiter, {
    scope: 'verification-resend', max: 4, windowSeconds: 60 * 60, timeWindow: '1 hour', getIdentifier: requestEmail,
  }), async (request, reply) => {
    const { email } = resendVerificationSchema.parse(request.body);
    const user = await prisma.user.findFirst({ where: { email, deletedAt: null }, select: { id: true, email: true, displayName: true, passwordHash: true, emailVerified: true } });
    if (user?.passwordHash && !user.emailVerified) {
      const token = await authService.issueEmailVerificationToken(user.id);
      try {
        await sendVerificationEmail({ email: user.email, displayName: user.displayName, token, environment });
      } catch (error) {
        request.log.warn({ err: error }, 'Resent verification email could not be delivered');
      }
    }
    return reply.send(success({ sent: true }, createRequestId(request.id)));
  });

  app.post('/api/v1/auth/email-verification/verify', credentialRateLimit(accountRateLimiter, {
    scope: 'email-verification', max: 8, windowSeconds: 5 * 60, timeWindow: '5 minutes', getIdentifier: requestToken,
  }), async (request, reply) => {
    const { token } = emailVerificationSchema.parse(request.body);
    const user = await authService.verifyEmailToken(token);
    const result = await authService.generateSessionForUser(user, {
      ip: request.ip,
      ...(request.headers['user-agent'] ? { userAgent: request.headers['user-agent'] } : {}),
    });
    applySessionCookies(reply, result, environment);
    return reply.send(success({ authenticated: true, user: result.user }, createRequestId(request.id)));
  });

  app.post('/api/v1/auth/email-change/request', credentialRateLimit(accountRateLimiter, {
    scope: 'email-change-request', max: 3, windowSeconds: 60 * 60, timeWindow: '1 hour',
    getIdentifier: async (request) => (await getSessionAccountId(request)) ?? requestEmail(request),
  }), async (request, reply) => {
    const context = await getSessionContext(request);
    if (!context) throw new AuthenticationError('Authentication is required.');
    const { email, mfaCode } = emailChangeRequestSchema.parse(request.body);
    const change = await authService.issueEmailChangeToken(context.user.id, context.sessionId, email, mfaCode);
    if (environment.NODE_ENV === 'production') {
      if (change) {
        void sendEmailChangeVerificationEmail({
          email: change.email,
          displayName: change.displayName,
          token: change.token,
          environment,
        }).catch((error) => request.log.warn({ err: error }, 'Email change verification could not be delivered'));
      }
      return reply.status(202).send(success({ sent: true }, createRequestId(request.id)));
    }

    let delivery = {};
    if (change) {
      try {
        delivery = await sendEmailChangeVerificationEmail({
          email: change.email,
          displayName: change.displayName,
          token: change.token,
          environment,
        });
      } catch (error) {
        request.log.warn({ err: error }, 'Email change verification could not be delivered');
      }
    }
    return reply.status(202).send(success({
      sent: true,
      ...(delivery.verificationUrl ? { verificationUrl: delivery.verificationUrl } : {}),
    }, createRequestId(request.id)));
  });

  app.post('/api/v1/auth/email-change/verify', credentialRateLimit(accountRateLimiter, {
    scope: 'email-change-verify', max: 8, windowSeconds: 5 * 60, timeWindow: '5 minutes', getIdentifier: requestToken,
  }), async (request, reply) => {
    const { token } = emailVerificationSchema.parse(request.body);
    const result = await authService.verifyEmailChangeToken(token);
    return reply.send(success(result, createRequestId(request.id)));
  });

  app.post('/api/v1/auth/password-reset/request', credentialRateLimit(accountRateLimiter, {
    scope: 'password-reset-request', max: 5, windowSeconds: 60 * 60, timeWindow: '1 hour', getIdentifier: requestEmail,
  }), async (request, reply) => {
    const { email } = passwordResetRequestSchema.parse(request.body);
    if (environment.NODE_ENV === 'production') {
      void (async () => {
        const reset = await authService.issuePasswordResetToken(email);
        if (!reset) return;
        await sendPasswordResetEmail({
          email: reset.email,
          displayName: reset.displayName,
          token: reset.token,
          environment,
        });
      })().catch((error) => request.log.warn({ err: error }, 'Password reset email could not be delivered'));
      return reply.status(202).send(success({ sent: true }, createRequestId(request.id)));
    }

    const reset = await authService.issuePasswordResetToken(email);
    let delivery = { delivered: false };
    if (reset) {
      try {
        delivery = await sendPasswordResetEmail({
          email: reset.email,
          displayName: reset.displayName,
          token: reset.token,
          environment,
        });
      } catch (error) {
        request.log.warn({ err: error }, 'Password reset email could not be delivered');
      }
    }
    return reply.status(202).send(success({
      sent: true,
      ...(environment.NODE_ENV !== 'production' && delivery.resetUrl ? { resetUrl: delivery.resetUrl } : {}),
    }, createRequestId(request.id)));
  });

  app.post('/api/v1/auth/password-reset/complete', credentialRateLimit(accountRateLimiter, {
    scope: 'password-reset-complete', max: 8, windowSeconds: 5 * 60, timeWindow: '5 minutes', getIdentifier: requestToken,
  }), async (request, reply) => {
    const { token, password } = passwordResetSchema.parse(request.body);
    const result = await authService.resetPassword(token, password);
    return reply.send(success(result, createRequestId(request.id)));
  });

  app.post('/api/v1/auth/login', credentialRateLimit(accountRateLimiter, {
    scope: 'login', max: 10, windowSeconds: 15 * 60, timeWindow: '15 minutes', getIdentifier: requestEmail,
  }), async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const result = await authService.loginWithEmail(input, {
      ip: request.ip,
      ...(request.headers['user-agent'] ? { userAgent: request.headers['user-agent'] } : {}),
    });

    if (result.mfaRequired) {
      applyMfaChallengeCookie(reply, result.challengeToken, environment);
      return reply.send(success({ mfaRequired: true }, createRequestId(request.id)));
    }
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

  app.post('/api/v1/auth/mfa/verify', credentialRateLimit(accountRateLimiter, {
    scope: 'mfa-verify', max: 8, windowSeconds: 5 * 60, timeWindow: '5 minutes',
    getIdentifier: (request) => request.cookies[MFA_COOKIE],
  }), async (request, reply) => {
    const challengeToken = request.cookies[MFA_COOKIE];
    if (!challengeToken) throw new AuthenticationError('A valid sign-in challenge is required.');
    const { code } = mfaCodeSchema.parse(request.body);
    const result = await authService.completeMfaChallenge(challengeToken, code, {
      ip: request.ip,
      ...(request.headers['user-agent'] ? { userAgent: request.headers['user-agent'] } : {}),
    });
    reply.clearCookie(MFA_COOKIE, { path: '/api/v1/auth' });
    applySessionCookies(reply, result, environment);
    return reply.send(success({ authenticated: true, user: result.user }, createRequestId(request.id)));
  });

  app.post('/api/v1/auth/mfa/cancel', async (_request, reply) => {
    reply.clearCookie(MFA_COOKIE, { path: '/api/v1/auth' });
    return reply.send(success({ cancelled: true }, createRequestId(_request.id)));
  });

  app.get('/api/v1/auth/mfa', async (request, reply) => {
    const context = await authService.getAuthenticatedContext(request.cookies[ACCESS_COOKIE]);
    if (!context) throw new AuthenticationError('Authentication is required.');
    const status = await authService.getMfaStatus(context.user.id);
    return reply.send(success(status, createRequestId(request.id)));
  });

  app.post('/api/v1/auth/mfa/totp/setup', async (request, reply) => {
    const context = await getSessionContext(request);
    if (!context) throw new AuthenticationError('Authentication is required.');
    const { currentPassword } = mfaSetupSchema.parse(request.body ?? {});
    const setup = await authService.startTotpSetup(context.user.id, context.sessionId, currentPassword);
    return reply.send(success(setup, createRequestId(request.id)));
  });

  app.post('/api/v1/auth/mfa/totp/confirm', credentialRateLimit(accountRateLimiter, {
    scope: 'mfa-totp-confirm', max: 8, windowSeconds: 5 * 60, timeWindow: '5 minutes', getIdentifier: getSessionAccountId,
  }), async (request, reply) => {
    const context = await getSessionContext(request);
    if (!context) throw new AuthenticationError('Authentication is required.');
    const { code } = mfaCodeSchema.parse(request.body);
    const result = await authService.confirmTotpSetup(context.user.id, context.sessionId, code);
    return reply.send(success(result, createRequestId(request.id)));
  });

  app.post('/api/v1/auth/mfa/recovery-codes', credentialRateLimit(accountRateLimiter, {
    scope: 'mfa-recovery-codes', max: 5, windowSeconds: 5 * 60, timeWindow: '5 minutes', getIdentifier: getSessionAccountId,
  }), async (request, reply) => {
    const context = await getSessionContext(request);
    if (!context) throw new AuthenticationError('Authentication is required.');
    const { code } = mfaCodeSchema.parse(request.body);
    const result = await authService.rotateMfaRecoveryCodes(context.user.id, code);
    return reply.send(success(result, createRequestId(request.id)));
  });

  app.post('/api/v1/auth/mfa/disable', credentialRateLimit(accountRateLimiter, {
    scope: 'mfa-disable', max: 5, windowSeconds: 5 * 60, timeWindow: '5 minutes', getIdentifier: getSessionAccountId,
  }), async (request, reply) => {
    const context = await getSessionContext(request);
    if (!context) throw new AuthenticationError('Authentication is required.');
    const input = mfaDisableSchema.parse(request.body);
    const result = await authService.disableTotp(context.user.id, context.sessionId, input);
    return reply.send(success(result, createRequestId(request.id)));
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
    await authService.revokeAccessSession(accessToken);
    reply.clearCookie(ACCESS_COOKIE, { path: '/' });
    reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    reply.clearCookie(MFA_COOKIE, { path: '/api/v1/auth' });
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
          emailChangeAllowed: Boolean(user.passwordHash && !user.googleSubject),
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          jobTitle: user.jobTitle,
          bio: user.bio,
          website: user.website,
          socialLinks: user.socialLinks,
          timezone: user.timezone,
          locale: user.locale,
          preferences: user.preferences,
        },
        createRequestId(request.id),
      ),
    );
  });

  app.patch('/api/v1/auth/me', async (request, reply) => {
    const accessToken = request.cookies[ACCESS_COOKIE];
    const context = await authService.getAuthenticatedContext(accessToken);
    if (!context) throw new AuthenticationError('Authentication is required.');
    const input = profileUpdateSchema.parse(request.body);
    const profileData = { ...input };
    if (input.socialLinks) {
      const previousLinks = context.user.socialLinks && typeof context.user.socialLinks === 'object'
        ? context.user.socialLinks
        : {};
      profileData.socialLinks = { ...previousLinks, ...input.socialLinks };
    }
    const user = await prisma.user.update({
      where: { id: context.user.id },
      data: profileData,
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        jobTitle: true,
        bio: true,
        website: true,
        socialLinks: true,
        timezone: true,
        locale: true,
        preferences: true,
      },
    });
    return reply.send(success(user, createRequestId(request.id)));
  });

  app.patch('/api/v1/auth/preferences', async (request, reply) => {
    const context = await authService.getAuthenticatedContext(request.cookies[ACCESS_COOKIE]);
    if (!context) throw new AuthenticationError('Authentication is required.');
    const input = preferencesSchema.parse(request.body);
    const previous = context.user.preferences && typeof context.user.preferences === 'object'
      ? context.user.preferences
      : {};
    const updatedPreferences = {
      ...previous,
      ...input,
      ...(input.notifications ? {
        notifications: { ...(previous.notifications || {}), ...input.notifications },
      } : {}),
    };
    const user = await prisma.user.update({
      where: { id: context.user.id },
      data: { preferences: updatedPreferences },
      select: { preferences: true },
    });
    return reply.send(success(user.preferences, createRequestId(request.id)));
  });

  app.post('/api/v1/auth/password', credentialRateLimit(accountRateLimiter, {
    scope: 'password-change', max: 5, windowSeconds: 15 * 60, timeWindow: '15 minutes', getIdentifier: getSessionAccountId,
  }), async (request, reply) => {
    const context = await getSessionContext(request);
    if (!context) throw new AuthenticationError('Authentication is required.');
    const input = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(12, 'Password must be at least 12 characters.').max(128),
      mfaCode: z.string().trim().min(6).max(32).optional(),
    }).strict().parse(request.body);
    await authService.updatePassword(
      context.user.id,
      context.sessionId,
      input.currentPassword,
      input.newPassword,
      input.mfaCode,
    );
    return reply.send(success({ updated: true, otherSessionsRevoked: true }, createRequestId(request.id)));
  });

  app.get('/api/v1/auth/sessions', async (request, reply) => {
    const context = await authService.getAuthenticatedContext(request.cookies[ACCESS_COOKIE]);
    if (!context) throw new AuthenticationError('Authentication is required.');
    const sessions = await authService.listSessions(context.user.id, context.sessionId);
    return reply.send(success(sessions, createRequestId(request.id)));
  });

  app.delete('/api/v1/auth/sessions/:sessionId', async (request, reply) => {
    const context = await authService.getAuthenticatedContext(request.cookies[ACCESS_COOKIE]);
    if (!context) throw new AuthenticationError('Authentication is required.');
    const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(request.params);
    const revoked = await authService.revokeSessionById(context.user.id, sessionId);
    if (!revoked) throw new AuthenticationError('The session was not found or is already revoked.');
    if (sessionId === context.sessionId) {
      reply.clearCookie(ACCESS_COOKIE, { path: '/' });
      reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    }
    return reply.send(success({ revoked: true }, createRequestId(request.id)));
  });

  app.post('/api/v1/auth/logout-all', credentialRateLimit(accountRateLimiter, {
    scope: 'logout-all', max: 3, windowSeconds: 15 * 60, timeWindow: '15 minutes', getIdentifier: getSessionAccountId,
  }), async (request, reply) => {
    const context = await getSessionContext(request);
    if (!context) throw new AuthenticationError('Authentication is required.');
    const { mfaCode } = z.object({ mfaCode: z.string().trim().min(6).max(32).optional() }).strict().parse(request.body ?? {});
    await authService.revokeAllSessions(context.user.id, context.sessionId, mfaCode);
    reply.clearCookie(ACCESS_COOKIE, { path: '/' });
    reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    return reply.send(success({ loggedOut: true }, createRequestId(request.id)));
  });

  app.delete('/api/v1/auth/me', credentialRateLimit(accountRateLimiter, {
    scope: 'account-delete', max: 3, windowSeconds: 15 * 60, timeWindow: '15 minutes', getIdentifier: getSessionAccountId,
  }), async (request, reply) => {
    const context = await getSessionContext(request);
    if (!context) throw new AuthenticationError('Authentication is required.');
    const input = deleteAccountSchema.parse(request.body);

    await authService.deleteAccount(context.user.id, context.sessionId, { mfaCode: input.mfaCode });
    reply.clearCookie(ACCESS_COOKIE, { path: '/' });
    reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    return reply.send(success({ deleted: true }, createRequestId(request.id)));
  });
};
