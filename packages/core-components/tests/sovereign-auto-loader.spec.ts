import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  SovereignAutoLoader,
  CriticalModuleLoadError,
  SovereignHandshakeError,
  toValidImportUrl,
  hasReDoSRisk,
  buildSafeNavigationRegex,
  escapeRegExp,
  toPascalCase,
  verifyServiceReadiness,
  resolveModuleEntrypoint,
  resolveModulesDirectory,
} from '../src/module-bus/sovereign-auto-loader.js';
import type { ModuleRuntimeContext, AppModuleDefinition } from '../src/contracts/module.contract.js';

describe('🧩 Sovereign Auto-Loader & Enterprise Microkernel Module Bus', () => {
  const createMockRuntime = (overrides?: Partial<ModuleRuntimeContext>): ModuleRuntimeContext => ({
    prisma: { $connect: vi.fn() } as any,
    redis: { ping: vi.fn().mockResolvedValue('PONG'), status: 'ready' } as any,
    api: { sendMessage: vi.fn() } as any,
    screenFlow: { getActiveScreen: vi.fn() } as any,
    telemetry: { logEvent: vi.fn() } as any,
    ...overrides,
  });

  // =========================================================================
  // 1. Hybrid Resolution & Path Normalization (Windows URLs)
  // =========================================================================
  describe('1. Hybrid Resolution & Windows URL Normalization', () => {
    it('converts Windows drive paths to valid file URLs', () => {
      const winPath = 'F:\\Alsaada-Smart-Bot\\modules\\workforce\\src\\index.ts';
      const fileUrl = toValidImportUrl(winPath);

      expect(fileUrl).toMatch(/^file:\/\/\//);
      expect(fileUrl.toLowerCase()).toContain('workforce');
      expect(fileUrl).not.toContain('\\');
    });

    it('preserves existing file:// URLs unchanged', () => {
      const url = 'file:///F:/Alsaada-Smart-Bot/modules/settings/src/index.ts';
      expect(toValidImportUrl(url)).toBe(url);
    });

    it('resolves live dev entrypoint (src/index.ts) correctly', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loader-test-'));
      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      const entryPath = path.join(srcDir, 'index.ts');
      fs.writeFileSync(entryPath, 'export const name = "test";');

      const resolved = resolveModuleEntrypoint(tmpDir);
      expect(resolved).toBe(entryPath);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  // =========================================================================
  // 2. Runtime Contract Service Handshake
  // =========================================================================
  describe('2. Runtime Contract Service Handshake', () => {
    it('verifies standard services correctly', () => {
      const runtime = createMockRuntime();

      expect(verifyServiceReadiness('prisma', runtime).ready).toBe(true);
      expect(verifyServiceReadiness('database', runtime).ready).toBe(true);
      expect(verifyServiceReadiness('redis', runtime).ready).toBe(true);
      expect(verifyServiceReadiness('api', runtime).ready).toBe(true);
      expect(verifyServiceReadiness('screenFlow', runtime).ready).toBe(true);
      expect(verifyServiceReadiness('telemetry', runtime).ready).toBe(true);
    });

    it('detects missing services with precise diagnostic reason', () => {
      const runtime = createMockRuntime({ redis: null });

      const check = verifyServiceReadiness('redis', runtime);
      expect(check.ready).toBe(false);
      expect(check.reason).toContain('Redis client instance is missing');
    });

    it('throws SovereignHandshakeError when a critical module misses a required service', async () => {
      const tmpModulesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loader-crit-'));
      const modDir = path.join(tmpModulesDir, 'settings');
      fs.mkdirSync(path.join(modDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(modDir, 'src', 'index.ts'), 'export const createSettingsAppModule = () => ({});');
      fs.writeFileSync(
        path.join(modDir, 'module.contract.json'),
        JSON.stringify({
          moduleName: 'settings',
          critical: true,
          requiredServices: ['prisma', 'redis', 'screenFlow'],
        })
      );

      const loader = new SovereignAutoLoader({
        modulesDir: tmpModulesDir,
        criticalModules: ['settings'],
      });

      // Runtime is missing screenFlow
      const brokenRuntime = createMockRuntime({ screenFlow: null });

      await expect(loader.loadModules(brokenRuntime)).rejects.toThrow(SovereignHandshakeError);

      try {
        await loader.loadModules(brokenRuntime);
      } catch (err: any) {
        expect(err.message).toContain('Runtime Handshake Failed for module "settings"');
        expect(err.message).toContain('screenFlow');
      }

      fs.rmSync(tmpModulesDir, { recursive: true, force: true });
    });
  });

  // =========================================================================
  // 3. Fault-Tolerant Circuit Breaker
  // =========================================================================
  describe('3. Fault-Tolerant Circuit Breaker', () => {
    it('isolates failure in a non-critical module without halting the server', async () => {
      const tmpModulesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loader-cb-'));

      // 1. Healthy non-critical module A
      const modADir = path.join(tmpModulesDir, 'canteen');
      fs.mkdirSync(modADir, { recursive: true });
      fs.writeFileSync(
        path.join(modADir, 'module.contract.json'),
        JSON.stringify({ moduleName: 'canteen', critical: false, requiredServices: ['prisma'] })
      );

      // 2. Broken non-critical module B (missing required custom service)
      const modBDir = path.join(tmpModulesDir, 'catering');
      fs.mkdirSync(modBDir, { recursive: true });
      fs.writeFileSync(
        path.join(modBDir, 'module.contract.json'),
        JSON.stringify({
          moduleName: 'catering',
          critical: false,
          requiredServices: ['nonExistentHeavyService'],
        })
      );

      const mockFactoryA = vi.fn().mockReturnValue({
        name: 'canteen',
        titleArabic: 'الكانتين',
        version: '1.0.0',
        status: 'active',
        callbackPrefixes: ['action:canteen:'],
        registerRoutes: vi.fn(),
      } as AppModuleDefinition);

      const loader = new SovereignAutoLoader({
        modulesDir: tmpModulesDir,
        criticalModules: [],
        factories: {
          canteen: mockFactoryA,
        },
      });

      const runtime = createMockRuntime();
      const result = await loader.loadModules(runtime);

      // Canteen should be loaded, catering should be skipped/failed
      expect(result.activeModules.map((m) => m.name)).toContain('canteen');
      expect(result.activeModules.map((m) => m.name)).not.toContain('catering');

      const cateringDiag = result.failedModules.find((d) => d.name === 'catering');
      expect(cateringDiag).toBeDefined();
      expect(cateringDiag?.missingServices).toContain('nonExistentHeavyService');

      fs.rmSync(tmpModulesDir, { recursive: true, force: true });
    });

    it('throws CriticalModuleLoadError when a critical module has invalid JSON contract', async () => {
      const tmpModulesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loader-badjson-'));
      const modDir = path.join(tmpModulesDir, 'workforce');
      fs.mkdirSync(modDir, { recursive: true });
      fs.writeFileSync(path.join(modDir, 'module.contract.json'), '{ invalid json syntax !!!');

      const loader = new SovereignAutoLoader({
        modulesDir: tmpModulesDir,
        criticalModules: ['workforce'],
      });

      const runtime = createMockRuntime();
      await expect(loader.loadModules(runtime)).rejects.toThrow(CriticalModuleLoadError);

      fs.rmSync(tmpModulesDir, { recursive: true, force: true });
    });

    it('isolates invalid JSON contract in a non-critical module with warning', async () => {
      const tmpModulesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loader-badjson-noncrit-'));
      const modDir = path.join(tmpModulesDir, 'equipment');
      fs.mkdirSync(modDir, { recursive: true });
      fs.writeFileSync(path.join(modDir, 'module.contract.json'), '{ broken json !!!');

      const loader = new SovereignAutoLoader({
        modulesDir: tmpModulesDir,
        criticalModules: ['settings', 'workforce'],
      });

      const runtime = createMockRuntime();
      const result = await loader.loadModules(runtime);

      expect(result.failedModules.some((d) => d.name === 'equipment')).toBe(true);

      fs.rmSync(tmpModulesDir, { recursive: true, force: true });
    });
  });

  // =========================================================================
  // 4. Dynamic Navigation Aggregation & ReDoS Protection
  // =========================================================================
  describe('4. Dynamic Navigation Aggregation & ReDoS Protection', () => {
    it('aggregates navigation patterns from contracts, modules, and reply buttons', async () => {
      const loader = new SovereignAutoLoader({
        baseNavigationPatterns: ['القائمة الرئيسية', '🖥️ فتح لوحة التحكم'],
        criticalModules: [],
        factories: {
          testMod: () =>
            ({
              name: 'testMod',
              titleArabic: 'موديول تجريبي',
              version: '1.0.0',
              status: 'active',
              callbackPrefixes: ['test:'],
              navigationPatterns: ['زر الموديول المخصص'],
              registerRoutes: vi.fn(),
              getPersistentReplyButtons: (role: string) => {
                if (role === 'SUPER_ADMIN') return ['زر الأدمن'];
                return [];
              },
            } as any),
        },
      });

      const runtime = createMockRuntime();
      const result = await loader.loadModules(runtime);

      expect(result.navigationPatterns).toContain('القائمة الرئيسية');
      expect(result.navigationPatterns).toContain('🖥️ فتح لوحة التحكم');
      expect(result.navigationPatterns).toContain('زر الموديول المخصص');
      expect(result.navigationPatterns).toContain('زر الأدمن');

      const regex = loader.getNavigationRegex();
      expect(regex.test('القائمة الرئيسية')).toBe(true);
      expect(regex.test('🖥️ فتح لوحة التحكم')).toBe(true);
      expect(regex.test('زر الموديول المخصص')).toBe(true);
      expect(regex.test('زر الأدمن')).toBe(true);
      expect(regex.test('نص عشوائي غير معروف')).toBe(false);
    });

    it('returns empty guard /(?!)/ when patterns array is empty', () => {
      const regex = buildSafeNavigationRegex([]);
      expect(regex.source).toBe('(?!)');
      expect(regex.test('أي نص')).toBe(false);
      expect(regex.test('')).toBe(false);
    });

    it('detects and strips ReDoS dangerous patterns', () => {
      expect(hasReDoSRisk('((a+)+)+')).toBe(true);
      expect(hasReDoSRisk('([a-zA-Z]+)*')).toBe(true);
      expect(hasReDoSRisk('([a-z]+)+')).toBe(true);
      expect(hasReDoSRisk('((a+)|b)+')).toBe(true);
      expect(hasReDoSRisk('a++')).toBe(true);
      expect(hasReDoSRisk('🚜 تسجيل منسوب')).toBe(false);
      expect(hasReDoSRisk('ملفي (الشخصي|وإعداداتي)')).toBe(false);
      expect(hasReDoSRisk('+ إضافة عامل')).toBe(false);
      expect(hasReDoSRisk('طلب سلفة (+500)')).toBe(false);

      const regex = buildSafeNavigationRegex(['((a+)+)+', 'زر آمن']);
      expect(regex.test('زر آمن')).toBe(true);
      expect(regex.test('aaaaa')).toBe(false);
    });

    it('preserves literal button texts with regex special characters (+, *, ?, brackets) via safe escaping', () => {
      expect(escapeRegExp('+ إضافة عامل')).toBe('\\+ إضافة عامل');
      expect(escapeRegExp('[جديد]')).toBe('\\[جديد\\]');

      const regex = buildSafeNavigationRegex([
        '+ إضافة عامل',
        'طلب سلفة (+500)',
        '[إداري] تسجيل',
        '★ تقرير *مميز*',
      ]);

      expect(regex.test('+ إضافة عامل')).toBe(true);
      expect(regex.test('طلب سلفة (+500)')).toBe(true);
      expect(regex.test('[إداري] تسجيل')).toBe(true);
      expect(regex.test('★ تقرير *مميز*')).toBe(true);
      expect(regex.test('إضافة عامل')).toBe(false);
    });

    it('anchors navigation regex so words inside longer sentences do not falsely trigger navigation', () => {
      const regex = buildSafeNavigationRegex(['القائمة الرئيسية', 'إعدادات النظام']);

      // Exact button taps should match
      expect(regex.test('القائمة الرئيسية')).toBe(true);
      expect(regex.test('  القائمة الرئيسية  ')).toBe(true);
      expect(regex.test('إعدادات النظام')).toBe(true);

      // Sentences containing the words must NOT match (prevents wiping user flows)
      expect(regex.test('السلام عليكم، القائمة الرئيسية مش شغالة')).toBe(false);
      expect(regex.test('سبب السلفة: تعديل إعدادات النظام')).toBe(false);
      expect(regex.test('القائمة الرئيسية شكرا')).toBe(false);
    });

    it('converts kebab-case and snake-case module names to PascalCase', () => {
      expect(toPascalCase('workforce')).toBe('Workforce');
      expect(toPascalCase('cash-outflow')).toBe('CashOutflow');
      expect(toPascalCase('field_custody')).toBe('FieldCustody');
      expect(toPascalCase('user-rbac-management')).toBe('UserRbacManagement');
    });

    it('rejects empty or whitespace-only strings in isNavigationMessage', () => {
      const loader = new SovereignAutoLoader({
        baseNavigationPatterns: ['القائمة الرئيسية'],
      });

      expect(loader.isNavigationMessage('')).toBe(false);
      expect(loader.isNavigationMessage('   ')).toBe(false);
      expect(loader.isNavigationMessage(null as any)).toBe(false);
      expect(loader.isNavigationMessage(undefined as any)).toBe(false);
    });

    it('always resets lastIndex to 0 to prevent stateful cross-call leakage', () => {
      const regex = buildSafeNavigationRegex(['زر أول', 'زر ثاني']);
      regex.lastIndex = 5;

      const loader = new SovereignAutoLoader({
        baseNavigationPatterns: ['زر أول', 'زر ثاني'],
      });

      const r1 = loader.getNavigationRegex();
      expect(r1.lastIndex).toBe(0);
      expect(loader.isNavigationMessage('زر أول')).toBe(true);
      expect(loader.isNavigationMessage('زر أول')).toBe(true);
      expect(r1.lastIndex).toBe(0);
    });
  });

  // =========================================================================
  // 5. Full Real Live Modules Discovery
  // =========================================================================
  describe('5. Real Live Modules Integration (workforce & settings)', () => {
    it('discovers and loads workforce and settings modules from project filesystem', async () => {
      const projectModulesDir = resolveModulesDirectory();
      expect(fs.existsSync(projectModulesDir)).toBe(true);

      const loader = new SovereignAutoLoader({
        modulesDir: projectModulesDir,
        criticalModules: ['settings', 'workforce'],
        moduleOptions: {
          settings: {
            onImpersonationChange: vi.fn(),
          },
        },
      });

      const runtime = createMockRuntime();
      const result = await loader.loadModules(runtime);

      expect(result.activeModules.length).toBeGreaterThanOrEqual(2);
      const modNames = result.activeModules.map((m) => m.name);
      expect(modNames).toContain('workforce');
      expect(modNames).toContain('settings');

      // Check navigation patterns were extracted from both real contracts
      expect(result.navigationPatterns).toContain('🚜 تسجيل منسوب');
      expect(result.navigationPatterns).toContain('إعدادات النظام');

      expect(loader.isNavigationMessage('🚜 تسجيل منسوب')).toBe(true);
      expect(loader.isNavigationMessage('إعدادات النظام')).toBe(true);
      expect(loader.isNavigationMessage('🏠 القائمة الرئيسية')).toBe(true);
      expect(loader.isNavigationMessage('نص عشوائي غير مطابق')).toBe(false);
    });
  });
});
