import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateCompanyFieldValue } from '../flow.validators.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.1 Data & Validation Tests — الملف التعريفي وبيانات الشركة', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates legal company name successfully', () => {
    // Arrange
    const fieldKey = 'legalName';
    const value = 'شركة السعادة للمقاولات العامة';

    // Act
    const res = validateCompanyFieldValue(fieldKey, value);

    // Assert
    expect(res.isValid).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('rejects malformed email format with localized validation error', () => {
    // Arrange
    const fieldKey = 'officialEmail';
    const badEmail = 'bad-email-without-at';

    // Act
    const res = validateCompanyFieldValue(fieldKey, badEmail);

    // Assert
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('صيغة البريد الإلكتروني غير صحيحة.');
  });

  it('rejects unsupported currency values outside EGP', () => {
    // Arrange
    const fieldKey = 'baseCurrency';
    const unsupported = 'USD';

    // Act
    const res = validateCompanyFieldValue(fieldKey, unsupported);

    // Assert
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('العملة المدعومة حالياً هي الجنيه المصري (EGP) فقط.');
  });

  it('rejects whitespace-only or empty strings', () => {
    // Arrange
    const fieldKey = 'headquartersAddress';
    const emptyValue = '   ';

    // Act
    const res = validateCompanyFieldValue(fieldKey, emptyValue);

    // Assert
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('لا يمكن أن تكون القيمة فارغة.');
  });
});
