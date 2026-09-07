import { InlineKeyboard, InputFile } from 'grammy';
import { MyContext } from '../types/context.js';
import { workerExcelService } from '../services/worker-excel.service.js';
import {
   setPendingWorkerExcelUpload,
   getPendingWorkerExcelUpload,
   clearPendingWorkerExcelUpload,
 } from '../redis.js';
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

  await setPendingWorkerExcelUpload(telegramId, promptMsgId);
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

    await ctx.reply(
      `🎉 *تم استيراد وقيد كشف العمالة بنجاح 100%!* (Atomic Success)\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 *إحصائيات العملية:*\n` +
      `• عدد السجلات المعالجة: *${result.totalRowsProcessed} صف*\n` +
      `• العمال المسجلين الجدد: *${result.workersCreated} عامل*\n\n` +
      `🔒 *ما تم إنجازه آلياً:*\n` +
      `1. التحقق من الرقم القومي واستخراج الميلاد والمحافظة والنوع.\n` +
      `2. قبول وتسجيل العمالة الوافدة بجواز السفر.\n` +
      `3. تشفير البيانات الحساسة بـ AES-256-GCM وإنشاء الفهارس العمياء.\n` +
      `4. تحديث الذاكرة السريعة (L1/L2 Cache) فورياً.`,
      {
        parse_mode: 'Markdown',
        reply_markup: successKeyboard,
      }
    );
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
