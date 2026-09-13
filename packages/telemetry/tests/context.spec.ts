import { describe, expect, it } from 'vitest';
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
  it('returns undefined when no context is active', () => {
    expect(getTelemetryContext()).toBeUndefined();
    expect(getTraceId()).toBeUndefined();
  });

  it('provides context within runWithTelemetryContext scope synchronously', () => {
    const ctx: TelemetryContext = {
      traceId: 'test-trace-123',
      service: 'bot-server',
      component: 'test-comp',
    };

    const result = runWithTelemetryContext(ctx, () => {
      expect(getTelemetryContext()).toEqual(ctx);
      expect(getTraceId()).toBe('test-trace-123');
      return 42;
    });

    expect(result).toBe(42);
    expect(getTelemetryContext()).toBeUndefined();
  });

  it('preserves context across asynchronous promise chains', async () => {
    const ctx: TelemetryContext = {
      traceId: 'async-trace-456',
      service: 'admin-dashboard',
      action: 'LOGIN',
      startTime: Date.now(),
    };

    await runWithTelemetryContext(ctx, async () => {
      expect(getTraceId()).toBe('async-trace-456');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(getTraceId()).toBe('async-trace-456');
      expect(getTelemetryContext()?.action).toBe('LOGIN');
    });

    expect(getTelemetryContext()).toBeUndefined();
  });

  it('isolates concurrent async executions without context leakage', async () => {
    const task1 = async () => {
      const ctx1: TelemetryContext = { traceId: 'trace-concurrent-1', service: 'service-1' };
      return runWithTelemetryContext(ctx1, async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return getTraceId();
      });
    };

    const task2 = async () => {
      const ctx2: TelemetryContext = { traceId: 'trace-concurrent-2', service: 'service-2' };
      return runWithTelemetryContext(ctx2, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return getTraceId();
      });
    };

    const [res1, res2] = await Promise.all([task1(), task2()]);
    expect(res1).toBe('trace-concurrent-1');
    expect(res2).toBe('trace-concurrent-2');
  });

  describe('ID generation & W3C traceparent formatting', () => {
    it('generates valid UUIDv4 trace IDs', () => {
      const traceId = generateTraceId();
      expect(traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('generates valid 16-hex character span IDs', () => {
      const spanId = generateSpanId();
      expect(spanId).toMatch(/^[0-9a-f]{16}$/);
    });

    it('formats W3C traceparent properly with custom span and sampled flags', () => {
      const traceId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
      const spanId = '1234567890abcdef';

      const traceparent = formatTraceparent(traceId, spanId, true);
      expect(traceparent).toBe('00-a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4-1234567890abcdef-01');

      const unsampled = formatTraceparent(traceId, spanId, false);
      expect(unsampled).toBe('00-a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4-1234567890abcdef-00');
    });

    it('cleanses UUID trace ID with dashes into 32-hex characters in traceparent', () => {
      const uuid = '12345678-1234-1234-1234-1234567890ab';
      const tp = formatTraceparent(uuid);
      expect(tp).toMatch(/^00-123456781234123412341234567890ab-[0-9a-f]{16}-01$/);
    });
  });
});
