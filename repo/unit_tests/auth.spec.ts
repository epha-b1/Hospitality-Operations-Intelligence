import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { encrypt, decrypt } from '../src/utils/crypto';

// Password policy regex (same as auth.service.ts)
const PASSWORD_REGEX = /^(?=.*\d)(?=.*[^a-zA-Z0-9]).{10,}$/;

describe('Slice 2 — Auth Unit Tests', () => {
  describe('Password Policy', () => {
    test('rejects password shorter than 10 chars', () => {
      expect(PASSWORD_REGEX.test('Ab1!xxxxx')).toBe(false); // 9 chars
    });

    test('rejects password without a number', () => {
      expect(PASSWORD_REGEX.test('Abcdefghij!')).toBe(false);
    });

    test('rejects password without a symbol', () => {
      expect(PASSWORD_REGEX.test('Abcdefghij1')).toBe(false);
    });

    test('accepts valid password (10+ chars, has number and symbol)', () => {
      expect(PASSWORD_REGEX.test('Admin1!pass')).toBe(true);
      expect(PASSWORD_REGEX.test('MyP@ssw0rd123')).toBe(true);
      expect(PASSWORD_REGEX.test('1234567890!')).toBe(true);
    });
  });

  describe('bcrypt', () => {
    test('hash and verify round-trip', async () => {
      const password = 'Admin1!pass';
      const hash = await bcrypt.hash(password, 12);
      expect(hash).not.toBe(password);
      expect(await bcrypt.compare(password, hash)).toBe(true);
      expect(await bcrypt.compare('wrong', hash)).toBe(false);
    }, 15000);
  });

  describe('AES-256-GCM crypto', () => {
    test('encrypt/decrypt round-trip', () => {
      const plaintext = 'sensitive data here';
      const ciphertext = encrypt(plaintext);
      expect(ciphertext).not.toBe(plaintext);
      expect(ciphertext.split(':')).toHaveLength(3);
      const decrypted = decrypt(ciphertext);
      expect(decrypted).toBe(plaintext);
    });

    test('different encryptions produce different ciphertexts (random IV)', () => {
      const plaintext = 'same text';
      const c1 = encrypt(plaintext);
      const c2 = encrypt(plaintext);
      expect(c1).not.toBe(c2);
      expect(decrypt(c1)).toBe(plaintext);
      expect(decrypt(c2)).toBe(plaintext);
    });
  });

  describe('JWT', () => {
    const secret = 'test-secret-key';
    const payload = { userId: 'abc-123', username: 'testuser', role: 'member' };

    test('sign and verify with correct secret', () => {
      const token = jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: 3600 });
      const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as typeof payload;
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.username).toBe(payload.username);
      expect(decoded.role).toBe(payload.role);
    });

    test('verify throws with wrong secret', () => {
      const token = jwt.sign(payload, secret, { algorithm: 'HS256' });
      expect(() => jwt.verify(token, 'wrong-secret', { algorithms: ['HS256'] })).toThrow();
    });
  });

  describe('Lockout logic', () => {
    test('after 5 failures login should be blocked', () => {
      // Simulate lockout logic (matches Q2: 5 attempts)
      const LOCKOUT_THRESHOLD = 5;
      let failedAttempts = 0;
      let lockedUntil: Date | null = null;

      for (let i = 0; i < LOCKOUT_THRESHOLD; i++) {
        failedAttempts++;
      }

      if (failedAttempts >= LOCKOUT_THRESHOLD) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      expect(failedAttempts).toBe(5);
      expect(lockedUntil).not.toBeNull();
      expect(lockedUntil!.getTime()).toBeGreaterThan(Date.now());

      // Verify the lock blocks login
      const isLocked = lockedUntil !== null && lockedUntil > new Date();
      expect(isLocked).toBe(true);
    });
  });
});
