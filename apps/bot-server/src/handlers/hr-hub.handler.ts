import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { workerService } from '../services/worker.service.js';

/**
 * 👥 تصيير بوابة الموارد البشرية والعمال (HR Domain Hub)
 * تطبق مبدأ الحجب المسبق الصارم (Pre-render RBAC UI Masking):
 * أزرار الإكسيل (تنزيل القالب / الرفع الجماعي) تظهر حصرياً للسوبر أدمن وتختفي كلياً للمشرف الميداني.
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

  // 🔒 الحجب المسبق الصارم: يظهر فقط للسوبر أدمن
  if (isSuperAdmin) {
    keyboard
      .row()
      .text('📥 تنزيل قالب العمال (إكسيل)', 'action:worker:download_excel')
      .row()
      .text('📤 رفع كشف العمال (إكسيل)', 'action:worker:upload_excel');
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
      text += `${i + 1}. ${flag} *${w.name}* (\`${w.code}\`)\n   💼 ${w.jobTitle} | 📍 ${siteName}\n`;
    });
  }

  text += `━━━━━━━━━━━━━━━━━━━━━\n`;

  const keyboard = new InlineKeyboard()
    .text('➕ تسجيل عامل جديد', 'action:worker:add_single')
    .row()
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
