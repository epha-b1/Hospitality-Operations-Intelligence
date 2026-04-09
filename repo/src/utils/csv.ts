/**
 * CSV safety utilities.
 *
 * Two concerns:
 * 1) Standard RFC 4180 quoting for commas, quotes, newlines, and CR.
 * 2) Formula injection neutralization. When a spreadsheet application opens
 *    a CSV and a cell begins with `=`, `+`, `-`, `@`, TAB, or CR, it may
 *    be interpreted as a formula. We prefix such cells with a single quote
 *    (`'`) inside the quoted field to neutralize the behavior.
 *
 * These helpers are deliberately framework-free so they can be used in any
 * export path (audit logs, reports).
 */

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * Escape a single CSV cell value. Always returns a quoted string so we can
 * safely embed commas/newlines/quotes, and prefixes dangerous formula
 * triggers with a single quote to neutralize spreadsheet formula execution.
 */
export function csvEscapeCell(value: unknown): string {
  if (value === null || value === undefined) return '""';

  // Serialize objects/arrays to JSON so downstream callers do not need to
  // pre-flatten complex values. Primitives are coerced to string.
  let str: string;
  if (typeof value === 'object') {
    try {
      str = JSON.stringify(value);
    } catch {
      str = String(value);
    }
  } else {
    str = String(value);
  }

  // Neutralize formula injection: prefix with single quote inside the quoted
  // field. The leading quote is part of the cell text and is recognized by
  // spreadsheet apps as "treat as literal".
  if (FORMULA_TRIGGER.test(str)) {
    str = `'${str}`;
  }

  // RFC 4180: escape embedded double quotes by doubling them, then wrap the
  // whole cell in double quotes.
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Render an array of rows (array-of-arrays) as a CSV string. The first row
 * is treated as the header. All cells are escaped by csvEscapeCell.
 */
export function rowsToCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvEscapeCell).join(',')).join('\r\n');
}

/**
 * Render an array of row objects as a CSV string using the provided column
 * order as headers. Missing keys become empty cells.
 */
export function objectsToCsv(
  objects: Record<string, unknown>[],
  columns: string[],
): string {
  const header = columns.map(csvEscapeCell).join(',');
  const body = objects
    .map((obj) => columns.map((c) => csvEscapeCell(obj[c])).join(','))
    .join('\r\n');
  return body ? `${header}\r\n${body}` : header;
}
