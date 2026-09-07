import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { workerService } from '../services/worker.service.js';
import { prisma } from '../db.js';

/**
 * 👥 تصيير بوابة الموارد البشرية والعمال (HR Domain Hub)
 * تطبق مبدأ الحجب المسبق الصارم (Pre-render RBAC UI Masking):
 * - أزرار الإكسيل (تنزيل القالب / الرفع الجماعي) تظهر حصرياً للسوبر أدمن.
 * - زر تعديل بيانات عامل يظهر كـ "✏️ تعديل بيانات عامل" للسوبر أدمن وكـ "📝 طلب تعديل بيانات عامل" للمشرف الميداني.
 */
export async function renderHrHub(ctx: MyContext, inPlace = false): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  const role = ctx.effectiveRole || 'GUEST';
  const isSuperAdmin = role === 'SUPER_ADMIN' || ctx.isRealSuperAdmin;

  // جلب إحصائيات سريعة من الكاش
  const summary = await workerService.getWorkersSummary().catch(() => ({
    totalActive: 0,
    egyptianCount: 0,
    foreignCount: 0,
  }));

  const text =
    `👥 *بوابة قطاع الموارد البشرية والعمالة*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `مرحباً بك في المركز التشغيلي لإدارة قوى العمل والمواقع لشركة السعادة.\n\n` +
    `📊 *الموقف الحالي للقوى العاملة:*\n` +
    `• إجمالي العمالة النشطة بالمواقع: *${summary.totalActive} عامل*\n` +
    `  ├─ 🇪🇬 عمالة مصرية (رقم قومي): *${summary.egyptianCount}*\n` +
    `  └─ 🌍 عمالة وافدة (جواز سفر): *${summary.foreignCount}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `اختر الإجراء المطلوب من القائمة أدناه:`;

  const keyboard = new InlineKeyboard()
    .text('➕ تسجيل وتعيين عامل جديد', 'action:worker:add_single')
    .row()
    .text('📋 دليل وسجل العاملين', 'action:worker:directory');

  // حوكمة التعديل: تعديل فوري للسوبر أدمن مقابل طلب تعديل للمشرف
  if (isSuperAdmin) {
    keyboard.row().text('✏️ تعديل بيانات عامل (تنفيذ فوري)', 'action:worker_edit:pick');

    const pendingRequestsCount = await prisma.workerEditRequest.count({ where: { status: 'PENDING' } }).catch(() => 0);
    if (pendingRequestsCount > 0) {
      keyboard.row().text(`📨 طلبات التعديل المعلقة (${pendingRequestsCount})`, 'action:worker_edit:pending_list');
    }

    keyboard
      .row()
      .text('📥 تنزيل قالب العمال (إكسيل)', 'action:worker:download_excel')
      .row()
      .text('📤 رفع كشف العمال (إكسيل)', 'action:worker:upload_excel');
  } else {
    keyboard.row().text('📝 طلب تعديل بيانات عامل', 'action:worker_edit:pick');
  }

  keyboard
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

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
 * 📋 استعراض دليل وسجل العاملين الحالي
 */
export async function renderWorkersDirectory(ctx: MyContext, inPlace = false): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  const role = ctx.effectiveRole || 'GUEST';
  const isSuperAdmin = role === 'SUPER_ADMIN' || ctx.isRealSuperAdmin;

  const workers = await workerService.getRecentWorkers(15).catch(() => []);

  let text =
    `📋 *دليل وسجل العاملين (أحدث السجلات)*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n`;

  if (workers.length === 0) {
    text += `_لا توجد سجلات مسجلة للعمال حتى الآن._\n`;
  } else {
    workers.forEach((w, i) => {
      const flag = w.idType === 'PASSPORT' ? '🌍' : '🇪🇬';
      const siteName = w.site?.name || 'غير محدد';
      const legacyTag = w.legacyCode ? ` [قديم: \`${w.legacyCode}\`]` : '';
      text += `${i + 1}. ${flag} *${w.name}* (\`${w.code}\`)${legacyTag}\n   💼 ${w.jobTitle} | 📍 ${siteName}\n`;
    });
  }

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;

  const keyboard = new InlineKeyboard()
    .text('➕ تسجيل عامل جديد', 'action:worker:add_single')
    .row();

  if (isSuperAdmin) {
    keyboard.text('✏️ تعديل بيانات عامل', 'action:worker_edit:pick').row();
  } else {
    keyboard.text('📝 طلب تعديل بيانات عامل', 'action:worker_edit:pick').row();
  }

  keyboard
    .text('🔙 العودة للموارد البشرية', 'menu:domain:hr')
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

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
