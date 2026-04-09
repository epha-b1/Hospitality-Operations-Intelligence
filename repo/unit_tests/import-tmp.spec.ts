import fs from 'fs';
import os from 'os';
import path from 'path';

describe('import-tmp hygiene', () => {
  // cleanupStaleImportTmp() reads var/import-tmp relative to cwd. We
  // simulate that directory in the test so no real project state is
  // touched. Snapshots the original cwd and restores it after each test.
  let workdir: string;
  let originalCwd: string;

  beforeEach(() => {
    workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'import-tmp-test-'));
    fs.mkdirSync(path.join(workdir, 'var/import-tmp'), { recursive: true });
    originalCwd = process.cwd();
    process.chdir(workdir);
    // Clear the module cache so IMPORT_TMP_DIR is re-resolved against
    // the new (temp) cwd when we require the module.
    jest.resetModules();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(workdir, { recursive: true, force: true });
  });

  test('deletes .import-*.json files older than maxAge', () => {
    const tmp = path.join(workdir, 'var/import-tmp');
    const staleFile = path.join(tmp, '.import-old.json');
    fs.writeFileSync(staleFile, '{}');
    // Backdate mtime by 2 days
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    fs.utimesSync(staleFile, twoDaysAgo, twoDaysAgo);

    const { cleanupStaleImportTmp } = require('../src/services/import.service');
    const deleted = cleanupStaleImportTmp(24 * 60 * 60 * 1000);
    expect(deleted).toBe(1);
    expect(fs.existsSync(staleFile)).toBe(false);
  });

  test('preserves recent files', () => {
    const tmp = path.join(workdir, 'var/import-tmp');
    const recent = path.join(tmp, '.import-recent.json');
    fs.writeFileSync(recent, '{}');

    const { cleanupStaleImportTmp } = require('../src/services/import.service');
    const deleted = cleanupStaleImportTmp(24 * 60 * 60 * 1000);
    expect(deleted).toBe(0);
    expect(fs.existsSync(recent)).toBe(true);
  });

  test('ignores files that do not match the import pattern', () => {
    const tmp = path.join(workdir, 'var/import-tmp');
    const other = path.join(tmp, 'some-other-file.txt');
    fs.writeFileSync(other, 'x');
    // Backdate mtime far into the past
    fs.utimesSync(other, new Date(0), new Date(0));

    const { cleanupStaleImportTmp } = require('../src/services/import.service');
    const deleted = cleanupStaleImportTmp(24 * 60 * 60 * 1000);
    expect(deleted).toBe(0);
    expect(fs.existsSync(other)).toBe(true);
  });

  test('no-op when tmp dir does not exist', () => {
    fs.rmSync(path.join(workdir, 'var/import-tmp'), { recursive: true });
    const { cleanupStaleImportTmp } = require('../src/services/import.service');
    const deleted = cleanupStaleImportTmp();
    expect(deleted).toBe(0);
  });
});
