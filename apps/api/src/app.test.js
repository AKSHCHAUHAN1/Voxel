import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const environment = {
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

let app;

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

describe('production rate limit configuration', () => {
  it('refuses to start without both Redis-backed account and source-address limits', async () => {
    await expect(buildApp({ ...environment, NODE_ENV: 'production' }))
      .rejects.toThrow(/Redis-backed credential and source address rate limiters/);
  });
});

describe('browser request origin protection', () => {
  it('rejects cross-origin mutations before they reach route handlers', async () => {
    app = await buildApp(environment);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { origin: 'https://malicious.example', 'sec-fetch-site': 'cross-site' },
      payload: {},
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      success: false,
      error: { code: 'CSRF_ORIGIN_REJECTED' },
    });
  });

  it('allows same-origin browser mutations to proceed to authentication', async () => {
    app = await buildApp(environment);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password',
      headers: { origin: environment.VOXEL_PUBLIC_APP_URL, 'sec-fetch-site': 'same-site' },
      payload: { currentPassword: 'old-password', newPassword: 'a-secure-new-password' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('rejects cookie-authenticated mutations when the browser origin is missing', async () => {
    app = await buildApp(environment);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password',
      headers: { cookie: 'voxel_access=opaque-session-cookie' },
      payload: { currentPassword: 'old-password', newPassword: 'a-secure-new-password' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('CSRF_ORIGIN_REJECTED');
  });

  it('allows unauthenticated mutations without browser origin metadata to reach authentication', async () => {
    app = await buildApp(environment);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password',
      payload: { currentPassword: 'old-password', newPassword: 'a-secure-new-password' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('AUTHENTICATION_REQUIRED');
  });
});
