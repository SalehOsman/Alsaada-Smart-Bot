export function parseUserIdentifier(input: string): { type: 'TELEGRAM_ID' | 'WORKER_CODE' | 'INVALID'; value: string } {
  const trimmed = input.trim();
  if (/^\d{6,15}$/.test(trimmed)) {
    return { type: 'TELEGRAM_ID', value: trimmed };
  }
  if (/^[A-Za-z0-9_-]{2,20}$/.test(trimmed)) {
    return { type: 'WORKER_CODE', value: trimmed.toUpperCase() };
  }
  return { type: 'INVALID', value: trimmed };
}
