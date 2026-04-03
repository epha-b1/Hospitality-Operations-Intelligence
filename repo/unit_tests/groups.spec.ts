describe('Slice 4 — Groups Unit Tests', () => {
  const US_PHONE_REGEX = /^\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})$/;

  describe('US Phone Format Validation', () => {
    test('accepts (123) 456-7890', () => {
      expect(US_PHONE_REGEX.test('(123) 456-7890')).toBe(true);
    });

    test('accepts 123-456-7890', () => {
      expect(US_PHONE_REGEX.test('123-456-7890')).toBe(true);
    });

    test('accepts 1234567890', () => {
      expect(US_PHONE_REGEX.test('1234567890')).toBe(true);
    });

    test('accepts 123.456.7890', () => {
      expect(US_PHONE_REGEX.test('123.456.7890')).toBe(true);
    });

    test('rejects too short', () => {
      expect(US_PHONE_REGEX.test('123-456')).toBe(false);
    });

    test('rejects international format', () => {
      expect(US_PHONE_REGEX.test('+1-123-456-7890')).toBe(false);
    });

    test('rejects letters', () => {
      expect(US_PHONE_REGEX.test('abc-def-ghij')).toBe(false);
    });
  });

  describe('Join code generation', () => {
    test('generates 8-char uppercase hex', () => {
      const crypto = require('crypto');
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      expect(code).toMatch(/^[0-9A-F]{8}$/);
      expect(code.length).toBe(8);
    });

    test('generates unique codes', () => {
      const crypto = require('crypto');
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(crypto.randomBytes(4).toString('hex').toUpperCase());
      }
      expect(codes.size).toBe(100);
    });
  });
});
