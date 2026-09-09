import { describe, it, expect, vi } from 'vitest';
import { ScreenFlowService } from '../src/services/screen-flow.service.js';
import { MyContext } from '../src/types/context.js';

vi.mock('../src/redis.js', () => ({
  getUserActiveScreen: vi.fn(),
  setUserActiveScreen: vi.fn(),
  clearUserActiveScreen: vi.fn(),
  clearAllPendingUserActions: vi.fn(),
  getPendingWorkerWizard: vi.fn(),
  setPendingWorkerWizard: vi.fn(),
  clearPendingWorkerWizard: vi.fn(),
  clearPendingWorkerExcelUpload: vi.fn(),
  setPendingWorkerDirSearch: vi.fn(),
  getPendingWorkerDirSearch: vi.fn(),
  clearPendingWorkerDirSearch: vi.fn(),
  getPersistentKeyboardMsg: vi.fn(),
  setPersistentKeyboardMsg: vi.fn(),
  clearPersistentKeyboardMsg: vi.fn(),
}));

import * as redisModule from '../src/redis.js';

describe('Universal Ephemeral Flow Cleanup & Receipt Preservation (ScreenFlowService)', () => {
  it('should DELETE intermediate unfinished flow messages cleanly from Telegram chat', async () => {
    const service = new ScreenFlowService();
    const deleteMessageSpy = vi.fn().mockResolvedValue(true);
    const mockCtx = {
      from: { id: 123456 },
      api: {
        deleteMessage: deleteMessageSpy,
        editMessageReplyMarkup: vi.fn(),
      },
    } as unknown as MyContext;

    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValueOnce({
      chatId: 1001,
      messageId: 555,
      flowType: 'worker_wizard',
      isCompleted: false,
      updatedAt: Date.now(),
    });

    await service.cleanupUnfinishedFlow(mockCtx);

    expect(deleteMessageSpy).toHaveBeenCalledWith(1001, 555);
    expect(redisModule.clearUserActiveScreen).toHaveBeenCalledWith(123456n);
  });

  it('should PRESERVE finished operation receipts, stripping only their interactive reply markup', async () => {
    const service = new ScreenFlowService();
    const deleteMessageSpy = vi.fn();
    const editMarkupSpy = vi.fn().mockResolvedValue(true);
    const mockCtx = {
      from: { id: 123456 },
      api: {
        deleteMessage: deleteMessageSpy,
        editMessageReplyMarkup: editMarkupSpy,
      },
    } as unknown as MyContext;

    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValueOnce({
      chatId: 1001,
      messageId: 777,
      flowType: 'worker_created',
      isCompleted: true, // سند منتهي
      updatedAt: Date.now(),
    });

    await service.cleanupUnfinishedFlow(mockCtx);

    // الرسالة تبقى في الشات ولا يتم حذفها
    expect(deleteMessageSpy).not.toHaveBeenCalled();
    // تُجرد أزرارها لمنع إعادة النقر
    expect(editMarkupSpy).toHaveBeenCalledWith(1001, 777, { reply_markup: undefined });
    expect(redisModule.clearUserActiveScreen).toHaveBeenCalledWith(123456n);
  });

  it('should prevent in-place editing when action is clicked from a completed operation receipt', async () => {
    const service = new ScreenFlowService();
    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValue({
      chatId: 1001,
      messageId: 888,
      flowType: 'worker_created',
      isCompleted: true,
      updatedAt: Date.now(),
    });

    const mockCtx = {
      from: { id: 123456 },
      callbackQuery: {
        message: { message_id: 888 }, // نقرة من كارت العملية المكتملة
      },
    } as unknown as MyContext;

    const isCompletedClick = await service.isClickOnCompletedScreen(mockCtx);
    expect(isCompletedClick).toBe(true);

    // يجب حظر التعديل الموضعي فوراً لتبقى الرسالة في الشات دائماً
    const inPlace = await service.shouldRenderInPlace(mockCtx, true);
    expect(inPlace).toBe(false);
  });

  it('should allow in-place editing when action is clicked from regular intermediate menu', async () => {
    const service = new ScreenFlowService();
    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValueOnce({
      chatId: 1001,
      messageId: 555,
      flowType: 'hr_hub',
      isCompleted: false,
      updatedAt: Date.now(),
    });

    const mockCtx = {
      from: { id: 123456 },
      callbackQuery: {
        message: { message_id: 555 },
      },
    } as unknown as MyContext;

    const inPlace = await service.shouldRenderInPlace(mockCtx, true);
    expect(inPlace).toBe(true);
  });

  it('should detect stale callbacks from old messages and trigger alert with keyboard removal', async () => {
    const service = new ScreenFlowService();
    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValueOnce({
      chatId: 1001,
      messageId: 999,
      flowType: 'hr_hub',
      updatedAt: Date.now(),
    });

    const mockCtx = {
      from: { id: 123456 },
      callbackQuery: {
        message: { message_id: 111 }, // رسالة قديمة مختلفة عن 999
      },
      editMessageReplyMarkup: vi.fn().mockResolvedValue(true),
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
    } as unknown as MyContext;

    const check = await service.isStaleCallback(mockCtx);
    expect(check.isStale).toBe(true);
    expect(check.reason).toBe('message_mismatch');

    await service.handleStaleCallback(mockCtx);
    expect(mockCtx.editMessageReplyMarkup).toHaveBeenCalledWith({ reply_markup: undefined });
    expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('هذه الرسالة منتهية الصلاحية'),
        show_alert: true,
      })
    );
  });

  it('should delete main menu message and set ctx.fromMainMenu when cleanupMainMenuIfActive is invoked', async () => {
    const service = new ScreenFlowService();
    const deleteMessageSpy = vi.fn().mockResolvedValue(true);
    const mockCtx = {
      from: { id: 123456 },
      callbackQuery: {
        message: { message_id: 333 },
      },
      api: {
        deleteMessage: deleteMessageSpy,
      },
    } as unknown as MyContext;

    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValueOnce({
      chatId: 1001,
      messageId: 333,
      flowType: 'main_menu',
      isCompleted: false,
      updatedAt: Date.now(),
    });

    const cleaned = await service.cleanupMainMenuIfActive(mockCtx);
    expect(cleaned).toBe(true);
    expect(deleteMessageSpy).toHaveBeenCalledWith(1001, 333);
    expect(redisModule.clearUserActiveScreen).toHaveBeenCalledWith(123456n);
    expect((mockCtx as any).fromMainMenu).toBe(true);
  });

  it('should prevent in-place rendering when clicked from main menu screen', async () => {
    const service = new ScreenFlowService();
    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValue({
      chatId: 1001,
      messageId: 333,
      flowType: 'main_menu',
      isCompleted: false,
      updatedAt: Date.now(),
    });

    const mockCtx = {
      from: { id: 123456 },
      callbackQuery: {
        message: { message_id: 333 },
      },
    } as unknown as MyContext;

    const inPlace = await service.shouldRenderInPlace(mockCtx, true);
    expect(inPlace).toBe(false);
  });

  it('should prevent in-place rendering when ctx.fromMainMenu flag is set even if active screen is already cleared', async () => {
    const service = new ScreenFlowService();
    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValueOnce(null);

    const mockCtx = {
      from: { id: 123456 },
      callbackQuery: {
        message: { message_id: 333 },
      },
      fromMainMenu: true,
    } as unknown as MyContext;

    const inPlace = await service.shouldRenderInPlace(mockCtx, true);
    expect(inPlace).toBe(false);
  });

  it('should ensure persistent reply keyboard anchor is sent and recorded in redis', async () => {
    const service = new ScreenFlowService();
    const sendMessageSpy = vi.fn().mockResolvedValue({ message_id: 444 });
    const mockCtx = {
      from: { id: 123456 },
      chat: { id: 1001 },
      effectiveRole: 'SUPER_ADMIN',
      api: {
        sendMessage: sendMessageSpy,
        deleteMessage: vi.fn(),
      },
    } as unknown as MyContext;

    vi.mocked(redisModule.getPersistentKeyboardMsg).mockResolvedValueOnce(null);

    await service.ensurePersistentKeyboard(mockCtx);

    expect(sendMessageSpy).toHaveBeenCalledWith(
      1001,
      expect.stringContaining('شركة السعادة للمقاولات العامة والتعدين'),
      expect.objectContaining({
        parse_mode: 'Markdown',
        reply_markup: expect.anything(),
      })
    );
    expect(redisModule.setPersistentKeyboardMsg).toHaveBeenCalledWith(123456n, 1001, 444);
  });

  it('should preserve existing persistent keyboard anchor without deleting it by default', async () => {
    const service = new ScreenFlowService();
    const deleteMessageSpy = vi.fn().mockResolvedValue(true);
    const sendMessageSpy = vi.fn().mockResolvedValue({ message_id: 445 });
    const mockCtx = {
      from: { id: 123456 },
      chat: { id: 1001 },
      effectiveRole: 'FIELD_ADMIN',
      api: {
        deleteMessage: deleteMessageSpy,
        sendMessage: sendMessageSpy,
      },
    } as unknown as MyContext;

    vi.mocked(redisModule.getPersistentKeyboardMsg).mockResolvedValueOnce({
      chatId: 1001,
      messageId: 222,
    });

    await service.ensurePersistentKeyboard(mockCtx);

    expect(deleteMessageSpy).not.toHaveBeenCalled();
    expect(sendMessageSpy).not.toHaveBeenCalled();
  });

  it('should clean up old persistent keyboard anchor message when forceRefresh is true', async () => {
    const service = new ScreenFlowService();
    const deleteMessageSpy = vi.fn().mockResolvedValue(true);
    const sendMessageSpy = vi.fn().mockResolvedValue({ message_id: 445 });
    const mockCtx = {
      from: { id: 123456 },
      chat: { id: 1001 },
      effectiveRole: 'FIELD_ADMIN',
      api: {
        deleteMessage: deleteMessageSpy,
        sendMessage: sendMessageSpy,
      },
    } as unknown as MyContext;

    vi.mocked(redisModule.getPersistentKeyboardMsg).mockResolvedValueOnce({
      chatId: 1001,
      messageId: 222,
    });

    await service.ensurePersistentKeyboard(mockCtx, undefined, true);

    expect(deleteMessageSpy).toHaveBeenCalledWith(1001, 222);
    expect(sendMessageSpy).toHaveBeenCalledWith(1001, expect.any(String), expect.anything());
    expect(redisModule.setPersistentKeyboardMsg).toHaveBeenCalledWith(123456n, 1001, 445);
  });
});
