import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as cp from 'node:child_process';
import { checkSecretLeakage } from '../verify-secret-leakage.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('verify-secret-leakage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('passes when gitleaks finds no secrets', () => {
    // Arrange
    vi.mocked(cp.execFileSync).mockReturnValue('ok');

    // Act
    const result = checkSecretLeakage();

    // Assert
    expect(result.ok).toBe(true);
    expect(result.checked).toBe(2);
    expect(result.failures).toHaveLength(0);
    expect(result.failures).not.toContain('Secret leakage detected');
  });

  it('fails when gitleaks binary is missing', () => {
    // Arrange
    vi.mocked(cp.execFileSync).mockImplementationOnce(() => {
      throw new Error('Command failed');
    });

    // Act
    const result = checkSecretLeakage();

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures).toContain('gitleaks binary not found. Please install gitleaks.');
    expect(result.failures).not.toHaveLength(0);
  });

  it('fails when detect finds secrets', () => {
    // Arrange
    vi.mocked(cp.execFileSync).mockImplementation((_cmd, args) => {
      if (args && args.includes('detect')) {
        const error = new Error('failed') as unknown as { stdout: string };
        error.stdout = 'leak found';
        throw error;
      }
      return '';
    });

    // Act
    const result = checkSecretLeakage();

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures).toContain('Secret leakage detected in git history (detect mode).');
    expect(result.failures).toContain('leak found');
    expect(result.failures).not.toHaveLength(0);
  });

  it('fails when protect finds secrets', () => {
    // Arrange
    vi.mocked(cp.execFileSync).mockImplementation((_cmd, args) => {
      if (args && args.includes('protect')) {
        const error = new Error('failed') as unknown as { stdout: string };
        error.stdout = 'leak found';
        throw error;
      }
      return '';
    });

    // Act
    const result = checkSecretLeakage();

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures).toContain('Secret leakage detected in staged files (protect mode).');
    expect(result.failures).toContain('leak found');
    expect(result.failures).not.toHaveLength(0);
  });
});
