import { describe, it, expect, vi } from 'vitest';
import { GhostModeHandler } from '../flow.handler.js';
import type { GhostModeService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

describe('Flow 00.6 Integration Tests — محاكاة وتقمص الأدوار', () => {
  it('should coordinate handler execution with service', async () => {
    const mockService = {
      clearPendingEdit: vi.fn().mockResolvedValue(undefined),
      clearWizardState: vi.fn().mockResolvedValue(undefined),
      clearEditState: vi.fn().mockResolvedValue(undefined),
      getProfile: vi.fn().mockResolvedValue(null),
      listSites: vi.fn().mockResolvedValue([]),
      listDepartments: vi.fn().mockResolvedValue([]),
      listAdminUsers: vi.fn().mockResolvedValue([]),
      getApmSummary: vi.fn().mockResolvedValue({ totalOps24h: 0, avgLatencyMs: 0, greenPct: 100, yellowPct: 0, redPct: 0 }),
      getMaintenanceStatus: vi.fn().mockResolvedValue({ isMaintenanceActive: false }),
    } as unknown as GhostModeService;

    const handler = new GhostModeHandler(mockService);
    const replyMock = vi.fn().mockResolvedValue({});
    const ctx = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      reply: replyMock,
      from: { id: 7594239391 },
    } as unknown as SettingsModuleContext;

    await handler.renderGhostModeMenu(ctx);
    expect(replyMock).toHaveBeenCalledTimes(1);
  });

  it('should trigger onStateChanged and screenFlow.ensurePersistentKeyboard when selecting worker', async () => {
    const mockService = {
      impersonateWorker: vi.fn().mockResolvedValue({
        success: true,
        role: 'WORKER',
        workerName: 'محمود إبراهيم',
        entity: { type: 'WORKER', id: 'w-1', name: 'محمود إبراهيم', code: 'W-001' },
      }),
    } as unknown as GhostModeService;

    const onStateChanged = vi.fn().mockResolvedValue(undefined);
    const screenFlow = {
      ensurePersistentKeyboard: vi.fn().mockResolvedValue(undefined),
    };

    const handler = new GhostModeHandler(mockService, onStateChanged, screenFlow);
    const ctx = {
      isRealSuperAdmin: true,
      from: { id: 123456 },
      callbackQuery: { id: 'cb-1' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockResolvedValue(true),
    } as unknown as SettingsModuleContext;

    await handler.handleSelectWorker(ctx, 'w-1');

    expect(onStateChanged).toHaveBeenCalledWith(123456n, 'WORKER');
    expect(screenFlow.ensurePersistentKeyboard).toHaveBeenCalledWith(ctx, undefined, true);
    expect(ctx.effectiveRole).toBe('WORKER');
    expect(ctx.isImpersonating).toBe(true);
    expect(ctx.impersonatedEntity?.name).toBe('محمود إبراهيم');
  });

  it('should trigger onStateChanged and screenFlow.ensurePersistentKeyboard when selecting supplier', async () => {
    const mockService = {
      impersonateSupplier: vi.fn().mockResolvedValue({
        success: true,
        role: 'SUPPLIER',
        supplierName: 'شركة الإيمان',
        entity: { type: 'SUPPLIER', id: 's-1', name: 'شركة الإيمان', code: 'S-001' },
      }),
    } as unknown as GhostModeService;

    const onStateChanged = vi.fn().mockResolvedValue(undefined);
    const screenFlow = {
      ensurePersistentKeyboard: vi.fn().mockResolvedValue(undefined),
    };

    const handler = new GhostModeHandler(mockService, onStateChanged, screenFlow);
    const ctx = {
      isRealSuperAdmin: true,
      from: { id: 123456 },
      callbackQuery: { id: 'cb-2' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockResolvedValue(true),
    } as unknown as SettingsModuleContext;

    await handler.handleSelectSupplier(ctx, 's-1');

    expect(onStateChanged).toHaveBeenCalledWith(123456n, 'SUPPLIER');
    expect(screenFlow.ensurePersistentKeyboard).toHaveBeenCalledWith(ctx, undefined, true);
    expect(ctx.effectiveRole).toBe('SUPPLIER');
    expect(ctx.isImpersonating).toBe(true);
  });

  it('should trigger onStateChanged and screenFlow.ensurePersistentKeyboard when impersonating role', async () => {
    const mockService = {
      impersonate: vi.fn().mockResolvedValue({
        success: true,
        role: 'FIELD_ADMIN',
        entity: { type: 'SITE', id: 'site-1', name: 'السباعية', siteId: 'site-1' },
      }),
    } as unknown as GhostModeService;

    const onStateChanged = vi.fn().mockResolvedValue(undefined);
    const screenFlow = {
      ensurePersistentKeyboard: vi.fn().mockResolvedValue(undefined),
    };

    const handler = new GhostModeHandler(mockService, onStateChanged, screenFlow);
    const ctx = {
      isRealSuperAdmin: true,
      from: { id: 123456 },
      callbackQuery: { id: 'cb-3' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockResolvedValue(true),
    } as unknown as SettingsModuleContext;

    await handler.handleImpersonateRole(ctx, 'FIELD_ADMIN');

    expect(onStateChanged).toHaveBeenCalledWith(123456n, 'FIELD_ADMIN');
    expect(screenFlow.ensurePersistentKeyboard).toHaveBeenCalledWith(ctx, undefined, true);
    expect(ctx.effectiveRole).toBe('FIELD_ADMIN');
  });

  it('should restore Super Admin and atomically refresh keyboard upon exiting impersonation via reply bar text', async () => {
    const mockService = {
      exitImpersonate: vi.fn().mockResolvedValue(undefined),
    } as unknown as GhostModeService;

    const onStateChanged = vi.fn().mockResolvedValue(undefined);
    const screenFlow = {
      ensurePersistentKeyboard: vi.fn().mockResolvedValue(undefined),
    };

    const handler = new GhostModeHandler(mockService, onStateChanged, screenFlow);
    const replyMock = vi.fn();
    const ctx = {
      isRealSuperAdmin: true,
      from: { id: 123456 },
      effectiveRole: 'WORKER',
      isImpersonating: true,
      assignedSiteId: 'site-99',
      workerId: 'w-1',
      workerCode: 'W-001',
      reply: replyMock,
    } as unknown as SettingsModuleContext;

    await handler.handleExitImpersonate(ctx);

    expect(mockService.exitImpersonate).toHaveBeenCalledWith(123456n);
    expect(onStateChanged).toHaveBeenCalledWith(123456n, 'SUPER_ADMIN');
    expect(ctx.effectiveRole).toBe('SUPER_ADMIN');
    expect(ctx.isImpersonating).toBe(false);
    expect(ctx.assignedSiteId).toBeUndefined();
    expect(ctx.workerId).toBeUndefined();
    expect(ctx.workerCode).toBeUndefined();
    // Atomic dispatch: ensurePersistentKeyboard called with exit message, replyMock NOT called
    expect(screenFlow.ensurePersistentKeyboard).toHaveBeenCalledWith(ctx, expect.stringContaining('تم إنهاء وضع المحاكاة'), true);
    expect(replyMock).not.toHaveBeenCalled();
  });

  it('SECURITY: should REJECT non-Super Admin from calling handleExitImpersonate (Zero Role Escalation)', async () => {
    const mockService = {
      exitImpersonate: vi.fn(),
    } as unknown as GhostModeService;
    const onStateChanged = vi.fn();
    const screenFlow = { ensurePersistentKeyboard: vi.fn() };

    const handler = new GhostModeHandler(mockService, onStateChanged, screenFlow);
    const replyMock = vi.fn();
    const ctx = {
      isRealSuperAdmin: false,
      from: { id: 999999 },
      effectiveRole: 'GUEST',
      isImpersonating: false,
      reply: replyMock,
    } as unknown as SettingsModuleContext;

    await handler.handleExitImpersonate(ctx);

    expect(mockService.exitImpersonate).not.toHaveBeenCalled();
    expect(onStateChanged).not.toHaveBeenCalled();
    expect(screenFlow.ensurePersistentKeyboard).not.toHaveBeenCalled();
    expect(ctx.effectiveRole).toBe('GUEST');
    expect(replyMock).toHaveBeenCalledWith(expect.stringContaining('حصرياً للمدير العام'));
  });

  it('should safely notify Super Admin when calling handleExitImpersonate while NOT impersonating', async () => {
    const mockService = {
      exitImpersonate: vi.fn(),
    } as unknown as GhostModeService;
    const onStateChanged = vi.fn();
    const screenFlow = { ensurePersistentKeyboard: vi.fn() };

    const handler = new GhostModeHandler(mockService, onStateChanged, screenFlow);
    const replyMock = vi.fn();
    const ctx = {
      isRealSuperAdmin: true,
      from: { id: 123456 },
      effectiveRole: 'SUPER_ADMIN',
      isImpersonating: false,
      reply: replyMock,
    } as unknown as SettingsModuleContext;

    await handler.handleExitImpersonate(ctx);

    expect(mockService.exitImpersonate).not.toHaveBeenCalled();
    expect(onStateChanged).not.toHaveBeenCalled();
    expect(screenFlow.ensurePersistentKeyboard).not.toHaveBeenCalled();
    expect(replyMock).toHaveBeenCalledWith(expect.stringContaining('بصلاحياتك الأصلية'));
  });
});
