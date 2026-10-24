import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { ZodError } from 'zod';

const { prismaMock, authState, userId } = vi.hoisted(() => ({
  userId: '2baceac7-988c-4ad6-b22d-53e74f55562f',
  authState: { authenticated: true },
  prismaMock: {
    dashboard: { findFirst: vi.fn() },
    workspaceMember: { findUnique: vi.fn() },
  },
}));

vi.mock('../../database/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../auth/auth-service.js', () => ({
  AuthService: class {
    async getAuthenticatedUser() {
      return authState.authenticated ? { id: userId } : null;
    }
  },
}));

const { registerRestDataRoutes } = await import('./rest-data-routes.js');
const dashboardId = '4025e84a-13d5-4829-97e0-ec4d9ef7670c';
const workspaceId = '9f4f0208-352b-4ed2-9ed9-b12f3cc4c095';
let app;
let fetchJson;
let fetchGraphql;

beforeEach(async () => {
  vi.clearAllMocks();
  authState.authenticated = true;
  prismaMock.dashboard.findFirst.mockResolvedValue({ id: dashboardId, workspaceId, status: 'DRAFT' });
  prismaMock.workspaceMember.findUnique.mockResolvedValue({ workspace: { id: workspaceId, archivedAt: null, deletedAt: null } });
  fetchJson = vi.fn().mockResolvedValue({ metrics: [{ value: 12 }] });
  fetchGraphql = vi.fn().mockResolvedValue({ data: { metrics: [{ value: 12 }] } });
  app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) => reply.status(error instanceof ZodError ? 422 : error.statusCode || 500).send({ error: error.message }));
  await app.register(cookie);
  await registerRestDataRoutes(app, {}, { fetchJson, fetchGraphql });
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('REST data source route', () => {
  it('requires an authenticated workspace member before fetching external data', async () => {
    authState.authenticated = false;
    const unauthenticated = await app.inject({
      method: 'POST',
      url: `/api/v1/dashboards/${dashboardId}/data-sources/rest`,
      payload: { url: 'https://api.example.com/data' },
    });
    expect(unauthenticated.statusCode).toBe(401);

    authState.authenticated = true;
    prismaMock.workspaceMember.findUnique.mockResolvedValue(null);
    const nonMember = await app.inject({
      method: 'POST',
      url: `/api/v1/dashboards/${dashboardId}/data-sources/rest`,
      headers: { cookie: 'voxel_access=session' },
      payload: { url: 'https://api.example.com/data' },
    });

    expect(nonMember.statusCode).toBe(404);
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('returns normalized endpoint JSON to an active dashboard workspace member', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/dashboards/${dashboardId}/data-sources/rest`,
      headers: { cookie: 'voxel_access=session' },
      payload: { url: 'https://api.example.com/data' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.value).toEqual({ metrics: [{ value: 12 }] });
    expect(fetchJson).toHaveBeenCalledWith('https://api.example.com/data');
  });

  it('does not query archived dashboards or workspaces', async () => {
    prismaMock.dashboard.findFirst.mockResolvedValue({ id: dashboardId, workspaceId, status: 'ARCHIVED' });
    const archivedDashboard = await app.inject({
      method: 'POST',
      url: `/api/v1/dashboards/${dashboardId}/data-sources/rest`,
      headers: { cookie: 'voxel_access=session' },
      payload: { url: 'https://api.example.com/data' },
    });
    expect(archivedDashboard.statusCode).toBe(404);

    prismaMock.dashboard.findFirst.mockResolvedValue({ id: dashboardId, workspaceId, status: 'DRAFT' });
    prismaMock.workspaceMember.findUnique.mockResolvedValue({ workspace: { id: workspaceId, archivedAt: new Date(), deletedAt: null } });
    const archivedWorkspace = await app.inject({
      method: 'POST',
      url: `/api/v1/dashboards/${dashboardId}/data-sources/rest`,
      headers: { cookie: 'voxel_access=session' },
      payload: { url: 'https://api.example.com/data' },
    });
    expect(archivedWorkspace.statusCode).toBe(404);
    expect(fetchJson).not.toHaveBeenCalled();
  });
});

describe('GraphQL data source route', () => {
  it('fetches GraphQL only for an authenticated member of an active dashboard workspace', async () => {
    authState.authenticated = false;
    const rejected = await app.inject({
      method: 'POST',
      url: `/api/v1/dashboards/${dashboardId}/data-sources/graphql`,
      payload: { url: 'https://api.example.com/graphql', query: 'query { metrics { value } }' },
    });
    expect(rejected.statusCode).toBe(401);
    expect(fetchGraphql).not.toHaveBeenCalled();
  });

  it('returns GraphQL JSON and rejects endpoint query errors', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/dashboards/${dashboardId}/data-sources/graphql`,
      headers: { cookie: 'voxel_access=session' },
      payload: {
        url: 'https://api.example.com/graphql',
        query: 'query { metrics { value } }',
        variables: { period: 'week' },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.value).toEqual({ data: { metrics: [{ value: 12 }] } });
    expect(fetchGraphql).toHaveBeenCalledWith('https://api.example.com/graphql', 'query { metrics { value } }', { period: 'week' });

    fetchGraphql.mockResolvedValue({ errors: [{ message: 'private server detail' }] });
    const error = await app.inject({
      method: 'POST',
      url: `/api/v1/dashboards/${dashboardId}/data-sources/graphql`,
      headers: { cookie: 'voxel_access=session' },
      payload: { url: 'https://api.example.com/graphql', query: 'query { metrics { value } }' },
    });
    expect(error.statusCode).toBe(502);
    expect(error.json().error).toBe('The GraphQL endpoint returned query errors.');
    expect(error.json().error).not.toContain('private server detail');
  });
});
