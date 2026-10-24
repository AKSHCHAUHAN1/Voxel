import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { ZodError } from 'zod';

const { prismaMock, userId, authState } = vi.hoisted(() => ({
  userId: '1b0e3ced-1d40-4a2a-a819-59c2250872bd',
  authState: { authenticated: true },
  prismaMock: {
    workspaceMember: { findMany: vi.fn() },
    dashboard: { findMany: vi.fn() },
    dashboardTemplate: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
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

const { registerSearchRoutes } = await import('./search-routes.js');
const workspaceId = '9f4f0208-352b-4ed2-9ed9-b12f3cc4c095';
let app;

beforeEach(async () => {
  vi.clearAllMocks();
  authState.authenticated = true;
  prismaMock.workspaceMember.findMany.mockResolvedValue([
    {
      workspaceId,
      role: 'EDITOR',
      workspace: { id: workspaceId, name: 'Product team', description: null },
    },
  ]);
  prismaMock.dashboard.findMany.mockResolvedValue([]);
  prismaMock.dashboardTemplate.findMany.mockResolvedValue([]);
  prismaMock.$queryRaw.mockResolvedValue([]);

  app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) =>
    reply.status(error instanceof ZodError ? 422 : error.statusCode || 500).send({ error: error.message }),
  );
  await app.register(cookie);
  await registerSearchRoutes(app, {});
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('global search', () => {
  it('requires an authenticated user and a useful query', async () => {
    authState.authenticated = false;
    const unauthorized = await app.inject({ method: 'GET', url: '/api/v1/search?q=metrics' });
    expect(unauthorized.statusCode).toBe(401);

    authState.authenticated = true;
    const tooShort = await app.inject({ method: 'GET', url: '/api/v1/search?q=x' });
    expect(tooShort.statusCode).toBe(422);
    expect(prismaMock.workspaceMember.findMany).not.toHaveBeenCalled();
  });

  it('returns categorized matches scoped to the authenticated user’s active workspaces', async () => {
    prismaMock.workspaceMember.findMany
      .mockResolvedValueOnce([
        {
          workspaceId,
          role: 'EDITOR',
          workspace: { id: workspaceId, name: 'Product team', description: null },
        },
      ])
      .mockResolvedValueOnce([]);
    prismaMock.dashboard.findMany.mockResolvedValue([
      {
        id: 'a050c2d7-3d5c-48ec-8417-f2bce4eddf6e',
        workspaceId,
        name: 'Metrics',
        description: null,
        status: 'PUBLISHED',
        updatedAt: new Date('2026-10-12T10:00:00.000Z'),
        workspace: { name: 'Product team' },
      },
    ]);
    prismaMock.$queryRaw.mockResolvedValue([
      {
        id: 'node-1',
        title: 'Conversion metrics',
        type: 'metric',
        dashboardId: 'a050c2d7-3d5c-48ec-8417-f2bce4eddf6e',
        workspaceId,
        dashboardName: 'Metrics',
        workspaceName: 'Product team',
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=metrics',
      headers: { cookie: 'voxel_access=test-session' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      query: 'metrics',
      workspaces: [],
      dashboards: [{ id: 'a050c2d7-3d5c-48ec-8417-f2bce4eddf6e', workspaceName: 'Product team' }],
      widgets: [{ id: 'node-1', dashboardName: 'Metrics' }],
      templates: [],
      members: [],
    });
    expect(prismaMock.workspaceMember.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId, workspace: { deletedAt: null, archivedAt: null } },
    }));
    expect(prismaMock.dashboard.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: { in: [workspaceId] }, deletedAt: null }),
      select: expect.not.objectContaining({ scene: true }),
    }));
    const templateVisibility = prismaMock.dashboardTemplate.findMany.mock.calls[0][0].where.AND[1].OR;
    expect(templateVisibility).toEqual([
      { workspaceId: { in: [] } },
      {
        workspaceId: { in: [workspaceId] },
        OR: [{ isPublished: true }, { createdById: userId }],
      },
    ]);
    expect(response.json().data.dashboards[0]).not.toHaveProperty('scene');
    expect(prismaMock.$queryRaw).toHaveBeenCalledOnce();
  });

  it('does not search the database when the user has no active workspaces', async () => {
    prismaMock.workspaceMember.findMany.mockResolvedValue([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=metrics',
      headers: { cookie: 'voxel_access=test-session' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ dashboards: [], widgets: [], templates: [], members: [] });
    expect(prismaMock.dashboard.findMany).not.toHaveBeenCalled();
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });
});
