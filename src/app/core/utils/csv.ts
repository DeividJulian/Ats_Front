/** CSV files that Excel in Spanish opens in columns, with accents intact. */

/** One cell between quotes, doubling the quotes inside. */
export function csvCell(value: string | number | null | undefined): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

/** Rows separated by ";" (Excel in Spanish uses the comma for decimals) and Windows line breaks. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
}

/** Lowercase file name without spaces or characters that Windows rejects. */
export function csvFileName(...parts: string[]): string {
  const base = parts.filter(Boolean).join('-').toLowerCase().replace(/[\/:*?"<>|]/g, '').replace(/\s+/g, '-');
  return `${base || 'datos'}.csv`;
}

/** Saves the CSV in the browser's downloads. The BOM makes Excel read the accents correctly. */
export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
