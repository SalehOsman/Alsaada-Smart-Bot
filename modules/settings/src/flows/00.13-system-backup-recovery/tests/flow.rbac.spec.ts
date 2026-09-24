import { describe, it, expect, vi } from 'vitest';
import { SystemBackupRecoveryHandler } from '../flow.handler.js';
import type { SystemBackupRecoveryService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

describe('Flow 00.13 RBAC Tests — Access Control & Role Immunity', () => {
  it('blocks unauthorized WORKER role with an alert and prevents service call', async () => {
    const mockService = {
      getBackupStatus: vi.fn(),
    } as unknown as SystemBackupRecoveryService;

    const handler = new SystemBackupRecoveryHandler(mockService);
    const answerCallbackQuery = vi.fn();

    const ctx = {
      effectiveRole: 'WORKER',
      callbackQuery: { data: 'action:settings:backup_recovery' },
      answerCallbackQuery,
    } as unknown as SettingsModuleContext;

    await handler.handleOpenHub(ctx);
    expect(answerCallbackQuery).toHaveBeenCalledWith(expect.objectContaining({ show_alert: true }));
    expect(mockService.getBackupStatus).not.toHaveBeenCalled();
  });

  it('blocks FIELD_ADMIN and ACCOUNTANT roles with alert', async () => {
    const mockService = {
      getBackupStatus: vi.fn(),
      executeBackupNow: vi.fn(),
    } as unknown as SystemBackupRecoveryService;

    const handler = new SystemBackupRecoveryHandler(mockService);

    for (const role of ['FIELD_ADMIN', 'ACCOUNTANT', 'SUPPLIER', 'GUEST'] as const) {
      const answerCallbackQuery = vi.fn();
      const ctx = {
        effectiveRole: role,
        callbackQuery: { data: 'bck:now' },
        answerCallbackQuery,
      } as unknown as SettingsModuleContext;

      await handler.handleTriggerBackup(ctx);
      expect(answerCallbackQuery).toHaveBeenCalledWith(expect.objectContaining({ show_alert: true }));
      expect(mockService.executeBackupNow).not.toHaveBeenCalled();
    }
  });

  it('allows SUPER_ADMIN and GENERAL_ADMIN roles to open hub and trigger backup', async () => {
    const mockService = {
      getBackupStatus: vi.fn().mockResolvedValue({
        totalBackups: 1,
        latestBackupId: 'BCK-20260923-100000',
        latestBackupAt: new Date().toISOString(),
        rpoStatus: 'HEALTHY',
        cloudSyncEnabled: true,
        encryptionType: 'AES-256-GCM',
        zeroBloatLimitMb: 30,
      }),
    } as unknown as SystemBackupRecoveryService;

    const handler = new SystemBackupRecoveryHandler(mockService);

    for (const role of ['SUPER_ADMIN', 'GENERAL_ADMIN'] as const) {
      const answerCallbackQuery = vi.fn().mockResolvedValue(true);
      const editMessageText = vi.fn().mockResolvedValue(true);
      const ctx = {
        effectiveRole: role,
        callbackQuery: { data: 'action:settings:backup_recovery', message: { message_id: 100 } },
        answerCallbackQuery,
        editMessageText,
      } as unknown as SettingsModuleContext;

      await handler.handleOpenHub(ctx);
      expect(mockService.getBackupStatus).toHaveBeenCalled();
    }
  });
});
