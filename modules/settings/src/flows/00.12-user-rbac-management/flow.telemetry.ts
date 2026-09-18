export interface UserRbacTelemetryPayload {
  action: 'LIST' | 'SEARCH' | 'CHANGE_ROLE' | 'TOGGLE_BAN' | 'REVOKE' | 'DIRECT_LINK' | 'RADAR_CONFLICT' | 'ASSIGN_SUPERVISOR_PROFILE';
  actorTelegramId?: bigint | undefined;
  targetTelegramId?: bigint | undefined;
  targetWorkerCode?: string | undefined;
  newRole?: string | undefined;
  profileKey?: string | undefined;
  success: boolean;
  executionTimeMs?: number | undefined;
  error?: string | undefined;
}

export function logUserRbacTelemetry(payload: UserRbacTelemetryPayload): void {
  const status = payload.success ? 'SUCCESS' : 'FAILURE';
  const target = payload.targetTelegramId ? `[Target: ${payload.targetTelegramId.toString()}]` : '';
  const worker = payload.targetWorkerCode ? `[Worker: ${payload.targetWorkerCode}]` : '';
  console.log(
    `👥 [USER_RBAC_TELEMETRY] ${payload.action} ${status} ${target} ${worker} (${payload.executionTimeMs ?? 0}ms)`
  );
}
