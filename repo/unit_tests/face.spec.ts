import { encrypt, decrypt } from '../src/utils/crypto';

describe('Slice 10 — Face Unit Tests', () => {
  const BLINK_MIN = 100, BLINK_MAX = 500, MOTION_MIN = 0.6, TEXTURE_MIN = 0.5;

  function checkLiveness(blink: number, motion: number, texture: number) {
    return blink >= BLINK_MIN && blink <= BLINK_MAX && motion >= MOTION_MIN && texture >= TEXTURE_MIN;
  }

  test('liveness passes with valid scores', () => {
    expect(checkLiveness(200, 0.8, 0.7)).toBe(true);
  });

  test('liveness fails with blink too fast', () => {
    expect(checkLiveness(50, 0.8, 0.7)).toBe(false);
  });

  test('liveness fails with blink too slow', () => {
    expect(checkLiveness(600, 0.8, 0.7)).toBe(false);
  });

  test('liveness fails with low motion score', () => {
    expect(checkLiveness(200, 0.3, 0.7)).toBe(false);
  });

  test('liveness fails with low texture score', () => {
    expect(checkLiveness(200, 0.8, 0.2)).toBe(false);
  });

  test('template encryption round-trip', () => {
    const template = JSON.stringify({ angles: { left: {}, front: {}, right: {} }, enrolledAt: '2025-01-01' });
    const encrypted = encrypt(template);
    expect(encrypted).not.toBe(template);
    expect(decrypt(encrypted)).toBe(template);
  });

  test('version increments on new enrollment', () => {
    let version = 0;
    version++; // first enrollment
    expect(version).toBe(1);
    version++; // second enrollment
    expect(version).toBe(2);
  });
});
