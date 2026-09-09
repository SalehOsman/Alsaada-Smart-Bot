import { describe, it, expect } from 'vitest';
import { UniversalApprovalWorkflow } from '../src/approval-workflow/workflow.js';
import type { ApprovalTicket } from '../src/approval-workflow/types.js';

describe('Universal Approval Workflow — Tests', () => {
  const sampleTicket: ApprovalTicket = {
    id: 't-1',
    requestId: 'REQ-ADV-101',
    domain: 'ADVANCE',
    requesterId: 'u-1',
    requesterName: 'علي كمال',
    requesterRole: 'SITE_SUPERVISOR',
    targetWorkerCode: 'OP-05',
    targetWorkerName: 'إبراهيم محمود',
    amountOrDetails: '4,000 ج.م',
    reason: 'سلفة طارئة لحالة وفاة',
    currentStatus: 'PENDING_SUPERVISOR',
    approvalHistory: [],
    createdAt: Date.now(),
  };

  it('should build formatted approval card with action buttons', () => {
    const card = UniversalApprovalWorkflow.buildApprovalCard(sampleTicket);
    expect(card.text).toContain('REQ-ADV-101');
    expect(card.text).toContain('علي كمال');
    expect(card.keyboard.inline_keyboard.length).toBeGreaterThan(0);
  });

  it('should transition multi-tier approvals up the hierarchy upon approval', () => {
    // 1. Supervisor approves -> moves to Project Manager
    const step1 = UniversalApprovalWorkflow.processDecision({
      ticket: sampleTicket,
      actorTelegramId: 100n,
      actorName: 'م. سامح',
      actorRole: 'PROJECT_MANAGER',
      decision: 'APPROVE',
    });
    expect(step1.success).toBe(true);
    expect(step1.newStatus).toBe('PENDING_PROJECT_MANAGER');
    expect(step1.isFullyApproved).toBe(false);

    // 2. PM approves -> moves to HR
    const step2 = UniversalApprovalWorkflow.processDecision({
      ticket: { ...sampleTicket, currentStatus: 'PENDING_PROJECT_MANAGER' },
      actorTelegramId: 200n,
      actorName: 'م. فؤاد',
      actorRole: 'PROJECT_MANAGER',
      decision: 'APPROVE',
    });
    expect(step2.newStatus).toBe('PENDING_HR');
    expect(step2.isFullyApproved).toBe(false);

    // 3. HR approves -> Fully Approved
    const step3 = UniversalApprovalWorkflow.processDecision({
      ticket: { ...sampleTicket, currentStatus: 'PENDING_HR' },
      actorTelegramId: 300n,
      actorName: 'أ. طارق',
      actorRole: 'HR_MANAGER',
      decision: 'APPROVE',
    });
    expect(step3.newStatus).toBe('APPROVED');
    expect(step3.isFullyApproved).toBe(true);
  });

  it('should reject ticket immediately when decision is REJECT with reason', () => {
    const rejected = UniversalApprovalWorkflow.processDecision({
      ticket: sampleTicket,
      actorTelegramId: 400n,
      actorName: 'المدير المالي',
      actorRole: 'FINANCE_MANAGER',
      decision: 'REJECT',
      rejectionReason: 'تجاوز رصيد السلف المسموح به للعامل هذا الشهر',
    });

    expect(rejected.success).toBe(true);
    expect(rejected.newStatus).toBe('REJECTED');
    expect(rejected.isRejected).toBe(true);
    expect(rejected.messageArabic).toContain('تم رفض الطلب');
  });
});
