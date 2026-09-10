import { InlineKeyboard } from 'grammy';
import type { EditablePersonalField } from './flow.types.js';
import { EDITABLE_FIELD_LABELS } from './flow.types.js';

export function buildFieldPickerKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  const fields = Object.keys(EDITABLE_FIELD_LABELS) as EditablePersonalField[];

  for (let i = 0; i < fields.length; i += 2) {
    const f1 = fields[i];
    const f2 = fields[i + 1];
    if (f1) {
      kb.text(EDITABLE_FIELD_LABELS[f1], `action:wse:f:${f1}`);
    }
    if (f2) {
      kb.text(EDITABLE_FIELD_LABELS[f2], `action:wse:f:${f2}`);
    }
    kb.row();
  }

  kb.text('🔙 إلغاء والعودة للبوابة', 'action:wse:cancel');
  return kb;
}

export function buildConfirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ تأكيد وحفظ التعديل', 'action:wse:confirm')
    .text('❌ إلغاء', 'action:wse:cancel');
}

export function buildSuccessKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('👤 عرض ملفي الشخصي', 'action:worker:my_profile')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');
}
