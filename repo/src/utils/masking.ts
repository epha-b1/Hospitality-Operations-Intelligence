/**
 * Deep masking utility for sensitive fields in audit-log details.
 *
 * Applies a case-insensitive key match against a list of sensitive field
 * tokens (password, token, secret, etc.) and recursively walks nested
 * objects and arrays. Whenever a matching key is encountered, its value
 * is replaced with the constant REDACTED marker regardless of type.
 *
 * The same policy is used by both the query view (GET /audit-logs) and
 * the CSV export (GET /audit-logs/export) so the two surfaces cannot
 * drift.
 */

export const REDACTED = '[REDACTED]';

// Substrings that, if found case-insensitively in a key name, mark the
// associated value as sensitive. Matching is substring-based so variants
// like `password_hash`, `accessToken`, `api_secret`, `session_token`,
// and `encryption_key` are all caught without an exhaustive allow list.
const SENSITIVE_KEY_TOKENS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'auth',
  'credential',
  'private_key',
  'privatekey',
  'encryption_key',
  'encryptionkey',
  'session',
  'cookie',
  'otp',
  'pin',
  'ssn',
];

function isSensitiveKey(key: string): boolean {
  const lowered = key.toLowerCase();
  return SENSITIVE_KEY_TOKENS.some((t) => lowered.includes(t));
}

/**
 * Recursively mask sensitive fields inside an arbitrary value. Returns a
 * new structure — inputs are not mutated. Handles:
 *   - plain objects (recurses, masks matching keys)
 *   - arrays (recurses into each element)
 *   - primitives (returned as-is unless the caller's key already matched)
 *   - null / undefined (returned as-is)
 *
 * Cycles are guarded by a WeakSet to avoid stack overflows on
 * self-referential structures that can occur in serialized payloads.
 */
export function maskSensitiveDeep(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    return value.map((v) => maskSensitiveDeep(v, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[CIRCULAR]';
    seen.add(value as object);
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src)) {
      if (isSensitiveKey(k)) {
        out[k] = REDACTED;
      } else {
        out[k] = maskSensitiveDeep(v, seen);
      }
    }
    return out;
  }

  return value;
}
