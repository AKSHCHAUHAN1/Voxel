import { describe, expect, it, vi } from 'vitest';
import { processStorageDeletionQueue } from './workspace-retention.js';

describe('stored object deletion queue', () => {
  it('removes successful jobs and leaves failed jobs for retry', async () => {
    const jobs = [
      { id: 'job-ok', storageKey: 'workspaces/one/file-a' },
      { id: 'job-retry', storageKey: 'workspaces/one/file-b' },
    ];
    const database = {
      storageDeletionJob: {
        findMany: vi.fn().mockResolvedValue(jobs),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const storage = {
      delete: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Storage temporarily unavailable')),
    };
    const onError = vi.fn();

    await expect(processStorageDeletionQueue(storage, { database, onError, batchSize: 2 })).resolves.toEqual({
      processed: 2,
      deleted: 1,
    });
    expect(database.storageDeletionJob.deleteMany).toHaveBeenCalledWith({ where: { id: 'job-ok' } });
    expect(database.storageDeletionJob.updateMany).toHaveBeenCalledWith({
      where: { id: 'job-retry' },
      data: { attempts: { increment: 1 }, lastAttemptAt: expect.any(Date) },
    });
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'job-retry');
  });
});
