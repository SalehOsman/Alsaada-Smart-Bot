import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerEditHandler } from '../flow.handler.js';
import { WorkerEditService } from '../flow.service.js';
import { WorkerEditRepository } from '../flow.repository.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.2.D UX Tests — In-Place Editing & Silent Message Deletion', () => {
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

  it('updates messages in place via editMessageText on field selection and avoids sending redundant replies', async () => {
    // Arrange
    const mockWorker = {
      id: 'wrk-1',
      code: 'OP-001',
      name: 'سالم حسن',
    };

    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(mockWorker),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerEditRepository(mockPrisma);
    const service = new WorkerEditService(repo);
    const handler = new WorkerEditHandler(service, repo);

    let editCalled = false;
    const mockCtx = {
      from: { id: 123456 },
      effectiveRole: 'SUPER_ADMIN',
      callbackQuery: {
        id: 'cb-edit-1',
        message: { message_id: 601 },
      },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockImplementation(() => {
        editCalled = true;
        return Promise.resolve(true);
      }),
      reply: vi.fn(),
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleSelectField(mockCtx, 'nick', 'wrk-1');

    // Assert
    expect(editCalled).toBe(true);
    expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
    expect(mockCtx.reply).not.toHaveBeenCalled();
  });

  it('rejects field selection cleanly when worker is not found and notifies user', async () => {
    // Arrange
    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerEditRepository(mockPrisma);
    const service = new WorkerEditService(repo);
    const handler = new WorkerEditHandler(service, repo);

    let notFoundAlert = false;
    const mockCtx = {
      from: { id: 654321 },
      effectiveRole: 'SUPER_ADMIN',
      callbackQuery: {
        id: 'cb-edit-not-found',
        message: { message_id: 602 },
      },
      answerCallbackQuery: vi.fn().mockImplementation((opts?: { text?: string; show_alert?: boolean }) => {
        if (opts?.text?.includes('غير موجود') || opts?.show_alert) {
          notFoundAlert = true;
        }
        return Promise.resolve(true);
      }),
      editMessageText: vi.fn(),
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleSelectField(mockCtx, 'nick', 'non-existent-id');

    // Assert
    expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
    expect(mockCtx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('لم يتم العثور على العامل'),
      expect.anything()
    );
  });
});
