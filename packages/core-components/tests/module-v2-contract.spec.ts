import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const PINNED_BASE_TIME = new Date('2026-03-01T12:00:00.000Z');

describe('Work Plan 89 — Universal Module & Flow V2 Contracts', () => {
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

  describe('1. Nominal Branded Types & Constructors', () => {
    it('01: creates valid ModuleId from conforming string and rejects invalid formats', () => {
      // Arrange
      const rawValid = 'sample-domain';

      // Act
      const valid = asModuleId(rawValid);

      // Assert
      expect(valid).toBe('sample-domain');
      expect(() => asModuleId('Invalid_Module')).toThrow(/Invalid ModuleId/);
      expect(() => asModuleId('with spaces')).toThrow(/Invalid ModuleId/);
      expect(() => asModuleId('-leading-dash')).toThrow(/Invalid ModuleId/);
    });

    it('02: creates valid FlowId from conforming string and rejects invalid formats', () => {
      // Arrange
      const raw891 = '89.1';
      const raw012D = '01.2.D';

      // Act
      const flow891 = asFlowId(raw891);
      const flow012D = asFlowId(raw012D);

      // Assert
      expect(flow891).toBe('89.1');
      expect(flow012D).toBe('01.2.D');
      expect(() => asFlowId('invalid-flow')).toThrow(/Invalid FlowId/);
      expect(() => asFlowId('1.1')).toThrow(/Invalid FlowId/);
      expect(() => asFlowId('abc')).toThrow(/Invalid FlowId/);
    });

    it('03: creates valid CapabilityId from conforming string and rejects invalid formats', () => {
      // Arrange
      const rawCap = 'storage:attachment';

      // Act
      const cap = asCapabilityId(rawCap);

      // Assert
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

    it('04: validates a conforming Flow V2 contract successfully', () => {
      // Arrange
      const flowInput = { ...validFlowRaw };

      // Act
      const result = validateFlowDefinitionV2(flowInput);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.flow?.id).toBe('89.1');
      expect(result.flow?.telegramBudget.maxCallbackBytes).toBe(64);
      expect(result.flow?.telegramBudget.maxButtonChars).toBe(16);
    });

    it('05: rejects flow contract with invalid schemaVersion', () => {
      // Arrange
      const invalidVersionFlow = {
        ...validFlowRaw,
        schemaVersion: '1.0.0',
      };

      // Act
      const result = validateFlowDefinitionV2(invalidVersionFlow);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid schemaVersion'))).toBe(true);
    });

    it('06: enforces Telegram mobile ergonomics and rejects button label exceeding 16 chars', () => {
      // Arrange
      const overflowFlow = {
        ...validFlowRaw,
        menuButton: {
          ...validFlowRaw.menuButton,
          labelArabic: 'هذا الزر طويل جدا ويتجاوز ستة عشر حرفا',
        },
      };

      // Act
      const result = validateFlowDefinitionV2(overflowFlow);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('maxButtonChars') || e.includes('16 characters'))).toBe(true);
    });

    it('07: enforces Telegram callback data limit and rejects callback exceeding 64 bytes', () => {
      // Arrange
      const longCallback = 'a'.repeat(65);
      const overflowCallbackFlow = {
        ...validFlowRaw,
        menuButton: {
          ...validFlowRaw.menuButton,
          callbackData: longCallback,
        },
      };

      // Act
      const result = validateFlowDefinitionV2(overflowCallbackFlow);

      // Assert
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

    it('08: validates a conforming Module V2 contract successfully', () => {
      // Arrange
      const moduleInput = { ...validModuleRaw };

      // Act
      const result = validateModuleDefinitionV2(moduleInput);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.module?.id).toBe('sample-domain');
      expect(result.module?.flows).toHaveLength(1);
    });

    it('09: rejects module with invalid non-semver version', () => {
      // Arrange
      const invalidVersionModule = {
        ...validModuleRaw,
        version: 'v1-beta',
      };

      // Act
      const result = validateModuleDefinitionV2(invalidVersionModule);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('semver'))).toBe(true);
    });

    it('10: rejects module when a child flow declares a mismatched module ID', () => {
      // Arrange
      const mismatchedModule = {
        ...validModuleRaw,
        flows: [
          {
            ...validModuleRaw.flows[0],
            module: 'other-module',
          },
        ],
      };

      // Act
      const result = validateModuleDefinitionV2(mismatchedModule);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('module mismatch'))).toBe(true);
    });

    it('11: rejects module with empty callback prefixes', () => {
      // Arrange
      const emptyPrefixModule = {
        ...validModuleRaw,
        callbackPrefixes: [],
      };

      // Act
      const result = validateModuleDefinitionV2(emptyPrefixModule);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('callbackPrefixes'))).toBe(true);
    });
  });

  describe('4. Service Capability Registry & Dependency Resolution', () => {
    it('12: verifies that core provides mandatory capabilities', () => {
      // Arrange
      const minCapabilitiesCount = 10;

      // Act
      const capIds = CORE_CAPABILITIES.map((c) => c.id);

      // Assert
      expect(CORE_CAPABILITIES.length).toBeGreaterThanOrEqual(minCapabilitiesCount);
      expect(capIds).toContain('storage:attachment');
      expect(capIds).toContain('ledger:double-entry');
      expect(capIds).toContain('rbac:cascading');
      expect(capIds).toContain('typesafe:system-one-router');
    });

    it('13: successfully satisfies module requirements when all capabilities exist', () => {
      // Arrange
      const required = [asCapabilityId('storage:attachment'), asCapabilityId('rbac:cascading')];

      // Act
      const res = validateModuleCapabilities(required);

      // Assert
      expect(res.valid).toBe(true);
      expect(res.missing).toHaveLength(0);
      expect(res.satisfied).toHaveLength(2);
    });

    it('14: reports missing capabilities when an unfulfilled requirement is requested', () => {
      // Arrange
      const required = [asCapabilityId('storage:attachment'), asCapabilityId('unknown:exotic-service')];

      // Act
      const res = validateModuleCapabilities(required);

      // Assert
      expect(res.valid).toBe(false);
      expect(res.missing).toContain('unknown:exotic-service');
      expect(res.satisfied).toContain('storage:attachment');
    });
  });

  describe('5. TypeSafe System One Question Primitives', () => {
    it('15: supports Choice, Noul, and Score question typing and discriminator', () => {
      // Arrange
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

      // Act
      const questions: TypeSafeQuestionConfig[] = [choiceQ, noulQ, scoreQ];

      // Assert
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

    it('16: throws when assertNever is reached', () => {
      // Arrange
      const unreachableValue = 'unexpected' as never;

      // Act
      const throwAction = () => assertNever(unreachableValue);

      // Assert
      expect(throwAction).toThrow(/Unexpected unreachable branch/);
    });
  });
});
