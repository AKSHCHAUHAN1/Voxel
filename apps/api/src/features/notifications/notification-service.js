import { prisma } from '../../database/prisma.js';

export async function notifyWorkspaceMembers({ workspaceId, actorId, type, title, message, payload = {}, excludeUserIds = [] }, request) {
  try {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: { userId: true },
    });
    const excluded = new Set([actorId, ...excludeUserIds]);
    const recipientIds = [...new Set(members.map(({ userId }) => userId).filter((userId) => !excluded.has(userId)))];
    if (recipientIds.length === 0) return 0;
    const result = await prisma.notification.createMany({
      data: recipientIds.map((userId) => ({ userId, actorId, type, title, message, payload })),
    });
    return result.count;
  } catch (error) {
    request?.log?.error({ err: error, workspaceId, type }, 'Could not create workspace notifications');
    return 0;
  }
}

export async function notifyMentionedUsers({ workspaceId, actorId, emails, title, message, payload = {} }, request) {
  try {
    const normalizedEmails = [...new Set(emails.map((email) => email.trim().toLowerCase()))];
    if (normalizedEmails.length === 0) return [];
    const members = await prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        user: { email: { in: normalizedEmails }, emailVerified: true, deletedAt: null },
      },
      select: { userId: true, user: { select: { preferences: true } } },
    });
    const recipients = [...new Map(members
      .filter(({ userId, user }) => userId !== actorId && user?.preferences?.notifications?.mentions !== false)
      .map((member) => [member.userId, member])).values()];
    if (recipients.length === 0) return [];
    await prisma.notification.createMany({
      data: recipients.map(({ userId }) => ({
        userId,
        actorId,
        type: 'collaboration.mention',
        title,
        message,
        payload,
      })),
    });
    return recipients.map(({ userId }) => userId);
  } catch (error) {
    request?.log?.error({ err: error, workspaceId }, 'Could not create mention notifications');
    return [];
  }
}

export async function notifyVerifiedUserByEmail({ email, actorId, type, title, message, payload = {} }, request) {
  try {
    const recipient = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), emailVerified: true, deletedAt: null },
      select: { id: true },
    });
    if (!recipient || recipient.id === actorId) return false;
    await prisma.notification.create({
      data: { userId: recipient.id, actorId, type, title, message, payload },
    });
    return true;
  } catch (error) {
    request?.log?.error({ err: error, type }, 'Could not create direct notification');
    return false;
  }
}
