export type OutboxEventStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface OutboxEvent<T = any> {
  id: string;
  eventType: string; // e.g. 'SHEETS_APPEND_ROW', 'SHEETS_UPDATE_ROW'
  targetSheet: string;
  payload: T;
  retryCount: number;
  maxRetries: number;
  status: OutboxEventStatus;
  createdAt: number;
  lastAttemptAt?: number | undefined;
  errorMessage?: string | undefined;
}

export interface OutboxEnqueueInput<T = any> {
  eventType: string;
  targetSheet: string;
  payload: T;
  maxRetries?: number | undefined;
}

export interface OutboxProcessResult {
  processedCount: number;
  successCount: number;
  failureCount: number;
  deadLetterCount: number;
}
