import { InlineKeyboard } from 'grammy';
import type { BackupListItemDto } from './flow.types.js';

export function buildBackupMainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('⚡ أخذ نسخة الآن', 'bck:now')
    .row()
    .text('🧪 تدريب الكوارث', 'bck:drill')
    .row()
    .text('📋 سجل اللقطات', 'bck:list')
    .text('🔄 تحديث الحالة', 'bck:status')
    .row()
    .text('🔙 عودة للضبط', 'bck:back');
}

export function buildBackupInProgressKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('⏳ جاري النسخ...', 'bck:status');
}

export function buildBackupListKeyboard(items: BackupListItemDto[]): InlineKeyboard {
  const kb = new InlineKeyboard();

  // Show up to 4 recent snapshots
  const displayed = items.slice(0, 4);
  for (const item of displayed) {
    const statusIcon = item.isIntegrityIntact ? '🟢' : '🔴';
    const label = `${statusIcon} ${item.backupId.slice(4)}`.slice(0, 16);
    kb.text(label, `bck:sel:${item.backupId}`).row();
  }

  kb.text('⚡ أخذ نسخة الآن', 'bck:now')
    .row()
    .text('🔙 عودة للرئيسية', 'action:settings:backup_recovery');

  return kb;
}

export function buildSnapshotDetailKeyboard(backupId: string, cloudUrl?: string): InlineKeyboard {
  const kb = new InlineKeyboard();

  kb.text('♻️ استعادة حية', `bck:rst:${backupId}`).row();

  if (cloudUrl) {
    kb.url('☁️ فتح بدرايف', cloudUrl).row();
  }

  kb.text('📋 عودة للسجل', 'bck:list')
    .text('🔙 عودة للضبط', 'bck:back');

  return kb;
}

export function buildRestoreConfirmKeyboard(backupId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('⚠️ تأكيد البدء', `bck:cfr:${backupId}`)
    .row()
    .text('❌ إلغاء وتراجع', `bck:sel:${backupId}`);
}

export function buildRestoreInProgressKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('⏳ قيد الاستعادة', 'bck:status');
}

export function buildRestoreCompletedKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📋 عرض السجل', 'bck:list')
    .text('🔄 فحص الحالة', 'bck:status')
    .row()
    .text('🔙 عودة للضبط', 'bck:back');
}

export function buildBackupCompletionKeyboard(backupId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('📋 عرض السجل', 'bck:list')
    .text('🔄 فحص الحالة', 'bck:status')
    .row()
    .text('🔙 عودة للضبط', 'bck:back');
}
