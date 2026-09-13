/**
 * Al-Saada Enterprise Telemetry - Next.js Adapter
 * Pure stateless utilities with zero runtime dependency on next or react.
 * Safe for use in Node.js, Edge Runtime, and Client Components.
 * Compliance: Plan 19 Section 3 & explorer_adapters_spec
 */

import { TRACE_ID_REGEX, W3C_TRACEPARENT_REGEX } from '../constants.js';
import type { HttpRequestLike } from '../types.js';

export type { HttpRequestLike };

/**
 * Safely validate trace ID format to prevent header injection or malformed values.
 */
export function isValidTraceId(value: unknown): value is string {
  return typeof value === 'string' && TRACE_ID_REGEX.test(value);
}

/**
 * Format 32-hex character string into standard 8-4-4-4-12 UUID format.
 */
export function formatHexToUuid(hex32: string): string {
  if (hex32.length !== 32) return hex32;
  return `${hex32.slice(0, 8)}-${hex32.slice(8, 12)}-${hex32.slice(12, 16)}-${hex32.slice(16, 20)}-${hex32.slice(20)}`;
}

/**
 * Extract Trace ID from request, inspecting query parameters (?traceId=... / ?trace_id=...),
 * x-trace-id header, and W3C traceparent, falling back to a new UUIDv4.
 */
export function extractTraceId(request: HttpRequestLike): string {
  // 1. Query parameter (?traceId=... or ?trace_id=...)
  if (request.url) {
    try {
      const parsedUrl = new URL(request.url, 'http://localhost');
      const paramTraceId =
        parsedUrl.searchParams.get('traceId') ||
        parsedUrl.searchParams.get('trace_id');
      if (paramTraceId && isValidTraceId(paramTraceId)) {
        return paramTraceId;
      }
    } catch {}
  }

  // 2. HTTP Header: x-trace-id / X-Trace-Id / x_trace_id
  if (request.headers) {
    let headerTraceId: string | undefined = undefined;
    if (typeof (request.headers as Headers).get === 'function') {
      headerTraceId = (request.headers as Headers).get('x-trace-id') || undefined;
    } else {
      const record = request.headers as Record<string, string | string[] | undefined>;
      const raw = record['x-trace-id'] || record['X-Trace-Id'] || record['x_trace_id'];
      headerTraceId = Array.isArray(raw) ? raw[0] : raw;
    }

    if (headerTraceId && isValidTraceId(headerTraceId)) {
      return headerTraceId;
    }

    // 3. W3C traceparent header
    let traceparent: string | undefined = undefined;
    if (typeof (request.headers as Headers).get === 'function') {
      traceparent = (request.headers as Headers).get('traceparent') || undefined;
    } else {
      const record = request.headers as Record<string, string | string[] | undefined>;
      const raw = record['traceparent'] || record['Traceparent'];
      traceparent = Array.isArray(raw) ? raw[0] : raw;
    }

    if (traceparent) {
      const match = W3C_TRACEPARENT_REGEX.exec(traceparent.trim());
      if (match && match[1]) {
        return formatHexToUuid(match[1]);
      }
    }
  }

  // 4. Default fallback: generate brand-new RFC 4122 UUIDv4
  return globalThis.crypto.randomUUID();
}

/**
 * Create standard trace headers to inject into downstream request and response.
 */
export function createTraceHeaders(
  traceId: string,
  parentSpanId?: string
): Record<string, string> {
  const cleanHex = traceId.replace(/[^a-fA-F0-9]/g, '').padEnd(32, '0').slice(0, 32);
  const cleanSpan = (parentSpanId || '0000000000000001')
    .replace(/[^a-fA-F0-9]/g, '')
    .padEnd(16, '0')
    .slice(0, 16);

  return {
    'x-trace-id': traceId,
    traceparent: `00-${cleanHex}-${cleanSpan}-01`,
  };
}

/**
 * Deterministically derive a short, human-friendly incident reference code
 * from a trace ID (e.g. TRC-9B1DEB4D).
 */
export function deriveIncidentCode(traceId: string, prefix = 'TRC'): string {
  const sanitized = traceId.replace(/[^a-zA-Z0-9]/g, '');
  const token = (sanitized.slice(0, 8) || 'UNKNOWN').toUpperCase();
  return `${prefix}-${token}`;
}
