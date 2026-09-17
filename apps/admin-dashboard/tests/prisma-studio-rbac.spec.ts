import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { getCurrentUser } from '../src/lib/auth';
import { filterNavItemsForUser, DASHBOARD_NAV_ITEMS } from '../src/lib/rbac';
import { DASHBOARD_SECTIONS_MANIFEST } from '../src/dashboard.manifest';
import { StudioProcessManager } from '../src/lib/studio-process';
import { GET as proxyGet, POST as proxyPost } from '../src/app/api/admin/studio/proxy/[[...path]]/route';
import { GET as statusGet } from '../src/app/api/admin/studio/status/route';
import { POST as lifecyclePost } from '../src/app/api/admin/studio/lifecycle/route';
import { prisma } from '@alsaada/database';

vi.mock('@alsaada/database', () => ({
  prisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'mock-audit-id' }),
    },
  },
}));

vi.mock('../src/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  requireDashboardUser: vi.fn(),
}));

describe('Plan 57: Sovereign Prisma Studio Cockpit & Ngrok DMZ Ingress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Manifest & Navigation RBAC Sovereignty', () => {
    it('registers settings/prisma-studio in DASHBOARD_SECTIONS_MANIFEST exclusively for SUPER_ADMIN', () => {
      const settingsSection = DASHBOARD_SECTIONS_MANIFEST.find((s) => s.href === '/admin/settings');
      expect(settingsSection).toBeDefined();

      const prismaStudioFeature = settingsSection?.features?.find((f) => f.id === 'settings/prisma-studio');
      expect(prismaStudioFeature).toBeDefined();
      expect(prismaStudioFeature?.title).toBe('استوديو قاعدة البيانات (Prisma)');
      expect(prismaStudioFeature?.href).toBe('/admin/settings/prisma-studio');
      expect(prismaStudioFeature?.allowedRoles).toEqual(['SUPER_ADMIN']);
      expect(prismaStudioFeature?.status).toBe('Implemented');
    });

    it('exposes prisma-studio navigation child exclusively to SUPER_ADMIN', () => {
      const superNav = filterNavItemsForUser('SUPER_ADMIN');
      const settingsGroup = superNav.find((n) => n.href === '/admin/settings');
      const studioLink = settingsGroup?.children?.find((c) => c.href === '/admin/settings/prisma-studio');
      expect(studioLink).toBeDefined();
      expect(studioLink?.title).toBe('استوديو قاعدة البيانات (Prisma)');
    });

    it('strictly masks prisma-studio navigation child from GENERAL_ADMIN and FIELD_ADMIN', () => {
      const generalNav = filterNavItemsForUser('GENERAL_ADMIN');
      const generalSettings = generalNav.find((n) => n.href === '/admin/settings');
      const generalStudio = generalSettings?.children?.find((c) => c.href === '/admin/settings/prisma-studio');
      expect(generalStudio).toBeUndefined();

      const fieldNav = filterNavItemsForUser('FIELD_ADMIN');
      const fieldSettings = fieldNav.find((n) => n.href === '/admin/settings');
      const fieldStudio = fieldSettings?.children?.find((c) => c.href === '/admin/settings/prisma-studio');
      expect(fieldStudio).toBeUndefined();
    });
  });

  describe('2. Reverse Proxy Route Guard (/api/admin/studio/proxy)', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const req = new NextRequest('http://localhost:3002/api/admin/studio/proxy');
      const res = await proxyGet(req, { params: Promise.resolve({ path: [] }) });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('UNAUTHORIZED');
    });

    it('rejects GENERAL_ADMIN with 403 Forbidden', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'usr-gen-1',
        name: 'مدير عام',
        role: 'GENERAL_ADMIN',
        isRealSuperAdmin: false,
      });

      const req = new NextRequest('http://localhost:3002/api/admin/studio/proxy');
      const res = await proxyGet(req, { params: Promise.resolve({ path: [] }) });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('FORBIDDEN');
    });

    it('rejects FIELD_ADMIN with 403 Forbidden', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'usr-field-1',
        name: 'مشرف ميداني',
        role: 'FIELD_ADMIN',
        isRealSuperAdmin: false,
      });

      const req = new NextRequest('http://localhost:3002/api/admin/studio/proxy/assets/index.js');
      const res = await proxyGet(req, { params: Promise.resolve({ path: ['assets', 'index.js'] }) });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('FORBIDDEN');
    });

    it('allows SUPER_ADMIN to proxy requests (returning 503 offline card if studio is stopped)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'usr-super-1',
        telegramId: '7594239391',
        name: 'صالح عثمان',
        role: 'SUPER_ADMIN',
        isRealSuperAdmin: true,
      });

      const req = new NextRequest('http://localhost:3002/api/admin/studio/proxy', {
        headers: { accept: 'application/json' },
      });
      const res = await proxyGet(req, { params: Promise.resolve({ path: [] }) });

      // Either upstream proxies (200) or fails safely with STUDIO_OFFLINE (503)
      expect([200, 503]).toContain(res.status);
      if (res.status === 503) {
        const data = await res.json();
        expect(data.error).toBe('STUDIO_OFFLINE');
      }
    });

    it('rewrites hardcoded `${window.location.origin}/api` in JavaScript responses', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'usr-super-1',
        telegramId: '7594239391',
        name: 'صالح عثمان',
        role: 'SUPER_ADMIN',
        isRealSuperAdmin: true,
      });

      // Mock global fetch for upstream studio responding with JavaScript
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({
          'content-type': 'application/javascript; charset=utf-8',
          'content-length': '120',
        }),
        text: vi.fn().mockResolvedValue(
          'window.databrowser({transport:{type:"http",url:`${window.location.origin}/api`}});'
        ),
      } as unknown as Response);

      try {
        const req = new NextRequest('http://localhost:3002/api/admin/studio/proxy/http/databrowser.js');
        const res = await proxyGet(req, { params: Promise.resolve({ path: ['http', 'databrowser.js'] }) });

        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('javascript');
        const text = await res.text();
        expect(text).toContain('${window.location.origin}/api/admin/studio/proxy/api');
        expect(text).not.toContain('${window.location.origin}/api`');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('3. Studio Status & Lifecycle API (/api/admin/studio/status & /lifecycle)', () => {
    it('status route rejects non-SUPER_ADMIN with 403', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'usr-gen-1',
        name: 'مدير عام',
        role: 'GENERAL_ADMIN',
        isRealSuperAdmin: false,
      });

      const req = new NextRequest('http://localhost:3002/api/admin/studio/status');
      const res = await statusGet(req);

      expect(res.status).toBe(403);
    });

    it('status route returns status object to SUPER_ADMIN', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'usr-super-1',
        name: 'سوبر أدمن',
        role: 'SUPER_ADMIN',
        isRealSuperAdmin: true,
      });

      const req = new NextRequest('http://localhost:3002/api/admin/studio/status');
      const res = await statusGet(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('isRunning');
      expect(data).toHaveProperty('port', 5555);
      expect(data).toHaveProperty('remainingSeconds');
    });

    it('lifecycle route rejects non-SUPER_ADMIN with 403', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'usr-field-1',
        name: 'مشرف ميداني',
        role: 'FIELD_ADMIN',
        isRealSuperAdmin: false,
      });

      const req = new NextRequest('http://localhost:3002/api/admin/studio/lifecycle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const res = await lifecyclePost(req);

      expect(res.status).toBe(403);
    });

    it('lifecycle route validates action payloads', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'usr-super-1',
        name: 'سوبر أدمن',
        role: 'SUPER_ADMIN',
        isRealSuperAdmin: true,
      });

      const req = new NextRequest('http://localhost:3002/api/admin/studio/lifecycle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'invalid_action' }),
      });
      const res = await lifecyclePost(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('INVALID_ACTION');
    });

    it('lifecycle route executes stop action and records forensic audit log', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'usr-super-1',
        telegramId: '7594239391',
        name: 'سوبر أدمن',
        role: 'SUPER_ADMIN',
        isRealSuperAdmin: true,
      });

      const req = new NextRequest('http://localhost:3002/api/admin/studio/lifecycle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      const res = await lifecyclePost(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.action).toBe('stop');
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('4. Studio Process Manager & 15-Minute Auto-Shutdown Watchdog', () => {
    it('initializes with 15-minute idle timeout and default port 5555', () => {
      const manager = new StudioProcessManager();
      expect(manager.IDLE_TIMEOUT_MS).toBe(15 * 60 * 1000);
      expect(manager.DEFAULT_PORT).toBe(5555);
      expect(manager.getPort()).toBe(5555);
    });

    it('records forensic audit logs with entityType PRISMA_STUDIO on stop', async () => {
      const manager = new StudioProcessManager();
      await manager.stop('7594239391', '192.168.1.10', 'MANUAL_STOP');

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorTelegramId: BigInt('7594239391'),
            action: 'PRISMA_STUDIO_STOP',
            entityType: 'PRISMA_STUDIO',
            entityId: 'studio:5555',
            ipAddress: '192.168.1.10',
          }),
        })
      );
    });

    it('records PRISMA_STUDIO_AUTO_SHUTDOWN when stopped by watchdog idle timeout', async () => {
      const manager = new StudioProcessManager();
      await manager.stop('7594239391', '127.0.0.1', 'IDLE_TIMEOUT_15_MINUTES');

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorTelegramId: BigInt('7594239391'),
            action: 'PRISMA_STUDIO_AUTO_SHUTDOWN',
            entityType: 'PRISMA_STUDIO',
            entityId: 'studio:5555',
          }),
        })
      );
    });

    it('resolves database package directory containing schema.prisma correctly', () => {
      const manager = new StudioProcessManager();
      const dbDir = manager.findDatabasePackageDir();
      expect(fs.existsSync(dbDir)).toBe(true);
      expect(fs.existsSync(path.join(dbDir, 'prisma', 'schema.prisma'))).toBe(true);
    });

    it('determines targetUrl correctly falling back to localhost:5555 by default', () => {
      const manager = new StudioProcessManager();
      expect(manager.getTargetUrl()).toMatch(/http:\/\/(127\.0\.0\.1|studio|localhost):5555/);
    });
  });

  describe('5. Docker Architecture & Official Ngrok Extension Migration', () => {
    const root = path.resolve(__dirname, '../../..');
    const composePath = path.join(root, 'docker-compose.yml');
    const ngrokConfigPath = path.join(root, 'docker/ngrok/ngrok.yml');

    it('verifies standalone docker/ngrok directory and config are completely purged', () => {
      expect(fs.existsSync(ngrokConfigPath)).toBe(false);
      expect(fs.existsSync(path.join(root, 'docker/ngrok'))).toBe(false);
    });

    it('verifies standalone ngrok service is cleanly removed from docker-compose.yml', () => {
      expect(fs.existsSync(composePath)).toBe(true);
      const content = fs.readFileSync(composePath, 'utf8');

      // Standalone container must not exist
      expect(content).not.toContain('image: ngrok/ngrok:latest');
      expect(content).not.toContain('container_name: alsaada_enterprise_ngrok');
      expect(content).not.toContain('./docker/ngrok/ngrok.yml');
    });

    it('provisions PRISMA_STUDIO_URL in dashboard service for internal reverse proxy', () => {
      const content = fs.readFileSync(composePath, 'utf8');
      expect(content).toContain('PRISMA_STUDIO_URL: ${PRISMA_STUDIO_URL:-http://studio:5555}');
    });
  });
});
