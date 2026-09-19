import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cp from 'node:child_process';
import { checkSecretLeakage } from '../verify-secret-leakage.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

describe('verify-secret-leakage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass when gitleaks finds no secrets', () => {
    vi.mocked(cp.execFileSync).mockReturnValue('ok');
    const result = checkSecretLeakage();
    expect(result.ok).toBe(true);
    expect(result.checked).toBe(2);
    expect(result.failures).toHaveLength(0);
  });

  it('should fail when gitleaks binary is missing', () => {
    vi.mocked(cp.execFileSync).mockImplementationOnce(() => {
      throw new Error('Command failed');
    });
    const result = checkSecretLeakage();
    expect(result.ok).toBe(false);
    expect(result.failures).toContain('gitleaks binary not found. Please install gitleaks.');
  });

  it('should fail when detect finds secrets', () => {
    vi.mocked(cp.execFileSync).mockImplementation((cmd, args) => {
      if (args && args.includes('detect')) {
        const error = new Error('failed') as any;
        error.stdout = 'leak found';
        throw error;
      }
      return '';
    });
    const result = checkSecretLeakage();
    expect(result.ok).toBe(false);
    expect(result.failures).toContain('Secret leakage detected in git history (detect mode).');
    expect(result.failures).toContain('leak found');
  });

  it('should fail when protect finds secrets', () => {
    vi.mocked(cp.execFileSync).mockImplementation((cmd, args) => {
      if (args && args.includes('protect')) {
        const error = new Error('failed') as any;
        error.stdout = 'leak found';
        throw error;
      }
      return '';
    });
    const result = checkSecretLeakage();
    expect(result.ok).toBe(false);
    expect(result.failures).toContain('Secret leakage detected in staged files (protect mode).');
    expect(result.failures).toContain('leak found');
  });
});
