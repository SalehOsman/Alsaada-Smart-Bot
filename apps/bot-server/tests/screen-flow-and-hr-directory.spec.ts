import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScreenFlowService } from '../src/services/screen-flow.service.js';
import type { MyContext } from '../src/types/context.js';

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

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Universal Ephemeral Flow Cleanup & Receipt Preservation (ScreenFlowService)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deletes intermediate unfinished flow messages cleanly from Telegram chat', async () => {
    // Arrange
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
      updatedAt: PINNED_BASE_TIME.getTime(),
    });

    // Act
    await service.cleanupUnfinishedFlow(mockCtx);

    // Assert
    expect(deleteMessageSpy).toHaveBeenCalledWith(1001, 555);
    expect(deleteMessageSpy).toHaveBeenCalledTimes(1);
    expect(redisModule.clearUserActiveScreen).toHaveBeenCalledWith(123456n);
    expect(mockCtx.api.editMessageReplyMarkup).not.toHaveBeenCalled();
  });

  it('preserves finished operation receipts, stripping only their interactive reply markup', async () => {
    // Arrange
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
      isCompleted: true, // finished receipt
      updatedAt: PINNED_BASE_TIME.getTime(),
    });

    // Act
    await service.cleanupUnfinishedFlow(mockCtx);

    // Assert
    expect(deleteMessageSpy).not.toHaveBeenCalled();
    expect(editMarkupSpy).toHaveBeenCalledWith(1001, 777, { reply_markup: { inline_keyboard: [] } });
    expect(redisModule.clearUserActiveScreen).toHaveBeenCalledWith(123456n);
  });

  it('prevents in-place editing when action is clicked from a completed operation receipt', async () => {
    // Arrange
    const service = new ScreenFlowService();
    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValue({
      chatId: 1001,
      messageId: 888,
      flowType: 'worker_created',
      isCompleted: true,
      updatedAt: PINNED_BASE_TIME.getTime(),
    });

    const mockCtx = {
      from: { id: 123456 },
      callbackQuery: {
        message: { message_id: 888 }, // click from completed receipt
      },
    } as unknown as MyContext;

    // Act
    const isCompletedClick = await service.isClickOnCompletedScreen(mockCtx);
    const inPlace = await service.shouldRenderInPlace(mockCtx, true);

    // Assert
    expect(isCompletedClick).toBe(true);
    expect(inPlace).toBe(false);
    expect(inPlace).not.toBe(true);
  });

  it('allows in-place editing when action is clicked from regular intermediate menu', async () => {
    // Arrange
    const service = new ScreenFlowService();
    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValueOnce({
      chatId: 1001,
      messageId: 555,
      flowType: 'hr_hub',
      isCompleted: false,
      updatedAt: PINNED_BASE_TIME.getTime(),
    });

    const mockCtx = {
      from: { id: 123456 },
      callbackQuery: {
        message: { message_id: 555 },
      },
    } as unknown as MyContext;

    // Act
    const inPlace = await service.shouldRenderInPlace(mockCtx, true);

    // Assert
    expect(inPlace).toBe(true);
    expect(inPlace).not.toBe(false);
  });

  it('detects stale callbacks from old messages and triggers alert with keyboard removal', async () => {
    // Arrange
    const service = new ScreenFlowService();
    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValueOnce({
      chatId: 1001,
      messageId: 999,
      flowType: 'hr_hub',
      updatedAt: PINNED_BASE_TIME.getTime(),
    });

    const mockCtx = {
      from: { id: 123456 },
      callbackQuery: {
        message: { message_id: 111 }, // old message distinct from 999
      },
      editMessageReplyMarkup: vi.fn().mockResolvedValue(true),
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
    } as unknown as MyContext;

    // Act
    const check = await service.isStaleCallback(mockCtx);
    await service.handleStaleCallback(mockCtx);

    // Assert
    expect(check.isStale).toBe(true);
    expect(check.reason).toBe('message_mismatch');
    expect(mockCtx.editMessageReplyMarkup).toHaveBeenCalledWith({ reply_markup: { inline_keyboard: [] } });
    expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('هذه الرسالة منتهية الصلاحية'),
        show_alert: true,
      })
    );
  });

  it('strictly invalidates navigation buttons on older messages without immunity', async () => {
    // Arrange
    const service = new ScreenFlowService();
    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValueOnce({
      chatId: 1001,
      messageId: 999,
      flowType: 'hr_hub',
      isCompleted: false,
      updatedAt: PINNED_BASE_TIME.getTime(),
    });
    const mockCtx = {
      from: { id: 123456 },
      callbackQuery: {
        message: { message_id: 111 }, // clicked on older message 111 while active is 999
        data: 'menu:domain:hr',
      },
    } as unknown as MyContext;

    // Act
    const check = await service.isStaleCallback(mockCtx);

    // Assert
    expect(check.isStale).toBe(true);
    expect(check.reason).toBe('message_mismatch');
  });

  it('grants sovereign navigation immunity to action:settings:sites_hub and action:settings_sub:corporate', async () => {
    // Arrange
    const service = new ScreenFlowService();
    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValue({
      chatId: 1001,
      messageId: 999,
      flowType: 'site_detail',
      isCompleted: false,
      updatedAt: PINNED_BASE_TIME.getTime(),
    });

    const ctxSitesHub = {
      from: { id: 123456 },
      callbackQuery: {
        message: { message_id: 111 }, // clicked on older message 111 while active is 999
        data: 'action:settings:sites_hub',
      },
    } as unknown as MyContext;

    const ctxCorporate = {
      from: { id: 123456 },
      callbackQuery: {
        message: { message_id: 111 },
        data: 'action:settings_sub:corporate',
      },
    } as unknown as MyContext;

    // Act
    const checkSites = await service.isStaleCallback(ctxSitesHub);
    const checkCorporate = await service.isStaleCallback(ctxCorporate);

    // Assert
    expect(checkSites.isStale).toBe(false);
    expect(checkCorporate.isStale).toBe(false);
    expect(checkSites.isStale).not.toBe(true);
  });

  it('grants navigation immunity to all matrix patterns and auto-heals active screen', async () => {
    // Arrange
    const service = new ScreenFlowService();
    const deleteMessageSpy = vi.fn().mockResolvedValue(true);

    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValue({
      chatId: 1001,
      messageId: 999,
      flowType: 'unfinished_flow',
      isCompleted: false,
      updatedAt: PINNED_BASE_TIME.getTime(),
    });

    const immuneCallbacks = [
      'action:main_menu',
      'action:exit_impersonate',
      'action:settings:sites_hub',
      'action:settings_sub:system',
      'action:workforce:hub',
      'action:canteen:hub',
      'action:advances:menu_home',
      'action:site:view:STE-01',
      'action:dept:view:ENG',
      'action:job:view:ENG:FOREMAN',
      'action:site:add_gov_page:2',
      'action:site:edit_gov_page:STE-01:1',
      'action:worker:page:3',
      'action:site:add:back_to_name',
      'action:site:add:back_to_gov',
      'back',
      'action:dept:cancel_upload',
      'cancel',
      'wizard:worker:back',
      'wizard:worker:cancel',
      'wizard:worker:retry:phone',
      'wizard:worker:job_page:2',
      'wizard:worker:site_page:3',
      'action:worker:add_single',
      'action:worker:directory',
      'menu:hr_sub:onboarding',
      'menu:hr:dashboard',
      'action:site:gov:noop',
      'noop',
    ];

    // Act & Assert
    for (const callbackData of immuneCallbacks) {
      vi.mocked(redisModule.setUserActiveScreen).mockClear();
      deleteMessageSpy.mockClear();

      const ctx = {
        from: { id: 123456 },
        api: { deleteMessage: deleteMessageSpy },
        callbackQuery: {
          message: { message_id: 222, chat: { id: 1001 } },
          data: callbackData,
        },
      } as unknown as MyContext;

      const result = await service.isStaleCallback(ctx);
      expect(result.isStale).toBe(false);

      // Verify auto-cleanup of abandoned incomplete flow 999
      expect(deleteMessageSpy).toHaveBeenCalledWith(1001, 999);

      // Verify auto-healing updated Redis to message 222
      expect(redisModule.setUserActiveScreen).toHaveBeenCalledWith(
        123456n,
        expect.objectContaining({
          chatId: 1001,
          messageId: 222,
          isCompleted: false,
        })
      );
    }
  });

  it('deletes main menu message and sets ctx.fromMainMenu when cleanupMainMenuIfActive is invoked', async () => {
    // Arrange
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
      updatedAt: PINNED_BASE_TIME.getTime(),
    });

    // Act
    const cleaned = await service.cleanupMainMenuIfActive(mockCtx);

    // Assert
    expect(cleaned).toBe(true);
    expect(deleteMessageSpy).toHaveBeenCalledWith(1001, 333);
    expect(redisModule.clearUserActiveScreen).toHaveBeenCalledWith(123456n);
    expect((mockCtx as { fromMainMenu?: boolean }).fromMainMenu).toBe(true);
  });

  it('allows in-place rendering when clicked and not from a completed screen', async () => {
    // Arrange
    const service = new ScreenFlowService();
    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValue({
      chatId: 1001,
      messageId: 333,
      flowType: 'main_menu',
      isCompleted: false,
      updatedAt: PINNED_BASE_TIME.getTime(),
    });

    const mockCtx = {
      from: { id: 123456 },
      callbackQuery: {
        message: { message_id: 333 },
      },
    } as unknown as MyContext;

    // Act
    const inPlace = await service.shouldRenderInPlace(mockCtx, true);

    // Assert
    expect(inPlace).toBe(true);
    expect(inPlace).not.toBe(false);
  });

  it('allows in-place rendering when requested even if active screen is cleared', async () => {
    // Arrange
    const service = new ScreenFlowService();
    vi.mocked(redisModule.getUserActiveScreen).mockResolvedValueOnce(null);

    const mockCtx = {
      from: { id: 123456 },
      callbackQuery: {
        message: { message_id: 333 },
      },
      fromMainMenu: true,
    } as unknown as MyContext;

    // Act
    const inPlace = await service.shouldRenderInPlace(mockCtx, true);

    // Assert
    expect(inPlace).toBe(true);
    expect(inPlace).not.toBe(false);
  });

  it('ensures persistent reply keyboard anchor is sent and recorded in redis', async () => {
    // Arrange
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

    // Act
    await service.ensurePersistentKeyboard(mockCtx);

    // Assert
    expect(sendMessageSpy).toHaveBeenCalledWith(
      1001,
      expect.stringContaining('لوحة أزرار التنقل والتحكم الميداني مفعلة ومتاحة بالأسفل دائماً'),
      expect.objectContaining({
        parse_mode: 'Markdown',
        reply_markup: expect.anything(),
      })
    );
    expect(redisModule.setPersistentKeyboardMsg).toHaveBeenCalledWith(123456n, 1001, 444);
    expect(mockCtx.api.deleteMessage).not.toHaveBeenCalled();
  });

  it('preserves existing persistent keyboard anchor without deleting it by default', async () => {
    // Arrange
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

    // Act
    await service.ensurePersistentKeyboard(mockCtx);

    // Assert
    expect(deleteMessageSpy).not.toHaveBeenCalled();
    expect(sendMessageSpy).not.toHaveBeenCalled();
  });

  it('cleans up old persistent keyboard anchor message when forceRefresh is true', async () => {
    // Arrange
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

    // Act
    await service.ensurePersistentKeyboard(mockCtx, undefined, true);

    // Assert
    expect(deleteMessageSpy).toHaveBeenCalledWith(1001, 222);
    expect(sendMessageSpy).toHaveBeenCalledWith(1001, expect.any(String), expect.anything());
    expect(redisModule.setPersistentKeyboardMsg).toHaveBeenCalledWith(123456n, 1001, 445);
  });

  it('gracefully proceeds and registers new keyboard even if deleting old anchor message rejects', async () => {
    // Arrange
    const service = new ScreenFlowService();
    const deleteMessageSpy = vi.fn().mockRejectedValue(new Error('Message to delete not found'));
    const sendMessageSpy = vi.fn().mockResolvedValue({ message_id: 446 });
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
      messageId: 333,
    });

    // Act
    await service.ensurePersistentKeyboard(mockCtx, undefined, true);

    // Assert
    expect(sendMessageSpy).toHaveBeenCalledWith(1001, expect.any(String), expect.anything());
    expect(redisModule.setPersistentKeyboardMsg).toHaveBeenCalledWith(123456n, 1001, 446);
    expect(deleteMessageSpy).toHaveBeenCalledWith(1001, 333);
  });

  it('cleanly removes persistent keyboard and clears persistent keyboard state from Redis', async () => {
    // Arrange
    const service = new ScreenFlowService();
    const deleteMessageSpy = vi.fn().mockResolvedValue(true);
    const sendMessageSpy = vi.fn().mockResolvedValue({ message_id: 888 });
    const mockCtx = {
      from: { id: 123456 },
      chat: { id: 1001, type: 'private' },
      api: {
        deleteMessage: deleteMessageSpy,
        sendMessage: sendMessageSpy,
      },
    } as unknown as MyContext;

    vi.mocked(redisModule.getPersistentKeyboardMsg).mockResolvedValueOnce({
      chatId: 1001,
      messageId: 777,
    });

    // Act
    await service.removePersistentKeyboard(mockCtx);

    // Assert
    expect(deleteMessageSpy).toHaveBeenCalledWith(1001, 777);
    expect(redisModule.clearPersistentKeyboardMsg).toHaveBeenCalledWith(123456n);
    expect(sendMessageSpy).toHaveBeenCalledWith(
      1001,
      expect.any(String),
      expect.objectContaining({ reply_markup: { remove_keyboard: true } })
    );
  });

  it('ignores and does NOT send or remove persistent keyboards in group chats', async () => {
    // Arrange
    const service = new ScreenFlowService();
    const sendMessageSpy = vi.fn();
    const deleteMessageSpy = vi.fn();
    const mockCtx = {
      from: { id: 123456 },
      chat: { id: -100999, type: 'group' },
      api: {
        deleteMessage: deleteMessageSpy,
        sendMessage: sendMessageSpy,
      },
    } as unknown as MyContext;

    // Act
    await service.ensurePersistentKeyboard(mockCtx, undefined, true);
    await service.removePersistentKeyboard(mockCtx);

    // Assert
    expect(sendMessageSpy).not.toHaveBeenCalled();
    expect(deleteMessageSpy).not.toHaveBeenCalled();
    expect(redisModule.setPersistentKeyboardMsg).not.toHaveBeenCalled();
    expect(redisModule.clearPersistentKeyboardMsg).not.toHaveBeenCalled();
  });
});
