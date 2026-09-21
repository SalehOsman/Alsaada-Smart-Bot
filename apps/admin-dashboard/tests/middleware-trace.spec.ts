import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { extractTraceId, createTraceHeaders, isValidTraceId } from '@alsaada/telemetry';
import { middleware } from '../src/middleware';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';

describe('Admin Dashboard Middleware & Trace ID Propagation', () => {
  const validOpaqueToken = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('extractTraceId & Header Creation', () => {
    it('extracts traceId from query param (?traceId=...) with strict format validation', () => {
      // Arrange
      const customId = 'e2b1c4d5-6789-4abc-9def-0123456789ab';
      const req = new NextRequest(`http://localhost:3002/admin?traceId=${customId}`);

      // Act
      const traceId = extractTraceId(req);

      // Assert
      expect(traceId).toBe(customId);
      expect(isValidTraceId(traceId)).toBe(true);
      expect(traceId).not.toBe('');
      expect(traceId).not.toBeNull();
    });

    it('extracts traceId from x-trace-id header when query param is absent', () => {
      // Arrange
      const customId = 'f3c2d5e6-7890-4bcd-adef-123456789abc';
      const req = new NextRequest('http://localhost:3002/admin', {
        headers: { 'x-trace-id': customId },
      });

      // Act
      const traceId = extractTraceId(req);

      // Assert
      expect(traceId).toBe(customId);
      expect(isValidTraceId(traceId)).toBe(true);
      expect(traceId).not.toBe('different-id');
    });

    it('extracts and formats traceId from W3C traceparent header', () => {
      // Arrange
      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
      const req = new NextRequest('http://localhost:3002/admin', {
        headers: { traceparent },
      });

      // Act
      const traceId = extractTraceId(req);

      // Assert
      expect(isValidTraceId(traceId)).toBe(true);
      expect(traceId).toBe('4bf92f35-77b3-4da6-a3ce-929d0e0e4736');
      expect(traceId).not.toContain('00-');
    });

    it('falls back to a new valid UUIDv4 when no trace info is provided', () => {
      // Arrange
      const req = new NextRequest('http://localhost:3002/admin');

      // Act
      const traceId = extractTraceId(req);

      // Assert
      expect(isValidTraceId(traceId)).toBe(true);
      expect(traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(traceId).not.toBe('');
    });

    it('falls back to valid UUIDv4 when incoming traceparent is corrupted or malformed', () => {
      // Arrange
      const malformedHeaders = [
        'invalid-traceparent',
        '00-tooshort-00f067aa0ba902b7-01',
        'ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      ];

      for (const tp of malformedHeaders) {
        const req = new NextRequest('http://localhost:3002/admin', {
          headers: { traceparent: tp },
        });

        // Act
        const traceId = extractTraceId(req);

        // Assert
        expect(isValidTraceId(traceId)).toBe(true);
        expect(traceId).not.toBe(tp);
      }
    });

    it('creates compliant traceparent header and x-trace-id header', () => {
      // Arrange
      const traceId = 'a1b2c3d4-e5f6-4789-abcd-ef0123456789';

      // Act
      const headers = createTraceHeaders(traceId);

      // Assert
      expect(headers['x-trace-id']).toBe(traceId);
      expect(headers['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/i);
      expect(headers['traceparent']).toContain('a1b2c3d4e5f64789abcdef0123456789');
      expect(headers['x-trace-id']).not.toBeUndefined();
    });
  });

  describe('Middleware Execution & Response Headers', () => {
    it('injects x-trace-id and traceparent into redirect response on unauthenticated /admin route', async () => {
      // Arrange
      const customTraceId = 'd1a2b3c4-e5f6-4789-9abc-ef0123456789';
      const req = new NextRequest(`http://localhost:3002/admin/workforce?traceId=${customTraceId}`);

      // Act
      const res = await middleware(req);

      // Assert
      expect(res.status).toBe(302);
      const location = res.headers.get('location') || '';
      expect(location).toContain('start=dashboard_access');
      expect(res.headers.get('x-trace-id')).toBe(customTraceId);
      expect(res.headers.get('traceparent')).toBeDefined();
      expect(res.headers.get('traceparent')).toContain('d1a2b3c4e5f647899abcef0123456789');
      expect(res.headers.get('location')).not.toBeNull();
    });

    it('generates a new traceId and sets it on redirect when unauthenticated request lacks trace info', async () => {
      // Arrange
      const req = new NextRequest('http://localhost:3002/admin/settings');

      // Act
      const res = await middleware(req);

      // Assert
      expect(res.status).toBe(302);
      const traceId = res.headers.get('x-trace-id');
      expect(traceId).toBeDefined();
      expect(isValidTraceId(traceId!)).toBe(true);

      const location = res.headers.get('location') || '';
      expect(location).toContain('start=dashboard_access');
      expect(res.headers.get('traceparent')).toBeDefined();
      expect(res.headers.get('location')).not.toContain('/login');
    });

    it('injects trace headers into response and downstream request for authenticated requests', async () => {
      // Arrange
      const customTraceId = 'b2c3d4e5-f6a7-4890-8bcd-ef1234567890';
      const req = new NextRequest(`http://localhost:3002/admin?traceId=${customTraceId}`, {
        headers: {
          cookie: `alsaada_session=${validOpaqueToken}`,
        },
      });

      // Act
      const res = await middleware(req);

      // Assert
      expect(res.headers.get('location')).toBeNull();
      expect(res.status).not.toBe(302);
      expect(res.headers.get('x-trace-id')).toBe(customTraceId);
      expect(res.headers.get('traceparent')).toBeDefined();
      expect(res.headers.get('traceparent')).toContain('b2c3d4e5f6a748908bcdef1234567890');

      const downstreamTraceId =
        res.headers.get('x-middleware-request-x-trace-id') ||
        res.headers.get('x-trace-id');
      expect(downstreamTraceId).toBe(customTraceId);
      expect(downstreamTraceId).not.toBeNull();
    });

    it('preserves existing traceId from incoming x-trace-id header in authenticated flow', async () => {
      // Arrange
      const customTraceId = 'c3d4e5f6-a7b8-4901-9cde-f12345678901';
      const req = new NextRequest('http://localhost:3002/admin', {
        headers: {
          cookie: `alsaada_session=${validOpaqueToken}`,
          'x-trace-id': customTraceId,
        },
      });

      // Act
      const res = await middleware(req);

      // Assert
      expect(res.headers.get('x-trace-id')).toBe(customTraceId);
      expect(res.headers.get('traceparent')).toContain('c3d4e5f6a7b849019cdef12345678901');
      expect(res.headers.get('location')).toBeNull();
      expect(res.status).toBe(200);
    });
  });
});
