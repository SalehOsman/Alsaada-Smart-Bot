import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerDirectoryHandler } from '../flow.handler.js';
import { WorkerDirectoryService } from '../flow.service.js';
import { WorkerDirectoryRepository } from '../flow.repository.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.5 UX Tests — In-Place Directory Navigation & Single Message Lifecycle', () => {
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

  it('updates messages in place via editMessageText on directory pagination', async () => {
    // Arrange
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
      reply: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockImplementation(() => {
        editCalled = true;
        return Promise.resolve(true);
      }),
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleDirectory(mockCtx, 2);

    // Assert
    expect(editCalled).toBe(true);
    expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
    expect(mockCtx.reply).not.toHaveBeenCalled();
  });

  it('toggles national id and re-renders card in place', async () => {
    // Arrange
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
      reply: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockImplementation((text: string) => {
        lastText = text;
        return Promise.resolve(true);
      }),
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleToggleNationalId(mockCtx, 'wrk-1', true);

    // Assert
    expect(mockCtx.editMessageText).toHaveBeenCalled();
    expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
    expect(mockCtx.reply).not.toHaveBeenCalled();
  });

  it('displays missing data dispatch card with 1-tap copy block', async () => {
    // Arrange
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
      reply: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockImplementation((text: string) => {
        lastText = text;
        return Promise.resolve(true);
      }),
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleMissingDataWhatsApp(mockCtx, 'wrk-1');

    // Assert
    expect(lastText).toContain('طلب استكمال النواقص والمستندات عبر واتساب');
    expect(lastText).toContain('```');
    expect(mockCtx.reply).not.toHaveBeenCalled();
  });
});
