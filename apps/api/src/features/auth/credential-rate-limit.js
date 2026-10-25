import { createHmac } from 'node:crypto';

const incrementWithExpiry = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return { count, redis.call('TTL', KEYS[1]) }
`;

const normalizeIdentifier = (identifier) => String(identifier).trim().toLowerCase();

export const createCredentialRateLimiter = (redis, hashKey) => {
  if (typeof hashKey !== 'string' || hashKey.length < 32) {
    throw new Error('A stable server-side key is required to protect credential identifiers in Redis');
  }

  return async ({ scope, identifier, max, windowSeconds }) => {
    const normalizedIdentifier = normalizeIdentifier(identifier);
    const digest = createHmac('sha256', hashKey).update(normalizedIdentifier).digest('hex');
    const key = `voxel:auth-credential:${scope}:${digest}`;
    const [count, ttl] = await redis.eval(incrementWithExpiry, 1, key, String(windowSeconds));

    return {
      allowed: Number(count) <= max,
      retryAfterSeconds: Math.max(Number(ttl) || windowSeconds, 1),
    };
  };
};
