import { describe, it, expect, vi } from 'vitest';
import { WorkerEditHandler } from '../flow.handler.js';
import { WorkerEditService } from '../flow.service.js';
import { WorkerEditRepository } from '../flow.repository.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.2.D UX Tests — In-Place Editing & Silent Message Deletion', () => {
  it('should update messages in place via editMessageText on field selection', async () => {
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
    } as unknown as WorkforceModuleContext;

    await handler.handleSelectField(mockCtx, 'nick', 'wrk-1');

    expect(editCalled).toBe(true);
    expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
  });
});
