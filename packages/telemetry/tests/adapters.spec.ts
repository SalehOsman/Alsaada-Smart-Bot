import { describe, expect, it, vi } from 'vitest';
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
  describe('grammY Adapter', () => {
    it('resolves action triggers accurately from different update types', () => {
      expect(
        resolveTelegramActionTrigger({
          callbackQuery: { data: 'advance:approve:123' },
        })
      ).toBe('cb:advance:approve:123');

      expect(
        resolveTelegramActionTrigger({
          message: { text: '/dashboard param' },
        })
      ).toBe('cmd:/dashboard');

      expect(
        resolveTelegramActionTrigger({
          message: { text: 'Hello, I want to register an advance' },
        })
      ).toBe('msg:Hello, I want to register an advanc');

      expect(
        resolveTelegramActionTrigger({
          message: { document: {} },
        })
      ).toBe('doc:upload');

      expect(
        resolveTelegramActionTrigger({
          message: { photo: [{}] },
        })
      ).toBe('photo:upload');

      expect(
        resolveTelegramActionTrigger({
          message: { location: {} },
        })
      ).toBe('loc:share');

      expect(resolveTelegramActionTrigger({})).toBe('unknown_update');
    });

    it('extracts actor information from structural Telegram context', () => {
      const ctx: TelegramStructuralContext = {
        from: { id: 7594239391, first_name: 'Saleh' },
        effectiveRole: 'SUPER_ADMIN',
        dbUser: {
          id: 'user-uuid-1',
          role: 'SUPER_ADMIN',
          assignedSiteId: 'site-alpha',
        },
      };

      const actor = extractTelegramActor(ctx);
      expect(actor.telegramId).toBe('7594239391');
      expect(actor.role).toBe('SUPER_ADMIN');
      expect(actor.userId).toBe('user-uuid-1');
      expect(actor.siteId).toBe('site-alpha');

      // Fallback for minimal context
      const minimalActor = extractTelegramActor({});
      expect(minimalActor.role).toBe('GUEST');
      expect(minimalActor.telegramId).toBeUndefined();
    });

    it('telemetryMiddleware establishes trace ID and AsyncLocalStorage context', async () => {
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

      await middleware(fakeCtx as any, next);

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

    it('telemetryMiddleware preserves existing ctx.traceId', async () => {
      const middleware = telemetryMiddleware();
      const fakeCtx: TelegramStructuralContext = {
        traceId: 'pre-existing-trace-id',
        message: { text: 'test' },
      };

      let capturedTraceId: string | undefined = undefined;
      const next = async () => {
        capturedTraceId = getTraceId();
      };

      await middleware(fakeCtx as any, next);
      expect(fakeCtx.traceId).toBe('pre-existing-trace-id');
      expect(capturedTraceId).toBe('pre-existing-trace-id');
    });

    it('telemetryMiddleware handles errors in next() and records performance with error', async () => {
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

      await expect(middleware(fakeCtx as any, failingNext)).rejects.toThrow('Telegram call failed');

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
      expect(isValidTraceId('valid-trace-id-123')).toBe(true);
      expect(isValidTraceId('01234567-89ab-cdef-0123-456789abcdef')).toBe(true);
      expect(isValidTraceId('TRC_ABC123')).toBe(true);

      expect(isValidTraceId('')).toBe(false);
      expect(isValidTraceId('short')).toBe(false); // < 8 chars
      expect(isValidTraceId('has spaces in between')).toBe(false);
      expect(isValidTraceId('<script>alert(1)</script>')).toBe(false);
      expect(isValidTraceId(null)).toBe(false);
      expect(isValidTraceId(12345678)).toBe(false);
    });

    it('converts 32-hex character string to UUID format', () => {
      const hex32 = '4a7c8b21d3e5f7a90b1c2d3e4f5a6b7c';
      const uuid = formatHexToUuid(hex32);
      expect(uuid).toBe('4a7c8b21-d3e5-f7a9-0b1c-2d3e4f5a6b7c');

      // Non-32 returns as-is
      expect(formatHexToUuid('short')).toBe('short');
    });

    describe('extractTraceId', () => {
      it('extracts traceId from URL query param ?traceId=...', () => {
        const req = {
          url: 'https://dashboard.alsaada.com/admin/workforce?traceId=custom-query-trace-123',
        };
        expect(extractTraceId(req)).toBe('custom-query-trace-123');
      });

      it('extracts trace_id from URL query param ?trace_id=...', () => {
        const req = {
          url: 'http://localhost:3002/login?token=xyz&trace_id=snake-query-trace-456',
        };
        expect(extractTraceId(req)).toBe('snake-query-trace-456');
      });

      it('extracts x-trace-id from Headers object', () => {
        const headers = new Headers();
        headers.set('x-trace-id', 'header-trace-789');

        const req = { headers };
        expect(extractTraceId(req)).toBe('header-trace-789');
      });

      it('extracts x-trace-id from plain Record object', () => {
        const req = {
          headers: {
            'X-Trace-Id': 'record-header-trace-abc',
          },
        };
        expect(extractTraceId(req)).toBe('record-header-trace-abc');
      });

      it('extracts traceparent W3C header and formats 32-hex into UUID', () => {
        const req = {
          headers: {
            traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
          },
        };

        const traceId = extractTraceId(req);
        expect(traceId).toBe('4bf92f35-77b3-4da6-a3ce-929d0e0e4736');
      });

      it('falls back to generating a new valid UUIDv4 when no valid trace ID exists', () => {
        const req = {
          url: 'http://localhost:3002/admin',
          headers: {},
        };

        const traceId = extractTraceId(req);
        expect(traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      });
    });

    describe('createTraceHeaders', () => {
      it('creates x-trace-id and W3C traceparent headers', () => {
        const traceId = '4a7c8b21-d3e5-f7a9-0b1c-2d3e4f5a6b7c';
        const headers = createTraceHeaders(traceId, '0000000000000002');

        expect(headers['x-trace-id']).toBe(traceId);
        expect(headers['traceparent']).toBe('00-4a7c8b21d3e5f7a90b1c2d3e4f5a6b7c-0000000000000002-01');
      });
    });

    describe('deriveIncidentCode', () => {
      it('deterministically creates short incident code from trace ID', () => {
        expect(deriveIncidentCode('4a7c8b21-d3e5-f7a9-0b1c-2d3e4f5a6b7c')).toBe('TRC-4A7C8B21');
        expect(deriveIncidentCode('9b1deb4d-1111-2222-3333-444455556666')).toBe('TRC-9B1DEB4D');
        expect(deriveIncidentCode('abc-def', 'ERR')).toBe('ERR-ABCDEF');
      });
    });
  });
});
