import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cp from 'node:child_process';
import { checkCodeSecurity } from '../verify-code-security.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

describe('verify-code-security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass when semgrep finds no issues', () => {
    vi.mocked(cp.execFileSync).mockImplementation((cmd, args) => {
      if (cmd === 'where.exe' || cmd === 'which') return '';
      return JSON.stringify({ results: [], paths: { scanned: ['file1.ts'] } });
    });
    const result = checkCodeSecurity();
    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.checked).toBe(1);
  });

  it('should fail when semgrep binary is missing', () => {
    vi.mocked(cp.execFileSync).mockImplementationOnce(() => {
      throw new Error('Command failed');
    });
    const result = checkCodeSecurity();
    expect(result.ok).toBe(false);
    expect(result.failures).toContain('semgrep binary not found. Please install semgrep.');
  });

  it('should fail on semgrep ERROR severity', () => {
    vi.mocked(cp.execFileSync).mockImplementation((cmd, args) => {
      if (cmd === 'where.exe' || cmd === 'which') return '';
      const output = {
        results: [{
          path: 'src/bad.ts',
          start: { line: 10 },
          extra: { severity: 'ERROR', message: 'Bad code' }
        }]
      };
      const error = new Error('failed') as any;
      error.stdout = JSON.stringify(output);
      throw error;
    });
    const result = checkCodeSecurity();
    expect(result.ok).toBe(false);
    expect(result.failures).toContain('src/bad.ts:10 - Bad code');
  });

  it('should warn on semgrep WARNING severity and not fail', () => {
    vi.mocked(cp.execFileSync).mockImplementation((cmd, args) => {
      if (cmd === 'where.exe' || cmd === 'which') return '';
      return JSON.stringify({
        results: [{
          path: 'src/warn.ts',
          start: { line: 5 },
          extra: { severity: 'WARNING', message: 'Warning code' }
        }],
        paths: { scanned: ['src/warn.ts'] }
      });
    });
    const result = checkCodeSecurity();
    expect(result.ok).toBe(true);
    expect(result.warnings).toContain('src/warn.ts:5 - Warning code');
    expect(result.checked).toBe(1);
  });

  it('should warn on semgrep syntax errors', () => {
    vi.mocked(cp.execFileSync).mockImplementation((cmd, args) => {
      if (cmd === 'where.exe' || cmd === 'which') return '';
      return JSON.stringify({ errors: [{ message: 'Syntax error at file.ts' }] });
    });
    const result = checkCodeSecurity();
    expect(result.ok).toBe(true);
    expect(result.warnings).toContain('Semgrep Parse Warning: Syntax error at file.ts');
  });

  it('should fail on other semgrep internal errors', () => {
    vi.mocked(cp.execFileSync).mockImplementation((cmd, args) => {
      if (cmd === 'where.exe' || cmd === 'which') return '';
      return JSON.stringify({ errors: [{ message: 'Fatal error' }] });
    });
    const result = checkCodeSecurity();
    expect(result.ok).toBe(false);
    expect(result.failures).toContain('Semgrep Error: Fatal error');
  });

  it('should fail when output is invalid JSON', () => {
    vi.mocked(cp.execFileSync).mockImplementation((cmd, args) => {
      if (cmd === 'where.exe' || cmd === 'which') return '';
      return 'invalid json';
    });
    const result = checkCodeSecurity();
    expect(result.ok).toBe(false);
    expect(result.failures).toContain('Failed to parse semgrep JSON output');
  });
});
