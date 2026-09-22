import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeIncident,
  writeEmergencyIncident,
  type IncidentInput,
} from '../src/index.js';

describe('normalized incident contract', () => {
  const PINNED_BASE_TIME = new Date('2026-03-03T12:00:00.000Z');
  let stdoutSpy: any;
  let stderrSpy: any;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  const baseContext: Omit<IncidentInput, 'error'> = {
    traceId: 'a1b2c3d4-e5f6-4789-abcd-ef0123456789',
    source: 'dashboard-server',
    service: 'admin-dashboard',
    severity: 'ERROR',
    action: 'health.readiness',
    sourceLocation: 'api/health:GET',
    environment: 'test',
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(PINNED_BASE_TIME);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  it('redacts token, cookie, national ID, authorization, and password before returning data', () => {
    // Arrange
    const input: IncidentInput = {
      ...baseContext,
      error: new Error(
        'token=abc.123 Authorization: Bearer secret Cookie: sid=cookie-secret password=database-secret 29801011234567'
      ),
      breadcrumbs: [
        { action: 'login?token=breadcrumb-secret', timestamp: 1 },
      ],
    };

    // Act
    const incident = normalizeIncident(input);
    const serialized = JSON.stringify(incident);

    // Assert
    expect(serialized).not.toContain('abc.123');
    expect(serialized).not.toContain('Bearer secret');
    expect(serialized).not.toContain('cookie-secret');
    expect(serialized).not.toContain('database-secret');
    expect(serialized).not.toContain('29801011234567');
    expect(incident.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(incident.message.length).toBeLessThanOrEqual(1000);
    expect(incident.stack?.length ?? 0).toBeLessThanOrEqual(4000);
  });

  it('does not use raw secret text when deriving a fingerprint', () => {
    // Arrange
    const firstInput: IncidentInput = {
      ...baseContext,
      error: new Error('same failure token=first'),
    };
    const secondInput: IncidentInput = {
      ...baseContext,
      error: new Error('same failure token=second'),
    };

    // Act
    const first = normalizeIncident(firstInput);
    const second = normalizeIncident(secondInput);

    // Assert
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps only the latest ten redacted breadcrumbs', () => {
    // Arrange
    const input: IncidentInput = {
      ...baseContext,
      error: new Error('failure'),
      breadcrumbs: Array.from({ length: 12 }, (_, index) => ({
        action: `step-${index}?token=secret-${index}`,
        timestamp: index,
      })),
    };

    // Act
    const incident = normalizeIncident(input);
    const serializedBreadcrumbs = JSON.stringify(incident.breadcrumbs);

    // Assert
    expect(incident.breadcrumbs).toHaveLength(10);
    expect(incident.breadcrumbs[0]?.timestamp).toBe(2);
    expect(serializedBreadcrumbs).not.toContain('secret-');
  });

  it('writes a bounded emergency record containing traceId but never the original error', () => {
    // Arrange
    const traceId = baseContext.traceId;
    const sensitivePayload = 'password=do-not-print';

    // Act
    writeEmergencyIncident(traceId, sensitivePayload);

    // Assert
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const output = String(stderrSpy.mock.calls[0]?.[0]);
    expect(output).toContain(traceId);
    expect(output).not.toContain('do-not-print');
    expect(output.length).toBeLessThan(512);
  });
});
