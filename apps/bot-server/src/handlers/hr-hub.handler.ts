import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import { workerService } from '../services/worker.service.js';
import { screenFlowService } from '../services/screen-flow.service.js';

/**
 * 👥 تصيير بوابة قطاع الموارد البشرية والعمالة (HR Domain Hub)
 * مُقسمة إلى 5 أقسام فرعية بالترتيب المعتمد:
 * 1. 💵 السلف والمسحوبات وحسابات العمال
 * 2. 🏖️ الإجازات والدوام والتواجد الميداني
 * 3. 📁 شؤون العاملين والتعيينات
 * 4. 💰 الرواتب والأجور والمستحقات (محجوبة مسبقاً لغير السوبر أدمن)
 * 5. 🏛️ الشؤون الإدارية والوثائق والمخيم
 */
export async function renderHrHub(ctx: MyContext, inPlace = false): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  if (!ctx.from) return;
  const telegramId = BigInt(ctx.from.id);

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
    `اختر القسم الفرعي المطلوب للمتابعة:`;

  const keyboard = new InlineKeyboard()
    // 1st: السلف والمسحوبات وحسابات العمال
    .text('💵 السلف والمسحوبات وحسابات العمال', 'menu:hr_sub:advances')
    .row()
    // 2nd: الإجازات والدوام والتواجد الميداني
    .text('🏖️ الإجازات والدوام والتواجد الميداني', 'menu:hr_sub:leaves')
    .row()
    // 3rd: شؤون العاملين والتعيينات
    .text('📁 شؤون العاملين والتعيينات', 'menu:hr_sub:onboarding')
    .row();

  // 4th: الرواتب والأجور والمستحقات (حصرياً للسوبر أدمن مع الحجب المسبق الصارم)
  if (isSuperAdmin) {
    keyboard
      .text('💰 الرواتب والأجور والمستحقات', 'menu:hr_sub:payroll')
      .row();
  }

  // 5th: الشؤون الإدارية والوثائق والمخيم
  keyboard
    .text('🏛️ الشؤون الإدارية والوثائق والمخيم', 'menu:hr_sub:admin_affairs')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  let sentMsgId = 0;
  if (inPlace && ctx.callbackQuery) {
    try {
      const msg = await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      sentMsgId = typeof msg === 'object' ? msg.message_id : 0;
    } catch {
      const sent = await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      sentMsgId = sent.message_id;
    }
  } else {
    const sent = await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    sentMsgId = sent.message_id;
  }

  if (ctx.chat && sentMsgId) {
    await screenFlowService.trackActiveScreen(telegramId, ctx.chat.id, sentMsgId, 'hr_hub', false);
  }
}

/**
 * 📂 تصيير الأقسام الفرعية لبوابة الموارد البشرية
 */
export async function renderHrSubHub(ctx: MyContext, subKey: string, inPlace = true): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  if (!ctx.from) return;
  const telegramId = BigInt(ctx.from.id);

  const role = ctx.effectiveRole || 'GUEST';
  const isSuperAdmin = role === 'SUPER_ADMIN' || ctx.isRealSuperAdmin;

  let text = '';
  const keyboard = new InlineKeyboard();

  switch (subKey) {
    case 'advances': {
      text =
        `💵 *قسم السلف والمسحوبات وحسابات العمال*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `إدارة السلف النقدية، المصاريف الميدانية، ومسحوبات العمال اليومية.\n\n` +
        `اختر الإجراء المطلوب:`;

      keyboard
        .text('➕ طلب / تسجيل سلفة جديدة', 'action:advances:request')
        .row()
        .text('💸 تسجيل مسحوب نقدي ميداني', 'action:advances:cash_withdrawal')
        .row()
        .text('📋 سجل السلف والمسحوبات النشطة', 'action:advances:active_list')
        .row()
        .text('📊 كشف حساب وتصفية عامل', 'action:advances:worker_statement')
        .row();
      break;
    }

    case 'leaves': {
      text =
        `🏖️ *قسم الإجازات والدوام والتواجد الميداني*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `إدارة نزول واستئناف العمل، رصيد الإجازات، وحضور ومطابقة الموقع.\n\n` +
        `اختر الإجراء المطلوب:`;

      keyboard
        .text('➕ تسجيل إجازة أو نزول لعامل', 'action:leaves:request')
        .row()
        .text('🛬 تسجيل عودة واستئناف العمل', 'action:leaves:return')
        .row()
        .text('📍 كشف التواجد الميداني وحضور اليوم', 'action:leaves:daily_attendance')
        .row()
        .text('📋 سجل الإجازات والنزول المفتوح', 'action:leaves:active_list')
        .row();
      break;
    }

    case 'onboarding': {
      text =
        `📁 *قسم شؤون العاملين والتعيينات*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `تسجيل وتوثيق ملفات العمال الجدد، دليل السجل الشامل، وتعديل البيانات.\n\n` +
        `اختر الإجراء المطلوب:`;

      keyboard
        .text('➕ تسجيل وتعيين عامل جديد', 'action:worker:add_single')
        .row()
        .text('📋 دليل وسجل العاملين (360°)', 'action:worker:directory')
        .row();

      if (isSuperAdmin) {
        keyboard.text('✏️ تعديل بيانات عامل (تنفيذ فوري)', 'action:worker_edit:pick').row();

        const pendingCount = await prisma.workerEditRequest.count({ where: { status: 'PENDING' } }).catch(() => 0);
        if (pendingCount > 0) {
          keyboard.text(`📨 مراجعة طلبات التعديل المعلقة (\${pendingCount})`, 'action:worker_edit:pending_list').row();
        }
      } else {
        keyboard.text('📝 طلب تعديل بيانات عامل', 'action:worker_edit:pick').row();
      }

      keyboard
        .text('📥📤 استيراد وتصدير كشف العمال', 'menu:hr_sub:worker_excel')
        .row();
      break;
    }

    case 'worker_excel': {
      text =
        `📥📤 *قسم استيراد وتصدير كشف العمال*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `تنزيل كشف العمال المعتمد (إكسيل)، تنزيل القالب الرسمي، ورفع وتحديث البيانات.\n\n` +
        `اختر الإجراء المطلوب:`;

      keyboard
        .text('📊 تنزيل كشف العاملين (إكسيل)', 'action:worker_export:start')
        .row()
        .text('📥 تنزيل قالب استيراد العمالة', 'action:worker:download_excel')
        .row();

      if (isSuperAdmin) {
        keyboard
          .text('📤 رفع كشف العمال (إكسيل)', 'action:worker:upload_excel')
          .row();
      }

      keyboard
        .text('◀️ رجوع لشؤون العاملين', 'menu:hr_sub:onboarding')
        .row();
      break;
    }

    case 'payroll': {
      if (!isSuperAdmin) {
        return renderHrHub(ctx, inPlace);
      }

      text =
        `💰 *قسم الرواتب والأجور والمستحقات*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `إدارة مسيرات الرواتب الشهرية، قسائم القبض، البدلات، والتسويات المالية.\n\n` +
        `اختر الإجراء المطلوب:`;

      keyboard
        .text('📊 مسير الرواتب الشهري العام', 'action:payroll:monthly_sheet')
        .row()
        .text('🧾 إصدار وتوزيع قسائم الرواتب', 'action:payroll:slips')
        .row()
        .text('⚙️ إعدادات البدلات والاستقطاعات', 'action:payroll:allowances_settings')
        .row()
        .text('💰 ترحيل الرواتب والمطابقة البنكية', 'action:payroll:bank_export')
        .row();
      break;
    }

    case 'admin_affairs': {
      text =
        `🏛️ *الشؤون الإدارية والوثائق والمخيم*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `متابعة سريان بطاقات الهوية، سكن ومخيم العمال، الجزاءات، والمخاطبات.\n\n` +
        `اختر الإجراء المطلوب:`;

      keyboard
        .text('🪪 تنبيهات سريان البطاقات والوثائق', 'action:admin_affairs:expiry_alerts')
        .row()
        .text('⛺ سكن العمال والمخيم والإعاشة', 'action:admin_affairs:camp_management')
        .row()
        .text('⚖️ الجزاءات والإنذارات والمكافآت', 'action:admin_affairs:penalties_rewards')
        .row()
        .text('📄 الشهادات والخطابات الإدارية', 'action:admin_affairs:letters')
        .row();
      break;
    }

    default:
      return renderHrHub(ctx, inPlace);
  }

  // Navigation rows
  keyboard
    .text('🔙 العودة للموارد البشرية', 'menu:domain:hr')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  let sentMsgId = 0;
  if (inPlace && ctx.callbackQuery) {
    try {
      const msg = await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      sentMsgId = typeof msg === 'object' ? msg.message_id : 0;
    } catch {
      const sent = await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      sentMsgId = sent.message_id;
    }
  } else {
    const sent = await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    sentMsgId = sent.message_id;
  }

  if (ctx.chat && sentMsgId) {
    await screenFlowService.trackActiveScreen(telegramId, ctx.chat.id, sentMsgId, `hr_sub:\${subKey}`, false);
  }
}

/**
 * 🏗️ شاشة إعلامية للوظائف الفرعية الجاري استكمالها في أقسام الموارد البشرية
 */
export async function handleHrPlaceholder(ctx: MyContext): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  const callbackData = ctx.callbackQuery?.data || '';

  const keyboard = new InlineKeyboard()
    .text('🔙 العودة للموارد البشرية', 'menu:domain:hr')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  const text =
    `🏗️ *هذه الوظيفة قيد التجهيز المالي والربط الميداني*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔹 *المعرف الإجرائي:* \`${callbackData}\`\n` +
    `🔹 *الحالة التشغيلية:* تم اعتماد هيكل القسم والزر، وجارٍ استكمال بناء معالج الإدخال المالي والترحيل وفق وثيقة الحوكمة (SSOT).\n\n` +
    `اضغط أدناه للعودة:`;

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

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}
