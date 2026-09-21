/**
 * Arabic Text Normalization & Sanitization Utilities
 */

const EASTERN_ARABIC_DIGITS: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
};

export function normalizeArabicDigits(input: string): string {
  return input.replace(
    /[٠-٩۰-۹]/g,
    (digit) => EASTERN_ARABIC_DIGITS[digit] ?? digit,
  );
}

export function sanitizeArabicText(input: string): string {
  return input
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // Remove zero-width characters
    .replace(/\s+/g, " "); // Collapse whitespace
}

export function containsArabic(input: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F]/.test(input);
}
