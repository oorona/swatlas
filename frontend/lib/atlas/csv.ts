const FORMULA_START = /^[=+\-@\t\r]/;

/** Neutralize spreadsheet formula injection by prefixing an apostrophe. */
export function safeCell(value: string | number): string {
  const text = String(value);
  return FORMULA_START.test(text) ? `'${text}` : text;
}

function quote(cell: string): string {
  return /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map((c) => quote(typeof c === 'number' ? String(c) : safeCell(c))).join(',')).join('\n') + '\n';
}

/** Download filenames: lowercase ascii, digits, dot, dash only. */
export function safeFilename(parts: string[], extension: string): string {
  const base = parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
  return `${base || 'swatlas'}.${extension}`;
}
