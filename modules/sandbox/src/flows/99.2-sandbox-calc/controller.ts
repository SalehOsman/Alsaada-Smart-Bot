/**
 * Master Controller for Flow 99.2 (sandbox-calc)
 */

import { assertRichMessage } from '@alsaada/core-components';
import { SandboxCalcService } from './service.js';
import { handleSandboxCalcAction, type FlowContextLike } from './action.handler.js';
import { handleSandboxCalcError } from './error.handler.js';
import {
  buildSandboxCalcMainMenuKeyboard,
  buildSandboxCalcPromptMessage,
  formatSandboxCalcPrompt,
} from './menu.builder.js';

export class SandboxCalcController {
  private service: SandboxCalcService;

  constructor(repository?: unknown) {
    this.service = new SandboxCalcService(repository);
  }

  async renderInitialPrompt(ctx: FlowContextLike) {
    const richMsg = buildSandboxCalcPromptMessage('العمليات الحسابية والقناع المالي');
    assertRichMessage(richMsg);
    const text = formatSandboxCalcPrompt('العمليات الحسابية والقناع المالي');
    const content = Object.assign(new String(text), richMsg);
    const keyboard = buildSandboxCalcMainMenuKeyboard();

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

  async dispatchAction(ctx: FlowContextLike) {
    try {
      return await handleSandboxCalcAction(ctx, this.service);
    } catch (err) {
      handleSandboxCalcError(err, ctx);
      return false;
    }
  }
}
