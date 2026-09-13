import { describe, expect, it, vi } from 'vitest';
import {
  normalizeIncident,
  writeEmergencyIncident,
  type IncidentInput,
} from '../src/index.js';

const baseContext: Omit<IncidentInput, 'error'> = {
  traceId: 'a1b2c3d4-e5f6-4789-abcd-ef0123456789',
  source: 'dashboard-server',
  service: 'admin-dashboard',
  severity: 'ERROR',
  action: 'health.readiness',
  sourceLocation: 'api/health:GET',
  environment: 'test',
};

describe('normalized incident contract', () => {
  it('redacts token, cookie, national ID, authorization, and password before returning data', () => {
    const incident = normalizeIncident({
      ...baseContext,
      error: new Error(
        'token=abc.123 Authorization: Bearer secret Cookie: sid=cookie-secret password=database-secret 29801011234567',
      ),
      breadcrumbs: [
        { action: 'login?token=breadcrumb-secret', timestamp: 1 },
      ],
    });
    const serialized = JSON.stringify(incident);

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
    const first = normalizeIncident({
      ...baseContext,
      error: new Error('same failure token=first'),
    });
    const second = normalizeIncident({
      ...baseContext,
      error: new Error('same failure token=second'),
    });

    expect(first.fingerprint).toBe(second.fingerprint);
  });

  it('keeps only the latest ten redacted breadcrumbs', () => {
    const incident = normalizeIncident({
      ...baseContext,
      error: new Error('failure'),
      breadcrumbs: Array.from({ length: 12 }, (_, index) => ({
        action: `step-${index}?token=secret-${index}`,
        timestamp: index,
      })),
    });

    expect(incident.breadcrumbs).toHaveLength(10);
    expect(incident.breadcrumbs[0]).toMatchObject({ timestamp: 2 });
    expect(JSON.stringify(incident.breadcrumbs)).not.toContain('secret-');
  });

  it('writes a bounded emergency record containing traceId but never the original error', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    writeEmergencyIncident(baseContext.traceId, 'password=do-not-print');

    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const output = String(stderrSpy.mock.calls[0]?.[0]);
    expect(output).toContain(baseContext.traceId);
    expect(output).not.toContain('do-not-print');
    expect(output.length).toBeLessThan(512);
    stderrSpy.mockRestore();
  });
});
