import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemBackupRecoveryHandler } from '../flow.handler.js';
import type { SystemBackupRecoveryService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

const PINNED_BASE_TIME = '2026-09-25T12:00:00.000Z';

describe('Flow 00.13 RBAC Tests — Access Control & Role Immunity', () => {
  const answerCallbackQuery = vi.fn().mockResolvedValue(true);
  const editMessageText = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    answerCallbackQuery.mockClear();
    editMessageText.mockClear();
  });

  it('blocks unauthorized WORKER role with an alert and prevents service call', async () => {
    const getBackupStatus = vi.fn();
    const mockService = { getBackupStatus } as unknown as SystemBackupRecoveryService;
    const handler = new SystemBackupRecoveryHandler(mockService);

    const ctx = {
      effectiveRole: 'WORKER',
      callbackQuery: { data: 'action:settings:backup_recovery' },
      answerCallbackQuery,
    } as unknown as SettingsModuleContext;

    await handler.handleOpenHub(ctx);
    expect(answerCallbackQuery).toHaveBeenCalledWith(expect.objectContaining({ show_alert: true }));
    expect(getBackupStatus).not.toHaveBeenCalled();
  });

  it('blocks FIELD_ADMIN and ACCOUNTANT roles with alert', async () => {
    const executeBackupNow = vi.fn();
    const mockService = { executeBackupNow } as unknown as SystemBackupRecoveryService;
    const handler = new SystemBackupRecoveryHandler(mockService);

    for (const role of ['FIELD_ADMIN', 'ACCOUNTANT', 'SUPPLIER', 'GUEST'] as const) {
      answerCallbackQuery.mockClear();
      const ctx = {
        effectiveRole: role,
        callbackQuery: { data: 'bck:now' },
        answerCallbackQuery,
      } as unknown as SettingsModuleContext;

      await handler.handleTriggerBackup(ctx);
      expect(answerCallbackQuery).toHaveBeenCalledWith(expect.objectContaining({ show_alert: true }));
      expect(executeBackupNow).not.toHaveBeenCalled();
    }
  });

  it('allows SUPER_ADMIN and GENERAL_ADMIN roles to open hub and trigger backup', async () => {
    const getBackupStatus = vi.fn().mockResolvedValue({
      totalBackups: 1,
      latestBackupId: 'BCK-20260923-100000',
      latestBackupAt: PINNED_BASE_TIME,
      rpoStatus: 'HEALTHY',
      cloudSyncEnabled: true,
      encryptionType: 'AES-256-GCM',
      zeroBloatLimitMb: 30,
    });
    const mockService = { getBackupStatus } as unknown as SystemBackupRecoveryService;
    const handler = new SystemBackupRecoveryHandler(mockService);

    for (const role of ['SUPER_ADMIN', 'GENERAL_ADMIN'] as const) {
      answerCallbackQuery.mockClear();
      editMessageText.mockClear();
      const ctx = {
        effectiveRole: role,
        callbackQuery: { data: 'action:settings:backup_recovery', message: { message_id: 100 } },
        answerCallbackQuery,
        editMessageText,
      } as unknown as SettingsModuleContext;

      await handler.handleOpenHub(ctx);
      expect(getBackupStatus).toHaveBeenCalled();
    }
  });

  it('blocks unauthorized roles from selecting snapshot, prompting, or confirming restore', async () => {
    const restoreBackup = vi.fn();
    const mockService = { restoreBackup } as unknown as SystemBackupRecoveryService;
    const handler = new SystemBackupRecoveryHandler(mockService);

    for (const role of ['WORKER', 'FIELD_ADMIN', 'ACCOUNTANT', 'SUPPLIER', 'GUEST'] as const) {
      answerCallbackQuery.mockClear();
      const ctx = {
        effectiveRole: role,
        callbackQuery: { data: 'bck:cfr:BCK-20260925-122741' },
        match: ['bck:cfr:BCK-20260925-122741', 'BCK-20260925-122741'],
        answerCallbackQuery,
      } as unknown as SettingsModuleContext;

      await handler.handleConfirmRestore(ctx);
      expect(answerCallbackQuery).toHaveBeenCalledWith(expect.objectContaining({ show_alert: true }));
      expect(restoreBackup).not.toHaveBeenCalled();
    }
  });
});
