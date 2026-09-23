import { describe, it, expect, vi } from 'vitest';
import { SovereignAutoLoader, type ModuleRuntimeContext } from '@alsaada/core-components';
import { scanMonorepoCatalog } from '../../../tools/modules/catalog.js';
import { buildSandboxPingMainMenuKeyboard, buildSandboxPingConfirmKeyboard } from '../src/flows/99.1-sandbox-ping/index.js';
import { buildSandboxCalcMainMenuKeyboard, buildSandboxCalcConfirmKeyboard } from '../src/flows/99.2-sandbox-calc/index.js';

describe('🧪 Monorepo Module Autodiscovery E2E Spec (sandbox)', () => {
  it('1. scanMonorepoCatalog automatically detects sandbox module and its 2 flows', () => {
    const catalog = scanMonorepoCatalog();

    // Module detection
    const sandboxModule = catalog.modules.find((m) => m.id === 'sandbox');
    expect(sandboxModule).toBeDefined();
    expect(sandboxModule?.schemaVersion).toBe('2.0.0');
    expect(sandboxModule?.titleArabic).toBe('مختبر التجارب والتطوير الميداني');
    expect(sandboxModule?.status).toBe('active');
    expect(sandboxModule?.callbackPrefixes).toContain('action:sandbox:');
    expect(sandboxModule?.callbackPrefixes).toContain('wizard:sandbox:');

    // Flow count in module
    expect(sandboxModule?.flows).toHaveLength(2);

    // Global flows list registration
    const pingFlow = catalog.flows.find((f) => f.id === '99.1');
    expect(pingFlow).toBeDefined();
    expect(pingFlow?.module).toBe('sandbox');
    expect(pingFlow?.slug).toBe('sandbox-ping');
    expect(pingFlow?.titleArabic).toBe('فحص النبض والاستجابة');
    expect(pingFlow?.status).toBe('active');

    const calcFlow = catalog.flows.find((f) => f.id === '99.2');
    expect(calcFlow).toBeDefined();
    expect(calcFlow?.module).toBe('sandbox');
    expect(calcFlow?.slug).toBe('sandbox-calc');
    expect(calcFlow?.titleArabic).toBe('العمليات الحسابية والقناع المالي');
    expect(calcFlow?.status).toBe('active');
  });

  it('2. SovereignAutoLoader loads sandbox module dynamically from filesystem with zero bot-server registration', async () => {
    const mockRuntime: Partial<ModuleRuntimeContext> = {
      prisma: { $connect: vi.fn() } as any,
      redis: { ping: vi.fn().mockResolvedValue('PONG'), status: 'ready' } as any,
      api: { sendMessage: vi.fn() } as any,
      screenFlow: { getActiveScreen: vi.fn() } as any,
      telemetry: { logEvent: vi.fn() } as any,
    };

    // Instantiate SovereignAutoLoader with NO manual factories registered for sandbox
    const loader = new SovereignAutoLoader({
      factories: {},
    });

    const result = await loader.loadModules(mockRuntime as ModuleRuntimeContext);

    // Verify sandbox is dynamically discovered and loaded
    const loadedSandbox = result.modules.find(
      (m) => m.name === 'sandbox' || (m as any).id === 'sandbox'
    );
    expect(loadedSandbox).toBeDefined();
    expect(loadedSandbox?.status).toBe('active');

    // Verify active modules list includes sandbox
    const activeSandbox = result.activeModules.find(
      (m) => m.name === 'sandbox' || (m as any).id === 'sandbox'
    );
    expect(activeSandbox).toBeDefined();

    // Verify navigation patterns aggregation
    expect(result.navigationPatterns).toContain('🧪 المختبر التجريبي');

    // Verify positive navigation matches (with optional whitespace)
    expect(result.navigationRegex.test('🧪 المختبر التجريبي')).toBe(true);
    expect(result.navigationRegex.test('  🧪 المختبر التجريبي  ')).toBe(true);
    expect(result.navigationRegex.test('المختبر التجريبي')).toBe(true);

    // Verify negative navigation rejections (strict anchoring, no accidental substring matches)
    expect(result.navigationRegex.test('🧪 المختبر التجريبي المتقدم')).toBe(false);
    expect(result.navigationRegex.test('المختبر التجريبي الميداني والتطوير')).toBe(false);
    expect(result.navigationRegex.test('مرحبا بك')).toBe(false);

    // Verify persistent reply buttons for roles
    if (typeof loadedSandbox?.getPersistentReplyButtons === 'function') {
      const superAdminButtons = loadedSandbox.getPersistentReplyButtons('SUPER_ADMIN');
      expect(superAdminButtons).toContain('🧪 المختبر التجريبي');
    }

    // Verify registerRoutes is implemented and binds to a mock Grammy Bot
    expect(typeof loadedSandbox?.registerRoutes).toBe('function');
    const mockBot = {
      command: vi.fn(),
      hears: vi.fn(),
      callbackQuery: vi.fn(),
    };
    loadedSandbox!.registerRoutes(mockBot as any, mockRuntime as any);
    expect(mockBot.command).toHaveBeenCalledWith('sandbox', expect.any(Function));
    expect(mockBot.hears).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
    expect(mockBot.callbackQuery).toHaveBeenCalledWith(/^action:sandbox:ping/, expect.any(Function));
    expect(mockBot.callbackQuery).toHaveBeenCalledWith(/^action:sandbox:calc/, expect.any(Function));
  });

  it('3. All sandbox keyboards strictly conform to Telegram Ergonomics Budget (36/16/7/3)', () => {
    const keyboards = [
      buildSandboxPingMainMenuKeyboard(),
      buildSandboxPingConfirmKeyboard('ref-1'),
      buildSandboxCalcMainMenuKeyboard(),
      buildSandboxCalcConfirmKeyboard('calc-1'),
    ];

    for (const kb of keyboards) {
      expect(kb.inline_keyboard.length).toBeLessThanOrEqual(7);

      for (const row of kb.inline_keyboard) {
        expect(row.length).toBeLessThanOrEqual(3);

        for (const btn of row) {
          // Max 16 characters per inline button label
          expect(btn.text.length).toBeLessThanOrEqual(16);

          // Max 64 bytes for callback data
          const callbackBytes = Buffer.byteLength(btn.callback_data, 'utf8');
          expect(callbackBytes).toBeLessThanOrEqual(64);

          // Must begin with valid sandbox prefix
          expect(
            btn.callback_data.startsWith('action:sandbox:') ||
            btn.callback_data.startsWith('wizard:sandbox:')
          ).toBe(true);
        }
      }
    }
  });
});
