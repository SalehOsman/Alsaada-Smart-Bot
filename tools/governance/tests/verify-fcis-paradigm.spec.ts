import { describe, expect, it } from 'vitest';
import {
  validateFcisCodingParadigm,
  validateStrictFlowIsolation,
} from '../verify-architecture.js';

export const PINNED_BASE_TIME = '2026-04-19T00:00:00.000Z';

describe('Work Plan 101 — FCIS Coding Paradigm & Strict Flow Isolation AST Sentinel', () => {
  it('accepts pure exported functions in flow.keyboard.ts, flow.messages.ts, and flow.validators.ts', () => {
    const pureKeyboard = `
      import { InlineKeyboard } from 'grammy';
      export function buildMainMenuKeyboard(): InlineKeyboard {
        return new InlineKeyboard().text('Start', 'action:start');
      }
    `;
    expect(
      validateFcisCodingParadigm('modules/workforce/src/flows/01.1-worker-registration/flow.keyboard.ts', pureKeyboard)
    ).toEqual([]);

    const pureMessages = `
      export function formatWelcomeMessage(name: string): string {
        return \`Welcome \${name}\`;
      }
    `;
    expect(
      validateFcisCodingParadigm('modules/workforce/src/flows/01.1-worker-registration/flow.messages.ts', pureMessages)
    ).toEqual([]);
  });

  it('rejects classes and static utility classes in Pure FP Core layers (flow.keyboard.ts, validator.ts, route.ts)', () => {
    const staticClassKeyboard = `
      export class WorkerRegistrationKeyboards {
        static docTypeKeyboard() { return {}; }
      }
    `;
    const errors = validateFcisCodingParadigm(
      'modules/workforce/src/flows/01.1-worker-registration/flow.keyboard.ts',
      staticClassKeyboard
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('FCIS_PARADIGM_VIOLATION'))).toBe(true);
  });

  it('rejects flow.messages.ts or flow.keyboard.ts that only export an object literal without top-level export function', () => {
    const objectOnlyMessages = `
      export const WorkerMessages = {
        welcome() { return 'Hello'; }
      };
    `;
    const errors = validateFcisCodingParadigm(
      'modules/workforce/src/flows/01.1-worker-registration/flow.messages.ts',
      objectOnlyMessages
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('FCIS_PARADIGM_VIOLATION'))).toBe(true);
  });

  it('accepts Injectable DI Service and Repository classes without inheritance', () => {
    const diService = `
      export class WorkerRegistrationService {
        constructor(private readonly repo: unknown) {}
        async execute() { return { ok: true }; }
      }
    `;
    expect(
      validateFcisCodingParadigm('modules/workforce/src/flows/01.1-worker-registration/flow.service.ts', diService)
    ).toEqual([]);
  });

  it('rejects class inheritance (extends) in service.ts and repository.ts', () => {
    const inheritedService = `
      class BaseService {}
      export class WorkerRegistrationService extends BaseService {
        constructor() { super(); }
      }
    `;
    const errors = validateFcisCodingParadigm(
      'modules/workforce/src/flows/01.1-worker-registration/flow.service.ts',
      inheritedService
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('extends'))).toBe(true);
  });

  it('rejects cross-flow imports between sibling flows (Zero Cross-Flow Coupling)', () => {
    const crossFlowImport = `
      import { docTypeKeyboard } from '../01.1-worker-registration/flow.keyboard.js';
      export function buildOtherKeyboard() { return docTypeKeyboard(); }
    `;
    const errors = validateStrictFlowIsolation(
      'modules/workforce/src/flows/01.4-worker-export/flow.keyboard.ts',
      '01.4-worker-export',
      crossFlowImport
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('CROSS_FLOW_ISOLATION_BREACH'))).toBe(true);
  });

  it('allows imports from shared module services and @alsaada/* packages inside a flow', () => {
    const validImports = `
      import { InlineKeyboard } from 'grammy';
      import { buildCompletionKeyboard } from '@alsaada/core-components';
      import { workerStorageService } from '../../services/worker-storage.service.js';
      import type { WorkerExportFilter } from './flow.types.js';
      export function buildExportKeyboard() { return new InlineKeyboard(); }
    `;
    const errors = validateStrictFlowIsolation(
      'modules/workforce/src/flows/01.4-worker-export/flow.keyboard.ts',
      '01.4-worker-export',
      validImports
    );
    expect(errors).toEqual([]);
  });
});
