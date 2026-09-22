import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { scaffoldModuleV2 } from '../scaffold-module-v2.js';

describe('Work Plan 89 — Module V2 Scaffolding Standard (Phase P6)', () => {
  const testDir = path.resolve(process.cwd(), 'tmp-test-scaffold-module');

  beforeEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('scaffolds complete V2 module architecture with draft status and valid contracts', () => {
    const res = scaffoldModuleV2({
      name: 'canteen',
      titleArabic: 'إدارة الكانتين والإعاشة',
      root: testDir,
    });

    expect(res.ok).toBe(true);
    expect(res.moduleName).toBe('canteen');
    expect(res.filesCreated.length).toBeGreaterThanOrEqual(8);

    const modDir = path.join(testDir, 'modules', 'canteen');
    expect(fs.existsSync(path.join(modDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(modDir, 'tsconfig.json'))).toBe(true);
    expect(fs.existsSync(path.join(modDir, 'module.contract.json'))).toBe(true);
    expect(fs.existsSync(path.join(modDir, 'src', 'index.ts'))).toBe(true);
    expect(fs.existsSync(path.join(modDir, 'src', 'module.register.ts'))).toBe(true);
    expect(fs.existsSync(path.join(modDir, 'database', 'schema.prisma'))).toBe(true);
    expect(fs.existsSync(path.join(modDir, 'database', 'relations.contract.json'))).toBe(true);
    expect(fs.existsSync(path.join(modDir, 'tests', 'canteen-module.spec.ts'))).toBe(true);

    // Verify contract contents
    const contract = JSON.parse(fs.readFileSync(path.join(modDir, 'module.contract.json'), 'utf8'));
    expect(contract.schemaVersion).toBe('2.0.0');
    expect(contract.id).toBe('canteen');
    expect(contract.titleArabic).toBe('إدارة الكانتين والإعاشة');
    expect(contract.status).toBe('draft');
    expect(contract.callbackPrefixes).toContain('action:canteen:');
  });

  it('rejects invalid module names or missing Arabic titles', () => {
    const invalidNameRes = scaffoldModuleV2({
      name: 'Invalid_Name!',
      titleArabic: 'عنوان',
      root: testDir,
    });
    expect(invalidNameRes.ok).toBe(false);
    expect(invalidNameRes.error).toContain('Invalid module name');

    const missingTitleRes = scaffoldModuleV2({
      name: 'valid-name',
      titleArabic: '',
      root: testDir,
    });
    expect(missingTitleRes.ok).toBe(false);
    expect(missingTitleRes.error).toContain('Arabic title is mandatory');
  });
});
