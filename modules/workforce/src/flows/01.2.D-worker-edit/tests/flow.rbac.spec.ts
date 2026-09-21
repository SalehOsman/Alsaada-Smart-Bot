import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerEditHandler } from '../flow.handler.js';
import { WorkerEditService } from '../flow.service.js';
import { WorkerEditRepository } from '../flow.repository.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.2.D RBAC Tests — Edit Permissions & Approval Masking', () => {
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

  it('blocks unauthorized roles from starting worker edit', async () => {
    // Arrange
    const repo = new WorkerEditRepository({} as PrismaClient);
    const service = new WorkerEditService(repo);
    const handler = new WorkerEditHandler(service, repo);

    const unauthorizedRoles: ('GUEST' | 'WORKER' | 'SUPPLIER')[] = ['GUEST', 'WORKER', 'SUPPLIER'];

    for (const role of unauthorizedRoles) {
      let blocked = false;
      const mockCtx = {
        from: { id: 112233 },
        effectiveRole: role,
        callbackQuery: { id: 'cb-edit-rbac' },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        reply: vi.fn().mockImplementation((text: string) => {
          if (text.includes('لا تملك الصلاحية')) {
            blocked = true;
          }
          return Promise.resolve(true);
        }),
      } as unknown as WorkforceModuleContext;

      // Act
      await handler.handlePickWorker(mockCtx, 'wrk-1');

      // Assert
      expect(blocked).toBe(true);
      expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
    }
  });

  it('restricts pending tickets review screen strictly to super admin and rejects field admin', async () => {
    // Arrange
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

    // Act
    await handler.handlePendingTicketsList(mockCtx);

    // Assert
    expect(restricted).toBe(true);
    expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
  });

  it('permits SUPER_ADMIN to access worker edit profile without authorization block', async () => {
    // Arrange
    const mockWorker = {
      id: 'wrk-1',
      code: 'OP-001',
      name: 'سالم حسن',
      jobTitle: 'سائق',
      site: { name: 'السباعية' },
    };
    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(mockWorker),
      },
    } as unknown as PrismaClient;
    const repo = new WorkerEditRepository(mockPrisma);
    const service = new WorkerEditService(repo);
    const handler = new WorkerEditHandler(service, repo);

    let editProfileRendered = false;
    const mockCtx = {
      from: { id: 112233 },
      effectiveRole: 'SUPER_ADMIN',
      callbackQuery: { id: 'cb-edit-auth' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      reply: vi.fn().mockImplementation((text: string) => {
        if (text.includes('تعديل ملف العامل') || text.includes('سالم حسن')) {
          editProfileRendered = true;
        }
        return Promise.resolve(true);
      }),
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handlePickWorker(mockCtx, 'wrk-1');

    // Assert
    expect(editProfileRendered).toBe(true);
  });
});
