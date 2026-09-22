import { describe, it, expect } from 'vitest';
import { validateMonorepoCatalog } from '../validate-catalog.js';
import {
  asCapabilityId,
  asFlowId,
  asModuleId,
  TELEGRAM_BUDGET,
} from '../../../packages/core-components/src/index.js';
import type { MonorepoCatalog, CatalogModuleEntry, CatalogFlowEntry } from '../catalog.js';

describe('Work Plan 89 — Catalog Boundaries & Collision Immunity (Phase P2)', () => {
  const baseModule: CatalogModuleEntry = {
    schemaVersion: '2.0.0',
    id: asModuleId('test-mod-a'),
    version: '1.0.0',
    titleArabic: 'موديول اختبار أ',
    descriptionArabic: 'وصف موديول اختبار أ',
    category: 'operations',
    status: 'active',
    requiredCapabilities: [asCapabilityId('storage:attachment')],
    providedCapabilities: [],
    flows: [],
    callbackPrefixes: ['test-a:'],
    sourceDirectory: 'modules/settings', // Existing dir for boundary test
    isV1Compatible: false,
    moduleHash: 'hash-a',
  };

  const baseFlow: CatalogFlowEntry = {
    schemaVersion: '2.0.0',
    id: asFlowId('89.1'),
    module: asModuleId('test-mod-a'),
    slug: 'test-flow-1',
    titleArabic: 'تدفق اختبار',
    descriptionArabic: 'وصف تدفق اختبار',
    category: 'operations',
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
    sourceDirectory: 'modules/settings/src/flows/00.1-corporate-profile', // Existing dir
    filesHash: 'flow-hash',
  };

  it('rejects catalog with duplicate module IDs', () => {
    const syntheticCatalog: MonorepoCatalog = {
      version: '2.0.0',
      generatedAt: new Date().toISOString(),
      catalogHash: 'hash',
      modules: [baseModule, { ...baseModule }],
      flows: [],
      sourceMap: {},
    };

    const report = validateMonorepoCatalog(syntheticCatalog);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('Duplicate Module ID'))).toBe(true);
  });

  it('rejects catalog with duplicate flow IDs across modules', () => {
    const modB: CatalogModuleEntry = {
      ...baseModule,
      id: asModuleId('test-mod-b'),
      callbackPrefixes: ['test-b:'],
    };

    const flowDup: CatalogFlowEntry = {
      ...baseFlow,
      module: asModuleId('test-mod-b'),
    };

    const syntheticCatalog: MonorepoCatalog = {
      version: '2.0.0',
      generatedAt: new Date().toISOString(),
      catalogHash: 'hash',
      modules: [baseModule, modB],
      flows: [baseFlow, flowDup],
      sourceMap: {},
    };

    const report = validateMonorepoCatalog(syntheticCatalog);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('Duplicate Flow ID'))).toBe(true);
  });

  it('rejects catalog when two modules declare colliding callback prefixes', () => {
    const modB: CatalogModuleEntry = {
      ...baseModule,
      id: asModuleId('test-mod-b'),
      callbackPrefixes: ['test-a:'], // Collision with test-mod-a
    };

    const syntheticCatalog: MonorepoCatalog = {
      version: '2.0.0',
      generatedAt: new Date().toISOString(),
      catalogHash: 'hash',
      modules: [baseModule, modB],
      flows: [],
      sourceMap: {},
    };

    const report = validateMonorepoCatalog(syntheticCatalog);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('Prefix collision'))).toBe(true);
  });

  it('rejects catalog when a module requires an unfulfilled service capability', () => {
    const hungryModule: CatalogModuleEntry = {
      ...baseModule,
      requiredCapabilities: [asCapabilityId('exotic:unobtainable-service')],
    };

    const syntheticCatalog: MonorepoCatalog = {
      version: '2.0.0',
      generatedAt: new Date().toISOString(),
      catalogHash: 'hash',
      modules: [hungryModule],
      flows: [],
      sourceMap: {},
    };

    const report = validateMonorepoCatalog(syntheticCatalog);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('Unresolved Capability'))).toBe(true);
  });

  it('rejects catalog when a flow exceeds Telegram mobile button label budget (16 chars)', () => {
    const longButtonFlow: CatalogFlowEntry = {
      ...baseFlow,
      menuButton: {
        labelArabic: 'هذا الزر طويل جدا ويتجاوز ستة عشر حرفا بالتأكيد',
        callbackData: 'test:btn',
        subSection: 'test',
        order: 1,
      },
    };

    const syntheticCatalog: MonorepoCatalog = {
      version: '2.0.0',
      generatedAt: new Date().toISOString(),
      catalogHash: 'hash',
      modules: [baseModule],
      flows: [longButtonFlow],
      sourceMap: {},
    };

    const report = validateMonorepoCatalog(syntheticCatalog);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('16 characters'))).toBe(true);
  });
});
