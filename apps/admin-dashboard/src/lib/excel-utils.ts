/**
 * Sanitizes Excel cell values to prevent CSV/Excel Formula Injection (CWE-1236).
 * Prepends a single quote if the string begins with =, +, -, @, \t, or \r.
 */
export function sanitizeExcelCell(val: unknown): unknown {
  if (typeof val !== 'string') return val;
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerousChars.some((char) => val.startsWith(char))) {
    return "'" + val;
  }
  return val;
}
