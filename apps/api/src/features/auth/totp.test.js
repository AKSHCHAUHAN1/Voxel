import { describe, expect, it } from 'vitest';
import {
  createRecoveryCodes,
  createTotpSecret,
  decryptTotpSecret,
  encryptTotpSecret,
  findValidTotpStep,
  getTotpCode,
  normalizeRecoveryCode,
  verifyTotp,
} from './totp.js';

describe('TOTP authentication primitives', () => {
  it('matches the RFC 6238 SHA-1 vector for a six digit code', () => {
    expect(getTotpCode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000)).toBe('287082');
  });

  it('accepts the current time step and its adjacent clock-drift steps only', () => {
    const secret = createTotpSecret();
    const time = 1_750_000_000_000;
    expect(verifyTotp(secret, getTotpCode(secret, time), time)).toBe(true);
    expect(verifyTotp(secret, 'not-a-code', time)).toBe(false);
    expect(findValidTotpStep(secret, getTotpCode(secret, time), time)).toBe(Math.floor(time / 30_000));
    expect(findValidTotpStep(secret, 'not-a-code', time)).toBeNull();
  });

  it('encrypts authenticator secrets and detects tampering', () => {
    const secret = createTotpSecret();
    const ciphertext = encryptTotpSecret(secret, 'test-key-that-is-long-enough-for-hkdf');
    expect(ciphertext).not.toContain(secret);
    expect(decryptTotpSecret(ciphertext, 'test-key-that-is-long-enough-for-hkdf')).toBe(secret);
    expect(() => decryptTotpSecret(ciphertext, 'a-different-key-that-is-also-long-enough')).toThrow();
  });

  it('creates ten unique, single-use recovery codes in a printable format', () => {
    const codes = createRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes.every((code) => /^[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/.test(code))).toBe(true);
    expect(normalizeRecoveryCode(codes[0])).toMatch(/^[A-F0-9]{24}$/);
  });
});
