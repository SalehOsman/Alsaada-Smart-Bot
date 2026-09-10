export interface SlowOperationDto {
  action: string;
  executionTimeMs: number;
  actorTelegramId: bigint;
  errorMessage: string | null;
  createdAt: Date;
}

export interface ServicesHealthDto {
  postgresStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  postgresLatencyMs: number;
  redisStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  redisLatencyMs: number;
  redisMemoryUsed: string;
  telegramStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  telegramLatencyMs: number;
  geminiStatus: 'HEALTHY' | 'UNAVAILABLE';
  geminiLatencyMs: number;
  checkedAt: Date;
}

export type AlertPolicyType = 'IMMEDIATE' | 'SMART' | 'DAILY_DIGEST';

export interface ApmSummaryDto {
  totalOps24h: number;
  avgLatencyMs: number;
  greenPct: number;
  yellowPct: number;
  redPct: number;
}
