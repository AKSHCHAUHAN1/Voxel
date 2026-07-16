import { z } from 'zod';
import { createRequestId } from '@voxel/contracts';
import { prisma } from '../../database/prisma.js';
import { AuthService } from '../auth/auth-service.js';
import { success } from '../../lib/api-response.js';

class RequestError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const idSchema = z.string().uuid();
const workspaceInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(280).optional(),
  icon: z.string().trim().min(1).max(32).default('grid'),
  accentColor: z.string().trim().min(1).max(32).default('violet'),
});
const dashboardInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(280).optional(),
});
const dashboardUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(280).nullable().optional(),
  scene: z
    .object({ schemaVersion: z.number().int().positive(), nodes: z.array(z.unknown()) })
    .optional(),
  version: z.number().int().positive(),
});

const slugify = (value) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const uniqueSlug = (value) =>
  `${slugify(value) || 'untitled'}-${crypto.randomUUID().slice(0, 8)}`;

const requireUser = async (request, auth) => {
  const user = await auth.getAuthenticatedUser(request.cookies.voxel_access);
  if (!user) throw new RequestError('Authentication is required.', 401);
  return user;
};

const requireMembership = async (
  workspaceId,
  userId,
  roles,
) => {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!membership || !roles.includes(membership.role)) {
    throw new RequestError('You do not have permission to access this workspace.', 403);
  }
};

const serializeDashboard = (dashboard) => ({
  id: dashboard.id,
  workspaceId: dashboard.workspaceId,
  name: dashboard.name,
  description: dashboard.description,
  status: dashboard.status,
  scene: dashboard.scene,
  version: dashboard.version,
  createdAt: dashboard.createdAt.toISOString(),
  updatedAt: dashboard.updatedAt.toISOString(),
});

export const registerWorkspaceRoutes = async (
  app,
  environment,
) => {
  const auth = new AuthService(prisma, environment);

  app.get('/api/v1/workspaces', async (request, reply) => {
    const user = await requireUser(request, auth);
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id, workspace: { deletedAt: null } },
      include: { workspace: true },
      orderBy: { workspace: { updatedAt: 'desc' } },
    });
    return reply.send(
      success(
        memberships.map(({ role, workspace }) => ({
          id: workspace.id,
          name: workspace.name,
          description: workspace.description,
          icon: workspace.icon,
          accentColor: workspace.accentColor,
          role,
          updatedAt: workspace.updatedAt.toISOString(),
        })),
        createRequestId(request.id),
      ),
    );
  });

  app.post('/api/v1/workspaces', async (request, reply) => {
    const user = await requireUser(request, auth);
    const input = workspaceInputSchema.parse(request.body);
    const workspace = await prisma.workspace.create({
      data: {
        ownerId: user.id,
        name: input.name,
        slug: uniqueSlug(input.name),
        ...(input.description ? { description: input.description } : {}),
        icon: input.icon,
        accentColor: input.accentColor,
        members: { create: { userId: user.id, role: 'OWNER' } },
      },
    });
    return reply.status(201).send(success(workspace, createRequestId(request.id)));
  });

  app.get('/api/v1/workspaces/:workspaceId/dashboards', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    await requireMembership(params.workspaceId, user.id, [
      'OWNER',
      'ADMIN',
      'EDITOR',
      'COMMENTER',
      'VIEWER',
    ]);
    const dashboards = await prisma.dashboard.findMany({
      where: { workspaceId: params.workspaceId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    return reply.send(success(dashboards.map(serializeDashboard), createRequestId(request.id)));
  });

  app.post('/api/v1/workspaces/:workspaceId/dashboards', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    const input = dashboardInputSchema.parse(request.body);
    await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR']);
    const dashboard = await prisma.dashboard.create({
      data: {
        workspaceId: params.workspaceId,
        ownerId: user.id,
        name: input.name,
        slug: uniqueSlug(input.name),
        ...(input.description ? { description: input.description } : {}),
        scene: { schemaVersion: 1, nodes: [] },
      },
    });
    return reply
      .status(201)
      .send(success(serializeDashboard(dashboard), createRequestId(request.id)));
  });

  app.get('/api/v1/dashboards/:dashboardId', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ dashboardId: idSchema }).parse(request.params);
    const dashboard = await prisma.dashboard.findFirst({
      where: { id: params.dashboardId, deletedAt: null },
    });
    if (!dashboard) throw new RequestError('Dashboard was not found.', 404);
    await requireMembership(dashboard.workspaceId, user.id, [
      'OWNER',
      'ADMIN',
      'EDITOR',
      'COMMENTER',
      'VIEWER',
    ]);
    return reply.send(success(serializeDashboard(dashboard), createRequestId(request.id)));
  });

  app.patch('/api/v1/dashboards/:dashboardId', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ dashboardId: idSchema }).parse(request.params);
    const input = dashboardUpdateSchema.parse(request.body);
    const dashboard = await prisma.dashboard.findFirst({
      where: { id: params.dashboardId, deletedAt: null },
    });
    if (!dashboard) throw new RequestError('Dashboard was not found.', 404);
    await requireMembership(dashboard.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR']);
    if (input.version !== dashboard.version)
      throw new RequestError('Dashboard changed elsewhere. Refresh and retry.', 412);

    const data = {
      version: { increment: 1 },
      ...(input.name ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.scene ? { scene: input.scene } : {}),
    };
    const updated = await prisma.$transaction(async (transaction) => {
      const next = await transaction.dashboard.update({ where: { id: dashboard.id }, data });
      await transaction.dashboardVersion.create({
        data: {
          dashboardId: next.id,
          version: next.version,
          scene: next.scene,
        },
      });
      return next;
    });
    return reply.send(success(serializeDashboard(updated), createRequestId(request.id)));
  });

  app.patch('/api/v1/workspaces/:workspaceId', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    const input = z
      .object({
        name: z.string().trim().min(2).max(80).optional(),
        description: z.string().trim().max(280).nullable().optional(),
      })
      .parse(request.body);

    await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR']);

    const updated = await prisma.workspace.update({
      where: { id: params.workspaceId },
      data: {
        ...(input.name ? { name: input.name, slug: uniqueSlug(input.name) } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });
    return reply.send(success(updated, createRequestId(request.id)));
  });

  app.delete('/api/v1/workspaces/:workspaceId', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);

    await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR']);

    const deleted = await prisma.workspace.update({
      where: { id: params.workspaceId },
      data: { deletedAt: new Date() },
    });
    return reply.send(success({ id: deleted.id, deleted: true }, createRequestId(request.id)));
  });

  app.delete('/api/v1/dashboards/:dashboardId', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ dashboardId: idSchema }).parse(request.params);
    const dashboard = await prisma.dashboard.findFirst({
      where: { id: params.dashboardId, deletedAt: null },
    });
    if (!dashboard) throw new RequestError('Dashboard was not found.', 404);
    await requireMembership(dashboard.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR']);
    const deleted = await prisma.dashboard.update({
      where: { id: dashboard.id },
      data: { deletedAt: new Date() },
    });
    return reply.send(success({ id: deleted.id, deleted: true }, createRequestId(request.id)));
  });
};
