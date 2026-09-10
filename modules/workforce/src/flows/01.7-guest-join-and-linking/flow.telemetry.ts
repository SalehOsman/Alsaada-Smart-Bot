export interface GuestJoinTelemetryPayload {
  action: 'SUBMIT' | 'VERIFY' | 'LINK_CONSUMED';
  workerCode?: string | undefined;
  applicantTelegramId: bigint;
  executionTimeMs: number;
  success: boolean;
}

export function logGuestJoinTelemetry(payload: GuestJoinTelemetryPayload): void {
  const duration = `${payload.executionTimeMs}ms`;
  const status = payload.success ? 'SUCCESS' : 'FAILED';
  console.log(`[TELEMETRY:GUEST_JOIN] ${payload.action} | ${payload.workerCode || 'N/A'} | ${status} | ${duration}`);
}
