import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { ZodError } from 'zod';

const { prismaMock, userId } = vi.hoisted(() => ({
  userId: '1b0e3ced-1d40-4a2a-a819-59c2250872bd',
  prismaMock: {
    workspaceMember: { findUnique: vi.fn() },
    workspacePlugin: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    widgetPluginInstall: { create: vi.fn(), groupBy: vi.fn() },
    widgetPluginReview: { findMany: vi.fn(), groupBy: vi.fn(), upsert: vi.fn() },
    dashboard: { findMany: vi.fn() },
    dashboardTemplate: { findMany: vi.fn() },
    auditEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../database/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../auth/auth-service.js', () => ({
  AuthService: class {
    async getAuthenticatedUser() {
      return { id: userId, email: 'member@example.com' };
    }
  },
}));

const { registerPluginRoutes } = await import('./plugin-routes.js');
const workspaceId = '9f4f0208-352b-4ed2-9ed9-b12f3cc4c095';
const pluginId = 'voxel.operations-toolkit';
let app;

beforeEach(async () => {
  vi.clearAllMocks();
  prismaMock.workspaceMember.findUnique.mockResolvedValue({
    role: 'OWNER',
    workspace: { archivedAt: null, deletedAt: null },
  });
  prismaMock.auditEvent.create.mockResolvedValue({});
  prismaMock.widgetPluginInstall.groupBy.mockResolvedValue([]);
  prismaMock.widgetPluginReview.findMany.mockResolvedValue([]);
  prismaMock.widgetPluginReview.groupBy.mockResolvedValue([]);
  prismaMock.widgetPluginReview.upsert.mockResolvedValue({});
  prismaMock.dashboardTemplate.findMany.mockResolvedValue([]);
  prismaMock.$transaction.mockImplementation(async (action) =>
    typeof action === 'function' ? action(prismaMock) : Promise.all(action),
  );
  app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) =>
    reply
      .status(error instanceof ZodError ? 422 : error.statusCode || 500)
      .send({ error: error.message }),
  );
  await app.register(cookie);
  await registerPluginRoutes(app, {});
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('workspace widget packs', () => {
  it('lists only the curated declarative catalog', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/marketplace/plugins',
      headers: { cookie: 'voxel_access=test-session' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.map((plugin) => plugin.id)).toEqual([
      'voxel.operations-toolkit',
      'voxel.delivery-metrics',
    ]);
    expect(response.json().data[0]).toMatchObject({
      license: 'Not published',
      compatibility: 'Voxel 0.1 and later',
      installCount: 0,
      ratingAverage: null,
      ratingCount: 0,
      myRating: null,
      screenshots: [{ src: '/marketplace/operations-toolkit.svg' }],
    });
  });

  it('returns aggregate installation and rating details without exposing other users’ ratings', async () => {
    prismaMock.widgetPluginInstall.groupBy.mockResolvedValue([
      { pluginId, _count: { _all: 7 } },
    ]);
    prismaMock.widgetPluginReview.groupBy.mockResolvedValue([
      { pluginId, _avg: { rating: 4.26 }, _count: { _all: 5 } },
    ]);
    prismaMock.widgetPluginReview.findMany.mockResolvedValue([{ pluginId, rating: 5 }]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/marketplace/plugins',
      headers: { cookie: 'voxel_access=test-session' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data[0]).toMatchObject({
      installCount: 7,
      ratingAverage: 4.3,
      ratingCount: 5,
      myRating: 5,
    });
    expect(prismaMock.widgetPluginReview.findMany).toHaveBeenCalledWith({
      where: { userId },
      select: { pluginId: true, rating: true },
    });
  });

  it('allows an installed-pack member to rate and update their rating once', async () => {
    prismaMock.workspacePlugin.findUnique.mockResolvedValue({ id: 'installed-pack' });
    prismaMock.widgetPluginReview.groupBy.mockResolvedValue([
      { pluginId, _avg: { rating: 4.5 }, _count: { _all: 2 } },
    ]);

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/workspaces/${workspaceId}/plugins/${pluginId}/rating`,
      headers: { cookie: 'voxel_access=test-session' },
      payload: { rating: 5 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({
      pluginId,
      myRating: 5,
      ratingAverage: 4.5,
      ratingCount: 2,
    });
    expect(prismaMock.widgetPluginReview.upsert).toHaveBeenCalledWith({
      where: { pluginId_userId: { pluginId, userId } },
      create: { pluginId, userId, rating: 5 },
      update: { rating: 5 },
    });
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'plugin.rated', after: { rating: 5 } }),
      }),
    );
  });

  it('requires a workspace installation and rejects ratings outside the five-star scale', async () => {
    prismaMock.workspacePlugin.findUnique.mockResolvedValue(null);
    const notInstalled = await app.inject({
      method: 'PUT',
      url: `/api/v1/workspaces/${workspaceId}/plugins/${pluginId}/rating`,
      headers: { cookie: 'voxel_access=test-session' },
      payload: { rating: 5 },
    });
    expect(notInstalled.statusCode).toBe(409);

    prismaMock.workspacePlugin.findUnique.mockResolvedValue({ id: 'installed-pack' });
    const invalid = await app.inject({
      method: 'PUT',
      url: `/api/v1/workspaces/${workspaceId}/plugins/${pluginId}/rating`,
      headers: { cookie: 'voxel_access=test-session' },
      payload: { rating: 6 },
    });
    expect(invalid.statusCode).toBe(422);
    expect(prismaMock.widgetPluginReview.upsert).not.toHaveBeenCalled();
  });

  it('limits installation to workspace owners and admins', async () => {
    prismaMock.workspaceMember.findUnique.mockResolvedValue({
      role: 'EDITOR',
      workspace: { archivedAt: null, deletedAt: null },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspaceId}/plugins`,
      headers: { cookie: 'voxel_access=test-session' },
      payload: { pluginId },
    });

    expect(response.statusCode).toBe(403);
    expect(prismaMock.workspacePlugin.create).not.toHaveBeenCalled();
  });

  it('persists a catalog version, widget IDs, and audit event on install', async () => {
    const installedAt = new Date('2026-10-12T10:00:00.000Z');
    prismaMock.workspacePlugin.create.mockImplementation(async ({ data }) => ({
      ...data,
      id: 'da98c469-97f3-4140-a4b7-9fc1c76bf998',
      installedAt,
    }));

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspaceId}/plugins`,
      headers: { cookie: 'voxel_access=test-session' },
      payload: { pluginId },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({
      id: pluginId,
      version: '1.0.0',
      compatible: true,
    });
    expect(prismaMock.workspacePlugin.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId,
        pluginId,
        version: '1.0.0',
        widgetTypes: ['voxel.operations.service-health'],
        installedById: userId,
      }),
    });
    expect(prismaMock.widgetPluginInstall.create).toHaveBeenCalledWith({
      data: { pluginId, version: '1.0.0', workspaceId },
    });
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'plugin.installed', workspaceId }),
      }),
    );
  });

  it('updates an outdated pack and records the version change', async () => {
    const installedAt = new Date('2026-10-12T10:00:00.000Z');
    prismaMock.workspacePlugin.findUnique.mockResolvedValue({
      id: 'da98c469-97f3-4140-a4b7-9fc1c76bf998',
      workspaceId,
      pluginId,
      version: '0.9.0',
      widgetTypes: ['voxel.operations.service-health'],
    });
    prismaMock.workspacePlugin.update.mockResolvedValue({
      id: 'da98c469-97f3-4140-a4b7-9fc1c76bf998',
      workspaceId,
      pluginId,
      version: '1.0.0',
      widgetTypes: ['voxel.operations.service-health'],
      installedAt,
    });

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/workspaces/${workspaceId}/plugins/${pluginId}`,
      headers: { cookie: 'voxel_access=test-session' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ id: pluginId, version: '1.0.0', compatible: true });
    expect(prismaMock.workspacePlugin.update).toHaveBeenCalledWith({
      where: { id: 'da98c469-97f3-4140-a4b7-9fc1c76bf998' },
      data: { version: '1.0.0', widgetTypes: ['voxel.operations.service-health'] },
    });
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'plugin.updated',
          before: { pluginId, version: '0.9.0' },
          after: { pluginId, version: '1.0.0' },
        }),
      }),
    );
  });

  it('blocks an update that would retire a widget still used on a dashboard', async () => {
    prismaMock.workspacePlugin.findUnique.mockResolvedValue({
      id: 'da98c469-97f3-4140-a4b7-9fc1c76bf998',
      pluginId,
      version: '0.9.0',
      widgetTypes: ['voxel.operations.legacy-health'],
    });
    prismaMock.dashboard.findMany.mockResolvedValue([
      {
        id: 'a050c2d7-3d5c-48ec-8417-f2bce4eddf6e',
        name: 'Operations',
        scene: { nodes: [{ type: 'voxel.operations.legacy-health' }] },
      },
    ]);

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/workspaces/${workspaceId}/plugins/${pluginId}`,
      headers: { cookie: 'voxel_access=test-session' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatch(/Operations/);
    expect(prismaMock.workspacePlugin.update).not.toHaveBeenCalled();
  });

  it('does not uninstall a pack while one of its widgets is on a dashboard', async () => {
    prismaMock.workspacePlugin.findUnique.mockResolvedValue({
      id: 'da98c469-97f3-4140-a4b7-9fc1c76bf998',
      pluginId,
      version: '1.0.0',
      widgetTypes: ['voxel.operations.service-health'],
    });
    prismaMock.dashboard.findMany.mockResolvedValue([
      {
        id: 'a050c2d7-3d5c-48ec-8417-f2bce4eddf6e',
        name: 'Operations',
        scene: { nodes: [{ type: 'voxel.operations.service-health' }] },
      },
    ]);

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/workspaces/${workspaceId}/plugins/${pluginId}`,
      headers: { cookie: 'voxel_access=test-session' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatch(/Operations/);
    expect(prismaMock.workspacePlugin.delete).not.toHaveBeenCalled();
  });
});
