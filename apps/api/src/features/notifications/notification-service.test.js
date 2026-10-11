import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    workspaceMember: { findMany: vi.fn() },
    notification: { createMany: vi.fn(), create: vi.fn() },
    user: { findFirst: vi.fn() },
  },
}));

vi.mock('../../database/prisma.js', () => ({ prisma: prismaMock }));

const { notifyMentionedUsers, notifyVerifiedUserByEmail, notifyWorkspaceMembers } = await import('./notification-service.js');

beforeEach(() => vi.clearAllMocks());

describe('notification event delivery', () => {
  it('notifies workspace members once and excludes the actor', async () => {
    prismaMock.workspaceMember.findMany.mockResolvedValue([
      { userId: 'actor' }, { userId: 'member-a' }, { userId: 'member-b' }, { userId: 'member-a' },
    ]);
    prismaMock.notification.createMany.mockResolvedValue({ count: 2 });

    const count = await notifyWorkspaceMembers({
      workspaceId: 'workspace-1',
      actorId: 'actor',
      type: 'collaboration.comment',
      title: 'New comment',
      message: 'A comment was added.',
      payload: { dashboardId: 'dashboard-1' },
    });

    expect(count).toBe(2);
    expect(prismaMock.notification.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'member-a', actorId: 'actor', type: 'collaboration.comment', title: 'New comment', message: 'A comment was added.', payload: { dashboardId: 'dashboard-1' } },
        { userId: 'member-b', actorId: 'actor', type: 'collaboration.comment', title: 'New comment', message: 'A comment was added.', payload: { dashboardId: 'dashboard-1' } },
      ],
    });
  });

  it('sends direct notification only to an existing verified account', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'recipient' });
    prismaMock.notification.create.mockResolvedValue({ id: 'notification' });

    const created = await notifyVerifiedUserByEmail({
      email: 'MEMBER@example.com',
      actorId: 'actor',
      type: 'workspace.invite',
      title: 'Workspace invitation',
      message: 'Join the workspace.',
      payload: { inviteToken: 'secret-token' },
    });

    expect(created).toBe(true);
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { email: 'member@example.com', emailVerified: true, deletedAt: null },
      select: { id: true },
    });
    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: { userId: 'recipient', actorId: 'actor', type: 'workspace.invite', title: 'Workspace invitation', message: 'Join the workspace.', payload: { inviteToken: 'secret-token' } },
    });
  });

  it('notifies only verified workspace members explicitly mentioned in a comment', async () => {
    prismaMock.workspaceMember.findMany.mockResolvedValue([{ userId: 'member-a', user: { preferences: { notifications: { mentions: true } } } }]);
    prismaMock.notification.createMany.mockResolvedValue({ count: 1 });

    const recipients = await notifyMentionedUsers({
      workspaceId: 'workspace-1',
      actorId: 'actor',
      emails: [' MEMBER@example.com ', 'member@example.com'],
      title: 'Casey mentioned you',
      message: 'You were mentioned in Launch.',
      payload: { dashboardId: 'dashboard-1' },
    });

    expect(recipients).toEqual(['member-a']);
    expect(prismaMock.workspaceMember.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1', user: { email: { in: ['member@example.com'] }, emailVerified: true, deletedAt: null } },
      select: { userId: true, user: { select: { preferences: true } } },
    });
    expect(prismaMock.notification.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'member-a', actorId: 'actor', type: 'collaboration.mention', title: 'Casey mentioned you', message: 'You were mentioned in Launch.', payload: { dashboardId: 'dashboard-1' } }],
    });
  });

  it('respects the account preference that disables mention notifications', async () => {
    prismaMock.workspaceMember.findMany.mockResolvedValue([{ userId: 'member-a', user: { preferences: { notifications: { mentions: false } } } }]);
    const recipients = await notifyMentionedUsers({
      workspaceId: 'workspace-1', actorId: 'actor', emails: ['member@example.com'],
      title: 'Mention', message: 'Mentioned.',
    });

    expect(recipients).toEqual([]);
    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
  });
});
