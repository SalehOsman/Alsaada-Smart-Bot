export interface UserJourneyStep {
  action: string;
  executionTimeMs: number;
  performanceTier: string;
  errorMessage: string | null;
  createdAt: Date;
}

export interface UnresolvedErrorDto {
  id: string;
  errorReference: string;
  errorHash: string;
  occurrenceCount: number;
  severity: string;
  errorMessage: string;
  stackTrace: string | null;
  sourceLocation: string | null;
  actorTelegramId: bigint | null;
  actorRole: string | null;
  actionTrigger: string | null;
  lastSeenAt: Date;
  createdAt: Date;
}

export interface PurgeResultDto {
  purgedErrorsCount: number;
  purgedPerformanceLogsCount: number;
}
