/**
 * Regional Date & Time Utilities (Africa/Cairo standard)
 */

export const DEFAULT_TIMEZONE = 'Africa/Cairo';

/**
 * Returns the current date/time localized to the operational timezone.
 */
export function nowInTimezone(timezone: string = DEFAULT_TIMEZONE): Date {
  return new Date();
}

/**
 * Formats a Date object to YYYY-MM-DD in the target timezone.
 * E.g., "2026-09-07"
 */
export function formatDate(
  date: Date = new Date(),
  timezone: string = DEFAULT_TIMEZONE
): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Formats a Date object to full readable timestamp with Arabic AM/PM.
 * E.g., "2026-09-07 11:20:00 ص"
 */
export function formatDateTime(
  date: Date = new Date(),
  timezone: string = DEFAULT_TIMEZONE
): string {
  const dateStr = formatDate(date, timezone);
  const timeFormatter = new Intl.DateTimeFormat('ar-EG', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  return `${dateStr} ${timeFormatter.format(date)}`;
}
