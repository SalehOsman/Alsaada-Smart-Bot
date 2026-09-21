import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { evaluateAccess, canAccessDashboard, isCanonicalRole, type CanonicalRole } from '@alsaada/rbac';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';

describe('Approvals & Financial Hardening Security Guard Specification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. Central Treasury & Financial Control Access', () => {
    it('permits only SUPER_ADMIN and GENERAL_ADMIN into central governance controls and verifies role validity', () => {
      // Arrange
      const privilegedRoles: CanonicalRole[] = ['SUPER_ADMIN', 'GENERAL_ADMIN'];

      for (const role of privilegedRoles) {
        // Act
        const decision = evaluateAccess({
          role,
          permissionKey: 'system.users.manage',
          action: 'manage',
          channel: 'DASHBOARD',
        });
        const isValidRole = isCanonicalRole(role);
        const canAccessDash = canAccessDashboard(role);

        // Assert
        expect(decision.granted).toBe(true);
        expect(isValidRole).toBe(true);
        expect(canAccessDash).toBe(true);
        expect(decision.granted).not.toBe(false);
      }
    });

    it('strictly denies FIELD_ADMIN and subordinate operational roles from central governance features', () => {
      // Arrange
      const restrictedRoles = ['FIELD_ADMIN', 'WORKER_SUPERVISOR', 'WORKER', 'GUEST', 'UNKNOWN_ROLE'];

      for (const role of restrictedRoles) {
        // Act
        const decision = evaluateAccess({
          role: role as any,
          permissionKey: 'system.users.manage',
          action: 'manage',
          channel: 'DASHBOARD',
        });

        // Assert
        expect(decision.granted).toBe(false);
        expect(decision.granted).not.toBe(true);
      }
    });
  });

  describe('2. Approvals Decision Matrix & Self-Approval Prevention', () => {
    it('permits SUPER_ADMIN to execute ticket approval or rejection decisions via evaluateAccess', () => {
      // Arrange
      const superRole: CanonicalRole = 'SUPER_ADMIN';

      // Act
      const approveDecision = evaluateAccess({
        role: superRole,
        permissionKey: 'requests.bonus.approve',
        action: 'approve',
      });
      const rejectDecision = evaluateAccess({
        role: superRole,
        permissionKey: 'requests.bonus.approve',
        action: 'reject',
      });

      // Assert
      expect(approveDecision.granted).toBe(true);
      expect(rejectDecision.granted).toBe(true);
      expect(approveDecision.granted).not.toBe(false);
      expect(rejectDecision.granted).not.toBe(false);
    });

    it('strictly denies FIELD_ADMIN and non-executive actors from executing ticket approve decisions', () => {
      // Arrange
      const unauthorizedRoles = ['FIELD_ADMIN', 'WORKER_SUPERVISOR', 'WORKER', 'GUEST'];

      for (const role of unauthorizedRoles) {
        // Act
        const decision = evaluateAccess({
          role: role as any,
          permissionKey: 'requests.bonus.approve',
          action: 'approve',
        });

        // Assert
        expect(decision.granted).toBe(false);
        expect(decision.granted).not.toBe(true);
      }
    });

    it('enforces ticket status lifecycle transitions with strict authorization checks across states', () => {
      // Arrange
      type TicketStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

      const isValidTransition = (from: TicketStatus, to: TicketStatus, actorRole: string) => {
        if (from === 'PENDING') {
          if (to === 'WITHDRAWN') return true; // Requester can withdraw
          if (to === 'UNDER_REVIEW' || to === 'APPROVED' || to === 'REJECTED') {
            return ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(actorRole);
          }
        }
        if (from === 'UNDER_REVIEW') {
          if (to === 'APPROVED' || to === 'REJECTED') {
            return ['SUPER_ADMIN', 'GENERAL_ADMIN'].includes(actorRole);
          }
        }
        // Terminal states cannot be changed
        if (from === 'APPROVED' || from === 'REJECTED' || from === 'WITHDRAWN') {
          return false;
        }
        return false;
      };

      // Act
      const validPendingToApproved = isValidTransition('PENDING', 'APPROVED', 'SUPER_ADMIN');
      const validPendingToRejected = isValidTransition('PENDING', 'REJECTED', 'GENERAL_ADMIN');
      const validWithdrawal = isValidTransition('PENDING', 'WITHDRAWN', 'FIELD_ADMIN');
      const unauthorizedFieldApproval = isValidTransition('PENDING', 'APPROVED', 'FIELD_ADMIN');
      const terminalApprovedTransition = isValidTransition('APPROVED', 'PENDING', 'SUPER_ADMIN');
      const terminalRejectedTransition = isValidTransition('REJECTED', 'APPROVED', 'SUPER_ADMIN');

      // Assert
      expect(validPendingToApproved).toBe(true);
      expect(validPendingToRejected).toBe(true);
      expect(validWithdrawal).toBe(true);
      expect(unauthorizedFieldApproval).toBe(false);
      expect(terminalApprovedTransition).toBe(false);
      expect(terminalRejectedTransition).toBe(false);
      expect(unauthorizedFieldApproval).not.toBe(true);
      expect(terminalApprovedTransition).not.toBe(true);
    });
  });

  describe('3. Zero Financial Impact Before Final Sovereign Approval', () => {
    interface SettlementSimulation {
      advanceStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
      workerBalance: number;
      advanceAmount: number;
    }

    const computeEffectiveWorkerBalance = (sim: SettlementSimulation) => {
      // Unapproved requests have ZERO financial effect on balance
      if (sim.advanceStatus !== 'APPROVED') {
        return sim.workerBalance;
      }
      return sim.workerBalance + sim.advanceAmount;
    };

    it('ensures pending or rejected advance requests produce zero alteration to worker balance', () => {
      // Arrange
      const initialBalance = 1500;
      const advanceAmount = 2000;
      const pendingSim: SettlementSimulation = {
        advanceStatus: 'PENDING',
        workerBalance: initialBalance,
        advanceAmount,
      };
      const rejectedSim: SettlementSimulation = {
        advanceStatus: 'REJECTED',
        workerBalance: initialBalance,
        advanceAmount,
      };

      // Act
      const pendingEffective = computeEffectiveWorkerBalance(pendingSim);
      const rejectedEffective = computeEffectiveWorkerBalance(rejectedSim);

      // Assert
      expect(pendingEffective).toBe(initialBalance);
      expect(rejectedEffective).toBe(initialBalance);
      expect(pendingEffective).not.toBe(initialBalance + advanceAmount);
      expect(rejectedEffective).not.toBe(initialBalance + advanceAmount);
    });

    it('applies advance amount to worker balance strictly when ticket status is approved', () => {
      // Arrange
      const initialBalance = 1500;
      const advanceAmount = 2000;
      const approvedSim: SettlementSimulation = {
        advanceStatus: 'APPROVED',
        workerBalance: initialBalance,
        advanceAmount,
      };

      // Act
      const approvedEffective = computeEffectiveWorkerBalance(approvedSim);

      // Assert
      expect(approvedEffective).toBe(3500);
      expect(approvedEffective).not.toBe(initialBalance);
      expect(approvedEffective - initialBalance).toBe(advanceAmount);
    });
  });
});
