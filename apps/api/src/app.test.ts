import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import type { Environment } from './config/environment.js';

const environment: Environment = {
  NODE_ENV: 'test',
  API_HOST: '127.0.0.1',
  API_PORT: 3000,
  VOXEL_API_PUBLIC_URL: 'http://localhost:3000',
  VOXEL_PUBLIC_APP_URL: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://voxel:voxel@localhost:5432/voxel?schema=public',
  REDIS_URL: 'redis://localhost:6379',
  SESSION_SECRET: 'a-secure-test-session-secret-with-32-characters',
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
};

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('health routes', () => {
  it('returns the versioned API health contract', async () => {
    app = await buildApp(environment);
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.json()).toMatchObject({
      success: true,
      data: { service: 'voxel-api', status: 'ok' },
    });
  });
});
