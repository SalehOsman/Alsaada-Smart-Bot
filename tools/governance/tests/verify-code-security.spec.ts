import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as cp from 'node:child_process';
import { checkCodeSecurity } from '../verify-code-security.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('verify-code-security', () => {
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

  it('passes when semgrep finds no issues', () => {
    // Arrange
    vi.mocked(cp.execFileSync).mockImplementation((cmd) => {
      if (cmd === 'where.exe' || cmd === 'which') return '';
      return JSON.stringify({ results: [], paths: { scanned: ['file1.ts'] } });
    });

    // Act
    const result = checkCodeSecurity();

    // Assert
    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.checked).toBe(1);
    expect(result.failures).not.toContain('semgrep binary not found');
  });

  it('fails when semgrep binary is missing', () => {
    // Arrange
    vi.mocked(cp.execFileSync).mockImplementationOnce(() => {
      throw new Error('Command failed');
    });

    // Act
    const result = checkCodeSecurity();

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures).toContain('semgrep binary not found. Please install semgrep.');
    expect(result.failures).not.toHaveLength(0);
  });

  it('fails on semgrep ERROR severity', () => {
    // Arrange
    vi.mocked(cp.execFileSync).mockImplementation((cmd) => {
      if (cmd === 'where.exe' || cmd === 'which') return '';
      const output = {
        results: [{
          path: 'src/bad.ts',
          start: { line: 10 },
          extra: { severity: 'ERROR', message: 'Bad code' }
        }]
      };
      const error = new Error('failed') as unknown as { stdout: string };
      error.stdout = JSON.stringify(output);
      throw error;
    });

    // Act
    const result = checkCodeSecurity();

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures).toContain('src/bad.ts:10 - Bad code');
    expect(result.failures).not.toHaveLength(0);
  });

  it('warns on semgrep WARNING severity without failing', () => {
    // Arrange
    vi.mocked(cp.execFileSync).mockImplementation((cmd) => {
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

    // Act
    const result = checkCodeSecurity();

    // Assert
    expect(result.ok).toBe(true);
    expect(result.warnings).toContain('src/warn.ts:5 - Warning code');
    expect(result.checked).toBe(1);
    expect(result.failures).toHaveLength(0);
  });

  it('warns on semgrep syntax errors', () => {
    // Arrange
    vi.mocked(cp.execFileSync).mockImplementation((cmd) => {
      if (cmd === 'where.exe' || cmd === 'which') return '';
      return JSON.stringify({ errors: [{ message: 'Syntax error at file.ts' }] });
    });

    // Act
    const result = checkCodeSecurity();

    // Assert
    expect(result.ok).toBe(true);
    expect(result.warnings).toContain('Semgrep Parse Warning: Syntax error at file.ts');
    expect(result.failures).toHaveLength(0);
  });

  it('fails on other semgrep internal errors', () => {
    // Arrange
    vi.mocked(cp.execFileSync).mockImplementation((cmd) => {
      if (cmd === 'where.exe' || cmd === 'which') return '';
      return JSON.stringify({ errors: [{ message: 'Fatal error' }] });
    });

    // Act
    const result = checkCodeSecurity();

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures).toContain('Semgrep Error: Fatal error');
    expect(result.failures).not.toHaveLength(0);
  });

  it('fails when output is invalid JSON', () => {
    // Arrange
    vi.mocked(cp.execFileSync).mockImplementation((cmd) => {
      if (cmd === 'where.exe' || cmd === 'which') return '';
      return 'invalid json';
    });

    // Act
    const result = checkCodeSecurity();

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures).toContain('Failed to parse semgrep JSON output');
    expect(result.failures).not.toHaveLength(0);
  });
});
