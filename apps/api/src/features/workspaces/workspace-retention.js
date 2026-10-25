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
      const files = await transaction.storedFile.findMany({
        where: { workspaceId: { in: workspaceIds } },
        select: { storageKey: true },
      });
      if (files.length) {
        await transaction.storageDeletionJob.createMany({
          data: files.map(({ storageKey }) => ({ storageKey })),
          skipDuplicates: true,
        });
      }
      await transaction.auditEvent.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
      await transaction.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    }
    if (dashboardIds.length > 0) {
      await transaction.dashboard.deleteMany({ where: { id: { in: dashboardIds } } });
    }
  });

  return { workspaces: workspaceIds.length, dashboards: dashboardIds.length };
}

export async function processStorageDeletionQueue(storage, { database = prisma, onError = () => {}, batchSize = 100 } = {}) {
  const jobs = await database.storageDeletionJob.findMany({
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });
  let deleted = 0;

  for (const job of jobs) {
    try {
      await storage.delete(job.storageKey);
      await database.storageDeletionJob.deleteMany({ where: { id: job.id } });
      deleted += 1;
    } catch (error) {
      await database.storageDeletionJob.updateMany({
        where: { id: job.id },
        data: { attempts: { increment: 1 }, lastAttemptAt: new Date() },
      });
      onError(error, job.id);
    }
  }

  return { processed: jobs.length, deleted };
}
