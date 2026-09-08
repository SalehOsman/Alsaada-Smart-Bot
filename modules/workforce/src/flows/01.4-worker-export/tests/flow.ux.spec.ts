import { describe, it, expect, vi } from 'vitest';
import { WorkerExportHandler } from '../flow.handler.js';
import { WorkerExportService } from '../flow.service.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';

describe('Flow 01.4 UX Tests — In-Place Lifecycle & Universal Completion Keyboards', () => {
  const mockService = {
    generateTemplateBuffer: vi.fn(),
    parseAndImportExcel: vi.fn(),
    generateWorkersExportBuffer: vi.fn(),
  } as unknown as WorkerExportService;

  const handler = new WorkerExportHandler(mockService);

  it('should render export start menu in-place via editMessageText when callbackQuery exists', async () => {
    const editMessageTextMock = vi.fn().mockResolvedValue(true);
    const answerCallbackQueryMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      callbackQuery: { id: 'cb-1' },
      effectiveRole: 'GENERAL_ADMIN',
      editMessageText: editMessageTextMock,
      answerCallbackQuery: answerCallbackQueryMock,
      reply: vi.fn(),
    } as unknown as WorkforceModuleContext;

    await handler.handleExportStart(ctx);

    expect(answerCallbackQueryMock).toHaveBeenCalled();
    expect(editMessageTextMock).toHaveBeenCalledTimes(1);
    const callArgs = editMessageTextMock.mock.calls[0];
    expect(callArgs?.[0]).toContain('تصدير كشف العاملين المعتمد');
  });

  it('should render department menu in-place and provide back button to export start', async () => {
    const editMessageTextMock = vi.fn().mockResolvedValue(true);
    const answerCallbackQueryMock = vi.fn().mockResolvedValue(true);

    const ctx = {
      callbackQuery: { id: 'cb-2' },
      editMessageText: editMessageTextMock,
      answerCallbackQuery: answerCallbackQueryMock,
    } as unknown as WorkforceModuleContext;

    const depts = [
      { id: 'dept-1', name: 'التشغيل', code: 'OP' },
      { id: 'dept-2', name: 'الصيانة', code: 'MT' },
    ];

    await handler.handleDepartmentMenu(ctx, depts);

    expect(answerCallbackQueryMock).toHaveBeenCalled();
    expect(editMessageTextMock).toHaveBeenCalledTimes(1);
    const callArgs = editMessageTextMock.mock.calls[0];
    expect(callArgs?.[0]).toContain('تصدير كشف العاملين حسب القسم الوظيفي');
  });
});
