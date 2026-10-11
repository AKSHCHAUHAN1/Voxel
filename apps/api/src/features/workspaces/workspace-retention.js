import { prisma } from '../../database/prisma.js';

const TRASH_RETENTION_DAYS = 30;

export async function purgeExpiredTrash(now = new Date()) {
  const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const [workspaces, dashboards] = await Promise.all([
    prisma.workspace.findMany({ where: { deletedAt: { lte: cutoff } }, select: { id: true } }),
    prisma.dashboard.findMany({ where: { deletedAt: { lte: cutoff } }, select: { id: true } }),
  ]);
  const workspaceIds = workspaces.map(({ id }) => id);
  const dashboardIds = dashboards.map(({ id }) => id);

  if (workspaceIds.length === 0 && dashboardIds.length === 0) return { workspaces: 0, dashboards: 0 };

  await prisma.$transaction(async (transaction) => {
    if (workspaceIds.length > 0) {
      await transaction.auditEvent.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
      await transaction.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    }
    if (dashboardIds.length > 0) {
      await transaction.dashboard.deleteMany({ where: { id: { in: dashboardIds } } });
    }
  });

  return { workspaces: workspaceIds.length, dashboards: dashboardIds.length };
}
