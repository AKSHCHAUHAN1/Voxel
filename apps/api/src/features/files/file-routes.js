import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createRequestId } from '@voxel/contracts';
import { prisma } from '../../database/prisma.js';
import { AuthService } from '../auth/auth-service.js';
import { createObjectStorage, ObjectStorageError } from './object-storage.js';
import { success } from '../../lib/api-response.js';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const rolesCanUpload = ['OWNER', 'ADMIN', 'EDITOR'];
const workspaceIdSchema = z.string().uuid();
const extensionMimeTypes = {
  png: ['image/png'], jpg: ['image/jpeg'], jpeg: ['image/jpeg'], gif: ['image/gif'], webp: ['image/webp'],
  pdf: ['application/pdf'], csv: ['text/csv', 'text/plain'], json: ['application/json'], md: ['text/markdown', 'text/plain'], markdown: ['text/markdown', 'text/plain'],
};

class FileRouteError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const cleanName = (rawName) => {
  let decoded;
  try { decoded = decodeURIComponent(rawName || ''); } catch { throw new FileRouteError('File name is invalid.', 422); }
  const name = decoded.replaceAll('\\', '/').split('/').at(-1)
    .split('').filter((character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127).join('').trim();
  if (!name || Buffer.byteLength(name, 'utf8') > 255 || name === '.' || name === '..') {
    throw new FileRouteError('File name must be between 1 and 255 bytes.', 422);
  }
  return name;
};

const validateFile = (buffer, name, contentType) => {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new FileRouteError('Choose a non-empty file.', 422);
  if (buffer.length > MAX_FILE_BYTES) throw new FileRouteError('Files must be 10 MB or smaller.', 413);
  const extension = name.split('.').at(-1)?.toLowerCase();
  const acceptedTypes = extensionMimeTypes[extension];
  if (!acceptedTypes || !acceptedTypes.includes(contentType)) {
    throw new FileRouteError('Supported files are images, PDF, CSV, JSON, and Markdown.', 415);
  }

  const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isGif = buffer.subarray(0, 6).toString('ascii').match(/^GIF8[79]a$/);
  const isWebp = buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  const isPdf = buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  const signatures = { png: isPng, jpg: isJpeg, jpeg: isJpeg, gif: isGif, webp: isWebp, pdf: isPdf };
  if (Object.hasOwn(signatures, extension)) {
    if (!signatures[extension]) throw new FileRouteError('The file contents do not match its file type.', 415);
  } else {
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      if (text.includes('\0')) throw new Error('Binary content is not allowed.');
      if (extension === 'json') JSON.parse(text);
    } catch {
      throw new FileRouteError(extension === 'json' ? 'The JSON file is invalid.' : 'Text files must use UTF-8 encoding.', 415);
    }
  }
  return createHash('sha256').update(buffer).digest('hex');
};

const serializeFile = (file, canDelete = false) => ({
  id: file.id,
  workspaceId: file.workspaceId,
  name: file.originalName,
  contentType: file.contentType,
  size: Number(file.sizeBytes),
  sha256: file.sha256,
  createdAt: file.createdAt.toISOString(),
  uploader: file.uploader ? { id: file.uploader.id, displayName: file.uploader.displayName } : null,
  canDelete,
});

const requireUser = async (request, auth) => {
  const user = await auth.getAuthenticatedUser(request.cookies.voxel_access);
  if (!user) throw new FileRouteError('Authentication is required.', 401);
  return user;
};

const requireMember = async (workspaceId, userId) => {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: { select: { id: true, archivedAt: true, deletedAt: true, coverImageUrl: true } } },
  });
  if (!membership || membership.workspace.archivedAt || membership.workspace.deletedAt) {
    throw new FileRouteError('Workspace not found.', 404);
  }
  return membership;
};

const nameForDisposition = (name) => {
  const fallback = name.replace(/[^\x20-\x7e]|["\\;]/g, '_') || 'download';
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
};
const linkedFileId = (url, routePattern) => {
  if (!url) return null;
  try { return new URL(url).pathname.match(routePattern)?.[1] ?? null; } catch { return null; }
};

const persistFile = async ({ workspaceId, userId, name, contentType, buffer, purpose = 'WORKSPACE', storage, storageKey }) => {
  const sha256 = validateFile(buffer, name, contentType);
  const id = randomUUID();
  const key = storageKey || `workspaces/${workspaceId}/${id}`;
  const file = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${workspaceId} FOR UPDATE`;
    const workspace = await tx.workspace.findUnique({ where: { id: workspaceId }, select: { storageUsedBytes: true, storageQuotaBytes: true } });
    if (!workspace) throw new FileRouteError('Workspace not found.', 404);
    if (workspace.storageUsedBytes + BigInt(buffer.length) > workspace.storageQuotaBytes) {
      throw new FileRouteError('This upload exceeds the workspace storage limit.', 413);
    }
    const reserved = await tx.storedFile.create({
      data: {
        id, workspaceId, uploaderId: userId, storageKey: key, originalName: name,
        contentType, sizeBytes: BigInt(buffer.length), sha256, purpose,
      },
    });
    await tx.workspace.update({ where: { id: workspaceId }, data: { storageUsedBytes: { increment: BigInt(buffer.length) } } });
    return reserved;
  });

  try {
    await storage.put(key, buffer, contentType);
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      await tx.storedFile.delete({ where: { id } });
      await tx.workspace.update({ where: { id: workspaceId }, data: { storageUsedBytes: { decrement: BigInt(buffer.length) } } });
    });
    throw error;
  }
  return file;
};

const removeStoredFile = async ({ file, storage, apiUrl }) => {
  await storage.delete(file.storageKey);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${file.workspaceId} FOR UPDATE`;
    const current = await tx.storedFile.findFirst({ where: { id: file.id, workspaceId: file.workspaceId, deletedAt: null } });
    if (!current) return;
    await tx.storedFile.update({ where: { id: current.id }, data: { deletedAt: new Date() } });
    await tx.workspace.update({ where: { id: file.workspaceId }, data: { storageUsedBytes: { decrement: current.sizeBytes } } });
    if (current.purpose === 'COVER') {
      const coverImageUrl = new URL(`/api/v1/workspaces/${file.workspaceId}/files/${file.id}/content`, apiUrl).toString();
      await tx.workspace.updateMany({ where: { id: file.workspaceId, coverImageUrl }, data: { coverImageUrl: null } });
    }
    if (current.purpose === 'AVATAR' && current.uploaderId) {
      const avatarUrl = new URL(`/api/v1/avatars/${file.id}`, apiUrl).toString();
      await tx.user.updateMany({ where: { id: current.uploaderId, avatarUrl }, data: { avatarUrl: null } });
    }
  });
};

export const registerFileRoutes = async (app, environment) => {
  const auth = new AuthService(prisma, environment);
  const storage = createObjectStorage({
    endpoint: environment.VOXEL_STORAGE_ENDPOINT || 'http://localhost:9000',
    bucket: environment.VOXEL_STORAGE_BUCKET || 'voxel-assets',
    region: environment.VOXEL_STORAGE_REGION || 'us-east-1',
    accessKey: environment.VOXEL_STORAGE_ACCESS_KEY || 'voxel',
    secretKey: environment.VOXEL_STORAGE_SECRET_KEY || 'voxel-development-only',
  });

  app.post('/api/v1/workspaces/:workspaceId/files', { bodyLimit: MAX_FILE_BYTES }, async (request, reply) => {
    const user = await requireUser(request, auth);
    const { workspaceId } = z.object({ workspaceId: workspaceIdSchema }).parse(request.params);
    const membership = await requireMember(workspaceId, user.id);
    if (!rolesCanUpload.includes(membership.role)) throw new FileRouteError('You do not have permission to upload files.', 403);

    const name = cleanName(request.headers['x-file-name']);
    const contentType = String(request.headers['x-file-content-type'] || '').toLowerCase().split(';')[0].trim();
    const buffer = request.body;
    const file = await persistFile({ workspaceId, userId: user.id, name, contentType, buffer, storage });

    return reply.status(201).send(success({ ...serializeFile(file, true), url: `/api/v1/workspaces/${workspaceId}/files/${file.id}/content` }, createRequestId(request.id)));
  });

  app.post('/api/v1/auth/me/avatar', { bodyLimit: MAX_FILE_BYTES }, async (request, reply) => {
    const user = await requireUser(request, auth);
    const currentUser = await prisma.user.findUnique({ where: { id: user.id }, select: { avatarUrl: true } });
    const name = cleanName(request.headers['x-file-name']);
    const contentType = String(request.headers['x-file-content-type'] || '').toLowerCase().split(';')[0].trim();
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(contentType)) {
      throw new FileRouteError('Profile avatars must be PNG, JPEG, GIF, or WebP images.', 415);
    }
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, workspace: { deletedAt: null, archivedAt: null } },
      orderBy: { createdAt: 'asc' },
      select: { workspaceId: true },
    });
    if (!membership) throw new FileRouteError('Create or join a workspace before uploading a profile image.', 409);
    const file = await persistFile({
      workspaceId: membership.workspaceId,
      userId: user.id,
      name,
      contentType,
      buffer: request.body,
      purpose: 'AVATAR',
      storage,
      storageKey: `users/${user.id}/avatars/${randomUUID()}`,
    });
    const avatarUrl = new URL(`/api/v1/avatars/${file.id}`, environment.VOXEL_API_PUBLIC_URL || 'http://localhost:3000').toString();
    await prisma.user.update({ where: { id: user.id }, data: { avatarUrl } });
    const previousAvatarId = linkedFileId(currentUser?.avatarUrl, /\/api\/v1\/avatars\/([0-9a-f-]{36})$/i);
    if (previousAvatarId) {
      const previousAvatar = await prisma.storedFile.findFirst({ where: { id: previousAvatarId, uploaderId: user.id, purpose: 'AVATAR', deletedAt: null } });
      if (previousAvatar) await removeStoredFile({ file: previousAvatar, storage, apiUrl: environment.VOXEL_API_PUBLIC_URL || 'http://localhost:3000' }).catch((error) => request.log.warn({ err: error }, 'Previous profile image could not be removed'));
    }
    return reply.send(success({ avatarUrl }, createRequestId(request.id)));
  });

  app.get('/api/v1/avatars/:fileId', async (request, reply) => {
    const { fileId } = z.object({ fileId: z.string().uuid() }).parse(request.params);
    const file = await prisma.storedFile.findFirst({ where: { id: fileId, purpose: 'AVATAR', deletedAt: null } });
    if (!file) throw new FileRouteError('Avatar not found.', 404);
    const contents = await storage.get(file.storageKey);
    return reply
      .header('content-type', file.contentType)
      .header('content-length', String(file.sizeBytes))
      .header('x-content-type-options', 'nosniff')
      .header('cache-control', 'public, max-age=3600, immutable')
      .send(contents);
  });

  app.post('/api/v1/workspaces/:workspaceId/cover-image', { bodyLimit: MAX_FILE_BYTES }, async (request, reply) => {
    const user = await requireUser(request, auth);
    const { workspaceId } = z.object({ workspaceId: workspaceIdSchema }).parse(request.params);
    const membership = await requireMember(workspaceId, user.id);
    if (!['OWNER', 'ADMIN'].includes(membership.role)) throw new FileRouteError('Only workspace owners and admins can update its cover.', 403);
    const name = cleanName(request.headers['x-file-name']);
    const contentType = String(request.headers['x-file-content-type'] || '').toLowerCase().split(';')[0].trim();
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(contentType)) {
      throw new FileRouteError('Workspace covers must be PNG, JPEG, GIF, or WebP images.', 415);
    }
    const file = await persistFile({
      workspaceId,
      userId: user.id,
      name,
      contentType,
      buffer: request.body,
      purpose: 'COVER',
      storage,
      storageKey: `workspaces/${workspaceId}/covers/${randomUUID()}`,
    });
    const coverImageUrl = new URL(`/api/v1/workspaces/${workspaceId}/files/${file.id}/content`, environment.VOXEL_API_PUBLIC_URL || 'http://localhost:3000').toString();
    const previousCoverId = linkedFileId(membership.workspace.coverImageUrl, /\/files\/([0-9a-f-]{36})\/content$/i);
    await prisma.workspace.update({ where: { id: workspaceId }, data: { coverImageUrl } });
    if (previousCoverId) {
      const previousCover = await prisma.storedFile.findFirst({ where: { id: previousCoverId, workspaceId, purpose: 'COVER', deletedAt: null } });
      if (previousCover) await removeStoredFile({ file: previousCover, storage, apiUrl: environment.VOXEL_API_PUBLIC_URL || 'http://localhost:3000' }).catch((error) => request.log.warn({ err: error }, 'Previous workspace cover could not be removed'));
    }
    return reply.send(success({ coverImageUrl }, createRequestId(request.id)));
  });

  app.get('/api/v1/workspaces/:workspaceId/files', async (request, reply) => {
    const user = await requireUser(request, auth);
    const { workspaceId } = z.object({ workspaceId: workspaceIdSchema }).parse(request.params);
    const membership = await requireMember(workspaceId, user.id);
    const [files, workspace] = await Promise.all([
      prisma.storedFile.findMany({ where: { workspaceId, purpose: 'WORKSPACE', deletedAt: null }, include: { uploader: { select: { id: true, displayName: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.workspace.findUnique({ where: { id: workspaceId }, select: { storageUsedBytes: true, storageQuotaBytes: true } }),
    ]);
    return reply.send(success({
      files: files.map((file) => serializeFile(file, file.uploaderId === user.id || ['OWNER', 'ADMIN'].includes(membership.role))),
      canUpload: rolesCanUpload.includes(membership.role),
      storageUsedBytes: Number(workspace.storageUsedBytes),
      storageQuotaBytes: Number(workspace.storageQuotaBytes),
    }, createRequestId(request.id)));
  });

  app.get('/api/v1/workspaces/:workspaceId/files/:fileId', async (request, reply) => {
    const user = await requireUser(request, auth);
    const { workspaceId, fileId } = z.object({ workspaceId: workspaceIdSchema, fileId: z.string().uuid() }).parse(request.params);
    const membership = await requireMember(workspaceId, user.id);
    const file = await prisma.storedFile.findFirst({ where: { id: fileId, workspaceId, purpose: 'WORKSPACE', deletedAt: null }, include: { uploader: { select: { id: true, displayName: true } } } });
    if (!file) throw new FileRouteError('File not found.', 404);
    return reply.send(success(serializeFile(file, file.uploaderId === user.id || ['OWNER', 'ADMIN'].includes(membership.role)), createRequestId(request.id)));
  });

  app.get('/api/v1/workspaces/:workspaceId/files/:fileId/content', async (request, reply) => {
    const user = await requireUser(request, auth);
    const { workspaceId, fileId } = z.object({ workspaceId: workspaceIdSchema, fileId: z.string().uuid() }).parse(request.params);
    await requireMember(workspaceId, user.id);
    const file = await prisma.storedFile.findFirst({ where: { id: fileId, workspaceId, deletedAt: null } });
    if (!file) throw new FileRouteError('File not found.', 404);
    const contents = await storage.get(file.storageKey);
    return reply
      .header('content-type', file.contentType)
      .header('content-length', String(file.sizeBytes))
      .header('content-disposition', nameForDisposition(file.originalName))
      .header('x-content-type-options', 'nosniff')
      .header('cache-control', 'private, no-store')
      .send(contents);
  });

  app.delete('/api/v1/workspaces/:workspaceId/files/:fileId', async (request, reply) => {
    const user = await requireUser(request, auth);
    const { workspaceId, fileId } = z.object({ workspaceId: workspaceIdSchema, fileId: z.string().uuid() }).parse(request.params);
    const membership = await requireMember(workspaceId, user.id);
    const file = await prisma.storedFile.findFirst({ where: { id: fileId, workspaceId, deletedAt: null } });
    if (!file) throw new FileRouteError('File not found.', 404);
    if (file.uploaderId !== user.id && !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new FileRouteError('Only the uploader or a workspace administrator can delete this file.', 403);
    }
    await removeStoredFile({ file, storage, apiUrl: environment.VOXEL_API_PUBLIC_URL || 'http://localhost:3000' });
    return reply.status(204).send();
  });
};

export const fileRouteInternals = { validateFile, cleanName, serializeFile, ObjectStorageError };
