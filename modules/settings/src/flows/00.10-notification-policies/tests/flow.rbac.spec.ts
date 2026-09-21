import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationPoliciesHandler } from '../flow.handler.js';
import { NotificationPoliciesService } from '../flow.service.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Flow 00.10 RBAC Spec — سياسات الإشعارات', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('strictly rejects non-super admin roles and alerts caller', async () => {
    // Arrange
    const service = new NotificationPoliciesService();
    const handler = new NotificationPoliciesHandler(service);
    const answerCallbackMock = vi.fn().mockResolvedValue(true);
    const ctx = {
      isRealSuperAdmin: false,
      effectiveRole: 'WORKER',
      isImpersonating: false,
      callbackQuery: {},
      answerCallbackQuery: answerCallbackMock,
      editMessageText: vi.fn(),
    };

    // Act
    await handler.renderPoliciesHub(ctx as unknown as import('../../../shared/module.types.js').SettingsModuleContext, true);

    // Assert
    expect(answerCallbackMock).toHaveBeenCalledWith(
      expect.objectContaining({ show_alert: true })
    );
    expect(ctx.editMessageText).not.toHaveBeenCalled();
  });

  it('permits authorized Super Admin to render policies hub', async () => {
    // Arrange
    const service = new NotificationPoliciesService();
    const handler = new NotificationPoliciesHandler(service);
    const editMock = vi.fn().mockResolvedValue(true);
    const answerMock = vi.fn().mockResolvedValue(true);
    const ctx = {
      isRealSuperAdmin: true,
      effectiveRole: 'SUPER_ADMIN',
      isImpersonating: false,
      callbackQuery: {},
      answerCallbackQuery: answerMock,
      editMessageText: editMock,
    };

    // Act
    await handler.renderPoliciesHub(ctx as unknown as import('../../../shared/module.types.js').SettingsModuleContext, true);

    // Assert
    expect(editMock).toHaveBeenCalled();
    expect(answerMock).not.toHaveBeenCalledWith(expect.objectContaining({ show_alert: true }));
  });
});
