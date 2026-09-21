import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateAlertPolicy } from '../flow.validators.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.8 Data & Validation Tests — رادار الأداء ومراقبة الخدمات', () => {
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

  it('validates supported alert sensitivity policy types', () => {
    // Arrange
    const smartPolicy = 'SMART';
    const immediatePolicy = 'IMMEDIATE';
    const dailyPolicy = 'DAILY_DIGEST';

    // Act
    const isSmartValid = validateAlertPolicy(smartPolicy);
    const isImmediateValid = validateAlertPolicy(immediatePolicy);
    const isDailyValid = validateAlertPolicy(dailyPolicy);

    // Assert
    expect(isSmartValid).toBe(true);
    expect(isImmediateValid).toBe(true);
    expect(isDailyValid).toBe(true);
  });

  it('rejects unsupported alert policy string', () => {
    // Arrange
    const invalidPolicy = 'WEEKLY_SUMMARY';

    // Act
    const isValid = validateAlertPolicy(invalidPolicy);

    // Assert
    expect(isValid).toBe(false);
  });

  it('rejects empty policy candidate string', () => {
    // Arrange
    const emptyPolicy = '';

    // Act
    const isValid = validateAlertPolicy(emptyPolicy);

    // Assert
    expect(isValid).toBe(false);
  });
});
