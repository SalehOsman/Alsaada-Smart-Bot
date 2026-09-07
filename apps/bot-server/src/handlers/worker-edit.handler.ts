import fs from 'node:fs';
import path from 'node:path';
import { InlineKeyboard, InputFile } from 'grammy';
import { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import { config } from '../config/env.js';
import { workerService } from '../services/worker.service.js';
import { workerEditService } from '../services/worker-edit.service.js';
import { googleDriveService } from '../services/google-drive.service.js';
import {
  setPendingWorkerEdit,
  getPendingWorkerEdit,
  clearPendingWorkerEdit,
  PendingWorkerEditState,
} from '../redis.js';
import { normalizeDigits, formatDate } from '@alsaada/regional-engine';
import { decryptField } from '@alsaada/database';

const FIELD_LABELS: Record<string, string> = {
  legacyCode: 'كود العامل القديم / الأرشيفي',
  name: 'الاسم الكامل الرباعي',
  nickname: 'اسم الشهرة المعتمد',
  phone: 'رقم الهاتف والواتساب',
  emergencyPhone: 'هاتف الطوارئ',
  walletNumber: 'رقم المحفظة / الحساب البنكي',
  idCardExpiryDate: 'تاريخ انتهاء سريان البطاقة',
  address: 'محل الإقامة / العنوان',
  drivingLicense: 'رخصة القيادة',
  militaryStatus: 'الموقف التجنيدي',
  maritalStatus: 'الحالة الاجتماعية',
};

/**
 * 👥 بدء معالج تعديل بيانات عامل (عرض قائمة العمال للاختيار)
 */
export async function handleStartWorkerEdit(ctx: MyContext): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  if (!ctx.from) return;

  const role = ctx.effectiveRole || 'GUEST';
  const isSuperAdmin = role === 'SUPER_ADMIN' || ctx.isRealSuperAdmin;

  const workers = await workerService.getRecentWorkers(10).catch(() => []);

  const keyboard = new InlineKeyboard();

  for (const w of workers) {
    const legacyTag = w.legacyCode ? ` [قديم: ${w.legacyCode}]` : '';
    keyboard
      .text(`👤 ${w.name} (${w.code})${legacyTag}`, `action:worker_edit:menu:${w.id}`)
      .row();
  }

  // إذا كان سوبر أدمن، نعرض زر استعراض الطلبات المعلقة إن وجدت
  if (isSuperAdmin) {
    const pendingCount = await prisma.workerEditRequest.count({ where: { status: 'PENDING' } });
    if (pendingCount > 0) {
      keyboard
        .text(`📨 مراجعة طلبات التعديل المعلقة (${pendingCount})`, 'action:worker_edit:pending_list')
        .row();
    }
  }

  keyboard
    .text('🔙 العودة لقسم الموارد البشرية', 'menu:domain:hr')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  const title = isSuperAdmin
    ? '✏️ *تعديل بيانات عامل (تنفيذ فوري للسوبر أدمن)*'
    : '📝 *تقديم طلب تعديل بيانات عامل (مراجعة واعتماد)*';

  const text =
    `${title}\n` +
    '━━━━━━━━━━━━━━━━━━━━━\n' +
    'اختر العامل المطلوب من السجلات الحديثة أدناه للبدء:\n\n' +
    (isSuperAdmin
      ? '💡 _بصفتك المدير العام، سيتم تطبيق كافة التعديلات (بما فيها كود العامل القديم) فورياً في قاعدة البيانات._'
      : '💡 _بصفتك مشرفاً ميدانياً، سيتم إرسال طلب التعديل للمدير العام للاعتماد الرسمي قبل تطبيقه._');

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

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

/**
 * 📋 تصيير لوحة خيارات التعديل لعامل محدد
 */
export async function renderWorkerEditMenu(
  ctx: MyContext,
  workerId: string,
  inPlace = false
): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    include: { site: true, jobRef: true },
  });

  if (!worker) {
    await ctx.reply('⚠️ لم يتم العثور على سجل العامل.');
    return;
  }

  const role = ctx.effectiveRole || 'GUEST';
  const isSuperAdmin = role === 'SUPER_ADMIN' || ctx.isRealSuperAdmin;

  let cleanPhone = worker.phoneEncrypted || '-';
  if (config.databaseEncryptionKey && worker.phoneEncrypted) {
    try {
      cleanPhone = decryptField(worker.phoneEncrypted, config.databaseEncryptionKey);
    } catch {
      cleanPhone = worker.phoneEncrypted;
    }
  }

  let cleanWallet = worker.accountNumberEncrypted || '-';
  if (config.databaseEncryptionKey && worker.accountNumberEncrypted) {
    try {
      cleanWallet = decryptField(worker.accountNumberEncrypted, config.databaseEncryptionKey);
    } catch {
      cleanWallet = worker.accountNumberEncrypted;
    }
  }

  const expiryFormatted = worker.idCardExpiryDate ? formatDate(worker.idCardExpiryDate) : 'غير مسجل';
  const addressFormatted = worker.address || 'غير مسجل';

  const keyboard = new InlineKeyboard()
    .text(`🏷️ كود العامل القديم (${worker.legacyCode || 'غير مسجل'})`, `action:worker_edit:field:${worker.id}:legacyCode`)
    .row()
    .text(`👤 الاسم الكامل (${worker.name})`, `action:worker_edit:field:${worker.id}:name`)
    .row()
    .text(`🏷️ اسم الشهرة (${worker.nickname || '-'})`, `action:worker_edit:field:${worker.id}:nickname`)
    .row()
    .text(`📱 رقم الهاتف (${cleanPhone})`, `action:worker_edit:field:${worker.id}:phone`)
    .row()
    .text(`💳 رقم المحفظة (${cleanWallet})`, `action:worker_edit:field:${worker.id}:walletNumber`)
    .row()
    .text(`🏠 العنوان (${addressFormatted.length > 20 ? addressFormatted.substring(0, 18) + '...' : addressFormatted})`, `action:worker_edit:field:${worker.id}:address`)
    .row()
    .text(`⏳ انتهاء البطاقة (${expiryFormatted})`, `action:worker_edit:field:${worker.id}:idCardExpiryDate`)
    .row()
    .text('🚨 هاتف الطوارئ', `action:worker_edit:field:${worker.id}:emergencyPhone`)
    .row()
    .text('📁 إضافة مرفق للعامل (صور / PDF)', `action:worker_edit:add_doc:${worker.id}`)
    .text('📂 استعراض المرفقات', `action:worker_edit:list_docs:${worker.id}`)
    .row()
    .text('◀️ رجوع لقائمة العمال', 'action:worker_edit:pick')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  const title = isSuperAdmin
    ? '✏️ *لوحة تعديل بيانات العامل (تنفيذ فوري للسوبر أدمن)*'
    : '📝 *طلب تعديل بيانات العامل (يخضع لموافقة السوبر أدمن)*';

  const text =
    `${title}\n` +
    '━━━━━━━━━━━━━━━━━━━━━\n' +
    `👤 *العامل:* *${worker.name}* (كود رسمي: \`${worker.code}\`)\n` +
    `🏷️ *الكود القديم الأرشيفي:* *${worker.legacyCode || 'غير مسجل'}*\n` +
    `💼 *الوظيفة:* ${worker.jobTitle} | 📍 *الموقع:* ${worker.site?.name || 'غير محدد'}\n` +
    `🏠 *العنوان ومحل الإقامة:* *${addressFormatted}*\n` +
    `📱 *الهاتف:* \`${cleanPhone}\` | 💳 *المحفظة:* \`${cleanWallet}\`\n` +
    `⏳ *تاريخ انتهاء البطاقة:* *${expiryFormatted}*\n` +
    '━━━━━━━━━━━━━━━━━━━━━\n' +
    'اختر البيان المراد تعديله أو أضف وثائق ومرفقات للعامل:';

  if (inPlace && ctx.callbackQuery) {
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

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

/**
 * ✏️ بدء تعديل حقل محدد
 */
export async function handleStartEditWorkerField(
  ctx: MyContext,
  workerId: string,
  fieldKey: string
): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  if (!ctx.from) return;

  const worker = await prisma.worker.findUnique({ where: { id: workerId } });
  if (!worker) {
    await ctx.reply('⚠️ لم يتم العثور على سجل العامل.');
    return;
  }

  const role = ctx.effectiveRole || 'GUEST';
  const isSuperAdmin = role === 'SUPER_ADMIN' || ctx.isRealSuperAdmin;
  const fieldName = FIELD_LABELS[fieldKey] || fieldKey;

  let currentVal = '-';
  if (fieldKey === 'legacyCode') currentVal = worker.legacyCode || '-';
  else if (fieldKey === 'name') currentVal = worker.name;
  else if (fieldKey === 'nickname') currentVal = worker.nickname || '-';
  else if (fieldKey === 'address') currentVal = worker.address || '-';
  else if (fieldKey === 'idCardExpiryDate')
    currentVal = worker.idCardExpiryDate ? formatDate(worker.idCardExpiryDate) : '-';

  const keyboard = new InlineKeyboard()
    .text('◀️ إلغاء والعودة لبيانات العامل', `action:worker_edit:menu:${worker.id}`)
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  const text =
    (isSuperAdmin ? '✏️ *تعديل فوري مباشر*' : '📝 *تقديم طلب تعديل*') +
    ` لـ *${fieldName}*\n` +
    '━━━━━━━━━━━━━━━━━━━━━\n' +
    `👤 *العامل:* *${worker.name}* (\`${worker.code}\`)\n` +
    `📌 *القيمة الحالية:* *${currentVal}*\n\n` +
    (fieldKey === 'idCardExpiryDate'
      ? 'يرجى إدخال تاريخ انتهاء البطاقة الجديد بصيغة: *YYYY-MM-DD* (مثال: 2029-10-15):'
      : fieldKey === 'legacyCode'
      ? 'يرجى إدخال كود العامل القديم / الأرشيفي (أرقام أو حروف إنجليزية):'
      : fieldKey === 'address'
      ? 'يرجى إدخال العنوان ومحل الإقامة الجديد بالتفصيل (المحافظة، المركز/القسم، القرية أو الشارع):'
      : `يرجى إدخال القيمة الجديدة لـ *${fieldName}* الآن:`);

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

  const telegramId = BigInt(ctx.from.id);
  const editState: PendingWorkerEditState = {
    workerId: worker.id,
    workerCode: worker.code,
    workerName: worker.name,
    fieldKey,
    fieldName,
    oldValue: currentVal,
    promptMsgId,
  };

  await setPendingWorkerEdit(telegramId, editState);
}

/**
 * 🔄 معالجة المدخلات النصية لتعديل بيانات العامل
 */
export async function handleWorkerEditTextInput(ctx: MyContext): Promise<boolean> {
  if (!ctx.from || !ctx.message?.text) return false;

  const telegramId = BigInt(ctx.from.id);
  const editState = await getPendingWorkerEdit(telegramId);
  if (!editState) return false;

  const inputRaw = ctx.message.text.trim();
  await ctx.api.deleteMessage(ctx.chat!.id, ctx.message.message_id).catch(() => {});

  const role = ctx.effectiveRole || 'GUEST';
  const isSuperAdmin = role === 'SUPER_ADMIN' || ctx.isRealSuperAdmin;

  // التحقق من صحة المدخلات حسب نوع الحقل
  if (editState.fieldKey === 'phone') {
    const cleanPhone = normalizeDigits(inputRaw.replace(/[\s-]/g, ''));
    if (cleanPhone.length !== 11 || !cleanPhone.startsWith('01')) {
      await ctx.reply('⚠️ يرجى إدخال رقم هاتف مصري صحيح مكون من 11 رقماً يبدأ بـ 01.');
      return true;
    }
  } else if (editState.fieldKey === 'idCardExpiryDate') {
    const cleanDate = normalizeDigits(inputRaw.replace(/[\/.]/g, '-'));
    if (!cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      await ctx.reply('⚠️ يرجى إدخال تاريخ انتهاء البطاقة بصيغة: YYYY-MM-DD (مثال: 2029-10-15).');
      return true;
    }
  } else if (editState.fieldKey === 'legacyCode') {
    if (inputRaw.length < 1 || inputRaw === '-') {
      await ctx.reply('⚠️ كود العامل القديم غير صالح.');
      return true;
    }
  } else if (editState.fieldKey === 'address') {
    if (inputRaw.length < 3) {
      await ctx.reply('⚠️ يرجى إدخال عنوان واضح ومفصل (المحافظة، المركز/القسم، القرية أو الشارع).');
      return true;
    }
  }

  // إذا كان المستخدم سوبر أدمن -> تطبيق فوري
  if (isSuperAdmin) {
    try {
      await workerEditService.applyDirectSuperAdminEdit(
        editState.workerId,
        editState.fieldKey!,
        inputRaw
      );
      await clearPendingWorkerEdit(telegramId);

      const completionKeyboard = new InlineKeyboard()
        .text('✏️ تعديل بيان آخر لنفس العامل', `action:worker_edit:menu:${editState.workerId}`)
        .row()
        .text('👥 دليل وسجل العاملين', 'action:worker:directory')
        .row()
        .text('🔙 العودة للموارد البشرية', 'menu:domain:hr')
        .row()
        .text('🏠 القائمة الرئيسية', 'action:main_menu');

      const successText =
        '✅ *تم تحديث بيانات العامل بنجاح فورياً!*\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        `👤 *العامل:* *${editState.workerName}* (\`${editState.workerCode}\`)\n` +
        `📌 *البيان:* *${editState.fieldName}*\n` +
        `⏮️ *القيمة السابقة:* ${editState.oldValue}\n` +
        `⏭️ *القيمة المعتمدة الجديدة:* *${inputRaw}*\n` +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        '⚡ تم حفظ التعديل بقاعدة البيانات وتحديث الذاكرة السريعة L1/L2.';

      if (editState.promptMsgId && ctx.chat) {
        await ctx.api.editMessageText(ctx.chat.id, editState.promptMsgId, successText, {
          parse_mode: 'Markdown',
          reply_markup: completionKeyboard,
        });
      } else {
        await ctx.reply(successText, {
          parse_mode: 'Markdown',
          reply_markup: completionKeyboard,
        });
      }
      return true;
    } catch (err: any) {
      console.error('Error applying direct worker edit:', err);
      await ctx.reply(`❌ تعذر تطبيق التعديل: ${err?.message || 'خطأ غير متوقع'}`);
      return true;
    }
  }

  // إذا كان المستخدم مشرفاً ميدانياً أو عاملاً -> إنشاء طلب تعديل PENDING
  try {
    const requesterName = ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : '');
    const request = await workerEditService.createEditRequest({
      workerId: editState.workerId,
      workerCode: editState.workerCode,
      workerName: editState.workerName,
      requesterTelegramId: telegramId,
      requesterName,
      requesterRole: role,
      fieldKey: editState.fieldKey!,
      fieldName: editState.fieldName!,
      oldValue: editState.oldValue,
      newValue: inputRaw,
      reason: 'طلب تعديل مرفوع من لوحة المشرف الميداني',
    });

    await clearPendingWorkerEdit(telegramId);

    // إشعار المستخدم بنجاح الرفع وانتظار الاعتماد
    const completionKeyboard = new InlineKeyboard()
      .text('📝 تقديم طلب تعديل آخر', 'action:worker_edit:pick')
      .row()
      .text('🔙 العودة للموارد البشرية', 'menu:domain:hr')
      .row()
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    const submittedText =
      '📨 *تم رفع طلب تعديل بيانات العامل بنجاح!*\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      `🆔 *رقم الطلب:* \`${request.requestId}\`\n` +
      `👤 *العامل:* *${editState.workerName}* (\`${editState.workerCode}\`)\n` +
      `📌 *البيان المطلوب تعديله:* *${editState.fieldName}*\n` +
      `⏮️ *القيمة الحالية:* ${editState.oldValue}\n` +
      `⏭️ *القيمة المقترحة:* *${inputRaw}*\n` +
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      '⏳ *الحالة:* قيد مراجعة واعتماد المدير العام (السوبر أدمن).\n' +
      '💡 لن يتم تطبيق هذا التعديل على سجل العامل إلا بعد اعتماده رسمياً.';

    if (editState.promptMsgId && ctx.chat) {
      await ctx.api.editMessageText(ctx.chat.id, editState.promptMsgId, submittedText, {
        parse_mode: 'Markdown',
        reply_markup: completionKeyboard,
      });
    } else {
      await ctx.reply(submittedText, {
        parse_mode: 'Markdown',
        reply_markup: completionKeyboard,
      });
    }

    // إرسال بطاقة حوكمة للسوبر أدمن للاعتماد الفوري
    if (config.superAdminTelegramId && config.superAdminTelegramId > 0n) {
      const adminApprovalKb = new InlineKeyboard()
        .text('✅ اعتماد وتطبيق التعديل', `action:worker_req:approve:${request.requestId}`)
        .row()
        .text('❌ رفض الطلب', `action:worker_req:reject:${request.requestId}`)
        .row()
        .text('👤 فتح ملف العامل', `action:worker_edit:menu:${editState.workerId}`);

      try {
        await ctx.api.sendMessage(
          Number(config.superAdminTelegramId),
          '🔔 *طلب تعديل بيانات عامل جديد بحاجة للمراجعة والاعتماد*\n' +
          '━━━━━━━━━━━━━━━━━━━━━\n' +
          `🆔 *رقم الطلب:* \`${request.requestId}\`\n` +
          `👤 *العامل:* *${editState.workerName}* (\`${editState.workerCode}\`)\n` +
          `👨‍💼 *مقدم الطلب:* *${requesterName}* (${role})\n` +
          `📌 *البيان المطلوب تعديله:* *${editState.fieldName}*\n` +
          `⏮️ *القيمة الحالية:* ${editState.oldValue}\n` +
          `⏭️ *القيمة المقترحة:* *${inputRaw}*\n` +
          '━━━━━━━━━━━━━━━━━━━━━\n' +
          'اضغط على الزر أدناه للاعتماد الفوري والتطبيق المباشر على سجل العامل.',
          { parse_mode: 'Markdown', reply_markup: adminApprovalKb }
        );
      } catch (adminErr) {
        console.warn('⚠️ Could not dispatch edit request card to Super Admin:', adminErr);
      }
    }

    return true;
  } catch (err: any) {
    console.error('Error creating worker edit request:', err);
    await ctx.reply(`❌ تعذر رفع طلب التعديل: ${err?.message || 'خطأ غير متوقع'}`);
    return true;
  }
}

/**
 * ✅ اعتماد طلب التعديل وتطبيقه ذرياً بواسطة السوبر أدمن
 */
export async function handleApproveEditRequest(ctx: MyContext, requestId: string): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: 'جاري تطبيق التعديل...' }).catch(() => {});
  }
  if (!ctx.from) return;

  const adminTelegramId = BigInt(ctx.from.id);

  try {
    const updatedRequest = await workerEditService.approveEditRequest(requestId, adminTelegramId);

    const approvedText =
      '✅ *تم اعتماد وتطبيق طلب التعديل بنجاح!*\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      `🆔 *رقم الطلب:* \`${updatedRequest.requestId}\`\n` +
      `👤 *العامل:* *${updatedRequest.workerName}* (\`${updatedRequest.workerCode}\`)\n` +
      `📌 *البيان:* *${updatedRequest.fieldName}*\n` +
      `⏭️ *القيمة المعتمدة:* *${updatedRequest.newValue}*\n` +
      `📅 *تاريخ الاعتماد:* ${formatDate(updatedRequest.reviewedAt || new Date())}\n` +
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      '⚡ تم تحديث قاعدة البيانات وتحديث الذاكرة اللحظية بنجاح.';

    const kb = new InlineKeyboard()
      .text('👤 فتح ملف العامل', `action:worker_edit:menu:${updatedRequest.workerId}`)
      .row()
      .text('🔙 العودة لقسم الموارد البشرية', 'menu:domain:hr');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(approvedText, {
        parse_mode: 'Markdown',
        reply_markup: kb,
      });
    }

    // إشعار مقدم الطلب إذا كان لديه حساب تليجرام
    if (updatedRequest.requesterTelegramId) {
      try {
        await ctx.api.sendMessage(
          Number(updatedRequest.requesterTelegramId),
          `🔔 *إشعار إداري: تم اعتماد طلبك رقم \`${updatedRequest.requestId}\`*\n` +
          `تمت الموافقة على تعديل *${updatedRequest.fieldName}* للعامل *${updatedRequest.workerName}* وتطبيق القيمة الجديدة بنجاح.`
        );
      } catch {
        // ignore
      }
    }
  } catch (err: any) {
    console.error('Error approving worker edit request:', err);
    await ctx.reply(`❌ تعذر اعتماد الطلب: ${err?.message || 'خطأ غير معروف'}`);
  }
}

/**
 * ❌ رفض طلب التعديل بواسطة السوبر أدمن
 */
export async function handleRejectEditRequest(ctx: MyContext, requestId: string): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: 'تم رفض الطلب' }).catch(() => {});
  }
  if (!ctx.from) return;

  const adminTelegramId = BigInt(ctx.from.id);

  try {
    const updatedRequest = await workerEditService.rejectEditRequest(requestId, adminTelegramId);

    const rejectedText =
      '❌ *تم رفض طلب تعديل البيانات*\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      `🆔 *رقم الطلب:* \`${updatedRequest.requestId}\`\n` +
      `👤 *العامل:* *${updatedRequest.workerName}* (\`${updatedRequest.workerCode}\`)\n` +
      `📌 *البيان المطلوب:* *${updatedRequest.fieldName}*\n` +
      `🚫 *السبب:* تم الرفض بواسطة المدير العام\n` +
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      'تم إغلاق الطلب دون أي تغيير في بيانات العامل.';

    if (ctx.callbackQuery) {
      await ctx.editMessageText(rejectedText, {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().text('🔙 العودة لقسم الموارد البشرية', 'menu:domain:hr'),
      });
    }

    // إشعار مقدم الطلب
    if (updatedRequest.requesterTelegramId) {
      try {
        await ctx.api.sendMessage(
          Number(updatedRequest.requesterTelegramId),
          `🔔 *إشعار إداري: تم رفض طلب التعديل رقم \`${updatedRequest.requestId}\`*\n` +
          `تم رفض طلب تعديل *${updatedRequest.fieldName}* للعامل *${updatedRequest.workerName}*.`
        );
      } catch {
        // ignore
      }
    }
  } catch (err: any) {
    console.error('Error rejecting worker edit request:', err);
    await ctx.reply(`❌ تعذر رفض الطلب: ${err?.message || 'خطأ غير معروف'}`);
  }
}

/**
 * 📨 استعراض قائمة طلبات التعديل المعلقة للسوبر أدمن
 */
export async function handleViewPendingEditRequests(ctx: MyContext): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  const pendingList = await workerEditService.getPendingRequests();

  if (pendingList.length === 0) {
    const kb = new InlineKeyboard()
      .text('🔙 العودة لقسم الموارد البشرية', 'menu:domain:hr')
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    const text =
      '📨 *طلبات تعديل بيانات العمال المعلقة*\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      '✅ لا توجد أي طلبات تعديل معلقة حالياً. كافة الطلبات تمت معالجتها والبت فيها.';

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
    }
    return;
  }

  const keyboard = new InlineKeyboard();

  let text =
    '📨 *طلبات تعديل بيانات العمال المعلقة بحاجة للاعتماد*\n' +
    '━━━━━━━━━━━━━━━━━━━━━\n';

  pendingList.forEach((req, idx) => {
    text +=
      `${idx + 1}. \`${req.requestId}\` | *${req.workerName}*\n` +
      `   • المطلوب: ${req.fieldName} ⬅️ *${req.newValue}*\n` +
      `   • مقدم الطلب: ${req.requesterName} (${req.requesterRole})\n\n`;

    keyboard
      .text(`✅ اعتماد [${req.requestId}]`, `action:worker_req:approve:${req.requestId}`)
      .text(`❌ رفض`, `action:worker_req:reject:${req.requestId}`)
      .row();
  });

  keyboard
    .text('🔙 العودة لقسم الموارد البشرية', 'menu:domain:hr')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  } else {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

/**
 * 📁 بدء رفع مستند أو مرفق إضافي للعامل (صور / PDF)
 */
export async function handleStartAddWorkerDoc(ctx: MyContext, workerId: string): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  if (!ctx.from) return;

  const worker = await prisma.worker.findUnique({ where: { id: workerId } });
  if (!worker) {
    await ctx.reply('⚠️ لم يتم العثور على سجل العامل.');
    return;
  }

  const keyboard = new InlineKeyboard()
    .text('◀️ إلغاء والعودة لبيانات العامل', `action:worker_edit:menu:${worker.id}`)
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  const text =
    '📁 *إضافة مرفق أو مستند لملف العامل*\n' +
    '━━━━━━━━━━━━━━━━━━━━━\n' +
    `👤 *العامل:* *${worker.name}* (\`${worker.code}\`)\n` +
    `🗂️ *المجلد المخصص للعامل:* \`attachments/workers/${worker.code}/\`\n\n` +
    'يرجى إرسال المستند الآن كـ *ملف (Document)* أو *صورة (Photo)*:\n\n' +
    '📌 *المستندات المقبولة:*\n' +
    '• ملفات PDF (عقود، شهادات صحية، فيش وتشبيه، إقرارات، إلخ)\n' +
    '• صور مستندات ورخص وشهادات (JPG, PNG)\n' +
    '• سيتم حفظ المرفق تلقائياً في مجلد العامل الخاص ومزامنته سحابياً مع Google Drive.';

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

  const telegramId = BigInt(ctx.from.id);
  const editState: PendingWorkerEditState = {
    workerId: worker.id,
    workerCode: worker.code,
    workerName: worker.name,
    promptMsgId,
    isDocUpload: true,
  };

  await setPendingWorkerEdit(telegramId, editState);
}

/**
 * 📥 استقبال ومعالجة المرفق المرفوع لملف العامل (صورة أو PDF)
 */
export async function handleWorkerEditDocumentInput(ctx: MyContext): Promise<boolean> {
  if (!ctx.from) return false;
  const telegramId = BigInt(ctx.from.id);
  const editState = await getPendingWorkerEdit(telegramId);
  if (!editState || !editState.isDocUpload) return false;

  let fileId = '';
  let originalFileName = '';
  let mimeType = 'application/octet-stream';

  if (ctx.message?.photo && ctx.message.photo.length > 0) {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    fileId = photo.file_id;
    originalFileName = `photo_${Date.now()}.jpg`;
    mimeType = 'image/jpeg';
  } else if (ctx.message?.document) {
    const doc = ctx.message.document;
    fileId = doc.file_id;
    originalFileName = doc.file_name || `doc_${Date.now()}.pdf`;
    mimeType = doc.mime_type || 'application/pdf';
  } else {
    return false;
  }

  const waitMsg = await ctx.reply('⏳ جاري استلام وحفظ المرفق في مجلد العامل والمزامنة مع Google Drive...');

  try {
    const file = await ctx.api.getFile(fileId);
    if (!file.file_path) {
      throw new Error('تعذر تنزيل الملف من خوادم تليجرام.');
    }

    const downloadUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      throw new Error(`فشل تنزيل الملف من تليجرام (HTTP ${res.status})`);
    }

    const fileBuffer = Buffer.from(await res.arrayBuffer());

    // حفظ في مجلد العامل المخصص ورفع لـ Google Drive
    const archiveResult = await googleDriveService.processAndArchiveWorkerAttachment(
      editState.workerCode,
      originalFileName,
      fileBuffer,
      mimeType
    );

    // تسجيل المستند في Prisma WorkerDocument
    await prisma.workerDocument.create({
      data: {
        workerId: editState.workerId,
        title: originalFileName,
        category: 'OTHER',
        fileName: archiveResult.fileName,
        fileType: mimeType,
        fileUri: archiveResult.localPath,
        driveFileId: archiveResult.driveFileId,
        fileSizeBytes: BigInt(fileBuffer.length),
        uploadedBy: telegramId,
      },
    });

    await clearPendingWorkerEdit(telegramId);
    await ctx.api.deleteMessage(ctx.chat!.id, waitMsg.message_id).catch(() => {});

    const completionKeyboard = new InlineKeyboard()
      .text('📁 إضافة مرفق آخر لنفس العامل', `action:worker_edit:add_doc:${editState.workerId}`)
      .row()
      .text('📂 استعراض كافة مرفقات العامل', `action:worker_edit:list_docs:${editState.workerId}`)
      .row()
      .text('👤 العودة لبيانات العامل', `action:worker_edit:menu:${editState.workerId}`)
      .row()
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    const driveNote = archiveResult.driveFileId
      ? '\n☁️ *Google Drive:* تم رفع ومزامنة المستند سحابياً بنجاح.'
      : '';

    const successText =
      '🎉 *تم حفظ وأرشفة مستند العامل بنجاح!*\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n' +
      `👤 *العامل:* *${editState.workerName}* (\`${editState.workerCode}\`)\n` +
      `📄 *اسم المستند:* \`${originalFileName}\`\n` +
      `📁 *المسار المحلي:* \`${archiveResult.localPath}\`\n` +
      `📊 *الحجم:* ${(fileBuffer.length / 1024).toFixed(1)} KB` +
      driveNote +
      '\n━━━━━━━━━━━━━━━━━━━━━\n' +
      '✅ تم تسجيل المستند وربطه بملف العامل في قاعدة البيانات بنجاح.';

    await ctx.reply(successText, {
      parse_mode: 'Markdown',
      reply_markup: completionKeyboard,
    });
    return true;
  } catch (err: any) {
    console.error('Error saving worker attachment:', err);
    await ctx.api.deleteMessage(ctx.chat!.id, waitMsg.message_id).catch(() => {});
    await ctx.reply(`❌ تعذر حفظ المرفق: ${err?.message || 'خطأ غير معروف'}`);
    return true;
  }
}

/**
 * 📂 استعراض كافة مرفقات ومستندات العامل
 */
export async function handleListWorkerDocs(ctx: MyContext, workerId: string): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    include: { documents: { orderBy: { createdAt: 'desc' } } },
  });

  if (!worker) {
    await ctx.reply('⚠️ لم يتم العثور على سجل العامل.');
    return;
  }

  const keyboard = new InlineKeyboard();

  let text =
    '📂 *سجل مرفقات ومستندات العامل*\n' +
    '━━━━━━━━━━━━━━━━━━━━━\n' +
    `👤 *العامل:* *${worker.name}* (\`${worker.code}\`)\n` +
    `🗂️ *مجلد المرفقات المخصص:* \`attachments/workers/${worker.code}/\`\n\n` +
    '🪪 *وثائق الهوية الرسمية:*\n';

  if (worker.idCardFrontPath) {
    text += `• وجه البطاقة: \`${worker.idCardFrontPath}\`\n`;
    keyboard.text('👁️ عرض وجه البطاقة', `action:worker_doc:send_id:${worker.id}:front`).row();
  } else {
    text += '• وجه البطاقة: غير متوفر\n';
  }

  if (worker.idCardBackPath) {
    text += `• ظهر البطاقة: \`${worker.idCardBackPath}\`\n`;
    keyboard.text('👁️ عرض ظهر البطاقة', `action:worker_doc:send_id:${worker.id}:back`).row();
  } else {
    text += '• ظهر البطاقة: غير متوفر\n';
  }

  text += `\n📑 *المستندات والملحقات الإضافية (${worker.documents.length}):*\n`;

  if (worker.documents.length === 0) {
    text += 'لا توجد مرفقات إضافية مسجلة حالياً.\n';
  } else {
    worker.documents.forEach((doc, idx) => {
      const sizeKb = doc.fileSizeBytes ? `(${(Number(doc.fileSizeBytes) / 1024).toFixed(0)} KB)` : '';
      text += `${idx + 1}. *${doc.title}* ${sizeKb}\n   📁 \`${doc.fileUri}\`\n`;
      keyboard.text(`📥 تحميل [${doc.title.substring(0, 18)}]`, `action:worker_doc:send:${doc.id}`).row();
    });
  }

  keyboard
    .text('📁 إضافة مرفق جديد', `action:worker_edit:add_doc:${worker.id}`)
    .row()
    .text('👤 العودة لبيانات العامل', `action:worker_edit:menu:${worker.id}`)
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      return;
    } catch {
      // fallback
    }
  }

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

/**
 * 📥 إرسال مستند العامل مباشرة في تليجرام للمعاينة أو التنزيل
 */
export async function handleSendWorkerDoc(ctx: MyContext, docId: string): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: 'جاري إرسال المستند...' }).catch(() => {});
  }

  const doc = await prisma.workerDocument.findUnique({
    where: { id: docId },
    include: { worker: true },
  });

  if (!doc) {
    await ctx.reply('⚠️ لم يتم العثور على سجل المستند.');
    return;
  }

  const fullPath = path.isAbsolute(doc.fileUri) ? doc.fileUri : path.join(process.cwd(), doc.fileUri);
  if (!fs.existsSync(fullPath)) {
    await ctx.reply(
      `⚠️ لم يتم العثور على الملف محلياً في المسار: \`${doc.fileUri}\`\n${
        doc.driveFileId ? `☁️ معرف Google Drive: \`${doc.driveFileId}\`` : ''
      }`
    );
    return;
  }

  try {
    const isImage = doc.fileType.startsWith('image/');
    if (isImage) {
      await ctx.replyWithPhoto(new InputFile(fullPath, doc.fileName), {
        caption: `📄 *${doc.title}*\n👤 العامل: *${doc.worker.name}* (\`${doc.worker.code}\`)`,
        parse_mode: 'Markdown',
      });
    } else {
      await ctx.replyWithDocument(new InputFile(fullPath, doc.fileName), {
        caption: `📄 *${doc.title}*\n👤 العامل: *${doc.worker.name}* (\`${doc.worker.code}\`)`,
        parse_mode: 'Markdown',
      });
    }
  } catch (err: any) {
    console.error('Error sending worker doc:', err);
    await ctx.reply(`❌ تعذر إرسال المستند: ${err?.message || 'خطأ غير متوقع'}`);
  }
}

/**
 * 🪪 إرسال صورة بطاقة العامل (وجه أو ظهر)
 */
export async function handleSendWorkerIdPhoto(
  ctx: MyContext,
  workerId: string,
  side: 'front' | 'back'
): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: 'جاري إرسال الصورة...' }).catch(() => {});
  }

  const worker = await prisma.worker.findUnique({ where: { id: workerId } });
  if (!worker) {
    await ctx.reply('⚠️ لم يتم العثور على سجل العامل.');
    return;
  }

  const relPath = side === 'front' ? worker.idCardFrontPath : worker.idCardBackPath;
  if (!relPath) {
    await ctx.reply(`⚠️ صورة ${side === 'front' ? 'وجه' : 'ظهر'} البطاقة غير مسجلة.`);
    return;
  }

  const fullPath = path.isAbsolute(relPath) ? relPath : path.join(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) {
    await ctx.reply(`⚠️ تعذر العثور على الصورة محلياً في المسار: \`${relPath}\``);
    return;
  }

  try {
    await ctx.replyWithPhoto(new InputFile(fullPath), {
      caption: `🪪 *صورة ${side === 'front' ? 'وجه' : 'ظهر'} البطاقة*\n👤 العامل: *${worker.name}* (\`${worker.code}\`)`,
      parse_mode: 'Markdown',
    });
  } catch (err: any) {
    console.error('Error sending worker ID photo:', err);
    await ctx.reply(`❌ تعذر إرسال الصورة: ${err?.message || 'خطأ غير متوقع'}`);
  }
}
