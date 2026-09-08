import { InlineKeyboard } from 'grammy';
import { buildCompletionKeyboard } from '@alsaada/core-components';
import type { WorkerLookupOption } from './flow.types.js';

export class WorkerRegistrationKeyboards {
  static docTypeKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('🇪🇬 بطاقة الرقم القومي (مصري)', 'wizard:worker:doc_type:nat_id')
      .row()
      .text('🌍 جواز سفر (وافد / أجنبي)', 'wizard:worker:doc_type:passport')
      .row()
      .text('❌ إلغاء العملية', 'wizard:worker:cancel')
      .text('🔙 شؤون العاملين', 'menu:hr_sub:onboarding');
  }

  static photoPromptKeyboard(hasBack = true): InlineKeyboard {
    const kb = new InlineKeyboard();
    kb.text('⚡ تخطي والمتابعة يدوياً', 'wizard:worker:ai_skip').row();
    if (hasBack) {
      kb.text('◀️ السابق', 'wizard:worker:back');
    }
    kb.text('❌ إلغاء', 'wizard:worker:cancel');
    return kb;
  }

  static nicknameSuggestionKeyboard(firstTwo: string): InlineKeyboard {
    return new InlineKeyboard()
      .text(`✨ اعتماد: ${firstTwo}`, `wizard:worker:pick_nick:${firstTwo}`)
      .row()
      .text('◀️ السابق', 'wizard:worker:back')
      .text('❌ إلغاء', 'wizard:worker:cancel');
  }

  static payoutMethodKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('💵 نقدي بالموقع الميداني', 'wizard:worker:payout:CASH_SITE')
      .row()
      .text('📱 فودافون كاش / محفظة إلكترونية', 'wizard:worker:payout:VODAFONE_CASH')
      .row()
      .text('⚡ إنستاباي (InstaPay)', 'wizard:worker:payout:INSTAPAY')
      .row()
      .text('🏦 تحويل بنكي رسمي', 'wizard:worker:payout:BANK_ACCOUNT')
      .row()
      .text('◀️ السابق', 'wizard:worker:back')
      .text('❌ إلغاء', 'wizard:worker:cancel');
  }

  static optionsGridKeyboard(
    options: WorkerLookupOption[],
    prefix: string,
    page = 1,
    pageSize = 6
  ): InlineKeyboard {
    const kb = new InlineKeyboard();
    const totalPages = Math.ceil(options.length / pageSize) || 1;
    const start = (page - 1) * pageSize;
    const paged = options.slice(start, start + pageSize);

    for (let i = 0; i < paged.length; i += 2) {
      const opt1 = paged[i];
      const opt2 = paged[i + 1];
      if (opt1) {
        kb.text(opt1.name, `wizard:worker:${prefix}:${opt1.id}`);
      }
      if (opt2) {
        kb.text(opt2.name, `wizard:worker:${prefix}:${opt2.id}`);
      }
      kb.row();
    }

    if (totalPages > 1) {
      const navRow: { text: string; data: string }[] = [];
      if (page > 1) {
        navRow.push({ text: '◀️ السابق', data: `wizard:worker:${prefix}_page:${page - 1}` });
      }
      navRow.push({ text: `${page} / ${totalPages}`, data: 'noop' });
      if (page < totalPages) {
        navRow.push({ text: 'التالي ▶️', data: `wizard:worker:${prefix}_page:${page + 1}` });
      }
      navRow.forEach((b) => kb.text(b.text, b.data));
      kb.row();
    }

    kb.text('◀️ السابق', 'wizard:worker:back').text('❌ إلغاء', 'wizard:worker:cancel');
    return kb;
  }

  static simpleChoiceKeyboard(choices: { label: string; value: string }[], prefix: string): InlineKeyboard {
    const kb = new InlineKeyboard();
    for (const c of choices) {
      kb.text(c.label, `wizard:worker:${prefix}:${c.value}`).row();
    }
    kb.text('◀️ السابق', 'wizard:worker:back').text('❌ إلغاء', 'wizard:worker:cancel');
    return kb;
  }

  static confirmationKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('✅ تأكيد وحفظ ملف العامل', 'wizard:worker:confirm')
      .row()
      .text('◀️ رجوع لتعديل البيانات', 'wizard:worker:back')
      .row()
      .text('❌ إلغاء العملية بالكامل', 'wizard:worker:cancel');
  }

  static completionKeyboard(welcomeWhatsAppUrl: string): InlineKeyboard {
    return buildCompletionKeyboard({
      whatsappUrl: welcomeWhatsAppUrl,
      whatsappButtonText: '📲 إرسال دعوة الانضمام للعامل عبر واتساب',
      repeatButtonText: '➕ تسجيل عامل آخر',
      repeatCallbackData: 'action:worker:add_single',
      sectionButtonText: '🔙 العودة لشؤون العاملين',
      sectionCallbackData: 'menu:hr_sub:onboarding',
      mainMenuCallbackData: 'action:main_menu',
    });
  }

  static interactiveErrorKeyboard(retryStep: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('🔄 إعادة إدخال القيمة', `wizard:worker:retry:${retryStep}`)
      .row()
      .text('◀️ رجوع للخطوة السابقة', 'wizard:worker:back')
      .row()
      .text('❌ إلغاء العملية', 'wizard:worker:cancel')
      .text('🏠 القائمة الرئيسية', 'action:main_menu');
  }
}
