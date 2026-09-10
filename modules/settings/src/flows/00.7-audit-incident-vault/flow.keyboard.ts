import { InlineKeyboard } from 'grammy';
import type { UnresolvedErrorDto } from './flow.types.js';

export function buildAuditVaultHubKeyboard(isImpersonating?: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text('🔍 تتبع مسار مستخدم محدد (User Audit Journey)', 'action:audit:journey_prompt')
    .row()
    .text('🚨 كونسول الأعطال النشطة (Unresolved Errors)', 'action:audit:unresolved:page:1')
    .row()
    .text('🧹 أرشفة وتطهير السجلات القديمة (> 30 يوم)', 'action:audit:purge_prompt')
    .row()
    .text('🔙 العودة لقسم الأداء والتشغيل', 'action:settings_sub:system')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (isImpersonating) {
    keyboard.row().text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  return keyboard;
}

export function buildUnresolvedErrorsKeyboard(errors: UnresolvedErrorDto[], page: number, total: number, pageSize = 5): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  errors.forEach((e) => {
    const sevIcon = e.severity === 'FATAL' || e.severity === 'CRITICAL' ? '🔥' : '⚠️';
    keyboard
      .text(`${sevIcon} [${e.errorReference}] (${e.occurrenceCount}x) — ${e.errorMessage.slice(0, 24)}...`, `action:audit:error_view:${e.id}`)
      .row();
  });

  const totalPages = Math.ceil(total / pageSize) || 1;
  const navRow = [];
  if (page > 1) {
    navRow.push(InlineKeyboard.text('◀️ السابق', `action:audit:unresolved:page:${page - 1}`));
  }
  navRow.push(InlineKeyboard.text(`📄 ${page}/${totalPages}`, 'action:noop'));
  if (page < totalPages) {
    navRow.push(InlineKeyboard.text('التالي ▶️', `action:audit:unresolved:page:${page + 1}`));
  }
  keyboard.row(...navRow);

  keyboard
    .row()
    .text('🔙 العودة لكنسول التحقيق الجنائي', 'action:settings:audit_vault')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  return keyboard;
}

export function buildErrorDetailKeyboard(errorId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ اعتماد الإصلاح والإغلاق', `action:audit:resolve:${errorId}`)
    .row()
    .text('🔙 العودة لقائمة الأعطال', 'action:audit:unresolved:page:1')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');
}

export function buildPurgeConfirmationKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('⚠️ نعم، تأكيد تفريغ السجلات الأقدم من 30 يوماً', 'action:audit:purge_confirm')
    .row()
    .text('❌ تراجع وإلغاء', 'action:settings:audit_vault');
}
