/**
 * Route Registration for Module: sandbox
 * Binds polymorphic bot commands, text navigation hears, and callback queries.
 */

import {
  type ModuleRuntimeContext,
  buildRichPage,
  assertRichMessage,
  richParagraph,
} from '@alsaada/core-components';
import { SandboxPingController, handleSandboxPingError } from './flows/99.1-sandbox-ping/index.js';
import { SandboxCalcController, handleSandboxCalcError } from './flows/99.2-sandbox-calc/index.js';
import { SANDBOX_FLOWS, type RegisteredFlowItem } from './flows/registry.js';

export interface BotLike {
  command(command: string, handler: (ctx: any) => Promise<void> | void): unknown;
  hears(trigger: string | RegExp, handler: (ctx: any) => Promise<void> | void): unknown;
  callbackQuery(trigger: string | RegExp, handler: (ctx: any) => Promise<void> | void): unknown;
}

export interface SandboxModuleHandlers {
  pingController: SandboxPingController;
  calcController: SandboxCalcController;
  renderHub: (ctx: any) => Promise<void>;
}

export interface SandboxRouteOptions {
  prisma?: unknown;
}

export function buildSandboxHubKeyboard(flows: RegisteredFlowItem[] = SANDBOX_FLOWS) {
  const keyboardRows: Array<Array<{ text: string; callback_data: string }>> = [];

  for (let i = 0; i < flows.length; i += 2) {
    const chunk = flows.slice(i, i + 2);
    const row = chunk.map((flow) => {
      const raw = flow.buttonLabel || flow.titleArabic;
      const text = raw.length > 16 ? raw.slice(0, 16) : raw;
      return {
        text,
        callback_data: flow.callbackData,
      };
    });
    keyboardRows.push(row);
  }

  keyboardRows.push([
    { text: '🏠 القائمة الرئيسية', callback_data: 'action:main_menu' },
  ]);

  return {
    inline_keyboard: keyboardRows,
  };
}

export async function renderSandboxHub(ctx: any): Promise<void> {
  const hubRich = buildRichPage({
    title: '🧪 مختبر التجارب والتطوير الميداني',
    blocks: [
      richParagraph('يرجى اختيار الوظيفة أو التدفق المراد اختباره:'),
    ],
  });
  assertRichMessage(hubRich);
  const text = '🧪 *مختبر التجارب والتطوير الميداني*\n\nيرجى اختيار الوظيفة أو التدفق المراد اختباره:';
  const content = Object.assign(new String(text), hubRich);
  const keyboard = buildSandboxHubKeyboard();

  if (ctx.callbackQuery && typeof ctx.editMessageText === 'function') {
    try {
      await ctx.editMessageText(content, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return;
    } catch {}
  }

  await ctx.reply(content, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

/**
 * Registers all sandbox routes on the given bot instance.
 */
export function registerSandboxRoutes(
  bot: BotLike,
  runtime?: ModuleRuntimeContext<any> | SandboxRouteOptions
): SandboxModuleHandlers {
  const prisma = runtime && 'prisma' in runtime ? (runtime as any).prisma : undefined;
  const pingController = new SandboxPingController(prisma);
  const calcController = new SandboxCalcController(prisma);

  const ack = async (ctx: any) => {
    if (typeof ctx?.answerCallbackQuery === 'function') {
      await ctx.answerCallbackQuery().catch(() => {});
    }
  };

  // 1. Command: /sandbox -> Render Sandbox Hub
  bot.command('sandbox', async (ctx: any) => {
    try {
      await renderSandboxHub(ctx);
    } catch (err: unknown) {
      handleSandboxPingError(err, ctx);
    }
  });

  // 2. Navigation text hears: /المختبر التجريبي/ -> Render Sandbox Hub
  bot.hears(/المختبر التجريبي/, async (ctx: any) => {
    try {
      await renderSandboxHub(ctx);
    } catch (err: unknown) {
      handleSandboxPingError(err, ctx);
    }
  });

  // 3. Navigation return to Sandbox Hub
  bot.callbackQuery('action:sandbox:main', async (ctx: any) => {
    try {
      await ack(ctx);
      await renderSandboxHub(ctx);
    } catch (err: unknown) {
      handleSandboxPingError(err, ctx);
    }
  });

  bot.callbackQuery('menu:domain:sandbox', async (ctx: any) => {
    try {
      await ack(ctx);
      await renderSandboxHub(ctx);
    } catch (err: unknown) {
      handleSandboxPingError(err, ctx);
    }
  });

  // 4. Catalog & Hub flow navigation triggers
  bot.callbackQuery(/^(?:flow:99\.1(?::start)?|action:sandbox:flow:ping)$/, async (ctx: any) => {
    try {
      await ack(ctx);
      await pingController.renderInitialPrompt(ctx);
    } catch (err: unknown) {
      handleSandboxPingError(err, ctx);
    }
  });

  bot.callbackQuery(/^(?:flow:99\.2(?::start)?|action:sandbox:flow:calc)$/, async (ctx: any) => {
    try {
      await ack(ctx);
      await calcController.renderInitialPrompt(ctx);
    } catch (err: unknown) {
      handleSandboxCalcError(err, ctx);
    }
  });

  // 5. Callback queries for Flow 99.1 (sandbox-ping)
  bot.callbackQuery(/^action:sandbox:ping/, async (ctx: any) => {
    try {
      await ack(ctx);
      await pingController.dispatchAction(ctx);
    } catch (err: unknown) {
      handleSandboxPingError(err, ctx);
    }
  });

  bot.callbackQuery(/^action:sandbox:sandbox-ping/, async (ctx: any) => {
    try {
      await ack(ctx);
      await pingController.dispatchAction(ctx);
    } catch (err: unknown) {
      handleSandboxPingError(err, ctx);
    }
  });

  // 6. Callback queries for Flow 99.2 (sandbox-calc)
  bot.callbackQuery(/^action:sandbox:calc/, async (ctx: any) => {
    try {
      await ack(ctx);
      await calcController.dispatchAction(ctx);
    } catch (err: unknown) {
      handleSandboxCalcError(err, ctx);
    }
  });

  bot.callbackQuery(/^action:sandbox:sandbox-calc/, async (ctx: any) => {
    try {
      await ack(ctx);
      await calcController.dispatchAction(ctx);
    } catch (err: unknown) {
      handleSandboxCalcError(err, ctx);
    }
  });

  return {
    pingController,
    calcController,
    renderHub: renderSandboxHub,
  };
}
