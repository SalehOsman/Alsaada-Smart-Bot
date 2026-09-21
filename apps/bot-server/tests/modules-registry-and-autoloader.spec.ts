import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildRegisteredModules, ModulePrefixRouter } from '../src/modules.registry.js';
import { createBot } from '../src/bot.js';
import type { MyContext } from '../src/types/context.js';
import type { ModuleRuntimeContext, AppModuleDefinition } from '@alsaada/core-components';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('🤖 Bot Server Modules Registry & Sovereign Auto-Loader Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockRuntime = (): ModuleRuntimeContext<MyContext> => ({
    prisma: {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
    } as any,
    redis: {
      ping: vi.fn().mockResolvedValue('PONG'),
      status: 'ready',
    } as any,
    api: {
      sendMessage: vi.fn(),
      deleteMessage: vi.fn(),
      setMyCommands: vi.fn().mockResolvedValue(true),
    } as any,
    screenFlow: {
      cleanupIncomingUserMessage: vi.fn().mockResolvedValue(undefined),
      cleanupUnfinishedFlow: vi.fn().mockResolvedValue(undefined),
    } as any,
    telemetry: {
      logEvent: vi.fn(),
    } as any,
  });

  it('builds registered modules dynamically and resolves route prefixes for workforce and settings', async () => {
    // Arrange
    const runtime = createMockRuntime();

    // Act
    const { router, modules, loader } = await buildRegisteredModules(runtime);

    // Assert
    expect(modules.length).toBeGreaterThanOrEqual(2);
    const names = modules.map((m) => m.name);
    expect(names).toContain('workforce');
    expect(names).toContain('settings');
    expect(names).not.toContain('unknown_module');

    // Verify Prefix Router
    expect(router).toBeInstanceOf(ModulePrefixRouter);
    const workerMod = router.resolveByCallback('action:worker:123');
    expect(workerMod).toBeDefined();
    expect(workerMod?.name).toBe('workforce');

    const settingsMod = router.resolveByCallback('menu:settings:hub');
    expect(settingsMod).toBeDefined();
    expect(settingsMod?.name).toBe('settings');

    const unknownMod = router.resolveByCallback('unknown:prefix:action');
    expect(unknownMod).toBeUndefined();

    // Verify Navigation Regex
    const navRegex = loader.getNavigationRegex();
    expect(navRegex.test('🏠 القائمة الرئيسية')).toBe(true);
    expect(navRegex.test('🚜 تسجيل منسوب')).toBe(true);
    expect(navRegex.test('إعدادات النظام')).toBe(true);

    // Anchoring: user message containing navigation words does NOT falsely trigger navigation
    expect(navRegex.test('السلام عليكم عندي سؤال بخصوص إعدادات النظام')).toBe(false);
    expect(navRegex.test('تم استلام بطاقة معرفي شكرا')).toBe(false);
  });

  it('supports custom factory overrides via runtime options', async () => {
    // Arrange
    const runtime = createMockRuntime();
    const mockModule: AppModuleDefinition<MyContext> = {
      name: 'custom-override',
      titleArabic: 'موديول مخصص للاختبار',
      version: '1.0.0',
      status: 'active',
      callbackPrefixes: ['custom:'],
      navigationPatterns: ['زر مخصص'],
      registerRoutes: vi.fn(),
    };

    // Act
    const { modules, loader } = await buildRegisteredModules(runtime, {
      criticalModules: [],
      factories: {
        'custom-override': () => mockModule,
      },
    });

    // Assert
    expect(modules.some((m) => m.name === 'custom-override')).toBe(true);
    expect(loader.isNavigationMessage('زر مخصص')).toBe(true);
    expect(loader.isNavigationMessage('زر غير معروف')).toBe(false);
  });

  it('initializes createBot successfully as an async function and wires sovereign loader', async () => {
    // Arrange
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    try {
      const bot = await createBot();

      // Assert
      expect(bot).toBeDefined();
      expect(bot).not.toBeNull();
      expect(bot.api).toBeDefined();
      expect(typeof bot.on).toBe('function');
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
