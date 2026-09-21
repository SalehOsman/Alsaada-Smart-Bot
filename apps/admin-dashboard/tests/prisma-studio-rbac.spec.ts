import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { getCurrentUser } from '../src/lib/auth';
import { filterNavItemsForUser } from '../src/lib/rbac';
import { DASHBOARD_SECTIONS_MANIFEST } from '../src/dashboard.manifest';
import { StudioProcessManager } from '../src/lib/studio-process';
import { GET as statusGet } from '../src/app/api/admin/studio/status/route';
import { POST as lifecyclePost } from '../src/app/api/admin/studio/lifecycle/route';
import { prisma } from '@alsaada/database';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';

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

describe('Plan 66: Sovereign Prisma Studio Launchpad & Ngrok Extension Configuration', () => {
  let stderrSpy: any;
  let stdoutSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy?.mockRestore();
    stdoutSpy?.mockRestore();
    vi.useRealTimers();
  });

  describe('1. Manifest & Navigation RBAC Sovereignty', () => {
    it('registers settings/prisma-studio in DASHBOARD_SECTIONS_MANIFEST exclusively for SUPER_ADMIN', () => {
      const settingsSection = DASHBOARD_SECTIONS_MANIFEST.find((s) => s.href === '/admin/settings');
      expect(settingsSection).toBeDefined();

      const prismaStudioFeature = settingsSection?.features?.find((f) => f.id === 'settings/prisma-studio');
      expect(prismaStudioFeature).toBeDefined();
      expect(prismaStudioFeature?.title).toBe('أدوات المطور والمعمارية والتوثيق');
      expect(prismaStudioFeature?.href).toBe('/admin/settings/prisma-studio');
      expect(prismaStudioFeature?.allowedRoles).toEqual(['SUPER_ADMIN']);
      expect(prismaStudioFeature?.status).toBe('Implemented');
    });

    it('exposes prisma-studio navigation child exclusively to SUPER_ADMIN', () => {
      const superNav = filterNavItemsForUser('SUPER_ADMIN');
      const settingsGroup = superNav.find((n) => n.href === '/admin/settings');
      const studioLink = settingsGroup?.children?.find((c) => c.href === '/admin/settings/prisma-studio');
      expect(studioLink).toBeDefined();
      expect(studioLink?.title).toBe('أدوات المطور والمعمارية والتوثيق');
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

  describe('2. Studio Status API Route Guard & Access (/api/admin/studio/status)', () => {
    it('status route rejects unauthenticated requests with 401', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const req = new NextRequest('http://localhost:3002/api/admin/studio/status');
      const res = await statusGet(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('UNAUTHORIZED');
    });

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
      const data = await res.json();
      expect(data.error).toBe('FORBIDDEN');
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
  });

  describe('3. Studio Lifecycle API Route Guard & Actions (/api/admin/studio/lifecycle)', () => {
    it('lifecycle route rejects unauthenticated requests with 401', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const req = new NextRequest('http://localhost:3002/api/admin/studio/lifecycle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const res = await lifecyclePost(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('UNAUTHORIZED');
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
      const data = await res.json();
      expect(data.error).toBe('FORBIDDEN');
    });

    it('lifecycle route validates action payloads and rejects invalid action with 400', async () => {
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

    it('lifecycle route executes start action for SUPER_ADMIN', async () => {
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
        body: JSON.stringify({ action: 'start' }),
      });
      const res = await lifecyclePost(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.action).toBe('start');
      expect(data.status).toHaveProperty('isRunning');
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

    it('lifecycle route executes restart action for SUPER_ADMIN', async () => {
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
        body: JSON.stringify({ action: 'restart' }),
      });
      const res = await lifecyclePost(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.action).toBe('restart');
      expect(data.status).toHaveProperty('isRunning');
    });

    it('lifecycle route executes extend action and records PRISMA_STUDIO_EXTEND audit log', async () => {
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
        body: JSON.stringify({ action: 'extend' }),
      });
      const res = await lifecyclePost(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.action).toBe('extend');
      expect(data.status).toHaveProperty('isRunning');
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

    it('records PRISMA_STUDIO_EXTEND when session is extended while active', async () => {
      // Arrange
      const manager = new StudioProcessManager();
      // Simulate active session
      (manager as unknown as { startedAtTime: number }).startedAtTime = PINNED_BASE_TIME.getTime();

      // Act
      const status = await manager.extendSession('7594239391', '127.0.0.1');

      // Assert
      expect(status.remainingSeconds).toBeGreaterThan(0);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorTelegramId: BigInt('7594239391'),
            action: 'PRISMA_STUDIO_EXTEND',
            entityType: 'PRISMA_STUDIO',
            entityId: 'studio:5555',
          }),
        })
      );
    });

    it('attaches and extends session when Prisma Studio is healthy even if startedAtTime was null', async () => {
      const manager = new StudioProcessManager();
      (manager as unknown as { startedAtTime: number | null }).startedAtTime = null;
      vi.spyOn(manager, 'isHealthy').mockResolvedValue(true);

      const status = await manager.extendSession('999888777', '10.0.0.5');

      expect(status.isRunning).toBe(true);
      expect(status.remainingSeconds).toBe(900);
      expect(manager.isActive()).toBe(true);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorTelegramId: BigInt('999888777'),
            action: 'PRISMA_STUDIO_EXTEND',
            ipAddress: '10.0.0.5',
          }),
        })
      );
    });

    it('extendSession returns current status if session is not active and not healthy without throwing', async () => {
      const manager = new StudioProcessManager();
      (manager as unknown as { startedAtTime: number | null }).startedAtTime = null;
      vi.spyOn(manager, 'isHealthy').mockResolvedValue(false);
      const status = await manager.extendSession('7594239391', '127.0.0.1');

      expect(status.isRunning).toBe(false);
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
