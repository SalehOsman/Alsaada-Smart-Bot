import { InlineKeyboard, InputFile } from 'grammy';
import { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import { systemDataService } from '../services/system-data.service.js';
import { jobMatrixExcelService } from '../services/job-matrix-excel.service.js';
import {
  setPendingJobMatrixAction,
  getPendingJobMatrixAction,
  clearPendingJobMatrixAction,
} from '../redis.js';

/**
 * 🏢 الشاشة الرئيسية لمصفوفة الأقسام والوظائف
 */
export async function renderDepartmentsHub(
  ctx: MyContext,
  inPlace = false,
  noticeText?: string
): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: '🔒 هذا القسم مخصص حصرياً للمدير العام.',
        show_alert: true,
      });
    }
    return;
  }

  await clearPendingJobMatrixAction(BigInt(ctx.from.id));

  // ⚡ L1 IN-MEMORY RAM (< 0.1ms) with SWR background revalidation
  const departments = await systemDataService.getDepartments();
  const totalJobs = departments.reduce((acc, d) => acc + d.jobs.length, 0);

  const keyboard = new InlineKeyboard();

  // عرض كل قسم كزر تفاعلي
  departments.forEach((dept) => {
    keyboard
      .text(`🏢 ${dept.name} (${dept.code}) — 💼 ${dept.jobs.length} وظيفة`, `action:dept:view:${dept.code}`)
      .row();
  });

  // أزرار العمليات الإدارية
  keyboard
    .text('➕ إضافة قسم وظيفي جديد', 'action:dept:add')
    .row()
    .text('📥 تحميل قالب Excel للهيكل', 'action:dept:download_excel')
    .text('📤 رفع ملف Excel معتمد', 'action:dept:upload_excel')
    .row()
    .text('🔙 العودة لقسم الكيان والمواقع', 'action:settings_sub:corporate')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (ctx.isImpersonating && ctx.isRealSuperAdmin) {
    keyboard
      .row()
      .text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  let banner = '';
  if (noticeText) {
    banner = `✨ *${noticeText}*\n────────────────────────────\n\n`;
  }

  const text =
    `${banner}` +
    `💼 *الهيكل الوظيفي ومصفوفة المهن والورديات*\n` +
    `────────────────────────────\n` +
    `دليل الأقسام التشغيلية والإدارية، مسميات المهن، دورات العمل والراحة، وحدود كفاية التشغيل.\n` +
    `📊 *إجمالي الأقسام:* ${departments.length} قسم | *إجمالي الوظائف:* ${totalJobs} وظيفة\n\n` +
    `👇 *اختر القسم المطلوب لاستعراض وضبط وظائفه، أو استخدم خيارات الإدارة أدناه:*`;

  if (inPlace && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return;
    } catch {}
  }

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

/**
 * 🏢 بطاقة تفاصيل القسم وقائمة الوظائف التابعة له
 */
export async function renderDepartmentDetail(
  ctx: MyContext,
  deptCode: string,
  inPlace = false,
  noticeText?: string
): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) return;

  await clearPendingJobMatrixAction(BigInt(ctx.from.id));

  const dept = await systemDataService.getDepartmentByCode(deptCode);
  if (!dept) {
    await renderDepartmentsHub(ctx, inPlace, '⚠️ تعذر العثور على القسم الوظيفي المطلوب.');
    return;
  }

  const keyboard = new InlineKeyboard();

  // عرض وظائف القسم كأزرار
  dept.jobs.forEach((job) => {
    keyboard
      .text(
        `💼 ${job.name} (${job.code}) — ⏱️ ${job.workDays}/${job.restDays} | 🛡️ ${job.minHeadcount}`,
        `action:job:view:${dept.code}:${job.code}`
      )
      .row();
  });

  keyboard
    .text('➕ إضافة وظيفة لهذا القسم', `action:job:add:${dept.code}`)
    .text('✏️ تعديل اسم القسم', `action:dept:edit_name:${dept.code}`)
    .row()
    .text('◀️ رجوع لقائمة الأقسام', 'action:settings:job_matrix')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (ctx.isImpersonating && ctx.isRealSuperAdmin) {
    keyboard
      .row()
      .text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  let banner = '';
  if (noticeText) {
    banner = `✨ *${noticeText}*\n────────────────────────────\n\n`;
  }

  const text =
    `${banner}` +
    `🏢 *بطاقة القسم الوظيفي: ${dept.name}*\n` +
    `────────────────────────────\n` +
    `🏷️ *كود القسم المعتمد:* \`${dept.code}\`\n` +
    `💼 *إجمالي الوظائف المسجلة بالقسم:* ${dept.jobs.length} وظيفة\n` +
    `${dept.description ? `📝 *الوصف:* ${dept.description}\n` : ''}` +
    `────────────────────────────\n` +
    `👇 *اختر الوظيفة المطلوبة لاستعراض بطاقتها وتعديل إعداداتها:*`;

  if (inPlace && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return;
    } catch {}
  }

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

/**
 * 💼 بطاقة الوظيفة والمحددات المالية ودورات العمل والراحة
 */
export async function renderJobDetail(
  ctx: MyContext,
  deptCode: string,
  jobCode: string,
  inPlace = false,
  noticeText?: string
): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) return;

  await clearPendingJobMatrixAction(BigInt(ctx.from.id));

  const job = await systemDataService.getJobByDeptAndCode(deptCode, jobCode);
  if (!job) {
    await renderDepartmentDetail(ctx, deptCode, inPlace, '⚠️ تعذر العثور على الوظيفة المطلوبة.');
    return;
  }

  const baseSal = Number(job.baseSalary || 0);
  const addSal = Number(job.additionalSalary || 0);
  const totalSal = baseSal + addSal;

  const keyboard = new InlineKeyboard();

  // 1. شريط التحكم السريع في حد كفاية الموقع (+1 / -1)
  keyboard
    .text('➖ (-1)', `action:job:headcount:${deptCode}:${jobCode}:dec`)
    .text(`🛡️ كفاية الوردية: ${job.minHeadcount}`, 'noop')
    .text('➕ (+1)', `action:job:headcount:${deptCode}:${jobCode}:inc`)
    .row();

  // 2. أزرار دورة العمل الميدانية
  const nextWorkDays = job.workDays === 20 ? 24 : 20;
  const nextRestDays = job.workDays === 20 ? 6 : 10;
  keyboard
    .text(
      `⏱️ تبديل سريع (${nextWorkDays}/${nextRestDays})`,
      `action:job:toggle_cycle:${deptCode}:${jobCode}`
    )
    .text('✏️ تخصيص أيام الدورة', `action:job:edit_cycle:${deptCode}:${jobCode}`)
    .row();

  // 3. أزرار تعديل البيانات والرواتب
  keyboard
    .text('💰 تعديل الراتب الاسترشادي', `action:job:edit_salary:${deptCode}:${jobCode}`)
    .text('✏️ تعديل المسمى الوظيفي', `action:job:edit_title:${deptCode}:${jobCode}`)
    .row()
    .text(`◀️ رجوع للقسم (${deptCode})`, `action:dept:view:${deptCode}`)
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (ctx.isImpersonating && ctx.isRealSuperAdmin) {
    keyboard
      .row()
      .text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  let banner = '';
  if (noticeText) {
    banner = `✨ *${noticeText}*\n────────────────────────────\n\n`;
  }

  const text =
    `${banner}` +
    `💼 *بطاقة الوظيفة: ${job.name}*\n` +
    `────────────────────────────\n` +
    `🏢 *القسم التابع له:* ${job.department.name} (\`${job.department.code}\`)\n` +
    `🏷️ *كود الوظيفة المعتمد:* \`${job.code}\`\n\n` +
    `⏱️ *دورة العمل والإجازات الميدانية:*\n` +
    `• أيام العمل بالموقع (W): *${job.workDays} يوماً*\n` +
    `• أيام الراحة والإجازة (R): *${job.restDays} أيام*\n` +
    `• إجمالي دورة الوردية (C): *${job.totalCycleDays} يوماً*\n` +
    `• نمط الدورة: *${job.shiftNature}*\n\n` +
    `🛡️ *كفاية الموقع والتشغيل:*\n` +
    `• الحد الأدنى المطلوب بالموقع: *${job.minHeadcount} عمال*\n\n` +
    `💰 *الراتب الاسترشادي المعتمد (الافتراضي للعامل):*\n` +
    `• الراتب الأساسي: *${baseSal.toLocaleString()} ج.م*\n` +
    `• الراتب الإضافي / البدلات: *${addSal.toLocaleString()} ج.م*\n` +
    `• إجمالي الراتب الاسترشادي: *${totalSal.toLocaleString()} ج.م*\n` +
    `${job.notes ? `\n📝 *ملاحظات:* ${job.notes}\n` : ''}` +
    `────────────────────────────\n` +
    `👇 *تحكم في دورة العمل وكفاية التشغيل بنقرة واحدة، أو اختر التعديل المطلوب:*`;

  if (inPlace && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return;
    } catch {}
  }

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

/**
 * ⚡ تعديل حد كفاية الموقع للوظيفة لحظياً (+1 / -1)
 */
export async function handleJobHeadcountDelta(
  ctx: MyContext,
  deptCode: string,
  jobCode: string,
  direction: 'inc' | 'dec'
): Promise<void> {
  if (!ctx.isRealSuperAdmin) return;

  const job = await systemDataService.getJobByDeptAndCode(deptCode, jobCode);
  if (!job) return;

  const delta = direction === 'inc' ? 1 : -1;
  const newCount = Math.max(1, job.minHeadcount + delta);

  await prisma.jobTitle.update({
    where: { id: job.id },
    data: { minHeadcount: newCount },
  });
  await systemDataService.invalidateDepartmentsAndJobs();

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({
      text: `تم تعديل حد كفاية (${job.name}) إلى: ${newCount} عمال`,
    });
  }

  await renderJobDetail(ctx, deptCode, jobCode, true);
}

/**
 * ⚡ تبديل دورة العمل والإجازة للوظيفة لحظياً (20/10 <-> 24/6)
 */
export async function handleJobToggleCycle(
  ctx: MyContext,
  deptCode: string,
  jobCode: string
): Promise<void> {
  if (!ctx.isRealSuperAdmin) return;

  const job = await systemDataService.getJobByDeptAndCode(deptCode, jobCode);
  if (!job) return;

  const newWork = job.workDays === 20 ? 24 : 20;
  const newRest = job.workDays === 20 ? 6 : 10;
  const newNature = newWork === 20 ? 'دورة قياسية (20+10)' : 'دورة ممتدة (24+6)';

  await prisma.jobTitle.update({
    where: { id: job.id },
    data: {
      workDays: newWork,
      restDays: newRest,
      totalCycleDays: newWork + newRest,
      shiftNature: newNature,
    },
  });
  await systemDataService.invalidateDepartmentsAndJobs();

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({
      text: `تم تعديل الدورة إلى: ${newWork} عمل / ${newRest} راحة`,
    });
  }

  await renderJobDetail(ctx, deptCode, jobCode, true);
}

/**
 * ⏱️ بدء معالج تخصيص دورة العمل والإجازات (الخطوة 1: أيام العمل)
 */
export async function handleStartEditJobCycle(
  ctx: MyContext,
  deptCode: string,
  jobCode: string
): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) return;

  const telegramId = BigInt(ctx.from.id);
  const messageId = ctx.callbackQuery?.message?.message_id || 0;

  await setPendingJobMatrixAction(telegramId, {
    action: 'edit_job_work_days',
    deptCode,
    jobCode,
    messageId,
  });

  if (ctx.callbackQuery) await ctx.answerCallbackQuery();

  const keyboard = new InlineKeyboard()
    .text('20 يوماً', `action:job:set_wd:${deptCode}:${jobCode}:20`)
    .text('24 يوماً', `action:job:set_wd:${deptCode}:${jobCode}:24`)
    .text('26 يوماً', `action:job:set_wd:${deptCode}:${jobCode}:26`)
    .text('6 أيام', `action:job:set_wd:${deptCode}:${jobCode}:6`)
    .row()
    .text('◀️ إلغاء والعودة لبطاقة الوظيفة', `action:job:view:${deptCode}:${jobCode}`)
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  const text =
    `⏱️ *تخصيص دورة العمل والإجازات — الخطوة 1 من 2*\n` +
    `────────────────────────────\n` +
    `🏢 *القسم:* \`${deptCode}\` | 💼 *الوظيفة:* \`${jobCode}\`\n\n` +
    `أدخل عدد *أيام العمل بالموقع (W)* الآن في المحادثة:\n` +
    `(أو اختر مباشرة أحد الخيارات الشائعة أدناه):`;

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      return;
    } catch {}
  }
  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

/**
 * ⏱️ تسجيل أيام العمل والانتقال للخطوة 2 (أيام الراحة)
 */
export async function handleSetWorkDays(
  ctx: MyContext,
  deptCode: string,
  jobCode: string,
  workDays: number
): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) return;

  const telegramId = BigInt(ctx.from.id);
  const messageId = ctx.callbackQuery?.message?.message_id || 0;

  await setPendingJobMatrixAction(telegramId, {
    action: 'edit_job_rest_days',
    deptCode,
    jobCode,
    draft: { workDays },
    messageId,
  });

  if (ctx.callbackQuery) await ctx.answerCallbackQuery();

  const keyboard = new InlineKeyboard()
    .text('10 أيام', `action:job:set_rd:${deptCode}:${jobCode}:10`)
    .text('6 أيام', `action:job:set_rd:${deptCode}:${jobCode}:6`)
    .text('4 أيام', `action:job:set_rd:${deptCode}:${jobCode}:4`)
    .text('1 يوم', `action:job:set_rd:${deptCode}:${jobCode}:1`)
    .row()
    .text('◀️ رجوع لأيام العمل', `action:job:edit_cycle:${deptCode}:${jobCode}`)
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  const text =
    `⏱️ *تخصيص دورة العمل والإجازات — الخطوة 2 من 2*\n` +
    `────────────────────────────\n` +
    `🏢 *القسم:* \`${deptCode}\` | 💼 *الوظيفة:* \`${jobCode}\`\n` +
    `📅 *أيام العمل المحددة بالموقع:* *${workDays} يوماً*\n\n` +
    `أدخل عدد *أيام الراحة والإجازة (R)* الآن في المحادثة:\n` +
    `(أو اختر مباشرة أحد الخيارات الشائعة أدناه):`;

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      return;
    } catch {}
  }
  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

/**
 * ⏱️ حفظ دورة العمل والإجازات النهائية للوظيفة
 */
export async function handleSetRestDays(
  ctx: MyContext,
  deptCode: string,
  jobCode: string,
  restDays: number
): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) return;

  const telegramId = BigInt(ctx.from.id);
  const pending = await getPendingJobMatrixAction(telegramId);
  const workDays = pending?.draft?.workDays ?? 20;

  const job = await systemDataService.getJobByDeptAndCode(deptCode, jobCode);
  if (!job) return;

  const totalCycleDays = workDays + restDays;
  let shiftNature = `دورة مخصصة (${workDays}+${restDays})`;
  if (workDays === 20 && restDays === 10) shiftNature = 'دورة قياسية (20+10)';
  else if (workDays === 24 && restDays === 6) shiftNature = 'دورة ممتدة (24+6)';
  else if (workDays === 26 && restDays === 4) shiftNature = 'دورة مكثفة (26+4)';
  else if (workDays === 6 && restDays === 1) shiftNature = 'دورة أسبوعية (6+1)';

  await prisma.jobTitle.update({
    where: { id: job.id },
    data: {
      workDays,
      restDays,
      totalCycleDays,
      shiftNature,
    },
  });

  await clearPendingJobMatrixAction(telegramId);
  await systemDataService.invalidateDepartmentsAndJobs();

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({
      text: `تم حفظ الدورة بنجاح: ${workDays} عمل / ${restDays} راحة`,
    });
  }

  await renderJobDetail(
    ctx,
    deptCode,
    jobCode,
    true,
    `تم تحديث دورة العمل بنجاح (${workDays} يوم عمل / ${restDays} يوم راحة — إجمالي ${totalCycleDays} يوماً).`
  );
}

/**
 * 📥 تحميل قالب الإكسيل الرسمي لمصفوفة الوظائف
 */
export async function handleDownloadJobMatrixTemplate(ctx: MyContext): Promise<void> {
  if (!ctx.isRealSuperAdmin) return;

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: 'جاري توليد ملف القالب المعتمد...' });
  }

  try {
    const buffer = await jobMatrixExcelService.generateTemplateBuffer();
    const inputFile = new InputFile(buffer, 'قالب_مصفوفة_المهن_والأقسام_شركة_السعادة.xlsx');

    const completionKeyboard = new InlineKeyboard()
      .text('📤 رفع الملف بعد التعبئة', 'action:dept:upload_excel')
      .row()
      .text('🔙 العودة لمصفوفة الوظائف', 'action:settings:job_matrix')
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    await ctx.replyWithDocument(inputFile, {
      caption:
        `📥 *قالب مصفوفة الأقسام والمهن ودورات العمل المعتمد*\n` +
        `────────────────────────────\n` +
        `تم توليد القالب الرسمي لشركة السعادة متضمناً الإرشادات والأعمدة وصفوفاً نموذجية.\n\n` +
        `💡 *طريقة الاستخدام:*\n` +
        `1. قم بتعبئة بيانات الأقسام والوظائف في الملف.\n` +
        `2. اضغط على زر [ 📤 رفع الملف بعد التعبئة ] أو أرسل الملف مباشرة هنا.`,
      parse_mode: 'Markdown',
      reply_markup: completionKeyboard,
    });
  } catch (error) {
    console.error('Failed to generate template Excel:', error);
    await ctx.reply('❌ تعذر توليد ملف القالب حالياً. يرجى المحاولة لاحقاً.');
  }
}

/**
 * 📤 بدء معالج رفع ملف الإكسيل
 */
export async function handleStartUploadExcel(ctx: MyContext): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) return;

  const telegramId = BigInt(ctx.from.id);
  const messageId = ctx.callbackQuery?.message?.message_id || 0;

  await setPendingJobMatrixAction(telegramId, {
    action: 'upload_excel',
    messageId,
  });

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
  }

  const cancelKeyboard = new InlineKeyboard()
    .text('🔙 العودة لمصفوفة الوظائف', 'action:settings:job_matrix')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  const text =
    `📤 *رفع ملف مصفوفة الأقسام والوظائف (Excel Import)*\n` +
    `────────────────────────────\n` +
    `يرجى إرسال ملف الإكسيل المكتمل بصيغة (\`.xlsx\`) الآن كمستند في هذه المحادثة.\n\n` +
    `⚠️ *ملاحظات مهمة:*\n` +
    `• تأكد من استخدام القالب المعتمد لشركة السعادة.\n` +
    `• لا تقم بتغيير أسماء أعمدة الترويسة في الصفحة الأولى.\n` +
    `• الأكواد والوظائف الموجودة مسبقاً سيتم تحديث بياناتها تلقائياً.`;

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: cancelKeyboard,
      });
      return;
    } catch {}
  }

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: cancelKeyboard,
  });
}

/**
 * 📄 معالجة استقبال ملف الإكسيل المرفوع في المحادثة
 */
export async function handleJobMatrixDocumentInput(ctx: MyContext): Promise<boolean> {
  if (!ctx.isRealSuperAdmin || !ctx.from || !ctx.message?.document) {
    return false;
  }

  const telegramId = BigInt(ctx.from.id);
  const pending = await getPendingJobMatrixAction(telegramId);
  if (!pending || pending.action !== 'upload_excel') {
    return false;
  }

  const doc = ctx.message.document;
  const fileName = doc.file_name || '';

  if (!fileName.toLowerCase().endsWith('.xlsx')) {
    const errorKeyboard = new InlineKeyboard()
      .text('🔄 إعادة المحاولة برفع ملف .xlsx', 'action:dept:upload_excel')
      .row()
      .text('🔙 العودة لمصفوفة الوظائف', 'action:settings:job_matrix')
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    await ctx.reply('⚠️ صيغة الملف غير مقبولة! يجب أن يكون الملف بصيغة إكسيل حديثة (\`.xlsx\`).', {
      parse_mode: 'Markdown',
      reply_markup: errorKeyboard,
    });
    return true;
  }

  const statusMsg = await ctx.reply('⏳ جاري فحص وتدقيق ملف الإكسيل ومطابقة الأكواد...');

  try {
    const file = await ctx.api.getFile(doc.file_id);
    if (!file.file_path) {
      throw new Error('Telegram file path not returned');
    }

    const downloadUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file from Telegram: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // معالجة واستيراد الملف ذرياً
    const result = await jobMatrixExcelService.parseAndImportExcel(fileBuffer);

    await clearPendingJobMatrixAction(telegramId);
    await ctx.api.deleteMessage(ctx.chat!.id, statusMsg.message_id).catch(() => {});

    if (!result.success) {
      const errorKeyboard = new InlineKeyboard()
        .text('🔄 إعادة المحاولة', 'action:dept:upload_excel')
        .text('📥 تحميل القالب الصحيح', 'action:dept:download_excel')
        .row()
        .text('🔙 العودة لمصفوفة الوظائف', 'action:settings:job_matrix')
        .text('🏠 القائمة الرئيسية', 'action:main_menu');

      const errorList = result.errors.slice(0, 5).join('\n• ');
      await ctx.reply(
        `❌ *تعذر استيراد بيانات الملف بسبب أخطاء في التنسيق:*\n` +
        `────────────────────────────\n` +
        `• ${errorList}\n\n` +
        `يرجى تصحيح الملاحظات أعلاه وإعادة الرفع.`,
        {
          parse_mode: 'Markdown',
          reply_markup: errorKeyboard,
        }
      );
      return true;
    }

    // بطاقة إتمام العملية المعتمدة (Universal Post-Action Completion Keyboard)
    const successKeyboard = new InlineKeyboard()
      .text('📥 تحميل القالب مجدداً', 'action:dept:download_excel')
      .text('➕ رفع ملف آخر', 'action:dept:upload_excel')
      .row()
      .text('🏢 استعراض الهيكل الوظيفي المحدث', 'action:settings:job_matrix')
      .row()
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    await ctx.reply(
      `✅ *تم استيراد ومزامنة الهيكل الوظيفي بنجاح!*\n` +
      `────────────────────────────\n` +
      `📊 *إجمالي الصفوف المعالجة:* ${result.totalRowsProcessed} صف\n` +
      `🏢 *الأقسام الوظيفية:* +${result.departmentsCreated} جديد | 🔄 ${result.departmentsUpdated} محدث\n` +
      `💼 *الوظائف والمهن:* +${result.jobsCreated} جديد | 🔄 ${result.jobsUpdated} محدث\n` +
      `⚡ *الكاش:* تم تحديث كاش الذاكرة اللحظية بنجاح.\n` +
      `────────────────────────────\n` +
      `كافة بيانات الأقسام والوظائف أصبحت سارية ومتاحة لتعيين العمالة فورياً.`,
      {
        parse_mode: 'Markdown',
        reply_markup: successKeyboard,
      }
    );

    return true;
  } catch (err) {
    console.error('Failed to import job matrix excel:', err);
    await ctx.api.deleteMessage(ctx.chat!.id, statusMsg.message_id).catch(() => {});
    const errorKeyboard = new InlineKeyboard()
      .text('🔄 إعادة المحاولة', 'action:dept:upload_excel')
      .row()
      .text('🔙 العودة لمصفوفة الوظائف', 'action:settings:job_matrix')
      .text('🏠 القائمة الرئيسية', 'action:main_menu');

    await ctx.reply('❌ حدث خطأ فني غير متوقع أثناء معالجة ملف الإكسيل. يرجى التأكد من سلامة الملف وإعادة المحاولة.', {
      reply_markup: errorKeyboard,
    });
    return true;
  }
}

/**
 * ➕ بدء معالج إضافة قسم وظيفي جديد
 */
export async function handleStartAddDepartment(ctx: MyContext): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) return;

  const telegramId = BigInt(ctx.from.id);
  const messageId = ctx.callbackQuery?.message?.message_id || 0;

  await setPendingJobMatrixAction(telegramId, {
    action: 'add_dept_name',
    messageId,
  });

  if (ctx.callbackQuery) await ctx.answerCallbackQuery();

  const cancelKeyboard = new InlineKeyboard()
    .text('🔙 إلغاء والعودة لمصفوفة الوظائف', 'action:settings:job_matrix')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  const text =
    `➕ *إضافة قسم وظيفي جديد — الخطوة 1 من 2*\n` +
    `────────────────────────────\n` +
    `يرجى كتابة *اسم القسم الوظيفي* باللغة العربية الآن في المحادثة:\n` +
    `(مثال: \`إدارة التشغيل والمعدات\`، \`إدارة الصيانة والدعم الفني\`، \`الأمن والحراسة\`)`;

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: cancelKeyboard });
      return;
    } catch {}
  }
  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: cancelKeyboard });
}

/**
 * ➕ بدء معالج إضافة وظيفة جديدة للقسم
 */
export async function handleStartAddJob(ctx: MyContext, deptCode: string): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) return;

  const telegramId = BigInt(ctx.from.id);
  const messageId = ctx.callbackQuery?.message?.message_id || 0;

  await setPendingJobMatrixAction(telegramId, {
    action: 'add_job_name',
    deptCode,
    messageId,
  });

  if (ctx.callbackQuery) await ctx.answerCallbackQuery();

  const cancelKeyboard = new InlineKeyboard()
    .text(`🔙 إلغاء والعودة للقسم (${deptCode})`, `action:dept:view:${deptCode}`)
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  const text =
    `➕ *إضافة وظيفة جديدة للقسم (${deptCode}) — الخطوة 1 من 4*\n` +
    `────────────────────────────\n` +
    `يرجى كتابة *المسمى الوظيفي* بالعربية الآن:\n` +
    `(مثال: \`سائق لودر ومعدات ثقيلة\`، \`مشغل كسارة\`، \`فني هيدروليك\`)`;

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: cancelKeyboard });
      return;
    } catch {}
  }
  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: cancelKeyboard });
}

/**
 * ✏️ بدء تعديل الراتب الاسترشادي للوظيفة
 */
export async function handleStartEditJobSalary(
  ctx: MyContext,
  deptCode: string,
  jobCode: string
): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) return;

  const telegramId = BigInt(ctx.from.id);
  const messageId = ctx.callbackQuery?.message?.message_id || 0;

  await setPendingJobMatrixAction(telegramId, {
    action: 'edit_job_base_salary',
    deptCode,
    jobCode,
    messageId,
  });

  if (ctx.callbackQuery) await ctx.answerCallbackQuery();

  const cancelKeyboard = new InlineKeyboard()
    .text(`◀️ رجوع لبطاقة الوظيفة`, `action:job:view:${deptCode}:${jobCode}`)
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  const text =
    `💰 *تعديل الراتب الاسترشادي لوظيفة (${jobCode}) — الخطوة 1 من 2*\n` +
    `────────────────────────────\n` +
    `أدخل قيمة *الراتب الأساسي* بالجنيه المصري (EGP):\n` +
    `(مثال: \`7000\`)`;

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: cancelKeyboard });
      return;
    } catch {}
  }
  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: cancelKeyboard });
}

/**
 * ✏️ بدء تعديل المسمى الوظيفي
 */
export async function handleStartEditJobTitle(
  ctx: MyContext,
  deptCode: string,
  jobCode: string
): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) return;

  const telegramId = BigInt(ctx.from.id);
  const messageId = ctx.callbackQuery?.message?.message_id || 0;

  await setPendingJobMatrixAction(telegramId, {
    action: 'edit_job_name',
    deptCode,
    jobCode,
    messageId,
  });

  if (ctx.callbackQuery) await ctx.answerCallbackQuery();

  const cancelKeyboard = new InlineKeyboard()
    .text(`◀️ رجوع لبطاقة الوظيفة`, `action:job:view:${deptCode}:${jobCode}`)
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  const text =
    `✏️ *تعديل المسمى الوظيفي لـ (${jobCode})*\n` +
    `────────────────────────────\n` +
    `أدخل المسمى الوظيفي الجديد بالعربية:\n` +
    `(مثال: \`سائق لودر ممتاز\`)`;

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: cancelKeyboard });
      return;
    } catch {}
  }
  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: cancelKeyboard });
}

/**
 * ✏️ بدء تعديل اسم القسم
 */
export async function handleStartEditDeptName(ctx: MyContext, deptCode: string): Promise<void> {
  if (!ctx.isRealSuperAdmin || !ctx.from) return;

  const telegramId = BigInt(ctx.from.id);
  const messageId = ctx.callbackQuery?.message?.message_id || 0;

  await setPendingJobMatrixAction(telegramId, {
    action: 'edit_dept_name',
    deptCode,
    messageId,
  });

  if (ctx.callbackQuery) await ctx.answerCallbackQuery();

  const cancelKeyboard = new InlineKeyboard()
    .text(`◀️ رجوع لبطاقة القسم`, `action:dept:view:${deptCode}`)
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  const text =
    `✏️ *تعديل اسم القسم الوظيفي (${deptCode})*\n` +
    `────────────────────────────\n` +
    `أدخل الاسم الجديد للقسم بالعربية:\n` +
    `(مثال: \`إدارة التشغيل والعمليات الميدانية\`)`;

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: cancelKeyboard });
      return;
    } catch {}
  }
  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: cancelKeyboard });
}

/**
 * 📝 معالجة الرسائل النصية في معالجات الأقسام والوظائف
 */
export async function handleJobMatrixTextInput(ctx: MyContext): Promise<boolean> {
  if (!ctx.isRealSuperAdmin || !ctx.from || !ctx.message?.text) {
    return false;
  }

  const telegramId = BigInt(ctx.from.id);
  const pending = await getPendingJobMatrixAction(telegramId);
  if (!pending) return false;

  const textVal = ctx.message.text.trim();

  // 1. إضافة قسم: الخطوة 1 - اسم القسم
  if (pending.action === 'add_dept_name') {
    if (textVal.length < 3) {
      const errorKeyboard = new InlineKeyboard()
        .text('🔄 إعادة كتابة الاسم', 'action:dept:add')
        .row()
        .text('🔙 العودة لمصفوفة الوظائف', 'action:settings:job_matrix');
      await ctx.reply('⚠️ اسم القسم قصير جداً (يجب أن يكون 3 أحرف على الأقل).', { reply_markup: errorKeyboard });
      return true;
    }

    await setPendingJobMatrixAction(telegramId, {
      action: 'add_dept_code',
      draft: { deptName: textVal },
      messageId: pending.messageId,
    });

    await ctx.deleteMessage().catch(() => {});

    const cancelKeyboard = new InlineKeyboard()
      .text('🔙 إلغاء والعودة لمصفوفة الوظائف', 'action:settings:job_matrix');

    await ctx.reply(
      `➕ *إضافة قسم (${textVal}) — الخطوة 2 من 2*\n` +
      `────────────────────────────\n` +
      `أدخل *كود القسم المختصر* بالأحرف الإنجليزية الكبيرة (2 إلى 4 أحرف):\n` +
      `(مثال: \`OP\`، \`FL\`، \`MNT\`، \`SEC\`، \`ADM\`)`,
      { parse_mode: 'Markdown', reply_markup: cancelKeyboard }
    );
    return true;
  }

  // 2. إضافة قسم: الخطوة 2 - كود القسم
  if (pending.action === 'add_dept_code') {
    const codeClean = textVal.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!codeClean || codeClean.length < 2 || codeClean.length > 6) {
      const errorKeyboard = new InlineKeyboard()
        .text('🔄 إعادة إدخال الكود', 'action:dept:add')
        .row()
        .text('🔙 العودة لمصفوفة الوظائف', 'action:settings:job_matrix');
      await ctx.reply('⚠️ كود القسم غير صالح. يرجى إدخال كود لاتيني مختصر (2-4 أحرف).', { reply_markup: errorKeyboard });
      return true;
    }

    const existing = await prisma.department.findUnique({ where: { code: codeClean } });
    if (existing) {
      const errorKeyboard = new InlineKeyboard()
        .text('🔄 إعادة المحاولة بكود آخر', 'action:dept:add')
        .row()
        .text('🔙 العودة لمصفوفة الوظائف', 'action:settings:job_matrix');
      await ctx.reply(`⚠️ كود القسم (\`${codeClean}\`) مسجل مسبقاً باسم (${existing.name}).`, {
        parse_mode: 'Markdown',
        reply_markup: errorKeyboard,
      });
      return true;
    }

    const deptName = pending.draft?.deptName || 'قسم جديد';
    await prisma.department.create({
      data: {
        code: codeClean,
        name: deptName,
        isActive: true,
      },
    });

    await clearPendingJobMatrixAction(telegramId);
    await systemDataService.invalidateDepartmentsAndJobs();
    await ctx.deleteMessage().catch(() => {});

    await renderDepartmentDetail(ctx, codeClean, false, `تمت إضافة قسم (${deptName}) بنجاح.`);
    return true;
  }

  // 3. تعديل اسم القسم
  if (pending.action === 'edit_dept_name' && pending.deptCode) {
    if (textVal.length < 3) {
      await ctx.reply('⚠️ اسم القسم قصير جداً.');
      return true;
    }

    await prisma.department.update({
      where: { code: pending.deptCode },
      data: { name: textVal },
    });

    await clearPendingJobMatrixAction(telegramId);
    await systemDataService.invalidateDepartmentsAndJobs();
    await ctx.deleteMessage().catch(() => {});

    await renderDepartmentDetail(ctx, pending.deptCode, false, `تم تعديل اسم القسم إلى (${textVal}) بنجاح.`);
    return true;
  }

  // 4. إضافة وظيفة: الخطوة 1 - اسم الوظيفة
  if (pending.action === 'add_job_name' && pending.deptCode) {
    if (textVal.length < 3) {
      await ctx.reply('⚠️ مسمى الوظيفة قصير جداً.');
      return true;
    }

    await setPendingJobMatrixAction(telegramId, {
      action: 'add_job_code',
      deptCode: pending.deptCode,
      draft: { jobTitle: textVal },
      messageId: pending.messageId,
    });

    await ctx.deleteMessage().catch(() => {});

    const cancelKeyboard = new InlineKeyboard()
      .text(`◀️ إلغاء والعودة للقسم`, `action:dept:view:${pending.deptCode}`);

    await ctx.reply(
      `➕ *إضافة وظيفة (${textVal}) — الخطوة 2 من 4*\n` +
      `────────────────────────────\n` +
      `أدخل *كود الوظيفة المختصر* بالأحرف الإنجليزية الكبيرة (2 إلى 4 أحرف):\n` +
      `(مثال: \`DRV\`، \`OPR\`، \`HLP\`، \`ENG\`، \`GRD\`)`,
      { parse_mode: 'Markdown', reply_markup: cancelKeyboard }
    );
    return true;
  }

  // 5. إضافة وظيفة: الخطوة 2 - كود الوظيفة
  if (pending.action === 'add_job_code' && pending.deptCode) {
    const jobCodeClean = textVal.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!jobCodeClean || jobCodeClean.length < 2 || jobCodeClean.length > 6) {
      await ctx.reply('⚠️ كود الوظيفة غير صالح (2-4 أحرف لاتينية).');
      return true;
    }

    const dept = await prisma.department.findUnique({ where: { code: pending.deptCode } });
    if (!dept) return false;

    const existingJob = await prisma.jobTitle.findUnique({
      where: {
        departmentId_code: {
          departmentId: dept.id,
          code: jobCodeClean,
        },
      },
    });

    if (existingJob) {
      await ctx.reply(`⚠️ كود الوظيفة (\`${jobCodeClean}\`) مسجل مسبقاً بهذا القسم باسم (${existingJob.name}).`, {
        parse_mode: 'Markdown',
      });
      return true;
    }

    await setPendingJobMatrixAction(telegramId, {
      action: 'add_job_base_salary',
      deptCode: pending.deptCode,
      draft: {
        ...pending.draft,
        jobCode: jobCodeClean,
      },
      messageId: pending.messageId,
    });

    await ctx.deleteMessage().catch(() => {});

    const cancelKeyboard = new InlineKeyboard()
      .text(`◀️ إلغاء والعودة للقسم`, `action:dept:view:${pending.deptCode}`);

    await ctx.reply(
      `➕ *تحديد الراتب الاسترشادي لوظيفة (${pending.draft?.jobTitle}) — الخطوة 3 من 4*\n` +
      `────────────────────────────\n` +
      `أدخل *الراتب الأساسي* بالجنيه المصري (EGP):\n` +
      `(مثال: \`7000\`)`,
      { parse_mode: 'Markdown', reply_markup: cancelKeyboard }
    );
    return true;
  }

  // 6. إضافة وظيفة: الخطوة 3 - الراتب الأساسي
  if (pending.action === 'add_job_base_salary' && pending.deptCode) {
    const baseNum = parseFloat(textVal.replace(/[^0-9.]/g, '')) || 0;

    await setPendingJobMatrixAction(telegramId, {
      action: 'add_job_additional_salary',
      deptCode: pending.deptCode,
      draft: {
        ...pending.draft,
        baseSalary: baseNum,
      },
      messageId: pending.messageId,
    });

    await ctx.deleteMessage().catch(() => {});

    const cancelKeyboard = new InlineKeyboard()
      .text(`◀️ إلغاء والعودة للقسم`, `action:dept:view:${pending.deptCode}`);

    await ctx.reply(
      `➕ *تحديد الراتب الإضافي والبدلات — الخطوة 4 من 4*\n` +
      `────────────────────────────\n` +
      `أدخل قيمة *الراتب الإضافي / البدلات والحوافز* بالجنيه (أدخل 0 إذا لم يوجد):\n` +
      `(مثال: \`2000\`)`,
      { parse_mode: 'Markdown', reply_markup: cancelKeyboard }
    );
    return true;
  }

  // 7. إضافة وظيفة: الخطوة 4 - الراتب الإضافي والإنشاء النهائي
  if (pending.action === 'add_job_additional_salary' && pending.deptCode) {
    const addNum = parseFloat(textVal.replace(/[^0-9.]/g, '')) || 0;
    const baseSal = pending.draft?.baseSalary || 0;
    const jobTitle = pending.draft?.jobTitle || 'وظيفة جديدة';
    const jobCode = pending.draft?.jobCode || 'JOB';

    const dept = await prisma.department.findUnique({ where: { code: pending.deptCode } });
    if (!dept) return false;

    const totalSalary = baseSal + addNum;

    await prisma.jobTitle.create({
      data: {
        departmentId: dept.id,
        code: jobCode,
        name: jobTitle,
        baseSalary: baseSal,
        additionalSalary: addNum,
        baseWageGuideline: totalSalary,
        workDays: 20,
        restDays: 10,
        totalCycleDays: 30,
        shiftNature: 'دورة قياسية (20+10)',
        minHeadcount: 2,
        isActive: true,
      },
    });

    await clearPendingJobMatrixAction(telegramId);
    await systemDataService.invalidateDepartmentsAndJobs();
    await ctx.deleteMessage().catch(() => {});

    await renderJobDetail(
      ctx,
      pending.deptCode,
      jobCode,
      false,
      `تمت إضافة وظيفة (${jobTitle}) بنجاح براتب إجمالي (${totalSalary.toLocaleString()} ج.م).`
    );
    return true;
  }

  // 8. تعديل الراتب الأساسي
  if (pending.action === 'edit_job_base_salary' && pending.deptCode && pending.jobCode) {
    const baseNum = parseFloat(textVal.replace(/[^0-9.]/g, '')) || 0;

    await setPendingJobMatrixAction(telegramId, {
      action: 'edit_job_additional_salary',
      deptCode: pending.deptCode,
      jobCode: pending.jobCode,
      draft: { baseSalary: baseNum },
      messageId: pending.messageId,
    });

    await ctx.deleteMessage().catch(() => {});

    await ctx.reply(
      `💰 *تعديل الراتب الإضافي والبدلات — الخطوة 2 من 2*\n` +
      `────────────────────────────\n` +
      `أدخل قيمة *الراتب الإضافي / الحوافز* بالجنيه المصري:\n` +
      `(مثال: \`2000\`)`,
      { parse_mode: 'Markdown' }
    );
    return true;
  }

  // 9. تعديل الراتب الإضافي والحفظ
  if (pending.action === 'edit_job_additional_salary' && pending.deptCode && pending.jobCode) {
    const addNum = parseFloat(textVal.replace(/[^0-9.]/g, '')) || 0;
    const baseSal = pending.draft?.baseSalary || 0;

    const job = await systemDataService.getJobByDeptAndCode(pending.deptCode, pending.jobCode);
    if (!job) return false;

    const totalSalary = baseSal + addNum;

    await prisma.jobTitle.update({
      where: { id: job.id },
      data: {
        baseSalary: baseSal,
        additionalSalary: addNum,
        baseWageGuideline: totalSalary,
      },
    });

    await clearPendingJobMatrixAction(telegramId);
    await systemDataService.invalidateDepartmentsAndJobs();
    await ctx.deleteMessage().catch(() => {});

    await renderJobDetail(
      ctx,
      pending.deptCode,
      pending.jobCode,
      false,
      `تم تحديث الراتب الاسترشادي بنجاح (أساسي: ${baseSal.toLocaleString()} | إضافي: ${addNum.toLocaleString()} | إجمالي: ${totalSalary.toLocaleString()} ج.م).`
    );
    return true;
  }

  // 10. تعديل المسمى الوظيفي
  if (pending.action === 'edit_job_name' && pending.deptCode && pending.jobCode) {
    if (textVal.length < 3) {
      await ctx.reply('⚠️ المسمى الوظيفي قصير جداً.');
      return true;
    }

    const job = await systemDataService.getJobByDeptAndCode(pending.deptCode, pending.jobCode);
    if (!job) return false;

    await prisma.jobTitle.update({
      where: { id: job.id },
      data: { name: textVal },
    });

    await clearPendingJobMatrixAction(telegramId);
    await systemDataService.invalidateDepartmentsAndJobs();
    await ctx.deleteMessage().catch(() => {});

    await renderJobDetail(ctx, pending.deptCode, pending.jobCode, false, `تم تعديل مسمى الوظيفة إلى (${textVal}) بنجاح.`);
    return true;
  }

  // 11. تعديل أيام العمل بالموقع (نصياً)
  if (pending.action === 'edit_job_work_days' && pending.deptCode && pending.jobCode) {
    const wdNum = parseInt(textVal.replace(/[^0-9]/g, ''), 10);
    if (!wdNum || wdNum < 1 || wdNum > 365) {
      await ctx.reply('⚠️ يرجى إدخال عدد أيام عمل صحيح (رقم بين 1 و 365).');
      return true;
    }

    await ctx.deleteMessage().catch(() => {});
    await handleSetWorkDays(ctx, pending.deptCode, pending.jobCode, wdNum);
    return true;
  }

  // 12. تعديل أيام الراحة والإجازة وحفظ الدورة (نصياً)
  if (pending.action === 'edit_job_rest_days' && pending.deptCode && pending.jobCode) {
    const rdNum = parseInt(textVal.replace(/[^0-9]/g, ''), 10);
    if (isNaN(rdNum) || rdNum < 0 || rdNum > 365) {
      await ctx.reply('⚠️ يرجى إدخال عدد أيام راحة صحيح (رقم 0 أو أكبر).');
      return true;
    }

    await ctx.deleteMessage().catch(() => {});
    await handleSetRestDays(ctx, pending.deptCode, pending.jobCode, rdNum);
    return true;
  }

  return false;
}
