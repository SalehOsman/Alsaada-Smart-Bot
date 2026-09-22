import { describe, it, expect } from 'vitest';
import {
  TypeSafeFlowRouter,
  asFlowId,
  asModuleId,
  TELEGRAM_BUDGET,
  type FlowDefinitionV2,
} from '@alsaada/core-components';

describe('Work Plan 89 — TypeSafe Session Routing & Idempotency Guard (Phase P3)', () => {
  const sampleFlows: FlowDefinitionV2[] = [
    {
      schemaVersion: '2.0.0',
      id: asFlowId('89.1'),
      module: asModuleId('sample-domain'),
      slug: 'sample-onboarding',
      titleArabic: 'بدء إجراء تجريبي واختبار النواة',
      descriptionArabic: 'تدفق تجريبي لاختبار النواة الذكية والاكتشاف التلقائي',
      category: 'testing',
      status: 'active',
      allowedRoles: ['SUPER_ADMIN'],
      telegramBudget: TELEGRAM_BUDGET,
      idempotencyRequired: true,
      entrypointFiles: {
        contract: 'flow.contract.json',
        handler: 'flow.handler.ts',
        service: 'flow.service.ts',
        keyboard: 'flow.keyboard.ts',
        types: 'flow.types.ts',
        validators: 'flow.validators.ts',
        messages: 'flow.messages.ts',
        telemetry: 'flow.telemetry.ts',
        docs: 'flow.docs.md',
      },
    },
    {
      schemaVersion: '2.0.0',
      id: asFlowId('01.1'),
      module: asModuleId('workforce'),
      slug: 'worker-registration',
      titleArabic: 'تسجيل وتعيين عامل أو موظف جديد',
      descriptionArabic: 'معالج تسجيل بيانات العمالة ورفع المستندات والمطابقة الوطنية',
      category: 'workforce',
      status: 'active',
      allowedRoles: ['SUPER_ADMIN', 'FIELD_ADMIN'],
      telegramBudget: TELEGRAM_BUDGET,
      idempotencyRequired: true,
      entrypointFiles: {
        contract: 'flow.contract.json',
        handler: 'flow.handler.ts',
        service: 'flow.service.ts',
        keyboard: 'flow.keyboard.ts',
        types: 'flow.types.ts',
        validators: 'flow.validators.ts',
        messages: 'flow.messages.ts',
        telemetry: 'flow.telemetry.ts',
        docs: 'flow.docs.md',
      },
    },
  ];

  const router = new TypeSafeFlowRouter(sampleFlows);

  describe('1. Idempotency Key Double-Tap Protection', () => {
    it('grants lock on first attempt and rejects duplicate attempt with same key', () => {
      const idempotencyKey = 'action:tx:worker_onboard:12345';

      const firstAttempt = router.acquireIdempotencyLock(idempotencyKey);
      expect(firstAttempt.acquired).toBe(true);

      const secondAttempt = router.acquireIdempotencyLock(idempotencyKey);
      expect(secondAttempt.acquired).toBe(false);
      expect(secondAttempt.existing?.key).toBe(idempotencyKey);
    });

    it('allows different idempotency keys to proceed concurrently', () => {
      const keyA = 'action:tx:user1:btn1';
      const keyB = 'action:tx:user2:btn2';

      expect(router.acquireIdempotencyLock(keyA).acquired).toBe(true);
      expect(router.acquireIdempotencyLock(keyB).acquired).toBe(true);
    });
  });

  describe('2. TypeSafe Skill Suggestion & Intent Classification', () => {
    it('infers flow 89.1 accurately from Arabic natural language query', async () => {
      const result = await router.suggestFlow('عايز ابدأ إجراء تجريبي للنواة');
      expect(result.suggestedFlowId).toBe('89.1');
      expect(result.domain).toBe('sample-domain');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.latencyMs).toBeLessThan(100);
    });

    it('infers flow 01.1 accurately for worker registration intent', async () => {
      const result = await router.suggestFlow('تسجيل عامل جديد في الموقع');
      expect(result.suggestedFlowId).toBe('01.1');
      expect(result.domain).toBe('workforce');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.latencyMs).toBeLessThan(100);
    });

    it('returns zero confidence for empty or unrecognized input', async () => {
      const result = await router.suggestFlow('  ');
      expect(result.confidence).toBe(0);
      expect(result.suggestedFlowId).toBeUndefined();
    });
  });
});
