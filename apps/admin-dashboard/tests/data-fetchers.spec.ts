import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import {
  getWorkforceDirectory,
  getSitesHub,
  getJobMatrixData,
  getClearancesData,
  getUsersManagementData,
  getAuditVaultData,
  getCompanyProfileData,
  getOverviewKpis,
  getNormalizedEncryptionKey,
} from '../src/lib/data-fetchers';
import { ZeroStateCard, type ZeroStateCardProps } from '../src/components/ui/zero-state-card';
import type { DashboardUser } from '../src/lib/rbac';
import { encryptField } from '@alsaada/database';

// Mock the database client
vi.mock('@alsaada/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@alsaada/database')>();
  return {
    ...actual,
    prisma: {
      worker: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      site: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      jobTitle: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      workerClearance: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      disciplinaryAndBonus: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      auditLog: {
        findMany: vi.fn(),
      },
      companyProfile: {
        findFirst: vi.fn(),
      },
      botPerformanceLog: {
        aggregate: vi.fn(),
        findMany: vi.fn(),
      },
      systemErrorLog: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
    },
  };
});

// Import the mocked prisma instance
import { prisma } from '@alsaada/database';

describe('ZeroStateCard Component Contract (Milestone 3)', () => {
  const DummyIcon = (props: React.SVGProps<SVGSVGElement>) =>
    React.createElement('svg', { ...props, 'data-testid': 'dummy-icon' });

  it('instantiates cleanly with required props and default styling', () => {
    const props: ZeroStateCardProps = {
      icon: DummyIcon,
      title: 'لا توجد بيانات متاحة',
      description: 'لم يتم العثور على أي سجلات في هذا القسم حالياً',
    };

    const element = ZeroStateCard(props);
    expect(element).toBeDefined();
    expect(element.type).toBe('div');
    expect(element.props['data-testid']).toBe('zero-state-card');
  });

  it('supports action button and onResetFilter callback', () => {
    const handleReset = vi.fn();
    const props: ZeroStateCardProps = {
      icon: DummyIcon,
      title: 'لا توجد نتائج مطابقة',
      description: 'جرّب تعديل معايير البحث',
      actionText: 'إضافة سجل جديد',
      actionHref: '/admin/workforce/new',
      onResetFilter: handleReset,
    };

    const element = ZeroStateCard(props);
    expect(element).toBeDefined();

    // Verify children contains buttons container
    const children = React.Children.toArray(element.props.children);
    const actionContainer = children.find(
      (c: any) => c && c.props && c.props.className && c.props.className.includes('justify-center')
    ) as React.ReactElement<any>;

    expect(actionContainer).toBeDefined();
  });
});

describe('Server-Side Data Fetchers SSOT (Milestone 3)', () => {
  const testKeyHex = getNormalizedEncryptionKey();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. getWorkforceDirectory
  // --------------------------------------------------------------------------
  describe('getWorkforceDirectory', () => {
    const encryptedPhone = encryptField('01012345678', testKeyHex);
    const encryptedNationalId = encryptField('29801011234567', testKeyHex);

    const mockWorkers = [
      {
        id: 'worker-01',
        code: 'OP-DRV-001',
        name: 'علي حسن محمود الجزار',
        nickname: 'أبو علي',
        dailyWage: 450,
        status: 'ACTIVE',
        phoneEncrypted: encryptedPhone,
        nationalIdEncrypted: encryptedNationalId,
        telegramId: BigInt(123456789),
        site: { id: 'site-alpha', name: 'مشروع العاصمة الإدارية' },
        jobRef: { id: 'job-drv', name: 'سائق لودر' },
        jobTitle: 'سائق لودر',
        user: null,
      },
      {
        id: 'worker-02',
        code: 'OP-HLP-002',
        name: 'محمود أحمد شحاتة',
        nickname: null,
        dailyWage: 300,
        status: 'BLACKLISTED',
        phoneEncrypted: null,
        nationalIdEncrypted: null,
        telegramId: null,
        site: null,
        jobRef: null,
        jobTitle: 'عامل مساعد',
        user: null,
      },
    ];

    it('scopes query to assignedSiteId for FIELD_ADMIN and PROJECT_MANAGER', async () => {
      vi.mocked(prisma.worker.findMany).mockResolvedValueOnce(mockWorkers as any);

      const fieldUser: DashboardUser = {
        id: 'usr-fa',
        name: 'مشرف الموقع',
        role: 'FIELD_ADMIN',
        assignedSiteId: 'site-alpha',
      };

      const result = await getWorkforceDirectory(fieldUser);

      expect(prisma.worker.findMany).toHaveBeenCalledWith({
        where: { isDeleted: false, siteId: 'site-alpha' },
        include: { site: true, jobRef: true, user: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
    });

    it('does not filter by siteId for SUPER_ADMIN or EXECUTIVE_DIRECTOR', async () => {
      vi.mocked(prisma.worker.findMany).mockResolvedValueOnce(mockWorkers as any);

      const superUser: DashboardUser = {
        id: 'usr-sa',
        name: 'السوبر أدمن',
        role: 'SUPER_ADMIN',
      };

      await getWorkforceDirectory(superUser);

      expect(prisma.worker.findMany).toHaveBeenCalledWith({
        where: { isDeleted: false },
        include: { site: true, jobRef: true, user: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('masks dailyWage for FIELD_ADMIN and reveals it for SUPER_ADMIN and ACCOUNTANT', async () => {
      vi.mocked(prisma.worker.findMany).mockResolvedValue(mockWorkers as any);

      const fieldUser: DashboardUser = {
        id: 'usr-fa',
        name: 'مشرف الموقع',
        role: 'FIELD_ADMIN',
        assignedSiteId: 'site-alpha',
      };
      const fieldResult = await getWorkforceDirectory(fieldUser);
      expect(fieldResult[0].dailyWage).toBeUndefined();

      const generalAdminUser: DashboardUser = {
        id: 'usr-ga',
        name: 'المدير العام',
        role: 'GENERAL_ADMIN',
      };
      const gaResult = await getWorkforceDirectory(generalAdminUser);
      expect(gaResult[0].dailyWage).toBe(450);
    });

    it('resolves nickname correctly falling back to full name', async () => {
      vi.mocked(prisma.worker.findMany).mockResolvedValueOnce(mockWorkers as any);

      const superUser: DashboardUser = { id: 'usr-sa', name: 'Admin', role: 'SUPER_ADMIN' };
      const result = await getWorkforceDirectory(superUser);

      expect(result[0].nickname).toBe('أبو علي');
      expect(result[1].nickname).toBe('محمود أحمد شحاتة');
    });

    it('masks national ID to **********XXXX and supports BLACKLISTED status', async () => {
      vi.mocked(prisma.worker.findMany).mockResolvedValueOnce(mockWorkers as any);

      const superUser: DashboardUser = { id: 'usr-sa', name: 'Admin', role: 'SUPER_ADMIN' };
      const result = await getWorkforceDirectory(superUser);

      // National ID last 4 digits: '4567'
      expect(result[0].nationalIdMasked).toMatch(/\*{10}\d{4}/);
      expect(result[1].status).toBe('BLACKLISTED');
      expect(result[0].status).toBe('ACTIVE');
    });
  });

  // --------------------------------------------------------------------------
  // 2. getSitesHub
  // --------------------------------------------------------------------------
  describe('getSitesHub', () => {
    const mockSites = [
      {
        id: 'site-01',
        name: 'مشروع توشكى الزراعي',
        code: 'STE-TSK',
        status: 'ACTIVE',
        governorateCode: '88',
        project: { name: 'استصلاح توشكى المرحلة الأولى' },
        workers: [{ id: 'w1' }, { id: 'w2' }, { id: 'w3' }],
        users: [
          { id: 'u1', fullName: 'م. أحمد الشامي', role: 'PROJECT_MANAGER' as any },
          { id: 'u2', fullName: 'عصام عبد الله', role: 'FIELD_ADMIN' },
        ],
      },
    ];

    it('scopes site query for field roles and aggregates supervisors and active workers', async () => {
      vi.mocked(prisma.site.findMany).mockResolvedValueOnce(mockSites as any);

      const fieldUser: DashboardUser = {
        id: 'usr-fa',
        name: 'مدير الموقع',
        role: 'FIELD_ADMIN',
        assignedSiteId: 'site-01',
      };

      const result = await getSitesHub(fieldUser);

      expect(prisma.site.findMany).toHaveBeenCalledWith({
        where: { id: 'site-01' },
        include: {
          workers: { where: { isDeleted: false, status: 'ACTIVE' }, select: { id: true } },
          users: { where: { isDeleted: false }, select: { id: true, fullName: true, role: true } },
          project: true,
        },
        orderBy: { name: 'asc' },
      });

      expect(result[0].workersCount).toBe(3);
      expect(result[0].assignedSupervisors).toContain('م. أحمد الشامي (PROJECT_MANAGER)');
      expect(result[0].assignedSupervisors).toContain('عصام عبد الله (FIELD_ADMIN)');
      expect(result[0].location).toBe('استصلاح توشكى المرحلة الأولى');
    });
  });

  // --------------------------------------------------------------------------
  // 3. getJobMatrixData
  // --------------------------------------------------------------------------
  describe('getJobMatrixData', () => {
    const mockJobs = [
      {
        id: 'job-01',
        code: 'DRV',
        name: 'سائق لودر',
        baseSalary: 7000,
        additionalSalary: 2000,
        baseWageGuideline: 350,
        department: { name: 'إدارة المعدات والتشغيل', order: 1 },
        workers: [{ id: 'w1' }, { id: 'w2' }],
      },
    ];

    it('queries active jobs ordered by department and calculates wage boundaries', async () => {
      vi.mocked(prisma.jobTitle.findMany).mockResolvedValueOnce(mockJobs as any);

      const result = await getJobMatrixData();

      expect(prisma.jobTitle.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: {
          department: true,
          workers: { where: { isDeleted: false, status: 'ACTIVE' }, select: { id: true } },
        },
        orderBy: [{ department: { order: 'asc' } }, { code: 'asc' }],
      });

      expect(result[0].title).toBe('سائق لودر');
      expect(result[0].category).toBe('إدارة المعدات والتشغيل');
      expect(result[0].minDailyWage).toBe(350);
      expect(result[0].maxDailyWage).toBe(9000);
      expect(result[0].workersCount).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // 4. getClearancesData
  // --------------------------------------------------------------------------
  describe('getClearancesData', () => {
    const mockClearances = [
      {
        id: 'clr-01',
        clearanceNumber: '#CLR-2026-001',
        serviceDurationDays: 145,
        settledAt: new Date('2026-09-01T10:00:00Z'),
        netSettlementAmount: 5400,
        status: 'APPROVED',
        worker: {
          code: 'OP-DRV-001',
          name: 'علي الجزار',
          nickname: 'أبو علي',
          site: { name: 'مشروع الفرافرة' },
        },
      },
    ];

    const mockDecisions = [
      {
        id: 'dec-01',
        type: 'BONUS_CASH',
        amount: 500,
        daysEquivalent: null,
        reason: 'مكافأة عمل إضافي طارئ',
        createdAt: new Date('2026-09-05T12:00:00Z'),
        worker: {
          code: 'OP-HLP-002',
          name: 'سيد بندق',
          nickname: null,
        },
      },
      {
        id: 'dec-02',
        type: 'PENALTY_DAYS',
        amount: null,
        daysEquivalent: 2,
        reason: 'خصم غياب غير مبرر',
        createdAt: new Date('2026-09-06T12:00:00Z'),
        worker: {
          code: 'OP-HLP-003',
          name: 'حمادة الصعيدي',
          nickname: 'حمادة',
        },
      },
    ];

    it('scopes clearance queries to worker.siteId for field roles', async () => {
      vi.mocked(prisma.workerClearance.findMany).mockResolvedValueOnce(mockClearances as any);
      vi.mocked(prisma.disciplinaryAndBonus.findMany).mockResolvedValueOnce(mockDecisions as any);

      const fieldUser: DashboardUser = {
        id: 'usr-fa',
        name: 'مشرف الموقع',
        role: 'FIELD_ADMIN',
        assignedSiteId: 'site-farfra',
      };

      const result = await getClearancesData(fieldUser);

      expect(prisma.workerClearance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { worker: { siteId: 'site-farfra' } },
        })
      );
      expect(prisma.disciplinaryAndBonus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { approvedByUserId: null, worker: { siteId: 'site-farfra' } },
        })
      );

      expect(result.clearances[0].voucherId).toBe('#CLR-2026-001');
      expect(result.clearances[0].workerName).toBe('أبو علي');
      expect(result.decisions[0].type).toBe('BONUS');
      expect(result.decisions[0].amountOrDays).toBe('500 ج.م');
      expect(result.decisions[1].type).toBe('PENALTY');
      expect(result.decisions[1].amountOrDays).toBe('2 أيام');
    });
  });

  // --------------------------------------------------------------------------
  // 5. getUsersManagementData
  // --------------------------------------------------------------------------
  describe('getUsersManagementData', () => {
    const mockUsers = [
      {
        id: 'usr-01',
        fullName: 'صالح عثمان',
        telegramId: BigInt(987654321),
        role: 'SUPER_ADMIN',
        isActive: true,
        isBanned: false,
        assignedSite: null,
        updatedAt: new Date('2026-09-10T14:30:00Z'),
        worker: null,
      },
      {
        id: 'usr-02',
        fullName: 'حساب موقوف',
        telegramId: BigInt(11223344),
        role: 'FIELD_ADMIN',
        isActive: false,
        isBanned: true,
        assignedSite: { name: 'موقع توشكى' },
        updatedAt: new Date('2026-09-08T10:00:00Z'),
        worker: null,
      },
    ];

    it('queries active non-deleted users and formats status and site', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce(mockUsers as any);

      const result = await getUsersManagementData();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { isDeleted: false },
        include: { worker: true, assignedSite: true },
        orderBy: { createdAt: 'desc' },
      });

      expect(result[0].status).toBe('ACTIVE');
      expect(result[0].assignedSite).toBe('كافة المواقع والمشاريع');
      expect(result[1].status).toBe('REVOKED');
      expect(result[1].assignedSite).toBe('موقع توشكى');
    });
  });

  // --------------------------------------------------------------------------
  // 6. getAuditVaultData
  // --------------------------------------------------------------------------
  describe('getAuditVaultData', () => {
    const mockLogs = [
      {
        id: 'aud-001-uuid-1234567890',
        actorTelegramId: BigInt(987654321),
        action: 'UPDATE',
        entityType: 'Worker',
        entityId: 'worker-01',
        beforePayload: { dailyWage: 400 },
        afterPayload: { dailyWage: 450 },
        timestamp: new Date('2026-09-11T12:00:00Z'),
      },
    ];

    it('fetches latest 50 audit logs ordered by timestamp desc', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce(mockLogs as any);

      const result = await getAuditVaultData();

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        orderBy: { timestamp: 'desc' },
        take: 50,
      });

      expect(result[0].tableName).toBe('Worker');
      expect(result[0].performedBy).toBe('987654321');
      expect(result[0].previousValues).toContain('400');
      expect(result[0].newValues).toContain('450');
    });
  });

  // --------------------------------------------------------------------------
  // 7. getCompanyProfileData
  // --------------------------------------------------------------------------
  describe('getCompanyProfileData', () => {
    it('returns official profile details when record exists', async () => {
      vi.mocked(prisma.companyProfile.findFirst).mockResolvedValueOnce({
        id: 'cp-01',
        legalName: 'شركة السعادة للمقاولات العامة',
        tradeName: 'السعادة للتشييد والبناء',
        commercialRegistrationNumber: 'CR-998877',
        taxRegistrationNumber: 'TR-112233',
        headquartersAddress: 'التجمع الخامس — القاهرة',
        baseCurrency: 'EGP',
      } as any);

      const result = await getCompanyProfileData();

      expect(result.legalName).toBe('شركة السعادة للمقاولات العامة');
      expect(result.crNumber).toBe('CR-998877');
      expect(result.status).toContain('موثق');
    });

    it('returns official fallback defaults when database record is null', async () => {
      vi.mocked(prisma.companyProfile.findFirst).mockResolvedValueOnce(null);

      const result = await getCompanyProfileData();

      expect(result.legalName).toContain('السعادة');
      expect(result.crNumber).toBe('CR-104829');
      expect(result.taxNumber).toBe('TR-492-810-332');
    });
  });

  // --------------------------------------------------------------------------
  // 8. getOverviewKpis
  // --------------------------------------------------------------------------
  describe('getOverviewKpis', () => {
    it('aggregates live counts and APM latency with field scoping', async () => {
      vi.mocked(prisma.worker.count).mockResolvedValueOnce(85);
      vi.mocked(prisma.site.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.workerClearance.count).mockResolvedValueOnce(2);
      vi.mocked(prisma.disciplinaryAndBonus.count).mockResolvedValueOnce(3);
      vi.mocked(prisma.botPerformanceLog.aggregate).mockResolvedValueOnce({
        _avg: { executionTimeMs: 12.6 },
      } as any);

      const fieldUser: DashboardUser = {
        id: 'usr-fa',
        name: 'مشرف الموقع',
        role: 'FIELD_ADMIN',
        assignedSiteId: 'site-alpha',
      };

      const result = await getOverviewKpis(fieldUser);

      expect(prisma.worker.count).toHaveBeenCalledWith({
        where: { isDeleted: false, status: 'ACTIVE', siteId: 'site-alpha' },
      });
      expect(result.activeWorkersCount).toBe(85);
      expect(result.activeSitesCount).toBe(1);
      expect(result.pendingItemsCount).toBe(5); // 2 clearances + 3 decisions
      expect(result.avgLatencyMs).toBe(13);
    });
  });
});
