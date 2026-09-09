import { describe, it, expect, vi } from 'vitest';
import { WorkerDirectoryHandler } from '../flow.handler.js';
import { WorkerDirectoryService } from '../flow.service.js';
import { WorkerDirectoryRepository } from '../flow.repository.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.5 UX Tests — In-Place Directory Navigation & Single Message Lifecycle', () => {
  it('should update messages in place via editMessageText on directory pagination', async () => {
    const mockPrisma = {
      worker: {
        count: vi.fn().mockResolvedValue(15),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'wrk-1',
            code: 'OP-001',
            name: 'علي حسن',
            aliases: [],
            jobTitle: 'عامل',
            status: 'ACTIVE',
          },
        ]),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerDirectoryRepository(mockPrisma);
    const service = new WorkerDirectoryService(repo);
    const handler = new WorkerDirectoryHandler(service);

    let editCalled = false;
    const mockCtx = {
      from: { id: 123456 },
      effectiveRole: 'FIELD_ADMIN',
      callbackQuery: {
        id: 'cb-dir-1',
        message: { message_id: 501 },
      },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockImplementation(() => {
        editCalled = true;
        return Promise.resolve(true);
      }),
    } as unknown as WorkforceModuleContext;

    await handler.handleDirectory(mockCtx, 2);

    expect(editCalled).toBe(true);
    expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
  });

  it('should toggle national id and re-render card in place', async () => {
    const mockWorker = {
      id: 'wrk-1',
      code: 'OP-001',
      name: 'علي حسن',
      aliases: [],
      jobTitle: 'عامل',
      status: 'ACTIVE',
      nationalId: 'enc_123',
      hireDate: new Date('2026-09-01'),
      site: { name: 'الموقع الرئيسي' },
      department: { name: 'الحركة' },
      attachments: [],
    };

    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(mockWorker),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerDirectoryRepository(mockPrisma);
    const service = new WorkerDirectoryService(repo);
    const handler = new WorkerDirectoryHandler(service);

    let lastText = '';
    const mockCtx = {
      from: { id: 123456 },
      effectiveRole: 'SUPER_ADMIN',
      callbackQuery: {
        id: 'cb-dir-toggle',
        message: { message_id: 502 },
      },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockImplementation((text: string) => {
        lastText = text;
        return Promise.resolve(true);
      }),
    } as unknown as WorkforceModuleContext;

    // Toggle reveal
    await handler.handleToggleNationalId(mockCtx, 'wrk-1', true);
    expect(mockCtx.editMessageText).toHaveBeenCalled();
    expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
  });

  it('should display missing data dispatch card with 1-tap copy block', async () => {
    const mockWorker = {
      id: 'wrk-1',
      code: 'OP-001',
      name: 'علي حسن',
      aliases: [],
      jobTitle: 'عامل',
      status: 'ACTIVE',
      nationalId: 'enc_123',
      hireDate: new Date('2026-09-01'),
      site: { name: 'الموقع الرئيسي' },
      department: { name: 'الحركة' },
      attachments: [],
    };

    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(mockWorker),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerDirectoryRepository(mockPrisma);
    const service = new WorkerDirectoryService(repo);
    const handler = new WorkerDirectoryHandler(service);

    let lastText = '';
    const mockCtx = {
      from: { id: 123456 },
      effectiveRole: 'FIELD_ADMIN',
      callbackQuery: {
        id: 'cb-dir-mwa',
        message: { message_id: 503 },
      },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockImplementation((text: string) => {
        lastText = text;
        return Promise.resolve(true);
      }),
    } as unknown as WorkforceModuleContext;

    await handler.handleMissingDataWhatsApp(mockCtx, 'wrk-1');
    expect(lastText).toContain('طلب استكمال النواقص والمستندات عبر واتساب');
    expect(lastText).toContain('```');
  });
});
