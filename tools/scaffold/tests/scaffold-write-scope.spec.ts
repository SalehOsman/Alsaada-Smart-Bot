import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { scaffoldModuleV2 } from '../scaffold-module-v2.js';
import { scaffoldFlowV2 } from '../scaffold-flow-v2.js';
import { scaffoldModuleMigration } from '../scaffold-module-migration.js';

describe('Work Plan 89 — Zero Core Modification Scaffolding Scope Sentinel (Phase P6)', () => {
  const sandboxDir = path.resolve(process.cwd(), 'tmp-test-scaffold-scope-sandbox');

  beforeEach(() => {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
    fs.mkdirSync(sandboxDir, { recursive: true });

    // Create fake core structure to detect accidental leakages
    fs.mkdirSync(path.join(sandboxDir, 'apps', 'bot-server'), { recursive: true });
    fs.mkdirSync(path.join(sandboxDir, 'apps', 'admin-dashboard'), { recursive: true });
    fs.mkdirSync(path.join(sandboxDir, 'packages', 'core-components'), { recursive: true });
    fs.mkdirSync(path.join(sandboxDir, 'packages', 'database'), { recursive: true });
    fs.mkdirSync(path.join(sandboxDir, 'modules'), { recursive: true });

    // Place sentinel marker files
    fs.writeFileSync(path.join(sandboxDir, 'packages', 'core-components', 'sentinel.txt'), 'ORIGINAL_CORE');
    fs.writeFileSync(path.join(sandboxDir, 'apps', 'bot-server', 'sentinel.txt'), 'ORIGINAL_BOT');
    fs.writeFileSync(path.join(sandboxDir, 'package.json'), JSON.stringify({ name: 'sandbox' }));
  });

  afterEach(() => {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  });

  function getTreeSnapshot(dir: string): string[] {
    const results: string[] = [];
    function walk(current: string) {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        const rel = path.relative(dir, full).replace(/\\/g, '/');
        results.push(rel);
        if (entry.isDirectory()) {
          walk(full);
        }
      }
    }
    walk(dir);
    return results.sort();
  }

  it('scaffoldModuleV2 writes strictly within target module directory and never touches core', () => {
    const beforeCoreFile = fs.readFileSync(path.join(sandboxDir, 'packages', 'core-components', 'sentinel.txt'), 'utf8');

    const res = scaffoldModuleV2({
      name: 'payroll-advance',
      titleArabic: 'سلف العاملين المتقدمة',
      root: sandboxDir,
    });

    expect(res.ok).toBe(true);

    // Assert every single created file is inside modules/payroll-advance/
    for (const f of res.filesCreated) {
      const fullPath = path.resolve(sandboxDir, 'modules', 'payroll-advance', f);
      expect(fullPath.startsWith(path.resolve(sandboxDir, 'modules', 'payroll-advance'))).toBe(true);
      expect(fs.existsSync(fullPath)).toBe(true);
    }

    // Assert core sentinel files remain 100% untampered
    const afterCoreFile = fs.readFileSync(path.join(sandboxDir, 'packages', 'core-components', 'sentinel.txt'), 'utf8');
    expect(afterCoreFile).toBe(beforeCoreFile);

    // Assert no new files appeared under packages/ or apps/
    expect(fs.readdirSync(path.join(sandboxDir, 'packages', 'core-components'))).toEqual(['sentinel.txt']);
    expect(fs.readdirSync(path.join(sandboxDir, 'apps', 'bot-server'))).toEqual(['sentinel.txt']);
  });

  it('scaffoldFlowV2 writes strictly within target module and never touches core', () => {
    // First scaffold module
    scaffoldModuleV2({
      name: 'sample-ops',
      titleArabic: 'العمليات النموذجية',
      root: sandboxDir,
    });

    const snapshotBefore = getTreeSnapshot(path.join(sandboxDir, 'packages'));

    const res = scaffoldFlowV2({
      moduleId: 'sample-ops',
      flowId: '89.1',
      slug: 'record-sample',
      titleArabic: 'تسجيل عملية نموذجية',
      root: sandboxDir,
      includeDashboard: true,
    });

    expect(res.ok).toBe(true);

    // Verify all created files belong strictly under modules/sample-ops/
    for (const f of res.filesCreated) {
      const fullPath = path.resolve(sandboxDir, 'modules', 'sample-ops', f);
      expect(fullPath.startsWith(path.resolve(sandboxDir, 'modules', 'sample-ops'))).toBe(true);
      expect(fs.existsSync(fullPath)).toBe(true);
    }

    // Verify zero modifications under packages/ or apps/
    const snapshotAfter = getTreeSnapshot(path.join(sandboxDir, 'packages'));
    expect(snapshotAfter).toEqual(snapshotBefore);
  });

  it('scaffoldModuleMigration writes strictly within target module migrations directory', () => {
    // First scaffold module
    scaffoldModuleV2({
      name: 'canteen-ops',
      titleArabic: 'عمليات الكانتين',
      root: sandboxDir,
    });

    const snapshotBefore = getTreeSnapshot(path.join(sandboxDir, 'packages'));

    const res = scaffoldModuleMigration({
      moduleId: 'canteen-ops',
      slug: 'add_meal_rates',
      description: 'Add meal rate matrix',
      root: sandboxDir,
      timestamp: '20260922120000',
    });

    expect(res.ok).toBe(true);
    expect(res.migrationId).toBe('20260922120000_add_meal_rates');

    const expectedDir = path.resolve(sandboxDir, 'modules', 'canteen-ops', 'database', 'migrations', '20260922120000_add_meal_rates');
    expect(path.resolve(res.migrationDir)).toBe(expectedDir);

    // Verify created files
    for (const f of res.filesCreated) {
      const fullPath = path.resolve(res.migrationDir, f);
      expect(fullPath.startsWith(expectedDir)).toBe(true);
      expect(fs.existsSync(fullPath)).toBe(true);
    }

    // Verify zero modifications under packages/
    const snapshotAfter = getTreeSnapshot(path.join(sandboxDir, 'packages'));
    expect(snapshotAfter).toEqual(snapshotBefore);
  });
});
