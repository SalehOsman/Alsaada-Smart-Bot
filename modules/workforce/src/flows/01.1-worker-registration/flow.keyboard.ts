import { InlineKeyboard } from 'grammy';
import { buildCompletionKeyboard } from '@alsaada/core-components';
import { extractFirstTwoNames } from '@alsaada/regional-engine';
import { WorkerWizardStep, type PendingWorkerWizardState, type WorkerLookupOption } from './flow.types.js';

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

  static textInputKeyboard(hasBack = true): InlineKeyboard {
    const kb = new InlineKeyboard();
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

  static payoutTransferChoiceKeyboard(phone: string): InlineKeyboard {
    return new InlineKeyboard()
      .text(`📱 نعم، نفس رقم الموبايل (${phone})`, 'wizard:worker:tr_same:yes')
      .row()
      .text('💳 لا، رقم تحويل / محفظة آخر', 'wizard:worker:tr_same:no')
      .row()
      .text('💵 استلام نقدي بالخزينة (كاش)', 'wizard:worker:tr_same:cash')
      .row()
      .text('◀️ السابق', 'wizard:worker:back')
      .text('❌ إلغاء', 'wizard:worker:cancel');
  }

  static customWalletKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
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
      .text('🏦 تحويل بنكي رسمي', 'wizard:worker:payout:BANK_TRANSFER')
      .row()
      .text('◀️ السابق', 'wizard:worker:back')
      .text('❌ إلغاء', 'wizard:worker:cancel');
  }

  static startDateKeyboard(): InlineKeyboard {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const dayBefore = new Date(today.getTime() - 48 * 60 * 60 * 1000);
    const todayStr = today.toISOString().substring(0, 10);
    const yesterdayStr = yesterday.toISOString().substring(0, 10);
    const dayBeforeStr = dayBefore.toISOString().substring(0, 10);

    return new InlineKeyboard()
      .text(`📅 اليوم (${todayStr})`, `wizard:worker:sdate:${todayStr}`)
      .row()
      .text(`📅 أمس (${yesterdayStr})`, `wizard:worker:sdate:${yesterdayStr}`)
      .row()
      .text(`📅 أول أمس (${dayBeforeStr})`, `wizard:worker:sdate:${dayBeforeStr}`)
      .row()
      .text('✍️ كتابة تاريخ مخصص (YYYY-MM-DD)', 'wizard:worker:sdate:custom')
      .row()
      .text('◀️ السابق', 'wizard:worker:back')
      .text('❌ إلغاء', 'wizard:worker:cancel');
  }

  static drivingLicenseKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('🚫 لا توجد رخصة قيادة', 'wizard:worker:lic:none')
      .row()
      .text('🚗 رخصة خاصة', 'wizard:worker:lic:pvt')
      .row()
      .text('🚛 مهنية درجة أولى', 'wizard:worker:lic:1st')
      .row()
      .text('🚚 مهنية درجة ثانية', 'wizard:worker:lic:2nd')
      .row()
      .text('🚐 مهنية درجة ثالثة', 'wizard:worker:lic:3rd')
      .row()
      .text('🚜 رخصة تشغيل معدات ثقيلة', 'wizard:worker:lic:heavy')
      .row()
      .text('⏭️ تخطي (لا توجد رخصة)', 'wizard:worker:lic:skip')
      .row()
      .text('◀️ السابق', 'wizard:worker:back')
      .text('❌ إلغاء', 'wizard:worker:cancel');
  }

  static militaryStatusKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('🎖️ أدى الخدمة العسكرية (قدوة حسنة)', 'wizard:worker:mil:served')
      .row()
      .text('🛡️ إعفاء نهائي', 'wizard:worker:mil:final_exempt')
      .row()
      .text('⏳ إعفاء مؤقت', 'wizard:worker:mil:temp_exempt')
      .row()
      .text('📑 تأجيل دراسي', 'wizard:worker:mil:postponed')
      .row()
      .text('🚫 غير مطلوب / معافى طبياً', 'wizard:worker:mil:not_req')
      .row()
      .text('⚪ لم يتم التقدم للخدمة العسكرية', 'wizard:worker:mil:not_applied')
      .row()
      .text('⏭️ تخطي (معافى / غير محدد)', 'wizard:worker:mil:skip')
      .row()
      .text('◀️ السابق', 'wizard:worker:back')
      .text('❌ إلغاء', 'wizard:worker:cancel');
  }

  static emergencyPhoneKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('⏭️ تخطي إدخال هاتف الطوارئ', 'wizard:worker:emg:skip')
      .row()
      .text('◀️ السابق', 'wizard:worker:back')
      .text('❌ إلغاء', 'wizard:worker:cancel');
  }

  static insuranceStatusKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('⚪ غير مؤمن عليه بجهة أخرى', 'wizard:worker:ins:uninsured')
      .row()
      .text('🟢 مؤمن عليه بجهة سابقة', 'wizard:worker:ins:previously_insured')
      .row()
      .text('🔴 متفرغ تماماً وبدون تأمين', 'wizard:worker:ins:fulltime_no_insurance')
      .row()
      .text('⏭️ تخطي (غير مؤمن)', 'wizard:worker:ins:skip')
      .row()
      .text('◀️ السابق', 'wizard:worker:back')
      .text('❌ إلغاء', 'wizard:worker:cancel');
  }

  static maritalStatusKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('💍 أعزب', 'wizard:worker:mar:single')
      .row()
      .text('💍 متزوج', 'wizard:worker:mar:married')
      .row()
      .text('👨‍👩‍👧‍👦 متزوج ويعول', 'wizard:worker:mar:married_children')
      .row()
      .text('💍 مطلق', 'wizard:worker:mar:divorced')
      .row()
      .text('💍 أرمل', 'wizard:worker:mar:widowed')
      .row()
      .text('⏭️ تخطي (أعزب)', 'wizard:worker:mar:skip')
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

  static cancelExitKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('➕ بدء تسجيل عامل جديد', 'action:worker:add_single')
      .row()
      .text('🔙 العودة لشؤون العاملين', 'menu:hr_sub:onboarding')
      .row()
      .text('🏠 القائمة الرئيسية', 'action:main_menu');
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

  static processingKeyboard(): InlineKeyboard {
    return new InlineKeyboard().text(
      '⏳ جارٍ قراءة وفحص البطاقة بالذكاء الاصطناعي...',
      'wizard:worker:noop'
    );
  }

  static aiConfirmationKeyboard(): InlineKeyboard {
    return new InlineKeyboard()
      .text('✅ اعتماد ومتابعة', 'wizard:worker:ai_approve')
      .row()
      .text('✏️ تعديل الاسم', 'wizard:worker:ai_edit:name')
      .text('✏️ تعديل الرقم', 'wizard:worker:ai_edit:id')
      .row()
      .text('✏️ تعديل العنوان', 'wizard:worker:ai_edit:address')
      .text('✏️ تعديل السريان', 'wizard:worker:ai_edit:expiry')
      .row()
      .text('◀️ السابق', 'wizard:worker:back')
      .text('❌ إلغاء', 'wizard:worker:cancel');
  }

  static getStepKeyboard(
    step: WorkerWizardStep,
    state: PendingWorkerWizardState,
    jobs: WorkerLookupOption[] = [],
    sites: WorkerLookupOption[] = []
  ): InlineKeyboard {
    switch (step) {
      case WorkerWizardStep.DOC_TYPE:
        return this.docTypeKeyboard();
      case WorkerWizardStep.PHOTO_FRONT:
      case WorkerWizardStep.PHOTO_BACK:
        return this.photoPromptKeyboard(true);
      case WorkerWizardStep.AI_CONFIRMATION:
        return this.aiConfirmationKeyboard();
      case WorkerWizardStep.AI_EDIT_NAME:
      case WorkerWizardStep.AI_EDIT_ID:
      case WorkerWizardStep.AI_EDIT_ADDRESS:
      case WorkerWizardStep.AI_EDIT_EXPIRY:
      case WorkerWizardStep.AI_EDIT_GOVERNORATE:
      case WorkerWizardStep.FULL_NAME:
      case WorkerWizardStep.ID_NUMBER:
      case WorkerWizardStep.PHONE:
      case WorkerWizardStep.CUSTOM_START_DATE_INPUT:
        return this.textInputKeyboard(true);
      case WorkerWizardStep.NICKNAME: {
        const nick = state.nickname || extractFirstTwoNames(state.name || '');
        return this.nicknameSuggestionKeyboard(nick);
      }
      case WorkerWizardStep.PAYOUT_TRANSFER_CHOICE:
        return this.payoutTransferChoiceKeyboard(state.phone || '');
      case WorkerWizardStep.CUSTOM_WALLET_INPUT:
        return this.customWalletKeyboard();
      case WorkerWizardStep.PAYOUT_METHOD_CHOICE:
        return this.payoutMethodKeyboard();
      case WorkerWizardStep.JOB_CHOICE:
        return this.optionsGridKeyboard(jobs, 'job');
      case WorkerWizardStep.SITE_CHOICE:
        return this.optionsGridKeyboard(sites, 'site');
      case WorkerWizardStep.START_DATE_CHOICE:
        return this.startDateKeyboard();
      case WorkerWizardStep.DRIVING_LICENSE:
        return this.drivingLicenseKeyboard();
      case WorkerWizardStep.MILITARY_STATUS:
        return this.militaryStatusKeyboard();
      case WorkerWizardStep.EMERGENCY_PHONE:
        return this.emergencyPhoneKeyboard();
      case WorkerWizardStep.INSURANCE_STATUS:
        return this.insuranceStatusKeyboard();
      case WorkerWizardStep.MARITAL_STATUS:
        return this.maritalStatusKeyboard();
      case WorkerWizardStep.CONFIRMATION:
        return this.confirmationKeyboard();
      default:
        return this.docTypeKeyboard();
    }
  }
}

