import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import { workerService } from '../services/worker.service.js';
import {
  setPendingWorkerWizard,
  getPendingWorkerWizard,
  clearPendingWorkerWizard,
  clearPendingWorkerExcelUpload,
  PendingWorkerWizardState,
} from '../redis.js';
import {
  formatCurrency,
  formatDate,
  normalizeDigits,
  extractFirstTwoNames,
} from '@alsaada/regional-engine';

export enum WorkerWizardStep {
  FULL_NAME = 'FULL_NAME',
  NICKNAME = 'NICKNAME',
  PHONE = 'PHONE',
  PAYOUT_TRANSFER_CHOICE = 'PAYOUT_TRANSFER_CHOICE',
  CUSTOM_WALLET_INPUT = 'CUSTOM_WALLET_INPUT',
  PAYOUT_METHOD_CHOICE = 'PAYOUT_METHOD_CHOICE',
  ID_TYPE = 'ID_TYPE',
  ID_NUMBER = 'ID_NUMBER',
  PASSPORT_NATIONALITY = 'PASSPORT_NATIONALITY',
  PASSPORT_BIRTHDATE = 'PASSPORT_BIRTHDATE',
  PASSPORT_GENDER = 'PASSPORT_GENDER',
  JOB_CHOICE = 'JOB_CHOICE',
  CUSTOM_JOB_INPUT = 'CUSTOM_JOB_INPUT',
  SITE_CHOICE = 'SITE_CHOICE',
  START_DATE_CHOICE = 'START_DATE_CHOICE',
  CUSTOM_START_DATE_INPUT = 'CUSTOM_START_DATE_INPUT',
  DRIVING_LICENSE = 'DRIVING_LICENSE',
  MILITARY_STATUS = 'MILITARY_STATUS',
  EMERGENCY_PHONE = 'EMERGENCY_PHONE',
  INSURANCE_STATUS = 'INSURANCE_STATUS',
  MARITAL_STATUS = 'MARITAL_STATUS',
  ID_PHOTO_FRONT = 'ID_PHOTO_FRONT',
  ID_PHOTO_BACK = 'ID_PHOTO_BACK',
  CONFIRMATION = 'CONFIRMATION',
}

const LICENSE_MAP: Record<string, string> = {
  none: 'لا توجد رخصة',
  pvt: 'رخصة خاصة',
  '1st': 'مهنية درجة أولى',
  '2nd': 'مهنية درجة ثانية',
  '3rd': 'مهنية درجة ثالثة',
  heavy: 'رخصة تشغيل معدات ثقيلة',
};

const MIL_MAP: Record<string, string> = {
  served: 'أدى الخدمة العسكرية (قدوة حسنة)',
  final_exempt: 'إعفاء نهائي',
  temp_exempt: 'إعفاء مؤقت',
  postponed: 'تأجيل دراسي',
  not_req: 'غير مطلوب / معافى طبياً',
  not_applied: 'لم يتم التقدم للخدمة العسكرية',
};

const MARITAL_MAP: Record<string, string> = {
  single: 'أعزب',
  married: 'متزوج',
  married_dep: 'متزوج ويعول',
  divorced: 'مطلق',
  widowed: 'أرمل',
};

const INS_MAP: Record<string, string> = {
  uninsured: 'غير مؤمن عليه بجهة أخرى',
  prev_insured: 'مؤمن عليه بجهة سابقة',
  full_time_no_ins: 'متفرغ وبدون تأمين',
};

function getJobEmoji(jobTitle: string): string {
  const j = (jobTitle || '').trim();
  if (j.includes('لودر') || j.includes('بلدوزر')) return '🚜';
  if (j.includes('حفار')) return '🏗️';
  if (j.includes('قلاب') || j.includes('نقل ثقيل')) return '🚛';
  if (j.includes('سائق') || j.includes('سيارة')) return '🚗';
  if (j.includes('ميكانيكا') || j.includes('صيانة')) return '🔧';
  if (j.includes('حدادة') || j.includes('حداد')) return '⚒️';
  if (j.includes('كهرباء') || j.includes('كهربائي')) return '⚡';
  if (j.includes('طباخ') || j.includes('إعاشة')) return '👨‍🍳';
  if (j.includes('مشرف')) return '👷';
  if (j.includes('مهندس') || j.includes('مساحة')) return '📐';
  if (j.includes('محاسب') || j.includes('مالي')) return '📊';
  if (j.includes('غفير') || j.includes('أمن')) return '🛡️';
  return '🦺';
}

/**
 * 🚀 بدء معالج تسجيل عامل جديد (المرحلة 1: الاسم الرباعي)
 */
export async function handleStartAddWorker(ctx: MyContext): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  if (!ctx.from) return;

  const telegramId = BigInt(ctx.from.id);
  const initialState: PendingWorkerWizardState = {
    step: WorkerWizardStep.FULL_NAME,
    messageId: 0,
    data: {
      idType: 'NATIONAL_ID',
      nationality: 'مصر',
      payoutMethod: 'استلام نقدي بالخزينة / الموقع',
      walletType: 'نقدي / كاش',
      walletNumber: '-',
      drivingLicense: 'لا توجد رخصة',
      militaryStatus: 'أدى الخدمة العسكرية (قدوة حسنة)',
      emergencyPhone: '-',
      previousInsuranceStatus: 'غير مؤمن عليه بجهة أخرى',
      maritalStatus: 'أعزب',
      idCardFrontPath: '-',
      idCardBackPath: '-',
    },
  };

  const keyboard = new InlineKeyboard()
    .text('❌ إلغاء العملية', 'action:cancel_worker_op')
    .row()
    .text('🔙 العودة لقسم الموارد البشرية', 'menu:domain:hr');

  const text =
    '👤 *تسجيل وتعيين عامل جديد [1/19]*\n' +
    '━━━━━━━━━━━━━━━━━━━━━\n' +
    'يرجى إدخال *الاسم الرباعي* للعامل الجديد:\n\n' +
    '💡 _تلميح: سيتم اقتراح اسم الشهرة تلقائياً في الخطوة التالية مع مراعاة الأسماء المركبة._';

  let promptMsgId = 0;
  if (ctx.callbackQuery) {
    try {
      const msg = await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      promptMsgId = typeof msg === 'object' ? msg.message_id : 0;
    } catch {
      const sent = await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      promptMsgId = sent.message_id;
    }
  } else {
    const sent = await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    promptMsgId = sent.message_id;
  }

  initialState.messageId = promptMsgId;
  await setPendingWorkerWizard(telegramId, initialState);
}

/**
 * 🔄 معالجة المدخلات النصية لمعالج تسجيل العامل
 */
export async function handleWorkerWizardTextInput(ctx: MyContext): Promise<boolean> {
  if (!ctx.from || !ctx.message?.text) return false;

  const telegramId = BigInt(ctx.from.id);
  const wizard = await getPendingWorkerWizard(telegramId);
  if (!wizard) return false;

  const inputRaw = ctx.message.text.trim();
  await ctx.api.deleteMessage(ctx.chat!.id, ctx.message.message_id).catch(() => {});

  switch (wizard.step) {
    case WorkerWizardStep.FULL_NAME: {
      if (inputRaw.length < 5) {
        await ctx.reply('⚠️ الاسم قصير جداً. يرجى إدخال الاسم الرباعي كاملاً (5 أحرف على الأقل).');
        return true;
      }
      wizard.data.fullName = inputRaw;
      wizard.data.nickname = extractFirstTwoNames(inputRaw);

      wizard.step = WorkerWizardStep.NICKNAME;
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    case WorkerWizardStep.NICKNAME: {
      const autoNick = extractFirstTwoNames(wizard.data.fullName || '');
      wizard.data.nickname = (inputRaw && inputRaw !== '-' && inputRaw !== 'تخطي') ? inputRaw : autoNick;
      wizard.step = WorkerWizardStep.PHONE;
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    case WorkerWizardStep.PHONE: {
      const rawPhone = normalizeDigits(inputRaw.replace(/[\s-]/g, ''));
      if (rawPhone.length !== 11 || !rawPhone.startsWith('01')) {
        await ctx.reply('⚠️ يرجى إدخال رقم هاتف مصري صحيح مكون من 11 رقماً يبدأ بـ 01.');
        return true;
      }
      wizard.data.phone = rawPhone;
      wizard.step = WorkerWizardStep.PAYOUT_TRANSFER_CHOICE;
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    case WorkerWizardStep.CUSTOM_WALLET_INPUT: {
      const rawWallet = normalizeDigits(inputRaw.replace(/[\s-]/g, ''));
      wizard.data.walletNumber = (rawWallet && rawWallet !== '-' && rawWallet !== 'تخطي') ? rawWallet : '-';
      if (wizard.data.walletNumber === '-') {
        wizard.data.walletType = 'نقدي / كاش';
        wizard.data.payoutMethod = 'استلام نقدي بالخزينة / الموقع';
        wizard.step = WorkerWizardStep.ID_TYPE;
      } else {
        wizard.step = WorkerWizardStep.PAYOUT_METHOD_CHOICE;
      }
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    case WorkerWizardStep.ID_NUMBER: {
      const idType = wizard.data.idType || 'NATIONAL_ID';

      if (idType === 'NATIONAL_ID') {
        const val = workerService.validateIdentification('NATIONAL_ID', inputRaw);
        if (!val.isValid || !val.birthDate) {
          const retryKb = new InlineKeyboard()
            .text('◀️ السابق', 'action:worker_step:back')
            .text('❌ إلغاء العملية', 'action:cancel_worker_op');
          await ctx.reply(
            `⚠️ *الرقم القومي غير صالح:*\n${val.error || 'يرجى إدخال 14 رقماً مصرياً صحيحاً.'}`,
            { parse_mode: 'Markdown', reply_markup: retryKb }
          );
          return true;
        }

        const dup = await workerService.checkDuplicate('NATIONAL_ID', inputRaw);
        if (dup.isDuplicate && dup.existingWorker) {
          const dupKb = new InlineKeyboard()
            .text('◀️ إدخال رقم آخر', 'action:worker_step:back')
            .text('❌ إلغاء العملية', 'action:cancel_worker_op');
          await ctx.reply(
            `⚠️ *تنبيه تعارض: الرقم القومي مسجل مسبقاً!*\n` +
            `• كود العامل: \`${dup.existingWorker.code}\`\n` +
            `• الاسم: *${dup.existingWorker.name}*\n` +
            `• الوظيفة: ${dup.existingWorker.jobTitle}`,
            { parse_mode: 'Markdown', reply_markup: dupKb }
          );
          return true;
        }

        wizard.data.idNumber = normalizeDigits(inputRaw.replace(/[\s-]/g, ''));
        wizard.data.birthDateStr = val.birthDate.toISOString().substring(0, 10);
        wizard.data.age = val.age;
        wizard.data.gender = val.gender;
        wizard.data.governorateCode = val.governorateCode;
        wizard.data.governorateNameAr = val.governorateNameAr;

        wizard.step = WorkerWizardStep.JOB_CHOICE;
        await setPendingWorkerWizard(telegramId, wizard);
        await renderWizardStep(ctx, wizard);
        return true;
      } else {
        const cleanPassport = normalizeDigits(inputRaw.trim().toUpperCase().replace(/[\s-]/g, ''));
        if (cleanPassport.length < 5 || cleanPassport.length > 20) {
          await ctx.reply('⚠️ رقم جواز السفر غير صحيح (يجب أن يتراوح بين 5 و 20 حرفاً ورقماً).');
          return true;
        }

        const dup = await workerService.checkDuplicate('PASSPORT', cleanPassport);
        if (dup.isDuplicate && dup.existingWorker) {
          await ctx.reply(
            `⚠️ *تنبيه تعارض:* رقم جواز السفر مسجل مسبقاً للعامل (${dup.existingWorker.name}) بكود (\`${dup.existingWorker.code}\`).`
          );
          return true;
        }

        wizard.data.idNumber = cleanPassport;
        wizard.step = WorkerWizardStep.PASSPORT_NATIONALITY;
        await setPendingWorkerWizard(telegramId, wizard);
        await renderWizardStep(ctx, wizard);
        return true;
      }
    }

    case WorkerWizardStep.PASSPORT_NATIONALITY: {
      wizard.data.nationality = inputRaw;
      wizard.step = WorkerWizardStep.PASSPORT_BIRTHDATE;
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    case WorkerWizardStep.PASSPORT_BIRTHDATE: {
      const cleanDate = normalizeDigits(inputRaw.replace(/[\s\/.]/g, '-'));
      const parsed = new Date(cleanDate);
      if (isNaN(parsed.getTime()) || !cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        await ctx.reply('⚠️ صيغة التاريخ غير صحيحة. يرجى إدخال التاريخ بصيغة: `YYYY-MM-DD` (مثال: `1995-06-25`).', {
          parse_mode: 'Markdown',
        });
        return true;
      }

      const today = new Date();
      let age = today.getFullYear() - parsed.getFullYear();
      if (today.getMonth() < parsed.getMonth() || (today.getMonth() === parsed.getMonth() && today.getDate() < parsed.getDate())) {
        age--;
      }
      if (age < 16 || age > 75) {
        await ctx.reply('⚠️ عمر العامل يجب أن يكون بين 16 و 75 عاماً.');
        return true;
      }

      wizard.data.birthDateStr = cleanDate;
      wizard.data.age = age;
      wizard.step = WorkerWizardStep.PASSPORT_GENDER;
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    case WorkerWizardStep.CUSTOM_JOB_INPUT: {
      wizard.data.jobTitleName = inputRaw;
      wizard.step = WorkerWizardStep.SITE_CHOICE;
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    case WorkerWizardStep.CUSTOM_START_DATE_INPUT: {
      const cleanDate = normalizeDigits(inputRaw.replace(/[\s\/.]/g, '-'));
      const parsed = new Date(cleanDate);
      if (isNaN(parsed.getTime()) || !cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        await ctx.reply('⚠️ صيغة التاريخ غير صحيحة. يرجى إدخال تاريخ بصيغة `YYYY-MM-DD` (مثال: `2026-09-01`).', {
          parse_mode: 'Markdown',
        });
        return true;
      }
      wizard.data.hireDateStr = cleanDate;
      wizard.step = WorkerWizardStep.DRIVING_LICENSE;
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    case WorkerWizardStep.EMERGENCY_PHONE: {
      wizard.data.emergencyPhone = normalizeDigits(inputRaw.replace(/[\s-]/g, ''));
      wizard.step = WorkerWizardStep.INSURANCE_STATUS;
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    default:
      return false;
  }
}

/**
 * 📸 معالجة إرفاق صور البطاقة / الوثيقة
 */
export async function handleWorkerWizardPhotoInput(ctx: MyContext): Promise<boolean> {
  if (!ctx.from) return false;
  const telegramId = BigInt(ctx.from.id);
  const wizard = await getPendingWorkerWizard(telegramId);
  if (!wizard) return false;

  let fileId = '';
  if (ctx.message?.photo && ctx.message.photo.length > 0) {
    fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
  } else if (ctx.message?.document?.file_id) {
    fileId = ctx.message.document.file_id;
  }

  if (!fileId) return false;
  await ctx.api.deleteMessage(ctx.chat!.id, ctx.message!.message_id).catch(() => {});

  if (wizard.step === WorkerWizardStep.ID_PHOTO_FRONT) {
    wizard.data.idCardFrontPath = fileId;
    wizard.step = WorkerWizardStep.ID_PHOTO_BACK;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return true;
  }

  if (wizard.step === WorkerWizardStep.ID_PHOTO_BACK) {
    wizard.data.idCardBackPath = fileId;
    wizard.step = WorkerWizardStep.CONFIRMATION;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return true;
  }

  return false;
}

/**
 * 🎛️ معالجة الضغط على أزرار المعالج التفاعلية (Inline Callbacks)
 */
export async function handleWorkerWizardCallback(ctx: MyContext): Promise<void> {
  if (!ctx.callbackQuery || !ctx.from) return;
  await ctx.answerCallbackQuery().catch(() => {});

  const telegramId = BigInt(ctx.from.id);
  const wizard = await getPendingWorkerWizard(telegramId);
  const data = ctx.callbackQuery.data || '';

  if (data === 'action:cancel_worker_op') {
    await clearPendingWorkerWizard(telegramId);
    await clearPendingWorkerExcelUpload(telegramId);
    await ctx.editMessageText(
      '❌ *تم إلغاء عملية تسجيل العامل بنجاح.*\nتم إفراغ كافة البيانات المؤقتة دون أي أثر.',
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('➕ تسجيل عامل جديد', 'action:worker:add')
          .row()
          .text('🔙 العودة لقسم الموارد البشرية', 'menu:domain:hr')
          .row()
          .text('🏠 القائمة الرئيسية', 'action:main_menu'),
      }
    );
    return;
  }

  if (!wizard) return;

  if (data === 'action:worker_step:back') {
    await handleStepBack(ctx, wizard, telegramId);
    return;
  }

  if (data === 'action:worker_step:nick_auto') {
    const autoNick = extractFirstTwoNames(wizard.data.fullName || '');
    wizard.data.nickname = autoNick;
    wizard.step = WorkerWizardStep.PHONE;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data.startsWith('action:worker_tr:')) {
    const choice = data.replace('action:worker_tr:', '');
    if (choice === 'same') {
      wizard.data.walletNumber = wizard.data.phone;
      wizard.step = WorkerWizardStep.PAYOUT_METHOD_CHOICE;
    } else if (choice === 'custom') {
      wizard.step = WorkerWizardStep.CUSTOM_WALLET_INPUT;
    } else {
      wizard.data.walletNumber = '-';
      wizard.data.walletType = 'نقدي / كاش';
      wizard.data.payoutMethod = 'استلام نقدي بالخزينة / الموقع';
      wizard.step = WorkerWizardStep.ID_TYPE;
    }
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data.startsWith('action:worker_trm:')) {
    const trm = data.replace('action:worker_trm:', '');
    if (trm === 'wallet') {
      wizard.data.walletType = 'محفظة إلكترونية';
      wizard.data.payoutMethod = 'محفظة فودافون كاش';
    } else if (trm === 'insta') {
      wizard.data.walletType = 'تحويل بنكي / إنستاباي';
      wizard.data.payoutMethod = 'إنستاباي (InstaPay) / تحويل بنكي';
    } else {
      wizard.data.walletType = 'نقدي / كاش';
      wizard.data.payoutMethod = 'استلام نقدي بالخزينة / الموقع';
    }
    wizard.step = WorkerWizardStep.ID_TYPE;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data.startsWith('action:worker_id_type:')) {
    const type = data.replace('action:worker_id_type:', '') as 'NATIONAL_ID' | 'PASSPORT';
    wizard.data.idType = type;
    wizard.step = WorkerWizardStep.ID_NUMBER;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data.startsWith('action:worker_nat:')) {
    const nat = data.replace('action:worker_nat:', '');
    if (nat === 'custom') {
      await ctx.editMessageText('🌍 *أدخل جنسية العامل كتابةً:*', {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().text('◀️ السابق', 'action:worker_step:back'),
      });
      return;
    }
    wizard.data.nationality = nat;
    wizard.step = WorkerWizardStep.PASSPORT_BIRTHDATE;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data.startsWith('action:worker_gender:')) {
    const g = data.replace('action:worker_gender:', '') as 'MALE' | 'FEMALE';
    wizard.data.gender = g;
    wizard.step = WorkerWizardStep.JOB_CHOICE;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data.startsWith('action:worker_job:')) {
    const jobId = data.replace('action:worker_job:', '');
    if (jobId === 'custom') {
      wizard.step = WorkerWizardStep.CUSTOM_JOB_INPUT;
    } else {
      const job = await prisma.jobTitle.findUnique({
        where: { id: jobId },
        include: { department: true },
      });
      if (job) {
        wizard.data.jobTitleId = job.id;
        wizard.data.jobTitleName = job.name;
        wizard.data.departmentId = job.departmentId;
        wizard.data.departmentCode = job.department.code;
        wizard.data.jobCode = job.code;
        wizard.data.baseSalary = Number(job.baseSalary);
        wizard.data.additionalSalary = Number(job.additionalSalary);
        wizard.data.shiftSystem = `${job.workDays} يوم عمل / ${job.restDays} راحة`;
      }
      wizard.step = WorkerWizardStep.SITE_CHOICE;
    }
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data.startsWith('action:worker_site:')) {
    const siteId = data.replace('action:worker_site:', '');
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (site) {
      wizard.data.siteId = site.id;
      wizard.data.siteName = site.name;
    }
    wizard.step = WorkerWizardStep.START_DATE_CHOICE;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data.startsWith('action:worker_sdate:')) {
    const sDate = data.replace('action:worker_sdate:', '');
    if (sDate === 'custom') {
      wizard.step = WorkerWizardStep.CUSTOM_START_DATE_INPUT;
    } else {
      wizard.data.hireDateStr = sDate;
      wizard.step = WorkerWizardStep.DRIVING_LICENSE;
    }
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data.startsWith('action:worker_lic:')) {
    const licKey = data.replace('action:worker_lic:', '');
    wizard.data.drivingLicense = LICENSE_MAP[licKey] || 'لا توجد رخصة';
    wizard.step = WorkerWizardStep.MILITARY_STATUS;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data.startsWith('action:worker_mil:')) {
    const milKey = data.replace('action:worker_mil:', '');
    wizard.data.militaryStatus = MIL_MAP[milKey] || 'أدى الخدمة العسكرية (قدوة حسنة)';
    wizard.step = WorkerWizardStep.EMERGENCY_PHONE;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data === 'action:worker_step:skip_emergency') {
    wizard.data.emergencyPhone = '-';
    wizard.step = WorkerWizardStep.INSURANCE_STATUS;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data.startsWith('action:worker_ins:')) {
    const insKey = data.replace('action:worker_ins:', '');
    wizard.data.previousInsuranceStatus = INS_MAP[insKey] || 'غير مؤمن عليه بجهة أخرى';
    wizard.step = WorkerWizardStep.MARITAL_STATUS;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data.startsWith('action:worker_mar:')) {
    const marKey = data.replace('action:worker_mar:', '');
    wizard.data.maritalStatus = MARITAL_MAP[marKey] || 'أعزب';
    wizard.step = WorkerWizardStep.ID_PHOTO_FRONT;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data === 'action:worker_photo:skip_front') {
    wizard.data.idCardFrontPath = '-';
    wizard.data.idCardBackPath = '-';
    wizard.step = WorkerWizardStep.CONFIRMATION;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data === 'action:worker_photo:skip_back') {
    wizard.data.idCardBackPath = '-';
    wizard.step = WorkerWizardStep.CONFIRMATION;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data === 'action:worker_step:confirm') {
    await handleWorkerFinalSave(ctx, wizard, telegramId);
    return;
  }
}

async function handleStepBack(
  ctx: MyContext,
  wizard: PendingWorkerWizardState,
  telegramId: bigint
): Promise<void> {
  switch (wizard.step) {
    case WorkerWizardStep.NICKNAME:
      wizard.step = WorkerWizardStep.FULL_NAME;
      break;
    case WorkerWizardStep.PHONE:
      wizard.step = WorkerWizardStep.NICKNAME;
      break;
    case WorkerWizardStep.PAYOUT_TRANSFER_CHOICE:
      wizard.step = WorkerWizardStep.PHONE;
      break;
    case WorkerWizardStep.CUSTOM_WALLET_INPUT:
      wizard.step = WorkerWizardStep.PAYOUT_TRANSFER_CHOICE;
      break;
    case WorkerWizardStep.PAYOUT_METHOD_CHOICE:
      wizard.step = WorkerWizardStep.CUSTOM_WALLET_INPUT;
      break;
    case WorkerWizardStep.ID_TYPE:
      wizard.step = WorkerWizardStep.PAYOUT_TRANSFER_CHOICE;
      break;
    case WorkerWizardStep.ID_NUMBER:
      wizard.step = WorkerWizardStep.ID_TYPE;
      break;
    case WorkerWizardStep.PASSPORT_NATIONALITY:
      wizard.step = WorkerWizardStep.ID_NUMBER;
      break;
    case WorkerWizardStep.PASSPORT_BIRTHDATE:
      wizard.step = WorkerWizardStep.PASSPORT_NATIONALITY;
      break;
    case WorkerWizardStep.PASSPORT_GENDER:
      wizard.step = WorkerWizardStep.PASSPORT_BIRTHDATE;
      break;
    case WorkerWizardStep.JOB_CHOICE:
      wizard.step = wizard.data.idType === 'PASSPORT' ? WorkerWizardStep.PASSPORT_GENDER : WorkerWizardStep.ID_NUMBER;
      break;
    case WorkerWizardStep.CUSTOM_JOB_INPUT:
      wizard.step = WorkerWizardStep.JOB_CHOICE;
      break;
    case WorkerWizardStep.SITE_CHOICE:
      wizard.step = WorkerWizardStep.JOB_CHOICE;
      break;
    case WorkerWizardStep.START_DATE_CHOICE:
      wizard.step = WorkerWizardStep.SITE_CHOICE;
      break;
    case WorkerWizardStep.CUSTOM_START_DATE_INPUT:
      wizard.step = WorkerWizardStep.START_DATE_CHOICE;
      break;
    case WorkerWizardStep.DRIVING_LICENSE:
      wizard.step = WorkerWizardStep.START_DATE_CHOICE;
      break;
    case WorkerWizardStep.MILITARY_STATUS:
      wizard.step = WorkerWizardStep.DRIVING_LICENSE;
      break;
    case WorkerWizardStep.EMERGENCY_PHONE:
      wizard.step = WorkerWizardStep.MILITARY_STATUS;
      break;
    case WorkerWizardStep.INSURANCE_STATUS:
      wizard.step = WorkerWizardStep.EMERGENCY_PHONE;
      break;
    case WorkerWizardStep.MARITAL_STATUS:
      wizard.step = WorkerWizardStep.INSURANCE_STATUS;
      break;
    case WorkerWizardStep.ID_PHOTO_FRONT:
      wizard.step = WorkerWizardStep.MARITAL_STATUS;
      break;
    case WorkerWizardStep.ID_PHOTO_BACK:
      wizard.step = WorkerWizardStep.ID_PHOTO_FRONT;
      break;
    case WorkerWizardStep.CONFIRMATION:
      wizard.step = wizard.data.idCardFrontPath !== '-' ? WorkerWizardStep.ID_PHOTO_BACK : WorkerWizardStep.ID_PHOTO_FRONT;
      break;
    default:
      wizard.step = WorkerWizardStep.FULL_NAME;
  }

  await setPendingWorkerWizard(telegramId, wizard);
  await renderWizardStep(ctx, wizard);
}

async function renderWizardStep(ctx: MyContext, wizard: PendingWorkerWizardState): Promise<void> {
  const keyboard = new InlineKeyboard();
  let text = '';

  switch (wizard.step) {
    case WorkerWizardStep.FULL_NAME: {
      text =
        '👤 *تسجيل وتعيين عامل جديد [1/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'يرجى إدخال *الاسم الرباعي* للعامل:\n\n' +
        '💡 _مثال: محمد أحمد إبراهيم علي_';
      keyboard.text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.NICKNAME: {
      const autoNick = extractFirstTwoNames(wizard.data.fullName || '');
      text =
        '👤 *اسم الشهرة بالموقع [2/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        `أدخل اسم الشهرة للعامل (أو اضغط اعتماد تلقائي لاستخدام: *${autoNick}*):\n\n` +
        '🏷️ _ملاحظة هامة: اسم الشهرة هو الاسم المعتمد لظهور العامل في قوائم التمام والسلف والعمليات الميدانية._';

      keyboard
        .text(`⏭️ اعتماد تلقائي (${autoNick})`, 'action:worker_step:nick_auto')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.PHONE: {
      text =
        '📱 *رقم الهاتف المحمول والواتساب [3/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'أدخل رقم الهاتف الشخصي للعامل (11 رقماً مصرياً):\n\n' +
        '💡 _مثال: 01012345678 أو 01155443322_';
      keyboard.text('◀️ السابق', 'action:worker_step:back').text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.PAYOUT_TRANSFER_CHOICE: {
      text =
        '💳 *بيانات تحويل الراتب والمستحقات [4/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        `هل رقم تحويل المستحقات هو نفس رقم الهاتف الشخصي (\`${wizard.data.phone}\`)؟`;
      keyboard
        .text(`📱 نعم، نفس الرقم (${wizard.data.phone})`, 'action:worker_tr:same')
        .row()
        .text('💳 لا، رقم تحويل / محفظة آخر', 'action:worker_tr:custom')
        .row()
        .text('⏭️ استلام نقدي بالخزينة (كاش)', 'action:worker_tr:cash')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.CUSTOM_WALLET_INPUT: {
      text =
        '💳 *رقم المحفظة أو حساب التحويل [4/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'أدخل رقم هاتف المحفظة (11 رقماً) أو عنوان إنستاباي المعتمد:';
      keyboard
        .text('⏭️ تخطي (استلام نقدي كاش)', 'action:worker_tr:cash')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.PAYOUT_METHOD_CHOICE: {
      text =
        '💳 *طريقة ونوع قناة التحويل [4/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        `الرقم المسجل للتحويل: \`${wizard.data.walletNumber}\`\n` +
        'اختر وسيلة الاستلام المفضلة للعامل:';
      keyboard
        .text('📱 محفظة فودافون كاش', 'action:worker_trm:wallet')
        .row()
        .text('⚡ إنستاباي (InstaPay) / تحويل بنكي', 'action:worker_trm:insta')
        .row()
        .text('💵 استلام نقدي بالخزينة / الموقع', 'action:worker_trm:cash')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.ID_TYPE: {
      text =
        '🔢 *وثيقة إثبات الشخصية [5/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'اختر نوع وثيقة إثبات الشخصية للعامل:';
      keyboard
        .text('🇪🇬 بطاقة الرقم القومي المصرية', 'action:worker_id_type:NATIONAL_ID')
        .row()
        .text('🌐 جواز سفر (للوافدين وغير المصريين)', 'action:worker_id_type:PASSPORT')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.ID_NUMBER: {
      if (wizard.data.idType === 'NATIONAL_ID') {
        text =
          '🔢 *الرقم القومي المصري [5/19]*\n' +
          '━━━━━━━━━━━━━━━━━━━━━\n' +
          'أدخل الرقم القومي للعامل (14 رقماً مصرياً):\n\n' +
          '💡 _سيتم فحص المحافظة وتاريخ الميلاد والعمر تلقائياً._';
      } else {
        text =
          '🌐 *رقم جواز السفر [5/19]*\n' +
          '━━━━━━━━━━━━━━━━━━━━━\n' +
          'أدخل رقم جواز السفر للوافد:\n\n' +
          '💡 _مثال: P10492837 أو A8920194_';
      }
      keyboard.text('◀️ السابق', 'action:worker_step:back').text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.PASSPORT_NATIONALITY: {
      text =
        '🌍 *جنسية العامل الوافد [5.1/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'اختر الجنسية المعتمدة أو اضغط كتابة دولة أخرى:';
      keyboard
        .text('🇸🇩 السودان', 'action:worker_nat:السودان')
        .text('🇸🇾 سوريا', 'action:worker_nat:سوريا')
        .row()
        .text('🇹🇩 تشاد', 'action:worker_nat:تشاد')
        .text('🇾🇪 اليمن', 'action:worker_nat:اليمن')
        .row()
        .text('✍️ كتابة دولة أخرى', 'action:worker_nat:custom')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.PASSPORT_BIRTHDATE: {
      text =
        '🎂 *تاريخ الميلاد (جواز السفر) [5.2/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'أدخل تاريخ ميلاد العامل بصيغة:\n' +
        '`YYYY-MM-DD` (مثال: `1994-08-15`)';
      keyboard.text('◀️ السابق', 'action:worker_step:back').text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.PASSPORT_GENDER: {
      text =
        '👤 *تحديد النوع / الجنس [5.3/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'اختر نوع العامل:';
      keyboard
        .text('👨 ذكر', 'action:worker_gender:MALE')
        .text('👩 أنثى', 'action:worker_gender:FEMALE')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.JOB_CHOICE: {
      text =
        '💼 *المسمى الوظيفي المعتمد [6/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'اختر الوظيفة المقيد عليها العامل:';

      const jobs = await prisma.jobTitle.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
      });

      jobs.forEach((job, i) => {
        const icon = getJobEmoji(job.name);
        keyboard.text(`${icon} ${job.name}`, `action:worker_job:${job.id}`);
        if (i % 2 === 1) keyboard.row();
      });
      if (jobs.length % 2 !== 0) keyboard.row();

      keyboard.text('✍️ ...مسمى وظيفي آخر', 'action:worker_job:custom').row();
      keyboard.text('◀️ السابق', 'action:worker_step:back').text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.CUSTOM_JOB_INPUT: {
      text = '✍️ *أدخل المسمى الوظيفي المخصص بالتفصيل:*';
      keyboard.text('◀️ السابق', 'action:worker_step:back').text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.SITE_CHOICE: {
      text =
        '📍 *موقع ومشروع العمل [7/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'اختر موقع التسكين والتشغيل المبدئي:';

      const sites = await prisma.site.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { code: 'asc' },
      });

      sites.forEach((site, i) => {
        keyboard.text(`📍 ${site.name}`, `action:worker_site:${site.id}`);
        if (i % 2 === 1) keyboard.row();
      });
      if (sites.length % 2 !== 0) keyboard.row();

      keyboard.text('◀️ السابق', 'action:worker_step:back').text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.START_DATE_CHOICE: {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const dayBefore = new Date(today.getTime() - 48 * 60 * 60 * 1000);

      const todayStr = today.toISOString().substring(0, 10);
      const yesterdayStr = yesterday.toISOString().substring(0, 10);
      const dayBeforeStr = dayBefore.toISOString().substring(0, 10);

      text =
        '📅 *تاريخ بدء ومباشرة العمل [8/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'حدد تاريخ المباشرة الفعلي للعامل:';

      keyboard
        .text(`📅 اليوم (${todayStr})`, `action:worker_sdate:${todayStr}`)
        .row()
        .text(`📅 أمس (${yesterdayStr})`, `action:worker_sdate:${yesterdayStr}`)
        .row()
        .text(`📅 أول أمس (${dayBeforeStr})`, `action:worker_sdate:${dayBeforeStr}`)
        .row()
        .text('✍️ كتابة تاريخ مخصص (YYYY-MM-DD)', 'action:worker_sdate:custom')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.CUSTOM_START_DATE_INPUT: {
      text =
        '✍️ *أدخل تاريخ بدء العمل بصيغة:*\n' +
        '`YYYY-MM-DD` (مثال: `2026-09-01`)';
      keyboard.text('◀️ السابق', 'action:worker_step:back').text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.DRIVING_LICENSE: {
      text =
        '🚗 *موقف ونوع رخصة القيادة [9/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'اختر نوع الرخصة المتاحة للعامل:';
      keyboard
        .text('🚫 لا توجد رخصة قيادة', 'action:worker_lic:none')
        .row()
        .text('🚗 رخصة خاصة', 'action:worker_lic:pvt')
        .row()
        .text('🚛 مهنية درجة أولى', 'action:worker_lic:1st')
        .row()
        .text('🚚 مهنية درجة ثانية', 'action:worker_lic:2nd')
        .row()
        .text('🚐 مهنية درجة ثالثة', 'action:worker_lic:3rd')
        .row()
        .text('🚜 رخصة تشغيل معدات ثقيلة', 'action:worker_lic:heavy')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.MILITARY_STATUS: {
      text =
        '🎖️ *الموقف من الخدمة العسكرية والتجنيد [10/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'اختر الموقف التجنيدي للعامل:';
      keyboard
        .text('🎖️ أدى الخدمة العسكرية (قدوة حسنة)', 'action:worker_mil:served')
        .row()
        .text('🛡️ إعفاء نهائي', 'action:worker_mil:final_exempt')
        .row()
        .text('⏳ إعفاء مؤقت', 'action:worker_mil:temp_exempt')
        .row()
        .text('📑 تأجيل دراسي', 'action:worker_mil:postponed')
        .row()
        .text('🚫 غير مطلوب / معافى طبياً', 'action:worker_mil:not_req')
        .row()
        .text('⚪ لم يتم التقدم للخدمة العسكرية', 'action:worker_mil:not_applied')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.EMERGENCY_PHONE: {
      text =
        '🚨 *هاتف الطوارئ (Emergency Contact) [11/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'أدخل رقم هاتف شخص من أقارب العامل (أب / أخ / زوجة / قريب):\n\n' +
        '💡 _يمكنك الضغط على زر التخطي للمتابعة فوراً._';
      keyboard
        .text('⏭️ تخطي إدخال هاتف الطوارئ', 'action:worker_step:skip_emergency')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.INSURANCE_STATUS: {
      text =
        '🛡️ *الموقف التأميني السابق للعامل [12/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'اختر موقف العامل التأميني بجهة العمل السابقة:';
      keyboard
        .text('⚪ غير مؤمن عليه بجهة أخرى', 'action:worker_ins:uninsured')
        .row()
        .text('🟢 مؤمن عليه بجهة سابقة', 'action:worker_ins:prev_insured')
        .row()
        .text('🔴 متفرغ تماماً وبدون تأمين', 'action:worker_ins:full_time_no_ins')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.MARITAL_STATUS: {
      text =
        '💍 *الحالة الاجتماعية للعامل [13/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'اختر الحالة الاجتماعية للعامل:';
      keyboard
        .text('💍 أعزب', 'action:worker_mar:single')
        .row()
        .text('💍 متزوج', 'action:worker_mar:married')
        .row()
        .text('👨‍👩‍👧‍👦 متزوج ويعول', 'action:worker_mar:married_dep')
        .row()
        .text('💍 مطلق', 'action:worker_mar:divorced')
        .row()
        .text('💍 أرمل', 'action:worker_mar:widowed')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.ID_PHOTO_FRONT: {
      text =
        '📸 *[1/2] إرفاق صورة وجه البطاقة / الوثيقة [14/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'أرسل صورة وجه بطاقة الرقم القومي أو جواز السفر:\n\n' +
        '💡 _الإرفاق اختياري، يمكنك الضغط على زر التخطي للاستكمال._';
      keyboard
        .text('⏭️ تخطي إرفاق الصورة', 'action:worker_photo:skip_front')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.ID_PHOTO_BACK: {
      text =
        '📸 *[2/2] إرفاق صورة ظهر البطاقة [15/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'أرسل صورة ظهر بطاقة الرقم القومي:\n\n' +
        '💡 _الإرفاق اختياري، يمكنك الضغط على زر التخطي للاستكمال._';
      keyboard
        .text('⏭️ تخطي إرفاق ظهر البطاقة', 'action:worker_photo:skip_back')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.CONFIRMATION: {
      const autoCode = await workerService.generateNextWorkerCode(
        wizard.data.departmentCode || 'OP',
        wizard.data.jobCode || 'DRV'
      );
      wizard.data.generatedCode = autoCode;

      const jobIcon = getJobEmoji(wizard.data.jobTitleName || '');
      const totalSalary = (wizard.data.baseSalary || 0) + (wizard.data.additionalSalary || 0);

      const photoStatus =
        wizard.data.idCardFrontPath !== '-' && wizard.data.idCardBackPath !== '-'
          ? '✅ تم إرفاق الوجه والظهر'
          : wizard.data.idCardFrontPath !== '-'
          ? '🟡 تم إرفاق الوجه فقط'
          : '⚪ لم تُرفق صور (ملف قيد الاستيفاء)';

      text =
        '📋 *مراجعة بيانات تعيين العامل الجديد [19/19]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        `🆔 *كود العامل المعتمد:* \`${autoCode}\`\n` +
        `👤 *الاسم الرباعي:* *${wizard.data.fullName}*\n` +
        `🏷️ *اسم الشهرة المعتمد للقوائم:* *${wizard.data.nickname}*\n` +
        `🔢 *رقم الإثبات:* \`${wizard.data.idNumber}\` (${wizard.data.idType === 'NATIONAL_ID' ? 'رقم قومي مصري' : `جواز سفر - ${wizard.data.nationality}`})\n` +
        `🎂 *تاريخ الميلاد والسن:* ${wizard.data.birthDateStr || '-'} (${wizard.data.age || '-'} سنة)\n` +
        (wizard.data.governorateNameAr ? `📍 *المحافظة:* ${wizard.data.governorateNameAr}\n` : '') +
        `${jobIcon} *الوظيفة:* ${wizard.data.jobTitleName} | 📍 *الموقع:* ${wizard.data.siteName}\n` +
        `💰 *الراتب المعتمد:* *${formatCurrency(totalSalary)}* (أساسي: ${formatCurrency(wizard.data.baseSalary || 0)} + حافز: ${formatCurrency(wizard.data.additionalSalary || 0)})\n` +
        `⏳ *نظام التشغيل:* ${wizard.data.shiftSystem || '20 يوم عمل / 10 راحة'}\n` +
        `📅 *تاريخ بدء العمل:* *${wizard.data.hireDateStr || formatDate(new Date())}*\n` +
        `📱 *الهاتف والواتساب:* \`${wizard.data.phone}\`\n` +
        `🚨 *هاتف الطوارئ:* \`${wizard.data.emergencyPhone || '-'}\`\n` +
        `💳 *تحويل المستحقات:* \`${wizard.data.walletNumber || '-'}\` (${wizard.data.walletType || 'نقدي'})\n` +
        `🚗 *رخصة القيادة:* ${wizard.data.drivingLicense || 'لا توجد'}\n` +
        `🎖️ *الموقف التجنيدي:* ${wizard.data.militaryStatus || '-'}\n` +
        `🛡️ *التأمين السابق:* ${wizard.data.previousInsuranceStatus || '-'}\n` +
        `💍 *الحالة الاجتماعية:* ${wizard.data.maritalStatus || '-'}\n` +
        `📂 *موقف صور البطاقة:* ${photoStatus}\n` +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        '_⚡ سيتم قيد العامل تلقائياً بهيكل الشركة وتحديث القوائم الميدانية اللحظية._';

      keyboard
        .text('✅ تأكيد وحفظ التعيين الرسمي', 'action:worker_step:confirm')
        .row()
        .text('◀️ الخطوة السابقة للتعديل', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }
  }

  try {
    if (wizard.messageId && ctx.chat) {
      await ctx.api.editMessageText(ctx.chat.id, wizard.messageId, text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } else {
      const sent = await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      wizard.messageId = sent.message_id;
    }
  } catch {
    const sent = await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    wizard.messageId = sent.message_id;
  }
}

async function handleWorkerFinalSave(
  ctx: MyContext,
  wizard: PendingWorkerWizardState,
  telegramId: bigint
): Promise<void> {
  const d = wizard.data;

  try {
    const created = await workerService.createWorker({
      name: d.fullName || '',
      nickname: d.nickname,
      idType: d.idType || 'NATIONAL_ID',
      idNumber: d.idNumber || '',
      nationality: d.nationality || (d.idType === 'NATIONAL_ID' ? 'مصر' : 'وافد'),
      birthDate: d.birthDateStr ? new Date(d.birthDateStr) : undefined,
      gender: d.gender,
      governorateCode: d.governorateCode,
      phone: d.phone || '',
      jobTitleId: d.jobTitleId,
      jobTitleName: d.jobTitleName || 'سائق سيارة',
      departmentId: d.departmentId,
      siteId: d.siteId,
      siteName: d.siteName,
      hireDate: d.hireDateStr ? new Date(d.hireDateStr) : new Date(),
      shiftSystem: d.shiftSystem || '20_WORK_10_REST',
      dailyWage: (d.baseSalary || 0) > 0 ? (d.baseSalary || 0) / 30 : 0,
      basicSalary: d.baseSalary || 0,
      fixedAllowances: d.additionalSalary || 0,
      paymentMethod: d.payoutMethod || 'CASH_SITE',
      walletType: d.walletType,
      accountNumber: d.walletNumber,
      drivingLicense: d.drivingLicense,
      militaryStatus: d.militaryStatus,
      emergencyPhone: d.emergencyPhone,
      previousInsuranceStatus: d.previousInsuranceStatus,
      maritalStatus: d.maritalStatus,
      idCardFrontPath: d.idCardFrontPath,
      idCardBackPath: d.idCardBackPath,
    });

    await clearPendingWorkerWizard(telegramId);

    const completionKb = new InlineKeyboard()
      .url('📲 إرسال إشعار التعيين للعامل عبر واتساب', created.welcomeWhatsAppUrl)
      .row()
      .text('➕ تسجيل وتعيين عامل آخر', 'action:worker:add')
      .row()
      .text('🔙 العودة لقسم الموارد البشرية', 'menu:domain:hr')
      .row()
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    const jobIcon = getJobEmoji(created.worker.jobTitle);
    const successText =
      `🎉 *تم تسجيل وتعيين العامل بنجاح 100%!*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🆔 *كود العامل الرسمي:* \`${created.worker.code}\`\n` +
      `👤 *الاسم الرباعي:* *${created.worker.name}*\n` +
      `🏷️ *اسم الشهرة المعتمد للقوائم:* *${created.worker.nickname || d.nickname}*\n` +
      `${jobIcon} *الوظيفة:* ${created.worker.jobTitle} | 📍 *الموقع:* ${d.siteName || 'الموقع العام'}\n` +
      `📅 *تاريخ المباشرة:* ${formatDate(created.worker.hireDate)}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ *ما تم إنجازه آلياً:*\n` +
      `1. قيد العامل بقاعدة بيانات المنظومة وتشفير بياناته الشخصية والبنكية بنكياً.\n` +
      `2. تعميد اسم الشهرة كاسم العرض الأساسي في قوائم التمام والسلف والعمليات.\n` +
      `3. تحديث الكاش اللحظي L1/L2 وإتاحة العامل بكافة البوابات.\n` +
      `4. تجهيز رابط الترحيب الرسمي المباشر للعامل عبر واتساب.`;

    if (wizard.messageId && ctx.chat) {
      await ctx.api.editMessageText(ctx.chat.id, wizard.messageId, successText, {
        parse_mode: 'Markdown',
        reply_markup: completionKb,
      });
    } else {
      await ctx.reply(successText, { parse_mode: 'Markdown', reply_markup: completionKb });
    }
  } catch (err: any) {
    console.error('Error saving worker in wizard:', err);
    await ctx.reply(`❌ *تعذر حفظ العامل:* ${err.message || 'خطأ غير متوقع'}`, {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard()
        .text('🔄 إعادة المحاولة', 'action:worker_step:confirm')
        .row()
        .text('❌ إلغاء العملية', 'action:cancel_worker_op'),
    });
  }
}
