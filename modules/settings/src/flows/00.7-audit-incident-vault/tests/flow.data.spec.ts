import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseUserIdentifier } from '../flow.validators.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.7 Data & Validation Tests — وحدة التحقيق الجنائي والأعطال', () => {
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

  it('classifies numeric string as TELEGRAM_ID identifier', () => {
    // Arrange
    const rawInput = '7594239391';

    // Act
    const res = parseUserIdentifier(rawInput);

    // Assert
    expect(res.type).toBe('TELEGRAM_ID');
    expect(res.type).not.toBe('INVALID');
    expect(res.value).toBe('7594239391');
  });

  it('classifies alphanumeric string as WORKER_CODE identifier', () => {
    // Arrange
    const rawInput = 'op-ldr-01';

    // Act
    const res = parseUserIdentifier(rawInput);

    // Assert
    expect(res.type).toBe('WORKER_CODE');
    expect(res.type).not.toBe('INVALID');
    expect(res.value).toBe('OP-LDR-01');
  });

  it('flags special characters and punctuation as INVALID identifier', () => {
    // Arrange
    const invalidInput = '???';

    // Act
    const res = parseUserIdentifier(invalidInput);

    // Assert
    expect(res.type).toBe('INVALID');
    expect(res.type).not.toBe('TELEGRAM_ID');
    expect(res.type).not.toBe('WORKER_CODE');
    expect(res.value).toBe('???');
  });
});
