export function logBackupEvent(action: string, metadata: Record<string, unknown> = {}): void {
  const metaStr = Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : '';
  console.log(`[FLOW-00.13] ${action}${metaStr}`);
}

export function logBackupError(action: string, error: unknown, metadata: Record<string, unknown> = {}): void {
  const errMsg = error instanceof Error ? error.message : String(error);
  const metaStr = Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : '';
  console.warn(`[FLOW-00.13-ERR] ${action}: ${errMsg}${metaStr}`);
}
