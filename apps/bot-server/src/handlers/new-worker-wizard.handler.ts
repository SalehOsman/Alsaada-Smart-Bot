import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import { workerService } from '../services/worker.service.js';
import {
  setPendingWorkerWizard,
  getPendingWorkerWizard,
  clearPendingWorkerWizard,
  PendingWorkerWizardState,
} from '../redis.js';
import {
  buildConfirmationKeyboard,
  buildCompletionKeyboard,
  buildDatePickerKeyboard,
} from '@alsaada/core-components';
import { formatCurrency, formatDate, normalizeDigits } from '@alsaada/regional-engine';

export enum WorkerWizardStep {
  FULL_NAME = 'FULL_NAME',
  ID_TYPE = 'ID_TYPE',
  ID_NUMBER = 'ID_NUMBER',
  PASSPORT_NATIONALITY = 'PASSPORT_NATIONALITY',
  PASSPORT_BIRTHDATE = 'PASSPORT_BIRTHDATE',
  PASSPORT_GENDER = 'PASSPORT_GENDER',
  PHONE = 'PHONE',
  JOB_SELECT = 'JOB_SELECT',
  SITE_SELECT = 'SITE_SELECT',
  START_DATE = 'START_DATE',
  PAYMENT_METHOD = 'PAYMENT_METHOD',
  WALLET_NUMBER = 'WALLET_NUMBER',
  CONFIRMATION = 'CONFIRMATION',
}

/**
 * 🚀 بدء معالج تسجيل عامل جديد (الخطوة 1: الاسم الرباعي)
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
      paymentMethod: 'CASH_SITE',
    },
  };

  const keyboard = new InlineKeyboard()
    .text('❌ إلغاء العملية', 'action:cancel_worker_op')
    .row()
    .text('🔙 العودة لقسم الموارد البشرية', 'menu:domain:hr');

  const text =
    `👤 *تسجيل وتعيين عامل جديد [1/8]*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `يرجى إدخال *الاسم الرباعي* للعامل:\n\n` +
    `💡 _مثال: محمد أحمد إبراهيم علي_`;

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
    // 1. الاسم الرباعي
    case WorkerWizardStep.FULL_NAME: {
      if (inputRaw.length < 5) {
        await ctx.reply('⚠️ الاسم قصير جداً. يرجى إدخال الاسم الرباعي كاملاً (5 أحرف على الأقل).');
        return true;
      }
      wizard.data.fullName = inputRaw;
      const names = inputRaw.split(/\s+/);
      wizard.data.nickname = names.length >= 2 ? `${names[0]} ${names[1]}` : inputRaw;

      wizard.step = WorkerWizardStep.ID_TYPE;
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    // 2. رقم الإثبات (قومي أو جواز)
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

        // فحص الازدواجية في قاعدة البيانات
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
        wizard.data.gender = val.gender;
        wizard.data.governorateCode = val.governorateCode;
        wizard.data.nationality = 'مصر';

        // الانتقال لرقم الهاتف
        wizard.step = WorkerWizardStep.PHONE;
        await setPendingWorkerWizard(telegramId, wizard);
        await renderWizardStep(ctx, wizard);
        return true;
      } else {
        // جواز سفر
        const cleanPassport = normalizeDigits(inputRaw.trim().toUpperCase().replace(/[\s-]/g, ''));
        if (cleanPassport.length < 5 || cleanPassport.length > 20) {
          await ctx.reply('⚠️ رقم جواز السفر غير صحيح (يجب أن يتراوح بين 5 و 20 رمزاً).');
          return true;
        }

        // فحص الازدواجية
        const dup = await workerService.checkDuplicate('PASSPORT', cleanPassport);
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

        wizard.data.idNumber = cleanPassport;
        wizard.step = WorkerWizardStep.PASSPORT_NATIONALITY;
        await setPendingWorkerWizard(telegramId, wizard);
        await renderWizardStep(ctx, wizard);
        return true;
      }
    }

    // 2.1 كتابة جنسية مخصصة
    case WorkerWizardStep.PASSPORT_NATIONALITY: {
      wizard.data.nationality = inputRaw;
      wizard.step = WorkerWizardStep.PASSPORT_BIRTHDATE;
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    // 2.2 تاريخ ميلاد الجواز
    case WorkerWizardStep.PASSPORT_BIRTHDATE: {
      const bDate = new Date(normalizeDigits(inputRaw));
      if (isNaN(bDate.getTime()) || bDate.getFullYear() < 1940 || bDate.getTime() > Date.now()) {
        await ctx.reply('⚠️ تاريخ الميلاد غير صالح. يرجى إدخاله بصيغة: `YYYY-MM-DD` (مثل: `1995-06-15`).', { parse_mode: 'Markdown' });
        return true;
      }
      wizard.data.birthDateStr = bDate.toISOString().substring(0, 10);
      wizard.step = WorkerWizardStep.PASSPORT_GENDER;
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    // 3. رقم الهاتف
    case WorkerWizardStep.PHONE: {
      const cleanPhone = normalizeDigits(inputRaw.replace(/[\s-]/g, ''));
      if (cleanPhone.length < 8) {
        await ctx.reply('⚠️ رقم الهاتف غير صحيح. يرجى إدخال رقم هاتف محمول صالح.');
        return true;
      }
      wizard.data.phone = cleanPhone;
      wizard.step = WorkerWizardStep.JOB_SELECT;
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    // 4. تاريخ مباشرة مخصص
    case WorkerWizardStep.START_DATE: {
      const sDate = new Date(normalizeDigits(inputRaw));
      if (isNaN(sDate.getTime())) {
        await ctx.reply('⚠️ التاريخ غير صالح. يرجى كتابته بصيغة: `YYYY-MM-DD` (مثل: `2026-09-01`).', { parse_mode: 'Markdown' });
        return true;
      }
      wizard.data.hireDateStr = sDate.toISOString().substring(0, 10);
      wizard.step = WorkerWizardStep.PAYMENT_METHOD;
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    // 5. رقم المحفظة أو الحساب
    case WorkerWizardStep.WALLET_NUMBER: {
      wizard.data.walletNumber = normalizeDigits(inputRaw.replace(/[\s-]/g, ''));
      wizard.step = WorkerWizardStep.CONFIRMATION;
      await setPendingWorkerWizard(telegramId, wizard);
      await renderWizardStep(ctx, wizard);
      return true;
    }

    default:
      return false;
  }
}

/**
 * 🎨 تصيير شاشة الخطوة الحالية بالمعالج (In-Place Single Message Lifecycle)
 */
export async function renderWizardStep(ctx: MyContext, wizard: PendingWorkerWizardState): Promise<void> {
  const telegramId = ctx.from ? BigInt(ctx.from.id) : 0n;

  switch (wizard.step) {
    // -----------------------------------------------------------------
    // الخطوة 2: اختيار نوع إثبات الشخصية
    // -----------------------------------------------------------------
    case WorkerWizardStep.ID_TYPE: {
      const text =
        `🆔 *نوع إثبات الشخصية [2/8]*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *العامل:* ${wizard.data.fullName}\n\n` +
        `حدد نوع وثيقة الهوية الرسمية:`;

      const keyboard = new InlineKeyboard()
        .text('🇪🇬 بطاقة الرقم القومي المصري', 'action:worker_set_id_type:NATIONAL_ID')
        .row()
        .text('🌍 جواز سفر (عمالة وافدة / غير مصرية)', 'action:worker_set_id_type:PASSPORT')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');

      await updateWizardMessage(ctx, wizard, text, keyboard);
      break;
    }

    // -----------------------------------------------------------------
    // الخطوة 3: إدخال رقم الإثبات (القومي أو الجواز)
    // -----------------------------------------------------------------
    case WorkerWizardStep.ID_NUMBER: {
      const isNid = wizard.data.idType === 'NATIONAL_ID';
      const text = isNid
        ? `🔢 *الرقم القومي المصري [3/8]*\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 *العامل:* ${wizard.data.fullName}\n\n` +
          `أدخل *الرقم القومي* (14 رقماً مصرياً):\n` +
          `💡 _سيتم استخراج تاريخ الميلاد والعمر والمحافظة والنوع آلياً ومطابقتها._`
        : `🛂 *رقم جواز السفر [3/8]*\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 *العامل:* ${wizard.data.fullName}\n\n` +
          `أدخل *رقم جواز السفر* الرسمي للعامل الوافد:`;

      const keyboard = new InlineKeyboard()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');

      await updateWizardMessage(ctx, wizard, text, keyboard);
      break;
    }

    // -----------------------------------------------------------------
    // الخطوة 3.1: جنسية العامل الوافد
    // -----------------------------------------------------------------
    case WorkerWizardStep.PASSPORT_NATIONALITY: {
      const text =
        `🌍 *تحديد جنسية العامل الوافد*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `اختر الجنسية من القائمة السريعة أو اكتبها مباشرة:`;

      const keyboard = new InlineKeyboard()
        .text('🇸🇩 سوداني', 'action:worker_nat:السودان')
        .text('🇸🇾 سوري', 'action:worker_nat:سوريا')
        .row()
        .text('🇹🇩 تشادي', 'action:worker_nat:تشاد')
        .text('🇾🇪 يمني', 'action:worker_nat:اليمن')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');

      await updateWizardMessage(ctx, wizard, text, keyboard);
      break;
    }

    // -----------------------------------------------------------------
    // الخطوة 3.2: تاريخ ميلاد صاحب الجواز
    // -----------------------------------------------------------------
    case WorkerWizardStep.PASSPORT_BIRTHDATE: {
      const text =
        `🎂 *تاريخ ميلاد العامل الوافد*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `أدخل تاريخ الميلاد بصيغة: \`YYYY-MM-DD\`\n` +
        `💡 _مثال: 1994-08-20_`;

      const keyboard = new InlineKeyboard()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');

      await updateWizardMessage(ctx, wizard, text, keyboard);
      break;
    }

    // -----------------------------------------------------------------
    // الخطوة 3.3: نوع صاحب الجواز
    // -----------------------------------------------------------------
    case WorkerWizardStep.PASSPORT_GENDER: {
      const text =
        `⚧️ *النوع (الجنس)*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `حدد النوع:`;

      const keyboard = new InlineKeyboard()
        .text('👨 ذكر', 'action:worker_gender:MALE')
        .text('👩 أنثى', 'action:worker_gender:FEMALE')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');

      await updateWizardMessage(ctx, wizard, text, keyboard);
      break;
    }

    // -----------------------------------------------------------------
    // الخطوة 4: رقم الهاتف والواتساب
    // -----------------------------------------------------------------
    case WorkerWizardStep.PHONE: {
      const text =
        `📱 *رقم الهاتف والواتساب [4/8]*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `أدخل رقم الهاتف المعتمد للعامل:\n` +
        `💡 _سيتم إرسال بطاقة الترحيب وإشعارات السلف والرواتب على هذا الرقم._`;

      const keyboard = new InlineKeyboard()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');

      await updateWizardMessage(ctx, wizard, text, keyboard);
      break;
    }

    // -----------------------------------------------------------------
    // الخطوة 5: اختيار المسمى الوظيفي
    // -----------------------------------------------------------------
    case WorkerWizardStep.JOB_SELECT: {
      const jobs = await prisma.jobTitle.findMany({
        where: { isActive: true },
        include: { department: true },
        orderBy: [{ department: { order: 'asc' } }, { order: 'asc' }],
      });

      const text =
        `💼 *المسمى الوظيفي وقسم العمل [5/8]*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `اختر الوظيفة المعتمدة للعامل:`;

      const keyboard = new InlineKeyboard();
      jobs.forEach((j, i) => {
        keyboard.text(`${j.name} (${j.code})`, `action:worker_set_job:${j.id}`);
        if (i % 2 === 1) keyboard.row();
      });
      if (jobs.length % 2 !== 0) keyboard.row();

      keyboard
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');

      await updateWizardMessage(ctx, wizard, text, keyboard);
      break;
    }

    // -----------------------------------------------------------------
    // الخطوة 6: اختيار موقع العمل
    // -----------------------------------------------------------------
    case WorkerWizardStep.SITE_SELECT: {
      const sites = await prisma.site.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { code: 'asc' },
      });

      const text =
        `📍 *موقع العمل والمشروع [6/8]*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `💼 *الوظيفة:* ${wizard.data.jobTitleName}\n` +
        `اختر الموقع المخصص لمباشرة العمل:`;

      const keyboard = new InlineKeyboard();
      sites.forEach((s) => {
        keyboard.text(`📍 ${s.name} (${s.code})`, `action:worker_set_site:${s.id}`).row();
      });

      keyboard
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');

      await updateWizardMessage(ctx, wizard, text, keyboard);
      break;
    }

    // -----------------------------------------------------------------
    // الخطوة 7: تاريخ مباشرة العمل
    // -----------------------------------------------------------------
    case WorkerWizardStep.START_DATE: {
      const text =
        `📅 *تاريخ مباشرة العمل [7/8]*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `حدد تاريخ المباشرة الفعلي في الموقع (أو اكتبه بصيغة YYYY-MM-DD):`;

      const keyboard = buildDatePickerKeyboard({
        includeToday: true,
        includeYesterday: true,
        callbackPrefix: 'action:worker_date:',
        backCallbackData: 'action:worker_step:back',
        cancelCallbackData: 'action:cancel_worker_op',
      });

      await updateWizardMessage(ctx, wizard, text, keyboard);
      break;
    }

    // -----------------------------------------------------------------
    // الخطوة 8: طريقة استلام الراتب
    // -----------------------------------------------------------------
    case WorkerWizardStep.PAYMENT_METHOD: {
      const text =
        `💳 *طريقة استلام المستحقات والراتب [8/8]*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `حدد القناة المالية لصرف راتب وسلف العامل:`;

      const keyboard = new InlineKeyboard()
        .text('💵 استلام نقدي بالخزينة / الموقع', 'action:worker_pay:CASH_SITE')
        .row()
        .text('📱 محفظة فودافون كاش', 'action:worker_pay:VODAFONE_CASH')
        .row()
        .text('⚡ إنستاباي / تحويل بنكي', 'action:worker_pay:INSTAPAY')
        .row()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');

      await updateWizardMessage(ctx, wizard, text, keyboard);
      break;
    }

    // -----------------------------------------------------------------
    // إدخال رقم المحفظة
    // -----------------------------------------------------------------
    case WorkerWizardStep.WALLET_NUMBER: {
      const text =
        `💳 *رقم المحفظة / الحساب البنكي*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `أدخل رقم المحفظة أو الحساب لتحويل المستحقات:`;

      const keyboard = new InlineKeyboard()
        .text('◀️ السابق', 'action:worker_step:back')
        .text('❌ إلغاء العملية', 'action:cancel_worker_op');

      await updateWizardMessage(ctx, wizard, text, keyboard);
      break;
    }

    // -----------------------------------------------------------------
    // بطاقة المراجعة النهائية قبل الحفظ
    // -----------------------------------------------------------------
    case WorkerWizardStep.CONFIRMATION: {
      const idLabel = wizard.data.idType === 'PASSPORT' ? 'جواز سفر' : 'رقم قومي مصري';
      const payLabel =
        wizard.data.paymentMethod === 'VODAFONE_CASH'
          ? `محفظة فودافون كاش (${wizard.data.walletNumber || '-'})`
          : wizard.data.paymentMethod === 'INSTAPAY'
          ? `إنستاباي / بنك (${wizard.data.walletNumber || '-'})`
          : 'استلام نقدي بالخزينة / الموقع';

      const text =
        `📋 *مراجعة وتأكيد تسجيل العامل الجديد:*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *الاسم الرسمي:* *${wizard.data.fullName}*\n` +
        `🆔 *نوع الإثبات:* ${idLabel} (\`${wizard.data.idNumber}\`)\n` +
        `🌍 *الجنسية:* ${wizard.data.nationality || 'مصر'} | ⚧️ *النوع:* ${wizard.data.gender === 'FEMALE' ? 'أنثى' : 'ذكر'}\n` +
        `🎂 *تاريخ الميلاد:* ${wizard.data.birthDateStr || '-'}\n` +
        `💼 *الوظيفة المعتمدة:* ${wizard.data.jobTitleName}\n` +
        `📍 *موقع العمل:* ${wizard.data.siteName}\n` +
        `📅 *تاريخ المباشرة:* ${wizard.data.hireDateStr || formatDate(new Date())}\n` +
        `📱 *رقم الهاتف والواتساب:* \`${wizard.data.phone}\`\n` +
        `💳 *طريقة الصرف:* ${payLabel}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔒 _سيتم تشفير البيانات الحساسة وتوليد الكود الوظيفي وتحديث المنظومة فورياً._`;

      const keyboard = buildConfirmationKeyboard({
        confirmText: '✅ تأكيد وحفظ التعيين الرسمي',
        confirmCallbackData: 'action:worker_confirm_save',
        editCallbackData: 'action:worker_step:back',
        cancelCallbackData: 'action:cancel_worker_op',
      });

      await updateWizardMessage(ctx, wizard, text, keyboard);
      break;
    }
  }
}

/**
 * 🛠️ أداة مساعدة لتحديث رسالة المعالج موضعياً (In-Place)
 */
async function updateWizardMessage(
  ctx: MyContext,
  wizard: PendingWorkerWizardState,
  text: string,
  keyboard: InlineKeyboard
): Promise<void> {
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return;
    } catch {
      // fallback
    }
  }

  const sent = await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
  wizard.messageId = sent.message_id;
  if (ctx.from) {
    await setPendingWorkerWizard(BigInt(ctx.from.id), wizard);
  }
}

/**
 * 💾 تنفيذ الحفظ النهائي للعامل الجديد وبطاقة الإتمام الموحدة
 */
export async function handleConfirmSaveWorker(ctx: MyContext): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: 'جاري الحفظ وتحديث المنظومة...' });
  }
  if (!ctx.from) return;

  const telegramId = BigInt(ctx.from.id);
  const wizard = await getPendingWorkerWizard(telegramId);
  if (!wizard || !wizard.data.fullName || !wizard.data.idNumber) {
    await ctx.reply('❌ انتهت صلاحية الجلسة، يرجى إعادة بدء المعالج.');
    return;
  }

  try {
    const bDate = wizard.data.birthDateStr ? new Date(wizard.data.birthDateStr) : undefined;
    const hDate = wizard.data.hireDateStr ? new Date(wizard.data.hireDateStr) : new Date();

    const created = await workerService.createWorker({
      name: wizard.data.fullName,
      nickname: wizard.data.nickname,
      idType: wizard.data.idType || 'NATIONAL_ID',
      idNumber: wizard.data.idNumber,
      nationality: wizard.data.nationality,
      birthDate: bDate,
      gender: wizard.data.gender || 'MALE',
      governorateCode: wizard.data.governorateCode,
      phone: wizard.data.phone || '',
      jobTitleId: wizard.data.jobTitleId,
      jobTitleName: wizard.data.jobTitleName || 'عامل تشغيل',
      siteId: wizard.data.siteId,
      siteName: wizard.data.siteName,
      hireDate: hDate,
      paymentMethod: wizard.data.paymentMethod || 'CASH_SITE',
      accountNumber: wizard.data.walletNumber,
    });

    await clearPendingWorkerWizard(telegramId);

    // لوحة أزرار إتمام العمليات الموحدة (Section 5.2 Universal Post-Action Completion Keyboard)
    const completionKb = buildCompletionKeyboard({
      whatsappUrl: created.welcomeWhatsAppUrl,
      whatsappButtonText: '💬 إرسال بطاقة الترحيب للعامل عبر واتساب',
      repeatButtonText: '➕ تسجيل وتعيين عامل آخر',
      repeatCallbackData: 'action:worker:add_single',
      sectionButtonText: '🔙 العودة لقسم الموارد البشرية',
      sectionCallbackData: 'menu:domain:hr',
      mainMenuCallbackData: 'action:main_menu',
    });

    const successText =
      `🎉 *تم تسجيل وتعيين العامل بنجاح 100%!* (Zero Defects)\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔖 *كود العامل المعتمد:* \`${created.worker.code}\`\n` +
      `👤 *الاسم:* *${created.worker.name}*\n` +
      `💼 *الوظيفة:* ${created.worker.jobTitle} | 📍 *الموقع:* ${created.worker.site?.name || 'عام'}\n` +
      `📅 *تاريخ المباشرة:* ${formatDate(created.worker.hireDate)}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ *ما تم إنجازه آلياً:*\n` +
      `1. توثيق وحفظ السجل بقاعدة البيانات وتشفير الهوية بـ AES-256-GCM.\n` +
      `2. إنشاء الفهرس الأعمى لمنع تكرار القيد نهائياً.\n` +
      `3. تحديث الذاكرة السريعة (L1/L2 Cache).\n` +
      `4. تجهيز رابط بطاقة الترحيب الرسمية عبر واتساب.`;

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(successText, {
          parse_mode: 'Markdown',
          reply_markup: completionKb,
        });
        return;
      } catch {
        // fallback
      }
    }

    await ctx.reply(successText, {
      parse_mode: 'Markdown',
      reply_markup: completionKb,
    });
  } catch (error: any) {
    console.error('Error saving worker:', error);
    const retryKb = new InlineKeyboard()
      .text('🔄 إعادة المحاولة', 'action:worker_confirm_save')
      .row()
      .text('🔙 العودة لقسم الموارد البشرية', 'menu:domain:hr')
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    await ctx.reply(`❌ *تعذر حفظ بيانات العامل:*\n\`${error?.message || 'خطأ غير متوقع'}\``, {
      parse_mode: 'Markdown',
      reply_markup: retryKb,
    });
  }
}

/**
 * 🔙 معالجة زر الرجوع للخطوة السابقة في المعالج
 */
export async function handleWorkerWizardBack(ctx: MyContext): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  if (!ctx.from) return;

  const telegramId = BigInt(ctx.from.id);
  const wizard = await getPendingWorkerWizard(telegramId);
  if (!wizard) {
    await ctx.reply('❌ لا توجد عملية تسجيل نشطة.');
    return;
  }

  // تسلسل الرجوع المنطقي
  switch (wizard.step) {
    case WorkerWizardStep.ID_TYPE:
      wizard.step = WorkerWizardStep.FULL_NAME;
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
    case WorkerWizardStep.PHONE:
      wizard.step = wizard.data.idType === 'PASSPORT' ? WorkerWizardStep.PASSPORT_GENDER : WorkerWizardStep.ID_NUMBER;
      break;
    case WorkerWizardStep.JOB_SELECT:
      wizard.step = WorkerWizardStep.PHONE;
      break;
    case WorkerWizardStep.SITE_SELECT:
      wizard.step = WorkerWizardStep.JOB_SELECT;
      break;
    case WorkerWizardStep.START_DATE:
      wizard.step = WorkerWizardStep.SITE_SELECT;
      break;
    case WorkerWizardStep.PAYMENT_METHOD:
      wizard.step = WorkerWizardStep.START_DATE;
      break;
    case WorkerWizardStep.WALLET_NUMBER:
      wizard.step = WorkerWizardStep.PAYMENT_METHOD;
      break;
    case WorkerWizardStep.CONFIRMATION:
      wizard.step = wizard.data.paymentMethod === 'CASH_SITE' ? WorkerWizardStep.PAYMENT_METHOD : WorkerWizardStep.WALLET_NUMBER;
      break;
    default:
      wizard.step = WorkerWizardStep.FULL_NAME;
      break;
  }

  await setPendingWorkerWizard(telegramId, wizard);
  await renderWizardStep(ctx, wizard);
}
