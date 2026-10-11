import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { ZodError } from 'zod';

const { prismaMock, userId } = vi.hoisted(() => ({
  userId: '1b0e3ced-1d40-4a2a-a819-59c2250872bd',
  prismaMock: {
    notification: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock('../../database/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../auth/auth-service.js', () => ({
  AuthService: class {
    async getAuthenticatedUser() {
      return { id: userId, displayName: 'Workspace Member' };
    }
  },
}));

const { registerNotificationRoutes } = await import('./notification-routes.js');

const notificationId = 'c2d78b51-c579-4e5f-9f00-f4a7abfd036c';
let app;

beforeEach(async () => {
  vi.clearAllMocks();
  app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) => reply.status(error instanceof ZodError ? 422 : error.statusCode || 500).send({ error: error.message }));
  await app.register(cookie);
  await registerNotificationRoutes(app, {});
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('persistent notifications', () => {
  it('lists only the authenticated user’s unread inbox and a separate unread count', async () => {
    const createdAt = new Date('2026-10-11T10:00:00.000Z');
    prismaMock.notification.findMany.mockResolvedValue([{
      id: notificationId,
      type: 'collaboration.comment',
      title: 'New dashboard comment',
      message: 'A teammate left a comment.',
      payload: { workspaceId: 'workspace-1', dashboardId: 'dashboard-1' },
      readAt: null,
      archivedAt: null,
      createdAt,
      actor: { displayName: 'Casey', avatarUrl: null, email: 'private@example.com' },
    }]);
    prismaMock.notification.count.mockResolvedValue(2);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications?scope=unread',
      headers: { cookie: 'voxel_access=test-session' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ unreadCount: 2, items: [{ id: notificationId, read: false, actor: { displayName: 'Casey' } }] });
    expect(response.json().data.items[0].actor).not.toHaveProperty('email');
    expect(prismaMock.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId, deletedAt: null, archivedAt: null, readAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }));
    expect(prismaMock.notification.count).toHaveBeenCalledWith({
      where: { userId, deletedAt: null, archivedAt: null, readAt: null },
    });
  });

  it('does not allow a user to update another user’s notification', async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 0 });

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/${notificationId}`,
      headers: { cookie: 'voxel_access=test-session' },
      payload: { read: true },
    });

    expect(response.statusCode).toBe(404);
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: notificationId, userId, deletedAt: null },
    }));
  });

  it('marks all active unread notifications as read for the authenticated user', async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 3 });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/read-all',
      headers: { cookie: 'voxel_access=test-session' },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({ updatedCount: 3 });
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId, deletedAt: null, archivedAt: null, readAt: null },
      data: { readAt: expect.any(Date) },
    }));
  });

  it('archives and deletes only notifications owned by the current user', async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.notification.findFirst.mockResolvedValue({
      id: notificationId,
      type: 'system',
      title: 'A notice',
      message: 'An update is available.',
      payload: {},
      readAt: null,
      archivedAt: new Date('2026-10-11T10:00:00.000Z'),
      createdAt: new Date('2026-10-11T09:00:00.000Z'),
      actor: null,
    });
    const archived = await app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/${notificationId}`,
      headers: { cookie: 'voxel_access=test-session' },
      payload: { archived: true },
    });
    expect(archived.statusCode).toBe(200);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/v1/notifications/${notificationId}`,
      headers: { cookie: 'voxel_access=test-session' },
    });
    expect(deleted.statusCode).toBe(200);
    expect(prismaMock.notification.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: notificationId, userId, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    }));
  });
});
