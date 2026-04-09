import { maskSensitiveDeep, REDACTED } from '../src/utils/masking';

describe('utils/masking — deep masking of sensitive fields', () => {
  test('returns primitives untouched', () => {
    expect(maskSensitiveDeep(null)).toBeNull();
    expect(maskSensitiveDeep(undefined)).toBeUndefined();
    expect(maskSensitiveDeep('hello')).toBe('hello');
    expect(maskSensitiveDeep(42)).toBe(42);
    expect(maskSensitiveDeep(true)).toBe(true);
  });

  test('masks shallow sensitive fields', () => {
    const out = maskSensitiveDeep({
      username: 'alice',
      password: 'hunter2',
      token: 'eyJhbGciOi...',
    }) as Record<string, unknown>;
    expect(out.username).toBe('alice');
    expect(out.password).toBe(REDACTED);
    expect(out.token).toBe(REDACTED);
  });

  test('case-insensitive key matching', () => {
    const out = maskSensitiveDeep({
      Password: 'x', APITOKEN: 'y', AccessToken: 'z', session_id: 's',
    }) as Record<string, unknown>;
    expect(out.Password).toBe(REDACTED);
    expect(out.APITOKEN).toBe(REDACTED);
    expect(out.AccessToken).toBe(REDACTED);
    expect(out.session_id).toBe(REDACTED);
  });

  test('masks nested objects', () => {
    const out = maskSensitiveDeep({
      user: {
        id: 'u1',
        credentials: { password_hash: 'abc', secret: 'def' },
      },
    }) as any;
    expect(out.user.id).toBe('u1');
    // whole credentials object is considered sensitive (key contains "credential")
    expect(out.user.credentials).toBe(REDACTED);
  });

  test('masks inside arrays of objects', () => {
    const out = maskSensitiveDeep({
      events: [
        { name: 'login', token: 'abc' },
        { name: 'logout', password: 'xyz' },
      ],
    }) as any;
    expect(out.events[0].name).toBe('login');
    expect(out.events[0].token).toBe(REDACTED);
    expect(out.events[1].password).toBe(REDACTED);
  });

  test('catches variants: password_hash, api_key, encryption_key', () => {
    const out = maskSensitiveDeep({
      password_hash: '1', api_key: '2', encryption_key: '3', private_key: '4',
    }) as Record<string, unknown>;
    for (const k of ['password_hash', 'api_key', 'encryption_key', 'private_key']) {
      expect(out[k]).toBe(REDACTED);
    }
  });

  test('does not mutate the input object', () => {
    const input = { password: 'secret', name: 'n' };
    const out = maskSensitiveDeep(input) as any;
    expect(input.password).toBe('secret'); // original untouched
    expect(out.password).toBe(REDACTED);
  });

  test('handles circular references without stack overflow', () => {
    const a: any = { name: 'a' };
    a.self = a;
    const out = maskSensitiveDeep(a) as any;
    expect(out.name).toBe('a');
    expect(out.self).toBe('[CIRCULAR]');
  });

  test('non-sensitive keys pass through unchanged', () => {
    const out = maskSensitiveDeep({
      reportType: 'occupancy',
      from: '2025-01-01',
      to: '2025-12-31',
      rowCount: 42,
      filters: { propertyId: 'p1', includePii: false },
    }) as any;
    expect(out.reportType).toBe('occupancy');
    expect(out.filters.propertyId).toBe('p1');
    expect(out.filters.includePii).toBe(false);
    expect(out.rowCount).toBe(42);
  });
});
