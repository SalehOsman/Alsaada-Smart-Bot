import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  formatTraceparent,
  generateSpanId,
  generateTraceId,
  getTelemetryContext,
  getTraceId,
  runWithTelemetryContext,
} from '../src/context.js';
import type { TelemetryContext } from '../src/types.js';

describe('Context & AsyncLocalStorage', () => {
  const PINNED_BASE_TIME = new Date('2026-03-03T12:00:00.000Z');
  let stdoutSpy: any;
  let stderrSpy: any;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

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

  it('returns undefined when no context is active', () => {
    // Arrange
    const activeCtxBeforeRun = getTelemetryContext();
    const activeTraceIdBeforeRun = getTraceId();

    // Act
    const activeCtx = activeCtxBeforeRun;
    const activeTraceId = activeTraceIdBeforeRun;

    // Assert
    expect(activeCtx).toBeUndefined();
    expect(activeTraceId).toBeUndefined();
  });

  it('provides context within runWithTelemetryContext scope synchronously', () => {
    // Arrange
    const ctx: TelemetryContext = {
      traceId: 'test-trace-123',
      service: 'bot-server',
      component: 'test-comp',
    };

    // Act
    let capturedContext: TelemetryContext | undefined;
    let capturedTraceId: string | undefined;
    const result = runWithTelemetryContext(ctx, () => {
      capturedContext = getTelemetryContext();
      capturedTraceId = getTraceId();
      return 42;
    });
    const afterCtx = getTelemetryContext();

    // Assert
    expect(result).toBe(42);
    expect(capturedContext).toEqual(ctx);
    expect(capturedTraceId).toBe('test-trace-123');
    expect(afterCtx).toBeUndefined();
  });

  it('preserves context across asynchronous promise chains', async () => {
    // Arrange
    const ctx: TelemetryContext = {
      traceId: 'async-trace-456',
      service: 'admin-dashboard',
      action: 'LOGIN',
      startTime: PINNED_BASE_TIME.getTime(),
    };

    // Act
    let traceBeforeTick: string | undefined;
    let traceAfterTick: string | undefined;
    let actionAfterTick: string | undefined;

    await runWithTelemetryContext(ctx, async () => {
      traceBeforeTick = getTraceId();
      await Promise.resolve();
      traceAfterTick = getTraceId();
      actionAfterTick = getTelemetryContext()?.action;
    });

    const contextAfterRun = getTelemetryContext();
    const traceAfterRun = getTraceId();

    // Assert
    expect(traceBeforeTick).toBe('async-trace-456');
    expect(traceAfterTick).toBe('async-trace-456');
    expect(actionAfterTick).toBe('LOGIN');
    expect(contextAfterRun).toBeUndefined();
    expect(traceAfterRun).toBeUndefined();
  });

  it('isolates concurrent async executions without context leakage', async () => {
    // Arrange
    const task1 = async () => {
      const ctx1: TelemetryContext = { traceId: 'trace-concurrent-1', service: 'service-1' };
      return runWithTelemetryContext(ctx1, async () => {
        await Promise.resolve();
        return getTraceId();
      });
    };

    const task2 = async () => {
      const ctx2: TelemetryContext = { traceId: 'trace-concurrent-2', service: 'service-2' };
      return runWithTelemetryContext(ctx2, async () => {
        await Promise.resolve();
        return getTraceId();
      });
    };

    // Act
    const [res1, res2] = await Promise.all([task1(), task2()]);

    // Assert
    expect(res1).toBe('trace-concurrent-1');
    expect(res2).toBe('trace-concurrent-2');
    expect(res1).not.toBe(res2);
  });

  describe('ID generation & W3C traceparent formatting', () => {
    it('generates valid UUIDv4 trace IDs', () => {
      // Arrange
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      // Act
      const traceId1 = generateTraceId();
      const traceId2 = generateTraceId();

      // Assert
      expect(traceId1).toMatch(uuidRegex);
      expect(traceId2).toMatch(uuidRegex);
      expect(traceId1).not.toBe(traceId2);
    });

    it('generates valid 16-hex character span IDs', () => {
      // Arrange
      const hex16Regex = /^[0-9a-f]{16}$/;

      // Act
      const spanId1 = generateSpanId();
      const spanId2 = generateSpanId();

      // Assert
      expect(spanId1).toMatch(hex16Regex);
      expect(spanId2).toMatch(hex16Regex);
      expect(spanId1).not.toBe(spanId2);
    });

    it('formats W3C traceparent properly with custom span and sampled flags', () => {
      // Arrange
      const traceId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
      const spanId = '1234567890abcdef';

      // Act
      const traceparent = formatTraceparent(traceId, spanId, true);
      const unsampled = formatTraceparent(traceId, spanId, false);

      // Assert
      expect(traceparent).toBe('00-a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4-1234567890abcdef-01');
      expect(unsampled).toBe('00-a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4-1234567890abcdef-00');
    });

    it('cleanses UUID trace ID with dashes into 32-hex characters in traceparent', () => {
      // Arrange
      const uuid = '12345678-1234-1234-1234-1234567890ab';

      // Act
      const tp = formatTraceparent(uuid);

      // Assert
      expect(tp).toMatch(/^00-123456781234123412341234567890ab-[0-9a-f]{16}-01$/);
    });
  });
});
