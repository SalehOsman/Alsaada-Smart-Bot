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
    const label = `${statusIcon} ${item.backupId.slice(4)}`; // e.g. "🟢 20260923-143000" (max 16 chars)
    kb.text(label.slice(0, 16), 'bck:status').row();
  }

  kb.text('⚡ أخذ نسخة الآن', 'bck:now')
    .row()
    .text('🔙 عودة للرئيسية', 'action:settings:backup_recovery');

  return kb;
}

export function buildBackupCompletionKeyboard(backupId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('📋 عرض السجل', 'bck:list')
    .text('🔄 فحص الحالة', 'bck:status')
    .row()
    .text('🔙 عودة للضبط', 'bck:back');
}
