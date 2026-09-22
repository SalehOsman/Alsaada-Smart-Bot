import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  extractTelegramActor,
  resolveTelegramActionTrigger,
  telemetryMiddleware,
} from '../src/adapters/grammy.js';
import {
  createTraceHeaders,
  deriveIncidentCode,
  extractTraceId,
  formatHexToUuid,
  isValidTraceId,
} from '../src/adapters/next.js';
import { getTraceId } from '../src/context.js';
import type { TelegramStructuralContext } from '../src/types.js';

describe('Adapters', () => {
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

  describe('grammY Adapter', () => {
    it('resolves action triggers accurately from different update types', () => {
      // Arrange
      const cbUpdate = { callbackQuery: { data: 'advance:approve:123' } };
      const cmdUpdate = { message: { text: '/dashboard param' } };
      const msgUpdate = { message: { text: 'Hello, I want to register an advance' } };
      const docUpdate = { message: { document: {} } };
      const photoUpdate = { message: { photo: [{}] } };
      const locUpdate = { message: { location: {} } };
      const emptyUpdate = {};

      // Act
      const cbRes = resolveTelegramActionTrigger(cbUpdate);
      const cmdRes = resolveTelegramActionTrigger(cmdUpdate);
      const msgRes = resolveTelegramActionTrigger(msgUpdate);
      const docRes = resolveTelegramActionTrigger(docUpdate);
      const photoRes = resolveTelegramActionTrigger(photoUpdate);
      const locRes = resolveTelegramActionTrigger(locUpdate);
      const emptyRes = resolveTelegramActionTrigger(emptyUpdate);

      // Assert
      expect(cbRes).toBe('cb:advance:approve:123');
      expect(cmdRes).toBe('cmd:/dashboard');
      expect(msgRes).toBe('msg:Hello, I want to register an advanc');
      expect(docRes).toBe('doc:upload');
      expect(photoRes).toBe('photo:upload');
      expect(locRes).toBe('loc:share');
      expect(emptyRes).toBe('unknown_update');
    });

    it('extracts actor information from structural Telegram context', () => {
      // Arrange
      const ctx: TelegramStructuralContext = {
        from: { id: 7594239391, first_name: 'Saleh' },
        effectiveRole: 'SUPER_ADMIN',
        dbUser: {
          id: 'user-uuid-1',
          role: 'SUPER_ADMIN',
          assignedSiteId: 'site-alpha',
        },
      };
      const minimalCtx: TelegramStructuralContext = {};

      // Act
      const actor = extractTelegramActor(ctx);
      const minimalActor = extractTelegramActor(minimalCtx);

      // Assert
      expect(actor.telegramId).toBe('7594239391');
      expect(actor.role).toBe('SUPER_ADMIN');
      expect(actor.userId).toBe('user-uuid-1');
      expect(actor.siteId).toBe('site-alpha');
      expect(minimalActor.role).toBe('GUEST');
      expect(minimalActor.telegramId).toBeUndefined();
    });

    it('establishes trace ID and AsyncLocalStorage context via telemetryMiddleware', async () => {
      // Arrange
      const onBreadcrumb = vi.fn();
      const onPerformance = vi.fn();

      const middleware = telemetryMiddleware({
        service: 'bot-server-test',
        onBreadcrumb,
        onPerformance,
      });

      const fakeCtx: TelegramStructuralContext = {
        from: { id: 7594239391 },
        message: { text: '/dashboard' },
      };

      let capturedTraceIdInsideNext: string | undefined = undefined;
      const next = vi.fn(async () => {
        capturedTraceIdInsideNext = getTraceId();
      });

      // Act
      await middleware(fakeCtx as any, next);

      // Assert
      expect(next).toHaveBeenCalledTimes(1);
      expect(fakeCtx.traceId).toBeDefined();
      expect(capturedTraceIdInsideNext).toBe(fakeCtx.traceId);
      expect(onBreadcrumb).toHaveBeenCalledWith(7594239391n, 'cmd:/dashboard');
      expect(onPerformance).toHaveBeenCalledWith(
        expect.objectContaining({
          actorTelegramId: 7594239391n,
          action: 'cmd:/dashboard',
          error: undefined,
        })
      );
    });

    it('preserves existing ctx.traceId in telemetryMiddleware', async () => {
      // Arrange
      const middleware = telemetryMiddleware();
      const fakeCtx: TelegramStructuralContext = {
        traceId: 'pre-existing-trace-id',
        message: { text: 'test' },
      };

      let capturedTraceId: string | undefined = undefined;
      const next = async () => {
        capturedTraceId = getTraceId();
      };

      // Act
      await middleware(fakeCtx as any, next);

      // Assert
      expect(fakeCtx.traceId).toBe('pre-existing-trace-id');
      expect(capturedTraceId).toBe('pre-existing-trace-id');
    });

    it('handles errors in next() and records performance with error in telemetryMiddleware', async () => {
      // Arrange
      const onPerformance = vi.fn();
      const middleware = telemetryMiddleware({
        onPerformance,
      });

      const fakeCtx: TelegramStructuralContext = {
        from: { id: 12345678n },
        message: { text: 'error-trigger' },
      };

      const failingNext = async () => {
        throw new Error('Telegram call failed');
      };

      // Act
      const executeCall = () => middleware(fakeCtx as any, failingNext);

      // Assert
      await expect(executeCall()).rejects.toThrow('Telegram call failed');

      expect(onPerformance).toHaveBeenCalledWith(
        expect.objectContaining({
          actorTelegramId: 12345678n,
          action: 'msg:error-trigger',
          error: expect.any(Error),
        })
      );
    });
  });

  describe('Next.js Adapter', () => {
    it('validates trace ID strings with isValidTraceId', () => {
      // Arrange
      const valid1 = 'valid-trace-id-123';
      const valid2 = '01234567-89ab-cdef-0123-456789abcdef';
      const valid3 = 'TRC_ABC123';
      const empty = '';
      const tooShort = 'short';
      const withSpaces = 'has spaces in between';
      const xss = '<script>alert(1)</script>';
      const nullInput = null;
      const numInput = 12345678;

      // Act
      const res1 = isValidTraceId(valid1);
      const res2 = isValidTraceId(valid2);
      const res3 = isValidTraceId(valid3);
      const resEmpty = isValidTraceId(empty);
      const resShort = isValidTraceId(tooShort);
      const resSpaces = isValidTraceId(withSpaces);
      const resXss = isValidTraceId(xss);
      const resNull = isValidTraceId(nullInput);
      const resNum = isValidTraceId(numInput);

      // Assert
      expect(res1).toBe(true);
      expect(res2).toBe(true);
      expect(res3).toBe(true);
      expect(resEmpty).toBe(false);
      expect(resShort).toBe(false);
      expect(resSpaces).toBe(false);
      expect(resXss).toBe(false);
      expect(resNull).toBe(false);
      expect(resNum).toBe(false);
    });

    it('converts 32-hex character string to UUID format', () => {
      // Arrange
      const hex32 = '4a7c8b21d3e5f7a90b1c2d3e4f5a6b7c';
      const shortStr = 'short';

      // Act
      const uuid = formatHexToUuid(hex32);
      const nonHexResult = formatHexToUuid(shortStr);

      // Assert
      expect(uuid).toBe('4a7c8b21-d3e5-f7a9-0b1c-2d3e4f5a6b7c');
      expect(nonHexResult).toBe(shortStr);
    });

    describe('extractTraceId', () => {
      it('extracts traceId from URL query param ?traceId=...', () => {
        // Arrange
        const req = {
          url: 'https://dashboard.alsaada.com/admin/workforce?traceId=custom-query-trace-123',
        };

        // Act
        const traceId = extractTraceId(req);

        // Assert
        expect(traceId).toBe('custom-query-trace-123');
      });

      it('extracts trace_id from URL query param ?trace_id=...', () => {
        // Arrange
        const req = {
          url: 'http://localhost:3002/login?token=xyz&trace_id=snake-query-trace-456',
        };

        // Act
        const traceId = extractTraceId(req);

        // Assert
        expect(traceId).toBe('snake-query-trace-456');
      });

      it('extracts x-trace-id from Headers object', () => {
        // Arrange
        const headers = new Headers();
        headers.set('x-trace-id', 'header-trace-789');
        const req = { headers };

        // Act
        const traceId = extractTraceId(req);

        // Assert
        expect(traceId).toBe('header-trace-789');
      });

      it('extracts x-trace-id from plain Record object', () => {
        // Arrange
        const req = {
          headers: {
            'X-Trace-Id': 'record-header-trace-abc',
          },
        };

        // Act
        const traceId = extractTraceId(req);

        // Assert
        expect(traceId).toBe('record-header-trace-abc');
      });

      it('extracts traceparent W3C header and formats 32-hex into UUID', () => {
        // Arrange
        const req = {
          headers: {
            traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
          },
        };

        // Act
        const traceId = extractTraceId(req);

        // Assert
        expect(traceId).toBe('4bf92f35-77b3-4da6-a3ce-929d0e0e4736');
      });

      it('falls back to generating a new valid UUIDv4 when no valid trace ID exists', () => {
        // Arrange
        const req = {
          url: 'http://localhost:3002/admin',
          headers: {},
        };

        // Act
        const traceId = extractTraceId(req);

        // Assert
        expect(traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      });
    });

    describe('createTraceHeaders', () => {
      it('creates x-trace-id and W3C traceparent headers', () => {
        // Arrange
        const traceId = '4a7c8b21-d3e5-f7a9-0b1c-2d3e4f5a6b7c';
        const spanId = '0000000000000002';

        // Act
        const headers = createTraceHeaders(traceId, spanId);

        // Assert
        expect(headers['x-trace-id']).toBe(traceId);
        expect(headers['traceparent']).toBe('00-4a7c8b21d3e5f7a90b1c2d3e4f5a6b7c-0000000000000002-01');
      });
    });

    describe('deriveIncidentCode', () => {
      it('deterministically creates short incident code from trace ID', () => {
        // Arrange
        const trace1 = '4a7c8b21-d3e5-f7a9-0b1c-2d3e4f5a6b7c';
        const trace2 = '9b1deb4d-1111-2222-3333-444455556666';
        const shortTrace = 'abc-def';

        // Act
        const code1 = deriveIncidentCode(trace1);
        const code2 = deriveIncidentCode(trace2);
        const codeCustom = deriveIncidentCode(shortTrace, 'ERR');

        // Assert
        expect(code1).toBe('TRC-4A7C8B21');
        expect(code2).toBe('TRC-9B1DEB4D');
        expect(codeCustom).toBe('ERR-ABCDEF');
      });
    });
  });
});
