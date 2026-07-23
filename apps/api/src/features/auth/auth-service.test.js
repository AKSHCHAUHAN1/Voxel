import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './auth-service.js';

describe('AuthService Password Hashing', () => {
  it('correctly hashes and verifies a valid password', () => {
    const password = 'SuperSecretPassword123!';
    const hashed = hashPassword(password);

    expect(hashed).toBeTypeOf('string');
    expect(hashed).toContain(':');

    const isValid = verifyPassword(password, hashed);
    expect(isValid).toBe(true);
  });

  it('rejects an invalid password', () => {
    const password = 'CorrectPassword123!';
    const wrongPassword = 'WrongPassword456!';
    const hashed = hashPassword(password);

    const isValid = verifyPassword(wrongPassword, hashed);
    expect(isValid).toBe(false);
  });

  it('handles invalid or empty hash gracefully', () => {
    expect(verifyPassword('password', null)).toBe(false);
    expect(verifyPassword('password', '')).toBe(false);
    expect(verifyPassword('password', 'invalidhash')).toBe(false);
  });
});
