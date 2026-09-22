import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { scaffoldModuleV2 } from '../scaffold-module-v2.js';
import { scaffoldFlowV2 } from '../scaffold-flow-v2.js';

describe('Work Plan 89 — Flow V2 Constitutional 10-File Slice Scaffolding (Phase P6)', () => {
  const testDir = path.resolve(process.cwd(), 'tmp-test-scaffold-flow');

  beforeEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    fs.mkdirSync(testDir, { recursive: true });

    // Seed target module
    scaffoldModuleV2({
      name: 'canteen',
      titleArabic: 'إدارة الكانتين والإعاشة',
      root: testDir,
    });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('scaffolds constitutional 10-file slice with draft status and budget invariants', () => {
    const res = scaffoldFlowV2({
      moduleId: 'canteen',
      flowId: '89.1',
      slug: 'record-meal',
      titleArabic: 'تسجيل وجبة جديدة',
      root: testDir,
      includeDashboard: true,
    });

    expect(res.ok).toBe(true);
    expect(res.flowId).toBe('89.1');

    const flowFolder = path.join(testDir, 'modules', 'canteen', 'src', 'flows', '89.1-record-meal');

    // Verify all 9 slice files in flow folder
    expect(fs.existsSync(path.join(flowFolder, 'flow.contract.json'))).toBe(true);
    expect(fs.existsSync(path.join(flowFolder, 'index.ts'))).toBe(true);
    expect(fs.existsSync(path.join(flowFolder, 'controller.ts'))).toBe(true);
    expect(fs.existsSync(path.join(flowFolder, 'menu.builder.ts'))).toBe(true);
    expect(fs.existsSync(path.join(flowFolder, 'action.handler.ts'))).toBe(true);
    expect(fs.existsSync(path.join(flowFolder, 'service.ts'))).toBe(true);
    expect(fs.existsSync(path.join(flowFolder, 'types.ts'))).toBe(true);
    expect(fs.existsSync(path.join(flowFolder, 'validator.ts'))).toBe(true);
    expect(fs.existsSync(path.join(flowFolder, 'error.handler.ts'))).toBe(true);

    // Verify 10th file (test in tests/flows/)
    const testFile = path.join(testDir, 'modules', 'canteen', 'tests', 'flows', '89.1-record-meal.spec.ts');
    expect(fs.existsSync(testFile)).toBe(true);

    // Verify contract schema version and draft status
    const contract = JSON.parse(fs.readFileSync(path.join(flowFolder, 'flow.contract.json'), 'utf8'));
    expect(contract.schemaVersion).toBe('2.0.0');
    expect(contract.id).toBe('89.1');
    expect(contract.status).toBe('draft');
    expect(contract.telegramBudget.maxCallbackBytes).toBe(64);
    expect(contract.telegramBudget.maxButtonChars).toBe(16);

    // Verify dashboard companion files
    const featureDir = path.join(testDir, 'modules', 'canteen', 'src', 'features', '89.1');
    expect(fs.existsSync(path.join(featureDir, 'dashboard', 'page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(featureDir, 'dashboard', 'client.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(featureDir, 'api', 'handler.ts'))).toBe(true);
  });

  it('rejects invalid flow code or missing target module', () => {
    const invalidCodeRes = scaffoldFlowV2({
      moduleId: 'canteen',
      flowId: 'invalid-code',
      slug: 'test',
      titleArabic: 'تجربة',
      root: testDir,
    });
    expect(invalidCodeRes.ok).toBe(false);
    expect(invalidCodeRes.error).toContain('Invalid flow ID');

    const missingModRes = scaffoldFlowV2({
      moduleId: 'non-existent-module',
      flowId: '89.2',
      slug: 'test',
      titleArabic: 'تجربة',
      root: testDir,
    });
    expect(missingModRes.ok).toBe(false);
    expect(missingModRes.error).toContain('Target module does not exist');
  });
});
