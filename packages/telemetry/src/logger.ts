/**
 * Al-Saada Enterprise Telemetry - Structured JSON Logger
 * Compliance: Plan 19 Section 3
 */

import { hostname } from 'node:os';
import { stderr, stdout } from 'node:process';
import { generateTraceId, getTelemetryContext } from './context.js';
import { redact, scrubString } from './redaction.js';
import type {
  LogLevel,
  TelemetryActor,
  TelemetryError,
  TelemetryLogEntry,
  TelemetryLogInput,
  TelemetryLoggerOptions,
} from './types.js';

const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

export class TelemetryLogger {
  readonly service: string;
  readonly environment: string;
  readonly defaultComponent: string;
  readonly minLevel: LogLevel;
  private readonly cachedHostname: string;

  constructor(options: TelemetryLoggerOptions = {}) {
    this.service = options.service || process.env.SERVICE_NAME || 'alsaada-service';
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.defaultComponent = options.defaultComponent || 'core';
    this.minLevel = options.minLevel || 'debug';
    this.cachedHostname = hostname();
  }

  /**
   * Determine if a message at the given level should be logged based on minLevel.
   */
  shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_SEVERITY[level] >= LOG_LEVEL_SEVERITY[this.minLevel];
  }

  /**
   * Format an unknown error into a sanitized TelemetryError structure.
   */
  private formatError(err: unknown): TelemetryError | undefined {
    if (!err) return undefined;
    if (err instanceof Error) {
      const sanitized = redact(err) as Record<string, unknown>;
      return {
        name: typeof sanitized.name === 'string' ? sanitized.name : err.name,
        message: typeof sanitized.message === 'string' ? sanitized.message : err.message,
        stack: typeof sanitized.stack === 'string' ? sanitized.stack : undefined,
        code: (err as { code?: string | number }).code,
        cause: err.cause ? redact(err.cause) : undefined,
      };
    }
    return {
      name: 'UnknownError',
      message: scrubString(String(err)),
    };
  }

  /**
   * Emit a structured JSON log entry.
   */
  log(level: LogLevel, message: string, meta?: TelemetryLogInput): TelemetryLogEntry | undefined {
    if (!this.shouldLog(level)) {
      return undefined;
    }

    const context = getTelemetryContext();

    const traceId = meta?.traceId || context?.traceId || generateTraceId();
    const spanId = meta?.spanId || context?.spanId;
    const parentSpanId = meta?.parentSpanId || context?.parentSpanId;
    const service = meta?.service || context?.service || this.service;
    const component = meta?.component || context?.component || this.defaultComponent;
    const action = meta?.action || context?.action;
    const actor = (meta?.actor || context?.actor) ? (redact(meta?.actor || context?.actor) as TelemetryActor) : undefined;
    const durationMs = meta?.durationMs ?? (context?.startTime ? Date.now() - context.startTime : undefined);

    let error: TelemetryError | undefined = undefined;
    if (meta?.error) {
      error = this.formatError(meta.error);
    }

    const payload = meta?.payload ? (redact(meta.payload) as Record<string, unknown> | unknown[]) : undefined;

    const entry: TelemetryLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: scrubString(message),
      traceId,
      ...(spanId ? { spanId } : {}),
      ...(parentSpanId ? { parentSpanId } : {}),
      service,
      environment: meta?.environment || this.environment,
      ...(meta?.version ? { version: meta.version } : {}),
      component,
      ...(action ? { action } : {}),
      ...(actor ? { actor } : {}),
      ...(durationMs !== undefined ? { durationMs } : {}),
      ...(payload ? { payload } : {}),
      ...(error ? { error } : {}),
      hostname: this.cachedHostname,
      pid: process.pid,
    };

    const serialized = JSON.stringify(entry);

    if (level === 'warn' || level === 'error' || level === 'fatal') {
      stderr.write(serialized + '\n');
    } else {
      stdout.write(serialized + '\n');
    }

    return entry;
  }

  debug(message: string, meta?: TelemetryLogInput): TelemetryLogEntry | undefined {
    return this.log('debug', message, meta);
  }

  info(message: string, meta?: TelemetryLogInput): TelemetryLogEntry | undefined {
    return this.log('info', message, meta);
  }

  warn(message: string, meta?: TelemetryLogInput): TelemetryLogEntry | undefined {
    return this.log('warn', message, meta);
  }

  error(message: string, meta?: TelemetryLogInput): TelemetryLogEntry | undefined {
    return this.log('error', message, meta);
  }

  fatal(message: string, meta?: TelemetryLogInput): TelemetryLogEntry | undefined {
    return this.log('fatal', message, meta);
  }
}
