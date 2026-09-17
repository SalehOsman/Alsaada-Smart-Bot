import type { Context, InlineKeyboard } from 'grammy';
import type { ActiveScreenTracker, RenderInPlaceOptions, RenderInPlaceResult } from './types.js';

let globalScreenTracker: ActiveScreenTracker | undefined;

export function configureScreenTracker(tracker: ActiveScreenTracker): void {
  globalScreenTracker = tracker;
}

export function getScreenTracker(): ActiveScreenTracker | undefined {
  return globalScreenTracker;
}

export function clearScreenTracker(): void {
  globalScreenTracker = undefined;
}

export function isNotModifiedError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  const desc =
    typeof err === 'object' && err !== null && 'description' in err
      ? String((err as { description?: unknown }).description)
      : '';
  const combined = `${msg} ${desc}`.toLowerCase();
  return combined.includes('message is not modified');
}

export function isParseEntitiesError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  const desc =
    typeof err === 'object' && err !== null && 'description' in err
      ? String((err as { description?: unknown }).description)
      : '';
  const combined = `${msg} ${desc}`.toLowerCase();
  return (
    combined.includes('parse entities') ||
    combined.includes('cant parse entities') ||
    combined.includes("can't parse entities")
  );
}

export async function shouldRenderInPlace(
  ctx: Context,
  requestedInPlace = true,
  screenTracker?: ActiveScreenTracker
): Promise<boolean> {
  if (!requestedInPlace) return false;
  if (!ctx.callbackQuery) return false;
  const tracker = screenTracker ?? getScreenTracker();
  if (tracker?.shouldRenderInPlace) {
    return tracker.shouldRenderInPlace(ctx, requestedInPlace);
  }
  const telegramId = ctx.from?.id ? BigInt(ctx.from.id) : undefined;
  const clickedMsgId = ctx.callbackQuery.message?.message_id;
  if (!clickedMsgId || !telegramId || !tracker?.getActiveScreen) return requestedInPlace;
  try {
    const active = await tracker.getActiveScreen(telegramId);
    if (active && active.isCompleted && active.messageId === clickedMsgId) {
      return false; // Receipt card remains permanently in chat
    }
  } catch {
    // Fallback to requestedInPlace
  }
  return requestedInPlace;
}

export async function deleteUserInputMessage(ctx: Context): Promise<boolean> {
  if (ctx.callbackQuery) return false;
  try {
    if (typeof (ctx as { deleteMessage?: () => Promise<unknown> }).deleteMessage === 'function') {
      await ctx.deleteMessage();
      return true;
    }
    if (ctx.message?.message_id && ctx.chat?.id && ctx.api?.deleteMessage) {
      await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export async function renderInPlaceWizardStep(
  ctx: Context,
  options: RenderInPlaceOptions
): Promise<RenderInPlaceResult> {
  const telegramId = options.telegramId ?? (ctx.from?.id ? BigInt(ctx.from.id) : undefined);
  const chatId = options.chatId ?? ctx.chat?.id ?? ctx.callbackQuery?.message?.chat?.id;
  const tracker = options.screenTracker ?? getScreenTracker();

  // 1. Silent user input deletion if incoming message is a user message (not callback query)
  if (options.deleteUserInput !== false) {
    await deleteUserInputMessage(ctx);
  }

  // 2. Resolve target message ID to edit
  let targetMessageId = options.activeMessageId;
  let targetIsCompleted = false;

  if (!targetMessageId) {
    if (ctx.callbackQuery?.message?.message_id) {
      targetMessageId = ctx.callbackQuery.message.message_id;
    } else if (ctx.callbackQuery) {
      targetMessageId = 1;
    } else if (telegramId && tracker?.getActiveScreen) {
      try {
        const active = await tracker.getActiveScreen(telegramId);
        if (active?.messageId) {
          targetMessageId = active.messageId;
          targetIsCompleted = Boolean(active.isCompleted);
        }
      } catch {
        // Fallback to undefined
      }
    }
  }

  // Check if target message is already a completed operation receipt card
  if (!targetIsCompleted && telegramId && tracker?.getActiveScreen) {
    try {
      const active = await tracker.getActiveScreen(telegramId);
      if (
        active &&
        active.isCompleted &&
        (active.messageId === targetMessageId ||
          active.messageId === ctx.callbackQuery?.message?.message_id)
      ) {
        targetIsCompleted = true;
      }
    } catch {
      // Non-blocking safety
    }
  }

  // If previous screen was completed and this step is NOT a completion card:
  // PRESERVE the completed receipt permanently in chat!
  if (targetIsCompleted && options.preservePreviousCompletedScreen !== false && !options.isCompleted) {
    // Strip action buttons from completed card while preserving external URL buttons (e.g. WhatsApp invite link)
    if (chatId && targetMessageId && ctx.api?.editMessageReplyMarkup) {
      const currentRows = ctx.callbackQuery?.message?.reply_markup?.inline_keyboard;
      if (currentRows) {
        const urlOnlyRows = currentRows
          .map((row) => row.filter((btn) => 'url' in btn))
          .filter((row) => row.length > 0);
        await ctx.api
          .editMessageReplyMarkup(chatId, targetMessageId, {
            reply_markup: { inline_keyboard: urlOnlyRows },
          })
          .catch(() => {});
      }
    }
    // Clear targetMessageId so we do NOT edit or delete the completed receipt card
    targetMessageId = undefined;
  }

  const isDisabled = options.disableWebPagePreview !== false;
  const baseExtra: {
    link_preview_options: { is_disabled: boolean };
    disable_web_page_preview?: boolean;
    reply_markup?: InlineKeyboard;
  } = {
    link_preview_options: { is_disabled: isDisabled },
    disable_web_page_preview: isDisabled,
  };
  if (options.keyboard) {
    baseExtra.reply_markup = options.keyboard;
  }

  const extra = {
    ...baseExtra,
    parse_mode: options.parseMode ?? 'Markdown',
  };

  let resolvedMessageId: number | undefined;
  let editedInPlace = false;

  // 3. In-Place Editing Attempt
  // Case A: Click on an inline button where targetMessageId matches callbackQuery message
  if (
    targetMessageId &&
    ctx.callbackQuery &&
    typeof ctx.editMessageText === 'function' &&
    (!ctx.callbackQuery.message?.message_id || targetMessageId === ctx.callbackQuery.message.message_id)
  ) {
    try {
      const res = await ctx.editMessageText(options.prompt, extra);
      if (res) {
        resolvedMessageId =
          typeof res === 'object' && res !== null && 'message_id' in res
            ? (res as { message_id: number }).message_id
            : (ctx.callbackQuery.message?.message_id ?? targetMessageId ?? 1);
        editedInPlace = true;
      }
    } catch (err) {
      if (isNotModifiedError(err)) {
        resolvedMessageId = ctx.callbackQuery.message?.message_id ?? targetMessageId ?? 1;
        editedInPlace = true;
      } else if (isParseEntitiesError(err) && typeof ctx.editMessageText === 'function') {
        // Fallback: retry without parse_mode if Markdown entities are invalid
        try {
          const res = await ctx.editMessageText(options.prompt, baseExtra);
          if (res) {
            resolvedMessageId =
              typeof res === 'object' && res !== null && 'message_id' in res
                ? (res as { message_id: number }).message_id
                : (ctx.callbackQuery.message?.message_id ?? targetMessageId ?? 1);
            editedInPlace = true;
          }
        } catch (retryErr) {
          if (isNotModifiedError(retryErr)) {
            resolvedMessageId = ctx.callbackQuery.message?.message_id ?? targetMessageId ?? 1;
            editedInPlace = true;
          }
        }
      }
    }
  }

  // Case B: Text / photo input or targetMessageId specified on existing chat
  if (
    !resolvedMessageId &&
    targetMessageId &&
    (Boolean(chatId && ctx.api?.editMessageText) || typeof ctx.editMessageText === 'function')
  ) {
    const doEdit = (p: string, ex: typeof extra | typeof baseExtra) => {
      if (chatId && ctx.api?.editMessageText) {
        return ctx.api.editMessageText(chatId, targetMessageId, p, ex);
      }
      return (ctx.editMessageText as (p: string, ex: typeof extra | typeof baseExtra) => Promise<unknown>)(p, ex);
    };

    try {
      const res = await doEdit(options.prompt, extra);
      if (res) {
        resolvedMessageId =
          typeof res === 'object' && res !== null && 'message_id' in res
            ? (res as { message_id: number }).message_id
            : targetMessageId;
        editedInPlace = true;
      }
    } catch (err) {
      if (isNotModifiedError(err)) {
        resolvedMessageId = targetMessageId;
        editedInPlace = true;
      } else if (isParseEntitiesError(err)) {
        // Fallback: retry without parse_mode if Markdown entities are invalid
        try {
          const res = await doEdit(options.prompt, baseExtra);
          if (res) {
            resolvedMessageId =
              typeof res === 'object' && res !== null && 'message_id' in res
                ? (res as { message_id: number }).message_id
                : targetMessageId;
            editedInPlace = true;
          }
        } catch (retryErr) {
          if (isNotModifiedError(retryErr)) {
            resolvedMessageId = targetMessageId;
            editedInPlace = true;
          }
        }
      }
    }
  }

  // 4. Fallback: If in-place editing failed or no targetMessageId existed
  if (!resolvedMessageId) {
    let sentMsg: unknown;
    if (typeof ctx.reply === 'function') {
      try {
        sentMsg = await ctx.reply(options.prompt, extra);
      } catch (err) {
        if (isParseEntitiesError(err)) {
          sentMsg = await ctx.reply(options.prompt, baseExtra).catch(() => undefined);
        }
      }
    }
    if (!sentMsg && chatId && ctx.api?.sendMessage) {
      try {
        sentMsg = await ctx.api.sendMessage(chatId, options.prompt, extra);
      } catch (err) {
        if (isParseEntitiesError(err)) {
          sentMsg = await ctx.api.sendMessage(chatId, options.prompt, baseExtra).catch(() => undefined);
        }
      }
    }

    if (sentMsg) {
      if (typeof sentMsg === 'object' && 'message_id' in sentMsg) {
        resolvedMessageId = (sentMsg as { message_id: number }).message_id;
      } else if (typeof sentMsg === 'number') {
        resolvedMessageId = sentMsg;
      } else {
        resolvedMessageId = targetMessageId ?? 1;
      }
      editedInPlace = false;

      // Clean up previous unfinished message if it existed (never delete completed cards!)
      if (
        targetMessageId &&
        chatId &&
        targetMessageId !== resolvedMessageId &&
        !targetIsCompleted &&
        ctx.api
      ) {
        await ctx.api.deleteMessage(chatId, targetMessageId).catch(async () => {
          if (ctx.api?.editMessageReplyMarkup) {
            await ctx.api
              .editMessageReplyMarkup(chatId, targetMessageId, {
                reply_markup: { inline_keyboard: [] },
              })
              .catch(() => {});
          }
        });
      }
    }
  }

  if (!resolvedMessageId) {
    throw new Error('renderInPlaceWizardStep: Failed to edit in-place or send fallback message');
  }

  const finalChatId = chatId ?? (ctx.chat?.id || 0);

  // 5. Automatic Active Screen Synchronization
  if (tracker && telegramId && finalChatId) {
    try {
      await tracker.trackActiveScreen(
        telegramId,
        finalChatId,
        resolvedMessageId,
        options.flowType ?? 'wizard_step',
        options.isCompleted ?? false
      );
    } catch {
      // Non-blocking safety for tracker errors
    }
  }

  if (options.onMessageIdUpdated) {
    try {
      await options.onMessageIdUpdated(resolvedMessageId);
    } catch {
      // Ignore callback errors
    }
  }

  return {
    messageId: resolvedMessageId,
    chatId: finalChatId,
    editedInPlace,
  };
}

export async function renderInPlaceCompletion(
  ctx: Context,
  options: Omit<RenderInPlaceOptions, 'isCompleted'>
): Promise<RenderInPlaceResult> {
  return renderInPlaceWizardStep(ctx, {
    ...options,
    isCompleted: true,
  });
}

export class InPlaceFlowManager {
  static configureTracker(tracker: ActiveScreenTracker): void {
    configureScreenTracker(tracker);
  }

  static getTracker(): ActiveScreenTracker | undefined {
    return getScreenTracker();
  }

  static clearTracker(): void {
    clearScreenTracker();
  }

  static async shouldRenderInPlace(
    ctx: Context,
    requestedInPlace = true,
    screenTracker?: ActiveScreenTracker
  ): Promise<boolean> {
    return shouldRenderInPlace(ctx, requestedInPlace, screenTracker);
  }

  static async renderStep(ctx: Context, options: RenderInPlaceOptions): Promise<RenderInPlaceResult> {
    return renderInPlaceWizardStep(ctx, options);
  }

  static async renderCompletion(
    ctx: Context,
    options: Omit<RenderInPlaceOptions, 'isCompleted'>
  ): Promise<RenderInPlaceResult> {
    return renderInPlaceCompletion(ctx, options);
  }

  static async deleteUserInput(ctx: Context): Promise<boolean> {
    return deleteUserInputMessage(ctx);
  }
}
