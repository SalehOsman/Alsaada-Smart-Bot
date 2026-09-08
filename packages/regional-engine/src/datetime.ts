import { normalizeDigits } from './numbers.js';

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
 * Formats a Date object to DD-MM-YYYY (يوم-شهر-سنة).
 * E.g., "26-05-2028"
 */
export function formatDateDMY(date: Date = new Date()): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
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

export interface ParsedFlexibleDate {
  isValid: boolean;
  date?: Date;
  formattedDMY?: string; // DD-MM-YYYY (يوم-شهر-سنة)
  formattedISO?: string; // YYYY-MM-DD
  year?: number;
  month?: number;
  day?: number;
  error?: string;
}

/**
 * دالة مركزية شاملة لمعالجة جميع أشكال وتنسيقات التواريخ:
 * - الأرقام المشرقية والعربية (٢٠٢٨/٠٥/٢٦ أو 26-05-2028).
 * - مختلف الفواصل: الشرطات (-) أو السلاش (/) أو النقط (.) أو المسافات.
 * - صيغ: يوم-شهر-سنة (DD-MM-YYYY) وسنة-شهر-يوم (YYYY-MM-DD).
 * - سنة وشهر فقط: (YYYY/MM أو MM/YYYY) مع تعيين اليوم تلقائياً إلى 01.
 * - سنوات مختصرة بخانتين (مثل 28 -> 2028).
 * - استخراج التاريخ من داخل النصوص (مثل "البطاقة سارية حتى 2028/05").
 */
export function parseFlexibleDate(rawInput: string | null | undefined): ParsedFlexibleDate {
  if (!rawInput || typeof rawInput !== 'string') {
    return { isValid: false, error: 'لم يتم إدخال تاريخ.' };
  }

  // 1. تحويل الأرقام المشرقية إلى إنجليزية
  const clean = normalizeDigits(rawInput.trim());

  // 2. إذا كان النص يحتوي على عبارات مثل "سارية حتى" أو "تاريخ"، نبحث عن نمط التاريخ داخله
  const extractedMatch = clean.match(/(\d{1,4})[\s/.-]+(\d{1,2})(?:[\s/.-]+(\d{1,4}))?/);
  if (!extractedMatch) {
    // فحص إذا كان رقماً متصلاً مثل 26052028 أو 20280526
    const compactMatch = clean.match(/(\d{8})/);
    if (compactMatch) {
      const s = compactMatch[1]!;
      if (s.startsWith('19') || s.startsWith('20')) {
        const y = parseInt(s.substring(0, 4), 10);
        const m = parseInt(s.substring(4, 6), 10);
        const d = parseInt(s.substring(6, 8), 10);
        return constructDateResult(y, m, d);
      } else {
        const d = parseInt(s.substring(0, 2), 10);
        const m = parseInt(s.substring(2, 4), 10);
        const y = parseInt(s.substring(4, 8), 10);
        return constructDateResult(y, m, d);
      }
    }
    return {
      isValid: false,
      error: 'صيغة التاريخ غير صحيحة. يرجى إدخال التاريخ بصيغة: يوم-شهر-سنة (مثال: 26-05-2028 أو 2028/05).',
    };
  }

  const p1 = parseInt(extractedMatch[1]!, 10);
  const p2 = parseInt(extractedMatch[2]!, 10);
  const p3 = extractedMatch[3] ? parseInt(extractedMatch[3]!, 10) : undefined;

  let year = 0;
  let month = 0;
  let day = 1;

  if (p3 !== undefined) {
    if (p1 > 1000) {
      year = p1;
      month = p2;
      day = p3;
    } else if (p3 > 1000) {
      day = p1;
      month = p2;
      year = p3;
    } else if (p3 < 100) {
      day = p1;
      month = p2;
      year = p3 <= 50 ? 2000 + p3 : 1900 + p3;
    } else {
      day = p1;
      month = p2;
      year = p3;
    }
  } else {
    if (p1 > 1000) {
      year = p1;
      month = p2;
      day = 1;
    } else if (p2 > 1000) {
      month = p1;
      year = p2;
      day = 1;
    } else {
      month = p1;
      year = p2 <= 50 ? 2000 + p2 : 1900 + p2;
      day = 1;
    }
  }

  if (month > 12 && day <= 12) {
    const tmp = month;
    month = day;
    day = tmp;
  }

  return constructDateResult(year, month, day);
}

function constructDateResult(year: number, month: number, day: number): ParsedFlexibleDate {
  if (year < 1920 || year > 2100) {
    return { isValid: false, error: 'السنة غير صالحة (يجب أن تكون بين 1920 و 2100).' };
  }
  if (month < 1 || month > 12) {
    return { isValid: false, error: 'الشهر غير صالح (يجب أن يكون بين 1 و 12).' };
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) {
    return { isValid: false, error: `اليوم غير صالح لهذا الشهر (الحد الأقصى ${daysInMonth} يوماً).` };
  }

  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const yyyy = String(year);

  return {
    isValid: true,
    date,
    formattedDMY: `${dd}-${mm}-${yyyy}`,
    formattedISO: `${yyyy}-${mm}-${dd}`,
    year,
    month,
    day,
  };
}
