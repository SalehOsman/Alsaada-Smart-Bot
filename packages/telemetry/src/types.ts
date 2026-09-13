/**
 * Al-Saada Enterprise Telemetry - Core Types
 * Compliance: Plan 19 Section 3, 4, 5
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface TelemetryActor {
  userId?: string | undefined;
  telegramId?: string | undefined;
  role?: string | undefined;
  siteId?: string | undefined;
  ipAddress?: string | undefined;
}

export interface TelemetryContext {
  traceId: string;
  spanId?: string | undefined;
  parentSpanId?: string | undefined;
  service: string;
  component?: string | undefined;
  action?: string | undefined;
  actor?: TelemetryActor | undefined;
  startTime?: number | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface TelemetryError {
  name: string;
  message: string;
  stack?: string | undefined;
  code?: string | number | undefined;
  cause?: unknown;
  [key: string]: unknown;
}

export interface TelemetryLogEntry {
  timestamp: string; // ISO-8601 UTC
  level: LogLevel;
  message: string;
  traceId: string;
  spanId?: string | undefined;
  parentSpanId?: string | undefined;
  service: string;
  environment: string;
  version?: string | undefined;
  component?: string | undefined;
  action?: string | undefined;
  actor?: TelemetryActor | undefined;
  durationMs?: number | undefined;
  payload?: Record<string, unknown> | unknown[] | undefined;
  error?: TelemetryError | undefined;
  hostname?: string | undefined;
  pid?: number | undefined;
}

export type TelemetryLogInput = Omit<Partial<TelemetryLogEntry>, 'error'> & {
  error?: unknown;
};

export interface RedactionOptions {
  maxDepth?: number | undefined;
  maxArrayLength?: number | undefined;
  maxStringLength?: number | undefined;
  useExactNidLength?: boolean | undefined;
}

export interface HttpRequestLike {
  headers?: Headers | Record<string, string | string[] | undefined> | undefined;
  url?: string | undefined;
}

export interface HttpResponseLike {
  headers: {
    set(name: string, value: string): void;
  };
}

export interface TelegramStructuralContext {
  from?: {
    id?: number | bigint | undefined;
    username?: string | undefined;
    first_name?: string | undefined;
    last_name?: string | undefined;
  } | undefined;
  chat?: {
    id?: number | bigint | undefined;
    type?: string | undefined;
  } | undefined;
  message?: {
    text?: string | undefined;
    document?: unknown | undefined;
    photo?: unknown | undefined;
    location?: unknown | undefined;
  } | undefined;
  callbackQuery?: {
    data?: string | undefined;
  } | undefined;
  traceId?: string | undefined;
  effectiveRole?: string | undefined;
  dbUser?: {
    id?: string | undefined;
    role?: string | undefined;
    assignedSiteId?: string | null | undefined;
  } | undefined;
  [key: string]: unknown;
}

export interface GrammyTelemetryOptions {
  service?: string | undefined;
  component?: string | undefined;
  extractActor?: ((ctx: TelegramStructuralContext) => TelemetryActor | undefined) | undefined;
  onBreadcrumb?: ((telegramId: bigint, action: string) => Promise<void> | void) | undefined;
  onPerformance?: ((data: {
    actorTelegramId: bigint;
    action: string;
    executionTimeMs: number;
    error?: unknown;
  }) => Promise<void> | void) | undefined;
}

export interface TelemetryLoggerOptions {
  service?: string | undefined;
  environment?: string | undefined;
  defaultComponent?: string | undefined;
  minLevel?: LogLevel | undefined;
}
