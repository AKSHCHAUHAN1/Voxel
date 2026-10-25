import { describe, expect, it, vi } from 'vitest';
import { createObjectStorage } from './object-storage.js';
import { fileRouteInternals } from './file-routes.js';

const { validateFile, cleanName } = fileRouteInternals;

describe('workspace file validation', () => {
  it('accepts supported UTF-8 text and returns its SHA-256 digest', () => {
    const contents = Buffer.from('{"status":"ready"}', 'utf8');
    expect(validateFile(contents, 'report.json', 'application/json')).toMatch(/^[a-f0-9]{64}$/);
    expect(validateFile(Buffer.from('# Notes\nVoxel'), 'notes.md', 'text/markdown')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('checks signatures for images and PDF files', () => {
    expect(validateFile(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]), 'chart.png', 'image/png')).toMatch(/^[a-f0-9]{64}$/);
    expect(() => validateFile(Buffer.from('not a PDF'), 'report.pdf', 'application/pdf')).toThrow(/do not match/);
  });

  it('rejects mismatched types, malformed JSON, binary text, and oversized uploads', () => {
    expect(() => validateFile(Buffer.from('plain text'), 'data.json', 'application/json')).toThrow(/JSON file is invalid/);
    expect(() => validateFile(Buffer.from([0, 1]), 'data.csv', 'text/csv')).toThrow(/UTF-8/);
    expect(() => validateFile(Buffer.from('text'), 'image.png', 'image/png')).toThrow(/do not match/);
    expect(() => validateFile(Buffer.alloc(10 * 1024 * 1024 + 1), 'large.csv', 'text/csv')).toThrow(/10 MB/);
  });

  it('normalizes user supplied filenames without accepting paths or controls', () => {
    expect(cleanName(encodeURIComponent('../quarterly report.csv'))).toBe('quarterly report.csv');
    expect(() => cleanName('')).toThrow(/File name/);
  });
});

describe('S3-compatible object storage', () => {
  it('signs a bucket-scoped upload and downloads object bytes', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(Buffer.from('stored bytes'), { status: 200 }));
    const storage = createObjectStorage({
      endpoint: 'http://minio.local:9000',
      bucket: 'voxel-assets',
      region: 'us-east-1',
      accessKey: 'test-access',
      secretKey: 'test-secret',
      fetchImpl,
      clock: () => new Date('2026-10-11T10:15:30.000Z'),
    });

    await storage.put('workspaces/one/file', Buffer.from('image bytes'), 'image/png');
    const result = await storage.get('workspaces/one/file');

    expect(result.toString()).toBe('stored bytes');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url.pathname).toBe('/voxel-assets/workspaces/one/file');
    expect(init.method).toBe('PUT');
    expect(init.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=test-access\//);
    expect(init.headers['x-amz-content-sha256']).toMatch(/^[a-f0-9]{64}$/);
  });

  it('treats deleting a missing object as idempotent', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const storage = createObjectStorage({ endpoint: 'http://minio.local', bucket: 'voxel-assets', accessKey: 'a', secretKey: 'b', fetchImpl });
    await expect(storage.delete('missing')).resolves.toBeUndefined();
  });

  it('checks object-level readiness without requiring bucket listing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const storage = createObjectStorage({ endpoint: 'http://rustfs.local', bucket: 'voxel-assets', accessKey: 'a', secretKey: 'b', fetchImpl });

    await expect(storage.check()).resolves.toBeUndefined();
    expect(fetchImpl.mock.calls[0][0].pathname).toBe('/voxel-assets/__voxel_system__/readiness');
    expect(fetchImpl.mock.calls[0][1].method).toBe('HEAD');
  });
});
