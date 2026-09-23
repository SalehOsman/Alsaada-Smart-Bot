import type { IncidentSeverity } from './incidents.js';

export interface AlsaadaErrorOptions {
  readonly code?: string | undefined;
  readonly severity?: IncidentSeverity | undefined;
  readonly isOperational?: boolean | undefined;
  readonly userMessageArabic?: string | undefined;
  readonly metadata?: Readonly<Record<string, string | number | boolean>> | undefined;
  readonly cause?: unknown;
}

/**
 * Base error class for Al-Saada Smart Bot telemetry classification (Work Plan 94 - NEW-91).
 */
export class AlsaadaBaseError extends Error {
  public readonly code: string;
  public readonly severity: IncidentSeverity;
  public readonly isOperational: boolean;
  public readonly userMessageArabic: string;
  public readonly metadata?: Readonly<Record<string, string | number | boolean>> | undefined;

  constructor(message: string, options: AlsaadaErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = options.code ?? 'ALSAADA_ERROR';
    this.severity = options.severity ?? 'ERROR';
    this.isOperational = options.isOperational ?? false;
    this.userMessageArabic =
      options.userMessageArabic ??
      'تعذر إتمام العملية حالياً بسبب عطل فني وتم تسجيل البلاغ للمراجعة.';
    this.metadata = options.metadata;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Expected user input or business validation error.
 * Handled locally at the flow boundary without triggering admin emergency alerts.
 */
export class OperationalError extends AlsaadaBaseError {
  constructor(
    message: string,
    options: Omit<AlsaadaErrorOptions, 'isOperational' | 'severity'> & {
      readonly severity?: IncidentSeverity | undefined;
    } = {},
  ) {
    super(message, {
      ...options,
      code: options.code ?? 'OPERATIONAL_ERROR',
      severity: options.severity ?? 'WARNING',
      isOperational: true,
      userMessageArabic:
        options.userMessageArabic ?? 'يرجى التحقق من البيانات المدخلة والمحاولة مرة أخرى.',
    });
  }
}

/**
 * Unexpected runtime, database, or network failure requiring immediate incident vault recording.
 */
export class UnexpectedSystemError extends AlsaadaBaseError {
  constructor(message: string, options: Omit<AlsaadaErrorOptions, 'isOperational'> = {}) {
    super(message, {
      ...options,
      code: options.code ?? 'UNEXPECTED_SYSTEM_ERROR',
      severity: options.severity ?? 'ERROR',
      isOperational: false,
    });
  }
}

/**
 * Catastrophic accounting or double-entry ledger invariant breach (classified as FATAL).
 */
export class FinancialInvariantError extends AlsaadaBaseError {
  constructor(
    message: string,
    options: Omit<AlsaadaErrorOptions, 'isOperational' | 'severity'> = {},
  ) {
    super(message, {
      ...options,
      code: options.code ?? 'FINANCIAL_INVARIANT_BREACH',
      severity: 'FATAL',
      isOperational: false,
      userMessageArabic:
        options.userMessageArabic ??
        'تم إيقاف العملية فوراً لحماية التوازن المحاسبي وتم تسجيل بلاغ طوارئ للإدارة.',
    });
  }
}

export function isOperationalError(error: unknown): error is OperationalError {
  return (
    error instanceof OperationalError ||
    (error instanceof AlsaadaBaseError && error.isOperational === true)
  );
}
