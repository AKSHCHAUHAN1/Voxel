import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import {
  createRequestId,
  getWidgetPluginForType,
  validatePluginWidgetConfiguration,
  widgetPluginCatalog,
} from '@voxel/contracts';
import { prisma } from '../../database/prisma.js';
import { runSerializableTransaction } from '../../lib/serializable-transaction.js';
import { AuthService } from '../auth/auth-service.js';
import { createWorkspaceInviteUrl, sendWorkspaceInviteEmail } from '../auth/email-delivery.js';
import { notifyMentionedUsers, notifyVerifiedUserByEmail, notifyWorkspaceMembers } from '../notifications/notification-service.js';
import { success } from '../../lib/api-response.js';

class RequestError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const idSchema = z.string().uuid();
const TRASH_RETENTION_DAYS = 30;
const workspaceInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(280).optional(),
  icon: z.string().trim().min(1).max(32).default('grid'),
  accentColor: z.string().trim().min(1).max(32).default('violet'),
});
const workspaceUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(280).nullable().optional(),
  icon: z.string().trim().min(1).max(32).optional(),
  accentColor: z.string().trim().min(1).max(32).optional(),
}).refine((input) => Object.keys(input).length > 0, 'At least one workspace field is required.');
const dashboardInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(280).optional(),
});
const widgetNodeSchema = z.record(z.string(), z.unknown()).superRefine((node, context) => {
  for (const field of ['id', 'type']) {
    if (node[field] !== undefined && (typeof node[field] !== 'string' || node[field].length > 160)) {
      context.addIssue({ code: 'custom', path: [field], message: `${field} must be a string of at most 160 characters.` });
    }
  }
  if (node.title !== undefined && (typeof node.title !== 'string' || node.title.length > 160)) {
    context.addIssue({ code: 'custom', path: ['title'], message: 'Widget titles must be at most 160 characters.' });
  }
  for (const field of ['x', 'y']) {
    if (node[field] !== undefined && (typeof node[field] !== 'number' || !Number.isFinite(node[field]) || Math.abs(node[field]) > 100000)) {
      context.addIssue({ code: 'custom', path: [field], message: `Widget ${field} must be a finite coordinate in range.` });
    }
  }
  for (const field of ['customWidth', 'customHeight']) {
    if (node[field] !== undefined && (typeof node[field] !== 'number' || !Number.isFinite(node[field]) || node[field] < 100 || node[field] > 5000)) {
      context.addIssue({ code: 'custom', path: [field], message: `Widget ${field} must be between 100 and 5000 pixels.` });
    }
  }
});
const dashboardSceneSchema = z.object({
  schemaVersion: z.number().int().positive(),
  nodes: z.array(widgetNodeSchema).max(1000),
  connections: z.array(z.object({ fromId: z.string().min(1).max(160), toId: z.string().min(1).max(160), style: z.string().max(32).optional() }).passthrough()).max(5000).optional(),
  gridStyle: z.enum(['dots', 'lines', 'radial', 'blank']).optional(),
  gridSize: z.number().finite().min(8).max(100).optional(),
  gridOpacity: z.number().finite().min(0).max(0.5).optional(),
  gridThickness: z.number().finite().min(0.25).max(4).optional(),
  gridColorPreset: z.enum(['slate', 'blue', 'violet', 'indigo', 'cyan', 'rose', 'emerald']).optional(),
}).passthrough();
const dashboardImportSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(280).optional(),
  scene: dashboardSceneSchema,
});
const dashboardUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(280).nullable().optional(),
  scene: dashboardSceneSchema.optional(),
  version: z.number().int().positive(),
});
const dashboardCommentAnchorSchema = z.object({
  type: z.enum(['node', 'selection']),
  nodeIds: z.array(z.string().trim().min(1).max(160)).min(1).max(50),
  label: z.string().trim().max(200).optional(),
}).superRefine((anchor, context) => {
  const expectedLength = anchor.type === 'node' ? 1 : anchor.nodeIds.length > 1;
  if (!expectedLength) context.addIssue({ code: 'custom', path: ['nodeIds'], message: 'Node anchors need one node and selection anchors need at least two.' });
});
const dashboardCommentInputSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  parentId: idSchema.optional(),
  anchor: dashboardCommentAnchorSchema.optional(),
});

const slugify = (value) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const uniqueSlug = (value) =>
  `${slugify(value) || 'untitled'}-${crypto.randomUUID().slice(0, 8)}`;
const createOpaqueToken = () => randomBytes(32).toString('base64url');
const tokenDigest = (token) => createHash('sha256').update(token).digest('hex');
const jsonSafeValue = (value) => JSON.parse(JSON.stringify(value, (_key, item) => (
  typeof item === 'bigint' ? item.toString() : item
)));
const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};
const sceneForReadOnlyShare = (scene) => {
  if (!scene || !Array.isArray(scene.nodes)) return scene;
  return {
    ...scene,
    nodes: scene.nodes.map((node) => {
      if (!node || typeof node !== 'object' || !['workspace-file', 'rest-api'].includes(node.valueSource)) return node;
      const safeNode = { ...node };
      delete safeNode.dataSourceFileId;
      delete safeNode.dataSourceUrl;
      delete safeNode.dataSourceField;
      delete safeNode.dataRefreshInterval;
      return safeNode;
    }),
  };
};

const requireUser = async (request, auth) => {
  const user = await auth.getAuthenticatedUser(request.cookies.voxel_access);
  if (!user) throw new RequestError('Authentication is required.', 401);
  return user;
};

const requireMembership = async (workspaceId, userId, roles, { allowArchived = false, allowDeleted = false } = {}) => {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: { select: { deletedAt: true, archivedAt: true } } },
  });
  if (!membership || !roles.includes(membership.role)) {
    throw new RequestError('You do not have permission to access this workspace.', 403);
  }
  if ((membership.workspace.deletedAt && !allowDeleted) || (membership.workspace.archivedAt && !allowArchived)) {
    throw new RequestError('This workspace is archived or no longer available.', 404);
  }
  return membership;
};

const validateInstalledPluginNodes = async (workspaceId, scene, database = prisma) => {
  const requiredPlugins = new Map();
  for (const node of scene?.nodes ?? []) {
    if (typeof node?.type !== 'string' || !node.type.startsWith('voxel.')) continue;
    const plugin = getWidgetPluginForType(node.type);
    if (!plugin) throw new RequestError(`Widget type “${node.type}” is not in the Voxel catalog.`, 422);
    const widget = plugin.widgets.find((definition) => definition.type === node.type);
    const configurationError = validatePluginWidgetConfiguration(widget, node);
    if (configurationError) throw new RequestError(configurationError, 422);
    requiredPlugins.set(plugin.id, plugin);
  }
  if (requiredPlugins.size === 0) return;

  const installed = await database.workspacePlugin.findMany({
    where: { workspaceId, pluginId: { in: [...requiredPlugins.keys()] } },
    select: { pluginId: true, version: true },
  });
  const versions = new Map(installed.map((record) => [record.pluginId, record.version]));
  for (const plugin of requiredPlugins.values()) {
    if (versions.get(plugin.id) !== plugin.version) {
      throw new RequestError(`Install the “${plugin.name}” widget pack before using its widgets.`, 409);
    }
  }
};

const recordAuditEvent = async ({
  actorId,
  workspaceId,
  action,
  resourceType,
  resourceId,
  before,
  after,
  request,
}) => {
  try {
    await prisma.auditEvent.create({
      data: {
        actorId,
        workspaceId,
        action,
        resourceType,
        resourceId,
        before: before ? jsonSafeValue(before) : undefined,
        after: after ? jsonSafeValue(after) : undefined,
        ipAddress: request?.ip || null,
        userAgent: request?.headers?.['user-agent'] || null,
      },
    });
  } catch (_err) {
    // Non-blocking audit event failure
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
  deletedAt: dashboard.deletedAt?.toISOString() ?? null,
});
const serializeWorkspace = (workspace) => ({
  id: workspace.id,
  name: workspace.name,
  slug: workspace.slug,
  description: workspace.description,
  icon: workspace.icon,
  accentColor: workspace.accentColor,
  coverImageUrl: workspace.coverImageUrl,
  storageUsedBytes: Number(workspace.storageUsedBytes),
  storageQuotaBytes: Number(workspace.storageQuotaBytes),
  createdAt: workspace.createdAt.toISOString(),
  updatedAt: workspace.updatedAt.toISOString(),
  archivedAt: workspace.archivedAt?.toISOString() ?? null,
  deletedAt: workspace.deletedAt?.toISOString() ?? null,
});
const serializeTemplate = (template, userId) => ({
  id: template.id,
  workspaceId: template.workspaceId,
  name: template.name,
  description: template.description,
  category: template.category,
  tags: template.tags,
  scene: template.scene,
  isPublished: template.isPublished,
  isFavorite: template.favorites?.some((favorite) => favorite.userId === userId) ?? false,
  createdBy: template.createdBy?.displayName ?? null,
  createdAt: template.createdAt.toISOString(),
  updatedAt: template.updatedAt.toISOString(),
});
const serializeDashboardComment = (comment, includeReplies = true) => ({
  id: comment.id,
  dashboardId: comment.dashboardId,
  parentId: comment.parentId ?? null,
  body: comment.deletedAt ? '' : comment.body,
  deletedAt: comment.deletedAt?.toISOString() ?? null,
  resolvedAt: comment.resolvedAt?.toISOString() ?? null,
  resolvedBy: comment.resolvedBy ? { id: comment.resolvedBy.id, displayName: comment.resolvedBy.displayName } : null,
  anchor: comment.anchor ?? null,
  createdAt: comment.createdAt.toISOString(),
  updatedAt: comment.updatedAt.toISOString(),
  author: comment.author ? {
    id: comment.author.id,
    displayName: comment.author.displayName,
    avatarUrl: comment.author.avatarUrl,
  } : null,
  ...(includeReplies ? { replies: (comment.replies || []).map((reply) => serializeDashboardComment(reply, false)) } : {}),
});

export const registerWorkspaceRoutes = async (app, environment) => {
  const auth = new AuthService(prisma, environment);

  app.get('/api/v1/workspaces', async (request, reply) => {
    const user = await requireUser(request, auth);
    const query = z.object({
      includeArchived: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
      includeDeleted: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
    }).parse(request.query);
    const memberships = await prisma.workspaceMember.findMany({
      where: {
        userId: user.id,
        workspace: {
          ...(query.includeDeleted ? {} : { deletedAt: null }),
          ...(query.includeArchived || query.includeDeleted ? {} : { archivedAt: null }),
        },
      },
      include: { workspace: true },
      orderBy: { workspace: { updatedAt: 'desc' } },
    });
    return reply.send(
      success(
        memberships.map(({ role, workspace, isFavorite, isPinned }) => ({
          id: workspace.id,
          name: workspace.name,
          description: workspace.description,
          icon: workspace.icon,
          accentColor: workspace.accentColor,
          coverImageUrl: workspace.coverImageUrl,
          archivedAt: workspace.archivedAt?.toISOString() ?? null,
          deletedAt: workspace.deletedAt?.toISOString() ?? null,
          isFavorite,
          isPinned,
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

    await recordAuditEvent({
      actorId: user.id,
      workspaceId: workspace.id,
      action: 'workspace.create',
      resourceType: 'workspace',
      resourceId: workspace.id,
      after: workspace,
      request,
    });

    return reply.status(201).send(success(serializeWorkspace(workspace), createRequestId(request.id)));
  });

  app.patch('/api/v1/workspaces/:workspaceId/preferences', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    const input = z.object({ isFavorite: z.boolean().optional(), isPinned: z.boolean().optional() })
      .refine((value) => Object.keys(value).length > 0, 'At least one preference is required.')
      .parse(request.body);
    const membership = await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER']);
    const updated = await prisma.workspaceMember.update({ where: { id: membership.id }, data: input });
    return reply.send(success({ isFavorite: updated.isFavorite, isPinned: updated.isPinned }, createRequestId(request.id)));
  });

  app.post('/api/v1/workspaces/:workspaceId/duplicate', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER']);
    const source = await prisma.workspace.findFirst({ where: { id: params.workspaceId, deletedAt: null } });
    if (!source) throw new RequestError('Workspace was not found.', 404);
    const copyName = `${source.name} copy`.slice(0, 80);
    const duplicate = await prisma.workspace.create({
      data: {
        ownerId: user.id,
        name: copyName,
        slug: uniqueSlug(copyName),
        description: source.description,
        icon: source.icon,
        accentColor: source.accentColor,
        members: { create: { userId: user.id, role: 'OWNER' } },
      },
    });
    await recordAuditEvent({
      actorId: user.id,
      workspaceId: duplicate.id,
      action: 'workspace.duplicate',
      resourceType: 'workspace',
      resourceId: duplicate.id,
      after: { sourceWorkspaceId: source.id },
      request,
    });
    return reply.status(201).send(success(serializeWorkspace(duplicate), createRequestId(request.id)));
  });

  app.post('/api/v1/workspaces/:workspaceId/leave', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    const membership = await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER']);
    if (membership.role === 'OWNER') throw new RequestError('Transfer workspace ownership before leaving.', 409);
    await prisma.workspaceMember.delete({ where: { id: membership.id } });
    await recordAuditEvent({
      actorId: user.id,
      workspaceId: params.workspaceId,
      action: 'workspace.member.left',
      resourceType: 'workspace_member',
      resourceId: membership.id,
      before: { userId: user.id, role: membership.role },
      request,
    });
    return reply.send(success({ left: true }, createRequestId(request.id)));
  });

  app.post('/api/v1/workspaces/:workspaceId/transfer-ownership', async (request, reply) => {
    const actor = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    await requireMembership(params.workspaceId, actor.id, ['OWNER']);
    const input = z.object({ memberId: idSchema }).parse(request.body);
    const target = await prisma.workspaceMember.findFirst({
      where: { id: input.memberId, workspaceId: params.workspaceId, role: { not: 'OWNER' } },
    });
    if (!target) throw new RequestError('Choose an active workspace member to receive ownership.', 404);
    await prisma.$transaction([
      prisma.workspaceMember.updateMany({ where: { workspaceId: params.workspaceId, userId: actor.id, role: 'OWNER' }, data: { role: 'ADMIN' } }),
      prisma.workspaceMember.update({ where: { id: target.id }, data: { role: 'OWNER' } }),
      prisma.workspace.update({ where: { id: params.workspaceId }, data: { ownerId: target.userId } }),
    ]);
    await recordAuditEvent({
      actorId: actor.id,
      workspaceId: params.workspaceId,
      action: 'workspace.ownership.transferred',
      resourceType: 'workspace',
      resourceId: params.workspaceId,
      before: { ownerId: actor.id },
      after: { ownerId: target.userId },
      request,
    });
    return reply.send(success({ ownerId: target.userId }, createRequestId(request.id)));
  });

  app.get('/api/v1/workspaces/:workspaceId/members', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER']);
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: params.workspaceId },
      include: { user: { select: { id: true, email: true, displayName: true, avatarUrl: true } } },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    return reply.send(success(members.map((member) => ({
      id: member.id,
      userId: member.userId,
      role: member.role,
      isFavorite: member.isFavorite,
      isPinned: member.isPinned,
      joinedAt: member.createdAt.toISOString(),
      user: member.user,
    })), createRequestId(request.id)));
  });

  app.get('/api/v1/workspaces/:workspaceId/invites', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN']);
    const invites = await prisma.workspaceInvite.findMany({
      where: { workspaceId: params.workspaceId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(success(invites.map((invite) => ({
      ...invite,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    })), createRequestId(request.id)));
  });

  app.patch('/api/v1/workspaces/:workspaceId/members/:memberId', async (request, reply) => {
    const actor = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema, memberId: idSchema }).parse(request.params);
    const actorMembership = await requireMembership(params.workspaceId, actor.id, ['OWNER', 'ADMIN']);
    const input = z.object({ role: z.enum(['ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER']) }).parse(request.body);
    const member = await prisma.workspaceMember.findFirst({
      where: { id: params.memberId, workspaceId: params.workspaceId },
    });
    if (!member) throw new RequestError('Workspace member was not found.', 404);
    if (member.role === 'OWNER') throw new RequestError('Workspace ownership can only be changed through a transfer.', 409);
    if (actorMembership.role === 'ADMIN' && member.role === 'ADMIN') {
      throw new RequestError('Only the workspace owner can manage administrators.', 403);
    }
    if (actorMembership.role === 'ADMIN' && input.role === 'ADMIN') {
      throw new RequestError('Only the workspace owner can grant administrator access.', 403);
    }
    const updated = await prisma.workspaceMember.update({ where: { id: member.id }, data: { role: input.role } });
    await recordAuditEvent({
      actorId: actor.id,
      workspaceId: params.workspaceId,
      action: 'workspace.member.role_changed',
      resourceType: 'workspace_member',
      resourceId: updated.id,
      before: { role: member.role },
      after: { role: updated.role, userId: updated.userId },
      request,
    });
    return reply.send(success({ id: updated.id, role: updated.role }, createRequestId(request.id)));
  });

  app.delete('/api/v1/workspaces/:workspaceId/members/:memberId', async (request, reply) => {
    const actor = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema, memberId: idSchema }).parse(request.params);
    const actorMembership = await requireMembership(params.workspaceId, actor.id, ['OWNER', 'ADMIN']);
    const member = await prisma.workspaceMember.findFirst({ where: { id: params.memberId, workspaceId: params.workspaceId } });
    if (!member) throw new RequestError('Workspace member was not found.', 404);
    if (member.role === 'OWNER') throw new RequestError('The owner must transfer ownership before leaving.', 409);
    if (actorMembership.role === 'ADMIN' && member.role === 'ADMIN') {
      throw new RequestError('Only the workspace owner can remove administrators.', 403);
    }
    await prisma.workspaceMember.delete({ where: { id: member.id } });
    await recordAuditEvent({
      actorId: actor.id,
      workspaceId: params.workspaceId,
      action: 'workspace.member.removed',
      resourceType: 'workspace_member',
      resourceId: member.id,
      before: { userId: member.userId, role: member.role },
      request,
    });
    return reply.send(success({ id: member.id, removed: true }, createRequestId(request.id)));
  });

  app.post('/api/v1/workspaces/:workspaceId/invites', async (request, reply) => {
    const actor = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    const actorMembership = await requireMembership(params.workspaceId, actor.id, ['OWNER', 'ADMIN']);
    const input = z.object({
      email: z.string().trim().email().transform((email) => email.toLowerCase()),
      role: z.enum(['ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER']).default('EDITOR'),
    }).parse(request.body);
    if (actorMembership.role === 'ADMIN' && input.role === 'ADMIN') {
      throw new RequestError('Only the workspace owner can invite administrators.', 403);
    }
    const rawToken = createOpaqueToken();
    const invite = await prisma.workspaceInvite.create({
      data: {
        workspaceId: params.workspaceId,
        createdById: actor.id,
        email: input.email,
        role: input.role,
        tokenHash: tokenDigest(rawToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      include: { workspace: { select: { name: true } } },
    });
    await recordAuditEvent({
      actorId: actor.id,
      workspaceId: params.workspaceId,
      action: 'workspace.invite.created',
      resourceType: 'workspace_invite',
      resourceId: invite.id,
      after: { email: invite.email, role: invite.role, expiresAt: invite.expiresAt },
      request,
    });
    await notifyVerifiedUserByEmail({
      email: invite.email,
      actorId: actor.id,
      type: 'workspace.invite',
      title: `Invitation to ${invite.workspace.name}`,
      message: `${actor.displayName} invited you to join as ${invite.role.toLowerCase()}.`,
      payload: { workspaceId: params.workspaceId, inviteId: invite.id, inviteToken: rawToken },
    }, request);
    let emailDelivered = false;
    try {
      const delivery = await sendWorkspaceInviteEmail({
        email: invite.email,
        inviterName: actor.displayName,
        workspaceName: invite.workspace.name,
        role: invite.role,
        token: rawToken,
        expiresAt: invite.expiresAt,
        environment,
      });
      emailDelivered = delivery.delivered;
    } catch (error) {
      request.log.error({ err: error, inviteId: invite.id }, 'Could not deliver workspace invitation email');
    }
    return reply.status(201).send(success({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      workspaceName: invite.workspace.name,
      expiresAt: invite.expiresAt.toISOString(),
      emailDelivered,
      inviteUrl: createWorkspaceInviteUrl(rawToken, environment),
    }, createRequestId(request.id)));
  });

  app.delete('/api/v1/workspaces/:workspaceId/invites/:inviteId', async (request, reply) => {
    const actor = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema, inviteId: idSchema }).parse(request.params);
    await requireMembership(params.workspaceId, actor.id, ['OWNER', 'ADMIN']);
    const invite = await prisma.workspaceInvite.findFirst({
      where: { id: params.inviteId, workspaceId: params.workspaceId, acceptedAt: null, revokedAt: null },
    });
    if (!invite) throw new RequestError('Invitation was not found or is no longer active.', 404);
    await prisma.workspaceInvite.update({ where: { id: invite.id }, data: { revokedAt: new Date() } });
    await recordAuditEvent({
      actorId: actor.id,
      workspaceId: params.workspaceId,
      action: 'workspace.invite.revoked',
      resourceType: 'workspace_invite',
      resourceId: invite.id,
      before: { email: invite.email, role: invite.role },
      request,
    });
    return reply.send(success({ id: invite.id, revoked: true }, createRequestId(request.id)));
  });

  app.get('/api/v1/invites/:token', async (request, reply) => {
    const { token } = z.object({ token: z.string().min(30).max(100) }).parse(request.params);
    const invite = await prisma.workspaceInvite.findUnique({
      where: { tokenHash: tokenDigest(token) },
      include: { workspace: { select: { id: true, name: true, deletedAt: true, archivedAt: true } } },
    });
    if (!invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt <= new Date() || invite.workspace.deletedAt || invite.workspace.archivedAt) {
      throw new RequestError('This invitation is expired or no longer available.', 404);
    }
    return reply.send(success({ email: invite.email, role: invite.role, workspace: { id: invite.workspace.id, name: invite.workspace.name }, expiresAt: invite.expiresAt.toISOString() }, createRequestId(request.id)));
  });

  app.post('/api/v1/invites/:token/accept', async (request, reply) => {
    const user = await requireUser(request, auth);
    const { token } = z.object({ token: z.string().min(30).max(100) }).parse(request.params);
    const invite = await prisma.workspaceInvite.findUnique({
      where: { tokenHash: tokenDigest(token) },
      include: { workspace: true },
    });
    if (!invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt <= new Date() || invite.workspace.deletedAt || invite.workspace.archivedAt) {
      throw new RequestError('This invitation is expired or no longer available.', 404);
    }
    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new RequestError(`Sign in as ${invite.email} to accept this invitation.`, 403);
    }
    await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.workspaceInvite.updateMany({
        where: {
          id: invite.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count !== 1) throw new RequestError('This invitation is expired or has already been used.', 409);
      await transaction.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id } },
        create: { workspaceId: invite.workspaceId, userId: user.id, role: invite.role },
        update: { role: invite.role },
      });
    });
    await recordAuditEvent({
      actorId: user.id,
      workspaceId: invite.workspaceId,
      action: 'workspace.invite.accepted',
      resourceType: 'workspace_invite',
      resourceId: invite.id,
      after: { userId: user.id, role: invite.role },
      request,
    });
    return reply.send(success({ workspaceId: invite.workspaceId, role: invite.role }, createRequestId(request.id)));
  });

  app.get('/api/v1/workspaces/:workspaceId/dashboards', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    const query = z.object({ includeDeleted: z.enum(['true', 'false']).default('false').transform((value) => value === 'true') }).parse(request.query);
    await requireMembership(params.workspaceId, user.id, [
      'OWNER',
      'ADMIN',
      'EDITOR',
      'COMMENTER',
      'VIEWER',
    ]);
    const dashboards = await prisma.dashboard.findMany({
      where: { workspaceId: params.workspaceId, deletedAt: query.includeDeleted ? { not: null } : null },
      include: { preferences: { where: { userId: user.id }, select: { isFavorite: true, isPinned: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return reply.send(success(dashboards.map((dashboard) => ({
      ...serializeDashboard(dashboard),
      isFavorite: dashboard.preferences[0]?.isFavorite ?? false,
      isPinned: dashboard.preferences[0]?.isPinned ?? false,
    })), createRequestId(request.id)));
  });

  app.get('/api/v1/workspaces/:workspaceId/templates', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    const membership = await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER']);
    const templates = await prisma.dashboardTemplate.findMany({
      where: {
        workspaceId: params.workspaceId,
        ...(['OWNER', 'ADMIN'].includes(membership.role) ? {} : { OR: [{ isPublished: true }, { createdById: user.id }] }),
      },
      include: {
        favorites: { where: { userId: user.id }, select: { userId: true } },
        createdBy: { select: { displayName: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
    return reply.send(success(templates.map((template) => serializeTemplate(template, user.id)), createRequestId(request.id)));
  });

  app.post('/api/v1/workspaces/:workspaceId/templates', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    const input = z.object({
      dashboardId: idSchema,
      name: z.string().trim().min(2).max(120),
      description: z.string().trim().max(280).optional(),
      category: z.string().trim().min(1).max(40).default('General'),
      tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
      isPublished: z.boolean().default(false),
    }).parse(request.body);
    const membership = await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR']);
    if (input.isPublished && !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new RequestError('Only workspace administrators can publish templates.', 403);
    }
    const template = await runSerializableTransaction(prisma, async (transaction) => {
      const dashboard = await transaction.dashboard.findFirst({
        where: { id: input.dashboardId, workspaceId: params.workspaceId, deletedAt: null },
        select: { scene: true },
      });
      if (!dashboard) throw new RequestError('Dashboard was not found.', 404);
      await validateInstalledPluginNodes(params.workspaceId, dashboard.scene, transaction);
      return transaction.dashboardTemplate.create({
        data: {
          workspaceId: params.workspaceId,
          createdById: user.id,
          name: input.name,
          description: input.description || null,
          category: input.category,
          tags: input.tags,
          scene: dashboard.scene,
          isPublished: input.isPublished,
        },
        include: {
          favorites: { where: { userId: user.id }, select: { userId: true } },
          createdBy: { select: { displayName: true } },
        },
      });
    });
    await recordAuditEvent({
      actorId: user.id,
      workspaceId: params.workspaceId,
      action: 'template.create',
      resourceType: 'dashboard_template',
      resourceId: template.id,
      after: { name: template.name, isPublished: template.isPublished },
      request,
    });
    return reply.status(201).send(success(serializeTemplate(template, user.id), createRequestId(request.id)));
  });

  app.patch('/api/v1/workspaces/:workspaceId/templates/:templateId', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema, templateId: idSchema }).parse(request.params);
    const input = z.object({
      name: z.string().trim().min(2).max(120).optional(),
      description: z.string().trim().max(280).nullable().optional(),
      category: z.string().trim().min(1).max(40).optional(),
      tags: z.array(z.string().trim().min(1).max(24)).max(8).optional(),
      isPublished: z.boolean().optional(),
    }).refine((value) => Object.keys(value).length > 0, 'At least one template field is required.').parse(request.body);
    const membership = await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR']);
    if (input.isPublished !== undefined && !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new RequestError('Only workspace administrators can publish templates.', 403);
    }
    const where = {
      id: params.templateId,
      workspaceId: params.workspaceId,
      ...(['OWNER', 'ADMIN'].includes(membership.role) ? {} : { createdById: user.id }),
    };
    const before = await prisma.dashboardTemplate.findFirst({
      where,
      select: { id: true, name: true, isPublished: true },
    });
    if (!before) throw new RequestError('Template was not found.', 404);
    const template = await prisma.dashboardTemplate.update({
      where: { id: before.id },
      data: input,
      include: {
        favorites: { where: { userId: user.id }, select: { userId: true } },
        createdBy: { select: { displayName: true } },
      },
    });
    await recordAuditEvent({
      actorId: user.id,
      workspaceId: params.workspaceId,
      action: input.isPublished === undefined ? 'template.update' : input.isPublished ? 'template.publish' : 'template.unpublish',
      resourceType: 'dashboard_template',
      resourceId: template.id,
      before: { name: before.name, isPublished: before.isPublished },
      after: { name: template.name, isPublished: template.isPublished },
      request,
    });
    return reply.send(success(serializeTemplate(template, user.id), createRequestId(request.id)));
  });

  app.patch('/api/v1/workspaces/:workspaceId/templates/:templateId/favorite', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema, templateId: idSchema }).parse(request.params);
    const input = z.object({ isFavorite: z.boolean() }).parse(request.body);
    await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER']);
    const template = await prisma.dashboardTemplate.findFirst({
      where: { id: params.templateId, workspaceId: params.workspaceId, OR: [{ isPublished: true }, { createdById: user.id }] },
      select: { id: true },
    });
    if (!template) throw new RequestError('Template was not found.', 404);
    const unique = { templateId_userId: { templateId: template.id, userId: user.id } };
    if (input.isFavorite) {
      await prisma.dashboardTemplateFavorite.upsert({ where: unique, update: {}, create: { templateId: template.id, userId: user.id } });
    } else {
      await prisma.dashboardTemplateFavorite.deleteMany({ where: { templateId: template.id, userId: user.id } });
    }
    return reply.send(success({ id: template.id, isFavorite: input.isFavorite }, createRequestId(request.id)));
  });

  app.post('/api/v1/workspaces/:workspaceId/templates/:templateId/use', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema, templateId: idSchema }).parse(request.params);
    const input = z.object({ name: z.string().trim().min(2).max(120).optional() }).parse(request.body || {});
    await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR']);
    const template = await prisma.dashboardTemplate.findFirst({
      where: { id: params.templateId, workspaceId: params.workspaceId, OR: [{ isPublished: true }, { createdById: user.id }] },
    });
    if (!template) throw new RequestError('Template was not found.', 404);
    const name = input.name || `${template.name} copy`;
    const dashboard = await runSerializableTransaction(prisma, async (transaction) => {
      await validateInstalledPluginNodes(params.workspaceId, template.scene, transaction);
      return transaction.dashboard.create({
        data: {
          workspaceId: params.workspaceId,
          ownerId: user.id,
          name,
          slug: uniqueSlug(name),
          description: template.description,
          scene: template.scene,
        },
      });
    });
    await recordAuditEvent({
      actorId: user.id,
      workspaceId: params.workspaceId,
      action: 'template.used',
      resourceType: 'dashboard_template',
      resourceId: template.id,
      after: { dashboardId: dashboard.id, dashboardName: dashboard.name },
      request,
    });
    return reply.status(201).send(success(serializeDashboard(dashboard), createRequestId(request.id)));
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
        scene: {
          schemaVersion: 2,
          nodes: [],
          connections: [],
          gridStyle: user.preferences?.defaultGridStyle === 'mesh' ? 'radial' : (user.preferences?.defaultGridStyle || 'dots'),
          gridColorPreset: user.preferences?.accentColor || 'violet',
          gridSize: 24,
        },
      },
    });

    await recordAuditEvent({
      actorId: user.id,
      workspaceId: params.workspaceId,
      action: 'dashboard.create',
      resourceType: 'dashboard',
      resourceId: dashboard.id,
      after: dashboard,
      request,
    });

    return reply
      .status(201)
      .send(success(serializeDashboard(dashboard), createRequestId(request.id)));
  });

  app.post('/api/v1/workspaces/:workspaceId/dashboards/import', { bodyLimit: 2 * 1024 * 1024 }, async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    const input = dashboardImportSchema.parse(request.body);
    await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR']);

    const dashboard = await runSerializableTransaction(prisma, async (transaction) => {
      await validateInstalledPluginNodes(params.workspaceId, input.scene, transaction);
      const created = await transaction.dashboard.create({
        data: {
          workspaceId: params.workspaceId,
          ownerId: user.id,
          name: input.name,
          slug: uniqueSlug(input.name),
          ...(input.description ? { description: input.description } : {}),
          scene: input.scene,
        },
      });
      await transaction.dashboardVersion.create({
        data: { dashboardId: created.id, version: created.version, scene: created.scene },
      });
      return created;
    });

    await recordAuditEvent({
      actorId: user.id,
      workspaceId: params.workspaceId,
      action: 'dashboard.import',
      resourceType: 'dashboard',
      resourceId: dashboard.id,
      after: dashboard,
      request,
    });
    return reply.status(201).send(success(serializeDashboard(dashboard), createRequestId(request.id)));
  });

  app.patch('/api/v1/dashboards/:dashboardId/status', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ dashboardId: idSchema }).parse(request.params);
    const input = z.object({ status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']) }).parse(request.body);
    const dashboard = await prisma.dashboard.findFirst({ where: { id: params.dashboardId, deletedAt: null } });
    if (!dashboard) throw new RequestError('Dashboard was not found.', 404);
    await requireMembership(dashboard.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR']);
    const allowedTransitions = {
      DRAFT: ['PUBLISHED', 'ARCHIVED'],
      PUBLISHED: ['ARCHIVED'],
      ARCHIVED: ['DRAFT'],
    };
    if (!allowedTransitions[dashboard.status].includes(input.status)) {
      throw new RequestError(`Dashboard cannot transition from ${dashboard.status} to ${input.status}.`, 409);
    }
    const updated = await prisma.$transaction(async (transaction) => {
      const result = await transaction.dashboard.updateMany({
        where: { id: dashboard.id, status: dashboard.status, deletedAt: null },
        data: { status: input.status },
      });
      if (result.count !== 1) throw new RequestError('Dashboard status changed elsewhere. Refresh and retry.', 412);
      return transaction.dashboard.findUnique({ where: { id: dashboard.id } });
    });
    await recordAuditEvent({
      actorId: user.id,
      workspaceId: dashboard.workspaceId,
      action: 'dashboard.status_changed',
      resourceType: 'dashboard',
      resourceId: dashboard.id,
      before: { status: dashboard.status },
      after: { status: updated.status },
      request,
    });
    return reply.send(success(serializeDashboard(updated), createRequestId(request.id)));
  });

  app.post('/api/v1/dashboards/:dashboardId/duplicate', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ dashboardId: idSchema }).parse(request.params);
    const source = await prisma.dashboard.findFirst({ where: { id: params.dashboardId, deletedAt: null } });
    if (!source) throw new RequestError('Dashboard was not found.', 404);
    await requireMembership(source.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR']);
    const copyName = `${source.name} copy`.slice(0, 120);
    const duplicate = await runSerializableTransaction(prisma, async (transaction) => {
      await validateInstalledPluginNodes(source.workspaceId, source.scene, transaction);
      const dashboard = await transaction.dashboard.create({
        data: {
          workspaceId: source.workspaceId,
          ownerId: user.id,
          name: copyName,
          slug: uniqueSlug(copyName),
          description: source.description,
          status: 'DRAFT',
          scene: source.scene,
        },
      });
      await transaction.dashboardVersion.create({
        data: { dashboardId: dashboard.id, version: dashboard.version, scene: dashboard.scene },
      });
      return dashboard;
    });
    await recordAuditEvent({
      actorId: user.id,
      workspaceId: source.workspaceId,
      action: 'dashboard.duplicate',
      resourceType: 'dashboard',
      resourceId: duplicate.id,
      after: { sourceDashboardId: source.id },
      request,
    });
    return reply.status(201).send(success(serializeDashboard(duplicate), createRequestId(request.id)));
  });

  app.post('/api/v1/dashboards/:dashboardId/move', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ dashboardId: idSchema }).parse(request.params);
    const input = z.object({ workspaceId: idSchema }).parse(request.body);
    const dashboard = await prisma.dashboard.findFirst({ where: { id: params.dashboardId, deletedAt: null } });
    if (!dashboard) throw new RequestError('Dashboard was not found.', 404);
    await requireMembership(dashboard.workspaceId, user.id, ['OWNER', 'ADMIN']);
    if (input.workspaceId === dashboard.workspaceId) throw new RequestError('Choose a different workspace.', 409);
    await requireMembership(input.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR']);
    const moved = await runSerializableTransaction(prisma, async (transaction) => {
      const current = await transaction.dashboard.findUnique({
        where: { id: dashboard.id },
        select: { id: true, workspaceId: true, name: true, scene: true, deletedAt: true },
      });
      if (!current || current.deletedAt || current.workspaceId !== dashboard.workspaceId) {
        throw new RequestError('Dashboard changed elsewhere. Refresh and retry.', 412);
      }
      await validateInstalledPluginNodes(input.workspaceId, current.scene, transaction);
      const updated = await transaction.dashboard.update({
        where: { id: dashboard.id },
        data: { workspaceId: input.workspaceId, slug: uniqueSlug(current.name) },
      });
      await transaction.dashboardShare.updateMany({
        where: { dashboardId: dashboard.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return updated;
    });
    await recordAuditEvent({
      actorId: user.id,
      workspaceId: dashboard.workspaceId,
      action: 'dashboard.moved_out',
      resourceType: 'dashboard',
      resourceId: dashboard.id,
      before: { workspaceId: dashboard.workspaceId },
      after: { workspaceId: input.workspaceId },
      request,
    });
    await recordAuditEvent({
      actorId: user.id,
      workspaceId: input.workspaceId,
      action: 'dashboard.moved_in',
      resourceType: 'dashboard',
      resourceId: dashboard.id,
      after: { fromWorkspaceId: dashboard.workspaceId },
      request,
    });
    return reply.send(success(serializeDashboard(moved), createRequestId(request.id)));
  });

  app.patch('/api/v1/dashboards/:dashboardId/preferences', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ dashboardId: idSchema }).parse(request.params);
    const input = z.object({ isFavorite: z.boolean().optional(), isPinned: z.boolean().optional() })
      .refine((value) => Object.keys(value).length > 0, 'At least one preference is required.')
      .parse(request.body);
    const dashboard = await prisma.dashboard.findFirst({ where: { id: params.dashboardId, deletedAt: null } });
    if (!dashboard) throw new RequestError('Dashboard was not found.', 404);
    await requireMembership(dashboard.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER']);
    const preference = await prisma.dashboardPreference.upsert({
      where: { dashboardId_userId: { dashboardId: dashboard.id, userId: user.id } },
      create: { dashboardId: dashboard.id, userId: user.id, ...input },
      update: input,
    });
    return reply.send(success({ isFavorite: preference.isFavorite, isPinned: preference.isPinned }, createRequestId(request.id)));
  });

  app.get('/api/v1/dashboards/:dashboardId', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ dashboardId: idSchema }).parse(request.params);
    const dashboard = await prisma.dashboard.findFirst({
      where: { id: params.dashboardId, deletedAt: null },
    });
    if (!dashboard) throw new RequestError('Dashboard was not found.', 404);
    const membership = await requireMembership(dashboard.workspaceId, user.id, [
      'OWNER',
      'ADMIN',
      'EDITOR',
      'COMMENTER',
      'VIEWER',
    ]);
    return reply.send(success({ ...serializeDashboard(dashboard), accessRole: membership.role }, createRequestId(request.id)));
  });

  app.get('/api/v1/dashboards/:dashboardId/comments', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ dashboardId: idSchema }).parse(request.params);
    const dashboard = await prisma.dashboard.findFirst({ where: { id: params.dashboardId, deletedAt: null } });
    if (!dashboard) throw new RequestError('Dashboard was not found.', 404);
    await requireMembership(dashboard.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER']);
    const comments = await prisma.dashboardComment.findMany({
      where: { dashboardId: dashboard.id, parentId: null },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        resolvedBy: { select: { id: true, displayName: true } },
        replies: {
          include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
          take: 100,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return reply.send(success(comments.reverse().map(serializeDashboardComment), createRequestId(request.id)));
  });

  app.post('/api/v1/dashboards/:dashboardId/comments', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ dashboardId: idSchema }).parse(request.params);
    const input = dashboardCommentInputSchema.parse(request.body);
    const dashboard = await prisma.dashboard.findFirst({ where: { id: params.dashboardId, deletedAt: null } });
    if (!dashboard) throw new RequestError('Dashboard was not found.', 404);
    const membership = await requireMembership(dashboard.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR', 'COMMENTER']);
    if (dashboard.status === 'ARCHIVED') throw new RequestError('Archived dashboards are read-only.', 403);
    if (input.anchor) {
      const dashboardNodeIds = new Set((dashboard.scene?.nodes || []).map((node) => node?.id).filter(Boolean));
      if (input.anchor.nodeIds.some((nodeId) => !dashboardNodeIds.has(nodeId))) {
        throw new RequestError('Anchors must refer to nodes on this dashboard.', 422);
      }
    }
    let parent = null;
    if (input.parentId) {
      parent = await prisma.dashboardComment.findFirst({
        where: { id: input.parentId, dashboardId: dashboard.id, parentId: null, deletedAt: null },
        select: { id: true, resolvedAt: true },
      });
      if (!parent) throw new RequestError('Comment thread was not found.', 404);
      if (parent.resolvedAt) throw new RequestError('This discussion has been resolved.', 409);
      if (input.anchor) throw new RequestError('Attach a node or selection anchor to the first comment in a thread.', 422);
    }
    const comment = await prisma.dashboardComment.create({
      data: {
        dashboardId: dashboard.id,
        authorId: user.id,
        body: input.body,
        parentId: parent?.id ?? null,
        ...(input.anchor ? { anchor: input.anchor } : {}),
      },
      include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
    });
    await recordAuditEvent({
      actorId: user.id,
      workspaceId: dashboard.workspaceId,
      action: 'dashboard.comment.created',
      resourceType: 'dashboard_comment',
      resourceId: comment.id,
      after: { dashboardId: dashboard.id },
      request,
    });
    const mentionedEmails = [...input.body.matchAll(/@([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi)].map((match) => match[1]);
    const mentionedUserIds = await notifyMentionedUsers({
      workspaceId: dashboard.workspaceId,
      actorId: user.id,
      emails: mentionedEmails,
      title: `${user.displayName} mentioned you`,
      message: `You were mentioned in ${dashboard.name}.`,
      payload: { workspaceId: dashboard.workspaceId, dashboardId: dashboard.id, commentId: comment.id, parentId: parent?.id ?? null },
    }, request);
    await notifyWorkspaceMembers({
      workspaceId: dashboard.workspaceId,
      actorId: user.id,
      type: 'collaboration.comment',
      title: parent ? 'New reply in dashboard discussion' : 'New dashboard comment',
      message: parent ? `${user.displayName} replied in ${dashboard.name}.` : `${user.displayName} commented on ${dashboard.name}.`,
      payload: { workspaceId: dashboard.workspaceId, dashboardId: dashboard.id, commentId: comment.id, parentId: parent?.id ?? null },
      excludeUserIds: mentionedUserIds,
    }, request);
    return reply.status(201).send(success({ ...serializeDashboardComment(comment), accessRole: membership.role }, createRequestId(request.id)));
  });

  app.patch('/api/v1/dashboards/:dashboardId/comments/:commentId/resolution', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ dashboardId: idSchema, commentId: idSchema }).parse(request.params);
    const { resolved } = z.object({ resolved: z.boolean() }).parse(request.body);
    const dashboard = await prisma.dashboard.findFirst({ where: { id: params.dashboardId, deletedAt: null } });
    if (!dashboard) throw new RequestError('Dashboard was not found.', 404);
    const membership = await requireMembership(dashboard.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR', 'COMMENTER']);
    const comment = await prisma.dashboardComment.findFirst({
      where: { id: params.commentId, dashboardId: dashboard.id, parentId: null, deletedAt: null },
    });
    if (!comment) throw new RequestError('Comment thread was not found.', 404);
    if (comment.authorId !== user.id && !['OWNER', 'ADMIN', 'EDITOR'].includes(membership.role)) {
      throw new RequestError('Only the thread author or a workspace editor can change resolution.', 403);
    }
    if (dashboard.status === 'ARCHIVED') throw new RequestError('Archived dashboards are read-only.', 403);
    const updated = await prisma.dashboardComment.update({
      where: { id: comment.id },
      data: { resolvedAt: resolved ? new Date() : null, resolvedById: resolved ? user.id : null },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        resolvedBy: { select: { id: true, displayName: true } },
      },
    });
    await recordAuditEvent({
      actorId: user.id,
      workspaceId: dashboard.workspaceId,
      action: resolved ? 'dashboard.comment.resolved' : 'dashboard.comment.reopened',
      resourceType: 'dashboard_comment',
      resourceId: comment.id,
      after: { dashboardId: dashboard.id },
      request,
    });
    return reply.send(success(serializeDashboardComment(updated), createRequestId(request.id)));
  });

  app.patch('/api/v1/dashboards/:dashboardId/comments/:commentId', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ dashboardId: idSchema, commentId: idSchema }).parse(request.params);
    const input = z.object({ body: z.string().trim().min(1).max(4000) }).parse(request.body);
    const dashboard = await prisma.dashboard.findFirst({ where: { id: params.dashboardId, deletedAt: null } });
    if (!dashboard) throw new RequestError('Dashboard was not found.', 404);
    const membership = await requireMembership(dashboard.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR', 'COMMENTER']);
    const comment = await prisma.dashboardComment.findFirst({
      where: { id: params.commentId, dashboardId: dashboard.id, deletedAt: null },
    });
    if (!comment) throw new RequestError('Comment was not found.', 404);
    if (comment.authorId !== user.id && !['OWNER', 'ADMIN', 'EDITOR'].includes(membership.role)) {
      throw new RequestError('You can only edit your own comments.', 403);
    }
    if (dashboard.status === 'ARCHIVED') throw new RequestError('Archived dashboards are read-only.', 403);
    const updated = await prisma.dashboardComment.update({
      where: { id: comment.id },
      data: { body: input.body },
      include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
    });
    await recordAuditEvent({
      actorId: user.id,
      workspaceId: dashboard.workspaceId,
      action: 'dashboard.comment.updated',
      resourceType: 'dashboard_comment',
      resourceId: comment.id,
      after: { dashboardId: dashboard.id },
      request,
    });
    return reply.send(success(serializeDashboardComment(updated), createRequestId(request.id)));
  });

  app.delete('/api/v1/dashboards/:dashboardId/comments/:commentId', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ dashboardId: idSchema, commentId: idSchema }).parse(request.params);
    const dashboard = await prisma.dashboard.findFirst({ where: { id: params.dashboardId, deletedAt: null } });
    if (!dashboard) throw new RequestError('Dashboard was not found.', 404);
    const membership = await requireMembership(dashboard.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR', 'COMMENTER']);
    const comment = await prisma.dashboardComment.findFirst({
      where: { id: params.commentId, dashboardId: dashboard.id, deletedAt: null },
    });
    if (!comment) throw new RequestError('Comment was not found.', 404);
    if (comment.authorId !== user.id && !['OWNER', 'ADMIN', 'EDITOR'].includes(membership.role)) {
      throw new RequestError('You can only remove your own comments.', 403);
    }
    const deletedAt = new Date();
    await prisma.dashboardComment.update({ where: { id: comment.id }, data: { deletedAt } });
    await recordAuditEvent({
      actorId: user.id,
      workspaceId: dashboard.workspaceId,
      action: 'dashboard.comment.deleted',
      resourceType: 'dashboard_comment',
      resourceId: comment.id,
      before: { dashboardId: dashboard.id },
      request,
    });
    return reply.send(success({ id: comment.id, deletedAt: deletedAt.toISOString() }, createRequestId(request.id)));
  });

  app.get('/api/v1/workspaces/:workspaceId/comments', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER']);
    const comments = await prisma.dashboardComment.findMany({
      where: {
        deletedAt: null,
        dashboard: { workspaceId: params.workspaceId, deletedAt: null },
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        dashboard: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
    return reply.send(success(comments.map((comment) => ({
      ...serializeDashboardComment(comment),
      dashboard: comment.dashboard,
    })), createRequestId(request.id)));
  });

  app.post('/api/v1/dashboards/:dashboardId/realtime-token', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ dashboardId: idSchema }).parse(request.params);
    const token = await auth.createRealtimeToken(request.cookies.voxel_access, params.dashboardId);
    if (!token) throw new RequestError('You do not have permission to access this dashboard.', 403);
    return reply.send(
      success(
        { token, user: { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl } },
        createRequestId(request.id),
      ),
    );
  });

  app.get('/api/v1/dashboards/:dashboardId/shares', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ dashboardId: idSchema }).parse(request.params);
    const dashboard = await prisma.dashboard.findFirst({ where: { id: params.dashboardId, deletedAt: null } });
    if (!dashboard) throw new RequestError('Dashboard was not found.', 404);
    await requireMembership(dashboard.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR']);
    const shares = await prisma.dashboardShare.findMany({
      where: { dashboardId: dashboard.id, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, permission: true, expiresAt: true, createdAt: true },
    });
    return reply.send(success(shares.map((share) => ({
      ...share,
      expiresAt: share.expiresAt?.toISOString() ?? null,
      createdAt: share.createdAt.toISOString(),
    })), createRequestId(request.id)));
  });

  app.post('/api/v1/dashboards/:dashboardId/shares', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ dashboardId: idSchema }).parse(request.params);
    const input = z.object({
      permission: z.enum(['VIEW', 'EDIT']).default('VIEW'),
      expiresInDays: z.number().int().min(1).max(365).default(30),
    }).parse(request.body);
    const dashboard = await prisma.dashboard.findFirst({ where: { id: params.dashboardId, deletedAt: null } });
    if (!dashboard) throw new RequestError('Dashboard was not found.', 404);
    if (dashboard.status === 'ARCHIVED') throw new RequestError('Restore this dashboard before creating a share link.', 409);
    await requireMembership(dashboard.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR']);
    const rawToken = createOpaqueToken();
    const share = await prisma.dashboardShare.create({
      data: {
        dashboardId: dashboard.id,
        createdById: user.id,
        permission: input.permission,
        tokenHash: tokenDigest(rawToken),
        expiresAt: new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000),
      },
    });
    await recordAuditEvent({
      actorId: user.id,
      workspaceId: dashboard.workspaceId,
      action: 'dashboard.share.created',
      resourceType: 'dashboard_share',
      resourceId: share.id,
      after: { permission: share.permission, expiresAt: share.expiresAt },
      request,
    });
    return reply.status(201).send(success({
      id: share.id,
      permission: share.permission,
      expiresAt: share.expiresAt.toISOString(),
      shareUrl: `${environment.VOXEL_PUBLIC_APP_URL}/share/${rawToken}`,
    }, createRequestId(request.id)));
  });

  app.delete('/api/v1/dashboards/:dashboardId/shares/:shareId', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ dashboardId: idSchema, shareId: idSchema }).parse(request.params);
    const dashboard = await prisma.dashboard.findFirst({ where: { id: params.dashboardId, deletedAt: null } });
    if (!dashboard) throw new RequestError('Dashboard was not found.', 404);
    await requireMembership(dashboard.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR']);
    const share = await prisma.dashboardShare.findFirst({
      where: { id: params.shareId, dashboardId: dashboard.id, revokedAt: null },
    });
    if (!share) throw new RequestError('Share link was not found or is already revoked.', 404);
    await prisma.dashboardShare.update({ where: { id: share.id }, data: { revokedAt: new Date() } });
    await recordAuditEvent({
      actorId: user.id,
      workspaceId: dashboard.workspaceId,
      action: 'dashboard.share.revoked',
      resourceType: 'dashboard_share',
      resourceId: share.id,
      before: { permission: share.permission },
      request,
    });
    return reply.send(success({ id: share.id, revoked: true }, createRequestId(request.id)));
  });

  app.get('/api/v1/shares/:token', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { token } = z.object({ token: z.string().min(30).max(100) }).parse(request.params);
    const share = await prisma.dashboardShare.findUnique({
      where: { tokenHash: tokenDigest(token) },
      include: { dashboard: { include: { workspace: { select: {
        deletedAt: true,
        archivedAt: true,
        plugins: { select: { pluginId: true, version: true } },
      } } } } },
    });
    if (
      !share || share.revokedAt || (share.expiresAt && share.expiresAt <= new Date()) ||
      share.dashboard.deletedAt || share.dashboard.status === 'ARCHIVED' || share.dashboard.workspace.deletedAt || share.dashboard.workspace.archivedAt
    ) {
      throw new RequestError('This dashboard link is expired or no longer available.', 404);
    }
    return reply.send(success({
      id: share.dashboard.id,
      name: share.dashboard.name,
      description: share.dashboard.description,
      scene: share.permission === 'VIEW' ? sceneForReadOnlyShare(share.dashboard.scene) : share.dashboard.scene,
      version: share.dashboard.version,
      plugins: share.dashboard.workspace.plugins.flatMap((installed) => {
        const plugin = widgetPluginCatalog.find((candidate) => candidate.id === installed.pluginId);
        return plugin?.version === installed.version ? [plugin] : [];
      }),
      permission: share.permission,
      expiresAt: share.expiresAt?.toISOString() ?? null,
    }, createRequestId(request.id)));
  });

  app.patch('/api/v1/shares/:token', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { token } = z.object({ token: z.string().min(30).max(100) }).parse(request.params);
    const input = dashboardUpdateSchema.parse(request.body);
    const share = await prisma.dashboardShare.findUnique({
      where: { tokenHash: tokenDigest(token) },
      include: { dashboard: { include: { workspace: { select: { deletedAt: true, archivedAt: true } } } } },
    });
    if (
      !share || share.permission !== 'EDIT' || share.revokedAt ||
      (share.expiresAt && share.expiresAt <= new Date()) || share.dashboard.deletedAt || share.dashboard.status === 'ARCHIVED' ||
      share.dashboard.workspace.deletedAt || share.dashboard.workspace.archivedAt
    ) {
      throw new RequestError('This link does not allow editing or is no longer available.', 403);
    }
    const requestedName = input.name ?? share.dashboard.name;
    const requestedDescription = input.description === undefined ? share.dashboard.description : input.description;
    const requestedScene = input.scene ?? share.dashboard.scene;
    if (
      requestedName === share.dashboard.name &&
      requestedDescription === share.dashboard.description &&
      canonicalJson(requestedScene) === canonicalJson(share.dashboard.scene)
    ) {
      return reply.send(success(serializeDashboard(share.dashboard), createRequestId(request.id)));
    }
    if (input.version !== share.dashboard.version) {
      throw new RequestError('Dashboard changed elsewhere. Reload and retry.', 412);
    }
    const data = {
      version: { increment: 1 },
      ...(input.name ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.scene ? { scene: input.scene } : {}),
    };
    const updated = await runSerializableTransaction(prisma, async (transaction) => {
      await validateInstalledPluginNodes(share.dashboard.workspaceId, requestedScene, transaction);
      const result = await transaction.dashboard.updateMany({
        where: { id: share.dashboard.id, version: input.version, deletedAt: null },
        data,
      });
      if (result.count !== 1) throw new RequestError('Dashboard changed elsewhere. Reload and retry.', 412);
      const next = await transaction.dashboard.findUnique({ where: { id: share.dashboard.id } });
      await transaction.dashboardVersion.create({
        data: { dashboardId: next.id, version: next.version, scene: next.scene },
      });
      return next;
    });
    await recordAuditEvent({
      actorId: null,
      workspaceId: share.dashboard.workspaceId,
      action: 'dashboard.shared_edit',
      resourceType: 'dashboard',
      resourceId: updated.id,
      before: share.dashboard,
      after: { version: updated.version, shareId: share.id },
      request,
    });
    return reply.send(success(serializeDashboard(updated), createRequestId(request.id)));
  });

  app.get('/api/v1/dashboards/:dashboardId/versions', async (request, reply) => {
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
    const versions = await prisma.dashboardVersion.findMany({
      where: { dashboardId: params.dashboardId },
      orderBy: { version: 'desc' },
      take: 30,
    });
    return reply.send(
      success(
        versions.map((v) => ({
          id: v.id,
          version: v.version,
          scene: v.scene,
          createdAt: v.createdAt.toISOString(),
        })),
        createRequestId(request.id),
      ),
    );
  });

  app.patch('/api/v1/dashboards/:dashboardId', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ dashboardId: idSchema }).parse(request.params);
    const input = dashboardUpdateSchema.parse(request.body);
    const dashboard = await prisma.dashboard.findFirst({
      where: { id: params.dashboardId, deletedAt: null },
    });
    if (!dashboard) throw new RequestError('Dashboard was not found.', 404);
    if (dashboard.status === 'ARCHIVED') throw new RequestError('Restore this dashboard before editing it.', 409);
    await requireMembership(dashboard.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR']);
    const requestedName = input.name ?? dashboard.name;
    const requestedDescription = input.description === undefined ? dashboard.description : input.description;
    const requestedScene = input.scene ?? dashboard.scene;
    if (
      requestedName === dashboard.name &&
      requestedDescription === dashboard.description &&
      canonicalJson(requestedScene) === canonicalJson(dashboard.scene)
    ) {
      return reply.send(success(serializeDashboard(dashboard), createRequestId(request.id)));
    }
    if (input.version !== dashboard.version)
      throw new RequestError('Dashboard changed elsewhere. Refresh and retry.', 412);

    const data = {
      version: { increment: 1 },
      ...(input.name ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.scene ? { scene: input.scene } : {}),
    };
    const updated = await runSerializableTransaction(prisma, async (transaction) => {
      await validateInstalledPluginNodes(dashboard.workspaceId, requestedScene, transaction);
      const result = await transaction.dashboard.updateMany({
        where: { id: dashboard.id, version: input.version, deletedAt: null },
        data,
      });
      if (result.count !== 1) throw new RequestError('Dashboard changed elsewhere. Refresh and retry.', 412);
      const next = await transaction.dashboard.findUnique({ where: { id: dashboard.id } });
      await transaction.dashboardVersion.create({
        data: {
          dashboardId: next.id,
          version: next.version,
          scene: next.scene,
        },
      });
      return next;
    });

    await recordAuditEvent({
      actorId: user.id,
      workspaceId: dashboard.workspaceId,
      action: 'dashboard.update',
      resourceType: 'dashboard',
      resourceId: updated.id,
      before: dashboard,
      after: updated,
      request,
    });

    return reply.send(success(serializeDashboard(updated), createRequestId(request.id)));
  });

  app.patch('/api/v1/workspaces/:workspaceId', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    const input = workspaceUpdateSchema.parse(request.body);

    await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN']);

    const previous = await prisma.workspace.findUnique({ where: { id: params.workspaceId } });

    const updated = await prisma.workspace.update({
      where: { id: params.workspaceId },
      data: {
        ...(input.name ? { name: input.name, slug: uniqueSlug(input.name) } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.icon ? { icon: input.icon } : {}),
        ...(input.accentColor ? { accentColor: input.accentColor } : {}),
      },
    });

    await recordAuditEvent({
      actorId: user.id,
      workspaceId: params.workspaceId,
      action: 'workspace.update',
      resourceType: 'workspace',
      resourceId: updated.id,
      before: previous,
      after: updated,
      request,
    });

    return reply.send(success(serializeWorkspace(updated), createRequestId(request.id)));
  });

  app.post('/api/v1/workspaces/:workspaceId/archive', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN']);
    const updated = await prisma.workspace.update({
      where: { id: params.workspaceId },
      data: { archivedAt: new Date() },
    });
    await recordAuditEvent({
      actorId: user.id,
      workspaceId: updated.id,
      action: 'workspace.archive',
      resourceType: 'workspace',
      resourceId: updated.id,
      after: { archivedAt: updated.archivedAt },
      request,
    });
    return reply.send(success({ id: updated.id, archivedAt: updated.archivedAt.toISOString() }, createRequestId(request.id)));
  });

  app.post('/api/v1/workspaces/:workspaceId/restore', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN'], { allowArchived: true });
    const updated = await prisma.workspace.update({
      where: { id: params.workspaceId },
      data: { archivedAt: null },
    });
    await recordAuditEvent({
      actorId: user.id,
      workspaceId: updated.id,
      action: 'workspace.restore',
      resourceType: 'workspace',
      resourceId: updated.id,
      after: { archivedAt: null },
      request,
    });
    return reply.send(success({ id: updated.id, archivedAt: null }, createRequestId(request.id)));
  });

  app.post('/api/v1/workspaces/:workspaceId/recover', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    const membership = await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN'], { allowArchived: true, allowDeleted: true });
    const deletedAt = membership.workspace.deletedAt;
    if (!deletedAt || deletedAt <= new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000)) {
      throw new RequestError('This workspace is no longer available in trash.', 404);
    }
    const restored = await prisma.workspace.update({ where: { id: params.workspaceId }, data: { deletedAt: null } });
    await recordAuditEvent({
      actorId: user.id,
      workspaceId: restored.id,
      action: 'workspace.recovered',
      resourceType: 'workspace',
      resourceId: restored.id,
      before: { deletedAt },
      after: { deletedAt: null },
      request,
    });
    return reply.send(success({ id: restored.id, recovered: true }, createRequestId(request.id)));
  });

  app.delete('/api/v1/workspaces/:workspaceId', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);

    await requireMembership(params.workspaceId, user.id, ['OWNER'], { allowArchived: true });

    const deletedAt = new Date();
    const deleted = await prisma.$transaction(async (transaction) => {
      const workspace = await transaction.workspace.update({
        where: { id: params.workspaceId },
        data: { deletedAt },
      });
      await transaction.dashboardShare.updateMany({
        where: { dashboard: { workspaceId: params.workspaceId }, revokedAt: null },
        data: { revokedAt: deletedAt },
      });
      await transaction.workspaceInvite.updateMany({
        where: { workspaceId: params.workspaceId, acceptedAt: null, revokedAt: null },
        data: { revokedAt: deletedAt },
      });
      return workspace;
    });

    await recordAuditEvent({
      actorId: user.id,
      workspaceId: params.workspaceId,
      action: 'workspace.delete',
      resourceType: 'workspace',
      resourceId: deleted.id,
      after: deleted,
      request,
    });

    return reply.send(success({
      id: deleted.id,
      deleted: true,
      deletedAt: deleted.deletedAt.toISOString(),
      purgeAt: new Date(deleted.deletedAt.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    }, createRequestId(request.id)));
  });

  app.delete('/api/v1/dashboards/:dashboardId', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ dashboardId: idSchema }).parse(request.params);
    const dashboard = await prisma.dashboard.findFirst({
      where: { id: params.dashboardId, deletedAt: null },
    });
    if (!dashboard) throw new RequestError('Dashboard was not found.', 404);
    await requireMembership(dashboard.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR']);
    const deletedAt = new Date();
    const deleted = await prisma.$transaction(async (transaction) => {
      const row = await transaction.dashboard.update({ where: { id: dashboard.id }, data: { deletedAt } });
      await transaction.dashboardShare.updateMany({
        where: { dashboardId: dashboard.id, revokedAt: null },
        data: { revokedAt: deletedAt },
      });
      return row;
    });

    await recordAuditEvent({
      actorId: user.id,
      workspaceId: dashboard.workspaceId,
      action: 'dashboard.delete',
      resourceType: 'dashboard',
      resourceId: deleted.id,
      after: deleted,
      request,
    });

    return reply.send(success({
      id: deleted.id,
      deleted: true,
      deletedAt: deleted.deletedAt.toISOString(),
      purgeAt: new Date(deleted.deletedAt.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    }, createRequestId(request.id)));
  });

  app.post('/api/v1/dashboards/:dashboardId/recover', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ dashboardId: idSchema }).parse(request.params);
    const dashboard = await prisma.dashboard.findFirst({ where: { id: params.dashboardId } });
    if (!dashboard) throw new RequestError('This dashboard is no longer available in trash.', 404);
    await requireMembership(dashboard.workspaceId, user.id, ['OWNER', 'ADMIN', 'EDITOR']);
    if (!dashboard.deletedAt || dashboard.deletedAt <= new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000)) {
      throw new RequestError('This dashboard is no longer available in trash.', 404);
    }
    const recovered = await prisma.dashboard.update({ where: { id: dashboard.id }, data: { deletedAt: null } });
    await recordAuditEvent({
      actorId: user.id,
      workspaceId: dashboard.workspaceId,
      action: 'dashboard.recovered',
      resourceType: 'dashboard',
      resourceId: dashboard.id,
      before: { deletedAt: dashboard.deletedAt },
      after: { deletedAt: null },
      request,
    });
    return reply.send(success(serializeDashboard(recovered), createRequestId(request.id)));
  });

  app.get('/api/v1/workspaces/:workspaceId/activity', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    await requireMembership(params.workspaceId, user.id, [
      'OWNER', 'ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER',
    ]);

    const events = await prisma.auditEvent.findMany({
      where: { workspaceId: params.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        id: true,
        action: true,
        resourceType: true,
        createdAt: true,
        actor: { select: { displayName: true, avatarUrl: true } },
      },
    });

    return reply.send(success(events.map((event) => ({
      id: event.id,
      action: event.action,
      resourceType: event.resourceType,
      createdAt: event.createdAt.toISOString(),
      actor: event.actor ? {
        displayName: event.actor.displayName,
        avatarUrl: event.actor.avatarUrl,
      } : null,
    })), createRequestId(request.id)));
  });

  app.get('/api/v1/workspaces/:workspaceId/audit-events', async (request, reply) => {
    const user = await requireUser(request, auth);
    const params = z.object({ workspaceId: idSchema }).parse(request.params);
    await requireMembership(params.workspaceId, user.id, ['OWNER', 'ADMIN']);

    const events = await prisma.auditEvent.findMany({
      where: { workspaceId: params.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        actor: {
          select: { id: true, displayName: true, email: true, avatarUrl: true },
        },
      },
    });

    return reply.send(
      success(
        events.map((e) => ({
          id: e.id,
          action: e.action,
          resourceType: e.resourceType,
          resourceId: e.resourceId,
          createdAt: e.createdAt.toISOString(),
          actor: e.actor,
        })),
        createRequestId(request.id),
      ),
    );
  });
};
