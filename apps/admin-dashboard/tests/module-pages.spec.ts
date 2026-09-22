import { describe, it, expect } from 'vitest';
import {
  getDiscoveredModules,
  getDiscoveredFlows,
  getModuleById,
  getFlowById,
  isModuleAuthorized,
  isFlowAuthorized,
} from '../src/lib/module-catalog';

describe('Work Plan 89 — Admin Dashboard Module Pages & RBAC (Phase P4)', () => {
  it('discovers modules and flows from catalog file or fallback', () => {
    const modules = getDiscoveredModules();
    expect(modules.length).toBeGreaterThanOrEqual(2);

    const modIds = modules.map((m) => m.id);
    expect(modIds).toContain('settings');
    expect(modIds).toContain('workforce');
  });

  it('retrieves specific module by ID', () => {
    const settingsMod = getModuleById('settings');
    expect(settingsMod).toBeDefined();
    expect(settingsMod?.titleArabic).toContain('الإعدادات');

    const unknownMod = getModuleById('non-existent-module');
    expect(unknownMod).toBeUndefined();
  });

  it('authorizes SUPER_ADMIN for all active modules', () => {
    expect(isModuleAuthorized('settings', 'SUPER_ADMIN')).toBe(true);
    expect(isModuleAuthorized('workforce', 'SUPER_ADMIN')).toBe(true);
  });

  it('rejects unauthorized roles for unknown or non-matching modules', () => {
    expect(isModuleAuthorized('unknown-mod', 'FIELD_ADMIN')).toBe(false);
  });
});
