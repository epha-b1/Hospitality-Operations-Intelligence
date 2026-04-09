import { csvEscapeCell, objectsToCsv, rowsToCsv } from '../src/utils/csv';

describe('utils/csv — RFC 4180 escaping and formula neutralization', () => {
  describe('csvEscapeCell', () => {
    test('null/undefined become empty quoted strings', () => {
      expect(csvEscapeCell(null)).toBe('""');
      expect(csvEscapeCell(undefined)).toBe('""');
    });

    test('plain strings are quoted', () => {
      expect(csvEscapeCell('hello')).toBe('"hello"');
    });

    test('embedded commas are preserved inside quotes', () => {
      expect(csvEscapeCell('a,b,c')).toBe('"a,b,c"');
    });

    test('embedded newlines are preserved inside quotes', () => {
      expect(csvEscapeCell('line1\nline2')).toBe('"line1\nline2"');
      expect(csvEscapeCell('line1\r\nline2')).toBe('"line1\r\nline2"');
    });

    test('embedded double quotes are doubled', () => {
      expect(csvEscapeCell('say "hi"')).toBe('"say ""hi"""');
    });

    // --- Formula injection neutralization ---
    test('neutralizes leading =', () => {
      expect(csvEscapeCell('=SUM(A1:A9)')).toBe('"\'=SUM(A1:A9)"');
    });

    test('neutralizes leading +', () => {
      expect(csvEscapeCell('+cmd|/c calc')).toBe('"\'+cmd|/c calc"');
    });

    test('neutralizes leading -', () => {
      expect(csvEscapeCell('-2+3')).toBe('"\'-2+3"');
    });

    test('neutralizes leading @', () => {
      expect(csvEscapeCell('@SUM')).toBe('"\'@SUM"');
    });

    test('neutralizes leading tab', () => {
      expect(csvEscapeCell('\t=1+1')).toBe('"\'\t=1+1"');
    });

    test('does NOT neutralize when formula char is not at start', () => {
      expect(csvEscapeCell('a=b')).toBe('"a=b"');
      expect(csvEscapeCell('a+b')).toBe('"a+b"');
    });

    test('serializes objects as JSON', () => {
      expect(csvEscapeCell({ a: 1 })).toBe('"{""a"":1}"');
    });
  });

  describe('objectsToCsv', () => {
    test('emits header + rows with stable column order', () => {
      const csv = objectsToCsv(
        [{ a: 1, b: 'x' }, { a: 2, b: 'y' }],
        ['a', 'b']
      );
      expect(csv).toBe('"a","b"\r\n"1","x"\r\n"2","y"');
    });

    test('missing keys become empty cells', () => {
      const csv = objectsToCsv([{ a: 1 }, { b: 'x' }], ['a', 'b']);
      expect(csv).toBe('"a","b"\r\n"1",""\r\n"","x"');
    });

    test('headers-only when rows is empty', () => {
      expect(objectsToCsv([], ['a', 'b'])).toBe('"a","b"');
    });

    test('dangerous cell values are neutralized through the pipeline', () => {
      const csv = objectsToCsv([{ name: '=HYPERLINK("http://evil")', note: 'ok' }], ['name', 'note']);
      expect(csv).toContain('"\'=HYPERLINK');
    });
  });

  describe('rowsToCsv', () => {
    test('serializes array-of-arrays', () => {
      expect(rowsToCsv([['a', 'b'], [1, 2]])).toBe('"a","b"\r\n"1","2"');
    });
  });
});
