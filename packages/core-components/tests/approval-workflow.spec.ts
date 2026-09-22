import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UniversalApprovalWorkflow } from '../src/approval-workflow/workflow.js';
import type { ApprovalTicket } from '../src/approval-workflow/types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Universal Approval Workflow — Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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
    createdAt: PINNED_BASE_TIME.getTime(),
  };

  it('1. builds formatted approval card with action buttons', () => {
    // Arrange
    const ticket = { ...sampleTicket };

    // Act
    const card = UniversalApprovalWorkflow.buildApprovalCard(ticket);

    // Assert
    expect(card.text).toContain('REQ-ADV-101');
    expect(card.text).toContain('علي كمال');
    expect(card.keyboard.inline_keyboard.length).toBeGreaterThan(0);
  });

  it('2. transitions multi-tier approvals up the hierarchy upon approval', () => {
    // Arrange
    const ticket = { ...sampleTicket };

    // Act
    // 1. Supervisor approves -> moves to Project Manager
    const step1 = UniversalApprovalWorkflow.processDecision({
      ticket,
      actorTelegramId: 100n,
      actorName: 'م. سامح',
      actorRole: 'PROJECT_MANAGER',
      decision: 'APPROVE',
    });

    // 2. PM approves -> moves to HR
    const step2 = UniversalApprovalWorkflow.processDecision({
      ticket: { ...ticket, currentStatus: 'PENDING_PROJECT_MANAGER' },
      actorTelegramId: 200n,
      actorName: 'م. فؤاد',
      actorRole: 'PROJECT_MANAGER',
      decision: 'APPROVE',
    });

    // 3. HR approves -> Fully Approved
    const step3 = UniversalApprovalWorkflow.processDecision({
      ticket: { ...ticket, currentStatus: 'PENDING_HR' },
      actorTelegramId: 300n,
      actorName: 'أ. طارق',
      actorRole: 'HR_MANAGER',
      decision: 'APPROVE',
    });

    // Assert
    expect(step1.success).toBe(true);
    expect(step1.newStatus).toBe('PENDING_PROJECT_MANAGER');
    expect(step1.isFullyApproved).toBe(false);

    expect(step2.newStatus).toBe('PENDING_HR');
    expect(step2.isFullyApproved).toBe(false);

    expect(step3.newStatus).toBe('APPROVED');
    expect(step3.isFullyApproved).toBe(true);
  });

  it('3. rejects ticket immediately when decision is REJECT with reason', () => {
    // Arrange
    const ticket = { ...sampleTicket };

    // Act
    const rejected = UniversalApprovalWorkflow.processDecision({
      ticket,
      actorTelegramId: 400n,
      actorName: 'المدير المالي',
      actorRole: 'FINANCE_MANAGER',
      decision: 'REJECT',
      rejectionReason: 'تجاوز رصيد السلف المسموح به للعامل هذا الشهر',
    });

    // Assert
    expect(rejected.success).toBe(true);
    expect(rejected.newStatus).toBe('REJECTED');
    expect(rejected.isRejected).toBe(true);
    expect(rejected.messageArabic).toContain('تم رفض الطلب');
  });
});
