import { describe, it, expect } from 'vitest';
import {
  evaluateCascadingAccess,
  getAllWorkerSupervisorProfiles,
  getWorkerSupervisorProfile,
  isWorkerSupervisorProfileKey,
  WORKER_SUPERVISOR_PROFILES,
  type ScopePermissionRule,
} from '../src/index.js';

describe('Hardened Cascading RBAC Evaluator & Supervisor Lifecycles Specification', () => {
  describe('1. Five-Layer Cascading Hierarchy & Explicit DENY Trumps ALLOW', () => {
    it('enforces USER level rule over lower levels (USER > ROLE)', () => {
      // Role has ALLOW, but USER has explicit DENY
      const rules: ScopePermissionRule[] = [
        {
          scopeType: 'ROLE',
          scopeId: 'FIELD_ADMIN',
          featureKey: 'advances.cash.create',
          action: 'create',
          policy: 'ALLOW',
        },
        {
          scopeType: 'USER',
          scopeId: 'user-001',
          featureKey: 'advances.cash.create',
          action: 'create',
          policy: 'DENY',
        },
      ];

      const decision = evaluateCascadingAccess({
        role: 'FIELD_ADMIN',
        userId: 'user-001',
        siteId: 'STE-KHA',
        permissionKey: 'advances.cash.create',
        action: 'create',
        rules,
      });

      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('EXPLICIT_DENIED');
    });

    it('enforces SITE level rule over DEPARTMENT and ROLE levels', () => {
      // Department allows, but Site explicitly denies
      const rules: ScopePermissionRule[] = [
        {
          scopeType: 'DEPARTMENT',
          scopeId: 'dept-ops',
          featureKey: 'canteen.sale.create',
          action: 'create',
          policy: 'ALLOW',
        },
        {
          scopeType: 'SITE',
          scopeId: 'STE-KHA',
          featureKey: 'canteen.sale.create',
          action: 'create',
          policy: 'DENY',
        },
      ];

      const decision = evaluateCascadingAccess({
        role: 'FIELD_ADMIN',
        userId: 'user-002',
        siteId: 'STE-KHA',
        departmentId: 'dept-ops',
        permissionKey: 'canteen.sale.create',
        action: 'create',
        rules,
      });

      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('EXPLICIT_DENIED');
    });

    it('grants permission when a layer provides ALLOW and no higher layer denies', () => {
      const rules: ScopePermissionRule[] = [
        {
          scopeType: 'JOB_TITLE',
          scopeId: 'job-fuel-manager',
          featureKey: 'inventory.fuel.level.create',
          action: 'create',
          policy: 'ALLOW',
        },
      ];

      const decision = evaluateCascadingAccess({
        role: 'WORKER',
        userId: 'user-003',
        siteId: 'STE-KHA',
        jobTitleId: 'job-fuel-manager',
        permissionKey: 'inventory.fuel.level.create',
        action: 'create',
        rules,
      });

      expect(decision.granted).toBe(true);
      expect(decision.allowedActions).toContain('create');
    });

    it('enforces DENY over ALLOW when conflicting policies exist within the same level', () => {
      const rules: ScopePermissionRule[] = [
        {
          scopeType: 'ROLE',
          scopeId: 'FIELD_ADMIN',
          featureKey: 'custody.expense.create',
          action: 'create',
          policy: 'ALLOW',
        },
        {
          scopeType: 'ROLE',
          scopeId: 'FIELD_ADMIN',
          featureKey: 'custody.expense.create',
          action: 'create',
          policy: 'DENY',
        },
      ];

      const decision = evaluateCascadingAccess({
        role: 'FIELD_ADMIN',
        userId: 'user-004',
        siteId: 'STE-KHA',
        permissionKey: 'custody.expense.create',
        action: 'create',
        rules,
      });

      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('EXPLICIT_DENIED');
    });
  });

  describe('2. Immutable Super Admin Bypass', () => {
    it('SUPER_ADMIN bypasses explicit DENY rules unconditionally', () => {
      const rules: ScopePermissionRule[] = [
        {
          scopeType: 'USER',
          scopeId: 'super-admin-01',
          featureKey: 'system.roles.manage',
          action: 'manage',
          policy: 'DENY',
        },
      ];

      const decision = evaluateCascadingAccess({
        role: 'SUPER_ADMIN',
        userId: 'super-admin-01',
        permissionKey: 'system.roles.manage',
        action: 'manage',
        rules,
      });

      expect(decision.granted).toBe(true);
      expect(decision.reason).toBe('IMMUTABLE_BYPASS');
      expect(decision.scope).toBe('system');
    });

    it('SUPER_ADMIN is never frozen when on leave', () => {
      const decision = evaluateCascadingAccess({
        role: 'SUPER_ADMIN',
        userId: 'super-admin-01',
        permissionKey: 'system.users.manage',
        action: 'manage',
        isOnLeave: true,
        freezeBotAccessOnLeave: true,
      });

      expect(decision.granted).toBe(true);
      expect(decision.reason).toBe('IMMUTABLE_BYPASS');
    });
  });

  describe('3. Configurable Leave Policy (Bot Freeze & Vacation Permissions)', () => {
    it('freezes operational bot features when supervisor is on leave by default (freezeBotAccessOnLeave = true)', () => {
      const decision = evaluateCascadingAccess({
        role: 'FIELD_ADMIN',
        userId: 'admin-001',
        siteId: 'STE-KHA',
        permissionKey: 'advances.cash.create',
        action: 'create',
        isOnLeave: true,
        freezeBotAccessOnLeave: true,
      });

      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('ON_LEAVE_FREEZE');
    });

    it('allows remote operational monitoring when management unfreezes leave (freezeBotAccessOnLeave = false)', () => {
      const decision = evaluateCascadingAccess({
        role: 'FIELD_ADMIN',
        userId: 'admin-002',
        siteId: 'STE-KHA',
        permissionKey: 'advances.cash.create',
        action: 'create',
        isOnLeave: true,
        freezeBotAccessOnLeave: false, // Configured leave policy override
      });

      expect(decision.granted).toBe(true);
      expect(decision.scope).toBe('assigned-site');
    });

    it('allows self-service compensation slip review during leave even when freezeBotAccessOnLeave = true', () => {
      const decision = evaluateCascadingAccess({
        role: 'FIELD_ADMIN',
        userId: 'admin-003',
        siteId: 'STE-KHA',
        permissionKey: 'workforce.compensation.view',
        action: 'view',
        isSelf: true,
        isOnLeave: true,
        freezeBotAccessOnLeave: true,
      });

      expect(decision.granted).toBe(true);
      expect(decision.scope).toBe('self');
    });
  });

  describe('4. Field Admin Full Site Operational Scope & Cryptographic Masking', () => {
    it('grants FIELD_ADMIN all site operational features without picking single jobs', () => {
      const features = [
        'workforce.worker.create',
        'advances.cash.create',
        'canteen.sale.create',
        'custody.expense.create',
        'inventory.fuel.level.create',
        'requests.bonus.submit',
      ];

      for (const feature of features) {
        const decision = evaluateCascadingAccess({
          role: 'FIELD_ADMIN',
          userId: 'admin-005',
          siteId: 'STE-KHA',
          permissionKey: feature,
        });

        expect(decision.granted).toBe(true);
        expect(decision.scope).toBe('assigned-site');
      }
    });

    it('strictly denies sovereign administrative features to FIELD_ADMIN', () => {
      const sovereignFeatures = [
        'system.roles.manage',
        'system.matrix.manage',
        'system.audit.view',
        'requests.bonus.approve',
        'workforce.compensation.edit',
      ];

      for (const feature of sovereignFeatures) {
        const decision = evaluateCascadingAccess({
          role: 'FIELD_ADMIN',
          userId: 'admin-005',
          siteId: 'STE-KHA',
          permissionKey: feature,
        });

        expect(decision.granted).toBe(false);
        expect(decision.reason).toBe('ROLE_NOT_AUTHORIZED_FOR_FEATURE');
      }
    });

    it('strictly masks salary and contractual compensation fields for FIELD_ADMIN', () => {
      const decision = evaluateCascadingAccess({
        role: 'FIELD_ADMIN',
        userId: 'admin-005',
        siteId: 'STE-KHA',
        permissionKey: 'workforce.compensation.view',
        isSelf: false,
      });

      expect(decision.granted).toBe(true);
      expect(decision.fieldMask).toBeDefined();
      expect(decision.fieldMask).toContain('basicSalary');
      expect(decision.fieldMask).toContain('overtimeRate');
      expect(decision.fieldMask).toContain('totalCompensation');
    });

    it('enforces site boundary restrictions when FIELD_ADMIN targets another site', () => {
      const decision = evaluateCascadingAccess({
        role: 'FIELD_ADMIN',
        userId: 'admin-005',
        siteId: 'STE-KHA',
        targetSiteId: 'STE-ASW',
        permissionKey: 'advances.cash.create',
      });

      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe('SITE_BOUNDARY_VIOLATION');
    });
  });

  describe('5. Worker Supervisor Profile Templates Engine', () => {
    it('defines exactly the 4 standard worker supervisor profiles', () => {
      const profiles = getAllWorkerSupervisorProfiles();
      expect(profiles).toHaveLength(4);

      const keys = profiles.map((p) => p.key);
      expect(keys).toContain('FUEL_SUPERVISOR');
      expect(keys).toContain('CANTEEN_SUPERVISOR');
      expect(keys).toContain('HOUSING_SUPERVISOR');
      expect(keys).toContain('SHIFT_SUPERVISOR');
    });

    it('validates profile keys with isWorkerSupervisorProfileKey', () => {
      expect(isWorkerSupervisorProfileKey('FUEL_SUPERVISOR')).toBe(true);
      expect(isWorkerSupervisorProfileKey('CANTEEN_SUPERVISOR')).toBe(true);
      expect(isWorkerSupervisorProfileKey('HOUSING_SUPERVISOR')).toBe(true);
      expect(isWorkerSupervisorProfileKey('SHIFT_SUPERVISOR')).toBe(true);
      expect(isWorkerSupervisorProfileKey('UNKNOWN_PROFILE')).toBe(false);
    });

    it('provides accurate permissions for FUEL_SUPERVISOR', () => {
      const profile = getWorkerSupervisorProfile('FUEL_SUPERVISOR');
      expect(profile).toBeDefined();
      expect(profile?.permissions).toEqual([
        {
          permissionKey: 'inventory.fuel.level.create',
          actions: ['create', 'view'],
        },
      ]);
    });

    it('provides accurate permissions for CANTEEN_SUPERVISOR', () => {
      const profile = getWorkerSupervisorProfile('CANTEEN_SUPERVISOR');
      expect(profile).toBeDefined();
      expect(profile?.permissions.map((p) => p.permissionKey)).toEqual([
        'canteen.sale.create',
        'canteen.sale.view',
      ]);
    });
  });
});
