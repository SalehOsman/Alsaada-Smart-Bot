import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateAdminFullName, validateAdminPhone } from '../flow.validators.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.4 Data & Validation Tests — الملف الشخصي للمدير العام', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('validates Egyptian mobile phone format and normalizes number', () => {
    // Arrange
    const rawPhone = '010-1234-5678';

    // Act
    const res = validateAdminPhone(rawPhone);

    // Assert
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe('01012345678');
    expect(res.error).toBeUndefined();
  });

  it('rejects malformed or short phone number with localized error', () => {
    // Arrange
    const invalidPhone = '12345';

    // Act
    const res = validateAdminPhone(invalidPhone);

    // Assert
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('رقم الهاتف يجب أن يكون رقماً مصرياً صحيحاً مكوناً من 11 رقماً ويبدأ بـ 01.');
  });

  it('validates valid full name meeting minimum length criteria', () => {
    // Arrange
    const validName = 'صالح عثمان';

    // Act
    const res = validateAdminFullName(validName);

    // Assert
    expect(res.isValid).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('rejects short or empty full name below threshold', () => {
    // Arrange
    const shortName = '  ص  ';

    // Act
    const res = validateAdminFullName(shortName);

    // Assert
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('الاسم يجب ألا يقل عن 3 أحرف.');
  });
});
