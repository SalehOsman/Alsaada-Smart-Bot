import { describe, it, expect } from 'vitest';
import {
  asCapabilityId,
  asFlowId,
  asModuleId,
  assertNever,
  CORE_CAPABILITIES,
  validateFlowDefinitionV2,
  validateModuleCapabilities,
  validateModuleDefinitionV2,
  TELEGRAM_BUDGET,
  type ChoiceQuestionConfig,
  type NoulQuestionConfig,
  type ScoreQuestionConfig,
  type TypeSafeQuestionConfig,
} from '../src/contracts/index.js';

describe('Work Plan 89 — Universal Module & Flow V2 Contracts', () => {
  describe('1. Nominal Branded Types & Constructors', () => {
    it('creates valid ModuleId from conforming string and rejects invalid formats', () => {
      const valid = asModuleId('sample-domain');
      expect(valid).toBe('sample-domain');

      expect(() => asModuleId('Invalid_Module')).toThrow(/Invalid ModuleId/);
      expect(() => asModuleId('with spaces')).toThrow(/Invalid ModuleId/);
      expect(() => asModuleId('-leading-dash')).toThrow(/Invalid ModuleId/);
    });

    it('creates valid FlowId from conforming string and rejects invalid formats', () => {
      const flow891 = asFlowId('89.1');
      const flow012D = asFlowId('01.2.D');
      expect(flow891).toBe('89.1');
      expect(flow012D).toBe('01.2.D');

      expect(() => asFlowId('invalid-flow')).toThrow(/Invalid FlowId/);
      expect(() => asFlowId('1.1')).toThrow(/Invalid FlowId/);
      expect(() => asFlowId('abc')).toThrow(/Invalid FlowId/);
    });

    it('creates valid CapabilityId from conforming string and rejects invalid formats', () => {
      const cap = asCapabilityId('storage:attachment');
      expect(cap).toBe('storage:attachment');

      expect(() => asCapabilityId('invalidCapability')).toThrow(/Invalid CapabilityId/);
      expect(() => asCapabilityId('no-colon')).toThrow(/Invalid CapabilityId/);
    });
  });

  describe('2. Flow V2 Contract & Telegram Ergonomics Validation', () => {
    const validFlowRaw = {
      schemaVersion: '2.0.0',
      id: '89.1',
      module: 'sample-domain',
      slug: 'sample-onboarding',
      titleArabic: 'بدء إجراء تجريبي',
      descriptionArabic: 'تدفق تجريبي لإثبات صحة النواة الذكية والاكتشاف التلقائي',
      category: 'testing',
      status: 'active',
      allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
      menuButton: {
        labelArabic: 'تجربة النواة',
        callbackData: 'flow:sample:start',
        subSection: 'testing',
        order: 1,
      },
      idempotencyRequired: true,
      telegramBudget: TELEGRAM_BUDGET,
    };

    it('validates a conforming Flow V2 contract successfully', () => {
      const result = validateFlowDefinitionV2(validFlowRaw);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.flow?.id).toBe('89.1');
      expect(result.flow?.telegramBudget.maxCallbackBytes).toBe(64);
      expect(result.flow?.telegramBudget.maxButtonChars).toBe(16);
    });

    it('rejects flow contract with invalid schemaVersion', () => {
      const result = validateFlowDefinitionV2({
        ...validFlowRaw,
        schemaVersion: '1.0.0',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid schemaVersion'))).toBe(true);
    });

    it('enforces Telegram mobile ergonomics: rejects button label exceeding 16 chars', () => {
      const result = validateFlowDefinitionV2({
        ...validFlowRaw,
        menuButton: {
          ...validFlowRaw.menuButton,
          labelArabic: 'هذا الزر طويل جدا ويتجاوز ستة عشر حرفا',
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('maxButtonChars') || e.includes('16 characters'))).toBe(true);
    });

    it('enforces Telegram callback data limit: rejects callback exceeding 64 bytes', () => {
      const longCallback = 'a'.repeat(65);
      const result = validateFlowDefinitionV2({
        ...validFlowRaw,
        menuButton: {
          ...validFlowRaw.menuButton,
          callbackData: longCallback,
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('64 bytes'))).toBe(true);
    });
  });

  describe('3. Module V2 Contract Validation', () => {
    const validModuleRaw = {
      schemaVersion: '2.0.0',
      id: 'sample-domain',
      version: '1.0.0',
      titleArabic: 'موديول الاختبار التجريبي',
      descriptionArabic: 'موديول تجريبي لاختبار الاكتشاف التلقائي والنواة المستقرة',
      category: 'testing',
      status: 'active',
      requiredCapabilities: ['storage:attachment', 'ledger:double-entry'],
      providedCapabilities: [],
      callbackPrefixes: ['action:sample:', 'wizard:sample:'],
      flows: [
        {
          schemaVersion: '2.0.0',
          id: '89.1',
          module: 'sample-domain',
          slug: 'sample-onboarding',
          titleArabic: 'بدء إجراء تجريبي',
          descriptionArabic: 'تدفق تجريبي لإثبات صحة النواة الذكية',
          status: 'active',
          allowedRoles: ['SUPER_ADMIN'],
          telegramBudget: TELEGRAM_BUDGET,
          idempotencyRequired: true,
        },
      ],
    };

    it('validates a conforming Module V2 contract successfully', () => {
      const result = validateModuleDefinitionV2(validModuleRaw);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.module?.id).toBe('sample-domain');
      expect(result.module?.flows).toHaveLength(1);
    });

    it('rejects module with invalid non-semver version', () => {
      const result = validateModuleDefinitionV2({
        ...validModuleRaw,
        version: 'v1-beta',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('semver'))).toBe(true);
    });

    it('rejects module when a child flow declares a mismatched module ID', () => {
      const result = validateModuleDefinitionV2({
        ...validModuleRaw,
        flows: [
          {
            ...validModuleRaw.flows[0],
            module: 'other-module',
          },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('module mismatch'))).toBe(true);
    });

    it('rejects module with empty callback prefixes', () => {
      const result = validateModuleDefinitionV2({
        ...validModuleRaw,
        callbackPrefixes: [],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('callbackPrefixes'))).toBe(true);
    });
  });

  describe('4. Service Capability Registry & Dependency Resolution', () => {
    it('verifies that core provides mandatory capabilities', () => {
      expect(CORE_CAPABILITIES.length).toBeGreaterThanOrEqual(10);
      const capIds = CORE_CAPABILITIES.map((c) => c.id);
      expect(capIds).toContain('storage:attachment');
      expect(capIds).toContain('ledger:double-entry');
      expect(capIds).toContain('rbac:cascading');
      expect(capIds).toContain('typesafe:system-one-router');
    });

    it('successfully satisfies module requirements when all capabilities exist', () => {
      const required = [asCapabilityId('storage:attachment'), asCapabilityId('rbac:cascading')];
      const res = validateModuleCapabilities(required);
      expect(res.valid).toBe(true);
      expect(res.missing).toHaveLength(0);
      expect(res.satisfied).toHaveLength(2);
    });

    it('reports missing capabilities when an unfulfilled requirement is requested', () => {
      const required = [asCapabilityId('storage:attachment'), asCapabilityId('unknown:exotic-service')];
      const res = validateModuleCapabilities(required);
      expect(res.valid).toBe(false);
      expect(res.missing).toContain('unknown:exotic-service');
      expect(res.satisfied).toContain('storage:attachment');
    });
  });

  describe('5. TypeSafe System One Question Primitives', () => {
    it('supports Choice, Noul, and Score question typing and discriminator', () => {
      const choiceQ: ChoiceQuestionConfig<'approve' | 'reject' | 'escalate'> = {
        id: 'q-approval',
        type: 'choice',
        question: 'ما هو الإجراء الإداري الموصى به لهذه المعاملة؟',
        options: ['approve', 'reject', 'escalate'],
        confidenceThreshold: 0.85,
        defaultFallback: 'escalate',
      };

      const noulQ: NoulQuestionConfig = {
        id: 'q-salary-leak',
        type: 'noul',
        question: 'هل تحتوي هذه الرسالة على أي إفشاء لبيانات الرواتب السرية؟',
        confidenceThreshold: 0.95,
        defaultFallback: true,
      };

      const scoreQ: ScoreQuestionConfig = {
        id: 'q-risk-score',
        type: 'score',
        question: 'ما هو مؤشر خطورة التجاوز المالي من 0 إلى 1؟',
        minAcceptableScore: 0.0,
        maxScore: 1.0,
        defaultFallback: 0.5,
      };

      const questions: TypeSafeQuestionConfig[] = [choiceQ, noulQ, scoreQ];
      expect(questions).toHaveLength(3);

      for (const q of questions) {
        switch (q.type) {
          case 'choice':
            expect(q.options).toContain('approve');
            break;
          case 'noul':
            expect(q.confidenceThreshold).toBe(0.95);
            break;
          case 'score':
            expect(q.maxScore).toBe(1.0);
            break;
          default:
            assertNever(q);
        }
      }
    });

    it('throws when assertNever is reached', () => {
      expect(() => assertNever('unexpected' as never)).toThrow(/Unexpected unreachable branch/);
    });
  });
});
