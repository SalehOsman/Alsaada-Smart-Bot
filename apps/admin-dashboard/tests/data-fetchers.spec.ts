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
  getApmTelemetryData,
  resolveHumanAction,
  getModuleAnalyticsData,
  calculatePercentile,
  clearApmCache,
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
        count: vi.fn(),
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
      advanceRequest: {
        findMany: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
      },
      financialCustody: {
        findMany: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
      },
      canteenItem: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      equipment: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      financialLedger: {
        findMany: vi.fn(),
        aggregate: vi.fn(),
      },
      workerCommitmentScore: {
        aggregate: vi.fn(),
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
    clearApmCache();
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

  // --------------------------------------------------------------------------
  // 9. resolveHumanAction & getApmTelemetryData
  // --------------------------------------------------------------------------
  describe('resolveHumanAction', () => {
    it('translates technical telegram actions to user-friendly Arabic triggers', () => {
      expect(resolveHumanAction('photo:upload')).toContain('رفع صورة');
      expect(resolveHumanAction('cb:act:wdoc:cat:NATIONAL_ID')).toContain('بطاقة الرقم القومي');
      expect(resolveHumanAction('cb:act:wdoc:cat:PASSPORT')).toContain('جواز السفر');
      expect(resolveHumanAction('cb:act:wdoc:cat:WORK_PERMIT')).toContain('تصريح العمل');
      expect(resolveHumanAction('msg:/boost')).toContain('/boost');
      expect(resolveHumanAction('cb:action:worker:profile:worker-123')).toContain('الملف الشامل للعامل');
      expect(resolveHumanAction('cb:action:main_menu')).toContain('العودة للقائمة الرئيسية');
    });

    it('handles unknown or empty actions gracefully', () => {
      expect(resolveHumanAction('')).toBe('غير محدد');
      expect(resolveHumanAction('unknown_custom_trigger')).toBe('unknown_custom_trigger');
    });
  });

  describe('getApmTelemetryData', () => {
    it('returns default empty view model when no performance logs exist', async () => {
      vi.mocked(prisma.botPerformanceLog.findMany).mockResolvedValueOnce([]);

      const result = await getApmTelemetryData();

      expect(result.totalOps).toBe(0);
      expect(result.avgLatencyMs).toBe(0);
      expect(result.avgInternalLatencyMs).toBe(0);
      expect(result.avgNetworkLatencyMs).toBe(0);
      expect(result.cacheHitRatio).toBe(0);
      expect(result.fastOpsPct).toBe(100);
      expect(result.acceptableOpsPct).toBe(0);
      expect(result.slowOpsPct).toBe(0);
      expect(result.fastOpsPct + result.acceptableOpsPct + result.slowOpsPct).toBe(100);
      expect(result.slowestOps).toEqual([]);
      expect(result.latestOps).toEqual([]);
    });

    it('correctly aggregates speed metrics, latest 10 ops, and slowest 5 ops', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          callbackQueryOrCommand: 'photo:upload',
          executionTimeMs: 18500,
          internalExecutionTimeMs: 25,
          telegramNetworkTimeMs: 18475,
          performanceTier: 'RED_SLOW',
          cacheSource: 'DB_QUERY',
          actorTelegramId: BigInt(111),
          timestamp: new Date('2026-09-16T10:00:00Z'),
        },
        {
          id: 'log-2',
          callbackQueryOrCommand: 'cb:act:wdoc:cat:NATIONAL_ID',
          executionTimeMs: 18,
          internalExecutionTimeMs: 18,
          telegramNetworkTimeMs: 0,
          performanceTier: 'GREEN_FAST',
          cacheSource: 'L1_RAM_CACHE',
          actorTelegramId: BigInt(222),
          timestamp: new Date('2026-09-16T10:05:00Z'),
        },
        {
          id: 'log-3',
          callbackQueryOrCommand: 'cb:action:main_menu',
          executionTimeMs: 85,
          internalExecutionTimeMs: 20,
          telegramNetworkTimeMs: 65,
          performanceTier: 'YELLOW_ACCEPTABLE',
          cacheSource: 'REDIS_CACHE',
          actorTelegramId: BigInt(333),
          timestamp: new Date('2026-09-16T10:10:00Z'),
        },
      ];

      vi.mocked(prisma.botPerformanceLog.findMany).mockResolvedValueOnce(mockLogs as any);

      const result = await getApmTelemetryData();

      expect(result.totalOps).toBe(3);
      expect(result.avgLatencyMs).toBe(6201);
      expect(result.avgInternalLatencyMs).toBe(21);
      expect(result.avgNetworkLatencyMs).toBe(6180);
      expect(result.cacheHitRatio).toBe(67);
      expect(result.fastOpsPct).toBe(33);
      expect(result.acceptableOpsPct).toBe(33);
      expect(result.slowOpsPct).toBe(34);
      expect(result.fastOpsPct + result.acceptableOpsPct + result.slowOpsPct).toBe(100);

      expect(result.latestOps).toHaveLength(3);
      expect(result.latestOps[0].action).toBe('photo:upload');
      expect(result.latestOps[0].humanAction).toContain('رفع صورة');
      expect(result.latestOps[0].internalTimeMs).toBe(25);
      expect(result.latestOps[0].networkTimeMs).toBe(18475);
      expect(result.latestOps[1].humanAction).toContain('بطاقة الرقم القومي');

      // Slowest ops should sort descending
      expect(result.slowestOps[0].action).toBe('photo:upload');
      expect(result.slowestOps[0].timeMs).toBe(18500);
      expect(result.slowestOps[1].timeMs).toBe(85);
      expect(result.slowestOps[2].timeMs).toBe(18);
    });

    it('strictly enforces mathematical invariant (sum to 100%) and eliminates double-counting bug', async () => {
      const syntheticLogs = Array.from({ length: 500 }, (_, i) => {
        const isGreen = i < 350;
        const isYellow = i >= 350 && i < 450;
        return {
          id: `log-${i}`,
          callbackQueryOrCommand: `cb:action:btn_${i % 10}`,
          executionTimeMs: 980,
          internalExecutionTimeMs: 13,
          telegramNetworkTimeMs: 967,
          performanceTier: isGreen ? 'GREEN_FAST' : isYellow ? 'YELLOW_ACCEPTABLE' : 'RED_SLOW',
          cacheSource: isGreen ? 'L1_RAM_CACHE' : isYellow ? 'REDIS_CACHE' : 'DB_QUERY',
          actorTelegramId: BigInt(1000 + i),
          timestamp: new Date('2026-09-16T12:00:00Z'),
        };
      });

      vi.mocked(prisma.botPerformanceLog.findMany).mockResolvedValueOnce(syntheticLogs as any);

      const result = await getApmTelemetryData();

      expect(result.totalOps).toBe(500);
      expect(result.avgInternalLatencyMs).toBe(13);
      expect(result.avgNetworkLatencyMs).toBe(967);
      expect(result.avgLatencyMs).toBe(980);
      expect(result.cacheHitRatio).toBe(90);

      expect(result.fastOpsPct).toBe(70);
      expect(result.acceptableOpsPct).toBe(20);
      expect(result.slowOpsPct).toBe(10);
      expect(result.fastOpsPct + result.acceptableOpsPct + result.slowOpsPct).toBe(100);
    });

    it('gracefully handles database errors in catch block returning safe defaults with 100% invariant', async () => {
      vi.mocked(prisma.botPerformanceLog.findMany).mockRejectedValueOnce(new Error('Connection timeout'));

      const result = await getApmTelemetryData();

      expect(result.totalOps).toBe(0);
      expect(result.avgLatencyMs).toBe(0);
      expect(result.avgInternalLatencyMs).toBe(0);
      expect(result.avgNetworkLatencyMs).toBe(0);
      expect(result.cacheHitRatio).toBe(0);
      expect(result.fastOpsPct).toBe(100);
      expect(result.acceptableOpsPct).toBe(0);
      expect(result.slowOpsPct).toBe(0);
      expect(result.fastOpsPct + result.acceptableOpsPct + result.slowOpsPct).toBe(100);
      expect(result.slowestOps).toEqual([]);
      expect(result.latestOps).toEqual([]);
    });

    it('guarantees 100% algebraic closure on fractional rounding edge cases (e.g. 0.5 rounding boundaries)', async () => {
      // 200 logs: 1 green (0.5%), 199 yellow (99.5%), 0 red (0%)
      // Without capping, Math.round(0.5)=1 and Math.round(99.5)=100 sum to 101%
      const boundaryLogs = Array.from({ length: 200 }, (_, i) => ({
        id: `boundary-${i}`,
        callbackQueryOrCommand: 'cb:action:btn',
        executionTimeMs: 100,
        internalExecutionTimeMs: 12,
        telegramNetworkTimeMs: 88,
        performanceTier: i === 0 ? 'GREEN_FAST' : 'YELLOW_ACCEPTABLE',
        cacheSource: 'L1_RAM_CACHE',
        actorTelegramId: BigInt(2000 + i),
        timestamp: new Date('2026-09-16T12:00:00Z'),
      }));

      vi.mocked(prisma.botPerformanceLog.findMany).mockResolvedValueOnce(boundaryLogs as any);

      const result = await getApmTelemetryData();

      expect(result.totalOps).toBe(200);
      expect(result.fastOpsPct + result.acceptableOpsPct + result.slowOpsPct).toBe(100);
      expect(result.fastOpsPct).toBe(1);
      expect(result.acceptableOpsPct).toBe(99);
      expect(result.slowOpsPct).toBe(0);
    });

    it('calculatePercentile calculates accurate nearest-rank percentiles', () => {
      expect(calculatePercentile([], 50)).toBe(0);
      expect(calculatePercentile([42], 50)).toBe(42);
      expect(calculatePercentile([42], 95)).toBe(42);

      const items = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
      expect(calculatePercentile(items, 50)).toBe(50);
      expect(calculatePercentile(items, 95)).toBe(95);

      const latencies = [5, 8, 12, 15, 20];
      expect(calculatePercentile(latencies, 50)).toBe(12);
      expect(calculatePercentile(latencies, 95)).toBe(20);
    });

    it('calculates P50, P95, and RPM for internal and network latencies with dual 100% distribution closures', async () => {
      const logs = [
        {
          id: 'l1',
          callbackQueryOrCommand: 'cb:action:workers_list',
          executionTimeMs: 250,
          internalExecutionTimeMs: 10,
          telegramNetworkTimeMs: 240,
          performanceTier: 'GREEN_FAST',
          cacheSource: 'L1_RAM_CACHE',
          actorTelegramId: BigInt(100),
          timestamp: new Date('2026-09-17T10:00:00Z'),
        },
        {
          id: 'l2',
          callbackQueryOrCommand: 'cb:action:workers_list',
          executionTimeMs: 400,
          internalExecutionTimeMs: 14,
          telegramNetworkTimeMs: 386,
          performanceTier: 'GREEN_FAST',
          cacheSource: 'L1_RAM_CACHE',
          actorTelegramId: BigInt(101),
          timestamp: new Date('2026-09-17T10:01:00Z'),
        },
        {
          id: 'l3',
          callbackQueryOrCommand: 'cb:action:profile',
          executionTimeMs: 850,
          internalExecutionTimeMs: 35,
          telegramNetworkTimeMs: 815,
          performanceTier: 'YELLOW_ACCEPTABLE',
          cacheSource: 'REDIS_CACHE',
          actorTelegramId: BigInt(102),
          timestamp: new Date('2026-09-17T10:02:00Z'),
        },
        {
          id: 'l4',
          callbackQueryOrCommand: 'photo:upload',
          executionTimeMs: 2500,
          internalExecutionTimeMs: 65,
          telegramNetworkTimeMs: 2435,
          performanceTier: 'RED_SLOW',
          cacheSource: 'DB_QUERY',
          actorTelegramId: BigInt(103),
          timestamp: new Date('2026-09-17T10:03:00Z'),
        },
      ];

      vi.mocked(prisma.botPerformanceLog.findMany).mockResolvedValueOnce(logs as any);

      const result = await getApmTelemetryData();

      expect(result.totalOps).toBe(4);
      // P50 and P95 checks
      expect(result.p50InternalLatencyMs).toBe(14);
      expect(result.p95InternalLatencyMs).toBe(65);
      expect(result.p50NetworkLatencyMs).toBe(386);
      expect(result.p95NetworkLatencyMs).toBe(2435);
      expect(result.rpm).toBeGreaterThan(0);

      // Dual 100% closures
      expect(result.fastInternalOpsPct + result.acceptableInternalOpsPct + result.slowInternalOpsPct).toBe(100);
      expect(result.fastNetworkOpsPct + result.normalNetworkOpsPct + result.slowNetworkOpsPct).toBe(100);
      expect(result.fastOpsPct + result.acceptableOpsPct + result.slowOpsPct).toBe(100);

      // Aggregated actions
      expect(result.aggregatedActions).toHaveLength(3);
      const workersAction = result.aggregatedActions.find((a) => a.action === 'cb:action:workers_list');
      expect(workersAction).toBeDefined();
      expect(workersAction?.count).toBe(2);
      expect(workersAction?.p50InternalMs).toBe(10);
      expect(workersAction?.p95InternalMs).toBe(14);
    });

    it('correctly identifies topFrequentAction and topDelayedNetworkAction outliers', async () => {
      const logs = [
        {
          id: 'o1',
          callbackQueryOrCommand: 'cb:action:workers_list',
          executionTimeMs: 210,
          internalExecutionTimeMs: 10,
          telegramNetworkTimeMs: 200,
          performanceTier: 'GREEN_FAST',
          cacheSource: 'L1_RAM_CACHE',
          actorTelegramId: BigInt(100),
          timestamp: new Date('2026-09-17T10:00:00Z'),
        },
        {
          id: 'o2',
          callbackQueryOrCommand: 'cb:action:workers_list',
          executionTimeMs: 215,
          internalExecutionTimeMs: 11,
          telegramNetworkTimeMs: 204,
          performanceTier: 'GREEN_FAST',
          cacheSource: 'L1_RAM_CACHE',
          actorTelegramId: BigInt(101),
          timestamp: new Date('2026-09-17T10:01:00Z'),
        },
        {
          id: 'o3',
          callbackQueryOrCommand: 'photo:heavy_ocr',
          executionTimeMs: 15000,
          internalExecutionTimeMs: 25,
          telegramNetworkTimeMs: 14975,
          performanceTier: 'RED_SLOW',
          cacheSource: 'DB_QUERY',
          actorTelegramId: BigInt(102),
          timestamp: new Date('2026-09-17T10:02:00Z'),
        },
      ];

      vi.mocked(prisma.botPerformanceLog.findMany).mockResolvedValueOnce(logs as any);

      const result = await getApmTelemetryData();

      expect(result.topFrequentAction).not.toBeNull();
      expect(result.topFrequentAction?.action).toBe('cb:action:workers_list');
      expect(result.topFrequentAction?.count).toBe(2);

      expect(result.topDelayedNetworkAction).not.toBeNull();
      expect(result.topDelayedNetworkAction?.action).toBe('photo:heavy_ocr');
      expect(result.topDelayedNetworkAction?.latencyMs).toBe(14975);
    });

    it('cleanly segments legacy logs where internalExecutionTimeMs is null without distorting metrics', async () => {
      const legacyLogs = [
        {
          id: 'leg-1',
          callbackQueryOrCommand: 'cb:action:legacy_action',
          executionTimeMs: 300,
          internalExecutionTimeMs: null, // Legacy log without internal separation
          telegramNetworkTimeMs: null,
          performanceTier: 'YELLOW_ACCEPTABLE',
          cacheSource: null,
          actorTelegramId: BigInt(100),
          timestamp: new Date('2026-09-17T09:00:00Z'),
        },
        {
          id: 'leg-2',
          callbackQueryOrCommand: 'cb:action:modern_action',
          executionTimeMs: 210,
          internalExecutionTimeMs: 12, // Modern log with internal execution time
          telegramNetworkTimeMs: 198,
          performanceTier: 'GREEN_FAST',
          cacheSource: 'L1_RAM_CACHE',
          actorTelegramId: BigInt(101),
          timestamp: new Date('2026-09-17T09:01:00Z'),
        },
      ];

      vi.mocked(prisma.botPerformanceLog.findMany).mockResolvedValueOnce(legacyLogs as any);

      const result = await getApmTelemetryData();

      expect(result.totalOps).toBe(2);
      // avgInternalLatencyMs must be 12 (derived solely from the non-null record), not 6 (which would occur if null was counted as 0)
      expect(result.avgInternalLatencyMs).toBe(12);
      expect(result.p50InternalLatencyMs).toBe(12);
      expect(result.p95InternalLatencyMs).toBe(12);
      expect(result.avgNetworkLatencyMs).toBe(198);
      expect(result.fastInternalOpsPct + result.acceptableInternalOpsPct + result.slowInternalOpsPct).toBe(100);
      expect(result.fastNetworkOpsPct + result.normalNetworkOpsPct + result.slowNetworkOpsPct).toBe(100);
    });

    it('caches APM responses in memory for 5 seconds and bypasses on forceRefresh', async () => {
      const sampleLogs = [
        {
          id: 'c1',
          callbackQueryOrCommand: 'cb:action:cache_test',
          executionTimeMs: 50,
          internalExecutionTimeMs: 10,
          telegramNetworkTimeMs: 40,
          performanceTier: 'GREEN_FAST',
          cacheSource: 'L1_RAM_CACHE',
          actorTelegramId: BigInt(100),
          timestamp: new Date('2026-09-17T10:00:00Z'),
        },
      ];

      vi.mocked(prisma.botPerformanceLog.findMany).mockResolvedValueOnce(sampleLogs as any);

      // First call: hits DB mock
      const res1 = await getApmTelemetryData();
      expect(res1.totalOps).toBe(1);
      expect(prisma.botPerformanceLog.findMany).toHaveBeenCalledTimes(1);

      // Second call immediately: hits in-memory cache, findMany is NOT called again
      const res2 = await getApmTelemetryData();
      expect(res2.totalOps).toBe(1);
      expect(prisma.botPerformanceLog.findMany).toHaveBeenCalledTimes(1);

      // Third call with forceRefresh: true: bypasses cache, calls findMany again
      vi.mocked(prisma.botPerformanceLog.findMany).mockResolvedValueOnce(sampleLogs as any);
      const res3 = await getApmTelemetryData({ forceRefresh: true });
      expect(res3.totalOps).toBe(1);
      expect(prisma.botPerformanceLog.findMany).toHaveBeenCalledTimes(2);
    });

    it('smooths sub-minute rapid bursts in RPM calculation to prevent astronomical spikes', async () => {
      // 5 logs logged within 80 milliseconds
      const burstLogs = Array.from({ length: 5 }, (_, i) => ({
        id: `burst-${i}`,
        callbackQueryOrCommand: 'cb:action:rapid_click',
        executionTimeMs: 15,
        internalExecutionTimeMs: 5,
        telegramNetworkTimeMs: 10,
        performanceTier: 'GREEN_FAST',
        cacheSource: 'L1_RAM_CACHE',
        actorTelegramId: BigInt(100),
        timestamp: new Date(1700000000000 + i * 20),
      }));

      vi.mocked(prisma.botPerformanceLog.findMany).mockResolvedValueOnce(burstLogs as any);

      const result = await getApmTelemetryData({ forceRefresh: true });

      expect(result.totalOps).toBe(5);
      // Span is 80ms = 0.00133 min. With smoothing (Math.max(1, diffMinutes)), effectiveMinutes is 1 min => 5 RPM.
      expect(result.rpm).toBe(5);
    });

    it('returns totalPages: 0 when totalCount is 0 after filtering', async () => {
      const logs = [
        {
          id: 't1',
          callbackQueryOrCommand: 'cb:action:foo',
          executionTimeMs: 50,
          internalExecutionTimeMs: 10,
          telegramNetworkTimeMs: 40,
          performanceTier: 'GREEN_FAST',
          cacheSource: 'L1_RAM_CACHE',
          actorTelegramId: BigInt(100),
          timestamp: new Date('2026-09-17T10:00:00Z'),
        },
      ];

      vi.mocked(prisma.botPerformanceLog.findMany).mockResolvedValueOnce(logs as any);

      const result = await getApmTelemetryData({ search: 'nonexistent_action_query', forceRefresh: true });

      expect(result.pagination?.totalCount).toBe(0);
      expect(result.pagination?.totalPages).toBe(0);
    });
  });

  describe('Module-Driven Analytics Center Engine (Plan 56 Overhaul)', () => {
    const mockSuperAdmin: DashboardUser = {
      id: 'usr-admin-1',
      telegramId: '123456789',
      name: 'سوبر أدمن',
      role: 'SUPER_ADMIN',
      isRealSuperAdmin: true,
    };

    it('workforce: correctly aggregates active workers, new hires, job breakdown, and operations', async () => {
      vi.mocked(prisma.worker.count)
        .mockResolvedValueOnce(45) // activeCount
        .mockResolvedValueOnce(50) // totalCount
        .mockResolvedValueOnce(8);  // newHiresCount

      vi.mocked(prisma.worker.findMany).mockResolvedValueOnce([
        {
          id: 'w-1',
          code: 'OP-01',
          name: 'محمد أحمد',
          nickname: 'حمو',
          jobTitle: 'سائق لودر',
          dailyWage: 350 as any,
          status: 'ACTIVE',
          createdAt: new Date('2026-09-10'),
          jobRef: { name: 'سائق لودر' },
          site: { name: 'موقع الفوسفات' },
        },
      ] as any);

      vi.mocked(prisma.workerCommitmentScore.aggregate).mockResolvedValueOnce({
        _avg: { totalScore: 94 as any },
      } as any);

      const result = await getModuleAnalyticsData('workforce', 'ALL', 'month', mockSuperAdmin);

      expect(result.moduleKey).toBe('workforce');
      expect(result.moduleNameAr).toContain('شؤون العاملين');
      expect(result.kpis).toHaveLength(4);
      expect(result.kpis[0].value).toBe(45);
      expect(result.kpis[1].value).toBe(8);
      expect(result.kpis[2].value).toBe('94%');
      expect(result.breakdown.items.length).toBeGreaterThanOrEqual(1);
      expect(result.breakdown.items[0].label).toBe('سائق لودر');
      expect(result.recentOperations).toHaveLength(1);
      expect(result.recentOperations[0].title).toBe('حمو');
      expect(result.recentOperations[0].reference).toBe('OP-01');
    });

    it('advances: aggregates advances sum, pending/approved counts, and status breakdown', async () => {
      vi.mocked(prisma.advanceRequest.aggregate).mockResolvedValueOnce({
        _sum: { amountRequested: 15000 as any },
      } as any);
      vi.mocked(prisma.advanceRequest.count)
        .mockResolvedValueOnce(3) // pendingCount
        .mockResolvedValueOnce(12) // approvedCount
        .mockResolvedValueOnce(1); // rejectedCount

      vi.mocked(prisma.advanceRequest.findMany).mockResolvedValueOnce([
        {
          id: 'adv-1',
          requestNumber: '#ARQ-001',
          amountRequested: 1000 as any,
          approvedAmount: 1000 as any,
          status: 'APPROVED',
          createdAt: new Date('2026-09-12'),
          worker: { name: 'علي حسن', nickname: 'علوبة', site: { name: 'المحور' } },
          site: { name: 'المحور' },
        },
      ] as any);

      const result = await getModuleAnalyticsData('advances', 'ALL', 'month', mockSuperAdmin);

      expect(result.moduleKey).toBe('advances');
      expect(result.kpis[0].value).toContain('ج.م');
      expect(result.kpis[1].value).toBe(3);
      expect(result.kpis[2].value).toBe(12);
      expect(result.breakdown.items).toHaveLength(3);
      expect(result.recentOperations).toHaveLength(1);
      expect(result.recentOperations[0].title).toContain('علوبة');
      expect(result.recentOperations[0].status).toContain('معتمد');
    });

    it('custody: calculates total balance, active custodies, and liquidity levels', async () => {
      vi.mocked(prisma.financialCustody.findMany).mockResolvedValueOnce([
        {
          id: 'cst-1',
          custodyNumber: '#CST-01',
          currentBalance: 5000 as any,
          initialAmount: 20000 as any,
          status: 'ACTIVE',
          updatedAt: new Date('2026-09-15'),
          custodian: { name: 'محمود أمين' },
          site: { name: 'المحجر' },
        },
      ] as any);
      vi.mocked(prisma.financialCustody.aggregate).mockResolvedValueOnce({
        _sum: { currentBalance: 5000 as any, initialAmount: 20000 as any, totalLiquidatedExpenses: 15000 as any },
      } as any);

      const result = await getModuleAnalyticsData('custody', 'ALL', 'month', mockSuperAdmin);

      expect(result.moduleKey).toBe('custody');
      expect(result.kpis[0].value).toContain('ج.م');
      expect(result.kpis[1].value).toBe(1);
      expect(result.recentOperations).toHaveLength(1);
      expect(result.recentOperations[0].title).toContain('المحجر');
    });

    it('canteen: computes sales sum, active items, and category distribution', async () => {
      vi.mocked(prisma.canteenItem.count)
        .mockResolvedValueOnce(18) // active
        .mockResolvedValueOnce(20); // total
      vi.mocked(prisma.canteenItem.findMany).mockResolvedValueOnce([
        {
          id: 'ci-1',
          code: 'CIG-01',
          name: 'سجائر كليوباترا بوكس',
          category: 'CIGARETTES',
          costPrice: 40 as any,
          sellingPrice: 45 as any,
          currentStock: 100 as any,
          reorderThreshold: 10 as any,
          isActive: true,
          updatedAt: new Date('2026-09-16'),
          site: { name: 'موقع أسوان' },
        },
      ] as any);
      vi.mocked(prisma.financialLedger.aggregate).mockResolvedValueOnce({
        _sum: { amount: 8500 as any },
      } as any);

      const result = await getModuleAnalyticsData('canteen', 'ALL', 'month', mockSuperAdmin);

      expect(result.moduleKey).toBe('canteen');
      expect(result.kpis[0].value).toContain('ج.م');
      expect(result.kpis[1].value).toBe(18);
      expect(result.breakdown.items[0].label).toContain('سجائر');
      expect(result.recentOperations[0].reference).toBe('CIG-01');
    });

    it('equipment: returns operational ratio and technical status breakdown', async () => {
      vi.mocked(prisma.equipment.count)
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8)  // operational
        .mockResolvedValueOnce(1); // needs maintenance
      vi.mocked(prisma.equipment.findMany).mockResolvedValueOnce([
        {
          id: 'eq-1',
          code: 'EQ-LDR-01',
          name: 'لودر كوماتسو 966',
          meterType: 'HOURS',
          currentMeterReading: 1250 as any,
          currentFuelLevelPercentage: 75 as any,
          technicalStatus: 'OPERATIONAL',
          updatedAt: new Date('2026-09-16'),
        },
      ] as any);

      const result = await getModuleAnalyticsData('equipment', 'ALL', 'month', mockSuperAdmin);

      expect(result.moduleKey).toBe('equipment');
      expect(result.kpis[0].value).toBe(10);
      expect(result.kpis[1].value).toBe(8);
      expect(result.kpis[2].value).toBe('80%');
      expect(result.breakdown.items[0].label).toContain('OPERATIONAL');
      expect(result.recentOperations[0].reference).toBe('EQ-LDR-01');
    });

    it('gracefully handles database exceptions and returns empty structures without throwing', async () => {
      vi.mocked(prisma.worker.count).mockRejectedValue(new Error('Connection lost'));

      const result = await getModuleAnalyticsData('workforce', 'ALL', 'month', mockSuperAdmin);

      expect(result.moduleKey).toBe('workforce');
      expect(result.kpis).toHaveLength(4);
      expect(result.kpis[0].badge).toBe('غير متوفر');
      expect(result.recentOperations).toEqual([]);
    });

    it('enforces fail-closed security for unassigned FIELD_ADMIN', async () => {
      const unassignedFieldAdmin = {
        id: 'usr-fa-99',
        telegramId: '12345678',
        name: 'مشرف بدون موقع',
        role: 'FIELD_ADMIN' as const,
        assignedSiteId: undefined,
      };

      vi.mocked(prisma.worker.count).mockResolvedValue(0);
      vi.mocked(prisma.worker.findMany).mockResolvedValue([]);
      vi.mocked(prisma.workerCommitmentScore.aggregate).mockResolvedValue({ _avg: { totalScore: null } } as any);

      const result = await getModuleAnalyticsData('workforce', 'ALL', 'month', unassignedFieldAdmin);

      expect(result.moduleKey).toBe('workforce');
      expect(prisma.worker.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ siteId: '__UNASSIGNED_FIELD_ADMIN__' }),
        })
      );
    });
  });
});

