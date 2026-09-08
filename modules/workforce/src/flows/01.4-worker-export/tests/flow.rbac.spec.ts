import { describe, it, expect, vi } from 'vitest';
import { WorkerExportHandler } from '../flow.handler.js';
import { WorkerExportService } from '../flow.service.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';

describe('Flow 01.4 RBAC Tests — Role Security & Authorization Guards', () => {
  const mockService = {
    generateTemplateBuffer: vi.fn().mockResolvedValue(Buffer.from('mock')),
    parseAndImportExcel: vi.fn(),
    generateWorkersExportBuffer: vi.fn(),
  } as unknown as WorkerExportService;

  const handler = new WorkerExportHandler(mockService);

  it('should block GUEST and WORKER from accessing export menu', async () => {
    const replyMock = vi.fn();
    const ctxWorker = {
      effectiveRole: 'WORKER',
      reply: replyMock,
    } as unknown as WorkforceModuleContext;

    await handler.handleExportStart(ctxWorker);
    expect(replyMock).toHaveBeenCalledWith(expect.stringContaining('🔒 عذراً، هذه الوظيفة مقتصرة'));

    replyMock.mockClear();
    const ctxGuest = {
      effectiveRole: 'GUEST',
      reply: replyMock,
    } as unknown as WorkforceModuleContext;

    await handler.handleExportStart(ctxGuest);
    expect(replyMock).toHaveBeenCalledWith(expect.stringContaining('🔒 عذراً، هذه الوظيفة مقتصرة'));
  });

  it('should block regular Field Admin from downloading template', async () => {
    const replyMock = vi.fn();
    const ctx = {
      isRealSuperAdmin: false,
      reply: replyMock,
    } as unknown as WorkforceModuleContext;

    await handler.handleDownloadTemplate(ctx);
    expect(replyMock).toHaveBeenCalledWith(expect.stringContaining('🔒 هذه الوظيفة مقتصرة على المدير العام فقط'));
    expect(mockService.generateTemplateBuffer).not.toHaveBeenCalled();
  });

  it('should allow Super Admin to download template', async () => {
    const replyWithDocMock = vi.fn();
    const ctx = {
      isRealSuperAdmin: true,
      replyWithDocument: replyWithDocMock,
    } as unknown as WorkforceModuleContext;

    await handler.handleDownloadTemplate(ctx);
    expect(mockService.generateTemplateBuffer).toHaveBeenCalled();
    expect(replyWithDocMock).toHaveBeenCalled();
  });
});
