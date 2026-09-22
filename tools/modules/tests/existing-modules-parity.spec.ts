import { existsSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { scanMonorepoCatalog } from '../catalog.js';
import { validateMonorepoCatalog } from '../validate-catalog.js';

describe('Work Plan 89 — Existing Modules Parity & Compatibility Bridges (Phase P8)', () => {
  const catalog = scanMonorepoCatalog();

  it('P8.1: discovers existing core modules (settings and workforce) via V1 compatibility bridge', () => {
    expect(catalog.version).toBe('2.0.0');
    expect(catalog.modules.length).toBeGreaterThanOrEqual(2);

    const moduleIds = catalog.modules.map((m) => m.id);
    expect(moduleIds).toContain('settings');
    expect(moduleIds).toContain('workforce');

    const settings = catalog.modules.find((m) => m.id === 'settings');
    const workforce = catalog.modules.find((m) => m.id === 'workforce');

    expect(settings).toBeDefined();
    expect(workforce).toBeDefined();

    expect(settings?.isV1Compatible).toBe(true);
    expect(workforce?.isV1Compatible).toBe(true);
    expect(existsSync(settings!.sourceDirectory)).toBe(true);
    expect(existsSync(workforce!.sourceDirectory)).toBe(true);
  });

  it('P8.2: preserves full flow inventory for settings module (>= 12 flows)', () => {
    const settingsFlows = catalog.flows.filter((f) => f.module === 'settings');
    expect(settingsFlows.length).toBeGreaterThanOrEqual(12);

    const expectedSettingsCodes = [
      '00.1', '00.2', '00.3', '00.4', '00.5', '00.6',
      '00.7', '00.8', '00.9', '00.10', '00.11', '00.12',
    ];

    const discoveredCodes = settingsFlows.map((f) => f.id);
    for (const code of expectedSettingsCodes) {
      expect(discoveredCodes).toContain(code);
    }

    for (const flow of settingsFlows) {
      expect(flow.titleArabic).toBeDefined();
      expect(flow.titleArabic.length).toBeGreaterThan(0);
      expect(flow.filesHash).toHaveLength(64);
      expect(existsSync(flow.sourceDirectory)).toBe(true);
    }
  });

  it('P8.3: preserves full flow inventory for workforce module (>= 8 flows)', () => {
    const workforceFlows = catalog.flows.filter((f) => f.module === 'workforce');
    expect(workforceFlows.length).toBeGreaterThanOrEqual(8);

    const expectedWorkforceCodes = [
      '01.1', '01.2.D', '01.4', '01.5', '01.6', '01.7', '01.8', '01.9',
    ];

    const discoveredCodes = workforceFlows.map((f) => f.id);
    for (const code of expectedWorkforceCodes) {
      expect(discoveredCodes).toContain(code);
    }

    for (const flow of workforceFlows) {
      expect(flow.titleArabic).toBeDefined();
      expect(flow.titleArabic.length).toBeGreaterThan(0);
      expect(flow.filesHash).toHaveLength(64);
      expect(existsSync(flow.sourceDirectory)).toBe(true);
    }
  });

  it('P8.4: validates that all existing flows respect Telegram mobile budgets', () => {
    for (const flow of catalog.flows) {
      expect(flow.telegramBudget).toBeDefined();
      expect(flow.telegramBudget.maxCallbackBytes).toBeLessThanOrEqual(64);
      expect(flow.telegramBudget.maxButtonChars).toBeLessThanOrEqual(32);
      expect(flow.telegramBudget.maxKeyboardRows).toBeLessThanOrEqual(7);
      expect(flow.telegramBudget.maxButtonsPerRow).toBeLessThanOrEqual(3);
    }
  });

  it('P8.5: validates full monorepo catalog integrity with zero validation errors', () => {
    const report = validateMonorepoCatalog(catalog);
    expect(report.valid).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.checked.modules).toBeGreaterThanOrEqual(2);
    expect(report.checked.flows).toBeGreaterThanOrEqual(20);
  });
});
