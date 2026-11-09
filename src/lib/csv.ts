/**
 * One CSV cell. Quotes when needed and neutralises spreadsheet formulas: a customer could type
 * "=HYPERLINK(...)" as their name, which Excel or Google Sheets would otherwise run when staff open the export.
 */
export function csvCell(v: unknown) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
