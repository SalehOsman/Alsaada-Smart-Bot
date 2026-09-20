/**
 * Regional Numbers & Digits Utilities
 */

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/**
 * Converts Eastern Arabic and Persian numerals to Western digits (0-9).
 * E.g., '١٥٠٠' -> '1500'
 */
export function normalizeDigits(input: string): string {
  if (!input) return '';
  let result = input;
  
  for (let i = 0; i < 10; i++) {
    result = result
      .replaceAll(ARABIC_INDIC_DIGITS[i]!, String(i))
      .replaceAll(PERSIAN_DIGITS[i]!, String(i));
  }
  
  return result;
}

/**
 * Parses a numeric string that may contain Arabic digits, commas, or spaces.
 * Returns null if the value is not a valid number.
 */
export function parseRegionalNumber(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return (!Number.isFinite(input) || isNaN(input)) ? null : input;

  const rawStr = typeof input === 'string' ? input.trim() : String(input).trim();
  if (/^[+-]?infinity$/i.test(rawStr)) return null;

  const normalized = normalizeDigits(rawStr)
    .replace(/[,٬\s]/g, '') // remove thousands separators (Latin and Arabic) and whitespace
    .replace(/٫/g, '.');   // convert Arabic decimal comma to dot

  const parsed = Number(normalized);
  return (!Number.isFinite(parsed) || isNaN(parsed)) ? null : parsed;
}
