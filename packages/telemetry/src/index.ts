/**
 * @alsaada/telemetry
 * Enterprise JSON Structured Logging, Unified Trace ID Telemetry & Sensitive Data Redaction Engine
 * Zero runtime internal or external dependencies.
 * Compliance: Plan 19 Section 3, 4, 5 & Rule NEW-12
 */

// Core Types
export type {
  GrammyTelemetryOptions,
  HttpRequestLike,
  HttpResponseLike,
  LogLevel,
  RedactionOptions,
  TelegramStructuralContext,
  TelemetryActor,
  TelemetryContext,
  TelemetryError,
  TelemetryLogEntry,
  TelemetryLogInput,
  TelemetryLoggerOptions,
} from './types.js';

// Constants & Patterns
export {
  DB_URL_CREDENTIALS_REGEX,
  DEFAULT_MAX_ARRAY_LENGTH,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_STRING_LENGTH,
  EGYPTIAN_NID_GENERAL_REGEX,
  EGYPTIAN_NID_SEGMENTED_REGEX,
  EGYPTIAN_PHONE_REGEX,
  GEMINI_API_KEY_REGEX,
  JWT_TOKEN_REGEX,
  MAGIC_SESSION_TOKEN_REGEX,
  PRIVATE_KEY_REGEX,
  REDIS_NO_USER_URL_REGEX,
  SENSITIVE_KEY_PATTERN,
  SENSITIVE_KEY_ROOTS,
  TELEGRAM_BOT_TOKEN_REGEX,
  TRACE_ID_REGEX,
  W3C_TRACEPARENT_REGEX,
} from './constants.js';

// Redaction & Masking Engine
export {
  isSensitiveKey,
  maskEgyptianNationalId,
  redact,
  scrubString,
} from './redaction.js';

// Context & AsyncLocalStorage
export {
  formatTraceparent,
  generateSpanId,
  generateTraceId,
  getTelemetryContext,
  getTraceId,
  runWithTelemetryContext,
} from './context.js';

// Structured Logger
export { TelemetryLogger } from './logger.js';

// Normalized incident contract and emergency fallback.
export type {
  IncidentBreadcrumbInput,
  IncidentEnvironment,
  IncidentInput,
  IncidentSeverity,
  IncidentSource,
  NormalizedIncident,
  NormalizedIncidentBreadcrumb,
} from './incidents.js';
export { normalizeIncident } from './incidents.js';
export { writeEmergencyIncident } from './emergency-sink.js';

// Adapters
export {
  extractTelegramActor,
  resolveTelegramActionTrigger,
  telemetryMiddleware,
} from './adapters/grammy.js';

export {
  createTraceHeaders,
  deriveIncidentCode,
  extractTraceId,
  formatHexToUuid,
  isValidTraceId,
} from './adapters/next.js';

// Living Version & Runtime Telemetry Provider
export type { ReleasePhase, SystemVersionInfo } from './version.js';
export {
  COMPLETED_PLANS_COUNT,
  PLATFORM_BUILD_TIME,
  PLATFORM_PHASE,
  PLATFORM_VERSION,
  formatVersionBanner,
  getSystemVersion,
} from './version.js';

