/**
 * Universal Formatters Suite — Al-Saada Smart Bot Dashboard
 *
 * Provides strictly consistent date, time, currency, and numerical formatting
 * adhering to the user's selected numeral system ('western' vs 'eastern') and timezone.
 * Eliminates mixing of Eastern (Hindi) and Western (English) numerals.
 */

import { normalizeDigits } from '@alsaada/regional-engine';

export type NumberFormatMode = 'western' | 'eastern';

export const EASTERN_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toEasternDigits(str: string): string {
  if (!str) return '';
  return str.replace(/\d/g, (d) => EASTERN_DIGITS[parseInt(d, 10)] ?? d);
}

export function parseDateSafe(val?: Date | string | number | null): Date | null {
  if (val === undefined || val === null || val === '') return new Date();
  const d = val instanceof Date ? val : new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export interface FormatDateTimeOptions {
  numberFormat?: NumberFormatMode;
  timezone?: string;
  includeSeconds?: boolean;
  hour12?: boolean;
}

export interface FormatDateOptions {
  numberFormat?: NumberFormatMode;
  timezone?: string;
  format?: 'DD/MM/YYYY' | 'YYYY-MM-DD';
}

export interface FormatNumberOptions {
  numberFormat?: NumberFormatMode;
  decimals?: number;
}

export interface FormatCurrencyOptions {
  numberFormat?: NumberFormatMode;
  currencySymbol?: string;
  decimals?: number;
}

/**
 * Universal date/time formatter respecting Western/Eastern numeral systems
 */
export function formatDateTime(
  date?: Date | string | number | null,
  options?: FormatDateTimeOptions
): string {
  const d = parseDateSafe(date);
  if (!d) return '--';
  const tz = options?.timezone || 'Africa/Cairo';
  const numMode = options?.numberFormat || 'western';
  const includeSeconds = options?.includeSeconds ?? true;
  const hour12 = options?.hour12 ?? true;

  try {
    const formatter = new Intl.DateTimeFormat('ar-EG', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12,
    });
    const formatted = formatter.format(d);
    return numMode === 'eastern' ? toEasternDigits(formatted) : normalizeDigits(formatted);
  } catch {
    const fallback = d.toLocaleString();
    return numMode === 'eastern' ? toEasternDigits(fallback) : normalizeDigits(fallback);
  }
}

/**
 * Universal date formatter
 */
export function formatDate(
  date?: Date | string | number | null,
  options?: FormatDateOptions
): string {
  const d = parseDateSafe(date);
  if (!d) return '--/--/----';
  const tz = options?.timezone || 'Africa/Cairo';
  const numMode = options?.numberFormat || 'western';
  const dateFormat = options?.format || 'DD/MM/YYYY';

  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);

    const y = parts.find((p) => p.type === 'year')?.value || '2026';
    const m = parts.find((p) => p.type === 'month')?.value || '01';
    const day = parts.find((p) => p.type === 'day')?.value || '01';

    const raw = dateFormat === 'YYYY-MM-DD' ? `${y}-${m}-${day}` : `${day}/${m}/${y}`;
    return numMode === 'eastern' ? toEasternDigits(raw) : raw;
  } catch {
    const fallback = d.toLocaleDateString();
    return numMode === 'eastern' ? toEasternDigits(fallback) : fallback;
  }
}

/**
 * Universal time formatter
 */
export function formatTime(
  date?: Date | string | number | null,
  options?: FormatDateTimeOptions
): string {
  const d = parseDateSafe(date);
  if (!d) return '--:--';
  const tz = options?.timezone || 'Africa/Cairo';
  const numMode = options?.numberFormat || 'western';
  const includeSeconds = options?.includeSeconds ?? false;
  const hour12 = options?.hour12 ?? true;

  try {
    const formatter = new Intl.DateTimeFormat('ar-EG', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12,
    });
    const formatted = formatter.format(d);
    return numMode === 'eastern' ? toEasternDigits(formatted) : normalizeDigits(formatted);
  } catch {
    const fallback = d.toLocaleTimeString();
    return numMode === 'eastern' ? toEasternDigits(fallback) : fallback;
  }
}

/**
 * Universal number formatter with strict digit normalization
 */
export function formatNumber(
  value: number | string | null | undefined,
  options?: FormatNumberOptions | NumberFormatMode
): string {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return String(value);

  const opts = typeof options === 'string' ? { numberFormat: options } : options;
  const numMode = opts?.numberFormat || 'western';
  const decimals = opts?.decimals;

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);

  return numMode === 'eastern' ? toEasternDigits(formatted) : formatted;
}

/**
 * Universal currency formatter
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  options?: FormatCurrencyOptions
): string {
  const symbol = options?.currencySymbol || 'ج.م';
  const formattedNum = formatNumber(amount, {
    numberFormat: options?.numberFormat,
    decimals: options?.decimals,
  });
  return `${formattedNum} ${symbol}`;
}

/**
 * Helper to fetch server cookies preferences in Server Components
 */
export async function getServerPreferences(): Promise<{
  numberFormat: NumberFormatMode;
  timezone: string;
  theme: 'light' | 'dark';
}> {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const numberFormat =
      (cookieStore.get('alsaada_num_format')?.value as NumberFormatMode) || 'western';
    const timezone = cookieStore.get('alsaada_tz')?.value || 'Africa/Cairo';
    const theme = (cookieStore.get('alsaada_theme')?.value as 'light' | 'dark') || 'light';
    return { numberFormat, timezone, theme };
  } catch {
    return {
      numberFormat: 'western',
      timezone: 'Africa/Cairo',
      theme: 'light',
    };
  }
}
