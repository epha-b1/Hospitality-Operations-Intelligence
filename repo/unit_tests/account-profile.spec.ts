import { updateProfileSchema } from '../src/utils/validation';

describe('updateProfileSchema — /accounts/me payload validation', () => {
  test('accepts a fully valid US profile payload', () => {
    expect(() =>
      updateProfileSchema.parse({
        legalName: 'Alice Example',
        addressLine1: '100 Main St',
        addressLine2: 'Apt 4',
        city: 'Aspen',
        state: 'CO',
        zip: '81611',
        taxInvoiceTitle: 'Example LLC',
        preferredCurrency: 'USD',
      })
    ).not.toThrow();
  });

  test('accepts ZIP+4 format', () => {
    expect(() => updateProfileSchema.parse({ zip: '81611-1234' })).not.toThrow();
  });

  test('rejects invalid ZIP formats', () => {
    for (const bad of ['1234', '123456', '81611-12', 'abcde', '81611 1234']) {
      expect(() => updateProfileSchema.parse({ zip: bad })).toThrow();
    }
  });

  test('rejects non-US state codes', () => {
    for (const bad of ['XX', 'California', 'ZZ']) {
      expect(() => updateProfileSchema.parse({ state: bad })).toThrow();
    }
  });

  test('rejects lowercase or 3-letter state (length check)', () => {
    expect(() => updateProfileSchema.parse({ state: 'ca' })).toThrow();
    expect(() => updateProfileSchema.parse({ state: 'CAL' })).toThrow();
  });

  test('rejects non-ISO-4217 currency codes', () => {
    for (const bad of ['US', 'USDD', 'usd', 'Dollar']) {
      expect(() => updateProfileSchema.parse({ preferredCurrency: bad })).toThrow();
    }
  });

  test('rejects overly long fields', () => {
    const long = 'x'.repeat(256);
    expect(() => updateProfileSchema.parse({ legalName: long })).toThrow();
    expect(() => updateProfileSchema.parse({ addressLine1: long })).toThrow();
  });

  test('rejects unknown fields (strict mode)', () => {
    expect(() => updateProfileSchema.parse({ admin: true })).toThrow();
    expect(() => updateProfileSchema.parse({ role: 'hotel_admin' })).toThrow();
  });

  test('accepts a partial update', () => {
    expect(() => updateProfileSchema.parse({ city: 'Denver' })).not.toThrow();
    expect(() => updateProfileSchema.parse({})).not.toThrow();
  });

  test('accepts DC and territory codes', () => {
    for (const code of ['DC', 'PR', 'VI', 'GU']) {
      expect(() => updateProfileSchema.parse({ state: code })).not.toThrow();
    }
  });
});
