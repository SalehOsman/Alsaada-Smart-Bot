/**
 * Al-Saada Enterprise Telemetry - Context & AsyncLocalStorage Engine
 * Compliance: Plan 19 Section 3
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes, randomUUID } from 'node:crypto';
import type { TelemetryContext } from './types.js';

const telemetryStorage = new AsyncLocalStorage<TelemetryContext>();

/**
 * Execute an asynchronous or synchronous function within a TelemetryContext scope.
 */
export function runWithTelemetryContext<R>(context: TelemetryContext, fn: () => R): R {
  return telemetryStorage.run(context, fn);
}

/**
 * Retrieve the active TelemetryContext from AsyncLocalStorage, if any.
 */
export function getTelemetryContext(): TelemetryContext | undefined {
  return telemetryStorage.getStore();
}

/**
 * Retrieve the active trace ID from AsyncLocalStorage, if any.
 */
export function getTraceId(): string | undefined {
  return telemetryStorage.getStore()?.traceId;
}

/**
 * Generate a standard RFC 4122 UUIDv4 trace ID.
 */
export function generateTraceId(): string {
  return randomUUID();
}

/**
 * Generate a standard 16-character hexadecimal span ID.
 */
export function generateSpanId(): string {
  return randomBytes(8).toString('hex');
}

/**
 * Format a W3C traceparent header string (00-{traceId32}-{spanId16}-{flags}).
 */
export function formatTraceparent(
  traceId: string,
  spanId?: string,
  sampled = true
): string {
  const cleanTrace = traceId.replace(/[^a-fA-F0-9]/g, '').padEnd(32, '0').slice(0, 32);
  const cleanSpan = (spanId || generateSpanId())
    .replace(/[^a-fA-F0-9]/g, '')
    .padEnd(16, '0')
    .slice(0, 16);
  const flags = sampled ? '01' : '00';

  return `00-${cleanTrace}-${cleanSpan}-${flags}`;
}
