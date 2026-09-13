import { createHash } from 'node:crypto';
import { generateTraceId } from './context.js';
import { redact, scrubString } from './redaction.js';

export type IncidentSeverity = 'WARNING' | 'ERROR' | 'CRITICAL' | 'FATAL';
export type IncidentSource = 'bot' | 'dashboard-server' | 'dashboard-browser' | 'worker';
export type IncidentEnvironment = 'development' | 'test' | 'staging' | 'production';

export interface IncidentBreadcrumbInput {
  readonly action: string;
  readonly timestamp?: number | string | undefined;
}

export interface IncidentInput {
  readonly traceId: string;
  readonly source: IncidentSource;
  readonly service: string;
  readonly severity: IncidentSeverity;
  readonly action: string;
  readonly sourceLocation: string;
  readonly error: unknown;
  readonly actorTelegramId?: bigint | undefined;
  readonly actorRole?: string | undefined;
  readonly breadcrumbs?: readonly IncidentBreadcrumbInput[] | undefined;
  readonly release?: string | undefined;
  readonly environment: IncidentEnvironment;
}

export interface NormalizedIncidentBreadcrumb {
  readonly action: string;
  readonly timestamp?: number | string | undefined;
}

export interface NormalizedIncident {
  readonly traceId: string;
  readonly source: IncidentSource;
  readonly service: string;
  readonly severity: IncidentSeverity;
  readonly action: string;
  readonly sourceLocation: string;
  readonly errorName: string;
  readonly message: string;
  readonly stack?: string | undefined;
  readonly fingerprint: string;
  readonly actorTelegramId?: bigint | undefined;
  readonly actorRole?: string | undefined;
  readonly breadcrumbs: readonly NormalizedIncidentBreadcrumb[];
  readonly release?: string | undefined;
  readonly environment: IncidentEnvironment;
}

function bounded(value: string, maximum: number): string {
  return scrubString(value).slice(0, maximum);
}

function normalizeTraceId(traceId: string): string {
  const candidate = traceId.trim();
  return /^[a-zA-Z0-9_-]{8,64}$/.test(candidate) ? candidate : generateTraceId();
}

function normalizeError(error: unknown): {
  errorName: string;
  message: string;
  stack?: string | undefined;
} {
  const safeError = redact(error, { maxStringLength: 4_000 });

  if (safeError && typeof safeError === 'object' && !Array.isArray(safeError)) {
    const record = safeError as Record<string, unknown>;
    const errorName = bounded(typeof record.name === 'string' ? record.name : 'Error', 120);
    const message = bounded(
      typeof record.message === 'string' ? record.message : String(error),
      1_000,
    );
    const stack = typeof record.stack === 'string' ? bounded(record.stack, 4_000) : undefined;
    return { errorName, message, ...(stack ? { stack } : {}) };
  }

  return {
    errorName: 'UnknownError',
    message: bounded(typeof safeError === 'string' ? safeError : String(safeError), 1_000),
  };
}

export function normalizeIncident(input: IncidentInput): NormalizedIncident {
  const traceId = normalizeTraceId(input.traceId);
  const service = bounded(input.service, 120);
  const action = bounded(input.action, 200);
  const sourceLocation = bounded(input.sourceLocation, 300);
  const error = normalizeError(input.error);
  const breadcrumbs = (input.breadcrumbs ?? [])
    .slice(-10)
    .map((breadcrumb): NormalizedIncidentBreadcrumb => ({
      action: bounded(breadcrumb.action, 200),
      ...(breadcrumb.timestamp !== undefined ? { timestamp: breadcrumb.timestamp } : {}),
    }));
  const fingerprint = createHash('sha256')
    .update([
      input.source,
      service,
      input.severity,
      action,
      sourceLocation,
      error.errorName,
      error.message,
    ].join('|'))
    .digest('hex');

  return {
    traceId,
    source: input.source,
    service,
    severity: input.severity,
    action,
    sourceLocation,
    errorName: error.errorName,
    message: error.message,
    ...(error.stack ? { stack: error.stack } : {}),
    fingerprint,
    ...(input.actorTelegramId !== undefined
      ? { actorTelegramId: input.actorTelegramId }
      : {}),
    ...(input.actorRole ? { actorRole: bounded(input.actorRole, 80) } : {}),
    breadcrumbs,
    ...(input.release ? { release: bounded(input.release, 120) } : {}),
    environment: input.environment,
  };
}
