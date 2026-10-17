/**
 * csv.js
 *
 * Utility to generate and download sanitized CSV files with UTF-8 BOM encoding.
 * Ensures proper escaping of commas, quotes, and newlines.
 */

export function downloadCsv(filename, headers, rows) {
  if (!rows || rows.length === 0) return;

  const escapeCell = (cell) => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = headers
    .map((h) => escapeCell(typeof h === 'object' ? h.label || h.header || h.key : h))
    .join(',');

  const dataLines = rows.map((row) => {
    if (Array.isArray(row)) {
      return row.map(escapeCell).join(',');
    }
    return headers
      .map((h) => {
        const key = typeof h === 'object' ? h.key || h.field || h.id : h;
        const val = row[key];
        return escapeCell(val);
      })
      .join(',');
  });

  const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    filename.endsWith('.csv') ? filename : `${filename}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
