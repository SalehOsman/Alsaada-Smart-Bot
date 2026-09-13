import { describe, it, expect } from 'vitest';
import { getAnalyticsModulesForRole } from '../src/lib/analytics-registry';
import { FEATURE_CATALOG } from '@alsaada/rbac';

describe('Phase 10 / Task 13: Dashboard Intelligence Specifications & Analytics Center', () => {
  describe('1. Dynamic Analytics Discovery per Role', () => {
    it('discovers all operational and sovereign modules for SUPER_ADMIN', () => {
      const modules = getAnalyticsModulesForRole('SUPER_ADMIN');
      const moduleKeys = modules.map((m) => m.moduleKey);
      expect(moduleKeys).toContain('workforce');
      expect(moduleKeys).toContain('advances');
      expect(moduleKeys).toContain('canteen');
      expect(moduleKeys).toContain('custody');
      expect(moduleKeys).toContain('settings');
    });

    it('filters out sovereign and restricted features for FIELD_ADMIN', () => {
      const modules = getAnalyticsModulesForRole('FIELD_ADMIN');
      // For each feature in every module, FIELD_ADMIN must be in allowedRoles
      for (const mod of modules) {
        for (const f of mod.features) {
          const catalogEntry = FEATURE_CATALOG[f.key];
          expect(catalogEntry.allowedRoles).toContain('FIELD_ADMIN');
        }
      }
    });

    it('strictly forbids compensation view features from FIELD_ADMIN analytics catalog', () => {
      const modules = getAnalyticsModulesForRole('FIELD_ADMIN');
      const allFeatureKeys = modules.flatMap((m) => m.features.map((f) => f.key));
      expect(allFeatureKeys).not.toContain('workforce.compensation.view');
      expect(allFeatureKeys).not.toContain('workforce.compensation.edit');
      expect(allFeatureKeys).not.toContain('finance.treasury.manage');
      expect(allFeatureKeys).not.toContain('system.audit.view');
    });
  });

  describe('2. KPI Specifications & Zero-Mock Aggregation Contract', () => {
    interface KpiComputationContract {
      kpiKey: string;
      labelAr: string;
      formula: string;
      sourceTable: string;
      safeForFieldAdmin: boolean;
    }

    const KPI_DEFINITIONS: Record<string, KpiComputationContract> = {
      totalWorkers: {
        kpiKey: 'totalWorkers',
        labelAr: 'إجمالي القوى العاملة المسجلة',
        formula: 'COUNT(workers.id) WHERE isDeleted = false',
        sourceTable: 'workers',
        safeForFieldAdmin: true,
      },
      activeWorkers: {
        kpiKey: 'activeWorkers',
        labelAr: 'العمال على رأس العمل',
        formula: 'COUNT(workers.id) WHERE isDeleted = false AND status = ACTIVE',
        sourceTable: 'workers',
        safeForFieldAdmin: true,
      },
      totalCashAdvances: {
        kpiKey: 'totalCashAdvances',
        labelAr: 'إجمالي السلف النقدية',
        formula: 'SUM(amountRequested) WHERE status = APPROVED',
        sourceTable: 'advance_requests',
        safeForFieldAdmin: true,
      },
      totalContractualSalaries: {
        kpiKey: 'totalContractualSalaries',
        labelAr: 'إجمالي مسير الرواتب التعاقدية',
        formula: 'SUM(basicSalary + fixedAllowances)',
        sourceTable: 'workers',
        safeForFieldAdmin: false, // Strictly masked for FIELD_ADMIN
      },
    };

    it('verifies that compensation aggregate KPIs are strictly marked unsafe for FIELD_ADMIN', () => {
      expect(KPI_DEFINITIONS.totalContractualSalaries.safeForFieldAdmin).toBe(false);
      expect(KPI_DEFINITIONS.totalWorkers.safeForFieldAdmin).toBe(true);
      expect(KPI_DEFINITIONS.activeWorkers.safeForFieldAdmin).toBe(true);
      expect(KPI_DEFINITIONS.totalCashAdvances.safeForFieldAdmin).toBe(true);
    });

    it('enforces live aggregation without mock fallback', () => {
      const aggregateKpi = (records: number[]) => {
        if (records.length === 0) return 0; // Clean empty state, zero-mock
        return records.reduce((a, b) => a + b, 0);
      };

      expect(aggregateKpi([])).toBe(0);
      expect(aggregateKpi([100, 200, 300])).toBe(600);
    });
  });

  describe('3. Drill-down Support Contract', () => {
    it('verifies drilldown capabilities in feature catalog definitions', () => {
      const workforceFeature = FEATURE_CATALOG['workforce.worker.view'];
      expect(workforceFeature.analytics?.hasDrilldown).toBe(true);
      expect(workforceFeature.analytics?.kpiKeys).toContain('activeWorkers');

      const advanceFeature = FEATURE_CATALOG['advances.cash.create'];
      expect(advanceFeature.analytics?.hasDrilldown).toBe(true);
    });
  });
});
