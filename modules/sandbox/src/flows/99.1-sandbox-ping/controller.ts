/**
 * Master Controller for Flow 99.1 (sandbox-ping)
 */

import { assertRichMessage } from '@alsaada/core-components';
import { SandboxPingService } from './service.js';
import { handleSandboxPingAction, type FlowContextLike } from './action.handler.js';
import { handleSandboxPingError } from './error.handler.js';
import {
  buildSandboxPingMainMenuKeyboard,
  buildSandboxPingPromptMessage,
  formatSandboxPingPrompt,
} from './menu.builder.js';

export class SandboxPingController {
  private service: SandboxPingService;

  constructor(repository?: unknown) {
    this.service = new SandboxPingService(repository);
  }

  async renderInitialPrompt(ctx: FlowContextLike) {
    const richMsg = buildSandboxPingPromptMessage('فحص النبض والاستجابة');
    assertRichMessage(richMsg);
    const text = formatSandboxPingPrompt('فحص النبض والاستجابة');
    const content = Object.assign(new String(text), richMsg);
    const keyboard = buildSandboxPingMainMenuKeyboard();

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
      return await handleSandboxPingAction(ctx, this.service);
    } catch (err) {
      handleSandboxPingError(err, ctx);
      return false;
    }
  }
}
