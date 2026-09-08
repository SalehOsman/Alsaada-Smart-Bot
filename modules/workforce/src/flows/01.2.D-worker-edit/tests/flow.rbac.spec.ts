import { describe, it, expect, vi } from 'vitest';
import { WorkerEditHandler } from '../flow.handler.js';
import { WorkerEditService } from '../flow.service.js';
import { WorkerEditRepository } from '../flow.repository.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.2.D RBAC Tests — Edit Permissions & Approval Masking', () => {
  it('should block unauthorized roles from starting worker edit', async () => {
    const repo = new WorkerEditRepository({} as PrismaClient);
    const service = new WorkerEditService(repo);
    const handler = new WorkerEditHandler(service, repo);

    let blocked = false;
    const mockCtx = {
      from: { id: 112233 },
      effectiveRole: 'GUEST',
      callbackQuery: { id: 'cb-edit-rbac' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockImplementation((text: string) => {
        if (text.includes('لا تملك الصلاحية')) {
          blocked = true;
        }
        return Promise.resolve(true);
      }),
    } as unknown as WorkforceModuleContext;

    await handler.handlePickWorker(mockCtx, 'wrk-1');
    expect(blocked).toBe(true);
  });

  it('should restrict pending tickets review screen strictly to super admin', async () => {
    const repo = new WorkerEditRepository({} as PrismaClient);
    const service = new WorkerEditService(repo);
    const handler = new WorkerEditHandler(service, repo);

    let restricted = false;
    const mockCtx = {
      from: { id: 998877 },
      effectiveRole: 'FIELD_ADMIN',
      callbackQuery: { id: 'cb-pend-rbac' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockImplementation((text: string) => {
        if (text.includes('حصرية للمدير العام')) {
          restricted = true;
        }
        return Promise.resolve(true);
      }),
    } as unknown as WorkforceModuleContext;

    await handler.handlePendingTicketsList(mockCtx);
    expect(restricted).toBe(true);
  });
});
