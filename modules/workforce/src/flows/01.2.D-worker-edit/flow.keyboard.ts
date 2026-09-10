import { InlineKeyboard } from 'grammy';
import { buildCompletionKeyboard } from '@alsaada/core-components';
import { FIELD_LABELS, FIELD_TO_SHORT_MAP } from './flow.validators.js';
import type { EditableWorkerField, PendingEditTicket, WorkerProfileTab, WorkerCardView } from './flow.types.js';

export const POLICY_SHORT_TO_CODE: Record<string, string> = {
  '1P': 'ONE_PACK_DAILY',
  '2P': 'TWO_PACKS_DAILY',
  'FC': 'FULL_COVERAGE',
  'NO': 'NONE',
  'CB': 'CUSTOM_BUDGET',
};

export const POLICY_CODE_TO_SHORT: Record<string, string> = {
  ONE_PACK_DAILY: '1P',
  TWO_PACKS_DAILY: '2P',
  FULL_COVERAGE: 'FC',
  NONE: 'NO',
  CUSTOM_BUDGET: 'CB',
};

export const PICKER_OPTIONS: Record<string, Array<{ label: string; value: string }>> = {
  insts: [
    { label: '🟢 مؤمن عليه', value: 'مؤمن عليه' },
    { label: '🔴 غير مؤمن عليه', value: 'غير مؤمن عليه' },
    { label: '⏳ بانتظار إنهاء الإجراءات', value: 'بانتظار إنهاء الإجراءات' },
    { label: '📜 معاش / متقاعد', value: 'معاش / متقاعد' },
  ],
  bld: [
    { label: '🩸 A+', value: 'A+' },
    { label: '🩸 A-', value: 'A-' },
    { label: '🩸 B+', value: 'B+' },
    { label: '🩸 B-', value: 'B-' },
    { label: '🩸 AB+', value: 'AB+' },
    { label: '🩸 AB-', value: 'AB-' },
    { label: '🩸 O+', value: 'O+' },
    { label: '🩸 O-', value: 'O-' },
  ],
  shft: [
    { label: '☀️ وردية نهارية (12 ساعة)', value: 'وردية نهارية (12 ساعة)' },
    { label: '🌙 وردية ليلية (12 ساعة)', value: 'وردية ليلية (12 ساعة)' },
    { label: '⏰ وردية عادية (8 ساعات)', value: 'وردية عادية (8 ساعات)' },
    { label: '🔄 تشغيل 24 ساعة (مناوبة)', value: 'تشغيل 24 ساعة (مناوبة)' },
  ],
  cntr: [
    { label: '📋 يومية حرة', value: 'يومية حرة' },
    { label: '📄 محدد المدة', value: 'محدد المدة' },
    { label: '📑 دائم / سنوي', value: 'دائم / سنوي' },
    { label: '⏳ تحت الاختبار', value: 'تحت الاختبار' },
  ],
  pmth: [
    { label: '📱 محفظة إلكترونية', value: 'محفظة إلكترونية' },
    { label: '⚡ إنستاباي (InstaPay)', value: 'إنستاباي' },
    { label: '🏦 حساب بنكي', value: 'حساب بنكي' },
    { label: '💵 نقداً بالخزينة (كاش)', value: 'نقداً بالخزينة' },
  ],
  mil: [
    { label: '🎖️ أدى الخدمة العسكرية', value: 'أدى الخدمة العسكرية' },
    { label: '🛡️ إعفاء نهائي', value: 'إعفاء نهائي' },
    { label: '⏳ إعفاء مؤقت', value: 'إعفاء مؤقت' },
    { label: '🎓 تأجيل دراسي', value: 'تأجيل دراسي' },
    { label: '⚪ غير مطلوب', value: 'غير مطلوب' },
  ],
  mar: [
    { label: '👤 أعزب', value: 'أعزب' },
    { label: '💍 متزوج', value: 'متزوج' },
    { label: '👨‍👩‍👧‍👦 متزوج ويعول', value: 'متزوج ويعول' },
  ],
  lic: [
    { label: '🚫 بدون رخصة', value: 'بدون رخصة' },
    { label: '🚗 رخصة خاصة', value: 'رخصة خاصة' },
    { label: '🚛 درجة ثالثة', value: 'درجة ثالثة' },
    { label: '🚚 درجة ثانية', value: 'درجة ثانية' },
    { label: '🚜 درجة أولى', value: 'درجة أولى' },
    { label: '🏗️ معدات ثقيلة', value: 'معدات ثقيلة' },
  ],
  ppes: [
    { label: '👟 39', value: '39' },
    { label: '👟 40', value: '40' },
    { label: '👟 41', value: '41' },
    { label: '👟 42', value: '42' },
    { label: '👟 43', value: '43' },
    { label: '👟 44', value: '44' },
    { label: '👟 45', value: '45' },
    { label: '👟 46', value: '46' },
  ],
  ppeu: [
    { label: '👕 M', value: 'M' },
    { label: '👕 L', value: 'L' },
    { label: '👕 XL', value: 'XL' },
    { label: '👕 2XL', value: '2XL' },
    { label: '👕 3XL', value: '3XL' },
    { label: '👕 4XL', value: '4XL' },
    { label: '👕 5XL', value: '5XL' },
  ],
};

export class WorkerEditKeyboards {
  static workerProfileTabsKeyboard(
    workerId: string,
    activeTab: WorkerProfileTab = 'PERSONAL',
    isSuperAdmin: boolean = false,
    workerData?: WorkerCardView
  ): InlineKeyboard {
    const kb = new InlineKeyboard();

    // Top Tab Bar
    const t1 = activeTab === 'PERSONAL' ? '👤 الشخصية 🟢' : '👤 الشخصية';
    const t2 = activeTab === 'JOB' ? '💼 الوظيفة 🟢' : '💼 الوظيفة';
    const t3 = activeTab === 'FINANCE' ? '💰 المالية 🟢' : '💰 المالية';
    const t4 = activeTab === 'DOCS' ? '📞 الاتصال 🟢' : '📞 الاتصال';

    kb.text(t1, `action:w_edit:tab:PERSONAL:${workerId}`)
      .text(t2, `action:w_edit:tab:JOB:${workerId}`)
      .row();

    if (isSuperAdmin) {
      kb.text(t3, `action:w_edit:tab:FINANCE:${workerId}`)
        .text(t4, `action:w_edit:tab:DOCS:${workerId}`)
        .row();
    } else {
      kb.text(t4, `action:w_edit:tab:DOCS:${workerId}`).row();
    }

    // Contextual Action Buttons per Tab
    if (activeTab === 'PERSONAL') {
      if (workerData?.nationalId && workerData.nationalId !== 'غير مسجل') {
        kb.copyText('📋 نسخ الرقم القومي', workerData.nationalId).row();
      }
      kb.text('✏️ الاسم الكامل', `action:w_edit:f:name:${workerId}`)
        .text('🏷️ اسم الشهرة', `action:w_edit:f:nick:${workerId}`)
        .row();
      kb.text('📅 انتهاء البطاقة', `action:w_edit:f:exp:${workerId}`)
        .text('📍 محل الإقامة', `action:w_edit:f:addr:${workerId}`)
        .row();
      kb.text('🪖 الموقف التجنيدي', `action:w_edit:pk:mil:${workerId}`)
        .text('💍 الحالة الاجتماعية', `action:w_edit:pk:mar:${workerId}`)
        .row();
      kb.text('🩸 فصيلة الدم', `action:w_edit:pk:bld:${workerId}`)
        .text('🔢 الكود الأرشيفي', `action:w_edit:f:leg:${workerId}`)
        .row();
    } else if (activeTab === 'JOB') {
      kb.text('⏱️ نظام الوردية', `action:w_edit:pk:shft:${workerId}`)
        .text('📜 نوع التعاقد', `action:w_edit:pk:cntr:${workerId}`)
        .row();
      kb.text('🚗 رخصة القيادة', `action:w_edit:pk:lic:${workerId}`)
        .text('🛏️ عنبر السكن', `action:w_edit:f:barr:${workerId}`)
        .row();
      kb.text('🚪 رقم السرير / الغرفة', `action:w_edit:f:bed:${workerId}`)
        .row();
    } else if (activeTab === 'FINANCE') {
      if (workerData?.instaPayHandle && workerData.instaPayHandle !== 'لا يوجد') {
        kb.copyText('⚡ نسخ إنستاباي', workerData.instaPayHandle);
      }
      if (workerData?.accountNumber && workerData.accountNumber !== 'غير مسجل') {
        kb.copyText('💳 نسخ المحفظة/الحساب', workerData.accountNumber);
      }
      if ((workerData?.instaPayHandle && workerData.instaPayHandle !== 'لا يوجد') || (workerData?.accountNumber && workerData.accountNumber !== 'غير مسجل')) {
        kb.row();
      }
      kb.text('🚬 تحديد مخصص السجائر المعتمد', `action:w_edit:cg_start:${workerId}`).row();
      kb.text('🛡️ الرقم التأميني', `action:w_edit:f:insno:${workerId}`)
        .text('📋 موقف التأمينات', `action:w_edit:pk:insts:${workerId}`)
        .row();
      kb.text('💳 طريقة الصرف', `action:w_edit:pk:pmth:${workerId}`)
        .text('📱 رقم المحفظة/الحساب', `action:w_edit:f:wallet:${workerId}`)
        .row();
      kb.text('👤 اسم صاحب المحفظة', `action:w_edit:f:wown:${workerId}`)
        .text('⚡ معرف إنستاباي', `action:w_edit:f:inst:${workerId}`)
        .row();
      kb.text('💰 الراتب الأساسي الشهري', `action:w_edit:f:bsal:${workerId}`)
        .text('➕ البدلات الثابتة', `action:w_edit:f:fall:${workerId}`)
        .row();
    } else if (activeTab === 'DOCS') {
      if (workerData?.phone && workerData.phone !== 'غير مسجل') {
        kb.copyText('📞 نسخ رقم الهاتف', workerData.phone).row();
      }
      kb.text('📱 رقم الهاتف والواتساب', `action:w_edit:f:phone:${workerId}`)
        .text('🆘 هاتف الطوارئ', `action:w_edit:f:emPhone:${workerId}`)
        .row();
      kb.text('👤 اسم جهة الطوارئ', `action:w_edit:f:emName:${workerId}`)
        .text('🩺 الملاحظات الطبية', `action:w_edit:f:med:${workerId}`)
        .row();
      kb.text('🥾 مقاس حذاء السيفتي', `action:w_edit:pk:ppes:${workerId}`)
        .text('👕 مقاس اليونيفورم', `action:w_edit:pk:ppeu:${workerId}`)
        .row();
    }

    kb.text('◀️ العودة لدليل العاملين', 'action:worker:directory').row();
    kb.text('🏠 القائمة الرئيسية', 'action:main_menu');
    return kb;
  }

  static cigarettePolicyKeyboard(workerId: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('🚬 علبة واحدة يومياً', `action:w_edit:cgp:1P:${workerId}`)
      .row()
      .text('🚬 علبتين يومياً', `action:w_edit:cgp:2P:${workerId}`)
      .row()
      .text('🌟 تغطية استهلاك مفتوح', `action:w_edit:cgp:FC:${workerId}`)
      .row()
      .text('🚫 بدون مخصص سجائر', `action:w_edit:cgp:NO:${workerId}`)
      .row()
      .text('💵 ميزانية شهرية محددة', `action:w_edit:cgp:CB:${workerId}`)
      .row()
      .text('◀️ رجوع لبطاقة العامل', `action:w_edit:tab:FINANCE:${workerId}`);
  }

  static cigaretteBrandKeyboard(
    workerId: string,
    items: Array<{ id: string; name: string; sellingPrice: unknown }>
  ): InlineKeyboard {
    const kb = new InlineKeyboard();
    for (let i = 0; i < items.length; i += 2) {
      const item1 = items[i];
      const item2 = items[i + 1];
      if (item1) {
        kb.text(`${item1.name} (${String(item1.sellingPrice)} ج.م)`, `action:w_edit:cgb:${i}:${workerId}`);
      }
      if (item2) {
        kb.text(`${item2.name} (${String(item2.sellingPrice)} ج.م)`, `action:w_edit:cgb:${i + 1}:${workerId}`);
      }
      kb.row();
    }
    kb.text('◀️ رجوع لاختيار السياسة', `action:w_edit:cg_start:${workerId}`).row();
    kb.text('🏠 القائمة الرئيسية', 'action:main_menu');
    return kb;
  }

  static discretePickerKeyboard(fieldShort: string, workerId: string, returnTab: WorkerProfileTab): InlineKeyboard {
    const kb = new InlineKeyboard();
    const options = PICKER_OPTIONS[fieldShort] || [];

    for (let i = 0; i < options.length; i += 2) {
      const o1 = options[i];
      const o2 = options[i + 1];
      if (o1) {
        kb.text(o1.label, `action:w_edit:pv:${fieldShort}:${i}:${workerId}`);
      }
      if (o2) {
        kb.text(o2.label, `action:w_edit:pv:${fieldShort}:${i + 1}:${workerId}`);
      }
      kb.row();
    }

    kb.text('◀️ رجوع لبطاقة العامل', `action:w_edit:tab:${returnTab}:${workerId}`).row();
    kb.text('🏠 القائمة الرئيسية', 'action:main_menu');
    return kb;
  }

  static fieldsSelectionKeyboard(workerId: string): InlineKeyboard {
    return WorkerEditKeyboards.workerProfileTabsKeyboard(workerId, 'PERSONAL');
  }

  static cancelEditKeyboard(workerId?: string, returnTab: WorkerProfileTab = 'PERSONAL'): InlineKeyboard {
    const kb = new InlineKeyboard();
    if (workerId) {
      kb.text('◀️ إلغاء والرجوع لبطاقة العامل', `action:w_edit:tab:${returnTab}:${workerId}`).row();
    } else {
      kb.text('❌ إلغاء التعديل', 'action:w_edit:cancel').row();
    }
    kb.text('🏠 القائمة الرئيسية', 'action:main_menu');
    return kb;
  }

  static ticketReviewKeyboard(ticketId: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('✅ اعتماد وتطبيق فوري', `action:w_edit:appr:${ticketId}`)
      .row()
      .text('❌ رفض الطلب', `action:w_edit:rejc:${ticketId}`)
      .row()
      .text('◀️ رجوع لقائمة الطلبات', 'action:worker_edit:pending_list')
      .row()
      .text('🏠 القائمة الرئيسية', 'action:main_menu');
  }

  static pendingTicketsListKeyboard(tickets: PendingEditTicket[]): InlineKeyboard {
    const kb = new InlineKeyboard();
    for (const t of tickets) {
      kb.text(`📝 ${t.workerName} - ${t.fieldName}`, `action:w_edit:rev:${t.requestId}`).row();
    }
    kb.text('◀️ رجوع لشؤون العاملين', 'menu:hr_sub:onboarding').row();
    kb.text('🏠 القائمة الرئيسية', 'action:main_menu');
    return kb;
  }

  static directEditSuccessKeyboard(workerId?: string, tab: WorkerProfileTab = 'PERSONAL'): InlineKeyboard {
    return buildCompletionKeyboard({
      repeatButtonText: workerId ? '✏️ متابعة تعديل هذا العامل' : '✏️ تعديل عامل آخر',
      repeatCallbackData: workerId ? `action:w_edit:tab:${tab}:${workerId}` : 'action:worker_edit:pick',
      sectionButtonText: '🔙 العودة لشؤون العاملين',
      sectionCallbackData: 'menu:hr_sub:onboarding',
      mainMenuCallbackData: 'action:main_menu',
    });
  }
}
