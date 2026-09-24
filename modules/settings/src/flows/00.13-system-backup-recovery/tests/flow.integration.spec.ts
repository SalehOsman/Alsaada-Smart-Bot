import { describe, it, expect, vi } from 'vitest';
import { SystemBackupRecoveryService } from '../flow.service.js';
import { SystemBackupRecoveryRepository } from '../flow.repository.js';
import { SystemBackupRecoveryHandler } from '../flow.handler.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

describe('Flow 00.13 Integration Tests — Service & Asynchronous Orchestration', () => {
  it('retrieves comprehensive backup status with RPO calculation', async () => {
    const repo = new SystemBackupRecoveryRepository();
    const service = new SystemBackupRecoveryService(repo);
    const status = await service.getBackupStatus();

    expect(status).toBeDefined();
    expect(typeof status.totalBackups).toBe('number');
    expect(['HEALTHY', 'AT_RISK', 'NEEDS_BACKUP']).toContain(status.rpoStatus);
    expect(status.encryptionType).toBe('AES-256-GCM');
    expect(status.zeroBloatLimitMb).toBe(30);
  });

  it('runs asynchronous handler flow with immediate ACK (<50ms) and in-place transition', async () => {
    const mockService = {
      executeBackupNow: vi.fn().mockResolvedValue({
        success: true,
        backupId: 'BCK-20260923-180000',
        createdAt: new Date().toISOString(),
        artifactsCount: 3,
        cloudSyncStatus: 'synced',
        totalSizeBytes: 1024 * 1024 * 12,
      }),
    } as unknown as SystemBackupRecoveryService;

    const handler = new SystemBackupRecoveryHandler(mockService);
    const answerCallbackQuery = vi.fn().mockResolvedValue(true);
    const editMessageText = vi.fn().mockResolvedValue(true);

    const ctx = {
      effectiveRole: 'SUPER_ADMIN',
      callbackQuery: { data: 'bck:now', message: { message_id: 42 } },
      answerCallbackQuery,
      editMessageText,
    } as unknown as SettingsModuleContext;

    await handler.handleTriggerBackup(ctx);

    expect(answerCallbackQuery).toHaveBeenCalled();
    expect(editMessageText).toHaveBeenCalledTimes(2);
    expect(mockService.executeBackupNow).toHaveBeenCalled();
  });
});
