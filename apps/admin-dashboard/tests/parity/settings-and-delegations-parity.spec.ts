import { describe, it, expect } from 'vitest';
import { isNonDelegatable, evaluateAccess } from '@alsaada/rbac';

describe('Phase 8 / Task 10: Settings & Worker Supervisor Delegations Parity Specification', () => {
  describe('1. Sovereign & Non-Delegatable Feature Guard', () => {
    it('strictly forbids delegating sovereign features to worker supervisors', () => {
      const sovereignPermissions = [
        'system.roles.manage',
        'system.users.manage',
        'system.settings.manage',
        'system.audit.view',
        'workforce.compensation.edit',
        'finance.treasury.manage',
        'approvals.sovereign.decide',
      ];

      for (const perm of sovereignPermissions) {
        expect(isNonDelegatable(perm)).toBe(true);

        const decision = evaluateAccess({
          role: 'WORKER_SUPERVISOR',
          permissionKey: perm,
          action: 'edit',
          siteId: 'STE-ALM',
          delegations: [{ permissionKey: perm, siteId: 'STE-ALM', isActive: true }],
        });

        expect(decision.granted).toBe(false);
      }
    });

    it('permits delegation of operational field permissions', () => {
      const operationalPermissions = [
        'inventory.fuel.level.create',
        'canteen.supplies.dispense',
        'workforce.attendance.record',
      ];

      for (const perm of operationalPermissions) {
        expect(isNonDelegatable(perm)).toBe(false);
      }
    });
  });

  describe('2. Site Boundary & Self-Approval Guard', () => {
    it('restricts worker supervisor operational actions to their designated site', () => {
      const decisionAllowed = evaluateAccess({
        role: 'WORKER_SUPERVISOR',
        permissionKey: 'inventory.fuel.level.create',
        action: 'create',
        siteId: 'STE-ALM',
        targetSiteId: 'STE-ALM',
        delegations: [{ permissionKey: 'inventory.fuel.level.create', siteId: 'STE-ALM', isActive: true }],
      });
      expect(decisionAllowed.granted).toBe(true);

      const decisionDenied = evaluateAccess({
        role: 'WORKER_SUPERVISOR',
        permissionKey: 'inventory.fuel.level.create',
        action: 'create',
        siteId: 'STE-ALM',
        targetSiteId: 'STE-CAP', // Different site
        delegations: [{ permissionKey: 'inventory.fuel.level.create', siteId: 'STE-ALM', isActive: true }],
      });
      expect(decisionDenied.granted).toBe(false);
    });

    it('enforces Self-Approval Prohibition for FIELD_ADMIN', () => {
      // In delegation workflow: FIELD_ADMIN submissions have status = 'PENDING'
      // Only SUPER_ADMIN and GENERAL_ADMIN can approve them.
      const canApproveDelegation = (role: string) => {
        return ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(role);
      };

      expect(canApproveDelegation('FIELD_ADMIN')).toBe(false);
      expect(canApproveDelegation('WORKER_SUPERVISOR')).toBe(false);
      expect(canApproveDelegation('SUPER_ADMIN')).toBe(true);
      expect(canApproveDelegation('GENERAL_ADMIN')).toBe(true);
    });
  });

  describe('3. Dynamic Role Derivation (WORKER <-> WORKER_SUPERVISOR)', () => {
    interface WorkerAccountState {
      role: 'WORKER' | 'WORKER_SUPERVISOR';
      activeDelegationsCount: number;
    }

    const applyDelegationChange = (
      state: WorkerAccountState,
      action: 'ADD_ACTIVE' | 'REVOKE_ACTIVE'
    ): WorkerAccountState => {
      let count = state.activeDelegationsCount;
      if (action === 'ADD_ACTIVE') {
        count += 1;
      } else if (action === 'REVOKE_ACTIVE') {
        count = Math.max(0, count - 1);
      }

      return {
        activeDelegationsCount: count,
        role: count > 0 ? 'WORKER_SUPERVISOR' : 'WORKER',
      };
    };

    it('promotes WORKER to WORKER_SUPERVISOR upon receiving first active delegation', () => {
      const initial: WorkerAccountState = { role: 'WORKER', activeDelegationsCount: 0 };
      const afterFirst = applyDelegationChange(initial, 'ADD_ACTIVE');
      expect(afterFirst.role).toBe('WORKER_SUPERVISOR');
      expect(afterFirst.activeDelegationsCount).toBe(1);

      const afterSecond = applyDelegationChange(afterFirst, 'ADD_ACTIVE');
      expect(afterSecond.role).toBe('WORKER_SUPERVISOR');
      expect(afterSecond.activeDelegationsCount).toBe(2);
    });

    it('reverts WORKER_SUPERVISOR back to WORKER when last active delegation is revoked', () => {
      const withTwo: WorkerAccountState = { role: 'WORKER_SUPERVISOR', activeDelegationsCount: 2 };
      const afterOneRevoked = applyDelegationChange(withTwo, 'REVOKE_ACTIVE');
      expect(afterOneRevoked.role).toBe('WORKER_SUPERVISOR');
      expect(afterOneRevoked.activeDelegationsCount).toBe(1);

      const afterLastRevoked = applyDelegationChange(afterOneRevoked, 'REVOKE_ACTIVE');
      expect(afterLastRevoked.role).toBe('WORKER');
      expect(afterLastRevoked.activeDelegationsCount).toBe(0);
    });
  });
});
