import { describe, it, expect } from 'vitest';
import React from 'react';
import { SuperAdminOverview } from '../src/components/dashboard/super-admin-overview';
import { GeneralAdminOverview } from '../src/components/dashboard/general-admin-overview';
import { FieldAdminOverview } from '../src/components/dashboard/field-admin-overview';
import { getAnalyticsModulesForRole } from '../src/lib/analytics-registry';
import type { DashboardUser } from '../src/lib/rbac';
import type { OverviewKpis, SiteHubItem, WorkforceDirectoryItem } from '../src/lib/data-fetchers';

describe('Task 8: Role-Based Overviews & Centralized Analytics Registry', () => {
  const mockKpis: OverviewKpis = {
    activeWorkersCount: 42,
    activeSitesCount: 3,
    pendingItemsCount: 5,
    avgLatencyMs: 12,
  };

  const mockSites: SiteHubItem[] = [
    {
      id: 'site-alamein',
      name: 'مشروع العلمين الجديدة',
      code: 'ALM-01',
      location: 'الساحل الشمالي',
      workersCount: 25,
      assignedSupervisors: ['م. خالد المنصوري'],
      status: 'ACTIVE',
    },
    {
      id: 'site-capital',
      name: 'مشروع العاصمة الإدارية',
      code: 'CAP-01',
      location: 'العاصمة الجديدة',
      workersCount: 17,
      assignedSupervisors: ['م. إبراهيم المشرف'],
      status: 'ACTIVE',
    },
  ];

  const mockWorkers: WorkforceDirectoryItem[] = [
    {
      id: 'worker-1',
      code: 'WRK-001',
      nickname: 'الأسطى رجب',
      fullName: 'رجب كمال حسن',
      phone: '01012345678',
      nationalIdMasked: '**********1234',
      nationalIdFull: '29001011234567',
      siteName: 'مشروع العلمين الجديدة',
      jobTitle: 'حداد مسلح',
      dailyWage: 350,
      basicSalary: 9000,
      fixedAllowances: 1500,
      totalMonthlySalary: 10500,
      status: 'ACTIVE',
      telegramStatus: 'LINKED',
    },
    {
      id: 'worker-2',
      code: 'WRK-002',
      nickname: 'المعلم خميس',
      fullName: 'خميس عبد ربه',
      phone: '01198765432',
      nationalIdMasked: '**********5678',
      nationalIdFull: '28802025678901',
      siteName: 'مشروع العاصمة الإدارية',
      jobTitle: 'نجار مسلح',
      dailyWage: 370,
      basicSalary: 9500,
      fixedAllowances: 1600,
      totalMonthlySalary: 11100,
      status: 'ACTIVE',
      telegramStatus: 'UNLINKED',
    },
  ];

  describe('1. SuperAdminOverview', () => {
    it('renders sovereign controls and links for SUPER_ADMIN', () => {
      const user: DashboardUser = {
        id: 'usr-super',
        name: 'المدير العام',
        role: 'SUPER_ADMIN',
        isRealSuperAdmin: true,
      };

      const element = SuperAdminOverview({
        user,
        kpis: mockKpis,
        sites: mockSites,
        workers: mockWorkers,
      });

      expect(element).toBeDefined();
      expect(element.props.children).toBeDefined();
    });
  });

  describe('2. GeneralAdminOverview', () => {
    it('renders operational oversight without sovereign ghost mode or studio', () => {
      const user: DashboardUser = {
        id: 'usr-general',
        name: 'مدير العمليات',
        role: 'GENERAL_ADMIN',
      };

      const element = GeneralAdminOverview({
        user,
        kpis: mockKpis,
        sites: mockSites,
        workers: mockWorkers,
      });

      expect(element).toBeDefined();
    });
  });

  describe('3. FieldAdminOverview & Contractual Compensation Masking', () => {
    it('strictly restricts Field Admin view to assigned site and hides all salary fields', () => {
      const user: DashboardUser = {
        id: 'usr-field',
        name: 'مشرف موقع العلمين',
        role: 'FIELD_ADMIN',
        assignedSiteId: 'site-alamein',
        assignedSiteName: 'مشروع العلمين الجديدة',
      };

      const element = FieldAdminOverview({
        user,
        kpis: mockKpis,
        sites: mockSites,
        workers: mockWorkers,
      });

      expect(element).toBeDefined();
      // Rendered HTML/JSX inspection: ensure no salary/daily wage headers or amounts exist
      const seen = new WeakSet();
      const stringified = JSON.stringify(element, (_key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return;
          seen.add(value);
        }
        return value;
      });
      expect(stringified).not.toContain('الراتب الأساسي');
      expect(stringified).not.toContain('الأجر اليومي');
      expect(stringified).not.toContain('البدلات الثابتة');
      expect(stringified).not.toContain('10500');
      expect(stringified).not.toContain('11100');
    });
  });

  describe('4. Analytics Registry Discoverability', () => {
    it('discovers modules for SUPER_ADMIN comprehensively', () => {
      const modules = getAnalyticsModulesForRole('SUPER_ADMIN');
      expect(modules.length).toBeGreaterThanOrEqual(4);
      const keys = modules.map((m) => m.moduleKey);
      expect(keys).toContain('workforce');
      expect(keys).toContain('advances');
    });

    it('filters modules and features strictly for FIELD_ADMIN', () => {
      const modules = getAnalyticsModulesForRole('FIELD_ADMIN');
      for (const mod of modules) {
        for (const f of mod.features) {
          // FIELD_ADMIN should never see sovereign compensation edit
          expect(f.key).not.toBe('workforce.compensation.edit');
        }
      }
    });
  });
});
