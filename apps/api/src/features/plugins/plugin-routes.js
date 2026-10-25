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
const compareVersions = (left, right) => {
  const parse = (version) => {
    const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
    return match ? match.slice(1).map(Number) : null;
  };
  const leftParts = parse(left);
  const rightParts = parse(right);
  if (!leftParts || !rightParts) return null;
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] > rightParts[index] ? 1 : -1;
  }
  return 0;
};

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
    updateAvailable: Boolean(plugin && compareVersions(record.version, plugin.version) === -1),
    installedAt: record.installedAt.toISOString(),
  };
};

export const registerPluginRoutes = async (app, environment) => {
  const auth = new AuthService(prisma, environment);

  app.get('/api/v1/marketplace/plugins', async (request, reply) => {
    const user = await requireUser(request, auth);
    const [installTotals, ratingTotals, userRatings] = await Promise.all([
      prisma.widgetPluginInstall.groupBy({
        by: ['pluginId'],
        _count: { _all: true },
      }),
      prisma.widgetPluginReview.groupBy({
        by: ['pluginId'],
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.widgetPluginReview.findMany({
        where: { userId: user.id },
        select: { pluginId: true, rating: true },
      }),
    ]);
    const installsById = new Map(
      installTotals.map((entry) => [entry.pluginId, entry._count._all]),
    );
    const ratingsById = new Map(ratingTotals.map((entry) => [entry.pluginId, entry]));
    const userRatingById = new Map(userRatings.map((entry) => [entry.pluginId, entry.rating]));
    const catalog = widgetPluginCatalog.map((plugin) => {
      const rating = ratingsById.get(plugin.id);
      return {
        ...plugin,
        installCount: installsById.get(plugin.id) ?? 0,
        ratingAverage: rating?._avg.rating
          ? Math.round(rating._avg.rating * 10) / 10
          : null,
        ratingCount: rating?._count._all ?? 0,
        myRating: userRatingById.get(plugin.id) ?? null,
      };
    });
    return reply.send(success(catalog, createRequestId(request.id)));
  });

  app.put('/api/v1/workspaces/:workspaceId/plugins/:pluginId/rating', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z
      .object({ workspaceId: idSchema, pluginId: z.string().min(3).max(120) })
      .parse(request.params);
    await requireMembership(params.workspaceId, user.id, [
      'OWNER',
      'ADMIN',
      'EDITOR',
      'COMMENTER',
      'VIEWER',
    ]);
    if (!pluginById.has(params.pluginId)) {
      throw new RequestError('This extension is not in the Voxel catalog.', 404);
    }
    const input = z.object({ rating: z.number().int().min(1).max(5) }).parse(request.body);
    const installation = await prisma.workspacePlugin.findUnique({
      where: {
        workspaceId_pluginId: { workspaceId: params.workspaceId, pluginId: params.pluginId },
      },
      select: { id: true },
    });
    if (!installation) {
      throw new RequestError('Install this widget pack in the workspace before rating it.', 409);
    }

    await runSerializableTransaction(prisma, async (transaction) => {
      await transaction.widgetPluginReview.upsert({
        where: { pluginId_userId: { pluginId: params.pluginId, userId: user.id } },
        create: { pluginId: params.pluginId, userId: user.id, rating: input.rating },
        update: { rating: input.rating },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: user.id,
          workspaceId: params.workspaceId,
          action: 'plugin.rated',
          resourceType: 'widget_plugin',
          resourceId: params.pluginId,
          after: { rating: input.rating },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      });
    });

    const [rating] = await prisma.widgetPluginReview.groupBy({
      by: ['pluginId'],
      where: { pluginId: params.pluginId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return reply.send(
      success(
        {
          pluginId: params.pluginId,
          myRating: input.rating,
          ratingAverage: Math.round((rating?._avg.rating ?? input.rating) * 10) / 10,
          ratingCount: rating?._count._all ?? 1,
        },
        createRequestId(request.id),
      ),
    );
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
        await transaction.widgetPluginInstall.create({
          data: {
            pluginId: plugin.id,
            version: plugin.version,
            workspaceId: params.workspaceId,
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

  app.put('/api/v1/workspaces/:workspaceId/plugins/:pluginId', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z
      .object({ workspaceId: idSchema, pluginId: z.string().min(3).max(120) })
      .parse(request.params);
    await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN']);
    const plugin = pluginById.get(params.pluginId);
    if (!plugin) throw new RequestError('This extension is no longer in the Voxel catalog.', 404);

    const updated = await runSerializableTransaction(prisma, async (transaction) => {
      const record = await transaction.workspacePlugin.findUnique({
        where: {
          workspaceId_pluginId: { workspaceId: params.workspaceId, pluginId: params.pluginId },
        },
      });
      if (!record) throw new RequestError('This extension is not installed in the workspace.', 404);
      const versionOrder = compareVersions(record.version, plugin.version);
      if (versionOrder === 0) {
        throw new RequestError('This extension is already up to date.', 409);
      }
      if (versionOrder === null) {
        throw new RequestError('This extension has an invalid version and cannot be updated safely.', 409);
      }
      if (versionOrder > 0) {
        throw new RequestError('The installed extension is newer than the catalog; downgrade was blocked.', 409);
      }

      const latestWidgetTypes = new Set(plugin.widgets.map((widget) => widget.type));
      const removedWidgetTypes = (record.widgetTypes ?? []).filter(
        (widgetType) => !latestWidgetTypes.has(widgetType),
      );
      if (removedWidgetTypes.length > 0) {
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
        const removedTypes = new Set(removedWidgetTypes);
        const dashboardInUse = dashboards.find(
          (dashboard) =>
            Array.isArray(dashboard.scene?.nodes) &&
            dashboard.scene.nodes.some((node) => removedTypes.has(node?.type)),
        );
        if (dashboardInUse) {
          throw new RequestError(
            `Remove this extension’s retired widgets from dashboard “${dashboardInUse.name}” before updating it.`,
            409,
          );
        }
        const templateInUse = templates.find(
          (template) =>
            Array.isArray(template.scene?.nodes) &&
            template.scene.nodes.some((node) => removedTypes.has(node?.type)),
        );
        if (templateInUse) {
          throw new RequestError(
            `Remove this extension’s retired widgets from template “${templateInUse.name}” before updating it.`,
            409,
          );
        }
      }

      const result = await transaction.workspacePlugin.update({
        where: { id: record.id },
        data: { version: plugin.version, widgetTypes: [...latestWidgetTypes] },
      });
      await transaction.auditEvent.create({
        data: {
          actorId: user.id,
          workspaceId: params.workspaceId,
          action: 'plugin.updated',
          resourceType: 'workspace_plugin',
          resourceId: record.id,
          before: { pluginId: record.pluginId, version: record.version },
          after: { pluginId: plugin.id, version: plugin.version },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      });
      return result;
    });
    return reply.send(success(serializeInstalledPlugin(updated), createRequestId(request.id)));
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
