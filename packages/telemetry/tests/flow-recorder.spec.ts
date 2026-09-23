import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AlsaadaBaseError,
  FinancialInvariantError,
  FLOW_TELEMETRY_SINK_TIMEOUT_MS,
  OperationalError,
  UnexpectedSystemError,
  captureFlowError,
  clearIncidentSink,
  getCapturedFlowErrorResult,
  getIncidentSink,
  isFlowErrorCaptured,
  isOperationalError,
  setIncidentSink,
  type BoundedFlowContext,
  type IncidentSink,
  type NormalizedIncident,
} from '../src/index.js';

describe('Work Plan 94 (NEW-91) — Flow Error Recorder, Sink Injection & Non-Blocking Guarantees', () => {
  const PINNED_BASE_TIME = new Date('2026-04-19T10:00:00.000Z');
  let stderrSpy: {
    mockRestore: () => void;
    mockImplementation: (fn: () => boolean) => unknown;
    mock: { calls: unknown[][] };
  };

  const baseFlowContext: BoundedFlowContext = {
    flowId: '01.1',
    moduleId: 'workforce',
    action: 'action:workforce:onboarding:submit',
    traceId: 'a1b2c3d4-e5f6-4789-abcd-ef0123456789',
    actorTelegramId: 100200300n,
    actorRole: 'FIELD_ADMIN',
    environment: 'test',
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(PINNED_BASE_TIME);
    clearIncidentSink();
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true) as unknown as typeof stderrSpy;
  });

  afterEach(() => {
    clearIncidentSink();
    stderrSpy.mockRestore();
    vi.useRealTimers();
  });

  it('persists normalized incidents via registered IncidentSink and triggers fire-and-forget admin notifications', async () => {
    const persistedIncidents: NormalizedIncident[] = [];
    const notifiedReferences: string[] = [];

    const sink: IncidentSink = {
      persist: async (incident) => {
        persistedIncidents.push(incident);
        return { persisted: true, errorReference: '#ERR-CAFE1234' };
      },
      notifyAdmins: async (_incident, ref) => {
        notifiedReferences.push(ref);
      },
    };

    setIncidentSink(sink);
    expect(getIncidentSink()).toBe(sink);

    const err = new UnexpectedSystemError('Database connection pool exhausted', {
      code: 'DB_POOL_EXHAUSTED',
      metadata: { poolSize: 10, retryAttempt: 3 },
    });

    const res = await captureFlowError(err, baseFlowContext);

    expect(res.handled).toBe(true);
    expect(res.status).toBe('persisted');
    expect(res.errorReference).toBe('#ERR-CAFE1234');
    expect(res.severity).toBe('ERROR');
    expect(res.isOperational).toBe(false);
    expect(res.traceId).toBe(baseFlowContext.traceId);
    expect(persistedIncidents).toHaveLength(1);
    expect(persistedIncidents[0]?.service).toBe('flow:workforce:01.1');
    expect(persistedIncidents[0]?.actorTelegramId).toBe(100200300n);
    expect(stderrSpy).not.toHaveBeenCalled();

    // Allow microtask queue to flush fire-and-forget notifyAdmins
    await Promise.resolve();
    expect(notifiedReferences).toEqual(['#ERR-CAFE1234']);
  });

  it('enforces the 1500ms non-blocking timeout and falls back to writeEmergencyIncident on slow sinks', async () => {
    expect(FLOW_TELEMETRY_SINK_TIMEOUT_MS).toBe(1500);

    const slowSink: IncidentSink = {
      persist: () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ persisted: true }), 5000);
        }),
    };
    setIncidentSink(slowSink);

    const err = new Error('Downstream RPC hung indefinitely');
    const res = await captureFlowError(err, {
      ...baseFlowContext,
      timeoutMs: 35,
    });

    expect(res.handled).toBe(true);
    expect(res.status).toBe('emergency');
    expect(res.errorReference).toMatch(/^#ERR-[0-9A-F]{8}$/);
    expect(stderrSpy).toHaveBeenCalledTimes(1);

    const emergencyPayload = String(stderrSpy.mock.calls[0]?.[0]);
    expect(emergencyPayload).toContain(baseFlowContext.traceId);
    expect(emergencyPayload).toContain('SINK_FALLBACK_SINK_TIMEOUT_35MS');
  });

  it('falls back to emergency sink when no sink is wired or when sink rejects, and returns failed only if stderr itself throws', async () => {
    // 1. No sink wired -> emergency stderr fallback
    const rawErr = new Error('Unhandled null pointer in calculation');
    const noSinkRes = await captureFlowError(rawErr, baseFlowContext);
    expect(noSinkRes.status).toBe('emergency');
    expect(stderrSpy).toHaveBeenCalledTimes(1);

    // 2. Sink throws error -> emergency stderr fallback
    setIncidentSink({
      persist: async () => {
        throw new Error('PRISMA_WRITE_CONFLICT');
      },
    });
    const sinkErr = new Error('Second distinct failure');
    const rejectedSinkRes = await captureFlowError(sinkErr, baseFlowContext);
    expect(rejectedSinkRes.status).toBe('emergency');
    expect(stderrSpy).toHaveBeenCalledTimes(2);

    // 3. Both sink and stderr throw -> never throws out of captureFlowError, returns status: 'failed'
    stderrSpy.mockImplementation(() => {
      throw new Error('EPIPE_STDERR_BROKEN');
    });
    const catastrophicErr = new Error('Third failure with broken stderr');
    const failedRes = await captureFlowError(catastrophicErr, baseFlowContext);
    expect(failedRes.handled).toBe(true);
    expect(failedRes.status).toBe('failed');
  });

  it('redacts Egyptian National IDs, tokens, and passwords from error message, stack, metadata breadcrumbs, and userMessageArabic', async () => {
    const persisted: NormalizedIncident[] = [];
    setIncidentSink({
      persist: async (incident) => {
        persisted.push(incident);
        return { persisted: true };
      },
    });

    const sensitiveError = new UnexpectedSystemError(
      'Failed for NID 29801011234567 with token=secret_jwt_123 and password=my_db_pass',
      {
        userMessageArabic: 'تعذر حفظ رقم الهوية 29801011234567 أو كلمة المرور password=my_db_pass',
      },
    );

    const res = await captureFlowError(sensitiveError, {
      ...baseFlowContext,
      metadata: {
        authHeader: 'Bearer secret-bearer-xyz',
        nationalId: '29801011234567',
      },
    });

    const serializedIncident = JSON.stringify(res.incident, (_k, v) =>
      typeof v === 'bigint' ? v.toString() : v,
    );
    expect(serializedIncident).not.toContain('29801011234567');
    expect(serializedIncident).not.toContain('secret_jwt_123');
    expect(serializedIncident).not.toContain('my_db_pass');
    expect(serializedIncident).not.toContain('secret-bearer-xyz');
    expect(res.userMessageArabic).not.toContain('29801011234567');
    expect(res.userMessageArabic).not.toContain('my_db_pass');
  });

  it('prevents double-recording under concurrent and sequential invocations with the same Error instance', async () => {
    let persistCallCount = 0;
    setIncidentSink({
      persist: async () => {
        persistCallCount++;
        await new Promise((r) => setTimeout(r, 15));
        return { persisted: true, errorReference: '#ERR-ONCE0001' };
      },
    });

    const sharedError = new UnexpectedSystemError('Single database deadlock event');
    expect(isFlowErrorCaptured(sharedError)).toBe(false);

    // Fire 5 concurrent captureFlowError calls for the exact same error object
    const concurrentResults = await Promise.all([
      captureFlowError(sharedError, baseFlowContext),
      captureFlowError(sharedError, baseFlowContext),
      captureFlowError(sharedError, baseFlowContext),
      captureFlowError(sharedError, baseFlowContext),
      captureFlowError(sharedError, baseFlowContext),
    ]);

    expect(persistCallCount).toBe(1);
    expect(isFlowErrorCaptured(sharedError)).toBe(true);
    expect(getCapturedFlowErrorResult(sharedError)?.errorReference).toBe('#ERR-ONCE0001');

    for (const item of concurrentResults) {
      expect(item.errorReference).toBe('#ERR-ONCE0001');
      expect(item.status).toBe('persisted');
    }

    // Subsequent sequential call (e.g. outer bot.catch) also reuses the captured result
    const outerResult = await captureFlowError(sharedError, {
      ...baseFlowContext,
      action: 'bot.catch:fallback',
    });
    expect(persistCallCount).toBe(1);
    expect(outerResult.errorReference).toBe('#ERR-ONCE0001');
  });

  it('distinguishes OperationalError, UnexpectedSystemError, and FinancialInvariantError accurately', async () => {
    let adminNotifications = 0;
    const recordedSeverities: string[] = [];

    setIncidentSink({
      persist: async (incident) => {
        recordedSeverities.push(incident.severity);
        return { persisted: true };
      },
      notifyAdmins: () => {
        adminNotifications++;
      },
    });

    // 1. OperationalError: WARNING severity, isOperational=true, does NOT page admins
    const opError = new OperationalError('Invalid quantity entered by user', {
      userMessageArabic: 'الكمية المدخلة غير صالحة، يرجى إدخال رقم موجب.',
    });
    expect(opError instanceof AlsaadaBaseError).toBe(true);
    expect(isOperationalError(opError)).toBe(true);

    const opRes = await captureFlowError(opError, baseFlowContext);
    await Promise.resolve();
    expect(opRes.isOperational).toBe(true);
    expect(opRes.severity).toBe('WARNING');
    expect(opRes.userMessageArabic).toBe('الكمية المدخلة غير صالحة، يرجى إدخال رقم موجب.');
    expect(adminNotifications).toBe(0);

    // 2. FinancialInvariantError: FATAL severity, isOperational=false, pages admins
    const finError = new FinancialInvariantError('Debit/credit mismatch of 450 EGP in ledger');
    expect(isOperationalError(finError)).toBe(false);

    const finRes = await captureFlowError(finError, baseFlowContext);
    await Promise.resolve();
    expect(finRes.isOperational).toBe(false);
    expect(finRes.severity).toBe('FATAL');
    expect(adminNotifications).toBe(1);
    expect(recordedSeverities).toEqual(['WARNING', 'FATAL']);
  });
});
