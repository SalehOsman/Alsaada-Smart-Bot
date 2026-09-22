import { describe, it, expect } from 'vitest';
import {
  CatalogAdapter,
  asFlowId,
  asModuleId,
  TELEGRAM_BUDGET,
  type FlowDefinitionV2,
  type ModuleDefinitionV2,
} from '@alsaada/core-components';

describe('Work Plan 89 — Bot Catalog Integration & Dynamic Routing (Phase P3)', () => {
  const sampleModule: ModuleDefinitionV2 = {
    schemaVersion: '2.0.0',
    id: asModuleId('sample-domain'),
    version: '1.0.0',
    titleArabic: 'موديول الاختبار التجريبي',
    descriptionArabic: 'موديول تجريبي لاختبار التوجيه التلقائي',
    category: 'operations',
    status: 'active',
    requiredCapabilities: [],
    flows: [],
    callbackPrefixes: ['action:sample:', 'wizard:sample:'],
  };

  const sampleFlowActive: FlowDefinitionV2 = {
    schemaVersion: '2.0.0',
    id: asFlowId('89.1'),
    module: asModuleId('sample-domain'),
    slug: 'sample-onboarding',
    titleArabic: 'بدء إجراء تجريبي',
    descriptionArabic: 'تدفق تجريبي نشط',
    category: 'operations',
    status: 'active',
    allowedRoles: ['SUPER_ADMIN', 'FIELD_ADMIN'],
    menuButton: {
      labelArabic: 'تجربة',
      callbackData: 'wizard:sample:start',
      subSection: 'test',
      order: 1,
    },
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
  };

  const sampleFlowDraft: FlowDefinitionV2 = {
    ...sampleFlowActive,
    id: asFlowId('89.2'),
    slug: 'sample-draft-flow',
    titleArabic: 'تدفق مسودة غير منشور',
    status: 'draft',
    menuButton: {
      labelArabic: 'مسودة',
      callbackData: 'wizard:sample:draft_start',
      subSection: 'test',
      order: 2,
    },
  };

  const sampleFlowDisabled: FlowDefinitionV2 = {
    ...sampleFlowActive,
    id: asFlowId('89.3'),
    slug: 'sample-disabled-flow',
    titleArabic: 'تدفق معطل',
    status: 'disabled',
    menuButton: {
      labelArabic: 'معطل',
      callbackData: 'wizard:sample:disabled_start',
      subSection: 'test',
      order: 3,
    },
  };

  const adapter = new CatalogAdapter({
    modules: [sampleModule],
    flows: [sampleFlowActive, sampleFlowDraft, sampleFlowDisabled],
  });

  it('routes valid callback to the active flow for authorized role', () => {
    const decision = adapter.evaluateRouting('wizard:sample:start', 'SUPER_ADMIN');
    expect(decision.allowed).toBe(true);
    expect(decision.moduleId).toBe('sample-domain');
    expect(decision.flow?.id).toBe('89.1');
  });

  it('rejects callback for draft flow with clear Arabic message', () => {
    const decision = adapter.evaluateRouting('wizard:sample:draft_start', 'SUPER_ADMIN');
    expect(decision.allowed).toBe(false);
    expect(decision.rejectionReason).toBe('FLOW_DRAFT');
    expect(decision.messageArabic).toContain('قيد الإعداد التجريبي (Draft)');
  });

  it('rejects callback for disabled flow with clear Arabic message', () => {
    const decision = adapter.evaluateRouting('wizard:sample:disabled_start', 'SUPER_ADMIN');
    expect(decision.allowed).toBe(false);
    expect(decision.rejectionReason).toBe('FLOW_DISABLED');
    expect(decision.messageArabic).toContain('تم إيقاف هذا التدفق مؤقتاً');
  });

  it('rejects action when user role is not authorized for the flow', () => {
    const decision = adapter.evaluateRouting('wizard:sample:start', 'GUEST');
    expect(decision.allowed).toBe(false);
    expect(decision.rejectionReason).toBe('UNAUTHORIZED_ROLE');
    expect(decision.messageArabic).toContain('غير مصرح له');
  });

  it('rejects callback with unknown unregistered prefix', () => {
    const decision = adapter.evaluateRouting('unknown_vendor:action:do_something', 'SUPER_ADMIN');
    expect(decision.allowed).toBe(false);
    expect(decision.rejectionReason).toBe('UNKNOWN_PREFIX');
  });
});
