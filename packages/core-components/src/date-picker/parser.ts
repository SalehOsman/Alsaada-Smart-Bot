import { normalizeDigits, formatDate, DEFAULT_TIMEZONE } from '@alsaada/regional-engine';

export interface DateRangeResult {
  startDate: Date;
  endDate: Date;
  daysCount: number;
}

export interface DateValidationOptions {
  allowFuture?: boolean;
  minDate?: Date;
  maxDate?: Date;
}

/**
 * Parses a YYYY-MM-DD or DD/MM/YYYY date string into a Date object.
 */
export function parseRegionalDate(input: string | null | undefined, timezone = DEFAULT_TIMEZONE): Date | null {
  if (!input) return null;
  const clean = normalizeDigits(input.trim());

  // Check YYYY-MM-DD
  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(clean);
  if (isoMatch) {
    const y = parseInt(isoMatch[1]!, 10);
    const m = parseInt(isoMatch[2]!, 10);
    const d = parseInt(isoMatch[3]!, 10);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
      return dt;
    }
  }

  // Check DD-MM-YYYY
  const regionalMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(clean);
  if (regionalMatch) {
    const d = parseInt(regionalMatch[1]!, 10);
    const m = parseInt(regionalMatch[2]!, 10);
    const y = parseInt(regionalMatch[3]!, 10);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
      return dt;
    }
  }

  return null;
}

/**
 * Validates a date against constraints (e.g. no future dates for expenses).
 */
export function validateDate(
  date: Date | null,
  options: DateValidationOptions = {}
): { isValid: boolean; error?: string } {
  if (!date || isNaN(date.getTime())) {
    return { isValid: false, error: 'التاريخ المُدخل غير صالح.' };
  }

  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);

  if (!options.allowFuture && date.getTime() > today.getTime()) {
    return { isValid: false, error: 'لا يمكن تسجيل تاريخ يقع في المستقبل.' };
  }

  if (options.minDate && date.getTime() < options.minDate.getTime()) {
    return { isValid: false, error: `التاريخ يجب أن يكون بعد ${formatDate(options.minDate)}.` };
  }

  if (options.maxDate && date.getTime() > options.maxDate.getTime()) {
    return { isValid: false, error: `التاريخ يجب ألا يتجاوز ${formatDate(options.maxDate)}.` };
  }

  return { isValid: true };
}

/**
 * Calculates days between two dates inclusive.
 */
export function calculateDateRange(startDate: Date, endDate: Date): DateRangeResult {
  const diffTime = endDate.getTime() - startDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive

  return {
    startDate,
    endDate,
    daysCount: Math.max(0, diffDays),
  };
}
