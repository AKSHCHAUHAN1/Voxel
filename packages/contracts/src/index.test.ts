import { describe, expect, it } from 'vitest';
import { createRequestId } from './index.js';

describe('createRequestId', () => {
  it('preserves an opaque request identifier value', () => {
    expect(createRequestId('request-123')).toBe('request-123');
  });
});
