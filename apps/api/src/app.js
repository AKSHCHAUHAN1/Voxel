import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { createRequestId } from '@voxel/contracts';
import { prisma } from './database/prisma.js';
import { registerAuthRoutes } from './features/auth/auth-routes.js';
import { registerWorkspaceRoutes } from './features/workspaces/workspace-routes.js';
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

export const buildApp = async (environment) => {
  const app = Fastify({
    logger: {
      level: environment.NODE_ENV === 'production' ? 'info' : 'warn',
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
    },
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
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
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  app.setErrorHandler((error, request, reply) => {
    const requestId = toRequestId(request.id);
    const statusCode =
      error instanceof ZodError ? 422 : isHttpError(error) ? error.statusCode : 500;
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
          statusCode >= 500
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
  app.get('/health/ready', { config: { rateLimit: false } }, async (request) =>
    success({ status: 'ready' }, toRequestId(request.id)),
  );
  app.get('/api/v1/health', { config: { rateLimit: false } }, async (request) =>
    success({ service: 'voxel-api', status: 'ok' }, toRequestId(request.id)),
  );

  await registerAuthRoutes(app, environment);
  await registerWorkspaceRoutes(app, environment);
  app.addHook('onClose', async () => prisma.$disconnect());

  return app;
};
