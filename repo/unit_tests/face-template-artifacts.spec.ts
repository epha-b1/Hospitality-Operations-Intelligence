/**
 * Guard test — no encrypted face template artifacts may be present in
 * the source tree. Face templates contain biometric material and are
 * written to `face-templates/` as a runtime side effect of enrollment;
 * they must never be committed.
 *
 * The audit flagged `.enc` files committed alongside `.gitkeep`. This
 * test enforces the fix by failing loudly if any `.enc` file reappears
 * in the directory. Combined with the `.gitignore` rule (`face-templates/*`
 * + `!face-templates/.gitkeep`) it provides defense in depth against
 * accidental commits.
 */

import fs from 'fs';
import path from 'path';

describe('face-templates directory hygiene', () => {
  const dir = path.resolve(__dirname, '..', 'face-templates');

  test('directory exists and contains only .gitkeep (no runtime artifacts)', () => {
    expect(fs.existsSync(dir)).toBe(true);
    const entries = fs.readdirSync(dir);
    // Only `.gitkeep` is allowed. Any `.enc`, `.json`, or other artifact
    // means a runtime write has leaked into the source tree.
    expect(entries).toEqual(['.gitkeep']);
  });

  test('no .enc files are checked into the directory', () => {
    const entries = fs.readdirSync(dir);
    const leaked = entries.filter((name) => name.endsWith('.enc'));
    expect(leaked).toEqual([]);
  });
});
