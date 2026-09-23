import { describe, it, expect, vi } from 'vitest';
import { assertRichMessage } from '@alsaada/core-components';
import {
  MODULE_DEFINITION,
  createSandboxAppModule,
  registerSandboxRoutes,
  buildSandboxHubKeyboard,
} from '../src/index.js';

describe('Work Plan 89 — Module sandbox Contract & Factory Spec', () => {
  it('instantiates module with status active and valid V2 metadata', () => {
    expect(MODULE_DEFINITION.id).toBe('sandbox');
    expect(MODULE_DEFINITION.titleArabic).toBe('مختبر التجارب والتطوير الميداني');
    expect(MODULE_DEFINITION.status).toBe('active');
    expect(MODULE_DEFINITION.callbackPrefixes).toContain('action:sandbox:');
    expect(MODULE_DEFINITION.callbackPrefixes).toContain('menu:domain:sandbox');
    expect(MODULE_DEFINITION.callbackPrefixes).toContain('flow:99.');

    const appMod = createSandboxAppModule();
    expect(appMod.id).toBe('sandbox');
    expect(appMod.status).toBe('active');
    expect(appMod.callbackPrefixes).toContain('menu:domain:sandbox');
    expect(appMod.callbackPrefixes).toContain('flow:99.');
  });

  describe('Route Registration & Grammy Bot Integration', () => {
    function createMockBot() {
      const commands = new Map<string, (ctx: any) => Promise<void>>();
      const hearsList: { regex: RegExp; handler: (ctx: any) => Promise<void> }[] = [];
      const callbackQueries: { pattern: string | RegExp; handler: (ctx: any) => Promise<void> }[] = [];

      return {
        commands,
        hearsList,
        callbackQueries,
        bot: {
          command: vi.fn((cmd: string, handler: (ctx: any) => Promise<void>) => {
            commands.set(cmd, handler);
          }),
          hears: vi.fn((pattern: RegExp, handler: (ctx: any) => Promise<void>) => {
            hearsList.push({ regex: pattern, handler });
          }),
          callbackQuery: vi.fn((pattern: string | RegExp, handler: (ctx: any) => Promise<void>) => {
            callbackQueries.push({ pattern, handler });
          }),
        },
      };
    }

    it('registers command, hears, and callbackQuery routes on bot via createSandboxAppModule', () => {
      const { bot } = createMockBot();
      const appMod = createSandboxAppModule();

      appMod.registerRoutes(bot as any, {} as any);

      // 1. Verify bot.command('sandbox', ...) was registered
      expect(bot.command).toHaveBeenCalledWith('sandbox', expect.any(Function));

      // 2. Verify bot.hears(/المختبر التجريبي/, ...) was registered
      expect(bot.hears).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
      const hearsCall = (bot.hears as any).mock.calls.find((call: any[]) =>
        call[0] instanceof RegExp && call[0].test('المختبر التجريبي')
      );
      expect(hearsCall).toBeDefined();

      // 3. Verify bot.callbackQuery(/^action:sandbox:ping/, ...) was registered
      const pingCallbackCall = (bot.callbackQuery as any).mock.calls.find((call: any[]) =>
        call[0] instanceof RegExp && call[0].source === '^action:sandbox:ping'
      );
      expect(pingCallbackCall).toBeDefined();

      // 4. Verify bot.callbackQuery(/^action:sandbox:calc/, ...) was registered
      const calcCallbackCall = (bot.callbackQuery as any).mock.calls.find((call: any[]) =>
        call[0] instanceof RegExp && call[0].source === '^action:sandbox:calc'
      );
      expect(calcCallbackCall).toBeDefined();

      // 5. Verify bot.callbackQuery('menu:domain:sandbox', ...) was registered
      expect(bot.callbackQuery).toHaveBeenCalledWith('menu:domain:sandbox', expect.any(Function));

      // 6. Verify handlers are attached to appMod
      expect(appMod.handlers).toBeDefined();
      expect(appMod.handlers?.pingController).toBeDefined();
      expect(appMod.handlers?.calcController).toBeDefined();
      expect(appMod.handlers?.renderHub).toBeDefined();
    });

    it('executes /sandbox command and replies with rich initial prompt message', async () => {
      const { bot, commands } = createMockBot();
      const appMod = createSandboxAppModule();
      appMod.registerRoutes(bot as any, {} as any);

      const commandHandler = commands.get('sandbox');
      expect(commandHandler).toBeDefined();

      const replied: any[] = [];
      const mockCtx = {
        reply: vi.fn(async (content: any, extra?: any) => {
          replied.push({ content, extra });
        }),
      };

      await commandHandler!(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      const { content, extra } = replied[0];
      expect(() => assertRichMessage(content)).not.toThrow();
      expect(extra?.reply_markup?.inline_keyboard).toBeDefined();
      expect(extra.reply_markup.inline_keyboard.length).toBeGreaterThan(0);
    });

    it('executes hears(/المختبر التجريبي/) and replies with rich prompt message', async () => {
      const { bot, hearsList } = createMockBot();
      const appMod = createSandboxAppModule();
      appMod.registerRoutes(bot as any, {} as any);

      const hearsEntry = hearsList.find((h) => h.regex.test('🧪 المختبر التجريبي'));
      expect(hearsEntry).toBeDefined();

      const replied: any[] = [];
      const mockCtx = {
        reply: vi.fn(async (content: any, extra?: any) => {
          replied.push({ content, extra });
        }),
      };

      await hearsEntry!.handler(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      const { content, extra } = replied[0];
      expect(() => assertRichMessage(content)).not.toThrow();
      expect(extra?.reply_markup).toBeDefined();
    });

    it('executes callback query matching ^action:sandbox:ping via SandboxPingController', async () => {
      const { bot, callbackQueries } = createMockBot();
      const appMod = createSandboxAppModule();
      appMod.registerRoutes(bot as any, {} as any);

      const pingRoute = callbackQueries.find(
        (cq) => cq.pattern instanceof RegExp && cq.pattern.test('action:sandbox:ping:start')
      );
      expect(pingRoute).toBeDefined();

      const replied: any[] = [];
      const mockCtx = {
        callbackQuery: { data: 'action:sandbox:ping:start' },
        reply: vi.fn(async (content: any) => {
          replied.push(content);
        }),
      };

      await pingRoute!.handler(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      expect(() => assertRichMessage(replied[0])).not.toThrow();
    });

    it('executes callback query matching ^action:sandbox:calc via SandboxCalcController', async () => {
      const { bot, callbackQueries } = createMockBot();
      const appMod = createSandboxAppModule();
      appMod.registerRoutes(bot as any, {} as any);

      const calcRoute = callbackQueries.find(
        (cq) => cq.pattern instanceof RegExp && cq.pattern.test('action:sandbox:calc:net')
      );
      expect(calcRoute).toBeDefined();

      const replied: any[] = [];
      const mockCtx = {
        callbackQuery: { data: 'action:sandbox:calc:net' },
        reply: vi.fn(async (content: any) => {
          replied.push(content);
        }),
      };

      await calcRoute!.handler(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      expect(() => assertRichMessage(replied[0])).not.toThrow();
    });

    it('executes calc masking callback query returning rich table message', async () => {
      const { bot, callbackQueries } = createMockBot();
      const appMod = createSandboxAppModule();
      appMod.registerRoutes(bot as any, {} as any);

      const calcRoute = callbackQueries.find(
        (cq) => cq.pattern instanceof RegExp && cq.pattern.test('action:sandbox:calc:mask')
      );
      expect(calcRoute).toBeDefined();

      const replied: any[] = [];
      const mockCtx = {
        callbackQuery: { data: 'action:sandbox:calc:mask' },
        reply: vi.fn(async (content: any) => {
          replied.push(content);
        }),
      };

      await calcRoute!.handler(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      expect(() => assertRichMessage(replied[0])).not.toThrow();
    });

    it('executes menu callback queries (sandbox-ping and sandbox-calc)', async () => {
      const { bot, callbackQueries } = createMockBot();
      const appMod = createSandboxAppModule();
      appMod.registerRoutes(bot as any, {} as any);

      // sandbox-ping
      const menuPingRoute = callbackQueries.find(
        (cq) => cq.pattern instanceof RegExp && cq.pattern.test('action:sandbox:sandbox-ping:start')
      );
      expect(menuPingRoute).toBeDefined();

      const repliedPing: any[] = [];
      await menuPingRoute!.handler({
        callbackQuery: { data: 'action:sandbox:sandbox-ping:start' },
        reply: vi.fn(async (content: any) => {
          repliedPing.push(content);
        }),
      });
      expect(repliedPing.length).toBe(1);

      // sandbox-calc
      const menuCalcRoute = callbackQueries.find(
        (cq) => cq.pattern instanceof RegExp && cq.pattern.test('action:sandbox:sandbox-calc:net')
      );
      expect(menuCalcRoute).toBeDefined();

      const repliedCalc: any[] = [];
      await menuCalcRoute!.handler({
        callbackQuery: { data: 'action:sandbox:sandbox-calc:net' },
        reply: vi.fn(async (content: any) => {
          repliedCalc.push(content);
        }),
      });
      expect(repliedCalc.length).toBe(1);
    });

    it('executes return navigation callback query action:sandbox:main', async () => {
      const { bot, callbackQueries } = createMockBot();
      const appMod = createSandboxAppModule();
      appMod.registerRoutes(bot as any, {} as any);

      const mainRoute = callbackQueries.find((cq) => cq.pattern === 'action:sandbox:main');
      expect(mainRoute).toBeDefined();

      const replied: any[] = [];
      await mainRoute!.handler({
        reply: vi.fn(async (content: any, extra?: any) => {
          replied.push({ content, extra });
        }),
      });
      expect(replied.length).toBe(1);
      expect(() => assertRichMessage(replied[0].content)).not.toThrow();
    });

    it('executes callback query menu:domain:sandbox to open sandbox hub', async () => {
      const { bot, callbackQueries } = createMockBot();
      const appMod = createSandboxAppModule();
      appMod.registerRoutes(bot as any, {} as any);

      const menuDomainRoute = callbackQueries.find((cq) => cq.pattern === 'menu:domain:sandbox');
      expect(menuDomainRoute).toBeDefined();

      const replied: any[] = [];
      const mockCtx = {
        callbackQuery: { data: 'menu:domain:sandbox' },
        reply: vi.fn(async (content: any, extra?: any) => {
          replied.push({ content, extra });
        }),
      };

      await menuDomainRoute!.handler(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      const { content, extra } = replied[0];
      expect(() => assertRichMessage(content)).not.toThrow();
      expect(extra?.reply_markup?.inline_keyboard).toBeDefined();
    });

    it('executes catalog flow trigger flow:99.1:start to open ping prompt', async () => {
      const { bot, callbackQueries } = createMockBot();
      const appMod = createSandboxAppModule();
      appMod.registerRoutes(bot as any, {} as any);

      const pingCatalogRoute = callbackQueries.find(
        (cq) => cq.pattern instanceof RegExp && cq.pattern.test('flow:99.1:start')
      );
      expect(pingCatalogRoute).toBeDefined();

      const replied: any[] = [];
      const mockCtx = {
        callbackQuery: { data: 'flow:99.1:start' },
        reply: vi.fn(async (content: any, extra?: any) => {
          replied.push({ content, extra });
        }),
      };

      await pingCatalogRoute!.handler(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      const { content, extra } = replied[0];
      expect(() => assertRichMessage(content)).not.toThrow();
      expect(extra?.reply_markup?.inline_keyboard).toBeDefined();
    });

    it('executes catalog flow trigger flow:99.2:start to open calc prompt', async () => {
      const { bot, callbackQueries } = createMockBot();
      const appMod = createSandboxAppModule();
      appMod.registerRoutes(bot as any, {} as any);

      const calcCatalogRoute = callbackQueries.find(
        (cq) => cq.pattern instanceof RegExp && cq.pattern.test('flow:99.2:start')
      );
      expect(calcCatalogRoute).toBeDefined();

      const replied: any[] = [];
      const mockCtx = {
        callbackQuery: { data: 'flow:99.2:start' },
        reply: vi.fn(async (content: any, extra?: any) => {
          replied.push({ content, extra });
        }),
      };

      await calcCatalogRoute!.handler(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      const { content, extra } = replied[0];
      expect(() => assertRichMessage(content)).not.toThrow();
      expect(extra?.reply_markup?.inline_keyboard).toBeDefined();
    });

    it('executes flow selection callback queries (action:sandbox:flow:ping and action:sandbox:flow:calc)', async () => {
      const { bot, callbackQueries } = createMockBot();
      const appMod = createSandboxAppModule();
      appMod.registerRoutes(bot as any, {} as any);

      const flowPingRoute = callbackQueries.find(
        (cq) => (cq.pattern instanceof RegExp && cq.pattern.test('action:sandbox:flow:ping')) || cq.pattern === 'action:sandbox:flow:ping'
      );
      expect(flowPingRoute).toBeDefined();

      const repliedPing: any[] = [];
      await flowPingRoute!.handler({
        reply: vi.fn(async (content: any, extra?: any) => {
          repliedPing.push({ content, extra });
        }),
      });
      expect(repliedPing.length).toBe(1);
      expect(() => assertRichMessage(repliedPing[0].content)).not.toThrow();

      const flowCalcRoute = callbackQueries.find(
        (cq) => (cq.pattern instanceof RegExp && cq.pattern.test('action:sandbox:flow:calc')) || cq.pattern === 'action:sandbox:flow:calc'
      );
      expect(flowCalcRoute).toBeDefined();

      const repliedCalc: any[] = [];
      await flowCalcRoute!.handler({
        reply: vi.fn(async (content: any, extra?: any) => {
          repliedCalc.push({ content, extra });
        }),
      });
      expect(repliedCalc.length).toBe(1);
      expect(() => assertRichMessage(repliedCalc[0].content)).not.toThrow();
    });

    it('appMod.onTextInput with text containing "المختبر التجريبي" triggers renderHub', async () => {
      const { bot } = createMockBot();
      const appMod = createSandboxAppModule();
      appMod.registerRoutes(bot as any, {} as any);

      const replied: any[] = [];
      const mockCtx = {
        reply: vi.fn(async (content: any, extra?: any) => {
          replied.push({ content, extra });
        }),
      };

      const handled = await appMod.onTextInput!(mockCtx as any, '🧪 المختبر التجريبي');
      expect(handled).toBe(true);
      expect(mockCtx.reply).toHaveBeenCalledTimes(1);
      const { content, extra } = replied[0];
      expect(() => assertRichMessage(content)).not.toThrow();
      expect(extra?.reply_markup?.inline_keyboard).toBeDefined();

      const notHandled = await appMod.onTextInput!(mockCtx as any, 'نص عشوائي غير مرتبط');
      expect(notHandled).toBe(false);
    });

    it('buildSandboxHubKeyboard produces dynamic buttons matching Telegram budget', () => {
      // Test default registered flows
      const defaultKb = buildSandboxHubKeyboard();
      expect(defaultKb.inline_keyboard.length).toBeGreaterThan(0);
      expect(defaultKb.inline_keyboard.length).toBeLessThanOrEqual(7);

      for (let r = 0; r < defaultKb.inline_keyboard.length - 1; r++) {
        const row = defaultKb.inline_keyboard[r]!;
        expect(row.length).toBeLessThanOrEqual(2);
        for (const btn of row) {
          expect(btn.text.length).toBeLessThanOrEqual(16);
          expect(Buffer.byteLength(btn.callback_data, 'utf8')).toBeLessThanOrEqual(36);
        }
      }

      // Check last row is main menu
      const lastRow = defaultKb.inline_keyboard[defaultKb.inline_keyboard.length - 1]!;
      expect(lastRow[0]!.callback_data).toBe('action:main_menu');

      // Test custom dynamic flow list
      const customFlows = [
        { id: '1', flowCode: '1', titleArabic: 'تدفق أول تجريبي', buttonLabel: 'تدفق أول', callbackData: 'flow:custom:1' },
        { id: '2', flowCode: '2', titleArabic: 'تدفق ثان تجريبي', buttonLabel: 'تدفق ثان', callbackData: 'flow:custom:2' },
        { id: '3', flowCode: '3', titleArabic: 'تدفق ثالث طويل جدا يتجاوز الحد', buttonLabel: 'تدفق ثالث طويل جدا يتجاوز الحد', callbackData: 'flow:custom:3' },
      ];
      const customKb = buildSandboxHubKeyboard(customFlows);

      // 3 items -> 2 rows of flows + 1 row for main menu = 3 rows
      expect(customKb.inline_keyboard).toHaveLength(3);
      expect(customKb.inline_keyboard[0]).toHaveLength(2);
      expect(customKb.inline_keyboard[1]).toHaveLength(1);
      expect(customKb.inline_keyboard[2]).toHaveLength(1);

      // Verify label clipping to <= 16 chars
      expect(customKb.inline_keyboard[1]![0]!.text.length).toBeLessThanOrEqual(16);
      expect(customKb.inline_keyboard[1]![0]!.callback_data).toBe('flow:custom:3');
      expect(Buffer.byteLength(customKb.inline_keyboard[1]![0]!.callback_data, 'utf8')).toBeLessThanOrEqual(36);
    });

    it('supports standalone registerSandboxRoutes invocation', () => {
      const { bot } = createMockBot();
      const handlers = registerSandboxRoutes(bot as any);

      expect(handlers.pingController).toBeDefined();
      expect(handlers.calcController).toBeDefined();
      expect(bot.command).toHaveBeenCalledWith('sandbox', expect.any(Function));
    });

    it('handles unexpected errors gracefully without unhandled rejections', async () => {
      const { bot, callbackQueries } = createMockBot();
      const handlers = registerSandboxRoutes(bot as any);

      vi.spyOn(handlers.pingController, 'dispatchAction').mockRejectedValueOnce(
        new Error('Unexpected dispatch failure')
      );

      const pingRoute = callbackQueries.find(
        (cq) => cq.pattern instanceof RegExp && cq.pattern.test('action:sandbox:ping')
      );

      const mockCtx = {
        callbackQuery: { data: 'action:sandbox:ping:error' },
        reply: vi.fn(),
      };

      await expect(pingRoute!.handler(mockCtx)).resolves.not.toThrow();
    });
  });
});
