import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateMaintenanceToggle } from '../flow.validators.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.9 Data & Validation Tests — صمامات الطوارئ والذاكرة اللحظية', () => {
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

  it('validates state transition when requested status differs from current state', () => {
    // Arrange
    const current = false;
    const requested = true;

    // Act
    const isValid = validateMaintenanceToggle(current, requested);

    // Assert
    expect(isValid).toBe(true);
  });

  it('rejects redundant toggle request when requested state equals current state', () => {
    // Arrange
    const current = true;
    const redundantRequested = true;

    // Act
    const isValid = validateMaintenanceToggle(current, redundantRequested);

    // Assert
    expect(isValid).toBe(false);
  });
});
