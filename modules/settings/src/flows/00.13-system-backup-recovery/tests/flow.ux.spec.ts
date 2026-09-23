import { describe, it, expect } from 'vitest';
import {
  buildBackupMainMenuKeyboard,
  buildBackupInProgressKeyboard,
  buildBackupCompletionKeyboard,
  buildBackupListKeyboard,
} from '../flow.keyboard.js';
import {
  formatBackupStatusCard,
  formatBackupInProgressCard,
  formatBackupSuccessCard,
  formatDisasterRecoveryDrillCard,
  formatBackupListCard,
} from '../flow.messages.js';

describe('Flow 00.13 UX Tests — Keyboards & Cards Formatting', () => {
  function checkButton(btn: { text: string; callback_data?: string }) {
    expect(btn.text.length).toBeLessThanOrEqual(16);
    const cbData = typeof btn.callback_data === 'string' ? btn.callback_data : '';
    expect(Buffer.byteLength(cbData)).toBeLessThanOrEqual(36);
  }

  it('main menu keyboard adheres strictly to (36/16/7/3) budget', () => {
    const kb = buildBackupMainMenuKeyboard();
    expect(kb.inline_keyboard.length).toBeLessThanOrEqual(7);
    for (const row of kb.inline_keyboard) {
      expect(row.length).toBeLessThanOrEqual(3);
      for (const btn of row) {
        checkButton(btn);
      }
    }
  });

  it('in-progress keyboard adheres strictly to (36/16/7/3) budget', () => {
    const kb = buildBackupInProgressKeyboard();
    expect(kb.inline_keyboard.length).toBeLessThanOrEqual(7);
    for (const row of kb.inline_keyboard) {
      expect(row.length).toBeLessThanOrEqual(3);
      for (const btn of row) {
        checkButton(btn);
      }
    }
  });

  it('completion keyboard adheres strictly to (36/16/7/3) budget', () => {
    const kb = buildBackupCompletionKeyboard('BCK-20260923-120000');
    expect(kb.inline_keyboard.length).toBeLessThanOrEqual(7);
    for (const row of kb.inline_keyboard) {
      expect(row.length).toBeLessThanOrEqual(3);
      for (const btn of row) {
        checkButton(btn);
      }
    }
  });

  it('list keyboard adheres strictly to (36/16/7/3) budget', () => {
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

  it('formats rich cards with breadcrumbs and zero-bloat badge', () => {
    const statusCard = formatBackupStatusCard({
      totalBackups: 3,
      latestBackupId: 'BCK-20260923-120000',
      latestBackupAt: new Date().toISOString(),
      rpoStatus: 'HEALTHY',
      cloudSyncEnabled: true,
      encryptionType: 'AES-256-GCM',
      zeroBloatLimitMb: 30,
    });
    expect(statusCard).toContain('قمرة النسخ الاحتياطي');
    expect(statusCard).toContain('RPO < 24h');

    const progressCard = formatBackupInProgressCard();
    expect(progressCard).toContain('جاري إنشاء النسخة الاحتياطية الشاملة');

    const successCard = formatBackupSuccessCard({
      success: true,
      backupId: 'BCK-20260923-120000',
      createdAt: new Date().toISOString(),
      artifactsCount: 3,
      cloudSyncStatus: 'synced',
      totalSizeBytes: 1024 * 1024 * 10,
    });
    expect(successCard).toContain('BCK-20260923-120000');
    expect(successCard).toContain('Zero-Bloat Approved');

    const drillCard = formatDisasterRecoveryDrillCard({
      ok: true,
      rtoSeconds: 7,
      bundleSizeMb: 11.2,
      errors: [],
    });
    expect(drillCard).toContain('Automated DR Drill');
    expect(drillCard).toContain('ناجح 100%');

    const listCard = formatBackupListCard([
      {
        backupId: 'BCK-20260923-100000',
        createdAt: new Date().toISOString(),
        totalSizeBytes: 1024 * 1024 * 12,
        isIntegrityIntact: true,
      },
    ]);
    expect(listCard).toContain('سجل اللقطات الاحتياطية المتاحة');
  });
});
