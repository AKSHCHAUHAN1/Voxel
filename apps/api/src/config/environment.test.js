import { describe, expect, it } from 'vitest';
import { parseEnvironment } from './environment.js';

const baseEnvironment = {
  VOXEL_PUBLIC_APP_URL: 'https://app.voxel.example',
  DATABASE_URL: 'postgresql://voxel:secret@db.voxel.example:5432/voxel',
  REDIS_URL: 'redis://redis.voxel.example:6379',
  SESSION_SECRET: 'a-production-secret-that-is-at-least-thirty-two-characters-long',
};

describe('environment security requirements', () => {
  it('allows local development without production storage or email providers', () => {
    expect(parseEnvironment({ ...baseEnvironment, NODE_ENV: 'development', VOXEL_EMAIL_DELIVERY_URL: '', VOXEL_EMAIL_DELIVERY_TOKEN: '', VOXEL_EMAIL_FROM: '' }).NODE_ENV).toBe('development');
  });

  it('requires S3-compatible storage and an HTTPS email webhook in production', () => {
    expect(() => parseEnvironment({ ...baseEnvironment, NODE_ENV: 'production' })).toThrow(/Production/);
    expect(() => parseEnvironment({
      ...baseEnvironment,
      NODE_ENV: 'production',
      VOXEL_STORAGE_ENDPOINT: 'http://assets.voxel.example',
      VOXEL_STORAGE_BUCKET: 'voxel-assets',
      VOXEL_STORAGE_REGION: 'us-east-1',
      VOXEL_STORAGE_ACCESS_KEY: 'access',
      VOXEL_STORAGE_SECRET_KEY: 'secret',
      VOXEL_EMAIL_DELIVERY_URL: 'http://mail.voxel.example/send',
      VOXEL_EMAIL_DELIVERY_TOKEN: 'secret',
      VOXEL_EMAIL_FROM: 'noreply@voxel.example',
    })).toThrow(/HTTPS/);
  });
});
