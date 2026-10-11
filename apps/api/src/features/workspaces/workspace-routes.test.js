import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { ZodError } from 'zod';

const { prismaMock, userId } = vi.hoisted(() => ({
  userId: '1b0e3ced-1d40-4a2a-a819-59c2250872bd',
  prismaMock: {
    workspaceMember: { findUnique: vi.fn(), findMany: vi.fn() },
    notification: { createMany: vi.fn() },
    dashboard: { findFirst: vi.fn(), create: vi.fn() },
    dashboardComment: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    dashboardTemplate: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    dashboardTemplateFavorite: { upsert: vi.fn(), deleteMany: vi.fn() },
    auditEvent: { create: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock('../../database/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../auth/auth-service.js', () => ({
  AuthService: class {
    async getAuthenticatedUser() {
      return { id: userId, email: 'member@example.com', displayName: 'Workspace Member' };
    }
  },
}));

const { registerWorkspaceRoutes } = await import('./workspace-routes.js');

const workspaceId = '9f4f0208-352b-4ed2-9ed9-b12f3cc4c095';
const dashboardId = 'a050c2d7-3d5c-48ec-8417-f2bce4eddf6e';

let app;

beforeEach(async () => {
  vi.clearAllMocks();
  prismaMock.workspaceMember.findUnique.mockResolvedValue({
    id: 'member-row',
    role: 'EDITOR',
    workspace: { deletedAt: null, archivedAt: null },
  });
  prismaMock.workspaceMember.findMany.mockResolvedValue([]);
  prismaMock.auditEvent.create.mockResolvedValue({});
  app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) => reply.status(error instanceof ZodError ? 422 : error.statusCode || 500).send({ error: error.message }));
  await app.register(cookie);
  await registerWorkspaceRoutes(app, {});
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('workspace template and activity routes', () => {
  it('rejects malformed widget rows before they can be saved', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/dashboards/${dashboardId}`,
      headers: { cookie: 'voxel_access=test-session' },
      payload: { scene: { schemaVersion: 2, nodes: [null], connections: [] }, version: 1 },
    });

    expect(response.statusCode).toBe(422);
    expect(prismaMock.dashboard.findFirst).not.toHaveBeenCalled();
  });

  it('does not let an editor publish a workspace template', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspaceId}/templates`,
      headers: { cookie: 'voxel_access=test-session' },
      payload: { dashboardId, name: 'Operations', isPublished: true },
    });

    expect(response.statusCode).toBe(403);
    expect(prismaMock.dashboard.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.dashboardTemplate.create).not.toHaveBeenCalled();
  });

  it('lets an editor save a private template from a dashboard in the same workspace', async () => {
    const scene = { schemaVersion: 2, nodes: [], connections: [] };
    const now = new Date('2026-10-11T10:00:00.000Z');
    prismaMock.dashboard.findFirst.mockResolvedValue({ scene });
    prismaMock.dashboardTemplate.create.mockResolvedValue({
      id: 'f6168c12-922e-4b03-b333-4fc2a8791a70',
      workspaceId,
      name: 'Operations',
      description: null,
      category: 'General',
      tags: [],
      scene,
      isPublished: false,
      favorites: [],
      createdBy: { displayName: 'Workspace Member' },
      createdAt: now,
      updatedAt: now,
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspaceId}/templates`,
      headers: { cookie: 'voxel_access=test-session' },
      payload: { dashboardId, name: 'Operations' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({
      name: 'Operations',
      isPublished: false,
      scene,
    });
    expect(prismaMock.dashboard.findFirst).toHaveBeenCalledWith({
      where: { id: dashboardId, workspaceId, deletedAt: null },
      select: { scene: true },
    });
  });

  it('creates a workspace dashboard from a published template', async () => {
    const scene = { schemaVersion: 2, nodes: [{ id: 'node-1', type: 'metric', content: '42' }], connections: [] };
    const now = new Date('2026-10-11T10:00:00.000Z');
    prismaMock.dashboardTemplate.findFirst.mockResolvedValue({
      id: 'f6168c12-922e-4b03-b333-4fc2a8791a70',
      workspaceId,
      name: 'Operations starter',
      description: 'A reusable operations view',
      scene,
      isPublished: true,
    });
    prismaMock.dashboard.create.mockImplementation(async ({ data }) => ({
      ...data,
      id: 'c1edff56-47e9-4c10-9b03-6602f8a0a9d9',
      status: 'DRAFT',
      version: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }));

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspaceId}/templates/f6168c12-922e-4b03-b333-4fc2a8791a70/use`,
      headers: { cookie: 'voxel_access=test-session' },
      payload: {},
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({ name: 'Operations starter copy', scene });
    expect(prismaMock.dashboardTemplate.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'f6168c12-922e-4b03-b333-4fc2a8791a70',
        workspaceId,
        OR: [{ isPublished: true }, { createdById: userId }],
      },
    });
    expect(prismaMock.dashboard.create.mock.calls[0][0].data.scene).toEqual(scene);
  });

  it('returns only member-safe fields in workspace activity', async () => {
    const createdAt = new Date('2026-10-11T10:00:00.000Z');
    prismaMock.auditEvent.findMany.mockResolvedValue([{
      id: 'event-1',
      action: 'dashboard.create',
      resourceType: 'dashboard',
      createdAt,
      actor: { displayName: 'Casey', avatarUrl: null, email: 'private@example.com' },
    }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${workspaceId}/activity`,
      headers: { cookie: 'voxel_access=test-session' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data[0]).toEqual({
      id: 'event-1',
      action: 'dashboard.create',
      resourceType: 'dashboard',
      createdAt: createdAt.toISOString(),
      actor: { displayName: 'Casey', avatarUrl: null },
    });
  });
});

describe('dashboard comments', () => {
  it('lets a commenter post and returns only safe author fields', async () => {
    const now = new Date('2026-10-11T10:00:00.000Z');
    prismaMock.workspaceMember.findUnique.mockResolvedValue({
      id: 'member-row', role: 'COMMENTER', workspace: { deletedAt: null, archivedAt: null },
    });
    prismaMock.dashboard.findFirst.mockResolvedValue({ id: dashboardId, workspaceId, status: 'DRAFT' });
    prismaMock.dashboardComment.create.mockResolvedValue({
      id: 'c2d78b51-c579-4e5f-9f00-f4a7abfd036c', dashboardId, body: 'The launch metric looks good.', deletedAt: null,
      createdAt: now, updatedAt: now,
      author: { id: userId, displayName: 'Workspace Member', avatarUrl: null, email: 'private@example.com' },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/dashboards/${dashboardId}/comments`,
      headers: { cookie: 'voxel_access=test-session' },
      payload: { body: '  The launch metric looks good.  ' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({
      id: 'c2d78b51-c579-4e5f-9f00-f4a7abfd036c',
      body: 'The launch metric looks good.',
      author: { id: userId, displayName: 'Workspace Member', avatarUrl: null },
      accessRole: 'COMMENTER',
    });
    expect(response.json().data.author).not.toHaveProperty('email');
    expect(prismaMock.dashboardComment.create.mock.calls[0][0].data).toEqual({
      dashboardId,
      authorId: userId,
      body: 'The launch metric looks good.',
      parentId: null,
    });
  });

  it('rejects viewers from posting comments', async () => {
    prismaMock.workspaceMember.findUnique.mockResolvedValue({
      id: 'member-row', role: 'VIEWER', workspace: { deletedAt: null, archivedAt: null },
    });
    prismaMock.dashboard.findFirst.mockResolvedValue({ id: dashboardId, workspaceId, status: 'DRAFT' });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/dashboards/${dashboardId}/comments`,
      headers: { cookie: 'voxel_access=test-session' },
      payload: { body: 'A viewer should not be able to write.' },
    });

    expect(response.statusCode).toBe(403);
    expect(prismaMock.dashboardComment.create).not.toHaveBeenCalled();
  });

  it('stores replies under an open root comment', async () => {
    const parentId = 'c2d78b51-c579-4e5f-9f00-f4a7abfd036c';
    prismaMock.workspaceMember.findUnique.mockResolvedValue({ id: 'member-row', role: 'COMMENTER', workspace: { deletedAt: null, archivedAt: null } });
    prismaMock.dashboard.findFirst.mockResolvedValue({ id: dashboardId, workspaceId, status: 'DRAFT', name: 'Launch' });
    prismaMock.dashboardComment.findFirst.mockResolvedValue({ id: parentId, resolvedAt: null });
    prismaMock.dashboardComment.create.mockResolvedValue({
      id: '93283d61-9de9-49b9-81f1-7a0271c6a6c1', dashboardId, parentId, body: 'Adding more context.', deletedAt: null,
      createdAt: new Date(), updatedAt: new Date(), author: { id: userId, displayName: 'Workspace Member', avatarUrl: null },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/dashboards/${dashboardId}/comments`,
      headers: { cookie: 'voxel_access=test-session' },
      payload: { body: 'Adding more context.', parentId },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.parentId).toBe(parentId);
    expect(prismaMock.dashboardComment.create.mock.calls[0][0].data).toMatchObject({ dashboardId, authorId: userId, body: 'Adding more context.', parentId });
  });

  it('does not accept replies to resolved comment threads', async () => {
    const parentId = 'c2d78b51-c579-4e5f-9f00-f4a7abfd036c';
    prismaMock.workspaceMember.findUnique.mockResolvedValue({ id: 'member-row', role: 'COMMENTER', workspace: { deletedAt: null, archivedAt: null } });
    prismaMock.dashboard.findFirst.mockResolvedValue({ id: dashboardId, workspaceId, status: 'DRAFT' });
    prismaMock.dashboardComment.findFirst.mockResolvedValue({ id: parentId, resolvedAt: new Date() });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/dashboards/${dashboardId}/comments`,
      headers: { cookie: 'voxel_access=test-session' },
      payload: { body: 'A late reply.', parentId },
    });

    expect(response.statusCode).toBe(409);
    expect(prismaMock.dashboardComment.create).not.toHaveBeenCalled();
  });

  it('lets the thread author resolve a comment and records the resolver', async () => {
    const commentId = 'c2d78b51-c579-4e5f-9f00-f4a7abfd036c';
    const resolvedAt = new Date('2026-10-11T10:00:00.000Z');
    prismaMock.workspaceMember.findUnique.mockResolvedValue({ id: 'member-row', role: 'COMMENTER', workspace: { deletedAt: null, archivedAt: null } });
    prismaMock.dashboard.findFirst.mockResolvedValue({ id: dashboardId, workspaceId, status: 'DRAFT' });
    prismaMock.dashboardComment.findFirst.mockResolvedValue({ id: commentId, dashboardId, authorId: userId, parentId: null, deletedAt: null });
    prismaMock.dashboardComment.update.mockResolvedValue({
      id: commentId, dashboardId, authorId: userId, parentId: null, body: 'Resolved issue.', resolvedAt,
      resolvedBy: { id: userId, displayName: 'Workspace Member' },
      createdAt: resolvedAt, updatedAt: resolvedAt, author: { id: userId, displayName: 'Workspace Member', avatarUrl: null },
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/dashboards/${dashboardId}/comments/${commentId}/resolution`,
      headers: { cookie: 'voxel_access=test-session' },
      payload: { resolved: true },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ resolvedAt: resolvedAt.toISOString(), resolvedBy: { id: userId } });
    expect(prismaMock.dashboardComment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: commentId }, data: { resolvedAt: expect.any(Date), resolvedById: userId },
    }));
  });

  it('lets commenters edit only their own comments', async () => {
    const otherUserId = '6e6bfcf1-491a-4d5e-b7e4-d9be93209533';
    prismaMock.workspaceMember.findUnique.mockResolvedValue({
      id: 'member-row', role: 'COMMENTER', workspace: { deletedAt: null, archivedAt: null },
    });
    prismaMock.dashboard.findFirst.mockResolvedValue({ id: dashboardId, workspaceId, status: 'DRAFT' });
    prismaMock.dashboardComment.findFirst.mockResolvedValue({
      id: 'c2d78b51-c579-4e5f-9f00-f4a7abfd036c', dashboardId, authorId: otherUserId, body: 'Original comment', deletedAt: null,
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/dashboards/${dashboardId}/comments/c2d78b51-c579-4e5f-9f00-f4a7abfd036c`,
      headers: { cookie: 'voxel_access=test-session' },
      payload: { body: 'Changed by someone else' },
    });

    expect(response.statusCode).toBe(403);
    expect(prismaMock.dashboardComment.update).not.toHaveBeenCalled();
  });

  it('lets the comment author edit their own comment', async () => {
    const now = new Date('2026-10-11T10:00:00.000Z');
    prismaMock.workspaceMember.findUnique.mockResolvedValue({
      id: 'member-row', role: 'COMMENTER', workspace: { deletedAt: null, archivedAt: null },
    });
    prismaMock.dashboard.findFirst.mockResolvedValue({ id: dashboardId, workspaceId, status: 'DRAFT' });
    prismaMock.dashboardComment.findFirst.mockResolvedValue({
      id: 'c2d78b51-c579-4e5f-9f00-f4a7abfd036c', dashboardId, authorId: userId, body: 'Original comment', deletedAt: null,
    });
    prismaMock.dashboardComment.update.mockResolvedValue({
      id: 'c2d78b51-c579-4e5f-9f00-f4a7abfd036c', dashboardId, authorId: userId,
      body: 'Updated comment', deletedAt: null, createdAt: now, updatedAt: now,
      author: { id: userId, displayName: 'Workspace Member', avatarUrl: null },
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/dashboards/${dashboardId}/comments/c2d78b51-c579-4e5f-9f00-f4a7abfd036c`,
      headers: { cookie: 'voxel_access=test-session' },
      payload: { body: 'Updated comment' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.body).toBe('Updated comment');
    expect(prismaMock.dashboardComment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'c2d78b51-c579-4e5f-9f00-f4a7abfd036c' },
      data: { body: 'Updated comment' },
    }));
  });

  it('soft-deletes an author comment and keeps the discussion record', async () => {
    prismaMock.workspaceMember.findUnique.mockResolvedValue({
      id: 'member-row', role: 'COMMENTER', workspace: { deletedAt: null, archivedAt: null },
    });
    prismaMock.dashboard.findFirst.mockResolvedValue({ id: dashboardId, workspaceId, status: 'DRAFT' });
    prismaMock.dashboardComment.findFirst.mockResolvedValue({
      id: 'c2d78b51-c579-4e5f-9f00-f4a7abfd036c', dashboardId, authorId: userId, body: 'Remove this', deletedAt: null,
    });
    prismaMock.dashboardComment.update.mockResolvedValue({});

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/dashboards/${dashboardId}/comments/c2d78b51-c579-4e5f-9f00-f4a7abfd036c`,
      headers: { cookie: 'voxel_access=test-session' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ id: 'c2d78b51-c579-4e5f-9f00-f4a7abfd036c', deletedAt: expect.any(String) });
    expect(prismaMock.dashboardComment.update).toHaveBeenCalledWith({
      where: { id: 'c2d78b51-c579-4e5f-9f00-f4a7abfd036c' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('returns the newest workspace comments with dashboard context', async () => {
    const createdAt = new Date('2026-10-11T10:00:00.000Z');
    prismaMock.dashboardComment.findMany.mockResolvedValue([{
      id: '93283d61-9de9-49b9-81f1-7a0271c6a6c1', dashboardId, body: 'Fresh update', deletedAt: null, createdAt, updatedAt: createdAt,
      author: { id: userId, displayName: 'Workspace Member', avatarUrl: null, email: 'private@example.com' },
      dashboard: { id: dashboardId, name: 'Launch metrics' },
    }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${workspaceId}/comments`,
      headers: { cookie: 'voxel_access=test-session' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data[0]).toMatchObject({
      id: '93283d61-9de9-49b9-81f1-7a0271c6a6c1',
      body: 'Fresh update',
      dashboard: { id: dashboardId, name: 'Launch metrics' },
      author: { displayName: 'Workspace Member' },
    });
    expect(response.json().data[0].author).not.toHaveProperty('email');
    expect(prismaMock.dashboardComment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { deletedAt: null, dashboard: { workspaceId, deletedAt: null } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }));
  });
});
