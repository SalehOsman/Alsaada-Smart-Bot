import { InlineKeyboard } from 'grammy';

export function buildGuestSearchCancelKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔙 إلغاء والعودة للرئيسية', 'action:guest_join:cancel');
}

export function buildAdminDispatchKeyboard(officialPhone: string, whatsAppUrl: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (whatsAppUrl) {
    kb.url('📲 إرسال رابط التفعيل لواتساب العامل', whatsAppUrl).row();
  }
  kb.text('🏠 العودة للرئيسية', 'action:main_menu');
  return kb;
}

export function buildAfterSubmitKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔍 متابعة حالة الطلب', 'action:guest_join:status')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');
}

export function buildLinkingSuccessKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🚀 فتح البوابة الذاتية للعامل', 'action:main_menu');
}
