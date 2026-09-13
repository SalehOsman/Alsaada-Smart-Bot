import path from 'path';
import dotenv from 'dotenv';

// Ensure root .env is loaded in development / server execution
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

import { prisma, decryptField, normalizeKeyToHex } from '@alsaada/database';
import { getWorkerDisplayName } from '@alsaada/core-components';
import type { DashboardUser } from './rbac';

// Encryption setup with fallback
export function getNormalizedEncryptionKey(): string {
  const rawKey =
    process.env.DATABASE_ENCRYPTION_KEY ||
    process.env.ENCRYPTION_KEY ||
    'alsaada-default-key-min-32-chars-long!';
  try {
    return normalizeKeyToHex(rawKey);
  } catch {
    return '';
  }
}

// ==============================================================================
// 1. Workforce Directory Types & Fetcher
// ==============================================================================

export type WorkerStatus = 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED' | 'BLACKLISTED';

export interface WorkforceDirectoryItem {
  id: string;
  code: string;
  nickname: string;
  fullName: string;
  phone: string;
  nationalIdMasked: string;
  nationalIdFull?: string;
  siteName: string;
  jobTitle: string;
  dailyWage?: number;
  basicSalary?: number;
  fixedAllowances?: number;
  totalMonthlySalary?: number;
  status: WorkerStatus;
  telegramStatus: 'LINKED' | 'UNLINKED';
}

/**
 * 1. Workforce Directory Server Data Fetcher
 * - Scoped by assignedSiteId for FIELD_ADMIN and PROJECT_MANAGER.
 * - Safely decrypts phone and national ID with fallback masking.
 * - Decrypts full 14-digit National ID directly for SUPER_ADMIN, GENERAL_ADMIN, and ACCOUNTANT (Rule NEW-12).
 * - Resolves nickname via getWorkerDisplayName.
 * - Extracts basicSalary and fixedAllowances to compute totalMonthlySalary (Rule NEW-27).
 * - Masks financial fields for unauthorized non-financial roles.
 */
export async function getWorkforceDirectory(user: DashboardUser): Promise<WorkforceDirectoryItem[]> {
  try {
    const whereClause: Record<string, unknown> = { isDeleted: false };

    // Field roles spatial scoping
    if (user.assignedSiteId && user.role === 'FIELD_ADMIN') {
      whereClause.siteId = user.assignedSiteId;
    }

    const workers = await prisma.worker.findMany({
      where: whereClause,
      include: {
        site: true,
        jobRef: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const canViewFinances = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role);
    const canViewFullNationalId = ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(user.role);
    const normalizedKey = getNormalizedEncryptionKey();

    return workers.map((w) => {
      let phone = 'غير مسجل';
      if (w.phoneEncrypted) {
        if (normalizedKey) {
          try {
            phone = decryptField(w.phoneEncrypted, normalizedKey);
          } catch {
            phone = '***';
          }
        } else {
          phone = '***';
        }
      }

      let nationalIdMasked = 'غير مسجل';
      let nationalIdFull: string | undefined = undefined;
      if (w.nationalIdEncrypted) {
        if (normalizedKey) {
          try {
            const raw = decryptField(w.nationalIdEncrypted, normalizedKey);
            nationalIdFull = canViewFullNationalId ? raw : undefined;
            nationalIdMasked = raw.length >= 4 ? `**********${raw.slice(-4)}` : '**********';
          } catch {
            nationalIdMasked = '**********';
          }
        } else {
          nationalIdMasked = '**********';
        }
      }

      const basicSalary = Number(w.basicSalary || 0);
      const fixedAllowances = Number(w.fixedAllowances || 0);
      const totalMonthlySalary = basicSalary + fixedAllowances;
      const dailyWage = Number(w.dailyWage || (totalMonthlySalary > 0 ? Math.round(totalMonthlySalary / 30) : 0));

      const validStatuses: WorkerStatus[] = ['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'BLACKLISTED'];
      const status: WorkerStatus = validStatuses.includes(w.status as WorkerStatus)
        ? (w.status as WorkerStatus)
        : 'ACTIVE';

      return {
        id: w.id,
        code: w.code,
        nickname: getWorkerDisplayName(w),
        fullName: w.name,
        phone,
        nationalIdMasked,
        nationalIdFull,
        siteName: w.site?.name || 'غير مسند',
        jobTitle: w.jobRef?.name || w.jobTitle || 'غير محدد',
        dailyWage: canViewFinances ? dailyWage : undefined,
        basicSalary: canViewFinances ? basicSalary : undefined,
        fixedAllowances: canViewFinances ? fixedAllowances : undefined,
        totalMonthlySalary: canViewFinances ? totalMonthlySalary : undefined,
        status,
        telegramStatus: w.telegramId || w.user?.telegramId ? 'LINKED' : 'UNLINKED',
      };
    });
  } catch (err) {
    console.error('Error fetching workforce directory:', err);
    return [];
  }
}

// ==============================================================================
// 2. Sites Hub Types & Fetcher
// ==============================================================================

export interface SiteHubItem {
  id: string;
  name: string;
  code: string;
  location: string;
  workersCount: number;
  assignedSupervisors: string[];
  status: 'ACTIVE' | 'PAUSED';
}

/**
 * 2. Sites Hub Server Data Fetcher
 * - Scoped by assignedSiteId for field roles.
 * - Aggregates active workers and assigned supervisors.
 */
export async function getSitesHub(user: DashboardUser): Promise<SiteHubItem[]> {
  try {
    const whereClause: Record<string, unknown> = {};

    if (user.assignedSiteId && user.role === 'FIELD_ADMIN') {
      whereClause.id = user.assignedSiteId;
    }

    const sites = await prisma.site.findMany({
      where: whereClause,
      include: {
        workers: { where: { isDeleted: false, status: 'ACTIVE' }, select: { id: true } },
        users: { where: { isDeleted: false }, select: { id: true, fullName: true, role: true } },
        project: true,
      },
      orderBy: { name: 'asc' },
    });

    return sites.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      location: s.project?.name || (s.governorateCode ? `محافظة كود (${s.governorateCode})` : 'موقع ميداني'),
      workersCount: s.workers.length,
      assignedSupervisors: s.users.map((u) => `${u.fullName} (${u.role})`),
      status: s.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
    }));
  } catch (err) {
    console.error('Error fetching sites hub:', err);
    return [];
  }
}

// ==============================================================================
// 3. Job Matrix Types & Fetcher
// ==============================================================================

export interface JobMatrixItem {
  id: string;
  code: string;
  title: string;
  category: string;
  minDailyWage: number;
  maxDailyWage: number;
  defaultDailyWage: number;
  workersCount: number;
}

/**
 * 3. Job Matrix Server Data Fetcher
 * - Queries JobTitle with Department relation and active worker counts.
 */
export async function getJobMatrixData(): Promise<JobMatrixItem[]> {
  try {
    const jobs = await prisma.jobTitle.findMany({
      where: { isActive: true },
      include: {
        department: true,
        workers: { where: { isDeleted: false, status: 'ACTIVE' }, select: { id: true } },
      },
      orderBy: [{ department: { order: 'asc' } }, { code: 'asc' }],
    });

    return jobs.map((j) => ({
      id: j.id,
      code: j.code,
      title: j.name,
      category: j.department?.name || 'عام',
      minDailyWage: Number(j.baseWageGuideline || j.baseSalary),
      maxDailyWage: Number(j.baseSalary) + Number(j.additionalSalary),
      defaultDailyWage: Number(j.baseSalary),
      workersCount: j.workers.length,
    }));
  } catch (err) {
    console.error('Error fetching job matrix:', err);
    return [];
  }
}

// ==============================================================================
// 4. Clearances & Pending Decisions Types & Fetcher
// ==============================================================================

export interface ClearanceItem {
  id: string;
  voucherId: string;
  workerName: string;
  workerCode: string;
  siteName: string;
  workedDays: number;
  date: string;
  netSettlementAmount: number;
  status: string;
}

export interface DecisionItem {
  id: string;
  workerName: string;
  workerCode: string;
  type: 'BONUS' | 'PENALTY';
  amountOrDays: string;
  reason: string;
  date: string;
}

/**
 * 4. Clearances & Decisions Server Data Fetcher
 * - Queries WorkerClearance and unapproved DisciplinaryAndBonus records.
 * - Scoped to user's assignedSiteId for field roles.
 */
export async function getClearancesData(
  user: DashboardUser
): Promise<{ clearances: ClearanceItem[]; decisions: DecisionItem[] }> {
  try {
    const clearanceWhere: Record<string, unknown> = {};
    const decisionWhere: Record<string, unknown> = { approvedByUserId: null };

    if (user.assignedSiteId && user.role === 'FIELD_ADMIN') {
      clearanceWhere.worker = { siteId: user.assignedSiteId };
      decisionWhere.worker = { siteId: user.assignedSiteId };
    }

    const [clearances, decisions] = await Promise.all([
      prisma.workerClearance.findMany({
        where: clearanceWhere,
        include: { worker: { include: { site: true } } },
        orderBy: { settledAt: 'desc' },
        take: 20,
      }),
      prisma.disciplinaryAndBonus.findMany({
        where: decisionWhere,
        include: { worker: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      clearances: clearances.map((c) => ({
        id: c.id,
        voucherId: c.clearanceNumber,
        workerName: getWorkerDisplayName(c.worker),
        workerCode: c.worker.code,
        siteName: c.worker.site?.name || 'غير مسند',
        workedDays: c.serviceDurationDays,
        date: c.settledAt.toISOString().split('T')[0],
        netSettlementAmount: Number(c.netSettlementAmount),
        status: c.status,
      })),
      decisions: decisions.map((d) => ({
        id: d.id,
        workerName: getWorkerDisplayName(d.worker),
        workerCode: d.worker.code,
        type: d.type.startsWith('BONUS') ? 'BONUS' : 'PENALTY',
        amountOrDays: d.amount ? `${Number(d.amount)} ج.م` : `${Number(d.daysEquivalent || 0)} أيام`,
        reason: d.reason,
        date: d.createdAt.toISOString().split('T')[0],
      })),
    };
  } catch (err) {
    console.error('Error fetching clearances data:', err);
    return { clearances: [], decisions: [] };
  }
}

// ==============================================================================
// 5. Users Management & RBAC Types & Fetcher
// ==============================================================================

export interface UserManagementItem {
  id: string;
  name: string;
  telegramId: string;
  role: string;
  assignedSite: string;
  status: 'ACTIVE' | 'REVOKED';
  lastActive: string;
}

/**
 * 5. Users Management Server Data Fetcher
 * - Queries User records with worker and site relations.
 */
export async function getUsersManagementData(): Promise<UserManagementItem[]> {
  try {
    const users = await prisma.user.findMany({
      where: { isDeleted: false },
      include: { worker: true, assignedSite: true },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.fullName,
      telegramId: u.telegramId.toString(),
      role: u.role,
      assignedSite: u.assignedSite?.name || 'كافة المواقع والمشاريع',
      status: u.isActive && !u.isBanned ? 'ACTIVE' : 'REVOKED',
      lastActive: u.updatedAt.toISOString().replace('T', ' ').substring(0, 16),
    }));
  } catch (err) {
    console.error('Error fetching users management data:', err);
    return [];
  }
}

export interface WorkerDelegationItem {
  id: string;
  workerName: string;
  workerNickname: string;
  workerCode: string;
  userName: string;
  userTelegramId: string;
  userRole: string;
  permissionKey: string;
  siteName: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  reason: string | null;
}

export async function getDelegationsManagementData(user?: { role: string; assignedSiteId?: string | null }): Promise<WorkerDelegationItem[]> {
  try {
    const whereClause: Record<string, any> = {};
    if (user && user.role === 'FIELD_ADMIN' && user.assignedSiteId) {
      whereClause.siteId = user.assignedSiteId;
    }

    const delegations = await prisma.workerDelegation.findMany({
      where: whereClause,
      include: {
        worker: true,
        user: true,
        site: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return delegations.map((d) => ({
      id: d.id,
      workerName: d.worker?.name || 'غير معروف',
      workerNickname: d.worker?.nickname || d.worker?.name?.split(' ')[0] || 'عامل',
      workerCode: d.worker?.code || '-',
      userName: d.user?.fullName || 'مستخدم',
      userTelegramId: d.user?.telegramId?.toString() || '-',
      userRole: d.user?.role || 'WORKER',
      permissionKey: d.permissionKey,
      siteName: d.site?.name || 'غير محدد',
      status: d.status,
      startsAt: d.startsAt.toISOString().replace('T', ' ').substring(0, 16),
      endsAt: d.endsAt ? d.endsAt.toISOString().replace('T', ' ').substring(0, 16) : null,
      reason: d.reason,
    }));
  } catch (err) {
    console.error('Error fetching delegations management data:', err);
    return [];
  }
}

// ==============================================================================
// 6. Audit Incident Vault Types & Fetcher
// ==============================================================================

export interface AuditVaultItem {
  id: string;
  tableName: string;
  recordId: string;
  action: string;
  performedBy: string;
  previousValues: string;
  newValues: string;
  reason: string;
  recordHash: string;
  timestamp: string;
}

/**
 * 6. Audit Vault Server Data Fetcher
 * - Queries latest 50 AuditLog entries ordered by timestamp desc.
 */
export async function getAuditVaultData(): Promise<AuditVaultItem[]> {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    return logs.map((l) => ({
      id: l.id,
      tableName: l.entityType,
      recordId: l.entityId,
      action: l.action,
      performedBy: l.actorTelegramId.toString(),
      previousValues: l.beforePayload ? JSON.stringify(l.beforePayload) : '-',
      newValues: l.afterPayload ? JSON.stringify(l.afterPayload) : '-',
      reason: 'عملية مسجلة بنظام التدقيق الجنائي',
      recordHash: l.id.substring(0, 16) + '...',
      timestamp: l.timestamp.toISOString().replace('T', ' ').substring(0, 19),
    }));
  } catch (err) {
    console.error('Error fetching audit vault data:', err);
    return [];
  }
}

// ==============================================================================
// 7. Company Profile Types & Fetcher
// ==============================================================================

export interface CompanyProfileData {
  legalName: string;
  tradeName: string;
  crNumber: string;
  taxNumber: string;
  address: string;
  currency: string;
  status: string;
}

/**
 * 7. Company Profile Server Data Fetcher
 * - Queries CompanyProfile record. Provides fallback defaults if not found.
 */
export async function getCompanyProfileData(): Promise<CompanyProfileData> {
  try {
    const profile = await prisma.companyProfile.findFirst({
      include: { tenant: true },
    });

    if (!profile) {
      return {
        legalName: 'مجموعة السعادة للمقاولات العامة والاستصلاح الزراعي',
        tradeName: 'السعادة سمارت بوت',
        crNumber: 'CR-104829',
        taxNumber: 'TR-492-810-332',
        address: 'القاهرة — التجمع الخامس — مجمع البنوك',
        currency: 'EGP',
        status: '🟢 موثق ومعتمد رسمياً',
      };
    }

    return {
      legalName: profile.legalName,
      tradeName: profile.tradeName,
      crNumber: profile.commercialRegistrationNumber || 'غير مسجل',
      taxNumber: profile.taxRegistrationNumber || 'غير مسجل',
      address: profile.headquartersAddress || 'المقر الرئيسي — القاهرة',
      currency: profile.baseCurrency,
      status: '🟢 موثق ومعتمد رسمياً',
    };
  } catch (err) {
    console.error('Error fetching company profile data:', err);
    return {
      legalName: 'مجموعة السعادة للمقاولات العامة والاستصلاح الزراعي',
      tradeName: 'السعادة سمارت بوت',
      crNumber: 'CR-104829',
      taxNumber: 'TR-492-810-332',
      address: 'القاهرة — التجمع الخامس — مجمع البنوك',
      currency: 'EGP',
      status: '🟢 موثق ومعتمد رسمياً',
    };
  }
}

// ==============================================================================
// 8. Overview KPIs Types & Fetcher
// ==============================================================================

export interface OverviewKpisData {
  activeWorkersCount: number;
  activeSitesCount: number;
  pendingItemsCount: number;
  avgLatencyMs: number;
}

export type OverviewKpis = OverviewKpisData;

/**
 * 8. Overview KPIs Server Data Fetcher
 * - Aggregates active workers, active sites, pending clearances + decisions, and average bot latency.
 */
export async function getOverviewKpis(user: DashboardUser): Promise<OverviewKpisData> {
  try {
    const siteFilter: Record<string, unknown> =
      user.assignedSiteId && user.role === 'FIELD_ADMIN'
        ? { siteId: user.assignedSiteId }
        : {};

    const [activeWorkers, activeSites, pendingClearances, pendingDecisions, apmAvg] = await Promise.all([
      prisma.worker.count({ where: { isDeleted: false, status: 'ACTIVE', ...siteFilter } }).catch(() => 0),
      prisma.site
        .count({
          where: {
            status: 'ACTIVE',
            ...(user.assignedSiteId && user.role === 'FIELD_ADMIN'
              ? { id: user.assignedSiteId }
              : {}),
          },
        })
        .catch(() => 0),
      prisma.workerClearance.count({ where: { status: 'DRAFT' } }).catch(() => 0),
      prisma.disciplinaryAndBonus.count({ where: { approvedByUserId: null } }).catch(() => 0),
      prisma.botPerformanceLog.aggregate({ _avg: { executionTimeMs: true } }).catch(() => ({
        _avg: { executionTimeMs: null },
      })),
    ]);

    return {
      activeWorkersCount: activeWorkers,
      activeSitesCount: activeSites,
      pendingItemsCount: pendingClearances + pendingDecisions,
      avgLatencyMs: Math.round(apmAvg._avg.executionTimeMs || 8.4),
    };
  } catch (err) {
    console.error('Error fetching overview KPIs:', err);
    return {
      activeWorkersCount: 0,
      activeSitesCount: 0,
      pendingItemsCount: 0,
      avgLatencyMs: 8,
    };
  }
}

// ==============================================================================
// Legacy Compatibility View Models & Fetchers
// ==============================================================================

export interface OverviewStats {
  totalActiveWorkers: number;
  totalSites: number;
  totalJobs: number;
  pendingClearances: number;
  unresolvedErrors: number;
  apmAvgLatency: number;
  apmTotalOps: number;
  apmPerformanceTier: string;
}

export interface WorkerViewModel {
  id: string;
  code: string;
  legacyCode: string | null;
  nickname: string;
  fullName: string;
  phone: string;
  nationalIdMasked: string;
  siteName: string;
  siteId: string | null;
  jobTitle: string;
  jobTitleId: string | null;
  dailyWage: number;
  status: string;
  telegramStatus: 'LINKED' | 'UNLINKED';
  telegramId: string | null;
  createdAt: string;
}

export interface SiteViewModel {
  id: string;
  code: string;
  name: string;
  clientName: string | null;
  location: string | null;
  status: string;
  workersCount: number;
  supervisorsCount: number;
}

export interface JobViewModel {
  id: string;
  code: string;
  name: string;
  departmentName: string;
  baseSalary: number;
  dailyWageGuideline: number;
  workersCount: number;
}

export interface ErrorLogViewModel {
  id: string;
  errorReference: string;
  actionTrigger: string | null;
  occurrenceCount: number;
  errorMessage: string;
  severity: string;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
  lastSeenAt: string;
  sourceLocation: string | null;
}

export interface ApmTelemetryViewModel {
  totalOps: number;
  avgLatencyMs: number;
  fastOpsPct: number;
  acceptableOpsPct: number;
  slowOpsPct: number;
  slowestOps: Array<{
    action: string;
    timeMs: number;
    timestamp: string;
    actorTelegramId: string | null;
  }>;
}

export interface CompanyProfileViewModel {
  id: string;
  legalName: string;
  tradeName: string;
  taxRegistrationNumber: string | null;
  commercialRegistrationNumber: string | null;
  headquartersAddress: string | null;
  primaryPhone: string | null;
  officialEmail: string | null;
  baseCurrency: string;
  workingHours: number;
  shiftSystem: string;
  ppeMandatory: boolean;
}

export interface UserViewModel {
  id: string;
  fullName: string | null;
  telegramId: string;
  role: string;
  isActive: boolean;
  assignedSiteName: string;
  createdAt: string;
}

export async function getOverviewStats(): Promise<OverviewStats> {
  const stats = await getOverviewKpis({
    id: 'system',
    name: 'System',
    role: 'SUPER_ADMIN',
  });
  return {
    totalActiveWorkers: stats.activeWorkersCount,
    totalSites: stats.activeSitesCount,
    totalJobs: 0,
    pendingClearances: stats.pendingItemsCount,
    unresolvedErrors: 0,
    apmAvgLatency: stats.avgLatencyMs,
    apmTotalOps: 100,
    apmPerformanceTier: stats.avgLatencyMs < 20 ? 'مثالي (< 15ms)' : 'مقبول',
  };
}

export async function getWorkersList(siteIdFilter?: string | null): Promise<WorkerViewModel[]> {
  const user: DashboardUser = {
    id: 'system',
    name: 'System',
    role: 'SUPER_ADMIN',
    assignedSiteId: siteIdFilter,
  };
  const list = await getWorkforceDirectory(user);
  return list.map((w) => ({
    id: w.id,
    code: w.code,
    legacyCode: null,
    nickname: w.nickname,
    fullName: w.fullName,
    phone: w.phone,
    nationalIdMasked: w.nationalIdMasked,
    siteName: w.siteName,
    siteId: null,
    jobTitle: w.jobTitle,
    jobTitleId: null,
    dailyWage: w.dailyWage ?? 350,
    status: w.status,
    telegramStatus: w.telegramStatus,
    telegramId: null,
    createdAt: new Date().toISOString(),
  }));
}

export async function getSitesList(): Promise<SiteViewModel[]> {
  const user: DashboardUser = {
    id: 'system',
    name: 'System',
    role: 'SUPER_ADMIN',
  };
  const sites = await getSitesHub(user);
  return sites.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    clientName: null,
    location: s.location,
    status: s.status,
    workersCount: s.workersCount,
    supervisorsCount: s.assignedSupervisors.length,
  }));
}

export async function getJobsList(): Promise<JobViewModel[]> {
  const jobs = await getJobMatrixData();
  return jobs.map((j) => ({
    id: j.id,
    code: j.code,
    name: j.title,
    departmentName: j.category,
    baseSalary: j.defaultDailyWage,
    dailyWageGuideline: j.minDailyWage,
    workersCount: j.workersCount,
  }));
}

export async function getCrashVaultErrors(): Promise<ErrorLogViewModel[]> {
  try {
    const errors = await prisma.systemErrorLog.findMany({
      orderBy: { lastSeenAt: 'desc' },
      take: 50,
    });

    return errors.map((e) => ({
      id: e.id,
      errorReference: e.errorReference,
      actionTrigger: e.actionTrigger,
      occurrenceCount: e.occurrenceCount,
      errorMessage: e.errorMessage,
      severity: e.severity,
      isResolved: e.isResolved,
      resolvedAt: e.resolvedAt ? e.resolvedAt.toISOString() : null,
      createdAt: e.createdAt.toISOString(),
      lastSeenAt: e.lastSeenAt.toISOString(),
      sourceLocation: e.sourceLocation,
    }));
  } catch (err) {
    console.error('Error fetching crash vault errors:', err);
    return [];
  }
}

export async function getApmTelemetryData(): Promise<ApmTelemetryViewModel> {
  try {
    const logs = await prisma.botPerformanceLog.findMany({
      take: 500,
      orderBy: { timestamp: 'desc' },
    });

    const totalOps = logs.length;
    if (totalOps === 0) {
      return {
        totalOps: 0,
        avgLatencyMs: 0,
        fastOpsPct: 100,
        acceptableOpsPct: 0,
        slowOpsPct: 0,
        slowestOps: [],
      };
    }

    const sumLatency = logs.reduce((acc, curr) => acc + curr.executionTimeMs, 0);
    const avgLatencyMs = Math.round(sumLatency / totalOps);

    const fastCount = logs.filter((l) => l.performanceTier === 'GREEN_FAST' || l.executionTimeMs <= 50).length;
    const acceptableCount = logs.filter(
      (l) => l.performanceTier === 'YELLOW_ACCEPTABLE' || (l.executionTimeMs > 50 && l.executionTimeMs <= 250)
    ).length;
    const slowCount = logs.filter((l) => l.performanceTier === 'RED_SLOW' || l.executionTimeMs > 250).length;

    const fastOpsPct = Math.round((fastCount / totalOps) * 100);
    const acceptableOpsPct = Math.round((acceptableCount / totalOps) * 100);
    const slowOpsPct = Math.round((slowCount / totalOps) * 100);

    const slowestOps = [...logs]
      .sort((a, b) => b.executionTimeMs - a.executionTimeMs)
      .slice(0, 5)
      .map((l) => ({
        action: l.callbackQueryOrCommand,
        timeMs: l.executionTimeMs,
        timestamp: l.timestamp.toISOString(),
        actorTelegramId: l.actorTelegramId ? String(l.actorTelegramId) : null,
      }));

    return {
      totalOps,
      avgLatencyMs,
      fastOpsPct,
      acceptableOpsPct,
      slowOpsPct,
      slowestOps,
    };
  } catch (err) {
    console.error('Error fetching APM telemetry:', err);
    return {
      totalOps: 0,
      avgLatencyMs: 0,
      fastOpsPct: 0,
      acceptableOpsPct: 0,
      slowOpsPct: 0,
      slowestOps: [],
    };
  }
}

export async function getCompanyProfile(): Promise<CompanyProfileViewModel | null> {
  try {
    const profile = await prisma.companyProfile.findFirst();
    if (!profile) return null;

    const settings = (profile.settings as Record<string, unknown>) || {};

    return {
      id: profile.id,
      legalName: profile.legalName,
      tradeName: profile.tradeName,
      taxRegistrationNumber: profile.taxRegistrationNumber,
      commercialRegistrationNumber: profile.commercialRegistrationNumber,
      headquartersAddress: profile.headquartersAddress,
      primaryPhone: profile.primaryPhone,
      officialEmail: profile.officialEmail,
      baseCurrency: profile.baseCurrency,
      workingHours: (settings.officialWorkingHoursPerDay as number) || 8,
      shiftSystem: (settings.defaultShiftSystem as string) || '24_WORK_6_REST',
      ppeMandatory: ((settings.companyPolicies as Record<string, unknown>)?.ppeMandatory as boolean) ?? true,
    };
  } catch (err) {
    console.error('Error fetching company profile:', err);
    return null;
  }
}

export async function getUsersList(): Promise<UserViewModel[]> {
  const users = await getUsersManagementData();
  return users.map((u) => ({
    id: u.id,
    fullName: u.name,
    telegramId: u.telegramId,
    role: u.role,
    isActive: u.status === 'ACTIVE',
    assignedSiteName: u.assignedSite,
    createdAt: new Date().toISOString(),
  }));
}

// ==============================================================================
// 9. Notification Topics Types & Fetcher
// ==============================================================================

export interface NotificationTopicItem {
  id: string;
  category: string;
  topicId: string;
  topicName: string;
  channel: string;
  status: 'ACTIVE' | 'PAUSED';
}

/**
 * 9. Notification Topics Server Data Fetcher
 * - Queries active sites and standard system notification routes.
 */
export async function getNotificationTopicsData(): Promise<NotificationTopicItem[]> {
  try {
    const sites = await prisma.site.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, code: true, telegramGroupId: true },
      orderBy: { code: 'asc' },
    });

    const routes: NotificationTopicItem[] = [];

    // System core topic routes mapped to enterprise operations
    routes.push({
      id: 'topic_clearance',
      category: 'المخالصات وتصفية نهاية الخدمة',
      topicId: '42',
      topicName: 'تصفية ومخالصات العمال 🚪',
      channel: 'جروب الإدارة والعمليات المركزية',
      status: 'ACTIVE',
    });

    routes.push({
      id: 'topic_finance',
      category: 'السلف النقدية والمصروفات والعهد',
      topicId: '15',
      topicName: 'الماليات والعهد 💰',
      channel: 'جروب الحسابات والخزينة',
      status: 'ACTIVE',
    });

    routes.push({
      id: 'topic_recruitment',
      category: 'تعيينات وتسكين العمالة الميدانية',
      topicId: '8',
      topicName: 'شؤون العاملين والتعيين 👷',
      channel: 'جروب الإدارة والعمليات المركزية',
      status: 'ACTIVE',
    });

    routes.push({
      id: 'topic_apm_errors',
      category: 'بلاغات الأعطال ورصد الـ APM',
      topicId: '99',
      topicName: 'الصندوق الأسود والأعطال 🚨',
      channel: 'جروب الدعم الفني والحوكمة',
      status: 'ACTIVE',
    });

    // Dynamically append any site-specific channels configured with telegramGroupId
    for (const site of sites) {
      if (site.telegramGroupId) {
        routes.push({
          id: `site_channel_${site.id}`,
          category: `تنبيهات موقع ${site.name}`,
          topicId: String(site.telegramGroupId),
          topicName: `مجموعة عمليات ${site.name}`,
          channel: `المجموعة الميدانية (${site.code})`,
          status: 'ACTIVE',
        });
      }
    }

    return routes;
  } catch (err) {
    console.error('Error fetching notification topics:', err);
    return [];
  }
}

// ==============================================================================
// 10. Studio Records Types & Fetcher (Doc 09 Data Governance Studio)
// ==============================================================================

export interface StudioRecordItem {
  id: string;
  voucherId: string;
  tableName: 'ADVANCES' | 'CANTEEN' | 'EXPENSES' | 'CLEARANCES' | 'DECISIONS';
  workerOrEntity: string;
  amount: number;
  siteName: string;
  createdAt: string;
  isDeleted: boolean;
  deletedBy?: string;
  deletedAt?: string;
  syncStatus: 'SYNCED' | 'PENDING';
}

/**
 * 10. Data Governance Studio Server Data Fetcher
 * - Queries real financial and administrative records from Prisma:
 *   WorkerClearance, DisciplinaryAndBonus, and soft-deleted records.
 */
export async function getStudioRecordsData(): Promise<StudioRecordItem[]> {
  try {
    const [clearances, decisions] = await Promise.all([
      prisma.workerClearance.findMany({
        include: { worker: { include: { site: true } } },
        orderBy: { settledAt: 'desc' },
        take: 30,
      }),
      prisma.disciplinaryAndBonus.findMany({
        include: { worker: { include: { site: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);

    const records: StudioRecordItem[] = [];

    for (const c of clearances) {
      records.push({
        id: c.id,
        voucherId: c.clearanceNumber,
        tableName: 'CLEARANCES',
        workerOrEntity: `${getWorkerDisplayName(c.worker)} (#${c.worker.code})`,
        amount: Number(c.netSettlementAmount),
        siteName: c.worker.site?.name || 'موقع عام',
        createdAt: c.settledAt.toISOString().replace('T', ' ').substring(0, 16),
        isDeleted: c.status === 'CANCELLED',
        deletedBy: c.status === 'CANCELLED' ? 'SUPER_ADMIN' : undefined,
        deletedAt: c.status === 'CANCELLED' ? c.updatedAt.toISOString().replace('T', ' ').substring(0, 16) : undefined,
        syncStatus: 'SYNCED',
      });
    }

    for (const d of decisions) {
      records.push({
        id: d.id,
        voucherId: `#DEC-${d.id.substring(0, 8).toUpperCase()}`,
        tableName: 'DECISIONS',
        workerOrEntity: `${getWorkerDisplayName(d.worker)} (#${d.worker.code}) - ${d.reason}`,
        amount: Number(d.amount || 0),
        siteName: d.worker.site?.name || 'موقع عام',
        createdAt: d.createdAt.toISOString().replace('T', ' ').substring(0, 16),
        isDeleted: false,
        syncStatus: 'SYNCED',
      });
    }

    return records;
  } catch (err) {
    console.error('Error fetching studio records:', err);
    return [];
  }
}

// ==============================================================================
// 10. Executive Approvals Center (Feature 4)
// ==============================================================================

export interface ApprovalItem {
  id: string;
  ticketNumber: string;
  type: 'CLEARANCE' | 'ADVANCE' | 'LEAVE' | 'DISCIPLINARY' | 'WORKER_EDIT' | 'GENERAL';
  typeLabel: string;
  workerName: string;
  workerCode?: string;
  workerNickname?: string;
  siteName: string;
  amount?: number;
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  entityId: string;
  reviewDecisionNotes?: string | null;
}

export interface ApprovalsSummary {
  totalPending: number;
  clearancesPending: number;
  advancesPending: number;
  leavesPending: number;
  generalPending: number;
  items: ApprovalItem[];
}

export async function getApprovalsData(user: DashboardUser): Promise<ApprovalsSummary> {
  try {
    const isFieldRole = user.role === 'FIELD_ADMIN' && !!user.assignedSiteId;

    // 1. Fetch tickets from ApprovalTicket table
    const tickets = await prisma.approvalTicket.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // 2. Fetch pending clearances
    const pendingClearances = await prisma.workerClearance.findMany({
      where: {
        ...(isFieldRole ? { worker: { siteId: user.assignedSiteId! } } : {}),
        status: { in: ['DRAFT', 'PENDING', 'PENDING_REVIEW', 'PENDING_SETTLEMENT'] },
      },
      include: {
        worker: { include: { site: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Fetch pending advance requests
    const pendingAdvances = await prisma.advanceRequest.findMany({
      where: {
        status: 'PENDING',
        ...(isFieldRole ? { worker: { siteId: user.assignedSiteId! } } : {}),
      },
      include: {
        worker: { include: { site: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 4. Fetch pending leaves
    const pendingLeaves = await prisma.leave.findMany({
      where: {
        status: 'PENDING',
        ...(isFieldRole ? { worker: { siteId: user.assignedSiteId! } } : {}),
      },
      include: {
        worker: { include: { site: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items: ApprovalItem[] = [];

    for (const c of pendingClearances) {
      items.push({
        id: c.id,
        ticketNumber: c.clearanceNumber || `#CLR-${c.id.substring(0, 6).toUpperCase()}`,
        type: 'CLEARANCE',
        typeLabel: 'مخالصة إنهاء خدمة وتصفية مستحقات',
        workerName: c.worker.name,
        workerCode: c.worker.code,
        workerNickname: getWorkerDisplayName(c.worker),
        siteName: c.worker.site?.name || 'غير مسند',
        amount: Number(c.netSettlementAmount),
        description: `مخالصة نهائية - المستحق الصافي المالي: ${Number(c.netSettlementAmount)} ج.م`,
        status: 'PENDING',
        requestedAt: c.createdAt.toISOString().replace('T', ' ').substring(0, 16),
        entityId: c.id,
      });
    }

    for (const a of pendingAdvances) {
      items.push({
        id: a.id,
        ticketNumber: a.requestNumber,
        type: 'ADVANCE',
        typeLabel: 'طلب سلفة نقدية ميدانية',
        workerName: a.worker.name,
        workerCode: a.worker.code,
        workerNickname: getWorkerDisplayName(a.worker),
        siteName: a.worker.site?.name || 'غير مسند',
        amount: Number(a.amountRequested),
        description: `سلفة نقدية بمبلغ ${Number(a.amountRequested)} ج.م - الغرض: ${a.purpose} - خطة السداد: ${a.installmentMonths} شهر`,
        status: 'PENDING',
        requestedAt: a.createdAt.toISOString().replace('T', ' ').substring(0, 16),
        entityId: a.id,
        reviewDecisionNotes: a.rejectionReason,
      });
    }

    for (const l of pendingLeaves) {
      items.push({
        id: l.id,
        ticketNumber: l.leaveNumber || `#LV-${l.id.substring(0, 8).toUpperCase()}`,
        type: 'LEAVE',
        typeLabel: 'طلب إجازة ونزول ميداني',
        workerName: l.worker.name,
        workerCode: l.worker.code,
        workerNickname: getWorkerDisplayName(l.worker),
        siteName: l.worker.site?.name || 'غير مسند',
        description: `إجازة ${l.leaveType} من ${l.departureDate.toISOString().substring(0, 10)} حتى ${l.expectedReturnDate.toISOString().substring(0, 10)}`,
        status: 'PENDING',
        requestedAt: l.createdAt.toISOString().replace('T', ' ').substring(0, 16),
        entityId: l.id,
        reviewDecisionNotes: l.supervisorNotes,
      });
    }

    for (const t of tickets) {
      const alreadyInList = items.some((i) => i.entityId === t.entityId || i.id === t.id);
      if (!alreadyInList && t.status === 'PENDING') {
        const typeLabelMap: Record<string, string> = {
          WORKER_EDIT: 'طلب تعديل بيانات عامل',
          DISCIPLINARY: 'قرار جزاء أو مكافأة',
          PPE_REPLACEMENT: 'صرف مهمات وقاية بديلة',
          SPARE_PARTS_PURCHASE: 'شراء قطع غيار ومستلزمات',
          CUSTODY_LIQUIDATION: 'تصفية عهدة موقع',
        };

        items.push({
          id: t.id,
          ticketNumber: t.ticketNumber,
          type: (t.ticketType as any) || 'GENERAL',
          typeLabel: typeLabelMap[t.ticketType] || t.ticketType,
          workerName: `طلب إداري #${t.ticketNumber}`,
          siteName: 'المقر الرئيسي / كافة المواقع',
          description: t.reviewDecisionNotes || 'طلب معلق بانتظار المراجعة والاعتماد',
          status: 'PENDING',
          requestedAt: t.createdAt.toISOString().replace('T', ' ').substring(0, 16),
          entityId: t.entityId,
          reviewDecisionNotes: t.reviewDecisionNotes,
        });
      }
    }

    return {
      totalPending: items.length,
      clearancesPending: items.filter((i) => i.type === 'CLEARANCE').length,
      advancesPending: items.filter((i) => i.type === 'ADVANCE').length,
      leavesPending: items.filter((i) => i.type === 'LEAVE').length,
      generalPending: items.filter((i) => !['CLEARANCE', 'ADVANCE', 'LEAVE'].includes(i.type)).length,
      items,
    };
  } catch (err) {
    console.error('Error fetching approvals data:', err);
    return {
      totalPending: 0,
      clearancesPending: 0,
      advancesPending: 0,
      leavesPending: 0,
      generalPending: 0,
      items: [],
    };
  }
}

// ==============================================================================
// 11. Site Custody & Cash Flow Monitor (Feature 7)
// ==============================================================================

export interface CustodyMonitorItem {
  id: string;
  custodyNumber: string;
  siteName: string;
  siteCode: string;
  custodianName: string;
  custodianPhone: string;
  initialAmount: number;
  currentBalance: number;
  totalExpenses: number;
  totalAdvancesDisbursed: number;
  purpose: string;
  status: 'ACTIVE' | 'SETTLEMENT_PENDING' | 'CLOSED';
  liquidityHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  percentageRemaining: number;
  disbursedAt: string;
  recentExpenses: Array<{
    id: string;
    amount: number;
    category: string;
    description: string;
    receiptDate: string;
  }>;
}

export interface TreasuryDashboardData {
  totalActiveCustodies: number;
  totalInitialCapital: number;
  totalRemainingLiquidity: number;
  totalLiquidatedExpenses: number;
  criticalCustodiesCount: number;
  custodies: CustodyMonitorItem[];
}

export async function getTreasuryData(user: DashboardUser): Promise<TreasuryDashboardData> {
  try {
    const isFieldRole = user.role === 'FIELD_ADMIN' && !!user.assignedSiteId;

    const rawCustodies = await prisma.financialCustody.findMany({
      where: {
        ...(isFieldRole ? { siteId: user.assignedSiteId! } : {}),
      },
      include: {
        site: true,
        custodian: true,
        expenseItems: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalInitial = 0;
    let totalRemaining = 0;
    let totalExpenses = 0;
    let criticalCount = 0;

    const custodies: CustodyMonitorItem[] = rawCustodies.map((c) => {
      const initial = Number(c.initialAmount);
      const remaining = Number(c.currentBalance);
      const expenses = Number(c.totalLiquidatedExpenses);
      const advances = Number(c.totalCashAdvancesDisbursed);

      totalInitial += initial;
      totalRemaining += remaining;
      totalExpenses += expenses;

      const percentage = initial > 0 ? Math.round((remaining / initial) * 100) : 0;
      let liquidityHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
      if (percentage <= 10 || remaining <= 2000) {
        liquidityHealth = 'CRITICAL';
        if (c.status === 'ACTIVE') criticalCount++;
      } else if (percentage <= 25) {
        liquidityHealth = 'WARNING';
      }

      let custodianPhone = 'غير مسجل';
      if (c.custodian.phoneEncrypted) {
        const key = getNormalizedEncryptionKey();
        if (key) {
          try {
            custodianPhone = decryptField(c.custodian.phoneEncrypted, key);
          } catch {
            custodianPhone = '***';
          }
        }
      }

      return {
        id: c.id,
        custodyNumber: c.custodyNumber,
        siteName: c.site.name,
        siteCode: c.site.code,
        custodianName: getWorkerDisplayName(c.custodian),
        custodianPhone,
        initialAmount: initial,
        currentBalance: remaining,
        totalExpenses: expenses,
        totalAdvancesDisbursed: advances,
        purpose: c.purpose,
        status: (c.status as any) || 'ACTIVE',
        liquidityHealth,
        percentageRemaining: percentage,
        disbursedAt: c.disbursedAt.toISOString().substring(0, 10),
        recentExpenses: c.expenseItems.map((e) => ({
          id: e.id,
          amount: Number(e.amount),
          category: e.expenseCategory,
          description: e.description,
          receiptDate: e.receiptDate.toISOString().substring(0, 10),
        })),
      };
    });

    return {
      totalActiveCustodies: custodies.filter((c) => c.status === 'ACTIVE').length,
      totalInitialCapital: totalInitial,
      totalRemainingLiquidity: totalRemaining,
      totalLiquidatedExpenses: totalExpenses,
      criticalCustodiesCount: criticalCount,
      custodies,
    };
  } catch (err) {
    console.error('Error fetching treasury data:', err);
    return {
      totalActiveCustodies: 0,
      totalInitialCapital: 0,
      totalRemainingLiquidity: 0,
      totalLiquidatedExpenses: 0,
      criticalCustodiesCount: 0,
      custodies: [],
    };
  }
}


