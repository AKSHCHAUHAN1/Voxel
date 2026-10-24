import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { ZodError } from 'zod';

const { prismaMock, transaction } = vi.hoisted(() => {
  const transaction = {
    $queryRaw: vi.fn(),
    workspace: { findUnique: vi.fn(), update: vi.fn() },
    storedFile: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  };
  return {
    transaction,
    prismaMock: {
      workspaceMember: { findUnique: vi.fn(), findFirst: vi.fn() },
      workspace: { findUnique: vi.fn(), update: vi.fn() },
      storedFile: { findMany: vi.fn(), findFirst: vi.fn() },
      user: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
      $transaction: vi.fn(async (operation) => operation(transaction)),
    },
  };
});

vi.mock('../../database/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../auth/auth-service.js', () => ({ AuthService: class {
  async getAuthenticatedUser() { return { id: '2baceac7-988c-4ad6-b22d-53e74f55562f', email: 'alex@example.com' }; }
} }));

const { registerFileRoutes } = await import('./file-routes.js');
const workspaceId = '9f4f0208-352b-4ed2-9ed9-b12f3cc4c095';
const workspaceFileId = 'ce0203ef-8302-43c1-b52a-35528caa10cc';
const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const csv = Buffer.from('Month,Revenue\nJan,12\n');
const environment = {
  NODE_ENV: 'test',
  VOXEL_STORAGE_ENDPOINT: 'http://minio.test:9000',
  VOXEL_STORAGE_BUCKET: 'voxel-assets',
  VOXEL_STORAGE_REGION: 'us-east-1',
  VOXEL_STORAGE_ACCESS_KEY: 'test-access',
  VOXEL_STORAGE_SECRET_KEY: 'test-secret',
};
let app;
let fetchMock;

beforeEach(async () => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (operation) => operation(transaction));
  fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  prismaMock.workspaceMember.findUnique.mockResolvedValue({
    role: 'EDITOR',
    workspace: { id: workspaceId, archivedAt: null, deletedAt: null },
  });
  transaction.workspace.findUnique.mockResolvedValue({ storageUsedBytes: 0n, storageQuotaBytes: 1024n });
  transaction.storedFile.create.mockImplementation(({ data }) => ({ ...data, createdAt: new Date(), uploader: null }));
  prismaMock.storedFile.findFirst.mockResolvedValue(null);
  prismaMock.user.findUnique.mockResolvedValue({ avatarUrl: null });
  prismaMock.user.update.mockResolvedValue({});
  prismaMock.workspaceMember.findFirst.mockResolvedValue({ workspaceId });
  app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) => reply.status(error instanceof ZodError ? 422 : error.statusCode || 500).send({ error: error.message }));
  await app.register(cookie);
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: 10 * 1024 * 1024 }, (_request, body, done) => done(null, body));
  await registerFileRoutes(app, environment);
});

afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.unstubAllGlobals();
});

describe('workspace file routes', () => {
  it('accepts a bounded raw binary upload, reserves quota, and stores the object', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspaceId}/files`,
      headers: {
        cookie: `voxel_access=test-session`,
        'content-type': 'application/octet-stream',
        'x-file-name': 'pixel.png',
        'x-file-content-type': 'image/png',
      },
      payload: image,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({ name: 'pixel.png', contentType: 'image/png', size: image.length });
    expect(fetchMock).toHaveBeenCalledWith(expect.objectContaining({ pathname: expect.stringMatching(/voxel-assets\/workspaces/) }), expect.objectContaining({ method: 'PUT' }));
  });

  it('rejects workspace roles that cannot upload before reserving storage', async () => {
    prismaMock.workspaceMember.findUnique.mockResolvedValue({ role: 'VIEWER', workspace: { id: workspaceId, archivedAt: null, deletedAt: null } });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspaceId}/files`,
      headers: { cookie: 'voxel_access=test-session', 'content-type': 'application/octet-stream', 'x-file-name': 'pixel.png', 'x-file-content-type': 'image/png' },
      payload: image,
    });

    expect(response.statusCode).toBe(403);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serves a workspace file only to an active workspace member', async () => {
    prismaMock.workspaceMember.findUnique.mockResolvedValue(null);
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${workspaceId}/files/${workspaceFileId}/content`,
      headers: { cookie: 'voxel_access=test-session' },
    });

    expect(response.statusCode).toBe(404);
    expect(prismaMock.storedFile.findFirst).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns workspace file bytes with private, no-store headers for a member', async () => {
    prismaMock.storedFile.findFirst.mockResolvedValue({
      id: workspaceFileId,
      workspaceId,
      purpose: 'WORKSPACE',
      storageKey: `workspaces/${workspaceId}/${workspaceFileId}`,
      originalName: 'report.csv',
      contentType: 'text/csv',
      sizeBytes: BigInt(csv.length),
      deletedAt: null,
    });
    fetchMock.mockResolvedValue(new Response(csv, { status: 200 }));

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${workspaceId}/files/${workspaceFileId}/content`,
      headers: { cookie: 'voxel_access=test-session' },
    });

    expect(response.statusCode).toBe(200);
    expect(Buffer.from(response.rawPayload).equals(csv)).toBe(true);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('rejects an upload that would exceed the workspace quota', async () => {
    prismaMock.$transaction.mockImplementation(async (operation) => operation({
      $queryRaw: vi.fn(),
      workspace: { findUnique: vi.fn().mockResolvedValue({ storageUsedBytes: 1020n, storageQuotaBytes: 1024n }), update: vi.fn() },
      storedFile: { create: vi.fn(), delete: vi.fn() },
    }));
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspaceId}/files`,
      headers: { cookie: 'voxel_access=test-session', 'content-type': 'application/octet-stream', 'x-file-name': 'pixel.png', 'x-file-content-type': 'image/png' },
      payload: image,
    });

    expect(response.statusCode).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stores an avatar privately and exposes it only through its public image route', async () => {
    const upload = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/me/avatar',
      headers: { cookie: 'voxel_access=test-session', 'content-type': 'application/octet-stream', 'x-file-name': 'profile.png', 'x-file-content-type': 'image/png' },
      payload: image,
    });

    expect(upload.statusCode).toBe(200);
    const avatarUrl = upload.json().data.avatarUrl;
    expect(avatarUrl).toMatch(/^http:\/\/localhost:3000\/api\/v1\/avatars\/[0-9a-f-]{36}$/i);
    expect(transaction.storedFile.create.mock.calls[0][0].data.purpose).toBe('AVATAR');
    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { avatarUrl } }));

    const fileId = avatarUrl.split('/').at(-1);
    prismaMock.storedFile.findFirst.mockResolvedValue({ id: fileId, purpose: 'AVATAR', storageKey: 'users/avatar', contentType: 'image/png', sizeBytes: BigInt(image.length) });
    fetchMock.mockResolvedValue(new Response(image, { status: 200 }));
    const download = await app.inject({ method: 'GET', url: `/api/v1/avatars/${fileId}` });
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-type']).toBe('image/png');
    expect(download.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.from(download.rawPayload).equals(image)).toBe(true);
  });

  it('lets workspace administrators upload a cover using the same quota accounting', async () => {
    prismaMock.workspaceMember.findUnique.mockResolvedValue({
      role: 'ADMIN',
      workspace: { id: workspaceId, archivedAt: null, deletedAt: null, coverImageUrl: null },
    });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspaceId}/cover-image`,
      headers: { cookie: 'voxel_access=test-session', 'content-type': 'application/octet-stream', 'x-file-name': 'cover.png', 'x-file-content-type': 'image/png' },
      payload: image,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.coverImageUrl).toContain(`/api/v1/workspaces/${workspaceId}/files/`);
    expect(transaction.storedFile.create.mock.calls[0][0].data.purpose).toBe('COVER');
    expect(prismaMock.workspace.update).toHaveBeenCalledWith(expect.objectContaining({ data: { coverImageUrl: response.json().data.coverImageUrl } }));
  });
});
