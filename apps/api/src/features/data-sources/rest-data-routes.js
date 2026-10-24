import { z } from 'zod';
import { createRequestId } from '@voxel/contracts';
import { prisma } from '../../database/prisma.js';
import { AuthService } from '../auth/auth-service.js';
import { success } from '../../lib/api-response.js';
import { fetchPublicGraphqlJson, fetchPublicRestJson } from './rest-data-source.js';

class RestDataRequestError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const dashboardIdSchema = z.string().uuid();
const inputSchema = z.object({ url: z.string().trim().min(1).max(2048) }).strict();
const graphqlInputSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  query: z.string().trim().min(1).max(20_000),
  variables: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const registerRestDataRoutes = async (app, environment, {
  fetchJson = fetchPublicRestJson,
  fetchGraphql = fetchPublicGraphqlJson,
} = {}) => {
  const auth = new AuthService(prisma, environment);

  const requireDashboardMember = async (request, dashboardId) => {
    const user = await auth.getAuthenticatedUser(request.cookies.voxel_access);
    if (!user) throw new RestDataRequestError('Authentication is required.', 401);

    const dashboard = await prisma.dashboard.findFirst({
      where: { id: dashboardId, deletedAt: null },
      select: { id: true, workspaceId: true, status: true },
    });
    if (!dashboard || dashboard.status === 'ARCHIVED') {
      throw new RestDataRequestError('Dashboard was not found.', 404);
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: dashboard.workspaceId, userId: user.id } },
      include: { workspace: { select: { id: true, archivedAt: true, deletedAt: true } } },
    });
    if (!membership || membership.workspace.archivedAt || membership.workspace.deletedAt) {
      throw new RestDataRequestError('Dashboard was not found.', 404);
    }
  };

  app.post('/api/v1/dashboards/:dashboardId/data-sources/rest', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { dashboardId } = z.object({ dashboardId: dashboardIdSchema }).parse(request.params);
    await requireDashboardMember(request, dashboardId);
    const { url } = inputSchema.parse(request.body);
    const value = await fetchJson(url);
    return reply.send(success({ value }, createRequestId(request.id)));
  });

  app.post('/api/v1/dashboards/:dashboardId/data-sources/graphql', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { dashboardId } = z.object({ dashboardId: dashboardIdSchema }).parse(request.params);
    await requireDashboardMember(request, dashboardId);
    const { url, query, variables = {} } = graphqlInputSchema.parse(request.body);
    const value = await fetchGraphql(url, query, variables);
    if (value && typeof value === 'object' && Array.isArray(value.errors) && value.errors.length > 0) {
      throw new RestDataRequestError('The GraphQL endpoint returned query errors.', 502);
    }
    return reply.send(success({ value }, createRequestId(request.id)));
  });
};
