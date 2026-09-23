export function validateBackupConfirmationCode(code: string): boolean {
  if (!code) return false;
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return code.trim() === `RESTORE-${todayStr}`;
}

export function validateBackupId(id: string): boolean {
  if (!id) return false;
  return /^BCK-\d{8}-\d{6}$/.test(id.trim());
}

export function validateAdminRole(role: string): boolean {
  return ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(role);
}
