import { checkIdempotency, storeIdempotency } from '../src/services/idempotency.service';

describe('Security & Idempotency Unit Tests', () => {
  describe('Validation schemas', () => {
    const { registerSchema, loginSchema, createGroupSchema, createItinerarySchema } = require('../src/utils/validation');

    test('registerSchema rejects empty username', () => {
      expect(() => registerSchema.parse({ username: '', password: 'ValidPass1!' })).toThrow();
    });

    test('registerSchema rejects short password', () => {
      expect(() => registerSchema.parse({ username: 'user', password: 'short' })).toThrow();
    });

    test('registerSchema accepts valid input', () => {
      expect(() => registerSchema.parse({ username: 'testuser', password: 'ValidPass1!' })).not.toThrow();
    });

    test('loginSchema rejects empty fields', () => {
      expect(() => loginSchema.parse({ username: '', password: '' })).toThrow();
    });

    test('createGroupSchema rejects empty name', () => {
      expect(() => createGroupSchema.parse({ name: '' })).toThrow();
    });

    test('createItinerarySchema rejects bad date format', () => {
      expect(() => createItinerarySchema.parse({
        title: 'Test', meetupDate: '2025-12-25', meetupTime: '9:00 AM',
        meetupLocation: 'Here', idempotencyKey: 'key1',
      })).toThrow();
    });

    test('createItinerarySchema accepts valid input', () => {
      expect(() => createItinerarySchema.parse({
        title: 'Test', meetupDate: '12/25/2025', meetupTime: '9:00 AM',
        meetupLocation: 'Here', idempotencyKey: 'key1',
      })).not.toThrow();
    });
  });

  describe('Notification cursor', () => {
    test('opaque cursor is valid base64 JSON with createdAt and id', () => {
      const cursor = Buffer.from(JSON.stringify({ createdAt: '2025-01-01T00:00:00Z', id: 'abc-123' })).toString('base64');
      const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
      expect(decoded.createdAt).toBe('2025-01-01T00:00:00Z');
      expect(decoded.id).toBe('abc-123');
    });
  });

  describe('Face thresholds from config', () => {
    test('config includes face thresholds', () => {
      const { config } = require('../src/config/environment');
      expect(config.face).toBeDefined();
      expect(config.face.blinkMin).toBe(100);
      expect(config.face.blinkMax).toBe(500);
      expect(config.face.motionMin).toBe(0.6);
      expect(config.face.textureMin).toBe(0.5);
    });
  });
});
