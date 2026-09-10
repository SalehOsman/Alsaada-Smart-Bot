export interface WorkerSelfEditTelemetryPayload {
  workerId: string;
  workerCode: string;
  field: string;
  executionTimeMs: number;
  success: boolean;
  actorTelegramId: bigint;
}

export function logWorkerSelfEditTelemetry(payload: WorkerSelfEditTelemetryPayload): void {
  const duration = `${payload.executionTimeMs}ms`;
  const status = payload.success ? 'SUCCESS' : 'FAILED';
  console.log(`[TELEMETRY:WSE] ${payload.workerCode} | ${payload.field} | ${status} | ${duration}`);
}
