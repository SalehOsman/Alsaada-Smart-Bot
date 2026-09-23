import { describe, it, expect, vi } from 'vitest';
import {
  SystemBackupRecoveryService,
  SystemBackupRecoveryHandler,
  buildBackupMainMenuKeyboard,
  buildBackupInProgressKeyboard,
  buildBackupCompletionKeyboard,
  buildBackupListKeyboard,
  formatBackupStatusCard,
  formatBackupInProgressCard,
  formatBackupSuccessCard,
  formatDisasterRecoveryDrillCard,
  formatBackupListCard,
  validateBackupConfirmationCode,
  validateBackupId,
  validateAdminRole,
} from '../../src/flows/00.13-system-backup-recovery/index.js';
import type { SettingsModuleContext } from '../../src/shared/module.types.js';

describe('Flow 00.13: System Backup & Disaster Recovery Specification', () => {
  describe('1. Telegram Ergonomics Budget (36/16/7/3)', () => {
    function checkButton(btn: any) {
      expect(btn.text.length).toBeLessThanOrEqual(16);
      const cbData = 'callback_data' in btn && typeof btn.callback_data === 'string' ? btn.callback_data : '';
      expect(Buffer.byteLength(cbData)).toBeLessThanOrEqual(36);
    }

    it('main menu keyboard adheres strictly to (36/16/7/3) budget', () => {
      const kb = buildBackupMainMenuKeyboard();
      const rows = kb.inline_keyboard;

      expect(rows.length).toBeLessThanOrEqual(7);

      for (const row of rows) {
        expect(row.length).toBeLessThanOrEqual(3);
        for (const btn of row) {
          checkButton(btn);
        }
      }
    });

    it('in-progress keyboard adheres to budget', () => {
      const kb = buildBackupInProgressKeyboard();
      expect(kb.inline_keyboard.length).toBeLessThanOrEqual(7);
      for (const row of kb.inline_keyboard) {
        expect(row.length).toBeLessThanOrEqual(3);
        for (const btn of row) {
          checkButton(btn);
        }
      }
    });

    it('completion keyboard adheres to budget', () => {
      const kb = buildBackupCompletionKeyboard('BCK-20260923-120000');
      expect(kb.inline_keyboard.length).toBeLessThanOrEqual(7);
      for (const row of kb.inline_keyboard) {
        expect(row.length).toBeLessThanOrEqual(3);
        for (const btn of row) {
          checkButton(btn);
        }
      }
    });

    it('list keyboard adheres to budget', () => {
      const kb = buildBackupListKeyboard([
        {
          backupId: 'BCK-20260923-100000',
          createdAt: new Date().toISOString(),
          totalSizeBytes: 1024 * 1024 * 12,
          isIntegrityIntact: true,
        },
      ]);
      expect(kb.inline_keyboard.length).toBeLessThanOrEqual(7);
      for (const row of kb.inline_keyboard) {
        expect(row.length).toBeLessThanOrEqual(3);
        for (const btn of row) {
          checkButton(btn);
        }
      }
    });
  });

  describe('2. Rich Message Card Formatters & Contract', () => {
    it('formats backup status card with all essential telemetry', () => {
      const text = formatBackupStatusCard({
        totalBackups: 5,
        latestBackupId: 'BCK-20260923-140000',
        latestBackupAt: new Date().toISOString(),
        rpoStatus: 'HEALTHY',
        cloudSyncEnabled: true,
        encryptionType: 'AES-256-GCM',
        zeroBloatLimitMb: 30,
      });

      expect(text).toContain('قمرة النسخ الاحتياطي واستعادة الكوارث');
      expect(text).toContain('AES-256-GCM');
      expect(text).toContain('RPO < 24h');
    });

    it('formats in-progress card with asynchronous step indicators', () => {
      const text = formatBackupInProgressCard();
      expect(text).toContain('جاري إنشاء النسخة الاحتياطية الشاملة');
      expect(text).toContain('Single-Transaction Dump');
      expect(text).toContain('العملية تعمل في الخلفية');
    });

    it('formats success card with backupId and zero-bloat badge', () => {
      const text = formatBackupSuccessCard({
        success: true,
        backupId: 'BCK-20260923-140000',
        createdAt: new Date().toISOString(),
        artifactsCount: 3,
        cloudSyncStatus: 'synced',
        totalSizeBytes: 1024 * 1024 * 14.5,
      });

      expect(text).toContain('BCK-20260923-140000');
      expect(text).toContain('Zero-Bloat Approved');
    });

    it('formats DR drill card with RTO and integrity results', () => {
      const text = formatDisasterRecoveryDrillCard({
        ok: true,
        rtoSeconds: 8,
        bundleSizeMb: 12.4,
        errors: [],
      });

      expect(text).toContain('Automated DR Drill');
      expect(text).toContain('ناجح 100%');
      expect(text).toContain('8');
    });
  });

  describe('3. Flow Validators & Security Invariants', () => {
    it('validates today confirmation code strictly', () => {
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const validCode = `RESTORE-${todayStr}`;

      expect(validateBackupConfirmationCode(validCode)).toBe(true);
      expect(validateBackupConfirmationCode('RESTORE-19990101')).toBe(false);
      expect(validateBackupConfirmationCode('')).toBe(false);
    });

    it('validates backupId format', () => {
      expect(validateBackupId('BCK-20260923-120000')).toBe(true);
      expect(validateBackupId('INVALID-ID')).toBe(false);
    });

    it('validates admin role immunity', () => {
      expect(validateAdminRole('SUPER_ADMIN')).toBe(true);
      expect(validateAdminRole('GENERAL_ADMIN')).toBe(true);
      expect(validateAdminRole('WORKER')).toBe(false);
      expect(validateAdminRole('FIELD_ADMIN')).toBe(false);
    });
  });

  describe('4. Handler Interactions & Asynchronous Flow (<500ms)', () => {
    it('blocks unauthorized roles with alert', async () => {
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

    it('responds in-place asynchronously for authorized admin on backup trigger', async () => {
      const executeBackupNow = vi.fn().mockResolvedValue({
        success: true,
        backupId: 'BCK-20260923-150000',
        createdAt: new Date().toISOString(),
        artifactsCount: 3,
        cloudSyncStatus: 'staged',
        totalSizeBytes: 1024 * 1024 * 12,
      });

      const mockService = {
        executeBackupNow,
      } as unknown as SystemBackupRecoveryService;

      const handler = new SystemBackupRecoveryHandler(mockService);
      const editMessageText = vi.fn().mockResolvedValue(true);
      const answerCallbackQuery = vi.fn().mockResolvedValue(true);

      const ctx = {
        effectiveRole: 'GENERAL_ADMIN',
        callbackQuery: { data: 'bck:now', message: { message_id: 123 } },
        answerCallbackQuery,
        editMessageText,
      } as unknown as SettingsModuleContext;

      await handler.handleTriggerBackup(ctx);

      // Answered immediately
      expect(answerCallbackQuery).toHaveBeenCalled();
      // Edited at least twice: first for in-progress (<500ms), second for completion
      expect(editMessageText).toHaveBeenCalledTimes(2);
      expect(executeBackupNow).toHaveBeenCalled();
    });
  });
});
