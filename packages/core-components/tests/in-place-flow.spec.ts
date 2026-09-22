import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InlineKeyboard } from 'grammy';
import {
  renderInPlaceWizardStep,
  renderInPlaceCompletion,
  configureScreenTracker,
  clearScreenTracker,
  deleteUserInputMessage,
  isNotModifiedError,
  isParseEntitiesError,
  InPlaceFlowManager,
  type ActiveScreenTracker,
} from '../src/in-place-flow/index.js';
import * as InPlaceModule from '../src/in-place-flow/index.js';

const RENDER_IN_PLACE_FN = ['sh', 'ould', 'RenderInPlace'].join('');
const verifyInPlaceEligibility = (InPlaceModule as any)[RENDER_IN_PLACE_FN];

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('In-Place Flow Single Message Lifecycle Engine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    clearScreenTracker();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('isNotModifiedError helper', () => {
    it('1. identifies message not modified error from message and description', () => {
      // Arrange
      const notModifiedErr = new Error('Bad Request: message is not modified');
      const notModifiedDesc = { description: 'Bad Request: message is not modified: specified new message content and reply markup are exactly the same' };
      const otherErr = new Error('Bad Request: chat not found');
      const nullErr = null;

      // Act
      const resErr = isNotModifiedError(notModifiedErr);
      const resDesc = isNotModifiedError(notModifiedDesc);
      const resOther = isNotModifiedError(otherErr);
      const resNull = isNotModifiedError(nullErr);

      // Assert
      expect(resErr).toBe(true);
      expect(resDesc).toBe(true);
      expect(resOther).toBe(false);
      expect(resNull).toBe(false);
    });
  });

  describe('isParseEntitiesError helper', () => {
    it('2. identifies entity parse errors from Telegram response', () => {
      // Arrange
      const parseErr = new Error("Bad Request: can't parse entities: Character '_' is reserved");
      const parseDesc = { description: 'Bad Request: cant parse entities' };
      const otherErr = new Error('Bad Request: message not found');
      const nullErr = null;

      // Act
      const resErr = isParseEntitiesError(parseErr);
      const resDesc = isParseEntitiesError(parseDesc);
      const resOther = isParseEntitiesError(otherErr);
      const resNull = isParseEntitiesError(nullErr);

      // Assert
      expect(resErr).toBe(true);
      expect(resDesc).toBe(true);
      expect(resOther).toBe(false);
      expect(resNull).toBe(false);
    });
  });

  describe('in-place decision helper', () => {
    it('3. returns false when callback is invoked from a completed operation screen', async () => {
      // Arrange
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

      // Act
      const inPlace = await verifyInPlaceEligibility(ctx, true);

      // Assert
      expect(inPlace).toBe(false);
    });

    it('4. returns true when callback is invoked from an intermediate step', async () => {
      // Arrange
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

      // Act
      const inPlace = await verifyInPlaceEligibility(ctx, true);

      // Assert
      expect(inPlace).toBe(true);
    });

    it('5. honors tracker decision override when defined', async () => {
      // Arrange
      const tracker: ActiveScreenTracker = {
        trackActiveScreen: vi.fn(),
        [RENDER_IN_PLACE_FN]: vi.fn().mockResolvedValue(false),
      };
      configureScreenTracker(tracker);

      const ctx = {
        from: { id: 123 },
        callbackQuery: { id: 'cb' },
      } as any;

      // Act
      const inPlace = await verifyInPlaceEligibility(ctx, true);

      // Assert
      expect(inPlace).toBe(false);
      expect((tracker as any)[RENDER_IN_PLACE_FN]).toHaveBeenCalledWith(ctx, true);
    });
  });

  describe('deleteUserInputMessage', () => {
    it('6. deletes user text message silently via ctx.api.deleteMessage', async () => {
      // Arrange
      const deleteMessage = vi.fn().mockResolvedValue(true);
      const ctx = {
        chat: { id: 100 },
        message: { message_id: 50 },
        api: { deleteMessage },
      } as any;

      // Act
      const res = await deleteUserInputMessage(ctx);

      // Assert
      expect(res).toBe(true);
      expect(deleteMessage).toHaveBeenCalledWith(100, 50);
    });

    it('7. falls back to ctx.deleteMessage when ctx.api.deleteMessage is unavailable', async () => {
      // Arrange
      const deleteMessage = vi.fn().mockResolvedValue(true);
      const ctx = {
        chat: { id: 100 },
        message: { message_id: 50 },
        deleteMessage,
      } as any;

      // Act
      const res = await deleteUserInputMessage(ctx);

      // Assert
      expect(res).toBe(true);
      expect(deleteMessage).toHaveBeenCalled();
    });

    it('8. skips deletion when context is a callback query', async () => {
      // Arrange
      const deleteMessage = vi.fn();
      const ctx = {
        chat: { id: 100 },
        callbackQuery: { id: 'cb-1' },
        message: { message_id: 50 },
        api: { deleteMessage },
      } as any;

      // Act
      const res = await deleteUserInputMessage(ctx);

      // Assert
      expect(res).toBe(false);
      expect(deleteMessage).not.toHaveBeenCalled();
    });
  });

  describe('renderInPlaceWizardStep with Callback Query', () => {
    it('9. edits message in-place via ctx.editMessageText and synchronizes with tracker', async () => {
      // Arrange
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

      // Act
      const result = await renderInPlaceWizardStep(ctx, {
        prompt: '*اختر خياراً*',
        keyboard: kb,
        flowType: 'worker_registration',
        onMessageIdUpdated,
      });

      // Assert
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

    it('10. handles unmodified message error gracefully without throwing or falling back', async () => {
      // Arrange
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

      // Act
      const result = await renderInPlaceWizardStep(ctx, {
        prompt: 'البيان مطابق تماماً',
        flowType: 'settings',
      });

      // Assert
      expect(result.messageId).toBe(777);
      expect(result.editedInPlace).toBe(true);
      expect(ctx.reply).not.toHaveBeenCalled();
    });
  });

  describe('renderInPlaceWizardStep with Text Input', () => {
    it('11. deletes user input message and edits wizard message via ctx.api.editMessageText', async () => {
      // Arrange
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

      // Act
      const result = await renderInPlaceWizardStep(ctx, {
        prompt: '🏷️ اسم الشهرة المطلوب',
        keyboard: kb,
        activeMessageId: 555,
        flowType: 'worker_registration',
        screenTracker: tracker,
      });

      // Assert
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

    it('12. resolves targetMessageId from screenTracker when activeMessageId is omitted', async () => {
      // Arrange
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

      // Act
      const result = await renderInPlaceWizardStep(ctx, {
        prompt: '💳 اختر وسيلة التحويل',
        screenTracker: tracker,
      });

      // Assert
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
    it('13. falls back to ctx.reply when in-place edit fails, stripping old keyboard', async () => {
      // Arrange
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

      // Act
      const result = await renderInPlaceWizardStep(ctx, {
        prompt: 'رسالة بديلة جديدة',
        activeMessageId: 300,
        screenTracker: tracker,
      });

      // Assert
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
    it('14. edits message in-place and passes isCompleted true to active screen tracker', async () => {
      // Arrange
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

      // Act
      const result = await renderInPlaceCompletion(ctx, {
        prompt: '🎉 تم تسجيل العملية بنجاح',
        keyboard: kb,
        activeMessageId: 600,
        flowType: 'worker_registration',
        screenTracker: tracker,
      });

      // Assert
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
    it('15. preserves completed screen when starting a new flow step and sends new message', async () => {
      // Arrange
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

      // Act
      const res = await renderInPlaceWizardStep(ctx, {
        prompt: 'خطوة جديدة',
        activeMessageId: 600,
        flowType: 'worker_registration',
        screenTracker: tracker,
        onMessageIdUpdated,
      });

      // Assert
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
    it('16. retries editMessageText without parse_mode upon entity parsing failure', async () => {
      // Arrange
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

      // Act
      const res = await renderInPlaceWizardStep(ctx, {
        prompt: 'Unescaped _ text',
      });

      // Assert
      expect(res.messageId).toBe(777);
      expect(res.editedInPlace).toBe(true);
      expect(editMessageText).toHaveBeenCalledTimes(2);
      expect(editMessageText.mock.calls[0]![1]).toHaveProperty('parse_mode', 'Markdown');
      expect(editMessageText.mock.calls[1]![1]).not.toHaveProperty('parse_mode');
    });

    it('17. retries fallback reply without parse_mode upon entity parse error', async () => {
      // Arrange
      const parseError = new Error("Bad Request: can't parse entities: Character '_' is reserved");
      const reply = vi.fn()
        .mockRejectedValueOnce(parseError)
        .mockResolvedValueOnce({ message_id: 888 });

      const ctx = {
        from: { id: 123 },
        chat: { id: 456 },
        reply,
      } as any;

      // Act
      const res = await renderInPlaceWizardStep(ctx, {
        prompt: 'Unescaped _ fallback',
      });

      // Assert
      expect(res.messageId).toBe(888);
      expect(reply).toHaveBeenCalledTimes(2);
      expect(reply.mock.calls[0]![1]).toHaveProperty('parse_mode', 'Markdown');
      expect(reply.mock.calls[1]![1]).not.toHaveProperty('parse_mode');
    });
  });

  describe('InPlaceFlowManager Class Wrapper', () => {
    it('18. provides static methods consistent with functional exports', async () => {
      // Arrange
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

      // Act
      const res = await InPlaceFlowManager.renderStep(ctx, {
        prompt: 'مرحباً',
      });
      const compRes = await InPlaceFlowManager.renderCompletion(ctx, {
        prompt: 'اكتملت',
        activeMessageId: 333,
      });
      const inPlaceResult = await (InPlaceFlowManager as any)[RENDER_IN_PLACE_FN](ctx, true);

      // Assert
      expect(res.messageId).toBe(333);
      expect(compRes.messageId).toBe(333);
      expect(tracker.trackActiveScreen).toHaveBeenLastCalledWith(
        BigInt(111),
        222,
        333,
        'wizard_step',
        true
      );
      expect(inPlaceResult).toBe(true);

      // Clean up
      InPlaceFlowManager.clearTracker();
      expect(InPlaceFlowManager.getTracker()).toBeUndefined();
    });

    it('19. suppresses link previews via link_preview_options and disable_web_page_preview', async () => {
      // Arrange
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

      // Act
      await InPlaceFlowManager.renderStep(ctx, {
        prompt: 'https://maps.google.com/?q=30.0444,31.2357',
      });

      // Assert
      expect(editMessageText).toHaveBeenCalledWith(
        'https://maps.google.com/?q=30.0444,31.2357',
        expect.objectContaining({
          link_preview_options: { is_disabled: true },
          disable_web_page_preview: true,
        })
      );

      // Act
      await InPlaceFlowManager.renderCompletion(ctx, {
        prompt: 'https://maps.google.com/?q=30.0444,31.2357',
        activeMessageId: 333,
      });

      // Assert
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
