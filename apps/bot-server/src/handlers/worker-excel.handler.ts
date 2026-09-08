import { InlineKeyboard, InputFile } from 'grammy';
import { MyContext } from '../types/context.js';
import { workerExcelService, WorkerExportFilter } from '../services/worker-excel.service.js';
import { prisma } from '../db.js';
import { EGYPTIAN_GOVERNORATES } from '@alsaada/national-id-engine';
import {
   setPendingWorkerExcelUpload,
   getPendingWorkerExcelUpload,
   clearPendingWorkerExcelUpload,
 } from '../redis.js';
import { screenFlowService } from '../services/screen-flow.service.js';
import { buildCompletionKeyboard } from '@alsaada/core-components';

/**
 * 📥 تنزيل قالب إكسيل استيراد العمالة الرسمي
 * محمي بحراسة سيادية: للسوبر أدمن فقط
 */
export async function handleDownloadWorkerTemplate(ctx: MyContext): Promise<void> {
  if (!ctx.isRealSuperAdmin) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '🔒 هذه الوظيفة مقتصرة على المدير العام فقط.' });
    }
    return;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: 'جاري توليد قالب استيراد العمالة...' });
  }

  try {
    const buffer = await workerExcelService.generateTemplateBuffer();
    const inputFile = new InputFile(buffer, 'قالب_استيراد_العمالة_شركة_السعادة.xlsx');

    const completionKeyboard = new InlineKeyboard()
      .text('📤 رفع الملف بعد التعبئة', 'action:worker:upload_excel')
      .row()
      .text('🔙 العودة لقسم الموارد البشرية', 'menu:domain:hr')
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    await ctx.replyWithDocument(inputFile, {
      caption:
        `📥 *قالب استيراد وقيد العمالة المعتمد (إكسيل)*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `تم توليد القالب الرسمي لشركة السعادة بتنسيق معتمد يتضمن:\n\n` +
        `1️⃣ *ورقة بيانات العمال:* تشمل العمالة المصرية (بالرقم القومي) والوافدة (بجواز السفر).\n` +
        `2️⃣ *ورقة دليل الأكواد:* قراءة حية لكافة أكواد الوظائف والمواقع المسجلة لتفادي أخطاء التعبئة.\n\n` +
        `💡 *طريقة الاستخدام:*\n` +
        `• قم بتعبئة بيانات العمال في الورقة الأولى.\n` +
        `• اضغط أدناه على [ 📤 رفع الملف بعد التعبئة ] أو أرسل الملف مباشرة هنا.`,
      parse_mode: 'Markdown',
      reply_markup: completionKeyboard,
    });
  } catch (error) {
    console.error('Failed to generate worker template Excel:', error);
    await ctx.reply('❌ تعذر توليد ملف القالب حالياً. يرجى المحاولة لاحقاً.');
  }
}

/**
 * 📤 بدء معالج رفع واستيراد ملف الإكسيل
 */
export async function handleStartUploadWorkerExcel(ctx: MyContext): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '🔒 هذه الوظيفة مقتصرة على المدير العام فقط.' });
    }
    return;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
  }

  const telegramId = BigInt(ctx.from.id);

  const keyboard = new InlineKeyboard()
    .text('📥 تنزيل القالب المعتمد أولاً', 'action:worker:download_excel')
    .row()
    .text('❌ إلغاء العملية', 'action:cancel_worker_op')
    .text('🔙 العودة لقسم الموارد البشرية', 'menu:domain:hr');

  const text =
    `📤 *رفع كشف العمالة دفعة واحدة (ملف إكسيل .xlsx)*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `يرجى إرسال ملف الإكسيل المعبأ كملف مستند (Document) هنا في المحادثة.\n\n` +
    `⚠️ *شروط هامة للاستيراد السليم:*\n` +
    `• يجب أن يكون الملف بنفس أعمدة القالب الرسمي المعتمد.\n` +
    `• التحقق من دقة الأرقام القومية (14 رقماً) أو أرقام الجوازات والتواريخ.\n` +
    `• مطابقة أكواد الوظائف والمواقع مع ورقة دليل الأكواد.\n\n` +
    `_في انتظار إرسال الملف الآن..._`;

  const inPlace = await screenFlowService.shouldRenderInPlace(ctx, true);

  let promptMsgId = 0;
  if (inPlace && ctx.callbackQuery) {
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

  await setPendingWorkerExcelUpload(telegramId, promptMsgId);
  if (ctx.chat && promptMsgId) {
    await screenFlowService.trackActiveScreen(
      telegramId,
      ctx.chat.id,
      promptMsgId,
      'worker_excel_prompt',
      false
    );
  }
}

/**
 * 📥 معالجة استقبال مستند الإكسيل والتحقق منه ذرياً
 */
export async function handleWorkerExcelDocumentUpload(ctx: MyContext): Promise<boolean> {
  if (!ctx.from || !ctx.message?.document) return false;

  const telegramId = BigInt(ctx.from.id);
  const pendingPromptId = await getPendingWorkerExcelUpload(telegramId);
  if (!pendingPromptId) return false;

  if (!ctx.isRealSuperAdmin) {
    await clearPendingWorkerExcelUpload(telegramId);
    return false;
  }

  const doc = ctx.message.document;
  const fileName = doc.file_name || '';
  if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
    const errorKb = new InlineKeyboard()
      .text('📥 تنزيل القالب المعتمد', 'action:worker:download_excel')
      .text('🔄 إعادة المحاولة', 'action:worker:upload_excel')
      .row()
      .text('❌ إلغاء العملية', 'action:cancel_worker_op');

    await ctx.reply(
      `⚠️ *صيغة الملف غير مدعومة!*\nيرجى إرسال ملف إكسيل بصيغة \`.xlsx\` معتمد.`,
      { parse_mode: 'Markdown', reply_markup: errorKb }
    );
    return true;
  }

  const statusMsg = await ctx.reply('⏳ جاري استلام الملف والتحقق الذري من صحة بيانات العمال وسجلات الهوية...');

  try {
    const file = await ctx.api.getFile(doc.file_id);
    if (!file.file_path) {
      throw new Error('Telegram file path not found.');
    }

    const downloadUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file from Telegram: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // معالجة واستيراد الملف
    const result = await workerExcelService.parseAndImportExcel(fileBuffer);

    await clearPendingWorkerExcelUpload(telegramId);
    await ctx.api.deleteMessage(ctx.chat!.id, statusMsg.message_id).catch(() => {});

    if (!result.success) {
      const errorKeyboard = new InlineKeyboard()
        .text('🔄 إعادة المحاولة', 'action:worker:upload_excel')
        .text('📥 تحميل القالب المعتمد', 'action:worker:download_excel')
        .row()
        .text('🔙 العودة للموارد البشرية', 'menu:domain:hr')
        .text('🏠 القائمة الرئيسية', 'action:main_menu');

      const errorList = result.errors.slice(0, 6).join('\n• ');
      const extraCount = result.errors.length > 6 ? `\n_...وهناك ${result.errors.length - 6} أخطاء أخرى._` : '';

      await ctx.reply(
        `❌ *تعذر استيراد كشف العمالة بسبب ملاحظات في التنسيق والبيانات:*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `• ${errorList}${extraCount}\n\n` +
        `⚠️ *تم إيقاف التسجيل بالكامل منعاً لأي قيد جزئي مشوه.*\nيرجى تصحيح الملاحظات أعلاه وإعادة رفع الملف.`,
        {
          parse_mode: 'Markdown',
          reply_markup: errorKeyboard,
        }
      );
      return true;
    }

    // بطاقة إتمام العملية المعتمدة (Universal Post-Action Completion Keyboard)
    const successKeyboard = buildCompletionKeyboard({
      repeatButtonText: '➕ رفع كشف عمال آخر',
      repeatCallbackData: 'action:worker:upload_excel',
      sectionButtonText: '📋 استعراض سجل العاملين المحدث',
      sectionCallbackData: 'action:worker:directory',
      mainMenuCallbackData: 'action:main_menu',
    });

    const sent = await ctx.reply(
      `🎉 *تم استيراد وقيد كشف العمالة بنجاح!*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 *إحصائيات العملية:*\n` +
      `• عدد السجلات المعالجة: *${result.totalRowsProcessed} صف*\n` +
      `• العمال المسجلين الجدد: *${result.workersCreated} عامل*\n\n` +
      `✅ *تم تدقيق ومطابقة كافة البيانات واعتماد تسجيل العمال الجدد رسمياً بالمنظومة.*`,
      {
        parse_mode: 'Markdown',
        reply_markup: successKeyboard,
      }
    );

    if (ctx.chat) {
      await screenFlowService.trackActiveScreen(
        telegramId,
        ctx.chat.id,
        sent.message_id,
        'worker_excel_uploaded',
        true
      );
    }
    return true;
  } catch (error: any) {
    console.error('Error importing worker Excel:', error);
    await ctx.api.deleteMessage(ctx.chat!.id, statusMsg.message_id).catch(() => {});
    await clearPendingWorkerExcelUpload(telegramId);

    const retryKb = new InlineKeyboard()
      .text('🔄 إعادة المحاولة', 'action:worker:upload_excel')
      .row()
      .text('🔙 العودة لقسم الموارد البشرية', 'menu:domain:hr')
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    await ctx.reply(
      `❌ *حدث خطأ فني أثناء معالجة الملف:*\n\`${error?.message || 'Unknown error'}\``,
      { parse_mode: 'Markdown', reply_markup: retryKb }
    );
    return true;
  }
}

/**
 * 📊 عرض قائمة خيارات تصفية كشف العاملين (معالج التصدير)
 */
export async function handleWorkerExportStart(ctx: MyContext): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  const role = ctx.effectiveRole || 'GUEST';
  if (role === 'GUEST' || role === 'WORKER' || role === 'SUPPLIER') {
    await ctx.reply('🔒 عذراً، هذه الوظيفة مقتصرة على مسؤولي الإدارة والمواقع فقط.');
    return;
  }

  const keyboard = new InlineKeyboard()
    .text('🌐 الكشف الكامل (كافة العاملين)', 'action:worker_export:do:all')
    .row()
    .text('🏢 تصفية حسب القسم الوظيفي', 'action:worker_export:dept_menu')
    .row()
    .text('💼 تصفية حسب المهنة / الوظيفة', 'action:worker_export:job_menu:1')
    .row()
    .text('📍 تصفية حسب المحافظة', 'action:worker_export:gov_menu')
    .row()
    .text('◀️ رجوع لقسم استيراد وتصدير الكشوف', 'menu:hr_sub:worker_excel')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  const text =
    `📊 *تصدير كشف العاملين المعتمد إلى إكسيل (.xlsx)*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `اختر نطاق الكشف المطلوب تصديره:\n\n` +
    `• *الكشف الكامل:* تصدير ملف يحتوي على كافة العاملين المقيدين.\n` +
    `• *حسب القسم الوظيفي:* كشف مخصص لقطاع أو إدارة محددة.\n` +
    `• *حسب المهنة / الوظيفة:* كشف لكافة العاملين بمهنة معينة.\n` +
    `• *حسب المحافظة:* كشف جغرافي للعمالة المنتمية لمحافظة ما.`;

  const inPlace = await screenFlowService.shouldRenderInPlace(ctx, true);
  if (inPlace && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return;
    } catch {}
  }
  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

/**
 * 🏢 قائمة اختيار القسم الوظيفي لتصفية كشف العمال
 */
export async function handleWorkerExportDeptMenu(ctx: MyContext): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  const departments = await prisma.department.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  });

  const keyboard = new InlineKeyboard();
  for (const dept of departments) {
    keyboard.text(`🏢 ${dept.name}`, `action:worker_export:do:dept:${dept.id}`).row();
  }

  keyboard
    .text('◀️ رجوع لخيارات التصفية', 'action:worker_export:start')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  const text =
    `🏢 *تصفية كشف العاملين حسب القسم الوظيفي*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `يرجى اختيار القسم المطلوب استخراج كشف عماله:`;

  const inPlace = await screenFlowService.shouldRenderInPlace(ctx, true);
  if (inPlace && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return;
    } catch {}
  }
  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

/**
 * 💼 قائمة اختيار المهنة / الوظيفة لتصفية كشف العمال (مرقمة الصفحات)
 */
export async function handleWorkerExportJobMenu(ctx: MyContext, page = 1): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  const pageSize = 6;
  const totalJobs = await prisma.jobTitle.count({ where: { isActive: true } });
  const totalPages = Math.max(1, Math.ceil(totalJobs / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const jobs = await prisma.jobTitle.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
  });

  const keyboard = new InlineKeyboard();
  for (const job of jobs) {
    keyboard.text(`💼 ${job.name}`, `action:worker_export:do:job:${job.id}`).row();
  }

  const navRow: { text: string; callback_data: string }[] = [];
  if (currentPage > 1) {
    navRow.push({ text: '◀️ السابق', callback_data: `action:worker_export:job_menu:${currentPage - 1}` });
  }
  if (currentPage < totalPages) {
    navRow.push({ text: 'التالي ▶️', callback_data: `action:worker_export:job_menu:${currentPage + 1}` });
  }
  if (navRow.length > 0) {
    for (const btn of navRow) {
      keyboard.text(btn.text, btn.callback_data);
    }
    keyboard.row();
  }

  keyboard
    .text('◀️ رجوع لخيارات التصفية', 'action:worker_export:start')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  const text =
    `💼 *تصفية كشف العاملين حسب المهنة / الوظيفة*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `الصفحة (${currentPage} من ${totalPages})\n` +
    `اختر المسمى الوظيفي المطلوب تصدير عماله:`;

  const inPlace = await screenFlowService.shouldRenderInPlace(ctx, true);
  if (inPlace && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return;
    } catch {}
  }
  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

/**
 * 📍 قائمة اختيار المحافظة لتصفية كشف العمال
 */
export async function handleWorkerExportGovMenu(ctx: MyContext): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  const govGroups = await prisma.worker.groupBy({
    by: ['governorateCode'],
    where: { isDeleted: false, status: 'ACTIVE' },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  const keyboard = new InlineKeyboard();

  if (govGroups.length === 0) {
    keyboard
      .text('◀️ رجوع لخيارات التصفية', 'action:worker_export:start')
      .row()
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    const emptyText =
      `📍 *تصفية كشف العاملين حسب المحافظة*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `لا توجد بيانات عمال مسجلين حالياً بأي محافظة.`;

    if (ctx.callbackQuery) {
      await ctx.editMessageText(emptyText, { parse_mode: 'Markdown', reply_markup: keyboard }).catch(() => {});
      return;
    }
    await ctx.reply(emptyText, { parse_mode: 'Markdown', reply_markup: keyboard });
    return;
  }

  for (const group of govGroups) {
    const govCode = group.governorateCode || '88';
    const govName = EGYPTIAN_GOVERNORATES[govCode]?.nameAr || (govCode === '88' ? 'خارج الجمهورية / وافد' : govCode);
    const count = group._count.id;
    keyboard.text(`📍 ${govName} (${count} عامل)`, `action:worker_export:do:gov:${govCode}`).row();
  }

  keyboard
    .text('◀️ رجوع لخيارات التصفية', 'action:worker_export:start')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  const text =
    `📍 *تصفية كشف العاملين حسب المحافظة*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `اختر المحافظة لاستخراج كشف عمالها المعتمد:`;

  const inPlace = await screenFlowService.shouldRenderInPlace(ctx, true);
  if (inPlace && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return;
    } catch {}
  }
  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

/**
 * ⚡ تنفيذ عملية تصدير كشف العمال وتوليد ملف الإكسيل وإرساله للمستخدم
 */
export async function handleExecuteWorkerExport(
  ctx: MyContext,
  filterType: 'all' | 'dept' | 'job' | 'gov',
  filterParam?: string
): Promise<void> {
  const role = ctx.effectiveRole || 'GUEST';
  if (role === 'GUEST' || role === 'WORKER' || role === 'SUPPLIER') {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '🔒 هذه الوظيفة مقتصرة على مدراء ومسؤولي النظام فقط.' });
    }
    return;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: '⏳ جاري إعداد وتوليد كشف الإكسيل المعتمد...' });
  }

  const isSuperAdmin = role === 'SUPER_ADMIN' || Boolean(ctx.isRealSuperAdmin);

  const filter: WorkerExportFilter = {
    type:
      filterType === 'dept'
        ? 'DEPARTMENT'
        : filterType === 'job'
        ? 'JOB_TITLE'
        : filterType === 'gov'
        ? 'GOVERNORATE'
        : 'ALL',
    departmentId: filterType === 'dept' ? filterParam : undefined,
    jobTitleId: filterType === 'job' ? filterParam : undefined,
    governorateCode: filterType === 'gov' ? filterParam : undefined,
  };

  try {
    const result = await workerExcelService.generateWorkersExportBuffer(filter, isSuperAdmin);
    const inputFile = new InputFile(result.buffer, result.fileName);

    const completionKeyboard = new InlineKeyboard()
      .text('🔄 تنزيل كشف آخر (تصفية أخرى)', 'action:worker_export:start')
      .row()
      .text('📥 تنزيل قالب استيراد العمالة', 'action:worker:download_excel')
      .row()
      .text('🔙 العودة لاستيراد وتصدير كشف العمال', 'menu:hr_sub:worker_excel')
      .row()
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    const classificationText = isSuperAdmin
      ? 'نسخة الإدارة العليا (تتضمن الأجور والرواتب والحسابات البنكية)'
      : 'نسخة إدارية وميدانية (بيانات تشغيلية - الرواتب محجوبة)';

    const caption =
      `📊 *كشف قيد وبيانات العاملين المعتمد (إكسيل)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🎯 *نطاق التصفية:* ${result.filterLabel}\n` +
      `👥 *إجمالي العمال بالكشف:* *${result.workerCount} عامل*\n` +
      `🔒 *تصنيف الملف:* ${classificationText}\n\n` +
      `✅ *تم توليد وتجهيز الملف بالكامل وفق المعايير الإدارية المعتمدة.*`;

    await ctx.replyWithDocument(inputFile, {
      caption,
      parse_mode: 'Markdown',
      reply_markup: completionKeyboard,
    });
  } catch (error) {
    console.error('Failed to generate worker export Excel:', error);

    const errorKb = new InlineKeyboard()
      .text('🔄 إعادة المحاولة', 'action:worker_export:start')
      .row()
      .text('🔙 العودة لقسم استيراد وتصدير الكشوف', 'menu:hr_sub:worker_excel')
      .row()
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    await ctx.reply('❌ تعذر توليد وتصدير كشف العمال حالياً. يرجى إعادة المحاولة لاحقاً.', {
      reply_markup: errorKb,
    });
  }
}
