import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('🧩 Sovereign Auto-Loader & Enterprise Microkernel Module Bus', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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
    it('1. converts Windows drive paths to valid file URLs', () => {
      // Arrange
      const winPath = 'F:\\Alsaada-Smart-Bot\\modules\\workforce\\src\\index.ts';

      // Act
      const fileUrl = toValidImportUrl(winPath);

      // Assert
      expect(fileUrl).toMatch(/^file:\/\/\//);
      expect(fileUrl.toLowerCase()).toContain('workforce');
      expect(fileUrl).not.toContain('\\');
    });

    it('2. preserves existing file:// URLs unchanged', () => {
      // Arrange
      const url = 'file:///F:/Alsaada-Smart-Bot/modules/settings/src/index.ts';

      // Act
      const result = toValidImportUrl(url);

      // Assert
      expect(result).toBe(url);
      expect(result).not.toContain('\\');
    });

    it('3. resolves live dev entrypoint (src/index.ts) correctly', () => {
      // Arrange
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loader-test-'));
      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      const entryPath = path.join(srcDir, 'index.ts');
      fs.writeFileSync(entryPath, 'export const name = "test";');

      // Act
      const resolved = resolveModuleEntrypoint(tmpDir);

      // Assert
      expect(resolved).toBe(entryPath);
      expect(resolved).not.toBeNull();

      // Cleanup
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  // =========================================================================
  // 2. Runtime Contract Service Handshake
  // =========================================================================
  describe('2. Runtime Contract Service Handshake', () => {
    it('4. verifies standard services correctly', () => {
      // Arrange
      const runtime = createMockRuntime();

      // Act
      const prismaCheck = verifyServiceReadiness('prisma', runtime);
      const dbCheck = verifyServiceReadiness('database', runtime);
      const redisCheck = verifyServiceReadiness('redis', runtime);
      const apiCheck = verifyServiceReadiness('api', runtime);
      const screenCheck = verifyServiceReadiness('screenFlow', runtime);
      const telemetryCheck = verifyServiceReadiness('telemetry', runtime);

      // Assert
      expect(prismaCheck.ready).toBe(true);
      expect(dbCheck.ready).toBe(true);
      expect(redisCheck.ready).toBe(true);
      expect(apiCheck.ready).toBe(true);
      expect(screenCheck.ready).toBe(true);
      expect(telemetryCheck.ready).toBe(true);
    });

    it('5. detects missing services with precise diagnostic reason', () => {
      // Arrange
      const runtime = createMockRuntime({ redis: null });

      // Act
      const check = verifyServiceReadiness('redis', runtime);

      // Assert
      expect(check.ready).toBe(false);
      expect(check.reason).toContain('Redis client instance is missing');
      expect(check.ready).not.toBe(true);
    });

    it('6. throws SovereignHandshakeError when a critical module misses a required service', async () => {
      // Arrange
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

      // Act
      const action = () => loader.loadModules(brokenRuntime);

      // Assert
      await expect(action()).rejects.toThrow(SovereignHandshakeError);

      try {
        await loader.loadModules(brokenRuntime);
      } catch (err: any) {
        expect(err.message).toContain('Runtime Handshake Failed for module "settings"');
        expect(err.message).toContain('screenFlow');
      }

      // Cleanup
      fs.rmSync(tmpModulesDir, { recursive: true, force: true });
    });
  });

  // =========================================================================
  // 3. Fault-Tolerant Circuit Breaker
  // =========================================================================
  describe('3. Fault-Tolerant Circuit Breaker', () => {
    it('7. isolates failure in a non-critical module without halting the server', async () => {
      // Arrange
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

      // Act
      const result = await loader.loadModules(runtime);

      // Assert
      // Canteen should be loaded, catering should be skipped/failed
      expect(result.activeModules.map((m) => m.name)).toContain('canteen');
      expect(result.activeModules.map((m) => m.name)).not.toContain('catering');

      const cateringDiag = result.failedModules.find((d) => d.name === 'catering');
      expect(cateringDiag).toBeDefined();
      expect(cateringDiag?.missingServices).toContain('nonExistentHeavyService');

      // Cleanup
      fs.rmSync(tmpModulesDir, { recursive: true, force: true });
    });

    it('8. throws CriticalModuleLoadError when a critical module has invalid JSON contract', async () => {
      // Arrange
      const tmpModulesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loader-badjson-'));
      const modDir = path.join(tmpModulesDir, 'workforce');
      fs.mkdirSync(modDir, { recursive: true });
      fs.writeFileSync(path.join(modDir, 'module.contract.json'), '{ invalid json syntax !!!');

      const loader = new SovereignAutoLoader({
        modulesDir: tmpModulesDir,
        criticalModules: ['workforce'],
      });

      const runtime = createMockRuntime();

      // Act
      const action = () => loader.loadModules(runtime);

      // Assert
      await expect(action()).rejects.toThrow(CriticalModuleLoadError);

      // Cleanup
      fs.rmSync(tmpModulesDir, { recursive: true, force: true });
    });

    it('9. isolates invalid JSON contract in a non-critical module with warning', async () => {
      // Arrange
      const tmpModulesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loader-badjson-noncrit-'));
      const modDir = path.join(tmpModulesDir, 'equipment');
      fs.mkdirSync(modDir, { recursive: true });
      fs.writeFileSync(path.join(modDir, 'module.contract.json'), '{ broken json !!!');

      const loader = new SovereignAutoLoader({
        modulesDir: tmpModulesDir,
        criticalModules: ['settings', 'workforce'],
      });

      const runtime = createMockRuntime();

      // Act
      const result = await loader.loadModules(runtime);

      // Assert
      expect(result.failedModules.some((d) => d.name === 'equipment')).toBe(true);
      expect(result.activeModules.some((d) => d.name === 'equipment')).toBe(false);

      // Cleanup
      fs.rmSync(tmpModulesDir, { recursive: true, force: true });
    });
  });

  // =========================================================================
  // 4. Dynamic Navigation Aggregation & ReDoS Protection
  // =========================================================================
  describe('4. Dynamic Navigation Aggregation & ReDoS Protection', () => {
    it('10. aggregates navigation patterns from contracts, modules, and reply buttons', async () => {
      // Arrange
      const tmpModulesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loader-nav-'));
      try {
        const modDir = path.join(tmpModulesDir, 'testMod');
        fs.mkdirSync(modDir, { recursive: true });
        fs.writeFileSync(
          path.join(modDir, 'module.contract.json'),
          JSON.stringify({
            moduleName: 'testMod',
            version: '1.0.0',
            navigationPatterns: ['زر من عقد الموديول'],
          })
        );

        const loader = new SovereignAutoLoader({
          modulesDir: tmpModulesDir,
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

        // Act
        const result = await loader.loadModules(runtime);

        // Assert
        expect(result.navigationPatterns).toContain('القائمة الرئيسية');
        expect(result.navigationPatterns).toContain('🖥️ فتح لوحة التحكم');
        expect(result.navigationPatterns).toContain('زر من عقد الموديول');
        expect(result.navigationPatterns).toContain('زر الموديول المخصص');
        expect(result.navigationPatterns).toContain('زر الأدمن');

        const regex = loader.getNavigationRegex();
        expect(regex.test('القائمة الرئيسية')).toBe(true);
        expect(regex.test('🖥️ فتح لوحة التحكم')).toBe(true);
        expect(regex.test('زر من عقد الموديول')).toBe(true);
        expect(regex.test('زر الموديول المخصص')).toBe(true);
        expect(regex.test('زر الأدمن')).toBe(true);
        expect(regex.test('نص عشوائي غير معروف')).toBe(false);
      } finally {
        fs.rmSync(tmpModulesDir, { recursive: true, force: true });
      }
    });

    it('11. returns empty guard /(?!)/ when patterns array is empty', () => {
      // Arrange
      const patterns: string[] = [];

      // Act
      const regex = buildSafeNavigationRegex(patterns);

      // Assert
      expect(regex.source).toBe('(?!)');
      expect(regex.test('أي نص')).toBe(false);
      expect(regex.test('')).toBe(false);
    });

    it('12. detects and strips ReDoS dangerous patterns', () => {
      // Arrange
      const redosPatterns = ['((a+)+)+', '([a-zA-Z]+)*', '([a-z]+)+', '((a+)|b)+', 'a++'];
      const safePatterns = ['🚜 تسجيل منسوب', 'ملفي (الشخصي|وإعداداتي)', '+ إضافة عامل', 'طلب سلفة (+500)'];

      // Act
      const redosCheck = redosPatterns.every((p) => hasReDoSRisk(p));
      const safeCheck = safePatterns.every((p) => !hasReDoSRisk(p));
      const regex = buildSafeNavigationRegex(['((a+)+)+', 'زر آمن']);

      // Assert
      expect(redosCheck).toBe(true);
      expect(safeCheck).toBe(true);
      expect(regex.test('زر آمن')).toBe(true);
      expect(regex.test('aaaaa')).toBe(false);
    });

    it('13. preserves literal button texts with regex special characters (+, *, ?, brackets) via safe escaping', () => {
      // Arrange
      const rawText1 = '+ إضافة عامل';
      const rawText2 = '[جديد]';
      const list = [
        '+ إضافة عامل',
        'طلب سلفة (+500)',
        '[إداري] تسجيل',
        '★ تقرير *مميز*',
      ];

      // Act
      const escaped1 = escapeRegExp(rawText1);
      const escaped2 = escapeRegExp(rawText2);
      const regex = buildSafeNavigationRegex(list);

      // Assert
      expect(escaped1).toBe('\\+ إضافة عامل');
      expect(escaped2).toBe('\\[جديد\\]');
      expect(regex.test('+ إضافة عامل')).toBe(true);
      expect(regex.test('طلب سلفة (+500)')).toBe(true);
      expect(regex.test('[إداري] تسجيل')).toBe(true);
      expect(regex.test('★ تقرير *مميز*')).toBe(true);
      expect(regex.test('إضافة عامل')).toBe(false);
    });

    it('14. anchors navigation regex so words inside longer sentences do not falsely trigger navigation', () => {
      // Arrange
      const regex = buildSafeNavigationRegex(['القائمة الرئيسية', 'إعدادات النظام']);
      const exact1 = 'القائمة الرئيسية';
      const padded = '  القائمة الرئيسية  ';
      const exact2 = 'إعدادات النظام';
      const sentence1 = 'السلام عليكم، القائمة الرئيسية مش شغالة';
      const sentence2 = 'سبب السلفة: تعديل إعدادات النظام';
      const sentence3 = 'القائمة الرئيسية شكرا';

      // Act
      const matchExact1 = regex.test(exact1);
      const matchPadded = regex.test(padded);
      const matchExact2 = regex.test(exact2);
      const matchSentence1 = regex.test(sentence1);
      const matchSentence2 = regex.test(sentence2);
      const matchSentence3 = regex.test(sentence3);

      // Assert
      expect(matchExact1).toBe(true);
      expect(matchPadded).toBe(true);
      expect(matchExact2).toBe(true);
      expect(matchSentence1).toBe(false);
      expect(matchSentence2).toBe(false);
      expect(matchSentence3).toBe(false);
    });

    it('15. converts kebab-case and snake-case module names to PascalCase', () => {
      // Arrange
      const name1 = 'workforce';
      const name2 = 'cash-outflow';
      const name3 = 'field_custody';
      const name4 = 'user-rbac-management';

      // Act
      const p1 = toPascalCase(name1);
      const p2 = toPascalCase(name2);
      const p3 = toPascalCase(name3);
      const p4 = toPascalCase(name4);

      // Assert
      expect(p1).toBe('Workforce');
      expect(p2).toBe('CashOutflow');
      expect(p3).toBe('FieldCustody');
      expect(p4).toBe('UserRbacManagement');
      expect(p1).not.toBe(name1);
    });

    it('16. rejects empty or whitespace-only strings in isNavigationMessage', () => {
      // Arrange
      const loader = new SovereignAutoLoader({
        baseNavigationPatterns: ['القائمة الرئيسية'],
      });

      // Act
      const emptyRes = loader.isNavigationMessage('');
      const spaceRes = loader.isNavigationMessage('   ');
      const nullRes = loader.isNavigationMessage(null as any);
      const undefinedRes = loader.isNavigationMessage(undefined as any);

      // Assert
      expect(emptyRes).toBe(false);
      expect(spaceRes).toBe(false);
      expect(nullRes).toBe(false);
      expect(undefinedRes).toBe(false);
    });

    it('17. always resets lastIndex to 0 to prevent stateful cross-call leakage', () => {
      // Arrange
      const regex = buildSafeNavigationRegex(['زر أول', 'زر ثاني']);
      regex.lastIndex = 5;

      const loader = new SovereignAutoLoader({
        baseNavigationPatterns: ['زر أول', 'زر ثاني'],
      });

      // Act
      const r1 = loader.getNavigationRegex();

      // Assert
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
    it(
      '18. discovers and loads workforce and settings modules from project filesystem',
      async () => {
        // Arrange
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

      // Act
      const result = await loader.loadModules(runtime);

      // Assert
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
    }, 60000);
  });
});
