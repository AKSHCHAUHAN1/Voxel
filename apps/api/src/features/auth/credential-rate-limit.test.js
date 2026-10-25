import { describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { createCredentialRateLimiter } from './credential-rate-limit.js';

const hashKey = 'a-stable-private-server-side-limiter-key-with-at-least-32-characters';

describe('credential rate limiter', () => {
  it('uses an atomic Redis counter keyed by a normalized, hashed identifier', async () => {
    const redis = { eval: vi.fn().mockResolvedValue([3, 417]) };
    const limit = createCredentialRateLimiter(redis, hashKey);

    const result = await limit({
      scope: 'login',
      identifier: ' Alex@Example.com ',
      max: 3,
      windowSeconds: 900,
    });

    expect(result).toEqual({ allowed: true, retryAfterSeconds: 417 });
    expect(redis.eval).toHaveBeenCalledTimes(1);
    const [script, keyCount, key, ttl] = redis.eval.mock.calls[0];
    expect(script).toContain("redis.call('INCR'");
    expect(keyCount).toBe(1);
    expect(key).toMatch(/^voxel:auth-credential:login:[a-f0-9]{64}$/);
    expect(key.endsWith(createHmac('sha256', hashKey).update('alex@example.com').digest('hex'))).toBe(true);
    expect(key).not.toContain('alex');
    expect(ttl).toBe('900');
  });

  it('denies attempts above the configured account limit', async () => {
    const limit = createCredentialRateLimiter({ eval: vi.fn().mockResolvedValue([4, 3]) }, hashKey);

    await expect(limit({
      scope: 'password-reset',
      identifier: 'alex@example.com',
      max: 3,
      windowSeconds: 3600,
    })).resolves.toEqual({ allowed: false, retryAfterSeconds: 3 });
  });

  it('refuses to create credential keys without a stable private key', () => {
    expect(() => createCredentialRateLimiter({ eval: vi.fn() }, 'short')).toThrow(/stable server-side key/);
  });
});
