import { deriveIncidentCode } from './adapters/next.js';
import { generateTraceId, getTraceId } from './context.js';
import { writeEmergencyIncident } from './emergency-sink.js';
import {
  AlsaadaBaseError,
  FinancialInvariantError,
  isOperationalError,
} from './errors.js';
import {
  normalizeIncident,
  type IncidentBreadcrumbInput,
  type IncidentEnvironment,
  type IncidentSeverity,
  type NormalizedIncident,
} from './incidents.js';
import { scrubString } from './redaction.js';
import { getIncidentSink, type IncidentPersistStatus } from './sink.js';

export const FLOW_TELEMETRY_SINK_TIMEOUT_MS = 1_500;

export interface BoundedFlowContext {
  readonly flowId: string;
  readonly moduleId: string;
  readonly action: string;
  readonly traceId?: string | undefined;
  readonly actorTelegramId?: bigint | undefined;
  readonly actorRole?: string | undefined;
  readonly environment?: IncidentEnvironment | undefined;
  readonly timeoutMs?: number | undefined;
  readonly metadata?: Readonly<Record<string, string | number | boolean>> | undefined;
}

export interface CaptureFlowErrorResult {
  readonly handled: boolean;
  readonly errorReference: string;
  readonly traceId: string;
  readonly status: IncidentPersistStatus;
  readonly severity: IncidentSeverity;
  readonly isOperational: boolean;
  readonly userMessageArabic: string;
  readonly incident: NormalizedIncident;
}

const DEFAULT_ARABIC_USER_MESSAGE =
  'تعذر إتمام العملية حالياً بسبب عطل فني وتم تسجيل البلاغ للمراجعة.';

const inFlightOrCapturedErrors = new WeakMap<object, Promise<CaptureFlowErrorResult>>();
const resolvedCapturedErrors = new WeakMap<object, CaptureFlowErrorResult>();

/**
 * Checks whether an Error object has already been captured by a flow boundary,
 * preventing double-recording in outer handlers such as `bot.catch`.
 */
export function isFlowErrorCaptured(error: unknown): boolean {
  if (error !== null && typeof error === 'object') {
    return inFlightOrCapturedErrors.has(error) || resolvedCapturedErrors.has(error);
  }
  return false;
}

/**
 * Returns the previously resolved CaptureFlowErrorResult if the error instance was already processed.
 */
export function getCapturedFlowErrorResult(error: unknown): CaptureFlowErrorResult | undefined {
  if (error !== null && typeof error === 'object') {
    return resolvedCapturedErrors.get(error);
  }
  return undefined;
}

function resolveSeverity(error: unknown): IncidentSeverity {
  if (error instanceof FinancialInvariantError) {
    return 'FATAL';
  }
  if (error instanceof AlsaadaBaseError) {
    return error.severity;
  }
  return 'ERROR';
}

function resolveUserMessageArabic(error: unknown): string {
  if (error instanceof AlsaadaBaseError && error.userMessageArabic.trim().length > 0) {
    return scrubString(error.userMessageArabic).slice(0, 500);
  }
  return DEFAULT_ARABIC_USER_MESSAGE;
}

function buildBreadcrumbsFromMetadata(
  action: string,
  metadata?: Readonly<Record<string, string | number | boolean>> | undefined,
): IncidentBreadcrumbInput[] {
  const crumbs: IncidentBreadcrumbInput[] = [{ action }];
  if (!metadata) {
    return crumbs;
  }
  for (const [key, val] of Object.entries(metadata)) {
    crumbs.push({
      action: `${scrubString(key)}=${scrubString(String(val))}`,
    });
  }
  return crumbs;
}

async function persistWithTimeout(
  incident: NormalizedIncident,
  defaultReference: string,
  isOperational: boolean,
  timeoutMs: number,
): Promise<{ status: IncidentPersistStatus; errorReference: string }> {
  const sink = getIncidentSink();

  if (!sink) {
    if (isOperational) {
      return { status: 'persisted', errorReference: defaultReference };
    }
    try {
      writeEmergencyIncident(incident.traceId, `NO_SINK_${incident.errorName}`);
      return { status: 'emergency', errorReference: defaultReference };
    } catch {
      return { status: 'failed', errorReference: defaultReference };
    }
  }

  let timerHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerHandle = setTimeout(() => {
        reject(new Error(`SINK_TIMEOUT_${timeoutMs}MS`));
      }, timeoutMs);
    });

    const sinkResult = await Promise.race([sink.persist(incident), timeoutPromise]);

    if (typeof sinkResult === 'boolean' && !sinkResult) {
      throw new Error('SINK_RETURNED_FALSE');
    }

    if (sinkResult && typeof sinkResult === 'object' && sinkResult.persisted === false) {
      throw new Error('SINK_PERSISTED_FALSE');
    }

    const resolvedReference =
      sinkResult &&
      typeof sinkResult === 'object' &&
      typeof sinkResult.errorReference === 'string' &&
      sinkResult.errorReference.trim().length > 0
        ? sinkResult.errorReference.trim()
        : defaultReference;

    if (!isOperational && typeof sink.notifyAdmins === 'function') {
      void Promise.resolve()
        .then(() => sink.notifyAdmins!(incident, resolvedReference))
        .catch(() => {
          /* Fire-and-forget admin notification: never block user error card delivery */
        });
    }

    return { status: 'persisted', errorReference: resolvedReference };
  } catch (sinkErr) {
    if (isOperational) {
      return { status: 'persisted', errorReference: defaultReference };
    }
    const reason =
      sinkErr instanceof Error && sinkErr.message
        ? `SINK_FALLBACK_${sinkErr.message}`
        : `SINK_FALLBACK_${incident.errorName}`;
    try {
      writeEmergencyIncident(incident.traceId, reason);
      return { status: 'emergency', errorReference: defaultReference };
    } catch {
      return { status: 'failed', errorReference: defaultReference };
    }
  } finally {
    if (timerHandle !== undefined) {
      clearTimeout(timerHandle);
    }
  }
}

async function executeCaptureFlowError(
  error: unknown,
  boundedContext: BoundedFlowContext,
): Promise<CaptureFlowErrorResult> {
  const candidateTraceId = boundedContext.traceId ?? getTraceId() ?? generateTraceId();
  const severity = resolveSeverity(error);
  const operational = isOperationalError(error);
  const mergedMetadata = {
    ...(error instanceof AlsaadaBaseError && error.metadata ? error.metadata : {}),
    ...(boundedContext.metadata ?? {}),
  };

  const incident = normalizeIncident({
    traceId: candidateTraceId,
    source: 'bot',
    service: `flow:${boundedContext.moduleId}:${boundedContext.flowId}`,
    severity,
    action: boundedContext.action,
    sourceLocation: `modules/${boundedContext.moduleId}/src/flows/${boundedContext.flowId}`,
    error,
    actorTelegramId: boundedContext.actorTelegramId,
    actorRole: boundedContext.actorRole,
    breadcrumbs: buildBreadcrumbsFromMetadata(boundedContext.action, mergedMetadata),
    environment: boundedContext.environment ?? 'production',
  });

  const defaultReference = deriveIncidentCode(incident.traceId).replace(/^TRC-/, '#ERR-');
  const timeoutMs =
    typeof boundedContext.timeoutMs === 'number' && boundedContext.timeoutMs > 0
      ? boundedContext.timeoutMs
      : FLOW_TELEMETRY_SINK_TIMEOUT_MS;

  const { status, errorReference } = await persistWithTimeout(
    incident,
    defaultReference,
    operational,
    timeoutMs,
  );

  return {
    handled: true,
    errorReference,
    traceId: incident.traceId,
    status,
    severity,
    isOperational: operational,
    userMessageArabic: resolveUserMessageArabic(error),
    incident,
  };
}

/**
 * Captures, scrubs, normalizes, and persists a flow boundary error with a strict 1500ms timeout
 * and non-blocking fallback to `writeEmergencyIncident` (Work Plan 94 - NEW-91).
 */
export async function captureFlowError(
  error: unknown,
  boundedContext: BoundedFlowContext,
): Promise<CaptureFlowErrorResult> {
  if (error !== null && typeof error === 'object') {
    const existingPromise = inFlightOrCapturedErrors.get(error);
    if (existingPromise) {
      return await existingPromise;
    }

    const promise = executeCaptureFlowError(error, boundedContext).then((result) => {
      resolvedCapturedErrors.set(error, result);
      return result;
    });
    inFlightOrCapturedErrors.set(error, promise);
    return await promise;
  }

  return await executeCaptureFlowError(error, boundedContext);
}
