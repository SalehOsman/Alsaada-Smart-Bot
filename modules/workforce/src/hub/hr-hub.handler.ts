import { InlineKeyboard } from 'grammy';
import { prisma as defaultPrisma, type PrismaClient } from '@alsaada/database';
import type { WorkforceModuleContext } from '../shared/module.types.js';
import { WorkerDirectoryRepository } from '../flows/01.5-worker-directory/flow.repository.js';
import { buildHrSubHubKeyboard } from './hub.keyboards.js';

/**
 * 👥 تصيير بوابة قطاع الموارد البشرية والعمالة (HR Domain Hub)
 * مُقسمة إلى 5 أقسام فرعية بالترتيب المعتمد:
 * 1. 💵 السلف والمسحوبات وحسابات العمال
 * 2. 🏖️ الإجازات والدوام والتواجد الميداني
 * 3. 📁 شؤون العاملين والتعيينات
 * 4. 💰 الرواتب والأجور والمستحقات (محجوبة مسبقاً لغير السوبر أدمن)
 * 5. 🏛️ الشؤون الإدارية والوثائق والمخيم
 */
export async function renderHrHub(
  ctx: WorkforceModuleContext,
  inPlace = true,
  prisma?: PrismaClient
): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  if (!ctx.from) return;

  const role = ctx.effectiveRole || 'GUEST';
  const isSuperAdmin = ctx.isImpersonating ? role === 'SUPER_ADMIN' : Boolean(role === 'SUPER_ADMIN' || ctx.isRealSuperAdmin);

  const activePrisma = prisma || (ctx as any).prisma || (defaultPrisma as unknown as PrismaClient);
  // جلب إحصائيات سريعة من قاعدة البيانات عبر المستودع
  const repo = new WorkerDirectoryRepository(activePrisma);
  const summary = await repo.getWorkersSummary().catch(() => ({
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
    .text('💵 السلف والمسحوبات وحسابات العمال', 'menu:hr_sub:advances')
    .row()
    .text('🏖️ الإجازات والدوام والتواجد الميداني', 'menu:hr_sub:leaves')
    .row()
    .text('📁 شؤون العاملين والتعيينات', 'menu:hr_sub:onboarding')
    .row();

  if (isSuperAdmin) {
    keyboard
      .text('💰 الرواتب والأجور والمستحقات', 'menu:hr_sub:payroll')
      .row();
  }

  keyboard
    .text('🏛️ الشؤون الإدارية والوثائق والمخيم', 'menu:hr_sub:admin_affairs')
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
      // fallback to reply
    }
  }

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

/**
 * 📂 تصيير الأقسام الفرعية لبوابة الموارد البشرية
 */
export async function renderHrSubHub(
  ctx: WorkforceModuleContext,
  subKey: string,
  inPlace = true,
  prisma?: PrismaClient
): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }
  if (!ctx.from) return;

  const role = ctx.effectiveRole || 'GUEST';
  const isSuperAdmin = ctx.isImpersonating ? role === 'SUPER_ADMIN' : Boolean(role === 'SUPER_ADMIN' || ctx.isRealSuperAdmin);

  const activePrisma = prisma || (ctx as any).prisma || (defaultPrisma as unknown as PrismaClient);
  let text = '';
  let keyboard = new InlineKeyboard();

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

      let pendingCount = 0;
      let pendingDecisionsCount = 0;
      if (isSuperAdmin) {
        [pendingCount, pendingDecisionsCount] = await Promise.all([
          activePrisma.workerEditRequest.count({ where: { status: 'PENDING' } }).catch(() => 0),
          activePrisma.disciplinaryAndBonus.count({ where: { approvedByUserId: null } }).catch(() => 0),
        ]);
      }

      keyboard = buildHrSubHubKeyboard('onboarding', role, isSuperAdmin, {
        pendingEditCount: pendingCount,
        pendingDecisionsCount,
      });
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
        return renderHrHub(ctx, inPlace, activePrisma);
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
      return renderHrHub(ctx, inPlace, activePrisma);
  }

  // Navigation rows
  keyboard
    .text('🔙 العودة للموارد البشرية', 'menu:domain:hr')
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

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

/**
 * 🏗️ شاشة إعلامية للوظائف الفرعية الجاري استكمالها في أقسام الموارد البشرية
 */
export async function handleHrPlaceholder(ctx: WorkforceModuleContext): Promise<void> {
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

export class HrHubHandler {
  constructor(private readonly prisma: PrismaClient) {}

  renderHrHub(ctx: WorkforceModuleContext, inPlace = false): Promise<void> {
    return renderHrHub(ctx, inPlace, this.prisma);
  }

  renderHrSubHub(ctx: WorkforceModuleContext, subKey: string, inPlace = true): Promise<void> {
    return renderHrSubHub(ctx, subKey, inPlace, this.prisma);
  }

  handleHrPlaceholder(ctx: WorkforceModuleContext): Promise<void> {
    return handleHrPlaceholder(ctx);
  }
}
