export interface WorkerOffboardingTelemetryPayload {
  workerId: string;
  workerCode: string;
  reason: string;
  demotedTelegramId?: bigint | null | undefined;
  executionTimeMs: number;
  success: boolean;
  actorTelegramId: bigint;
}

export function logWorkerOffboardingTelemetry(payload: WorkerOffboardingTelemetryPayload): void {
  const duration = `${payload.executionTimeMs}ms`;
  const status = payload.success ? 'SUCCESS' : 'FAILED';
  console.log(`[TELEMETRY:WOB] ${payload.workerCode} | ${payload.reason} | ${status} | ${duration}`);
}
