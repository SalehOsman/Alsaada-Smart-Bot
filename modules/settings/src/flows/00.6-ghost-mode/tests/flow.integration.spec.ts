import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GhostModeHandler } from '../flow.handler.js';
import type { GhostModeService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.6 Integration Tests — محاكاة وتقمص الأدوار', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const createMockService = (): GhostModeService =>
    ({
      clearPendingEdit: vi.fn().mockResolvedValue(undefined),
      clearWizardState: vi.fn().mockResolvedValue(undefined),
      clearEditState: vi.fn().mockResolvedValue(undefined),
      getProfile: vi.fn().mockResolvedValue(null),
      listSites: vi.fn().mockResolvedValue([]),
      listDepartments: vi.fn().mockResolvedValue([]),
      listAdminUsers: vi.fn().mockResolvedValue([]),
      getApmSummary: vi.fn().mockResolvedValue({ totalOps24h: 0, avgLatencyMs: 0, greenPct: 100, yellowPct: 0, redPct: 0 }),
      getMaintenanceStatus: vi.fn().mockResolvedValue({ isMaintenanceActive: false }),
      impersonateWorker: vi.fn(),
      impersonateSupplier: vi.fn(),
      impersonate: vi.fn(),
      exitImpersonate: vi.fn(),
    } as unknown as GhostModeService);

  it('coordinates handler execution with service when rendering ghost mode menu', async () => {
    // Arrange
    const service = createMockService();
    const handler = new GhostModeHandler(service);
    const replyMock = vi.fn().mockResolvedValue({});
    const ctx = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      reply: replyMock,
      from: { id: 7594239391 },
    } as unknown as SettingsModuleContext;

    // Act
    await handler.renderGhostModeMenu(ctx);

    // Assert
    expect(replyMock).toHaveBeenCalledTimes(1);
  });

  it('triggers onStateChanged and screenFlow persistent keyboard refresh upon selecting worker', async () => {
    // Arrange
    const service = createMockService();
    vi.mocked(service.impersonateWorker).mockResolvedValue({
      success: true,
      role: 'WORKER',
      workerName: 'محمود إبراهيم',
      entity: { type: 'WORKER', id: 'w-1', name: 'محمود إبراهيم', code: 'W-001' },
    });

    const onStateChanged = vi.fn().mockResolvedValue(undefined);
    const screenFlow = {
      ensurePersistentKeyboard: vi.fn().mockResolvedValue(undefined),
    };

    const handler = new GhostModeHandler(service, onStateChanged, screenFlow);
    const ctx = {
      isRealSuperAdmin: true,
      from: { id: 123456 },
      callbackQuery: { id: 'cb-1' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockResolvedValue(true),
    } as unknown as SettingsModuleContext;

    // Act
    await handler.handleSelectWorker(ctx, 'w-1');

    // Assert
    expect(onStateChanged).toHaveBeenCalledWith(123456n, 'WORKER');
    expect(screenFlow.ensurePersistentKeyboard).toHaveBeenCalledWith(ctx, undefined, true);
    expect(ctx.effectiveRole).toBe('WORKER');
    expect(ctx.isImpersonating).toBe(true);
    expect(ctx.impersonatedEntity?.name).toBe('محمود إبراهيم');
  });

  it('triggers onStateChanged and screenFlow persistent keyboard refresh upon selecting supplier', async () => {
    // Arrange
    const service = createMockService();
    vi.mocked(service.impersonateSupplier).mockResolvedValue({
      success: true,
      role: 'SUPPLIER',
      supplierName: 'شركة الإيمان',
      entity: { type: 'SUPPLIER', id: 's-1', name: 'شركة الإيمان', code: 'S-001' },
    });

    const onStateChanged = vi.fn().mockResolvedValue(undefined);
    const screenFlow = {
      ensurePersistentKeyboard: vi.fn().mockResolvedValue(undefined),
    };

    const handler = new GhostModeHandler(service, onStateChanged, screenFlow);
    const ctx = {
      isRealSuperAdmin: true,
      from: { id: 123456 },
      callbackQuery: { id: 'cb-2' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockResolvedValue(true),
    } as unknown as SettingsModuleContext;

    // Act
    await handler.handleSelectSupplier(ctx, 's-1');

    // Assert
    expect(onStateChanged).toHaveBeenCalledWith(123456n, 'SUPPLIER');
    expect(screenFlow.ensurePersistentKeyboard).toHaveBeenCalledWith(ctx, undefined, true);
    expect(ctx.effectiveRole).toBe('SUPPLIER');
    expect(ctx.isImpersonating).toBe(true);
  });

  it('triggers onStateChanged and screenFlow persistent keyboard refresh upon impersonating role', async () => {
    // Arrange
    const service = createMockService();
    vi.mocked(service.impersonate).mockResolvedValue({
      success: true,
      role: 'FIELD_ADMIN',
      entity: { type: 'SITE', id: 'site-1', name: 'السباعية', siteId: 'site-1' },
    });

    const onStateChanged = vi.fn().mockResolvedValue(undefined);
    const screenFlow = {
      ensurePersistentKeyboard: vi.fn().mockResolvedValue(undefined),
    };

    const handler = new GhostModeHandler(service, onStateChanged, screenFlow);
    const ctx = {
      isRealSuperAdmin: true,
      from: { id: 123456 },
      callbackQuery: { id: 'cb-3' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockResolvedValue(true),
    } as unknown as SettingsModuleContext;

    // Act
    await handler.handleImpersonateRole(ctx, 'FIELD_ADMIN');

    // Assert
    expect(onStateChanged).toHaveBeenCalledWith(123456n, 'FIELD_ADMIN');
    expect(screenFlow.ensurePersistentKeyboard).toHaveBeenCalledWith(ctx, undefined, true);
    expect(ctx.effectiveRole).toBe('FIELD_ADMIN');
  });

  it('restores Super Admin and atomically refreshes keyboard upon exiting impersonation', async () => {
    // Arrange
    const service = createMockService();
    vi.mocked(service.exitImpersonate).mockResolvedValue(undefined);

    const onStateChanged = vi.fn().mockResolvedValue(undefined);
    const screenFlow = {
      ensurePersistentKeyboard: vi.fn().mockResolvedValue(undefined),
    };

    const handler = new GhostModeHandler(service, onStateChanged, screenFlow);
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

    // Act
    await handler.handleExitImpersonate(ctx);

    // Assert
    expect(service.exitImpersonate).toHaveBeenCalledWith(123456n);
    expect(onStateChanged).toHaveBeenCalledWith(123456n, 'SUPER_ADMIN');
    expect(ctx.effectiveRole).toBe('SUPER_ADMIN');
    expect(ctx.isImpersonating).toBe(false);
    expect(ctx.assignedSiteId).toBeUndefined();
    expect(ctx.workerId).toBeUndefined();
    expect(ctx.workerCode).toBeUndefined();
    expect(screenFlow.ensurePersistentKeyboard).toHaveBeenCalledWith(ctx, expect.stringContaining('تم إنهاء وضع المحاكاة'), true);
    expect(replyMock).not.toHaveBeenCalled();
  });

  it('rejects non-Super Admin attempting role escalation via handleExitImpersonate', async () => {
    // Arrange
    const service = createMockService();
    const onStateChanged = vi.fn();
    const screenFlow = { ensurePersistentKeyboard: vi.fn() };

    const handler = new GhostModeHandler(service, onStateChanged, screenFlow);
    const replyMock = vi.fn();
    const ctx = {
      isRealSuperAdmin: false,
      from: { id: 999999 },
      effectiveRole: 'GUEST',
      isImpersonating: false,
      reply: replyMock,
    } as unknown as SettingsModuleContext;

    // Act
    await handler.handleExitImpersonate(ctx);

    // Assert
    expect(service.exitImpersonate).not.toHaveBeenCalled();
    expect(onStateChanged).not.toHaveBeenCalled();
    expect(screenFlow.ensurePersistentKeyboard).not.toHaveBeenCalled();
    expect(ctx.effectiveRole).toBe('GUEST');
    expect(replyMock).toHaveBeenCalledWith(expect.stringContaining('حصرياً للمدير العام'));
  });

  it('safely notifies Super Admin when calling handleExitImpersonate while not impersonating', async () => {
    // Arrange
    const service = createMockService();
    const onStateChanged = vi.fn();
    const screenFlow = { ensurePersistentKeyboard: vi.fn() };

    const handler = new GhostModeHandler(service, onStateChanged, screenFlow);
    const replyMock = vi.fn();
    const ctx = {
      isRealSuperAdmin: true,
      from: { id: 123456 },
      effectiveRole: 'SUPER_ADMIN',
      isImpersonating: false,
      reply: replyMock,
    } as unknown as SettingsModuleContext;

    // Act
    await handler.handleExitImpersonate(ctx);

    // Assert
    expect(service.exitImpersonate).not.toHaveBeenCalled();
    expect(onStateChanged).not.toHaveBeenCalled();
    expect(screenFlow.ensurePersistentKeyboard).not.toHaveBeenCalled();
    expect(replyMock).toHaveBeenCalledWith(expect.stringContaining('بصلاحياتك الأصلية'));
  });
});
