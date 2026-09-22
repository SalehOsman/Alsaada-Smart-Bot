import { describe, it, expect } from 'vitest';
import { scanMonorepoCatalog } from '../catalog.js';
import { validateMonorepoCatalog } from '../validate-catalog.js';
import { generateCatalogArtifacts } from '../generate-catalog.js';

describe('Work Plan 89 — Catalog Scanner & Generator (Phase P2)', () => {
  it('scans real monorepo and discovers existing modules (settings & workforce)', () => {
    const catalog = scanMonorepoCatalog();
    expect(catalog.version).toBe('2.0.0');
    expect(catalog.modules.length).toBeGreaterThanOrEqual(2);

    const modIds = catalog.modules.map((m) => m.id);
    expect(modIds).toContain('settings');
    expect(modIds).toContain('workforce');

    // Flow count should be >= 20 (settings: 12 flows, workforce: 8 flows)
    expect(catalog.flows.length).toBeGreaterThanOrEqual(20);

    const flow011 = catalog.flows.find((f) => f.id === '01.1');
    expect(flow011).toBeDefined();
    expect(flow011?.module).toBe('workforce');
    expect(flow011?.telegramBudget.maxCallbackBytes).toBe(64);
  });

  it('validates the monorepo catalog with zero fatal errors', () => {
    const catalog = scanMonorepoCatalog();
    const report = validateMonorepoCatalog(catalog);

    if (!report.valid) {
      console.error('Validation errors found:', report.errors);
    }

    expect(report.valid).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.checked.modules).toBeGreaterThanOrEqual(2);
    expect(report.checked.flows).toBeGreaterThanOrEqual(20);
  });

  it('generates catalog artifacts in dry-run mode and verifies file list', () => {
    const result = generateCatalogArtifacts(process.cwd(), { dryRun: true });
    expect(result.ok).toBe(true);
    expect(result.filesGenerated).toContain('modules.json');
    expect(result.filesGenerated).toContain('flows.json');
    expect(result.filesGenerated).toContain('bot.registry.ts');
    expect(result.filesGenerated).toContain('dashboard.server.ts');
    expect(result.filesGenerated).toContain('dashboard.client.ts');
    expect(result.catalog.catalogHash).toHaveLength(64);
  });
});
