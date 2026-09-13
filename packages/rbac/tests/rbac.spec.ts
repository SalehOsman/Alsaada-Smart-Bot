import { describe, it, expect } from 'vitest';
import {
  evaluateAccess,
  canAccessDashboard,
  isCanonicalRole,
  isDashboardAuthorizedRole,
  isFieldMasked,
  projectSafeWorkerFields,
  CANONICAL_ROLES,
  DASHBOARD_AUTHORIZED_ROLES,
  CONTRACTUAL_COMPENSATION_FIELDS,
  NON_DELEGATABLE_PERMISSIONS,
  isNonDelegatable,
  CanonicalRole,
} from '../src/index.js';

describe('Central RBAC Engine Specification (@alsaada/rbac)', () => {
  describe('1. Canonical Roles & Dashboard Access Gate', () => {
    it('defines exactly the 7 canonical roles', () => {
      expect(CANONICAL_ROLES).toEqual([
        'SUPER_ADMIN',
        'GENERAL_ADMIN',
        'FIELD_ADMIN',
        'WORKER_SUPERVISOR',
        'WORKER',
        'SUPPLIER',
        'GUEST',
      ]);
    });

    it('identifies canonical roles and rejects deprecated or unknown roles', () => {
      for (const role of CANONICAL_ROLES) {
        expect(isCanonicalRole(role)).toBe(true);
      }
      expect(isCanonicalRole('EXECUTIVE')).toBe(false);
      expect(isCanonicalRole('EXECUTIVE_DIRECTOR')).toBe(false);
      expect(isCanonicalRole('ACCOUNTANT')).toBe(false);
      expect(isCanonicalRole('PROJECT_MANAGER')).toBe(false);
      expect(isCanonicalRole('SITE_ENGINEER')).toBe(false);
      expect(isCanonicalRole('ADMIN')).toBe(false);
      expect(isCanonicalRole('')).toBe(false);
      expect(isCanonicalRole(null)).toBe(false);
    });

    it('strictly permits only SUPER_ADMIN, GENERAL_ADMIN, and FIELD_ADMIN into dashboard', () => {
      expect(canAccessDashboard('SUPER_ADMIN')).toBe(true);
      expect(canAccessDashboard('GENERAL_ADMIN')).toBe(true);
      expect(canAccessDashboard('FIELD_ADMIN')).toBe(true);

      expect(canAccessDashboard('WORKER_SUPERVISOR')).toBe(false);
      expect(canAccessDashboard('WORKER')).toBe(false);
      expect(canAccessDashboard('SUPPLIER')).toBe(false);
      expect(canAccessDashboard('GUEST')).toBe(false);
      expect(canAccessDashboard('EXECUTIVE' as any)).toBe(false);
      expect(canAccessDashboard('ACCOUNTANT' as any)).toBe(false);
    });

    it('blocks dashboard channel access for unauthorized roles in evaluator', () => {
      const decisionWorker = evaluateAccess({
        role: 'WORKER',
        permissionKey: 'workforce.worker.view',
        channel: 'DASHBOARD',
      });
      expect(decisionWorker.granted).toBe(false);
      expect(decisionWorker.reason).toBe('DASHBOARD_ACCESS_DENIED');

      const decisionSupervisor = evaluateAccess({
        role: 'WORKER_SUPERVISOR',
        permissionKey: 'inventory.fuel.level.create',
        channel: 'DASHBOARD',
      });
      expect(decisionSupervisor.granted).toBe(false);
      expect(decisionSupervisor.reason).toBe('DASHBOARD_ACCESS_DENIED');
    });
  });

  describe('2. Strict Contractual Compensation Masking', () => {
    it('strictly masks contractual compensation fields for FIELD_ADMIN', () => {
      for (const field of CONTRACTUAL_COMPENSATION_FIELDS) {
        expect(isFieldMasked('FIELD_ADMIN', 'workforce.compensation.view', field)).toBe(true);
      }
      expect(isFieldMasked('SUPER_ADMIN', 'workforce.compensation.view', 'basicSalary')).toBe(false);
      expect(isFieldMasked('GENERAL_ADMIN', 'workforce.compensation.view', 'basicSalary')).toBe(false);
    });

    it('allows workers to view only their own compensation slip', () => {
      expect(isFieldMasked('WORKER', 'workforce.compensation.view', 'basicSalary', { isSelf: true })).toBe(false);
      expect(isFieldMasked('WORKER', 'workforce.compensation.view', 'basicSalary', { isSelf: false })).toBe(true);
      expect(isFieldMasked('WORKER_SUPERVISOR', 'workforce.compensation.view', 'basicSalary', { isSelf: true })).toBe(false);
      expect(isFieldMasked('WORKER_SUPERVISOR', 'workforce.compensation.view', 'basicSalary', { isSelf: false })).toBe(true);
    });

    it('projects safe worker fields by stripping masked fields', () => {
      const rawWorker = {
        id: 'wrk-001',
        name: 'أحمد محمود',
        jobTitle: 'سائق معدات',
        siteId: 'STE-KHA',
        basicSalary: 8500,
        overtimeRate: 50,
        allowances: 1200,
        totalCompensation: 9700,
      };

      const safeForFieldAdmin = projectSafeWorkerFields(rawWorker, 'FIELD_ADMIN');
      expect(safeForFieldAdmin).toEqual({
        id: 'wrk-001',
        name: 'أحمد محمود',
        jobTitle: 'سائق معدات',
        siteId: 'STE-KHA',
      });
      expect((safeForFieldAdmin as any).basicSalary).toBeUndefined();
      expect((safeForFieldAdmin as any).totalCompensation).toBeUndefined();

      const safeForSuperAdmin = projectSafeWorkerFields(rawWorker, 'SUPER_ADMIN');
      expect(safeForSuperAdmin.basicSalary).toBe(8500);
      expect(safeForSuperAdmin.totalCompensation).toBe(9700);
    });
  });

  describe('3. Worker Supervisor Delegation Lifecycles', () => {
    it('validates active worker supervisor delegation on matching site', () => {
      const decision = evaluateAccess({
        role: 'WORKER_SUPERVISOR',
        permissionKey: 'inventory.fuel.level.create',
        action: 'create',
        siteId: 'STE-KHA',
        delegations: [
          {
            permissionKey: 'inventory.fuel.level.create',
            siteId: 'STE-KHA',
            isActive: true,
          },
        ],
      });
      expect(decision.granted).toBe(true);
      expect(decision.scope).toBe('assigned-resource');
    });

    it('denies worker supervisor when accessing a different site', () => {
      const decision = evaluateAccess({
        role: 'WORKER_SUPERVISOR',
        permissionKey: 'inventory.fuel.level.create',
        action: 'create',
        siteId: 'STE-KHA',
        targetSiteId: 'STE-ASW',
        delegations: [
          {
            permissionKey: 'inventory.fuel.level.create',
            siteId: 'STE-KHA',
            isActive: true,
          },
        ],
      });
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('NO_ACTIVE_DELEGATION_FOR_PERMISSION_OR_SITE');
    });

    it('denies worker supervisor when delegation is inactive or expired', () => {
      const decisionInactive = evaluateAccess({
        role: 'WORKER_SUPERVISOR',
        permissionKey: 'inventory.fuel.level.create',
        action: 'create',
        siteId: 'STE-KHA',
        delegations: [
          {
            permissionKey: 'inventory.fuel.level.create',
            siteId: 'STE-KHA',
            isActive: false,
          },
        ],
      });
      expect(decisionInactive.granted).toBe(false);

      const decisionExpired = evaluateAccess({
        role: 'WORKER_SUPERVISOR',
        permissionKey: 'inventory.fuel.level.create',
        action: 'create',
        siteId: 'STE-KHA',
        delegations: [
          {
            permissionKey: 'inventory.fuel.level.create',
            siteId: 'STE-KHA',
            isActive: true,
            endsAt: new Date(Date.now() - 10000), // in the past
          },
        ],
      });
      expect(decisionExpired.granted).toBe(false);
    });

    it('strictly forbids delegation of sovereign/non-delegatable permissions', () => {
      expect(isNonDelegatable('system.roles.manage')).toBe(true);
      expect(isNonDelegatable('workforce.compensation.edit')).toBe(true);

      const decision = evaluateAccess({
        role: 'WORKER_SUPERVISOR',
        permissionKey: 'system.roles.manage',
        action: 'manage',
        siteId: 'STE-KHA',
        delegations: [
          {
            permissionKey: 'system.roles.manage',
            siteId: 'STE-KHA',
            isActive: true,
          },
        ],
      });
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('FEATURE_NOT_DELEGATABLE');
    });

    it('allows worker supervisor to perform worker self-service operations', () => {
      const decision = evaluateAccess({
        role: 'WORKER_SUPERVISOR',
        permissionKey: 'advances.withdrawals.view',
        action: 'view',
        isSelf: true,
      });
      expect(decision.granted).toBe(true);
      expect(decision.scope).toBe('self');
    });
  });

  describe('4. Account Safety & Deny by Default', () => {
    it('denies banned accounts unconditionally', () => {
      const decision = evaluateAccess({
        role: 'SUPER_ADMIN',
        permissionKey: 'workforce.worker.view',
        isBanned: true,
      });
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('ACCOUNT_BANNED');
    });

    it('denies inactive accounts unconditionally', () => {
      const decision = evaluateAccess({
        role: 'SUPER_ADMIN',
        permissionKey: 'workforce.worker.view',
        isActive: false,
      });
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('ACCOUNT_INACTIVE');
    });

    it('denies unknown permission keys under DENY_BY_DEFAULT', () => {
      const decision = evaluateAccess({
        role: 'FIELD_ADMIN',
        permissionKey: 'non_existent.feature.key',
      });
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('PERMISSION_NOT_FOUND_IN_CATALOG');
    });

    it('enforces site boundary for FIELD_ADMIN', () => {
      const decision = evaluateAccess({
        role: 'FIELD_ADMIN',
        permissionKey: 'workforce.worker.view',
        siteId: 'STE-KHA',
        targetSiteId: 'STE-ASW',
      });
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('SITE_BOUNDARY_VIOLATION');
    });
  });
});
