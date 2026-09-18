import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getCurrentUser } from '../src/lib/auth';
import { GET as docsStatusGet } from '../src/app/api/admin/docs/status/route';
import { POST as docsSyncPost } from '../src/app/api/admin/docs/sync/route';

vi.mock('../src/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  requireDashboardUser: vi.fn(),
}));

describe('Plan 67: Docs Portal & Architecture Cockpit Verification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DOCS_PORT;
    delete process.env.DOCS_TUNNEL_URL;
  });

  describe('1. Docs Status API Route Guard & Invariants (/api/admin/docs/status)', () => {
    it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const req = new NextRequest('http://localhost:3002/api/admin/docs/status');
      const res = await docsStatusGet(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('UNAUTHORIZED');
    });

    it('rejects GENERAL_ADMIN with 403 FORBIDDEN', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'mock-admin',
        telegramId: '123456',
        role: 'GENERAL_ADMIN',
        name: 'Mock',
        assignedSiteId: null,
        assignedSiteName: null,
        isRealSuperAdmin: false
      });

      const req = new NextRequest('http://localhost:3002/api/admin/docs/status');
      const res = await docsStatusGet(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('FORBIDDEN');
    });

    it('returns status metrics for SUPER_ADMIN with default 4321 port', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'super-admin-id',
        telegramId: '7594239391',
        role: 'SUPER_ADMIN',
        name: 'Super',
        assignedSiteId: null,
        assignedSiteName: null,
        isRealSuperAdmin: true
      });

      process.env.DOCS_PORT = '4321';
      process.env.DOCS_TUNNEL_URL = 'https://docs.alsaada.ngrok-free.app';

      const req = new NextRequest('http://localhost:3002/api/admin/docs/status');
      const res = await docsStatusGet(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.pageCount).toBe(137);
      expect(data.adrCount).toBe(37);
      expect(data.port).toBe(4321);
      expect(data.tunnelUrl).toBe('https://docs.alsaada.ngrok-free.app');
    });
  });

  describe('2. Docs Sync API Route Guard (/api/admin/docs/sync)', () => {
    it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const req = new NextRequest('http://localhost:3002/api/admin/docs/sync', { method: 'POST' });
      const res = await docsSyncPost(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('UNAUTHORIZED');
    });

    it('rejects FIELD_ADMIN with 403 FORBIDDEN', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'field-admin-id',
        telegramId: '987654',
        role: 'FIELD_ADMIN',
        name: 'Field',
        assignedSiteId: null,
        assignedSiteName: null,
        isRealSuperAdmin: false
      });

      const req = new NextRequest('http://localhost:3002/api/admin/docs/sync', { method: 'POST' });
      const res = await docsSyncPost(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('FORBIDDEN');
    });

    it('executes or reports sync status gracefully for SUPER_ADMIN', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'super-admin-id',
        telegramId: '7594239391',
        role: 'SUPER_ADMIN',
        name: 'Super',
        assignedSiteId: null,
        assignedSiteName: null,
        isRealSuperAdmin: true
      });

      const req = new NextRequest('http://localhost:3002/api/admin/docs/sync', { method: 'POST' });
      const res = await docsSyncPost(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(typeof data.message).toBe('string');
    });
  });
});
