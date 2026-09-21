import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerExportHandler } from '../flow.handler.js';
import { WorkerExportService } from '../flow.service.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';

describe('Flow 01.4 RBAC Tests — Role Security & Authorization Guards', () => {
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

  it('blocks GUEST and WORKER from accessing export menu and sends access restriction message', async () => {
    // Arrange
    const mockService = {
      generateTemplateBuffer: vi.fn(),
      parseAndImportExcel: vi.fn(),
      generateWorkersExportBuffer: vi.fn(),
    } as unknown as WorkerExportService;
    const handler = new WorkerExportHandler(mockService);

    const unauthorizedRoles: ('WORKER' | 'GUEST')[] = ['WORKER', 'GUEST'];

    for (const role of unauthorizedRoles) {
      const replyMock = vi.fn();
      const ctx = {
        effectiveRole: role,
        reply: replyMock,
      } as unknown as WorkforceModuleContext;

      // Act
      await handler.handleExportStart(ctx);

      // Assert
      expect(replyMock).toHaveBeenCalledWith(expect.stringContaining('🔒 عذراً، هذه الوظيفة مقتصرة'));
      expect(mockService.generateWorkersExportBuffer).not.toHaveBeenCalled();
    }
  });

  it('blocks regular Field Admin from downloading template and forbids buffer generation', async () => {
    // Arrange
    const mockService = {
      generateTemplateBuffer: vi.fn().mockResolvedValue(Buffer.from('mock')),
    } as unknown as WorkerExportService;
    const handler = new WorkerExportHandler(mockService);

    const replyMock = vi.fn();
    const ctx = {
      isRealSuperAdmin: false,
      reply: replyMock,
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleDownloadTemplate(ctx);

    // Assert
    expect(replyMock).toHaveBeenCalledWith(expect.stringContaining('🔒 هذه الوظيفة مقتصرة على المدير العام فقط'));
    expect(mockService.generateTemplateBuffer).not.toHaveBeenCalled();
  });

  it('allows Super Admin to download template and dispatches document to chat', async () => {
    // Arrange
    const mockService = {
      generateTemplateBuffer: vi.fn().mockResolvedValue(Buffer.from('mock')),
    } as unknown as WorkerExportService;
    const handler = new WorkerExportHandler(mockService);

    const replyWithDocMock = vi.fn();
    const ctx = {
      isRealSuperAdmin: true,
      replyWithDocument: replyWithDocMock,
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleDownloadTemplate(ctx);

    // Assert
    expect(mockService.generateTemplateBuffer).toHaveBeenCalled();
    expect(replyWithDocMock).toHaveBeenCalled();
  });
});
