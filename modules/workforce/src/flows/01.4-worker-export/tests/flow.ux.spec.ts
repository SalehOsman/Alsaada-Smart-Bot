import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerExportHandler } from '../flow.handler.js';
import { WorkerExportService } from '../flow.service.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';

describe('Flow 01.4 UX Tests — In-Place Lifecycle & Universal Completion Keyboards', () => {
  const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders export start menu in-place via editMessageText when callbackQuery exists and avoids duplicate replies', async () => {
    // Arrange
    const mockService = {
      generateTemplateBuffer: vi.fn(),
      parseAndImportExcel: vi.fn(),
      generateWorkersExportBuffer: vi.fn(),
    } as unknown as WorkerExportService;

    const handler = new WorkerExportHandler(mockService);
    const editMessageTextMock = vi.fn().mockResolvedValue(true);
    const answerCallbackQueryMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      callbackQuery: { id: 'cb-1' },
      effectiveRole: 'GENERAL_ADMIN',
      editMessageText: editMessageTextMock,
      answerCallbackQuery: answerCallbackQueryMock,
      reply: vi.fn(),
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleExportStart(ctx);

    // Assert
    expect(answerCallbackQueryMock).toHaveBeenCalled();
    expect(editMessageTextMock).toHaveBeenCalledTimes(1);
    expect(ctx.reply).not.toHaveBeenCalled();
    const callArgs = editMessageTextMock.mock.calls[0];
    expect(callArgs?.[0]).toContain('تصدير كشف العاملين المعتمد');
  });

  it('renders department menu in-place and provides back button to export start', async () => {
    // Arrange
    const mockService = {
      generateTemplateBuffer: vi.fn(),
      parseAndImportExcel: vi.fn(),
      generateWorkersExportBuffer: vi.fn(),
    } as unknown as WorkerExportService;

    const handler = new WorkerExportHandler(mockService);
    const editMessageTextMock = vi.fn().mockResolvedValue(true);
    const answerCallbackQueryMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      callbackQuery: { id: 'cb-2' },
      editMessageText: editMessageTextMock,
      answerCallbackQuery: answerCallbackQueryMock,
      reply: vi.fn(),
    } as unknown as WorkforceModuleContext;

    const depts = [
      { id: 'dept-1', name: 'التشغيل', code: 'OP' },
      { id: 'dept-2', name: 'الصيانة', code: 'MT' },
    ];

    // Act
    await handler.handleDepartmentMenu(ctx, depts);

    // Assert
    expect(answerCallbackQueryMock).toHaveBeenCalled();
    expect(editMessageTextMock).toHaveBeenCalledTimes(1);
    expect(ctx.reply).not.toHaveBeenCalled();
    const callArgs = editMessageTextMock.mock.calls[0];
    expect(callArgs?.[0]).toContain('تصدير كشف العاملين حسب القسم الوظيفي');
  });

  it('falls back to sending a regular reply when invoked without a callback query', async () => {
    // Arrange
    const mockService = {
      generateTemplateBuffer: vi.fn(),
      parseAndImportExcel: vi.fn(),
      generateWorkersExportBuffer: vi.fn(),
    } as unknown as WorkerExportService;

    const handler = new WorkerExportHandler(mockService);
    const replyMock = vi.fn().mockResolvedValue(true);
    const editMessageTextMock = vi.fn();

    const ctx = {
      callbackQuery: undefined,
      effectiveRole: 'GENERAL_ADMIN',
      editMessageText: editMessageTextMock,
      answerCallbackQuery: vi.fn(),
      reply: replyMock,
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleExportStart(ctx);

    // Assert
    expect(replyMock).toHaveBeenCalledTimes(1);
    expect(editMessageTextMock).not.toHaveBeenCalled();
    const replyArgs = replyMock.mock.calls[0];
    expect(replyArgs?.[0]).toContain('تصدير كشف العاملين المعتمد');
  });
});
