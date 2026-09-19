import { describe, it, expect, vi } from 'vitest';
import { buildRegisteredModules, ModulePrefixRouter } from '../src/modules.registry.js';
import { createBot } from '../src/bot.js';
import type { MyContext } from '../src/types/context.js';
import type { ModuleRuntimeContext, AppModuleDefinition } from '@alsaada/core-components';

describe('🤖 Bot Server Modules Registry & Sovereign Auto-Loader Integration', () => {
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

  it('buildRegisteredModules dynamically loads real workforce and settings modules', async () => {
    const runtime = createMockRuntime();
    const { router, modules, loader } = await buildRegisteredModules(runtime);

    expect(modules.length).toBeGreaterThanOrEqual(2);
    const names = modules.map((m) => m.name);
    expect(names).toContain('workforce');
    expect(names).toContain('settings');

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

  it('supports custom factory overrides via options', async () => {
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

    const { modules, loader } = await buildRegisteredModules(runtime, {
      criticalModules: [],
      factories: {
        'custom-override': () => mockModule,
      },
    });

    expect(modules.some((m) => m.name === 'custom-override')).toBe(true);
    expect(loader.isNavigationMessage('زر مخصص')).toBe(true);
  });

  it('createBot initializes successfully as an async function and wires sovereign loader', async () => {
    const bot = await createBot();
    expect(bot).toBeDefined();
    expect(bot.api).toBeDefined();
    expect(typeof bot.on).toBe('function');
  });
});
