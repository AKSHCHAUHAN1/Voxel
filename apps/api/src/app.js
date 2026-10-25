import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { createRequestId } from '@voxel/contracts';
import { prisma } from './database/prisma.js';
import { registerAuthRoutes } from './features/auth/auth-routes.js';
import { registerWorkspaceRoutes } from './features/workspaces/workspace-routes.js';
import { registerNotificationRoutes } from './features/notifications/notification-routes.js';
import { registerFileRoutes } from './features/files/file-routes.js';
import { registerPluginRoutes } from './features/plugins/plugin-routes.js';
import { registerSearchRoutes } from './features/search/search-routes.js';
import { registerRestDataRoutes } from './features/data-sources/rest-data-routes.js';
import { failure, success } from './lib/api-response.js';

const toRequestId = (value) => createRequestId(value);

const mapErrorCode = (statusCode) => {
  if (statusCode === 401) return 'AUTHENTICATION_REQUIRED';
  if (statusCode === 403) return 'AUTHORIZATION_DENIED';
  if (statusCode === 404) return 'RESOURCE_NOT_FOUND';
  if (statusCode === 409) return 'RESOURCE_CONFLICT';
  if (statusCode === 429) return 'RATE_LIMITED';
  if (statusCode >= 400 && statusCode < 500) return 'VALIDATION_FAILED';
  return 'INTERNAL_ERROR';
};

const isHttpError = (error) =>
  error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number';

export const buildApp = async (environment, { readinessChecks = {}, accountRateLimiter, rateLimitRedis } = {}) => {
  if (environment.NODE_ENV === 'production' && (typeof accountRateLimiter !== 'function' || !rateLimitRedis)) {
    throw new Error('Redis-backed credential and source address rate limiters are required in production');
  }
  const app = Fastify({
    logger: {
      level: environment.NODE_ENV === 'production' ? 'info' : 'warn',
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
    },
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
  });

  await app.register(helmet, {
    ...(environment.NODE_ENV === 'production' ? {} : { contentSecurityPolicy: false }),
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  await app.register(cookie);
  await app.register(cors, {
    credentials: true,
    origin: environment.VOXEL_PUBLIC_APP_URL,
  });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    ...(rateLimitRedis ? { redis: rateLimitRedis } : {}),
  });
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: 10 * 1024 * 1024 }, (_request, body, done) => done(null, body));

  if (environment.NODE_ENV !== 'production') {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'Voxel API',
          description: 'Voxel platform API documentation',
          version: '0.1.0',
        },
        servers: [
          {
            url: environment.VOXEL_API_PUBLIC_URL,
          },
        ],
        components: {
          securitySchemes: {
            cookieAuth: {
              type: 'apiKey',
              in: 'cookie',
              name: 'sessionId',
            },
          },
        },
      },
    });

    await app.register(swaggerUi, {
      routePrefix: '/api/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
      staticCSP: true,
    });
  }

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  app.addHook('onRequest', async (request, reply) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;
    const origin = request.headers.origin;
    const fetchSite = request.headers['sec-fetch-site'];
    const hasAuthenticationCookie = Boolean(
      request.cookies?.voxel_access
      || request.cookies?.voxel_refresh
      || request.cookies?.voxel_mfa_challenge,
    );
    const requestOrigin = new URL(environment.VOXEL_PUBLIC_APP_URL).origin;
    if (
      (origin && origin !== requestOrigin)
      || fetchSite === 'cross-site'
      || (hasAuthenticationCookie && !origin)
    ) {
      return reply.status(403).send(failure(
        toRequestId(request.id),
        'CSRF_ORIGIN_REJECTED',
        'This request origin is not allowed.',
        [],
      ));
    }
  });

  app.setErrorHandler((error, request, reply) => {
    const requestId = toRequestId(request.id);
    const serializationConflict = error?.code === 'P2034';
    const statusCode =
      error instanceof ZodError ? 422 : serializationConflict ? 409 : isHttpError(error) ? error.statusCode : 500;
    const details = error instanceof ZodError ? error.issues.map((issue) => issue.message) : [];

    if (statusCode >= 500) {
      request.log.error({ err: error, requestId }, 'Unhandled API error');
    }

    return reply
      .status(statusCode)
      .send(
        failure(
          requestId,
          error instanceof ZodError ? 'VALIDATION_FAILED' : mapErrorCode(statusCode),
          serializationConflict
            ? 'A concurrent change prevented this save. Please retry.'
            : statusCode >= 500
            ? 'An unexpected error occurred.'
            : error instanceof Error
              ? error.message
              : 'The request could not be processed.',
          details,
        ),
      );
  });

  app.get('/health/live', { config: { rateLimit: false } }, async (request) =>
    success({ status: 'live' }, toRequestId(request.id)),
  );
  app.get('/health/ready', { config: { rateLimit: false } }, async (request, reply) => {
    const checks = {
      database: async () => prisma.$queryRaw`SELECT 1`,
      ...readinessChecks,
    };
    const results = await Promise.all(Object.entries(checks).map(async ([name, check]) => {
      try {
        await check();
        return [name, 'ok'];
      } catch (error) {
        request.log.error({ err: error, dependency: name, requestId: request.id }, 'Readiness dependency check failed');
        return [name, 'unavailable'];
      }
    }));
    const dependencyStatus = Object.fromEntries(results);
    const ready = results.every(([, status]) => status === 'ok');
    return reply
      .status(ready ? 200 : 503)
      .send(success({ status: ready ? 'ready' : 'not_ready', dependencies: dependencyStatus }, toRequestId(request.id)));
  });
  app.get('/api/v1/health', { config: { rateLimit: false } }, async (request) =>
    success({ service: 'voxel-api', status: 'ok' }, toRequestId(request.id)),
  );

  await registerAuthRoutes(app, environment, { accountRateLimiter });
  await registerNotificationRoutes(app, environment);
  await registerFileRoutes(app, environment);
  await registerWorkspaceRoutes(app, environment);
  await registerPluginRoutes(app, environment);
  await registerSearchRoutes(app, environment);
  await registerRestDataRoutes(app, environment);
  app.addHook('onClose', async () => prisma.$disconnect());

  return app;
};
