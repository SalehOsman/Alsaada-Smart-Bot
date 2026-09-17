import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InlineKeyboard } from 'grammy';
import {
  renderInPlaceWizardStep,
  renderInPlaceCompletion,
  configureScreenTracker,
  clearScreenTracker,
  deleteUserInputMessage,
  isNotModifiedError,
  isParseEntitiesError,
  shouldRenderInPlace,
  InPlaceFlowManager,
  type ActiveScreenTracker,
} from '../src/in-place-flow/index.js';

describe('In-Place Flow Single Message Lifecycle Engine', () => {
  beforeEach(() => {
    clearScreenTracker();
    vi.clearAllMocks();
  });

  describe('isNotModifiedError helper', () => {
    it('detects Telegram message is not modified error from message and description', () => {
      expect(isNotModifiedError(new Error('Bad Request: message is not modified'))).toBe(true);
      expect(isNotModifiedError({ description: 'Bad Request: message is not modified: specified new message content and reply markup are exactly the same' })).toBe(true);
      expect(isNotModifiedError(new Error('Bad Request: chat not found'))).toBe(false);
      expect(isNotModifiedError(null)).toBe(false);
    });
  });

  describe('isParseEntitiesError helper', () => {
    it('detects Telegram entity parse errors', () => {
      expect(isParseEntitiesError(new Error("Bad Request: can't parse entities: Character '_' is reserved"))).toBe(true);
      expect(isParseEntitiesError({ description: 'Bad Request: cant parse entities' })).toBe(true);
      expect(isParseEntitiesError(new Error('Bad Request: message not found'))).toBe(false);
      expect(isParseEntitiesError(null)).toBe(false);
    });
  });

  describe('shouldRenderInPlace helper', () => {
    it('returns false when callback is clicked from a completed operation screen', async () => {
      const tracker: ActiveScreenTracker = {
        trackActiveScreen: vi.fn(),
        getActiveScreen: vi.fn().mockResolvedValue({ messageId: 999, isCompleted: true }),
      };
      configureScreenTracker(tracker);

      const ctx = {
        from: { id: 123 },
        callbackQuery: {
          id: 'cb',
          message: { message_id: 999 },
        },
      } as any;

      const inPlace = await shouldRenderInPlace(ctx, true);
      expect(inPlace).toBe(false);
    });

    it('returns true when callback is clicked from a normal intermediate step', async () => {
      const tracker: ActiveScreenTracker = {
        trackActiveScreen: vi.fn(),
        getActiveScreen: vi.fn().mockResolvedValue({ messageId: 999, isCompleted: false }),
      };
      configureScreenTracker(tracker);

      const ctx = {
        from: { id: 123 },
        callbackQuery: {
          id: 'cb',
          message: { message_id: 999 },
        },
      } as any;

      const inPlace = await shouldRenderInPlace(ctx, true);
      expect(inPlace).toBe(true);
    });

    it('honors tracker shouldRenderInPlace override if defined', async () => {
      const tracker: ActiveScreenTracker = {
        trackActiveScreen: vi.fn(),
        shouldRenderInPlace: vi.fn().mockResolvedValue(false),
      };
      configureScreenTracker(tracker);

      const ctx = {
        from: { id: 123 },
        callbackQuery: { id: 'cb' },
      } as any;

      const inPlace = await shouldRenderInPlace(ctx, true);
      expect(inPlace).toBe(false);
      expect(tracker.shouldRenderInPlace).toHaveBeenCalledWith(ctx, true);
    });
  });

  describe('deleteUserInputMessage', () => {
    it('silently deletes user text message via ctx.api.deleteMessage', async () => {
      const deleteMessage = vi.fn().mockResolvedValue(true);
      const ctx = {
        chat: { id: 100 },
        message: { message_id: 50 },
        api: { deleteMessage },
      } as any;

      const res = await deleteUserInputMessage(ctx);
      expect(res).toBe(true);
      expect(deleteMessage).toHaveBeenCalledWith(100, 50);
    });

    it('falls back to ctx.deleteMessage if ctx.api.deleteMessage is not available', async () => {
      const deleteMessage = vi.fn().mockResolvedValue(true);
      const ctx = {
        chat: { id: 100 },
        message: { message_id: 50 },
        deleteMessage,
      } as any;

      const res = await deleteUserInputMessage(ctx);
      expect(res).toBe(true);
      expect(deleteMessage).toHaveBeenCalled();
    });

    it('does not delete when context is a callback query', async () => {
      const deleteMessage = vi.fn();
      const ctx = {
        chat: { id: 100 },
        callbackQuery: { id: 'cb-1' },
        message: { message_id: 50 },
        api: { deleteMessage },
      } as any;

      const res = await deleteUserInputMessage(ctx);
      expect(res).toBe(false);
      expect(deleteMessage).not.toHaveBeenCalled();
    });
  });

  describe('renderInPlaceWizardStep with Callback Query', () => {
    it('edits message in-place via ctx.editMessageText and syncs with tracker', async () => {
      const tracker: ActiveScreenTracker = {
        trackActiveScreen: vi.fn(),
        getActiveScreen: vi.fn(),
      };
      configureScreenTracker(tracker);

      const kb = new InlineKeyboard().text('Option A', 'opt_a');
      const editMessageText = vi.fn().mockResolvedValue({ message_id: 777 });
      const onMessageIdUpdated = vi.fn();

      const ctx = {
        from: { id: 12345 },
        chat: { id: 8888 },
        callbackQuery: {
          id: 'cb-1',
          message: { message_id: 777, chat: { id: 8888 } },
        },
        editMessageText,
      } as any;

      const result = await renderInPlaceWizardStep(ctx, {
        prompt: '*اختر خياراً*',
        keyboard: kb,
        flowType: 'worker_registration',
        onMessageIdUpdated,
      });

      expect(result).toEqual({
        messageId: 777,
        chatId: 8888,
        editedInPlace: true,
      });
      expect(editMessageText).toHaveBeenCalledWith('*اختر خياراً*', expect.objectContaining({
        parse_mode: 'Markdown',
        reply_markup: kb,
      }));
      expect(tracker.trackActiveScreen).toHaveBeenCalledWith(
        BigInt(12345),
        8888,
        777,
        'worker_registration',
        false
      );
      expect(onMessageIdUpdated).toHaveBeenCalledWith(777);
    });

    it('handles message is not modified error gracefully without throwing or falling back', async () => {
      const tracker: ActiveScreenTracker = {
        trackActiveScreen: vi.fn(),
      };
      configureScreenTracker(tracker);

      const editMessageText = vi.fn().mockRejectedValue(new Error('Bad Request: message is not modified'));
      const ctx = {
        from: { id: 12345 },
        chat: { id: 8888 },
        callbackQuery: {
          id: 'cb-1',
          message: { message_id: 777 },
        },
        editMessageText,
        reply: vi.fn(),
      } as any;

      const result = await renderInPlaceWizardStep(ctx, {
        prompt: 'البيان مطابق تماماً',
        flowType: 'settings',
      });

      expect(result.messageId).toBe(777);
      expect(result.editedInPlace).toBe(true);
      expect(ctx.reply).not.toHaveBeenCalled();
    });
  });

  describe('renderInPlaceWizardStep with Text Input', () => {
    it('silently deletes user input message and edits wizard message via ctx.api.editMessageText', async () => {
      const tracker: ActiveScreenTracker = {
        trackActiveScreen: vi.fn(),
      };

      const deleteMessage = vi.fn().mockResolvedValue(true);
      const apiEditMessageText = vi.fn().mockResolvedValue({ message_id: 555 });

      const ctx = {
        from: { id: 999 },
        chat: { id: 1001 },
        message: { message_id: 77, text: 'أحمد محمود' },
        api: {
          deleteMessage,
          editMessageText: apiEditMessageText,
        },
        reply: vi.fn(),
      } as any;

      const kb = new InlineKeyboard().text('تأكيد', 'confirm');

      const result = await renderInPlaceWizardStep(ctx, {
        prompt: '🏷️ اسم الشهرة المطلوب',
        keyboard: kb,
        activeMessageId: 555,
        flowType: 'worker_registration',
        screenTracker: tracker,
      });

      expect(deleteMessage).toHaveBeenCalledWith(1001, 77);
      expect(apiEditMessageText).toHaveBeenCalledWith(
        1001,
        555,
        '🏷️ اسم الشهرة المطلوب',
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: kb,
        })
      );
      expect(ctx.reply).not.toHaveBeenCalled();
      expect(result).toEqual({
        messageId: 555,
        chatId: 1001,
        editedInPlace: true,
      });
      expect(tracker.trackActiveScreen).toHaveBeenCalledWith(
        BigInt(999),
        1001,
        555,
        'worker_registration',
        false
      );
    });

    it('resolves targetMessageId from screenTracker if activeMessageId is not explicitly provided', async () => {
      const tracker: ActiveScreenTracker = {
        trackActiveScreen: vi.fn(),
        getActiveScreen: vi.fn().mockResolvedValue({ messageId: 888, chatId: 1001 }),
      };

      const apiEditMessageText = vi.fn().mockResolvedValue({ message_id: 888 });
      const ctx = {
        from: { id: 999 },
        chat: { id: 1001 },
        message: { message_id: 78, text: '01012345678' },
        api: {
          deleteMessage: vi.fn().mockResolvedValue(true),
          editMessageText: apiEditMessageText,
        },
      } as any;

      const result = await renderInPlaceWizardStep(ctx, {
        prompt: '💳 اختر وسيلة التحويل',
        screenTracker: tracker,
      });

      expect(tracker.getActiveScreen).toHaveBeenCalledWith(BigInt(999));
      expect(apiEditMessageText).toHaveBeenCalledWith(
        1001,
        888,
        '💳 اختر وسيلة التحويل',
        expect.anything()
      );
      expect(result.messageId).toBe(888);
      expect(result.editedInPlace).toBe(true);
    });
  });

  describe('Fallback Handling', () => {
    it('falls back to ctx.reply when in-place edit fails (e.g. message deleted), and strips old keyboard', async () => {
      const tracker: ActiveScreenTracker = {
        trackActiveScreen: vi.fn(),
      };

      const apiEditMessageText = vi.fn().mockRejectedValue(new Error('Bad Request: message to edit not found'));
      const deleteMessage = vi.fn().mockResolvedValue(true);
      const reply = vi.fn().mockResolvedValue({ message_id: 999 });

      const ctx = {
        from: { id: 444 },
        chat: { id: 500 },
        message: { message_id: 12 },
        api: {
          deleteMessage,
          editMessageText: apiEditMessageText,
        },
        reply,
      } as any;

      const result = await renderInPlaceWizardStep(ctx, {
        prompt: 'رسالة بديلة جديدة',
        activeMessageId: 300,
        screenTracker: tracker,
      });

      expect(reply).toHaveBeenCalledWith('رسالة بديلة جديدة', expect.anything());
      expect(result).toEqual({
        messageId: 999,
        chatId: 500,
        editedInPlace: false,
      });
      expect(deleteMessage).toHaveBeenCalledWith(500, 300);
      expect(tracker.trackActiveScreen).toHaveBeenCalledWith(
        BigInt(444),
        500,
        999,
        'wizard_step',
        false
      );
    });
  });

  describe('renderInPlaceCompletion', () => {
    it('edits message in-place and passes isCompleted: true to active screen tracker', async () => {
      const tracker: ActiveScreenTracker = {
        trackActiveScreen: vi.fn(),
      };

      const apiEditMessageText = vi.fn().mockResolvedValue({ message_id: 600 });
      const ctx = {
        from: { id: 321 },
        chat: { id: 555 },
        api: {
          editMessageText: apiEditMessageText,
        },
      } as any;

      const kb = new InlineKeyboard().text('طباعة', 'print');
      const result = await renderInPlaceCompletion(ctx, {
        prompt: '🎉 تم تسجيل العملية بنجاح',
        keyboard: kb,
        activeMessageId: 600,
        flowType: 'worker_registration',
        screenTracker: tracker,
      });

      expect(result.messageId).toBe(600);
      expect(tracker.trackActiveScreen).toHaveBeenCalledWith(
        BigInt(321),
        555,
        600,
        'worker_registration',
        true
      );
    });
  });

  describe('Completed Screen & Receipt Protection', () => {
    it('does NOT edit or delete completed screen when starting a new flow step, and sends new message', async () => {
      const tracker: ActiveScreenTracker = {
        trackActiveScreen: vi.fn(),
        getActiveScreen: vi.fn().mockResolvedValue({ messageId: 600, chatId: 555, isCompleted: true }),
      };

      const reply = vi.fn().mockResolvedValue({ message_id: 601 });
      const editMessageReplyMarkup = vi.fn().mockResolvedValue(true);
      const deleteMessage = vi.fn();

      const ctx = {
        from: { id: 321 },
        chat: { id: 555 },
        callbackQuery: {
          id: 'cb',
          message: {
            message_id: 600,
            reply_markup: {
              inline_keyboard: [
                [{ text: 'واتساب', url: 'https://wa.me/123' }],
                [{ text: 'تسجيل آخر', callback_data: 'action:worker:add_single' }],
              ],
            },
          },
        },
        api: {
          editMessageReplyMarkup,
          deleteMessage,
        },
        reply,
      } as any;

      const onMessageIdUpdated = vi.fn();
      const res = await renderInPlaceWizardStep(ctx, {
        prompt: 'خطوة جديدة',
        activeMessageId: 600,
        flowType: 'worker_registration',
        screenTracker: tracker,
        onMessageIdUpdated,
      });

      expect(res.messageId).toBe(601);
      expect(res.editedInPlace).toBe(false);
      expect(reply).toHaveBeenCalledWith('خطوة جديدة', expect.anything());
      expect(deleteMessage).not.toHaveBeenCalled();
      expect(editMessageReplyMarkup).toHaveBeenCalledWith(
        555,
        600,
        { reply_markup: { inline_keyboard: [[{ text: 'واتساب', url: 'https://wa.me/123' }]] } }
      );
      expect(onMessageIdUpdated).toHaveBeenCalledWith(601);
      expect(tracker.trackActiveScreen).toHaveBeenCalledWith(
        BigInt(321),
        555,
        601,
        'worker_registration',
        false
      );
    });
  });

  describe('Markdown Entity Parse Error Recovery', () => {
    it('retries editMessageText without parse_mode when Markdown entity parsing fails', async () => {
      const parseError = new Error("Bad Request: can't parse entities: Character '_' is reserved");
      const editMessageText = vi.fn()
        .mockRejectedValueOnce(parseError)
        .mockResolvedValueOnce({ message_id: 777 });

      const ctx = {
        from: { id: 123 },
        chat: { id: 456 },
        callbackQuery: {
          id: 'cb',
          message: { message_id: 777 },
        },
        editMessageText,
      } as any;

      const res = await renderInPlaceWizardStep(ctx, {
        prompt: 'Unescaped _ text',
      });

      expect(res.messageId).toBe(777);
      expect(res.editedInPlace).toBe(true);
      expect(editMessageText).toHaveBeenCalledTimes(2);
      expect(editMessageText.mock.calls[0]![1]).toHaveProperty('parse_mode', 'Markdown');
      expect(editMessageText.mock.calls[1]![1]).not.toHaveProperty('parse_mode');
    });

    it('retries fallback reply without parse_mode when reply fails with entity parse error', async () => {
      const parseError = new Error("Bad Request: can't parse entities: Character '_' is reserved");
      const reply = vi.fn()
        .mockRejectedValueOnce(parseError)
        .mockResolvedValueOnce({ message_id: 888 });

      const ctx = {
        from: { id: 123 },
        chat: { id: 456 },
        reply,
      } as any;

      const res = await renderInPlaceWizardStep(ctx, {
        prompt: 'Unescaped _ fallback',
      });

      expect(res.messageId).toBe(888);
      expect(reply).toHaveBeenCalledTimes(2);
      expect(reply.mock.calls[0]![1]).toHaveProperty('parse_mode', 'Markdown');
      expect(reply.mock.calls[1]![1]).not.toHaveProperty('parse_mode');
    });
  });

  describe('InPlaceFlowManager Class Wrapper', () => {
    it('provides static methods that behave consistently with functional exports', async () => {
      const tracker: ActiveScreenTracker = {
        trackActiveScreen: vi.fn(),
      };
      InPlaceFlowManager.configureTracker(tracker);
      expect(InPlaceFlowManager.getTracker()).toBe(tracker);

      const ctx = {
        from: { id: 111 },
        chat: { id: 222 },
        callbackQuery: {
          id: 'cb',
          message: { message_id: 333 },
        },
        editMessageText: vi.fn().mockResolvedValue({ message_id: 333 }),
      } as any;

      const res = await InPlaceFlowManager.renderStep(ctx, {
        prompt: 'مرحباً',
      });
      expect(res.messageId).toBe(333);

      const compRes = await InPlaceFlowManager.renderCompletion(ctx, {
        prompt: 'اكتملت',
        activeMessageId: 333,
      });
      expect(compRes.messageId).toBe(333);
      expect(tracker.trackActiveScreen).toHaveBeenLastCalledWith(
        BigInt(111),
        222,
        333,
        'wizard_step',
        true
      );

      const shouldInPlace = await InPlaceFlowManager.shouldRenderInPlace(ctx, true);
      expect(shouldInPlace).toBe(true);

      InPlaceFlowManager.clearTracker();
      expect(InPlaceFlowManager.getTracker()).toBeUndefined();
    });

    it('always suppresses link previews with link_preview_options and disable_web_page_preview', async () => {
      const editMessageText = vi.fn().mockResolvedValue({ message_id: 333 });
      const ctx = {
        from: { id: 111 },
        chat: { id: 222 },
        callbackQuery: {
          id: 'cb',
          message: { message_id: 333 },
        },
        editMessageText,
      } as any;

      await InPlaceFlowManager.renderStep(ctx, {
        prompt: 'https://maps.google.com/?q=30.0444,31.2357',
      });

      expect(editMessageText).toHaveBeenCalledWith(
        'https://maps.google.com/?q=30.0444,31.2357',
        expect.objectContaining({
          link_preview_options: { is_disabled: true },
          disable_web_page_preview: true,
        })
      );

      await InPlaceFlowManager.renderCompletion(ctx, {
        prompt: 'https://maps.google.com/?q=30.0444,31.2357',
        activeMessageId: 333,
      });

      expect(editMessageText).toHaveBeenLastCalledWith(
        'https://maps.google.com/?q=30.0444,31.2357',
        expect.objectContaining({
          link_preview_options: { is_disabled: true },
          disable_web_page_preview: true,
        })
      );
    });
  });
});
