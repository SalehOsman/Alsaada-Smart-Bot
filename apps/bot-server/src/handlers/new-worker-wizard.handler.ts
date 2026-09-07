import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import { workerService } from '../services/worker.service.js';
import { aiVisionIdService } from '../services/ai-vision-id.service.js';
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
  DOC_TYPE = 'DOC_TYPE',
  PHOTO_FRONT = 'PHOTO_FRONT',
  PHOTO_BACK = 'PHOTO_BACK',
  AI_CONFIRMATION = 'AI_CONFIRMATION',
  AI_EDIT_NAME = 'AI_EDIT_NAME',
  AI_EDIT_ID = 'AI_EDIT_ID',
  AI_EDIT_EXPIRY = 'AI_EDIT_EXPIRY',
  FULL_NAME = 'FULL_NAME',
  ID_NUMBER = 'ID_NUMBER',
  PASSPORT_NATIONALITY = 'PASSPORT_NATIONALITY',
  PASSPORT_BIRTHDATE = 'PASSPORT_BIRTHDATE',
  PASSPORT_GENDER = 'PASSPORT_GENDER',
  MANUAL_EXPIRY = 'MANUAL_EXPIRY',
  NICKNAME = 'NICKNAME',
  PHONE = 'PHONE',
  PAYOUT_TRANSFER_CHOICE = 'PAYOUT_TRANSFER_CHOICE',
  CUSTOM_WALLET_INPUT = 'CUSTOM_WALLET_INPUT',
  PAYOUT_METHOD_CHOICE = 'PAYOUT_METHOD_CHOICE',
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
 * 🚀 بدء معالج تسجيل وتعيين عامل جديد (المرحلة 1: نوع وثيقة الهوية والمسح الذكي)
 */
export async function handleStartAddWorker(ctx: MyContext): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  if (!ctx.from) return;

  const telegramId = BigInt(ctx.from.id);
  const initialState: PendingWorkerWizardState = {
    step: WorkerWizardStep.DOC_TYPE,
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
      isManualFallback: false,
    },
  };

  const keyboard = new InlineKeyboard()
    .text('🇪🇬 بطاقة رقم قومي مصري (مسح ذكي بالذكاء الاصطناعي)', 'action:worker_doc:national_id')
    .row()
    .text('🌐 جواز سفر لوافد / أجنبي', 'action:worker_doc:passport')
    .row()
    .text('✍️ إدخال يدوي مباشر (تجاوز الفحص الذكي)', 'action:worker_step:manual_fallback')
    .row()
    .text('❌ إلغاء العملية', 'action:cancel_worker_op')
    .row()
    .text('🔙 العودة لقسم الموارد البشرية', 'menu:domain:hr');

  const text =
    '👤 *تسجيل وتعيين عامل جديد [1/18]*\n' +
    '━━━━━━━━━━━━━━━━━━━━━\n' +
    'اختر نوع وثيقة إثبات الهوية للبدء:\n\n' +
    '💡 *المسح الذكي الفوري (AI Vision):*\n' +
    'يقوم البوت بقراءة وتدقيق الرقم القومي والاسم الكامل من وجه البطاقة، وتاريخ الانتهاء من ظهرها تلقائياً لتفادي أخطاء الإدخال وتسريع التعيين.';

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
 * 📸 معالجة إرفاق صور البطاقة / الوثيقة بالذكاء الاصطناعي (AI Vision)
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

  // 1. تصوير وجه البطاقة أو صفحة جواز السفر بالذكاء الاصطناعي
  if (wizard.step === WorkerWizardStep.PHOTO_FRONT) {
    const statusMsg = await ctx.reply('⏳ *جاري فحص المستند بالذكاء الاصطناعي وتدقيق البيانات الرسمية...*', {
      parse_mode: 'Markdown',
    });

    try {
      const file = await ctx.api.getFile(fileId);
      if (!file.file_path) throw new Error('Telegram file_path not found');

      const downloadUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error(`Failed to download image: ${res.statusText}`);

      const buffer = Buffer.from(await res.arrayBuffer());
      const mimeType = ctx.message?.photo ? 'image/jpeg' : (ctx.message?.document?.mime_type || 'image/jpeg');

      const expectedDocType = wizard.data.idType === 'PASSPORT' ? 'PASSPORT' : 'NATIONAL_ID_FRONT';
      const scanResult = await aiVisionIdService.scanDocument(buffer, mimeType, expectedDocType);

      await ctx.api.deleteMessage(ctx.chat!.id, statusMsg.message_id).catch(() => {});

      if (!scanResult.isValid) {
        const errorKb = new InlineKeyboard()
          .text('🔄 إعادة التقاط الصورة', 'action:worker_photo:retry_front')
          .row()
          .text('✍️ المتابعة بالإدخال اليدوي', 'action:worker_step:manual_fallback')
          .row()
          .text('◀️ السابق', 'action:worker_step:back')
          .text('❌ إلغاء العملية', 'action:cancel_worker_op');

        const errMsg =
          scanResult.userErrorMessage ||
          '❌ *الصورة المرفقة ليست لرقم قومي او باسبور يرجى ارفاق صورة بطاقة رقم قومي او باسبور على حسب حالة الاختيار*';

        await ctx.reply(errMsg, { parse_mode: 'Markdown', reply_markup: errorKb });
        return true;
      }

      // حفظ معطيات الوجه
      wizard.data.idCardFrontPath = fileId;
      if (scanResult.fullName) {
        wizard.data.fullName = scanResult.fullName;
      }

      if (wizard.data.idType === 'NATIONAL_ID') {
        const rawNid = scanResult.nationalIdNumber!;
        wizard.data.idNumber = rawNid;
        wizard.data.birthDateStr = scanResult.birthDate ? formatDate(scanResult.birthDate) : '-';
        wizard.data.gender = scanResult.gender;
        wizard.data.governorateNameAr = scanResult.governorateNameAr;
        if (scanResult.birthDate) {
          wizard.data.age = Math.floor(
            (new Date().getTime() - scanResult.birthDate.getTime()) / (365.25 * 24 * 3600 * 1000)
          );
        }

        // فحص الازدواجية فوراً للرقم القومي
        const dup = await workerService.checkDuplicate('NATIONAL_ID', rawNid);
        if (dup.isDuplicate && dup.existingWorker) {
          const dupKb = new InlineKeyboard()
            .text('🔄 إرفاق بطاقة أخرى', 'action:worker_photo:retry_front')
            .row()
            .text('❌ إلغاء العملية', 'action:cancel_worker_op');
          await ctx.reply(
            `⚠️ *تنبيه تعارض: الرقم القومي مسجل مسبقاً!*\n` +
            `• الرقم القومي: \`${rawNid}\`\n` +
            `• كود العامل: \`${dup.existingWorker.code}\`\n` +
            `• الاسم: *${dup.existingWorker.name}*\n` +
            `• الوظيفة: ${dup.existingWorker.jobTitle}`,
            { parse_mode: 'Markdown', reply_markup: dupKb }
          );
          return true;
        }

        // الانتقال لظهر البطاقة لاستخراج تاريخ الانتهاء
        wizard.step = WorkerWizardStep.PHOTO_BACK;
        await setPendingWorkerWizard(telegramId, wizard);
        await renderWizardStep(ctx, wizard);
        return true;
      } else {
        // جواز سفر
        wizard.data.idNumber = scanResult.passportNumber || '-';
        if (scanResult.expiryDateStr) {
          wizard.data.idCardExpiryDateStr = scanResult.expiryDateStr;
        }

        const dup = await workerService.checkDuplicate('PASSPORT', wizard.data.idNumber);
        if (dup.isDuplicate && dup.existingWorker) {
          const dupKb = new InlineKeyboard()
            .text('🔄 إرفاق جواز آخر', 'action:worker_photo:retry_front')
            .row()
            .text('❌ إلغاء العملية', 'action:cancel_worker_op');
          await ctx.reply(
            `⚠️ *تنبيه تعارض: رقم الجواز مسجل مسبقاً!*\n` +
            `• رقم الجواز: \`${wizard.data.idNumber}\`\n` +
            `• كود العامل: \`${dup.existingWorker.code}\`\n` +
            `• الاسم: *${dup.existingWorker.name}*`,
            { parse_mode: 'Markdown', reply_markup: dupKb }
          );
          return true;
        }

        // للجواز ننتقل لتحديد الجنسية والبيانات المكملة
        wizard.step = WorkerWizardStep.PASSPORT_NATIONALITY;
        await setPendingWorkerWizard(telegramId, wizard);
        await renderWizardStep(ctx, wizard);
        return true;
      }
    } catch (error: any) {
      await ctx.api.deleteMessage(ctx.chat!.id, statusMsg.message_id).catch(() => {});
      console.error('⚠️ [AI-VISION-WIZARD] Front photo processing error:', error);
      const errKb = new InlineKeyboard()
        .text('🔄 إعادة المحاولة', 'action:worker_photo:retry_front')
        .row()
        .text('✍️ المتابعة بالإدخال اليدوي', 'action:worker_step:manual_fallback')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      await ctx.reply(
        '⚠️ تعذر فحص الصورة بالذكاء الاصطناعي حالياً. يمكنك إعادة التقاط الصورة بوضوح أو استخدام الإدخال اليدوي.',
        { reply_markup: errKb }
      );
      return true;
    }
  }

  // 2. تصوير ظهر البطاقة لاستخراج تاريخ الانتهاء
  if (wizard.step === WorkerWizardStep.PHOTO_BACK) {
    const statusMsg = await ctx.reply('⏳ *جاري فحص ظهر البطاقة واستخراج تاريخ انتهاء السريان...*', {
      parse_mode: 'Markdown',
    });

    try {
      const file = await ctx.api.getFile(fileId);
      if (!file.file_path) throw new Error('Telegram file_path not found');

      const downloadUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error(`Failed to download image: ${res.statusText}`);

      const buffer = Buffer.from(await res.arrayBuffer());
      const mimeType = ctx.message?.photo ? 'image/jpeg' : (ctx.message?.document?.mime_type || 'image/jpeg');

      const scanResult = await aiVisionIdService.scanDocument(buffer, mimeType, 'NATIONAL_ID_BACK');
      await ctx.api.deleteMessage(ctx.chat!.id, statusMsg.message_id).catch(() => {});

      wizard.data.idCardBackPath = fileId;
      if (scanResult.isValid && scanResult.expiryDateStr) {
        wizard.data.idCardExpiryDateStr = scanResult.expiryDateStr;
      }

      // الانتقال لبطاقة التأكيد الموحدة للبيانات المستخرجة
      wizard.step = WorkerWizardStep.AI_CONFIRMATION;
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    } catch (error: any) {
      await ctx.api.deleteMessage(ctx.chat!.id, statusMsg.message_id).catch(() => {});
      console.error('⚠️ [AI-VISION-WIZARD] Back photo processing error:', error);
      wizard.data.idCardBackPath = fileId;
      wizard.step = WorkerWizardStep.AI_CONFIRMATION;
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }
  }

  return false;
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
    case WorkerWizardStep.FULL_NAME:
    case WorkerWizardStep.AI_EDIT_NAME: {
      if (inputRaw.length < 5) {
        await ctx.reply('⚠️ الاسم قصير جداً. يرجى إدخال الاسم الرباعي كاملاً (5 أحرف على الأقل).');
        return true;
      }
      wizard.data.fullName = inputRaw;
      if (wizard.step === WorkerWizardStep.AI_EDIT_NAME) {
        wizard.step = WorkerWizardStep.AI_CONFIRMATION;
      } else {
        wizard.step = WorkerWizardStep.ID_NUMBER;
      }
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    case WorkerWizardStep.ID_NUMBER:
    case WorkerWizardStep.AI_EDIT_ID: {
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

        wizard.data.idNumber = inputRaw;
        wizard.data.birthDateStr = formatDate(val.birthDate);
        wizard.data.age = Math.floor(
          (new Date().getTime() - val.birthDate.getTime()) / (365.25 * 24 * 3600 * 1000)
        );
        wizard.data.gender = val.gender;
        wizard.data.governorateNameAr = val.governorateNameAr;

        if (wizard.step === WorkerWizardStep.AI_EDIT_ID) {
          wizard.step = WorkerWizardStep.AI_CONFIRMATION;
        } else {
          wizard.step = WorkerWizardStep.MANUAL_EXPIRY;
        }
        await setPendingWorkerWizard(telegramId, wizard);
        await renderWizardStep(ctx, wizard);
        return true;
      } else {
        // جواز سفر
        if (inputRaw.length < 5) {
          await ctx.reply('⚠️ رقم جواز السفر قصير جداً (5 خانات على الأقل).');
          return true;
        }

        const dup = await workerService.checkDuplicate('PASSPORT', inputRaw);
        if (dup.isDuplicate && dup.existingWorker) {
          const dupKb = new InlineKeyboard()
            .text('◀️ إدخال رقم آخر', 'action:worker_step:back')
            .text('❌ إلغاء العملية', 'action:cancel_worker_op');
          await ctx.reply(
            `⚠️ *تنبيه تعارض: رقم الجواز مسجل مسبقاً!*\n` +
            `• كود العامل: \`${dup.existingWorker.code}\`\n` +
            `• الاسم: *${dup.existingWorker.name}*`,
            { parse_mode: 'Markdown', reply_markup: dupKb }
          );
          return true;
        }

        wizard.data.idNumber = inputRaw.toUpperCase();
        if (wizard.step === WorkerWizardStep.AI_EDIT_ID) {
          wizard.step = WorkerWizardStep.AI_CONFIRMATION;
        } else {
          wizard.step = WorkerWizardStep.PASSPORT_NATIONALITY;
        }
        await setPendingWorkerWizard(telegramId, wizard);
        await renderWizardStep(ctx, wizard);
        return true;
      }
    }

    case WorkerWizardStep.MANUAL_EXPIRY:
    case WorkerWizardStep.AI_EDIT_EXPIRY: {
      let cleanExpiry = normalizeDigits(inputRaw.replace(/[\/.]/g, '-'));
      if (!cleanExpiry.match(/^\d{4}-\d{2}-\d{2}$/)) {
        await ctx.reply('⚠️ صيغة التاريخ غير صحيحة. يرجى إدخال تاريخ انتهاء البطاقة بصيغة: YYYY-MM-DD (مثال: 2029-08-15) أو اضغط تخطي.');
        return true;
      }
      wizard.data.idCardExpiryDateStr = cleanExpiry;
      wizard.step = wizard.data.isManualFallback ? WorkerWizardStep.NICKNAME : WorkerWizardStep.AI_CONFIRMATION;
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    case WorkerWizardStep.PASSPORT_NATIONALITY: {
      wizard.data.nationality = inputRaw || 'غير محدد';
      wizard.step = WorkerWizardStep.PASSPORT_BIRTHDATE;
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    case WorkerWizardStep.PASSPORT_BIRTHDATE: {
      let cleanDate = normalizeDigits(inputRaw.replace(/[\/.]/g, '-'));
      if (!cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        await ctx.reply('⚠️ يرجى إدخال تاريخ الميلاد بصيغة: YYYY-MM-DD (مثال: 1994-05-12).');
        return true;
      }
      const bDate = new Date(cleanDate);
      wizard.data.birthDateStr = cleanDate;
      wizard.data.age = Math.floor(
        (new Date().getTime() - bDate.getTime()) / (365.25 * 24 * 3600 * 1000)
      );
      wizard.step = WorkerWizardStep.PASSPORT_GENDER;
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    case WorkerWizardStep.NICKNAME: {
      const autoNick = extractFirstTwoNames(wizard.data.fullName || '');
      wizard.data.nickname = inputRaw && inputRaw !== '-' && inputRaw !== 'تخطي' ? inputRaw : autoNick;
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
      wizard.data.walletNumber = rawWallet && rawWallet !== '-' && rawWallet !== 'تخطي' ? rawWallet : '-';
      if (wizard.data.walletNumber === '-') {
        wizard.data.walletType = 'نقدي / كاش';
        wizard.data.payoutMethod = 'استلام نقدي بالخزينة / الموقع';
        wizard.step = WorkerWizardStep.JOB_CHOICE;
      } else {
        wizard.step = WorkerWizardStep.PAYOUT_METHOD_CHOICE;
      }
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    case WorkerWizardStep.CUSTOM_JOB_INPUT: {
      wizard.data.jobTitleName = inputRaw;
      wizard.data.jobCode = 'GEN';
      wizard.step = WorkerWizardStep.SITE_CHOICE;
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    case WorkerWizardStep.CUSTOM_START_DATE_INPUT: {
      let cleanDate = normalizeDigits(inputRaw.replace(/[\/.]/g, '-'));
      if (!cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        await ctx.reply('⚠️ يرجى إدخال تاريخ التعيين بصيغة: YYYY-MM-DD (مثال: 2026-03-01).');
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

  // اختيار نوع الوثيقة
  if (data === 'action:worker_doc:national_id') {
    wizard.data.idType = 'NATIONAL_ID';
    wizard.data.nationality = 'مصر';
    wizard.step = WorkerWizardStep.PHOTO_FRONT;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data === 'action:worker_doc:passport') {
    wizard.data.idType = 'PASSPORT';
    wizard.step = WorkerWizardStep.PHOTO_FRONT;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data === 'action:worker_step:manual_fallback') {
    wizard.data.isManualFallback = true;
    wizard.step = WorkerWizardStep.FULL_NAME;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  // إعادة التقاط الصور
  if (data === 'action:worker_photo:retry_front') {
    wizard.step = WorkerWizardStep.PHOTO_FRONT;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data === 'action:worker_photo:retry_back') {
    wizard.step = WorkerWizardStep.PHOTO_BACK;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data === 'action:worker_photo:skip_back') {
    wizard.step = WorkerWizardStep.AI_CONFIRMATION;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data === 'action:worker_photo:manual_expiry') {
    wizard.step = WorkerWizardStep.MANUAL_EXPIRY;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  // تأكيد بيانات الذكاء الاصطناعي
  if (data === 'action:worker_ai_confirm:ok') {
    const autoNick = extractFirstTwoNames(wizard.data.fullName || '');
    wizard.data.nickname = autoNick;
    wizard.step = WorkerWizardStep.NICKNAME;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data === 'action:worker_ai_edit:name') {
    wizard.step = WorkerWizardStep.AI_EDIT_NAME;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data === 'action:worker_ai_edit:id') {
    wizard.step = WorkerWizardStep.AI_EDIT_ID;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  if (data === 'action:worker_ai_edit:expiry') {
    wizard.step = WorkerWizardStep.AI_EDIT_EXPIRY;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  // اسم الشهرة
  if (data === 'action:worker_step:nick_auto') {
    const autoNick = extractFirstTwoNames(wizard.data.fullName || '');
    wizard.data.nickname = autoNick;
    wizard.step = WorkerWizardStep.PHONE;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  // تحويل المستحقات
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
      wizard.step = WorkerWizardStep.JOB_CHOICE;
    }
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  // نوع المحفظة
  if (data.startsWith('action:worker_wallet_type:')) {
    const wType = data.replace('action:worker_wallet_type:', '');
    wizard.data.walletType =
      wType === 'vodafone'
        ? 'فودافون كاش'
        : wType === 'instapay'
        ? 'إنستاباي / بنكي'
        : wType === 'etisalat'
        ? 'اتصالات كاش'
        : wType === 'orange'
        ? 'أورنج كاش'
        : 'أخرى';
    wizard.data.payoutMethod = 'تحويل محفظة إلكترونية';
    wizard.step = WorkerWizardStep.JOB_CHOICE;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  // جنس الوافد
  if (data.startsWith('action:worker_gender:')) {
    wizard.data.gender = data.replace('action:worker_gender:', '') as 'MALE' | 'FEMALE';
    wizard.step = WorkerWizardStep.AI_CONFIRMATION;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  // المسمى الوظيفي
  if (data.startsWith('action:worker_job:')) {
    const jobChoice = data.replace('action:worker_job:', '');
    if (jobChoice === 'custom') {
      wizard.step = WorkerWizardStep.CUSTOM_JOB_INPUT;
    } else {
      const job = await prisma.jobTitle.findUnique({
        where: { id: jobChoice },
        include: { department: true },
      });
      if (job) {
        wizard.data.jobTitleId = job.id;
        wizard.data.jobTitleName = job.name;
        wizard.data.jobCode = job.code;
        wizard.data.departmentId = job.departmentId;
        wizard.data.departmentCode = job.department.code;
        wizard.data.baseSalary = Number(job.baseSalary) || 0;
        wizard.data.additionalSalary = Number(job.additionalSalary) || 0;
        wizard.data.shiftSystem = `${job.workDays || 20} يوم عمل / ${job.restDays || 10} راحة`;
      }
      wizard.step = WorkerWizardStep.SITE_CHOICE;
    }
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  // موقع العمل
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

  // تاريخ المباشرة
  if (data.startsWith('action:worker_hire:')) {
    const hireChoice = data.replace('action:worker_hire:', '');
    if (hireChoice === 'today') {
      wizard.data.hireDateStr = formatDate(new Date());
      wizard.step = WorkerWizardStep.DRIVING_LICENSE;
    } else {
      wizard.step = WorkerWizardStep.CUSTOM_START_DATE_INPUT;
    }
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  // رخصة القيادة
  if (data.startsWith('action:worker_lic:')) {
    const lic = data.replace('action:worker_lic:', '');
    wizard.data.drivingLicense = LICENSE_MAP[lic] || 'لا توجد رخصة';
    wizard.step = WorkerWizardStep.MILITARY_STATUS;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  // الموقف التجنيدي
  if (data.startsWith('action:worker_mil:')) {
    const mil = data.replace('action:worker_mil:', '');
    wizard.data.militaryStatus = MIL_MAP[mil] || 'غير محدد';
    wizard.step = WorkerWizardStep.EMERGENCY_PHONE;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  // تخطي هاتف الطوارئ
  if (data === 'action:worker_step:skip_emergency') {
    wizard.data.emergencyPhone = '-';
    wizard.step = WorkerWizardStep.INSURANCE_STATUS;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  // التأمين
  if (data.startsWith('action:worker_ins:')) {
    const ins = data.replace('action:worker_ins:', '');
    wizard.data.previousInsuranceStatus = INS_MAP[ins] || 'غير مؤمن عليه بجهة أخرى';
    wizard.step = WorkerWizardStep.MARITAL_STATUS;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  // الحالة الاجتماعية
  if (data.startsWith('action:worker_mar:')) {
    const mar = data.replace('action:worker_mar:', '');
    wizard.data.maritalStatus = MARITAL_MAP[mar] || 'أعزب';
    wizard.step = WorkerWizardStep.CONFIRMATION;
    await setPendingWorkerWizard(telegramId, wizard);
    await renderWizardStep(ctx, wizard);
    return;
  }

  // التأكيد والحفظ النهائي
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
    case WorkerWizardStep.PHOTO_FRONT:
      wizard.step = WorkerWizardStep.DOC_TYPE;
      break;
    case WorkerWizardStep.PHOTO_BACK:
      wizard.step = WorkerWizardStep.PHOTO_FRONT;
      break;
    case WorkerWizardStep.AI_CONFIRMATION:
      wizard.step = wizard.data.idType === 'NATIONAL_ID' ? WorkerWizardStep.PHOTO_BACK : WorkerWizardStep.PHOTO_FRONT;
      break;
    case WorkerWizardStep.AI_EDIT_NAME:
    case WorkerWizardStep.AI_EDIT_ID:
    case WorkerWizardStep.AI_EDIT_EXPIRY:
      wizard.step = WorkerWizardStep.AI_CONFIRMATION;
      break;
    case WorkerWizardStep.FULL_NAME:
      wizard.step = WorkerWizardStep.DOC_TYPE;
      break;
    case WorkerWizardStep.ID_NUMBER:
      wizard.step = WorkerWizardStep.FULL_NAME;
      break;
    case WorkerWizardStep.PASSPORT_NATIONALITY:
      wizard.step = wizard.data.isManualFallback ? WorkerWizardStep.ID_NUMBER : WorkerWizardStep.PHOTO_FRONT;
      break;
    case WorkerWizardStep.PASSPORT_BIRTHDATE:
      wizard.step = WorkerWizardStep.PASSPORT_NATIONALITY;
      break;
    case WorkerWizardStep.PASSPORT_GENDER:
      wizard.step = WorkerWizardStep.PASSPORT_BIRTHDATE;
      break;
    case WorkerWizardStep.MANUAL_EXPIRY:
      wizard.step = WorkerWizardStep.ID_NUMBER;
      break;
    case WorkerWizardStep.NICKNAME:
      wizard.step = wizard.data.isManualFallback
        ? (wizard.data.idType === 'PASSPORT' ? WorkerWizardStep.PASSPORT_GENDER : WorkerWizardStep.MANUAL_EXPIRY)
        : WorkerWizardStep.AI_CONFIRMATION;
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
    case WorkerWizardStep.JOB_CHOICE:
      wizard.step = WorkerWizardStep.PAYOUT_TRANSFER_CHOICE;
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
    case WorkerWizardStep.CONFIRMATION:
      wizard.step = WorkerWizardStep.MARITAL_STATUS;
      break;
    default:
      wizard.step = WorkerWizardStep.DOC_TYPE;
  }

  await setPendingWorkerWizard(telegramId, wizard);
  await renderWizardStep(ctx, wizard);
}

async function renderWizardStep(ctx: MyContext, wizard: PendingWorkerWizardState): Promise<void> {
  const keyboard = new InlineKeyboard();
  let text = '';

  switch (wizard.step) {
    case WorkerWizardStep.DOC_TYPE: {
      text =
        '👤 *تسجيل وتعيين عامل جديد [1/18]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'اختر نوع وثيقة إثبات الهوية للبدء:\n\n' +
        '💡 *المسح الذكي الفوري (AI Vision):*\n' +
        'يقوم البوت بقراءة وتدقيق الرقم القومي والاسم الكامل وتاريخ سريان البطاقة تلقائياً.';
      keyboard
        .text('🇪🇬 بطاقة رقم قومي مصري (مسح ذكي)', 'action:worker_doc:national_id')
        .row()
        .text('🌐 جواز سفر لوافد / أجنبي', 'action:worker_doc:passport')
        .row()
        .text('✍️ إدخال يدوي مباشر', 'action:worker_step:manual_fallback')
        .row()
        .text('❌ إلغاء العملية', 'action:cancel_worker_op')
        .row()
        .text('🔙 العودة للموارد البشرية', 'menu:domain:hr');
      break;
    }

    case WorkerWizardStep.PHOTO_FRONT: {
      const isNid = wizard.data.idType === 'NATIONAL_ID';
      text =
        `📸 *[1/2] تصوير وجه ${isNid ? 'بطاقة الرقم القومي' : 'جواز السفر'} [2/18]*\n` +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        `يرجى إرسال صورة *وجه ${isNid ? 'بطاقة الرقم القومي' : 'صفحة البيانات في جواز السفر'}* الآن:\n\n` +
        '📌 *تعليمات التصوير الإلزامية:*\n' +
        '• يجب أن تكون البطاقة واضحة وكاملة داخل الإطار دون اقتطاع أركانها.\n' +
        '• غير مغطاة بأصابع اليد أو بأي جسم خارجي يغطي الأرقام أو البيانات.\n' +
        '• بجودة عالية وإضاءة جيدة بدون فلاش يعكس الأرقام.\n' +
        `• في حالة إرفاق صورة ليست لـ ${isNid ? 'رقم قومي' : 'جواز سفر'}، سيتم رفضها تلقائياً.\n\n` +
        '💡 _إذا تعطل الذكاء الاصطناعي أو كان الإنترنت ضعيفاً، يمكنك الضغط على المتابعة بالإدخال اليدوي._';

      keyboard
        .text('✍️ المتابعة بالإدخال اليدوي', 'action:worker_step:manual_fallback')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.PHOTO_BACK: {
      text =
        '📸 *[2/2] تصوير ظهر بطاقة الرقم القومي (تاريخ الانتهاء) [3/18]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'يرجى إرسال صورة *ظهر بطاقة الرقم القومي* الآن:\n\n' +
        '📌 *تعليمات التصوير:*\n' +
        '• لاستخراج تاريخ انتهاء سريان البطاقة "سارية حتى" تلقائياً.\n' +
        '• تأكد من وضوح شريط البيانات والباركود وعدم التغطية بالأصابع.\n\n' +
        '💡 _يمكنك التخطي أو إدخال تاريخ الانتهاء يدوياً._';

      keyboard
        .text('⏭️ تخطي ظهر البطاقة', 'action:worker_photo:skip_back')
        .row()
        .text('✍️ إدخال تاريخ الانتهاء يدوياً', 'action:worker_photo:manual_expiry')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.AI_CONFIRMATION: {
      const isNid = wizard.data.idType === 'NATIONAL_ID';
      text =
        '📋 *تأكيد بيانات الهوية المستخرجة بالذكاء الاصطناعي [4/18]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'تم تدقيق وثيقة الهوية واستخراج البيانات التالية:\n\n' +
        `👤 *الاسم الرباعي:* *${wizard.data.fullName || 'قيد الاستيفاء'}*\n` +
        `🔢 *رقم الإثبات:* \`${wizard.data.idNumber || '-'}\` (${isNid ? 'رقم قومي مصري' : `جواز سفر - ${wizard.data.nationality}`})\n` +
        (isNid ? `📅 *تاريخ الميلاد والسن:* ${wizard.data.birthDateStr || '-'} (${wizard.data.age || '-'} سنة)\n` : '') +
        (wizard.data.governorateNameAr ? `📍 *المحافظة:* ${wizard.data.governorateNameAr}\n` : '') +
        `⏳ *تاريخ انتهاء البطاقة:* *${wizard.data.idCardExpiryDateStr || 'غير محدد / قيد الاستيفاء'}*\n` +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'هل هذه البيانات صحيحة للمتابعة؟ يمكنك اعتمادها فوراً أو تصحيح أي بيان.';

      keyboard
        .text('✅ البيانات صحيحة ومتابعة التعيين', 'action:worker_ai_confirm:ok')
        .row()
        .text('✏️ تصحيح الاسم', 'action:worker_ai_edit:name')
        .text('✏️ تصحيح الرقم', 'action:worker_ai_edit:id')
        .row()
        .text('✏️ تصحيح تاريخ الانتهاء', 'action:worker_ai_edit:expiry')
        .row()
        .text('◀️ إعادة التقاط الصورة', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.AI_EDIT_NAME: {
      text =
        '✏️ *تصحيح الاسم الرباعي*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        `الاسم الحالي: *${wizard.data.fullName || '-'}*\n\n` +
        'يرجى إدخال الاسم الرباعي الصحيح للعامل:';
      keyboard
        .text('◀️ تراجع', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.AI_EDIT_ID: {
      text =
        '✏️ *تصحيح رقم الإثبات (القومي أو الجواز)*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        `الرقم الحالي: \`${wizard.data.idNumber || '-'}\`\n\n` +
        'يرجى إدخال الرقم الصحيح الآن:';
      keyboard
        .text('◀️ تراجع', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.AI_EDIT_EXPIRY:
    case WorkerWizardStep.MANUAL_EXPIRY: {
      text =
        '⏳ *تاريخ انتهاء سريان البطاقة*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        `التاريخ الحالي: *${wizard.data.idCardExpiryDateStr || 'غير محدد'}*\n\n` +
        'يرجى إدخال تاريخ انتهاء سريان البطاقة بصيغة: *YYYY-MM-DD*\n' +
        '_💡 مثال: 2029-08-15_';
      keyboard
        .text('⏭️ تخطي تاريخ الانتهاء', 'action:worker_photo:skip_back')
        .row()
        .text('◀️ تراجع', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.FULL_NAME: {
      text =
        '👤 *تسجيل عامل جديد - إدخال يدوي [2/18]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'يرجى إدخال *الاسم الرباعي* للعامل:\n\n' +
        '💡 _مثال: محمد أحمد إبراهيم علي_';
      keyboard
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.ID_NUMBER: {
      const isNid = wizard.data.idType === 'NATIONAL_ID';
      text =
        `🔢 *رقم ${isNid ? 'بطاقة الرقم القومي' : 'جواز السفر'} [3/18]*\n` +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        `أدخل رقم ${isNid ? 'الرقم القومي (14 رقماً مصرياً)' : 'جواز السفر'}:\n\n` +
        (isNid ? '💡 _سيتم تدقيق تاريخ الميلاد والمحافظة والنوع آلياً وفق معايير الرقم القومي._' : '');
      keyboard
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.PASSPORT_NATIONALITY: {
      text =
        '🌍 *جنسية العامل الوافد [4/18]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'أدخل جنسية العامل (مثال: سوداني، سوري، أردني):';
      keyboard
        .text('🇸🇩 سوداني', 'action:worker_nat:سوداني')
        .text('🇸🇾 سوري', 'action:worker_nat:سوري')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.PASSPORT_BIRTHDATE: {
      text =
        '🎂 *تاريخ ميلاد الوافد [5/18]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'أدخل تاريخ الميلاد بصيغة: YYYY-MM-DD (مثال: 1994-05-12):';
      keyboard
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.PASSPORT_GENDER: {
      text =
        '👤 *النوع (الجنس) [6/18]*\n' +
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

    case WorkerWizardStep.NICKNAME: {
      const autoNick = extractFirstTwoNames(wizard.data.fullName || '');
      text =
        '👤 *اسم الشهرة المعتمد بالموقع [5/18]*\n' +
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
        '📱 *رقم الهاتف المحمول والواتساب [6/18]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'أدخل رقم الهاتف الشخصي للعامل (11 رقماً مصرياً):\n\n' +
        '💡 _مثال: 01012345678 أو 01155443322_';
      keyboard
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.PAYOUT_TRANSFER_CHOICE: {
      text =
        '💳 *تحويل المستحقات والرواتب [7/18]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        `رقم الهاتف المسجل: \`${wizard.data.phone}\`\n\n` +
        'كيف سيتم تحويل مستحقات وسلف العامل؟';
      keyboard
        .text(`📱 نفس رقم الهاتف المحمول (${wizard.data.phone})`, 'action:worker_tr:same')
        .row()
        .text('💳 إدخال رقم محفظة إلكترونية / حساب آخر', 'action:worker_tr:custom')
        .row()
        .text('💵 استلام نقدي بالخزينة / الموقع', 'action:worker_tr:cash')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.CUSTOM_WALLET_INPUT: {
      text =
        '💳 *رقم المحفظة / الحساب البنكي*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'أدخل رقم المحفظة أو الحساب البنكي لتحويل المستحقات:';
      keyboard
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.PAYOUT_METHOD_CHOICE: {
      text =
        '🏦 *نوع القناة المالية [8/18]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        `رقم الحساب/المحفظة: \`${wizard.data.walletNumber}\`\n\n` +
        'اختر نوع المحفظة أو الحساب:';
      keyboard
        .text('🔴 فودافون كاش', 'action:worker_wallet_type:vodafone')
        .text('⚡ إنستاباي / بنكي', 'action:worker_wallet_type:instapay')
        .row()
        .text('🟢 اتصالات كاش', 'action:worker_wallet_type:etisalat')
        .text('🟠 أورنج كاش', 'action:worker_wallet_type:orange')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.JOB_CHOICE: {
      const jobs = await prisma.jobTitle.findMany({
        where: { isActive: true },
        include: { department: true },
        take: 10,
        orderBy: { code: 'asc' },
      });

      text =
        '💼 *تحديد المسمى الوظيفي والمهنة [9/18]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'اختر المسمى الوظيفي المعتمد للعامل:';

      for (let i = 0; i < jobs.length; i += 2) {
        const j1 = jobs[i];
        const j2 = jobs[i + 1];
        const icon1 = getJobEmoji(j1.name);
        if (j2) {
          const icon2 = getJobEmoji(j2.name);
          keyboard
            .text(`${icon1} ${j1.name}`, `action:worker_job:${j1.id}`)
            .text(`${icon2} ${j2.name}`, `action:worker_job:${j2.id}`)
            .row();
        } else {
          keyboard.text(`${icon1} ${j1.name}`, `action:worker_job:${j1.id}`).row();
        }
      }

      keyboard
        .text('✍️ كتابة مسمى وظيفي مخصص', 'action:worker_job:custom')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.CUSTOM_JOB_INPUT: {
      text =
        '💼 *كتابة مسمى وظيفي مخصص*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'أدخل المسمى الوظيفي للعامل:';
      keyboard
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.SITE_CHOICE: {
      const sites = await prisma.site.findMany({
        where: { status: 'ACTIVE' },
        take: 8,
        orderBy: { code: 'asc' },
      });

      text =
        '📍 *تسكين وتعيين بموقع العمل [10/18]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'اختر موقع العمل الميداني للعامل:';

      for (const site of sites) {
        keyboard.text(`📍 ${site.name} (${site.code})`, `action:worker_site:${site.id}`).row();
      }

      keyboard
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.START_DATE_CHOICE: {
      const todayFormatted = formatDate(new Date());
      text =
        '📅 *تاريخ بدء ومباشرة العمل [11/18]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        `تاريخ اليوم: *${todayFormatted}*\n\n` +
        'هل يبدأ العامل العمل من اليوم أم تاريخ مخصص؟';

      keyboard
        .text(`🟢 بدء العمل من اليوم (${todayFormatted})`, 'action:worker_hire:today')
        .row()
        .text('🗓️ إدخال تاريخ تعيين مخصص', 'action:worker_hire:custom')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.CUSTOM_START_DATE_INPUT: {
      text =
        '📅 *تاريخ تعيين مخصص*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'أدخل تاريخ المباشرة بصيغة: YYYY-MM-DD (مثال: 2026-03-01):';
      keyboard
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.DRIVING_LICENSE: {
      text =
        '🚗 *موقف رخصة القيادة [12/18]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'اختر رخصة القيادة التي يحملها العامل:';
      keyboard
        .text('🚫 لا توجد رخصة', 'action:worker_lic:none')
        .row()
        .text('🚗 رخصة خاصة', 'action:worker_lic:pvt')
        .row()
        .text('🚛 مهنية درجة ثالثة', 'action:worker_lic:3rd')
        .row()
        .text('🚚 مهنية درجة ثانية', 'action:worker_lic:2nd')
        .row()
        .text('🚜 مهنية درجة أولى', 'action:worker_lic:1st')
        .row()
        .text('🏗️ رخصة تشغيل معدات ثقيلة', 'action:worker_lic:heavy')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');
      break;
    }

    case WorkerWizardStep.MILITARY_STATUS: {
      text =
        '🎖️ *الموقف من التجنيد [13/18]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        'اختر الموقف التجنيدي للعامل:';
      keyboard
        .text('🟢 أدى الخدمة العسكرية (قدوة حسنة)', 'action:worker_mil:served')
        .row()
        .text('📜 إعفاء نهائي', 'action:worker_mil:final_exempt')
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
        '🚨 *هاتف الطوارئ (Emergency Contact) [14/18]*\n' +
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
        '🛡️ *الموقف التأميني السابق للعامل [15/18]*\n' +
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
        '💍 *الحالة الاجتماعية للعامل [16/18]*\n' +
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
          ? '✅ تم فحص وتوثيق الوجه والظهر'
          : wizard.data.idCardFrontPath !== '-'
          ? '🟡 تم توثيق الوجه فقط'
          : '⚪ لم تُرفق صور (ملف يدوي قيد الاستيفاء)';

      text =
        '📋 *مراجعة بيانات تعيين العامل الجديد [18/18]*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        `🆔 *كود العامل المعتمد:* \`${autoCode}\`\n` +
        `👤 *الاسم الرباعي:* *${wizard.data.fullName}*\n` +
        `🏷️ *اسم الشهرة المعتمد للقوائم:* *${wizard.data.nickname}*\n` +
        `🔢 *رقم الإثبات:* \`${wizard.data.idNumber}\` (${wizard.data.idType === 'NATIONAL_ID' ? 'رقم قومي مصري' : `جواز سفر - ${wizard.data.nationality}`})\n` +
        `🎂 *تاريخ الميلاد والسن:* ${wizard.data.birthDateStr || '-'} (${wizard.data.age || '-'} سنة)\n` +
        (wizard.data.governorateNameAr ? `📍 *المحافظة:* ${wizard.data.governorateNameAr}\n` : '') +
        (wizard.data.idCardExpiryDateStr ? `⏳ *تاريخ انتهاء البطاقة:* *${wizard.data.idCardExpiryDateStr}*\n` : '') +
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
        `📂 *موقف الوثائق الذكية:* ${photoStatus}\n` +
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

/**
 * 💾 الحفظ النهائي والتسجيل الرسمي للعامل بقاعدة البيانات
 */
async function handleWorkerFinalSave(
  ctx: MyContext,
  wizard: PendingWorkerWizardState,
  telegramId: bigint
): Promise<void> {
  const d = wizard.data;
  const totalSalary = (d.baseSalary || 0) + (d.additionalSalary || 0);
  const dailyWage = totalSalary > 0 ? totalSalary / 30 : 0;

  let birthDateObj: Date | undefined = undefined;
  if (d.birthDateStr && d.birthDateStr !== '-') {
    birthDateObj = new Date(d.birthDateStr);
  }

  let hireDateObj = new Date();
  if (d.hireDateStr) {
    hireDateObj = new Date(d.hireDateStr);
  }

  let expiryDateObj: Date | undefined = undefined;
  if (d.idCardExpiryDateStr && d.idCardExpiryDateStr !== '-') {
    expiryDateObj = new Date(d.idCardExpiryDateStr);
  }

  try {
    const result = await workerService.createWorker({
      name: d.fullName || 'عامل جديد',
      nickname: d.nickname,
      legacyCode: d.legacyCode,
      idType: d.idType || 'NATIONAL_ID',
      idNumber: d.idNumber || '00000000000000',
      nationality: d.nationality || 'مصر',
      birthDate: birthDateObj,
      gender: d.gender || 'MALE',
      phone: d.phone || '01000000000',
      jobTitleId: d.jobTitleId,
      jobTitleName: d.jobTitleName || 'عامل',
      departmentId: d.departmentId,
      siteId: d.siteId,
      siteName: d.siteName || 'الموقع العام',
      hireDate: hireDateObj,
      dailyWage,
      basicSalary: d.baseSalary || 0,
      fixedAllowances: d.additionalSalary || 0,
      paymentMethod: d.payoutMethod || 'استلام نقدي بالخزينة / الموقع',
      walletType: d.walletType,
      accountNumber: d.walletNumber,
      drivingLicense: d.drivingLicense,
      militaryStatus: d.militaryStatus,
      emergencyPhone: d.emergencyPhone,
      previousInsuranceStatus: d.previousInsuranceStatus,
      maritalStatus: d.maritalStatus,
      idCardExpiryDate: expiryDateObj,
      idCardFrontPath: d.idCardFrontPath !== '-' ? d.idCardFrontPath : undefined,
      idCardBackPath: d.idCardBackPath !== '-' ? d.idCardBackPath : undefined,
    });

    await clearPendingWorkerWizard(telegramId);

    // لوحة أزرار إتمام العمليات الموحدة (Universal Post-Action Completion Keyboard)
    const workerPhone = (d.phone || '').replace(/\D/g, '');
    const waPhone = workerPhone.startsWith('0') ? '20' + workerPhone.substring(1) : workerPhone;
    const waText = encodeURIComponent(
      `مرحباً بك يا ${result.worker.name} بشركة السعادة للمقاولات العامة والتعدين.\n` +
      `تم قيدكم رسمياً بكود وظيفي: [ ${result.worker.code} ] - وظيفة: ${result.worker.jobTitle}.\n` +
      `نتمنى لكم التوفيق والنجاح.`
    );
    const waUrl = `https://wa.me/${waPhone}?text=${waText}`;

    const completionKeyboard = new InlineKeyboard()
      .url('📲 إرسال إشعار التعيين للعامل عبر واتساب', waUrl)
      .row()
      .text('➕ تسجيل عامل آخر', 'action:worker:add')
      .row()
      .text('🔙 العودة لقسم الموارد البشرية', 'menu:domain:hr')
      .row()
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    const successText =
      '🎉 *تم تسجيل وتعيين العامل الجديد بنجاح!*\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      `🆔 *كود العامل الرسمي:* \`${result.worker.code}\`\n` +
      `👤 *الاسم:* *${result.worker.name}* (الشهرة: *${result.worker.nickname || '-'}*)\n` +
      `🔢 *رقم الإثبات:* \`${d.idNumber}\`\n` +
      (d.idCardExpiryDateStr ? `⏳ *انتهاء البطاقة:* *${d.idCardExpiryDateStr}*\n` : '') +
      `💼 *الوظيفة:* ${result.worker.jobTitle} | 📍 *الموقع:* ${d.siteName || '-'}\n` +
      `📅 *تاريخ التعيين:* *${formatDate(hireDateObj)}*\n` +
      `📱 *الهاتف:* \`${d.phone}\` | 💳 *المستحقات:* \`${d.walletNumber}\` (${d.walletType})\n` +
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      '✅ تم حفظ ملف العامل في قاعدة البيانات وتحديث كاش القوائم اللحظية بنجاح.';

    if (wizard.messageId && ctx.chat) {
      await ctx.api.editMessageText(ctx.chat.id, wizard.messageId, successText, {
        parse_mode: 'Markdown',
        reply_markup: completionKeyboard,
      });
    } else {
      await ctx.reply(successText, {
        parse_mode: 'Markdown',
        reply_markup: completionKeyboard,
      });
    }
  } catch (err: any) {
    console.error('Failed to create worker in final step:', err);
    await ctx.reply(`❌ تعذر إتمام التعيين: ${err.message || 'خطأ غير متوقع'}`);
  }
}
