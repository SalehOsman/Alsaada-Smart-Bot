import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { W3C_TRACEPARENT_REGEX } from '../src/constants.js';
import { getTelemetryContext, getTraceId } from '../src/context.js';
import { TelemetryLogger } from '../src/logger.js';
import type { TelegramStructuralContext } from '../src/types.js';

describe('Challenger M1-2 Empirical Stress Harness', () => {
  // --------------------------------------------------------------------------
  // 1. Next.js Adapter Stress Tests
  // --------------------------------------------------------------------------
  describe('adapters/next.ts: extractTraceId stress testing', () => {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    describe('Query parameters', () => {
      it('extracts valid traceId from query param', () => {
        const req = { url: 'https://dashboard.alsaada.com/admin?traceId=valid-trace-123' };
        expect(extractTraceId(req)).toBe('valid-trace-123');
      });

      it('extracts valid snake_case trace_id from query param', () => {
        const req = { url: 'https://dashboard.alsaada.com/admin?trace_id=valid-trace-456' };
        expect(extractTraceId(req)).toBe('valid-trace-456');
      });

      it('prefers traceId over trace_id when both are present', () => {
        const req = {
          url: 'https://dashboard.alsaada.com/admin?traceId=preferred-trace-111&trace_id=secondary-trace-222',
        };
        expect(extractTraceId(req)).toBe('preferred-trace-111');
      });

      it('prefers query param over x-trace-id header when both are present', () => {
        const req = {
          url: 'https://dashboard.alsaada.com/admin?traceId=query-trace-999',
          headers: { 'x-trace-id': 'header-trace-888' },
        };
        expect(extractTraceId(req)).toBe('query-trace-999');
      });

      it('gracefully handles unparseable or relative URLs without throwing', () => {
        const req1 = { url: '/relative/path?traceId=rel-trace-123' };
        expect(extractTraceId(req1)).toBe('rel-trace-123');

        // Malformed URI characters
        const req2 = { url: 'http://localhost:3002/%E0%A4%A' };
        const traceId = extractTraceId(req2);
        expect(traceId).toMatch(UUID_REGEX);
      });
    });

    describe('HTTP Headers extraction', () => {
      it('extracts x-trace-id from Headers Web API instance', () => {
        const headers = new Headers();
        headers.set('x-trace-id', 'web-api-trace-id-123');
        expect(extractTraceId({ headers })).toBe('web-api-trace-id-123');
      });

      it('extracts from case variants in plain object: x-trace-id, X-Trace-Id, x_trace_id', () => {
        expect(extractTraceId({ headers: { 'x-trace-id': 'case-1-trace-id' } })).toBe('case-1-trace-id');
        expect(extractTraceId({ headers: { 'X-Trace-Id': 'case-2-trace-id' } })).toBe('case-2-trace-id');
        expect(extractTraceId({ headers: { 'x_trace_id': 'case-3-trace-id' } })).toBe('case-3-trace-id');
      });

      it('extracts first element when header is passed as array of strings', () => {
        const req = {
          headers: {
            'x-trace-id': ['array-trace-first', 'array-trace-second'],
          },
        };
        expect(extractTraceId(req)).toBe('array-trace-first');
      });
    });

    describe('Injection and malformed string rejection', () => {
      const INJECTION_ATTEMPTS = [
        'valid-id\r\nX-Injected-Header: evil', // CRLF injection
        'valid-id\nSet-Cookie: session=evil',  // LF injection
        "'; DROP TABLE users; --",             // SQL injection
        "' OR '1'='1",                         // SQL boolean injection
        '<script>alert("XSS")</script>',       // XSS script injection
        '${jndi:ldap://evil.com/a}',          // Log4j / template injection
        '../../../../etc/passwd',              // Path traversal
        '; cat /etc/passwd',                   // Command injection
        'null',                                // Too short (< 8 chars)
        'abc',                                 // Too short
        '1234567',                             // 7 chars (boundary < 8)
        'a'.repeat(65),                        // 65 chars (boundary > 64)
        'has space between',                   // Spaces not allowed
        'has\tTabInside',                      // Control characters
        'has\0NullByte',                       // Null byte
        'invalid@char!',                       // Symbols not in [a-zA-Z0-9_-]
      ];

      for (const injection of INJECTION_ATTEMPTS) {
        it(`rejects query param injection: ${JSON.stringify(injection)}`, () => {
          const req = {
            url: `https://dashboard.alsaada.com/admin?traceId=${encodeURIComponent(injection)}`,
          };
          const extracted = extractTraceId(req);
          // Must NOT return the injection string; must fall back to a valid UUID
          expect(extracted).not.toBe(injection);
          expect(extracted).toMatch(UUID_REGEX);
        });

        it(`rejects header injection: ${JSON.stringify(injection)}`, () => {
          const req = {
            headers: { 'x-trace-id': injection },
          };
          const extracted = extractTraceId(req);
          expect(extracted).not.toBe(injection);
          expect(extracted).toMatch(UUID_REGEX);
        });
      }
    });

    describe('W3C traceparent extraction', () => {
      it('correctly extracts and formats 32-hex traceId into UUID from standard W3C header', () => {
        const req = {
          headers: {
            traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
          },
        };
        expect(extractTraceId(req)).toBe('4bf92f35-77b3-4da6-a3ce-929d0e0e4736');
      });

      it('handles uppercase hex in W3C traceparent', () => {
        const req = {
          headers: {
            traceparent: '00-4BF92F3577B34DA6A3CE929D0E0E4736-00F067AA0BA902B7-01',
          },
        };
        expect(extractTraceId(req)).toBe('4BF92F35-77B3-4DA6-A3CE-929D0E0E4736');
      });

      it('trims leading/trailing whitespace around W3C traceparent', () => {
        const req = {
          headers: {
            traceparent: '  00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01  ',
          },
        };
        expect(extractTraceId(req)).toBe('4bf92f35-77b3-4da6-a3ce-929d0e0e4736');
      });

      it('falls back to UUID when W3C version is not 00', () => {
        const req = {
          headers: {
            traceparent: '01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
          },
        };
        expect(extractTraceId(req)).toMatch(UUID_REGEX);
      });

      it('falls back to UUID when trace ID in traceparent is not 32-hex chars', () => {
        // 31 chars
        const req1 = {
          headers: {
            traceparent: '00-4bf92f3577b34da6a3ce929d0e0e473-00f067aa0ba902b7-01',
          },
        };
        expect(extractTraceId(req1)).toMatch(UUID_REGEX);

        // 33 chars
        const req2 = {
          headers: {
            traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736a-00f067aa0ba902b7-01',
          },
        };
        expect(extractTraceId(req2)).toMatch(UUID_REGEX);
      });

      it('falls back to UUID when traceparent contains non-hex characters', () => {
        const req = {
          headers: {
            traceparent: '00-4bf92f3577b34da6a3ce929d0e0e473g-00f067aa0ba902b7-01',
          },
        };
        expect(extractTraceId(req)).toMatch(UUID_REGEX);
      });
    });

    describe('Fallback UUID generation', () => {
      it('generates distinct, valid RFC 4122 UUIDv4 on consecutive fallbacks', () => {
        const id1 = extractTraceId({});
        const id2 = extractTraceId({});
        const id3 = extractTraceId({ headers: {} });

        expect(id1).toMatch(UUID_REGEX);
        expect(id2).toMatch(UUID_REGEX);
        expect(id3).toMatch(UUID_REGEX);
        expect(id1).not.toBe(id2);
        expect(id2).not.toBe(id3);
      });
    });
  });

  describe('adapters/next.ts: createTraceHeaders format & W3C compliance', () => {
    it('creates headers with exact x-trace-id and W3C compliant traceparent', () => {
      const traceId = '4a7c8b21-d3e5-f7a9-0b1c-2d3e4f5a6b7c';
      const headers = createTraceHeaders(traceId);

      expect(headers['x-trace-id']).toBe(traceId);
      expect(headers['traceparent']).toBeDefined();
      expect(W3C_TRACEPARENT_REGEX.test(headers['traceparent']!)).toBe(true);
      expect(headers['traceparent']).toBe('00-4a7c8b21d3e5f7a90b1c2d3e4f5a6b7c-0000000000000001-01');
    });

    it('uses custom parentSpanId and sanitizes non-hex characters', () => {
      const traceId = '4a7c8b21-d3e5-f7a9-0b1c-2d3e4f5a6b7c';
      const headers = createTraceHeaders(traceId, 'xyz-fedcba9876543210');

      expect(headers['traceparent']).toBe('00-4a7c8b21d3e5f7a90b1c2d3e4f5a6b7c-fedcba9876543210-01');
      expect(W3C_TRACEPARENT_REGEX.test(headers['traceparent']!)).toBe(true);
    });

    it('pads short traceId and spanId with zeros to guarantee 32 and 16 hex length', () => {
      const headers = createTraceHeaders('abc', '123');
      expect(headers['traceparent']).toBe(
        '00-abc00000000000000000000000000000-1230000000000000-01'
      );
      expect(W3C_TRACEPARENT_REGEX.test(headers['traceparent']!)).toBe(true);
    });

    it('truncates traceId and spanId longer than 32/16 hex chars', () => {
      const longTrace = 'a'.repeat(40);
      const longSpan = 'b'.repeat(25);
      const headers = createTraceHeaders(longTrace, longSpan);

      expect(headers['traceparent']).toBe(
        `00-${'a'.repeat(32)}-${'b'.repeat(16)}-01`
      );
      expect(W3C_TRACEPARENT_REGEX.test(headers['traceparent']!)).toBe(true);
    });
  });

  describe('adapters/next.ts: deriveIncidentCode format', () => {
    it('derives TRC-{8_UPPERCASE_CHARS} by default', () => {
      expect(deriveIncidentCode('4a7c8b21-d3e5-f7a9-0b1c-2d3e4f5a6b7c')).toBe('TRC-4A7C8B21');
      expect(deriveIncidentCode('9b1deb4d-1111-2222-3333-444455556666')).toBe('TRC-9B1DEB4D');
    });

    it('supports custom prefix (e.g. ERR, ALERT)', () => {
      expect(deriveIncidentCode('4a7c8b21-d3e5-f7a9', 'ERR')).toBe('ERR-4A7C8B21');
      expect(deriveIncidentCode('4a7c8b21-d3e5-f7a9', 'CRIT')).toBe('CRIT-4A7C8B21');
    });

    it('strips non-alphanumeric characters from token calculation', () => {
      expect(deriveIncidentCode('---ab-cd-ef-12---')).toBe('TRC-ABCDEF12');
    });

    it('handles traceId with fewer than 8 alphanumeric characters gracefully', () => {
      expect(deriveIncidentCode('abc12')).toBe('TRC-ABC12');
    });

    it('falls back to UNKNOWN when traceId has no alphanumeric characters', () => {
      expect(deriveIncidentCode('')).toBe('TRC-UNKNOWN');
      expect(deriveIncidentCode('-----____')).toBe('TRC-UNKNOWN');
    });
  });

  // --------------------------------------------------------------------------
  // 2. grammY Adapter Stress Tests
  // --------------------------------------------------------------------------
  describe('adapters/grammy.ts: action trigger & actor resolution', () => {
    describe('resolveTelegramActionTrigger', () => {
      it('resolves commands correctly', () => {
        expect(resolveTelegramActionTrigger({ message: { text: '/start' } })).toBe('cmd:/start');
        expect(resolveTelegramActionTrigger({ message: { text: '/dashboard site_alpha' } })).toBe('cmd:/dashboard');
        expect(resolveTelegramActionTrigger({ message: { text: '  /settings  ' } })).toBe('cmd:/settings');
      });

      it('resolves and truncates plain text messages at 35 chars', () => {
        const longText = 'This is an extremely long message that should definitely be truncated by the telemetry engine';
        expect(resolveTelegramActionTrigger({ message: { text: longText } })).toBe(
          `msg:${longText.slice(0, 35)}`
        );
      });

      it('resolves media updates', () => {
        expect(resolveTelegramActionTrigger({ message: { document: { file_id: 'doc1' } } })).toBe('doc:upload');
        expect(resolveTelegramActionTrigger({ message: { photo: [{ file_id: 'photo1' }] } })).toBe('photo:upload');
        expect(resolveTelegramActionTrigger({ message: { location: { latitude: 30.0, longitude: 31.0 } } })).toBe('loc:share');
      });

      it('resolves callback queries with and without data', () => {
        expect(
          resolveTelegramActionTrigger({ callbackQuery: { data: 'advance:approve:42' } })
        ).toBe('cb:advance:approve:42');

        // callback query without data
        expect(resolveTelegramActionTrigger({ callbackQuery: {} })).toBe('unknown_update');
      });

      it('returns unknown_update for unhandled or empty update types', () => {
        expect(resolveTelegramActionTrigger({})).toBe('unknown_update');
        expect(resolveTelegramActionTrigger({ inlineQuery: { query: 'search' } } as any)).toBe('unknown_update');
      });
    });

    describe('extractTelegramActor', () => {
      it('extracts complete actor with role, id, and assignedSiteId', () => {
        const ctx: TelegramStructuralContext = {
          from: { id: 7594239391 },
          effectiveRole: 'ACCOUNTANT',
          dbUser: {
            id: 'db-user-uuid',
            role: 'AUDITOR',
            assignedSiteId: 'site-delta',
          },
        };

        const actor = extractTelegramActor(ctx);
        expect(actor.telegramId).toBe('7594239391');
        expect(actor.role).toBe('ACCOUNTANT'); // effectiveRole takes precedence over dbUser.role
        expect(actor.userId).toBe('db-user-uuid');
        expect(actor.siteId).toBe('site-delta');
      });

      it('handles BigInt from.id cleanly', () => {
        const ctx: TelegramStructuralContext = {
          from: { id: 999888777666555n as any },
        };
        const actor = extractTelegramActor(ctx);
        expect(actor.telegramId).toBe('999888777666555');
        expect(actor.role).toBe('GUEST');
      });
    });
  });

  describe('adapters/grammy.ts: telemetryMiddleware lifecycle and exceptions', () => {
    let stderrSpy: any;

    beforeEach(() => {
      stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      stderrSpy.mockRestore();
    });

    it('establishes traceId, executes inside AsyncLocalStorage, and propagates to next()', async () => {
      const onBreadcrumb = vi.fn();
      const onPerformance = vi.fn();

      const middleware = telemetryMiddleware({
        service: 'bot-stress-test',
        component: 'bot:stress',
        onBreadcrumb,
        onPerformance,
      });

      const fakeCtx: TelegramStructuralContext = {
        from: { id: 7594239391 },
        message: { text: '/workforce' },
      };

      let observedTraceId: string | undefined;
      let observedContext: unknown;

      await middleware(fakeCtx as any, async () => {
        observedTraceId = getTraceId();
        observedContext = getTelemetryContext();
      });

      expect(fakeCtx.traceId).toBeDefined();
      expect(observedTraceId).toBe(fakeCtx.traceId);
      expect(observedContext).toMatchObject({
        traceId: fakeCtx.traceId,
        service: 'bot-stress-test',
        component: 'bot:stress',
        action: 'cmd:/workforce',
        actor: {
          telegramId: '7594239391',
          role: 'GUEST',
        },
      });

      expect(onBreadcrumb).toHaveBeenCalledWith(7594239391n, 'cmd:/workforce');
      expect(onPerformance).toHaveBeenCalledWith(
        expect.objectContaining({
          actorTelegramId: 7594239391n,
          action: 'cmd:/workforce',
          executionTimeMs: expect.any(Number),
          error: undefined,
        })
      );
    });

    it('re-throws standard Error, logs structured error, and calls onPerformance with error', async () => {
      const onPerformance = vi.fn();
      const middleware = telemetryMiddleware({
        service: 'bot-error-test',
        onPerformance,
      });

      const fakeCtx: TelegramStructuralContext = {
        from: { id: 7594239391 },
        message: { text: 'cause-failure' },
      };

      const testError = new Error('Database connection timed out');

      await expect(
        middleware(fakeCtx as any, async () => {
          throw testError;
        })
      ).rejects.toThrow('Database connection timed out');

      // Structured error log written to stderr
      expect(stderrSpy).toHaveBeenCalled();
      const loggedLine = stderrSpy.mock.calls[0]?.[0] as string;
      expect(loggedLine).toBeDefined();

      const parsedLog = JSON.parse(loggedLine);
      expect(parsedLog.level).toBe('error');
      expect(parsedLog.message).toBe('Database connection timed out');
      expect(parsedLog.traceId).toBe(fakeCtx.traceId);
      expect(parsedLog.error.name).toBe('Error');
      expect(parsedLog.error.message).toBe('Database connection timed out');

      // onPerformance recorded the error
      expect(onPerformance).toHaveBeenCalledWith(
        expect.objectContaining({
          actorTelegramId: 7594239391n,
          action: 'msg:cause-failure',
          error: testError,
        })
      );
    });

    it('handles non-Error thrown values (strings, objects) without crashing', async () => {
      const onPerformance = vi.fn();
      const middleware = telemetryMiddleware({ onPerformance });

      const fakeCtx: TelegramStructuralContext = {
        from: { id: 11223344 },
        message: { text: 'string-error' },
      };

      await expect(
        middleware(fakeCtx as any, async () => {
          // eslint-disable-next-line @typescript-eslint/no-throw-literal
          throw 'Non-error string thrown';
        })
      ).rejects.toBe('Non-error string thrown');

      expect(stderrSpy).toHaveBeenCalled();
      const loggedLine = stderrSpy.mock.calls[0]?.[0] as string;
      const parsedLog = JSON.parse(loggedLine);
      expect(parsedLog.level).toBe('error');
      expect(parsedLog.message).toBe('Non-error string thrown');

      expect(onPerformance).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Non-error string thrown',
        })
      );
    });

    it('fault tolerance: swallowing errors from onBreadcrumb without interrupting next()', async () => {
      const throwingBreadcrumb = vi.fn(async () => {
        throw new Error('Breadcrumb store failed');
      });

      const middleware = telemetryMiddleware({
        onBreadcrumb: throwingBreadcrumb,
      });

      const fakeCtx: TelegramStructuralContext = {
        from: { id: 7594239391 },
        message: { text: '/ok' },
      };

      let nextCalled = false;
      await middleware(fakeCtx as any, async () => {
        nextCalled = true;
      });

      expect(throwingBreadcrumb).toHaveBeenCalled();
      expect(nextCalled).toBe(true);
    });

    it('fault tolerance: swallowing errors from onPerformance without masking primary error', async () => {
      const throwingPerformance = vi.fn(async () => {
        throw new Error('APM recording failed');
      });

      const middleware = telemetryMiddleware({
        onPerformance: throwingPerformance,
      });

      const fakeCtx: TelegramStructuralContext = {
        from: { id: 7594239391 },
        message: { text: '/fail' },
      };

      await expect(
        middleware(fakeCtx as any, async () => {
          throw new Error('Primary Business Error');
        })
      ).rejects.toThrow('Primary Business Error');

      expect(throwingPerformance).toHaveBeenCalled();
    });

    it('does not trigger onBreadcrumb or onPerformance for non-user IDs (negative channel IDs)', async () => {
      const onBreadcrumb = vi.fn();
      const onPerformance = vi.fn();

      const middleware = telemetryMiddleware({
        onBreadcrumb,
        onPerformance,
      });

      const fakeCtx: TelegramStructuralContext = {
        from: { id: -1001234567890 as any }, // Channel / Supergroup negative ID
        message: { text: 'Channel announcement' },
      };

      await middleware(fakeCtx as any, async () => {});

      expect(onBreadcrumb).not.toHaveBeenCalled();
      expect(onPerformance).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 3. TelemetryLogger Stress Tests
  // --------------------------------------------------------------------------
  describe('TelemetryLogger: stream routing & JSON validity', () => {
    let stdoutSpy: any;
    let stderrSpy: any;

    beforeEach(() => {
      stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    });

    it('routes debug and info to stdout; warn, error, fatal to stderr', () => {
      const logger = new TelemetryLogger({ minLevel: 'debug' });

      logger.debug('debug-event');
      logger.info('info-event');
      expect(stdoutSpy).toHaveBeenCalledTimes(2);
      expect(stderrSpy).not.toHaveBeenCalled();

      logger.warn('warn-event');
      logger.error('error-event');
      logger.fatal('fatal-event');
      expect(stdoutSpy).toHaveBeenCalledTimes(2);
      expect(stderrSpy).toHaveBeenCalledTimes(3);
    });

    it('strictly suppresses logs below minLevel', () => {
      const logger = new TelemetryLogger({ minLevel: 'error' });

      expect(logger.debug('d')).toBeUndefined();
      expect(logger.info('i')).toBeUndefined();
      expect(logger.warn('w')).toBeUndefined();
      expect(stdoutSpy).not.toHaveBeenCalled();
      expect(stderrSpy).not.toHaveBeenCalled();

      expect(logger.error('e')).toBeDefined();
      expect(logger.fatal('f')).toBeDefined();
      expect(stderrSpy).toHaveBeenCalledTimes(2);
    });

    it('every emitted log line is valid JSON ending with a newline', () => {
      const logger = new TelemetryLogger({ minLevel: 'debug' });

      logger.debug('debug test');
      logger.info('info test');
      logger.warn('warn test');
      logger.error('error test');
      logger.fatal('fatal test');

      const allWritten = [
        ...stdoutSpy.mock.calls.map((c: any) => c[0] as string),
        ...stderrSpy.mock.calls.map((c: any) => c[0] as string),
      ];

      expect(allWritten.length).toBe(5);

      for (const line of allWritten) {
        expect(line.endsWith('\n')).toBe(true);
        const parsed = JSON.parse(line.trim());
        expect(parsed).toBeTypeOf('object');
        expect(parsed.timestamp).toBeDefined();
        expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
        expect(parsed.traceId).toBeDefined();
        expect(parsed.service).toBeDefined();
        expect(parsed.environment).toBeDefined();
        expect(parsed.component).toBeDefined();
        expect(parsed.hostname).toBeDefined();
        expect(parsed.pid).toBeTypeOf('number');
      }
    });

    describe('Adversarial and complex payloads', () => {
      it('serializes payloads with BigInt safely without throwing', () => {
        const logger = new TelemetryLogger();
        const entry = logger.info('BigInt test', {
          payload: {
            workerId: 9007199254740993n,
            nested: {
              hugeAmount: 10000000000000000000n,
            },
          },
        });

        expect(entry).toBeDefined();
        const line = stdoutSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(line);
        expect(parsed.payload.workerId).toBe('9007199254740993');
        expect(parsed.payload.nested.hugeAmount).toBe('10000000000000000000');
      });

      it('handles circular references in payload safely without infinite loops or crashes', () => {
        const logger = new TelemetryLogger();
        const circularObj: any = { name: 'circular-root' };
        circularObj.self = circularObj;
        circularObj.nested = { back: circularObj };

        const entry = logger.warn('Circular test', { payload: circularObj });
        expect(entry).toBeDefined();

        const line = stderrSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(line);
        expect(parsed.payload.name).toBe('circular-root');
        expect(parsed.payload.self).toBe('[CIRCULAR_REFERENCE]');
        expect(parsed.payload.nested.back).toBe('[CIRCULAR_REFERENCE]');
      });

      it('enforces depth limit on deeply nested objects', () => {
        const logger = new TelemetryLogger();
        // Construct 12 levels of nesting
        let deep: any = { depth: 12 };
        for (let i = 11; i >= 0; i--) {
          deep = { level: i, child: deep };
        }

        const entry = logger.info('Deep nesting test', { payload: deep });
        expect(entry).toBeDefined();

        const line = stdoutSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(line);
        expect(JSON.stringify(parsed)).toContain('[MAX_DEPTH_REACHED]');
      });

      it('truncates oversized strings in payload', () => {
        const logger = new TelemetryLogger();
        const hugeString = 'X'.repeat(15000);

        const entry = logger.info('Oversized string', {
          payload: { content: hugeString },
        });

        expect(entry).toBeDefined();
        const line = stdoutSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(line);
        expect(parsed.payload.content).toContain('... [TRUNCATED]');
        expect(parsed.payload.content.length).toBeLessThan(15000);
      });

      it('handles Arabic text, emojis, and special unicode without corruption', () => {
        const logger = new TelemetryLogger();
        const arabicMsg = 'تم تسجيل السلفة بنجاح للعامل 👷‍♂️ أحمد محمد علي';
        const payload = {
          notes: 'ملاحظات الصرف المالي 💰: دفعة أولى من الراتب',
          code: 'سلفة_نقدية',
        };

        const entry = logger.info(arabicMsg, { payload });
        expect(entry).toBeDefined();

        const line = stdoutSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(line);
        expect(parsed.message).toBe(arabicMsg);
        expect(parsed.payload.notes).toBe(payload.notes);
        expect(parsed.payload.code).toBe(payload.code);
      });

      it('scrubs sensitive properties inside Error cause chains', () => {
        const logger = new TelemetryLogger();
        const rootCause = new Error('Underlying database failure at postgresql://app_user:secretPass123@db.prod:5432/finance');
        const outerError = new Error('Service transaction failed', { cause: rootCause });

        const entry = logger.error('Transaction failed', { error: outerError });
        expect(entry).toBeDefined();

        const line = stderrSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(line);
        expect(parsed.error.cause).toBeDefined();
        expect(parsed.error.cause.message).toContain('[REDACTED_PASSWORD]');
        expect(parsed.error.cause.message).not.toContain('secretPass123');
      });
    });
  });
});
