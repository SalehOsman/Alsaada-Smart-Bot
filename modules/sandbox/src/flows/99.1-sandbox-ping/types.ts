/**
 * Type contracts for Flow 99.1 (sandbox-ping)
 */

export interface SandboxPingSessionData {
  flowId: '99.1';
  step: 'INIT' | 'PROMPT' | 'CONFIRM' | 'COMPLETED';
  idempotencyKey?: string | undefined;
  payload?: Record<string, unknown> | undefined;
}

export interface SandboxPingInputDTO {
  idempotencyKey: string;
  actorTelegramId: string;
  notes?: string | undefined;
}

export interface SandboxPingResultDTO {
  success: boolean;
  referenceId: string;
  messageArabic: string;
}
