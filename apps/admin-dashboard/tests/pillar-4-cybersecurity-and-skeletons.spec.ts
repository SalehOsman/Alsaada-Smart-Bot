import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { GET as getWorker, PUT as updateWorker } from '../src/app/api/workers/[id]/route';
import { getCurrentUser } from '../src/lib/auth';
import { prisma, createBlindIndex } from '@alsaada/database';
import AdminRootLoading from '../src/app/admin/loading';
import WorkforceLoading from '../src/app/admin/workforce/loading';
import SettingsLoading from '../src/app/admin/settings/loading';
import ApprovalsLoading from '../src/app/admin/approvals/loading';
import TelemetryLoading from '../src/app/admin/telemetry/loading';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../src/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@alsaada/database', async () => {
  const actual = await vi.importActual<typeof import('@alsaada/database')>('@alsaada/database');
  return {
    ...actual,
    prisma: {
      worker: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (callback: any) => {
        const tx = {
          worker: {
            update: vi.fn().mockResolvedValue({ id: 'w-1', name: 'عامل تجريبي' }),
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({ id: 'log-1' }),
          },
        };
        return callback(tx);
      }),
    },
  };
});

describe('Plan 74 — Pillar 4: Cybersecurity, Blind Index Sync, BOLA/IDOR Site-Scoping & Suspense Skeletons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BLIND_INDEX_SECRET = 'test-blind-index-secret-2026';
    process.env.DATABASE_ENCRYPTION_KEY = '01234567890123456789012345678901';
  });

  // =========================================================================
  // 1. Worker [id] API Route — Strict Site-Scoping (BOLA / IDOR Protection)
  // =========================================================================
  describe('1. BOLA / IDOR Mitigation & Strict Site-Scoping for FIELD_ADMIN', () => {
    const mockWorker = {
      id: 'w-1',
      code: 'WRK-001',
      name: 'أحمد إبراهيم علي',
      nickname: 'أبو حميد',
      phoneEncrypted: 'mock-encrypted-phone',
      nationalIdEncrypted: 'mock-encrypted-nid',
      siteId: 'site-alamein',
      site: { id: 'site-alamein', name: 'مشروع العلمين' },
      jobRef: { id: 'job-1', name: 'سائق' },
      status: 'ACTIVE',
      basicSalary: 7000,
      fixedAllowances: 1000,
      isDeleted: false,
    };

    it('GET /api/workers/[id] returns 401 if user is unauthenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3002/api/workers/w-1');
      const res = await getWorker(req, { params: Promise.resolve({ id: 'w-1' }) });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('غير مصرح');
    });

    it('GET /api/workers/[id] strictly returns 403 when FIELD_ADMIN has no assigned site (!user.assignedSiteId)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'u-1',
        telegramId: '1001',
        role: 'FIELD_ADMIN',
        name: 'مشرف بدون موقع',
        assignedSiteId: undefined, // No assigned site!
        isRealSuperAdmin: false,
      } as any);

      vi.mocked(prisma.worker.findUnique).mockResolvedValue(mockWorker as any);

      const req = new NextRequest('http://localhost:3002/api/workers/w-1');
      const res = await getWorker(req, { params: Promise.resolve({ id: 'w-1' }) });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('غير مصرح لك بالوصول لبيانات عمال هذا الموقع');
    });

    it('GET /api/workers/[id] strictly returns 403 when FIELD_ADMIN attempts to view worker from another site', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'u-1',
        telegramId: '1001',
        role: 'FIELD_ADMIN',
        name: 'مشرف موقع العاصمة',
        assignedSiteId: 'site-new-capital', // Different site
        isRealSuperAdmin: false,
      } as any);

      vi.mocked(prisma.worker.findUnique).mockResolvedValue(mockWorker as any);

      const req = new NextRequest('http://localhost:3002/api/workers/w-1');
      const res = await getWorker(req, { params: Promise.resolve({ id: 'w-1' }) });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('غير مصرح لك بالوصول لبيانات عمال هذا الموقع');
    });

    it('GET /api/workers/[id] permits FIELD_ADMIN to access worker in their assigned site', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'u-1',
        telegramId: '1001',
        role: 'FIELD_ADMIN',
        name: 'مشرف العلمين',
        assignedSiteId: 'site-alamein', // Same site
        isRealSuperAdmin: false,
      } as any);

      vi.mocked(prisma.worker.findUnique).mockResolvedValue(mockWorker as any);

      const req = new NextRequest('http://localhost:3002/api/workers/w-1');
      const res = await getWorker(req, { params: Promise.resolve({ id: 'w-1' }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.siteId).toBe('site-alamein');
      // Compensation masked for FIELD_ADMIN
      expect(json.data.basicSalary).toBeUndefined();
    });

    it('PUT /api/workers/[id] strictly returns 403 when FIELD_ADMIN has no assigned site', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'u-1',
        telegramId: '1001',
        role: 'FIELD_ADMIN',
        name: 'مشرف بدون موقع',
        assignedSiteId: undefined,
        isRealSuperAdmin: false,
      } as any);

      vi.mocked(prisma.worker.findUnique).mockResolvedValue(mockWorker as any);

      const req = new NextRequest('http://localhost:3002/api/workers/w-1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'تعديل اسم' }),
      });
      const res = await updateWorker(req, { params: Promise.resolve({ id: 'w-1' }) });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('غير مصرح لك بتعديل عمال هذا الموقع');
    });

    it('PUT /api/workers/[id] prevents FIELD_ADMIN from transferring worker to another site', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'u-1',
        telegramId: '1001',
        role: 'FIELD_ADMIN',
        name: 'مشرف العلمين',
        assignedSiteId: 'site-alamein',
        isRealSuperAdmin: false,
      } as any);

      vi.mocked(prisma.worker.findUnique).mockResolvedValue(mockWorker as any);

      const req = new NextRequest('http://localhost:3002/api/workers/w-1', {
        method: 'PUT',
        body: JSON.stringify({ siteId: 'site-new-capital' }), // Attempting unauthorized site transfer
      });
      const res = await updateWorker(req, { params: Promise.resolve({ id: 'w-1' }) });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('غير مصرح لك بنقل العامل إلى موقع آخر');
    });

    it('PUT /api/workers/[id] forbids non-SUPER_ADMIN from modifying compensation fields', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'u-1',
        telegramId: '1001',
        role: 'GENERAL_ADMIN',
        name: 'مدير عام تنفيذي',
        isRealSuperAdmin: false,
      } as any);

      vi.mocked(prisma.worker.findUnique).mockResolvedValue(mockWorker as any);

      const req = new NextRequest('http://localhost:3002/api/workers/w-1', {
        method: 'PUT',
        body: JSON.stringify({ basicSalary: 12000 }),
      });
      const res = await updateWorker(req, { params: Promise.resolve({ id: 'w-1' }) });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('تعديل الرواتب والمستحقات التعاقدية مقصور حصرياً على مدير عام المنظومة');
    });
  });

  // =========================================================================
  // 2. Phone Blind Index Synchronization & Atomic Transaction
  // =========================================================================
  describe('2. Phone Blind Index Synchronization in Worker Update', () => {
    const mockWorker = {
      id: 'w-1',
      code: 'WRK-001',
      name: 'أحمد إبراهيم علي',
      nickname: 'أبو حميد',
      phoneEncrypted: 'mock-encrypted-phone',
      nationalIdEncrypted: 'mock-encrypted-nid',
      siteId: 'site-alamein',
      status: 'ACTIVE',
      isDeleted: false,
    };

    it('PUT /api/workers/[id] updates phoneEncrypted AND phoneBlindIndex atomically within transaction', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'u-super',
        telegramId: '999999',
        role: 'SUPER_ADMIN',
        name: 'سوبر أدمن',
        isRealSuperAdmin: true,
      } as any);

      vi.mocked(prisma.worker.findUnique).mockResolvedValue(mockWorker as any);

      let txWorkerUpdateData: any = null;
      let txAuditLogData: any = null;

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          worker: {
            update: vi.fn().mockImplementation(async (args) => {
              txWorkerUpdateData = args.data;
              return { id: 'w-1', ...args.data };
            }),
          },
          auditLog: {
            create: vi.fn().mockImplementation(async (args) => {
              txAuditLogData = args.data;
              return { id: 'log-1' };
            }),
          },
        };
        return callback(tx);
      });

      const inputPhone = ' 010 1234 5678 ';
      const req = new NextRequest('http://localhost:3002/api/workers/w-1', {
        method: 'PUT',
        body: JSON.stringify({ phone: inputPhone }),
      });

      const res = await updateWorker(req, { params: Promise.resolve({ id: 'w-1' }) });

      expect(res.status).toBe(200);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      // Verify phoneEncrypted and phoneBlindIndex both populated
      expect(txWorkerUpdateData).toBeDefined();
      expect(txWorkerUpdateData.phoneEncrypted).toBeDefined();
      expect(txWorkerUpdateData.phoneBlindIndex).toBeDefined();

      // Blind index must match deterministic HMAC of cleaned phone
      const cleanPhone = '01012345678';
      const salt = process.env.BLIND_INDEX_SECRET || process.env.DATABASE_ENCRYPTION_KEY;
      expect(salt).toBeDefined();
      const expectedBlindIndex = createBlindIndex(cleanPhone, salt!);
      expect(txWorkerUpdateData.phoneBlindIndex).toBe(expectedBlindIndex);

      // Verify audit log captured inside the transaction
      expect(txAuditLogData).toBeDefined();
      expect(txAuditLogData.action).toBe('WORKER_UPDATED');
      expect(txAuditLogData.entityId).toBe('w-1');
      expect(txAuditLogData.afterPayload.updatedFields).toContain('phoneBlindIndex');
      expect(txAuditLogData.afterPayload.updatedFields).toContain('phoneEncrypted');
    });

    it('PUT /api/workers/[id] throws an error if both BLIND_INDEX_SECRET and DATABASE_ENCRYPTION_KEY are missing', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'u-super',
        telegramId: '999999',
        role: 'SUPER_ADMIN',
        name: 'سوبر أدمن',
        isRealSuperAdmin: true,
      } as any);

      vi.mocked(prisma.worker.findUnique).mockResolvedValue(mockWorker as any);

      const oldSecret = process.env.BLIND_INDEX_SECRET;
      const oldKey = process.env.DATABASE_ENCRYPTION_KEY;
      delete process.env.BLIND_INDEX_SECRET;
      delete process.env.DATABASE_ENCRYPTION_KEY;

      const req = new NextRequest('http://localhost:3002/api/workers/w-1', {
        method: 'PUT',
        body: JSON.stringify({ phone: '01012345678' }),
      });

      await expect(updateWorker(req, { params: Promise.resolve({ id: 'w-1' }) })).rejects.toThrow(
        'Missing BLIND_INDEX_SECRET or DATABASE_ENCRYPTION_KEY'
      );

      process.env.BLIND_INDEX_SECRET = oldSecret;
      process.env.DATABASE_ENCRYPTION_KEY = oldKey;
    });
  });

  // =========================================================================
  // 3. Skeletons and Suspense SSR Verification
  // =========================================================================
  describe('3. Loading Skeletons & Suspense SSR Integrity', () => {
    it('AdminRootLoading renders standard skeleton elements with aria-busy', () => {
      const html = renderToString(React.createElement(AdminRootLoading));
      expect(html).toContain('animate-pulse');
      expect(html).toContain('aria-busy="true"');
    });

    it('WorkforceLoading renders workforce directory skeletons', () => {
      const html = renderToString(React.createElement(WorkforceLoading));
      expect(html).toContain('animate-pulse');
      expect(html).toContain('aria-busy="true"');
    });

    it('SettingsLoading renders settings cards grid skeletons', () => {
      const html = renderToString(React.createElement(SettingsLoading));
      expect(html).toContain('animate-pulse');
      expect(html).toContain('aria-busy="true"');
    });

    it('ApprovalsLoading renders approvals cards and table skeletons', () => {
      const html = renderToString(React.createElement(ApprovalsLoading));
      expect(html).toContain('animate-pulse');
      expect(html).toContain('aria-busy="true"');
    });

    it('TelemetryLoading renders APM metric cards and chart skeletons', () => {
      const html = renderToString(React.createElement(TelemetryLoading));
      expect(html).toContain('animate-pulse');
      expect(html).toContain('aria-busy="true"');
    });

    it('settings/telemetry/page.tsx utilizes React.Suspense with TelemetryLoading fallback', () => {
      const pagePath = path.resolve(__dirname, '../src/app/admin/settings/telemetry/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf8');
      expect(content).toContain('Suspense');
      expect(content).toContain('TelemetryLoading');
    });

    it('approvals/page.tsx utilizes React.Suspense with ApprovalsLoading fallback', () => {
      const pagePath = path.resolve(__dirname, '../src/app/admin/approvals/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf8');
      expect(content).toContain('Suspense');
      expect(content).toContain('ApprovalsLoading');
    });
  });
});
