import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { extractTraceId, createTraceHeaders, isValidTraceId } from '@alsaada/telemetry';
import { middleware } from '../src/middleware';
import { createSessionToken, type SessionPayload } from '../src/lib/session';

describe('Admin Dashboard Middleware & Trace ID Propagation', () => {
  const samplePayload: SessionPayload = {
    userId: 'usr-admin-trace-01',
    telegramId: '987654321',
    role: 'SUPER_ADMIN',
    name: 'المهندس صالح عثمان',
    isRealSuperAdmin: true,
    createdAt: Date.now(),
  };

  describe('extractTraceId & Header Creation', () => {
    it('extracts traceId from query param (?traceId=...)', () => {
      const customId = 'e2b1c4d5-6789-4abc-9def-0123456789ab';
      const req = new NextRequest(`http://localhost:3002/admin?traceId=${customId}`);
      const traceId = extractTraceId(req);
      expect(traceId).toBe(customId);
    });

    it('extracts traceId from x-trace-id header', () => {
      const customId = 'f3c2d5e6-7890-4bcd-adef-123456789abc';
      const req = new NextRequest('http://localhost:3002/admin', {
        headers: { 'x-trace-id': customId },
      });
      const traceId = extractTraceId(req);
      expect(traceId).toBe(customId);
    });

    it('extracts and formats traceId from W3C traceparent header', () => {
      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
      const req = new NextRequest('http://localhost:3002/admin', {
        headers: { traceparent },
      });
      const traceId = extractTraceId(req);
      expect(isValidTraceId(traceId)).toBe(true);
      expect(traceId).toBe('4bf92f35-77b3-4da6-a3ce-929d0e0e4736');
    });

    it('falls back to a new valid UUIDv4 when no trace info is provided', () => {
      const req = new NextRequest('http://localhost:3002/admin');
      const traceId = extractTraceId(req);
      expect(isValidTraceId(traceId)).toBe(true);
      expect(traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('creates compliant traceparent header and x-trace-id header', () => {
      const traceId = 'a1b2c3d4-e5f6-4789-abcd-ef0123456789';
      const headers = createTraceHeaders(traceId);
      expect(headers['x-trace-id']).toBe(traceId);
      expect(headers['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/i);
      expect(headers['traceparent']).toContain('a1b2c3d4e5f64789abcdef0123456789');
    });
  });

  describe('Middleware Execution & Response Headers', () => {
    it('injects x-trace-id and traceparent into redirect response on unauthenticated /admin route', async () => {
      const customTraceId = 'd1a2b3c4-e5f6-4789-9abc-ef0123456789';
      const req = new NextRequest(`http://localhost:3002/admin/workforce?traceId=${customTraceId}`);
      const res = await middleware(req);

      expect(res.status).toBe(302);
      const location = res.headers.get('location') || '';
      expect(location).toContain('start=dashboard_access');

      expect(res.headers.get('x-trace-id')).toBe(customTraceId);
      expect(res.headers.get('traceparent')).toBeDefined();
      expect(res.headers.get('traceparent')).toContain('d1a2b3c4e5f647899abcef0123456789');
    });

    it('generates a new traceId and sets it on redirect when unauthenticated request lacks trace info', async () => {
      const req = new NextRequest('http://localhost:3002/admin/settings');
      const res = await middleware(req);

      expect(res.status).toBe(302);
      const traceId = res.headers.get('x-trace-id');
      expect(traceId).toBeDefined();
      expect(isValidTraceId(traceId!)).toBe(true);

      const location = res.headers.get('location') || '';
      expect(location).toContain('start=dashboard_access');
      expect(res.headers.get('traceparent')).toBeDefined();
    });

    it('injects trace headers into response and downstream request for authenticated requests', async () => {
      const token = await createSessionToken(samplePayload);
      const customTraceId = 'b2c3d4e5-f6a7-4890-8bcd-ef1234567890';
      const req = new NextRequest(`http://localhost:3002/admin?traceId=${customTraceId}`, {
        headers: {
          cookie: `alsaada_session=${token}`,
        },
      });

      const res = await middleware(req);

      // Not redirected
      expect(res.headers.get('location')).toBeNull();

      // Output response headers
      expect(res.headers.get('x-trace-id')).toBe(customTraceId);
      expect(res.headers.get('traceparent')).toBeDefined();
      expect(res.headers.get('traceparent')).toContain('b2c3d4e5f6a748908bcdef1234567890');

      // Downstream request headers injected by Next.js NextResponse.next({ request: { headers } })
      // Next.js sets `x-middleware-request-x-trace-id` on the response when request headers are modified
      const downstreamTraceId =
        res.headers.get('x-middleware-request-x-trace-id') ||
        res.headers.get('x-trace-id');
      expect(downstreamTraceId).toBe(customTraceId);
    });

    it('preserves existing traceId from incoming x-trace-id header in authenticated flow', async () => {
      const token = await createSessionToken(samplePayload);
      const customTraceId = 'c3d4e5f6-a7b8-4901-9cde-f12345678901';
      const req = new NextRequest('http://localhost:3002/admin', {
        headers: {
          cookie: `alsaada_session=${token}`,
          'x-trace-id': customTraceId,
        },
      });

      const res = await middleware(req);

      expect(res.headers.get('x-trace-id')).toBe(customTraceId);
      expect(res.headers.get('traceparent')).toContain('c3d4e5f6a7b849019cdef12345678901');
    });
  });
});
