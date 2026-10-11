import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { createRequestId } from '@voxel/contracts';
import { success } from '../../lib/api-response.js';
import { AuthService } from '../auth/auth-service.js';

const notificationIdSchema = z.string().uuid();

class NotificationRequestError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const serializeNotification = (notification) => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  payload: notification.payload && typeof notification.payload === 'object' ? notification.payload : {},
  read: Boolean(notification.readAt),
  readAt: notification.readAt?.toISOString() ?? null,
  archivedAt: notification.archivedAt?.toISOString() ?? null,
  createdAt: notification.createdAt.toISOString(),
  actor: notification.actor ? {
    displayName: notification.actor.displayName,
    avatarUrl: notification.actor.avatarUrl,
  } : null,
});

export async function registerNotificationRoutes(app, environment) {
  const auth = new AuthService(prisma, environment);
  const requireUser = async (request) => {
    const user = await auth.getAuthenticatedUser(request.cookies.voxel_access);
    if (!user) throw new NotificationRequestError('Authentication is required.', 401);
    return user;
  };

  app.get('/api/v1/notifications', async (request, reply) => {
    const user = await requireUser(request);
    const query = z.object({
      scope: z.enum(['all', 'unread', 'archived']).default('all'),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }).parse(request.query);
    const where = {
      userId: user.id,
      deletedAt: null,
      ...(query.scope === 'archived' ? { archivedAt: { not: null } } : { archivedAt: null }),
      ...(query.scope === 'unread' ? { readAt: null } : {}),
    };
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: { actor: { select: { displayName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
      }),
      prisma.notification.count({
        where: { userId: user.id, deletedAt: null, archivedAt: null, readAt: null },
      }),
    ]);
    return reply.send(success({ items: items.map(serializeNotification), unreadCount }, createRequestId(request.id)));
  });

  app.patch('/api/v1/notifications/:notificationId', async (request, reply) => {
    const user = await requireUser(request);
    const { notificationId } = z.object({ notificationId: notificationIdSchema }).parse(request.params);
    const input = z.object({ read: z.boolean().optional(), archived: z.boolean().optional() })
      .refine((value) => Object.keys(value).length > 0, 'Choose a notification state to update.')
      .parse(request.body);
    const now = new Date();
    const data = {
      ...(input.read !== undefined ? { readAt: input.read ? now : null } : {}),
      ...(input.archived !== undefined ? { archivedAt: input.archived ? now : null } : {}),
    };
    const updated = await prisma.notification.updateMany({
      where: { id: notificationId, userId: user.id, deletedAt: null },
      data,
    });
    if (updated.count !== 1) throw new NotificationRequestError('Notification was not found.', 404);
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId: user.id, deletedAt: null },
      include: { actor: { select: { displayName: true, avatarUrl: true } } },
    });
    return reply.send(success(serializeNotification(notification), createRequestId(request.id)));
  });

  app.post('/api/v1/notifications/read-all', async (request, reply) => {
    const user = await requireUser(request);
    const updated = await prisma.notification.updateMany({
      where: { userId: user.id, deletedAt: null, archivedAt: null, readAt: null },
      data: { readAt: new Date() },
    });
    return reply.send(success({ updatedCount: updated.count }, createRequestId(request.id)));
  });

  app.post('/api/v1/notifications/archive-all', async (request, reply) => {
    const user = await requireUser(request);
    const updated = await prisma.notification.updateMany({
      where: { userId: user.id, deletedAt: null, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    return reply.send(success({ updatedCount: updated.count }, createRequestId(request.id)));
  });

  app.delete('/api/v1/notifications/:notificationId', async (request, reply) => {
    const user = await requireUser(request);
    const { notificationId } = z.object({ notificationId: notificationIdSchema }).parse(request.params);
    const deleted = await prisma.notification.updateMany({
      where: { id: notificationId, userId: user.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (deleted.count !== 1) throw new NotificationRequestError('Notification was not found.', 404);
    return reply.send(success({ deleted: true }, createRequestId(request.id)));
  });
}
