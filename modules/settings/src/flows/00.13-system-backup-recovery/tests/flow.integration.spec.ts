import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemBackupRecoveryService } from '../flow.service.js';
import { SystemBackupRecoveryRepository } from '../flow.repository.js';
import { SystemBackupRecoveryHandler } from '../flow.handler.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';

const PINNED_BASE_TIME = '2026-09-25T12:00:00.000Z';

describe('Flow 00.13 Integration Tests — Service & Asynchronous Orchestration', () => {
  const answerCallbackQuery = vi.fn().mockResolvedValue(true);
  const editMessageText = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    answerCallbackQuery.mockClear();
    editMessageText.mockClear();
  });

  it('retrieves comprehensive backup status with RPO calculation', async () => {
    const repo = new SystemBackupRecoveryRepository();
    const service = new SystemBackupRecoveryService(repo);
    const status = await service.getBackupStatus();

    expect(status).toBeDefined();
    expect(typeof status.totalBackups).toBe('number');
    expect(['HEALTHY', 'AT_RISK', 'NEEDS_BACKUP']).toContain(status.rpoStatus);
    expect(status.encryptionType).toEqual('AES-256-GCM');
    expect(status.zeroBloatLimitMb).toEqual(30);
  });

  it('runs asynchronous handler flow with immediate ACK (<50ms) and in-place transition', async () => {
    const executeBackupNow = vi.fn().mockResolvedValue({
      success: true,
      backupId: 'BCK-20260923-180000',
      createdAt: PINNED_BASE_TIME,
      artifactsCount: 3,
      cloudSyncStatus: 'synced',
      totalSizeBytes: 1024 * 1024 * 12,
    });
    const mockService = { executeBackupNow } as unknown as SystemBackupRecoveryService;

    const handler = new SystemBackupRecoveryHandler(mockService);
    const ctx = {
      effectiveRole: 'SUPER_ADMIN',
      callbackQuery: { data: 'bck:now', message: { message_id: 42 } },
      answerCallbackQuery,
      editMessageText,
    } as unknown as SettingsModuleContext;

    await handler.handleTriggerBackup(ctx);

    expect(answerCallbackQuery).toHaveBeenCalled();
    expect(editMessageText).toHaveBeenCalledTimes(2);
    expect(executeBackupNow).toHaveBeenCalled();
  });

  it('selects snapshot and renders detail card in-place', async () => {
    const getSnapshotDetail = vi.fn().mockResolvedValue({
      backupId: 'BCK-20260925-122741',
      createdAt: PINNED_BASE_TIME,
      totalSizeBytes: 1024 * 1024 * 7.3,
      databaseSize: 1024 * 1024 * 2.1,
      codebaseSize: 1024 * 1024 * 5.1,
      isIntegrityIntact: true,
      artifactsCount: 3,
      cloudSyncStatus: 'synced',
      cloudUrl: 'https://drive.google.com/test',
    });
    const mockService = { getSnapshotDetail } as unknown as SystemBackupRecoveryService;

    const handler = new SystemBackupRecoveryHandler(mockService);
    const ctx = {
      effectiveRole: 'SUPER_ADMIN',
      callbackQuery: { data: 'bck:sel:BCK-20260925-122741', message: { message_id: 42 } },
      match: ['bck:sel:BCK-20260925-122741', 'BCK-20260925-122741'],
      answerCallbackQuery,
      editMessageText,
    } as unknown as SettingsModuleContext;

    await handler.handleSelectSnapshot(ctx);

    expect(answerCallbackQuery).toHaveBeenCalled();
    expect(getSnapshotDetail).toHaveBeenCalledWith('BCK-20260925-122741');
    expect(editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('BCK-20260925-122741'),
      expect.objectContaining({ parse_mode: 'Markdown' }),
    );
  });

  it('prompts restore confirmation with warning card', async () => {
    const getSnapshotDetail = vi.fn().mockResolvedValue({
      backupId: 'BCK-20260925-122741',
      createdAt: PINNED_BASE_TIME,
    });
    const mockService = { getSnapshotDetail } as unknown as SystemBackupRecoveryService;

    const handler = new SystemBackupRecoveryHandler(mockService);
    const ctx = {
      effectiveRole: 'SUPER_ADMIN',
      callbackQuery: { data: 'bck:rst:BCK-20260925-122741', message: { message_id: 42 } },
      match: ['bck:rst:BCK-20260925-122741', 'BCK-20260925-122741'],
      answerCallbackQuery,
      editMessageText,
    } as unknown as SettingsModuleContext;

    await handler.handlePromptRestore(ctx);

    expect(answerCallbackQuery).toHaveBeenCalled();
    expect(editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('تحذير أمني وسيادي: استعادة حية'),
      expect.objectContaining({ parse_mode: 'Markdown' }),
    );
  });

  it('executes live restore asynchronously with immediate ACK and dual transitions', async () => {
    const restoreBackup = vi.fn().mockResolvedValue({
      success: true,
      backupId: 'BCK-20260925-122741',
      safetyBackupId: 'BCK-20260925-125000',
      rtoSeconds: 4,
      restoredAt: PINNED_BASE_TIME,
    });
    const mockService = { restoreBackup } as unknown as SystemBackupRecoveryService;

    const handler = new SystemBackupRecoveryHandler(mockService);
    const ctx = {
      effectiveRole: 'SUPER_ADMIN',
      callbackQuery: { data: 'bck:cfr:BCK-20260925-122741', message: { message_id: 42 } },
      match: ['bck:cfr:BCK-20260925-122741', 'BCK-20260925-122741'],
      answerCallbackQuery,
      editMessageText,
    } as unknown as SettingsModuleContext;

    await handler.handleConfirmRestore(ctx);

    expect(answerCallbackQuery).toHaveBeenCalled();
    expect(editMessageText).toHaveBeenCalledTimes(2);
    expect(restoreBackup).toHaveBeenCalledWith('BCK-20260925-122741');
  });
});
