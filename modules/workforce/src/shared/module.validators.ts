export function isAllowedExcelFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.xlsx') || lower.endsWith('.xls');
}

export function sanitizeText(input: string | undefined | null): string {
  if (!input) return '';
  return input.trim();
}
