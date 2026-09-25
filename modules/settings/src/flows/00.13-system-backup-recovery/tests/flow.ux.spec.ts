import { describe, it, expect } from 'vitest';
import {
  buildBackupMainMenuKeyboard,
  buildBackupInProgressKeyboard,
  buildBackupCompletionKeyboard,
  buildBackupListKeyboard,
  buildSnapshotDetailKeyboard,
  buildRestoreConfirmKeyboard,
  buildRestoreInProgressKeyboard,
  buildRestoreCompletedKeyboard,
} from '../flow.keyboard.js';
import {
  formatBackupStatusCard,
  formatBackupInProgressCard,
  formatBackupSuccessCard,
  formatDisasterRecoveryDrillCard,
  formatBackupListCard,
  formatSnapshotDetailCard,
  formatRestoreWarningCard,
  formatRestoreInProgressCard,
  formatRestoreSuccessCard,
} from '../flow.messages.js';

const PINNED_BASE_TIME = '2026-09-25T12:00:00.000Z';

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
        createdAt: PINNED_BASE_TIME,
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

  it('snapshot detail keyboard adheres strictly to (36/16/7/3) budget', () => {
    const kb = buildSnapshotDetailKeyboard('BCK-20260925-122741', 'https://drive.google.com/test');
    expect(kb.inline_keyboard.length).toBeLessThanOrEqual(7);
    for (const row of kb.inline_keyboard) {
      expect(row.length).toBeLessThanOrEqual(3);
      for (const btn of row) {
        checkButton(btn);
      }
    }
  });

  it('restore confirm keyboard adheres strictly to (36/16/7/3) budget', () => {
    const kb = buildRestoreConfirmKeyboard('BCK-20260925-122741');
    expect(kb.inline_keyboard.length).toBeLessThanOrEqual(7);
    for (const row of kb.inline_keyboard) {
      expect(row.length).toBeLessThanOrEqual(3);
      for (const btn of row) {
        checkButton(btn);
      }
    }
  });

  it('restore in-progress and completed keyboards adhere strictly to (36/16/7/3) budget', () => {
    const inProgKb = buildRestoreInProgressKeyboard();
    for (const row of inProgKb.inline_keyboard) {
      for (const btn of row) checkButton(btn);
    }

    const doneKb = buildRestoreCompletedKeyboard();
    for (const row of doneKb.inline_keyboard) {
      for (const btn of row) checkButton(btn);
    }
  });

  it('formats rich cards with breadcrumbs and zero-bloat badge', () => {
    const statusCard = formatBackupStatusCard({
      totalBackups: 3,
      latestBackupId: 'BCK-20260923-120000',
      latestBackupAt: PINNED_BASE_TIME,
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
      createdAt: PINNED_BASE_TIME,
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
        createdAt: PINNED_BASE_TIME,
        totalSizeBytes: 1024 * 1024 * 12,
        isIntegrityIntact: true,
      },
    ]);
    expect(listCard).toContain('سجل اللقطات الاحتياطية المتاحة');

    const detailCard = formatSnapshotDetailCard({
      backupId: 'BCK-20260925-122741',
      createdAt: PINNED_BASE_TIME,
      totalSizeBytes: 1024 * 1024 * 7.3,
      databaseSize: 1024 * 1024 * 2.1,
      codebaseSize: 1024 * 1024 * 5.1,
      isIntegrityIntact: true,
      artifactsCount: 3,
      cloudSyncStatus: 'synced',
    });
    expect(detailCard).toContain('تفاصيل اللقطة الاحتياطية');
    expect(detailCard).toContain('BCK-20260925-122741');

    const warningCard = formatRestoreWarningCard('BCK-20260925-122741', PINNED_BASE_TIME);
    expect(warningCard).toContain('تحذير أمني وسيادي: استعادة حية');
    expect(warningCard).toContain('Safety Snapshot');

    const restoreProgCard = formatRestoreInProgressCard('BCK-20260925-122741');
    expect(restoreProgCard).toContain('جاري تنفيذ الاستعادة الحية للبيانات');

    const restoreSuccessCard = formatRestoreSuccessCard({
      success: true,
      backupId: 'BCK-20260925-122741',
      safetyBackupId: 'BCK-20260925-125000',
      rtoSeconds: 3,
      restoredAt: PINNED_BASE_TIME,
    });
    expect(restoreSuccessCard).toContain('تمت الاستعادة الحية للبيانات بنجاح');
    expect(restoreSuccessCard).toContain('BCK-20260925-125000');
  });
});
