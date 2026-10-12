import { z } from 'zod';
import { createRequestId, widgetPluginCatalog } from '@voxel/contracts';
import { AuthService } from '../auth/auth-service.js';
import { prisma } from '../../database/prisma.js';
import { success } from '../../lib/api-response.js';
import { runSerializableTransaction } from '../../lib/serializable-transaction.js';

class RequestError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const idSchema = z.string().uuid();
const pluginById = new Map(widgetPluginCatalog.map((plugin) => [plugin.id, plugin]));

const requireUser = async (request, auth) => {
  const user = await auth.getAuthenticatedUser(request.cookies.voxel_access);
  if (!user) throw new RequestError('Authentication is required.', 401);
  return user;
};

const requireMembership = async (workspaceId, userId, roles) => {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: { select: { archivedAt: true, deletedAt: true } } },
  });
  if (!membership || !roles.includes(membership.role)) {
    throw new RequestError('You do not have permission to access this workspace.', 403);
  }
  if (membership.workspace.archivedAt || membership.workspace.deletedAt) {
    throw new RequestError('This workspace is archived or no longer available.', 404);
  }
  return membership;
};

const serializeInstalledPlugin = (record) => {
  const plugin = pluginById.get(record.pluginId);
  return {
    id: record.pluginId,
    version: plugin?.version ?? record.version,
    installedVersion: record.version,
    name: plugin?.name ?? record.pluginId,
    author: plugin?.author ?? 'Unknown publisher',
    category: plugin?.category ?? 'Unavailable',
    description: plugin?.description ?? 'This extension is no longer available in the catalog.',
    permissions: plugin?.permissions ?? [],
    widgets: plugin?.widgets ?? [],
    compatible: Boolean(plugin && plugin.version === record.version),
    installedAt: record.installedAt.toISOString(),
  };
};

export const registerPluginRoutes = async (app, environment) => {
  const auth = new AuthService(prisma, environment);

  app.get('/api/v1/marketplace/plugins', async (request, reply) => {
    await requireUser(request, auth);
    return reply.send(success(widgetPluginCatalog, createRequestId(request.id)));
  });

  app.get('/api/v1/workspaces/:workspaceId/plugins', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    await requireMembership(params.workspaceId, user.id, [
      'OWNER',
      'ADMIN',
      'EDITOR',
      'COMMENTER',
      'VIEWER',
    ]);
    const installed = await prisma.workspacePlugin.findMany({
      where: { workspaceId: params.workspaceId },
      orderBy: { installedAt: 'asc' },
    });
    return reply.send(
      success(installed.map(serializeInstalledPlugin), createRequestId(request.id)),
    );
  });

  app.post('/api/v1/workspaces/:workspaceId/plugins', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN']);
    const input = z.object({ pluginId: z.string().trim().min(3).max(120) }).parse(request.body);
    const plugin = pluginById.get(input.pluginId);
    if (!plugin) throw new RequestError('This extension is not in the Voxel catalog.', 404);

    try {
      const installed = await prisma.$transaction(async (transaction) => {
        const record = await transaction.workspacePlugin.create({
          data: {
            workspaceId: params.workspaceId,
            pluginId: plugin.id,
            version: plugin.version,
            widgetTypes: plugin.widgets.map((widget) => widget.type),
            installedById: user.id,
          },
        });
        await transaction.auditEvent.create({
          data: {
            actorId: user.id,
            workspaceId: params.workspaceId,
            action: 'plugin.installed',
            resourceType: 'workspace_plugin',
            resourceId: record.id,
            after: { pluginId: plugin.id, version: plugin.version },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          },
        });
        return record;
      });
      return reply
        .status(201)
        .send(success(serializeInstalledPlugin(installed), createRequestId(request.id)));
    } catch (error) {
      if (error?.code === 'P2002') {
        throw new RequestError('This extension is already installed in the workspace.', 409);
      }
      throw error;
    }
  });

  app.delete('/api/v1/workspaces/:workspaceId/plugins/:pluginId', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z
      .object({ workspaceId: idSchema, pluginId: z.string().min(3).max(120) })
      .parse(request.params);
    await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN']);
    const plugin = pluginById.get(params.pluginId);
    const installed = await runSerializableTransaction(prisma, async (transaction) => {
      const record = await transaction.workspacePlugin.findUnique({
        where: {
          workspaceId_pluginId: { workspaceId: params.workspaceId, pluginId: params.pluginId },
        },
      });
      if (!record) throw new RequestError('This extension is not installed in the workspace.', 404);

      const widgetTypes = new Set([
        ...(record.widgetTypes ?? []),
        ...(plugin?.widgets ?? []).map((widget) => widget.type),
      ]);
      if (widgetTypes.size > 0) {
        const [dashboards, templates] = await Promise.all([
          transaction.dashboard.findMany({
            where: { workspaceId: params.workspaceId },
            select: { id: true, name: true, scene: true },
          }),
          transaction.dashboardTemplate.findMany({
            where: { workspaceId: params.workspaceId },
            select: { id: true, name: true, scene: true },
          }),
        ]);
        const dashboardInUse = dashboards.find(
          (dashboard) =>
            Array.isArray(dashboard.scene?.nodes) &&
            dashboard.scene.nodes.some((node) => widgetTypes.has(node?.type)),
        );
        if (dashboardInUse) {
          throw new RequestError(
            `Remove this extension’s widgets from dashboard “${dashboardInUse.name}” before uninstalling it.`,
            409,
          );
        }
        const templateInUse = templates.find(
          (template) =>
            Array.isArray(template.scene?.nodes) &&
            template.scene.nodes.some((node) => widgetTypes.has(node?.type)),
        );
        if (templateInUse) {
          throw new RequestError(
            `Remove this extension’s widgets from template “${templateInUse.name}” before uninstalling it.`,
            409,
          );
        }
      }

      await transaction.workspacePlugin.delete({ where: { id: record.id } });
      await transaction.auditEvent.create({
        data: {
          actorId: user.id,
          workspaceId: params.workspaceId,
          action: 'plugin.uninstalled',
          resourceType: 'workspace_plugin',
          resourceId: record.id,
          before: { pluginId: record.pluginId, version: record.version },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      });
      return record;
    });
    return reply.send(
      success({ id: installed.pluginId, removed: true }, createRequestId(request.id)),
    );
  });
};
