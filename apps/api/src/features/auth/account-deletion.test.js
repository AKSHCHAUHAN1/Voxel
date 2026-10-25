import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth-service.js';

const recentSession = () => ({ createdAt: new Date() });

const createDatabase = ({ session = recentSession(), workspaces = [], workspaceFiles = [], avatars = [] } = {}) => {
  const transaction = {
    storageDeletionJob: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    storedFile: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    workspace: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    dashboard: { update: vi.fn(), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    dashboardShare: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    workspaceInvite: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    dashboardVersion: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    workspaceMember: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    auditEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn().mockResolvedValue({}) },
    refreshToken: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    user: { delete: vi.fn().mockResolvedValue({}) },
  };
  const database = {
    user: { findUnique: vi.fn().mockResolvedValue({ id: 'user-id', mfaTotpEnabledAt: null }) },
    session: { findFirst: vi.fn().mockResolvedValue(session) },
    workspace: { findMany: vi.fn().mockResolvedValue(workspaces) },
    storedFile: { findMany: vi.fn().mockResolvedValueOnce(workspaceFiles).mockResolvedValueOnce(avatars) },
    dashboard: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn((operation) => operation(transaction)),
  };
  return { database, transaction };
};

describe('account deletion safeguards', () => {
  it('requires authentication within the last ten minutes', async () => {
    const { database } = createDatabase({
      session: { createdAt: new Date(Date.now() - 11 * 60 * 1_000) },
    });
    const auth = new AuthService(database, {});

    await expect(auth.deleteAccount('user-id', 'session-id')).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining('Sign in again'),
    });
    expect(database.workspace.findMany).not.toHaveBeenCalled();
  });

  it('requires an MFA factor before deleting an MFA-protected account', async () => {
    const { database } = createDatabase();
    database.user.findUnique.mockResolvedValue({ id: 'user-id', mfaTotpEnabledAt: new Date() });
    const auth = new AuthService(database, {});

    await expect(auth.deleteAccount('user-id', 'session-id')).rejects.toMatchObject({ statusCode: 401 });
    expect(database.workspace.findMany).not.toHaveBeenCalled();
  });

  it('queues workspace and personal avatar objects before removing account data', async () => {
    const { database, transaction } = createDatabase({
      workspaces: [{ id: 'workspace-id', members: [] }],
      workspaceFiles: [{ storageKey: 'workspaces/workspace-id/file-id' }],
      avatars: [{ id: 'avatar-file-id', storageKey: 'users/user-id/avatar-id', workspaceId: 'team-workspace-id', sizeBytes: 128n }],
    });
    const auth = new AuthService(database, {});

    await auth.deleteAccount('user-id', 'session-id');

    expect(transaction.storageDeletionJob.createMany).toHaveBeenCalledWith({
      data: [
        { storageKey: 'workspaces/workspace-id/file-id' },
        { storageKey: 'users/user-id/avatar-id' },
      ],
      skipDuplicates: true,
    });
    expect(transaction.storedFile.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['avatar-file-id'] } } });
    expect(transaction.workspace.updateMany).toHaveBeenCalledWith({
      where: { id: 'team-workspace-id' },
      data: { storageUsedBytes: { decrement: 128n } },
    });
    expect(transaction.auditEvent.create).toHaveBeenCalledWith({
      data: { actorId: 'user-id', action: 'account.deleted', resourceType: 'account', resourceId: 'self' },
    });
    expect(transaction.user.delete).toHaveBeenCalledWith({ where: { id: 'user-id' } });
  });
});
