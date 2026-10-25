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

const searchQuerySchema = z.object({ q: z.string().trim().min(2).max(80).transform((query) => query.toLowerCase()) });
const limit = 8;

export const registerSearchRoutes = async (app, environment) => {
  const auth = new AuthService(prisma, environment);

  app.get('/api/v1/search', async (request, reply) => {
    const user = await auth.getAuthenticatedUser(request.cookies.voxel_access);
    if (!user) throw new RequestError('Authentication is required.', 401);

    const { q: query } = searchQuerySchema.parse(request.query);
    const memberships = await prisma.workspaceMember.findMany({
      where: {
        userId: user.id,
        workspace: { deletedAt: null, archivedAt: null },
      },
      select: {
        workspaceId: true,
        role: true,
        workspace: { select: { id: true, name: true, description: true } },
      },
    });
    const workspaceIds = memberships.map(({ workspaceId }) => workspaceId);
    const elevatedWorkspaceIds = memberships
      .filter(({ role }) => role === 'OWNER' || role === 'ADMIN')
      .map(({ workspaceId }) => workspaceId);
    const regularWorkspaceIds = memberships
      .filter(({ role }) => role !== 'OWNER' && role !== 'ADMIN')
      .map(({ workspaceId }) => workspaceId);
    const normalizedQuery = query.toLowerCase();
    const workspaces = memberships
      .map(({ workspace, role }) => ({ ...workspace, role }))
      .filter((workspace) => `${workspace.name} ${workspace.description || ''}`.toLowerCase().includes(normalizedQuery))
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, limit);

    if (workspaceIds.length === 0) {
      return reply.send(success({ query, workspaces, dashboards: [], widgets: [], templates: [], members: [] }, createRequestId(request.id)));
    }

    const searchableText = { contains: query, mode: 'insensitive' };
    const [dashboards, templates, members, widgets] = await Promise.all([
      prisma.dashboard.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          deletedAt: null,
          OR: [{ name: searchableText }, { description: searchableText }, { tags: { has: query } }],
        },
        select: {
          id: true,
          workspaceId: true,
          name: true,
          description: true,
          tags: true,
          status: true,
          updatedAt: true,
          workspace: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      prisma.dashboardTemplate.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          AND: [
            {
              OR: [
                { name: searchableText },
                { description: searchableText },
                { category: searchableText },
                { tags: { has: query } },
              ],
            },
            {
              OR: [
                { workspaceId: { in: elevatedWorkspaceIds } },
                {
                  workspaceId: { in: regularWorkspaceIds },
                  OR: [{ isPublished: true }, { createdById: user.id }],
                },
              ],
            },
          ],
        },
        select: {
          id: true,
          workspaceId: true,
          name: true,
          description: true,
          category: true,
          tags: true,
          isPublished: true,
          updatedAt: true,
          workspace: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      prisma.workspaceMember.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          user: {
            OR: [
              { displayName: searchableText },
              { email: searchableText },
            ],
          },
        },
        select: {
          id: true,
          workspaceId: true,
          role: true,
          user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
          workspace: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
      }),
      prisma.$queryRaw`
        SELECT
          node->>'id' AS id,
          node->>'title' AS title,
          node->>'type' AS type,
          d.id AS "dashboardId",
          d."workspaceId" AS "workspaceId",
          d.name AS "dashboardName",
          w.name AS "workspaceName"
        FROM "Dashboard" d
        INNER JOIN "Workspace" w ON w.id = d."workspaceId"
        INNER JOIN "WorkspaceMember" m ON m."workspaceId" = w.id AND m."userId" = ${user.id}::uuid
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(d.scene->'nodes') = 'array' THEN d.scene->'nodes'
            ELSE '[]'::jsonb
          END
        ) AS node
        WHERE d."deletedAt" IS NULL
          AND w."deletedAt" IS NULL
          AND w."archivedAt" IS NULL
          AND node->>'id' IS NOT NULL
          AND to_tsvector('simple', d.scene::text) @@ plainto_tsquery('simple', ${query})
          AND to_tsvector('simple', node::text) @@ plainto_tsquery('simple', ${query})
        ORDER BY d."updatedAt" DESC
        LIMIT ${limit}
      `,
    ]);

    const result = {
      query,
      workspaces,
      dashboards: dashboards.map(({ workspace, ...dashboard }) => ({ ...dashboard, workspaceName: workspace.name })),
      widgets,
      templates: templates.map(({ workspace, ...template }) => ({ ...template, workspaceName: workspace.name })),
      members: members.map(({ workspace, ...member }) => ({ ...member, workspaceName: workspace.name })),
    };

    return reply.send(success(result, createRequestId(request.id)));
  });
};
