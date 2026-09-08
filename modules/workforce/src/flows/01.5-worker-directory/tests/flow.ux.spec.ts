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
});
