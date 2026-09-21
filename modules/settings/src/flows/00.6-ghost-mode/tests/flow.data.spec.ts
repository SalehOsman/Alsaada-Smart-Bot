import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateImpersonationRole } from '../flow.validators.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.6 Data & Validation Tests — محاكاة وتقمص الأدوار', () => {
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

  it('validates supported simulation role within allowed whitelist', () => {
    // Arrange
    const roleCandidate = 'FIELD_ADMIN';

    // Act
    const res = validateImpersonationRole(roleCandidate);

    // Assert
    expect(res.isValid).toBe(true);
    expect(res.role).toBe('FIELD_ADMIN');
  });

  it('rejects unsupported or arbitrary role strings', () => {
    // Arrange
    const invalidRole = 'UNAUTHORIZED_ROLE';

    // Act
    const res = validateImpersonationRole(invalidRole);

    // Assert
    expect(res.isValid).toBe(false);
    expect(res.role).toBeUndefined();
  });

  it('rejects empty role input string', () => {
    // Arrange
    const emptyRole = '';

    // Act
    const res = validateImpersonationRole(emptyRole);

    // Assert
    expect(res.isValid).toBe(false);
    expect(res.role).toBeUndefined();
  });
});
