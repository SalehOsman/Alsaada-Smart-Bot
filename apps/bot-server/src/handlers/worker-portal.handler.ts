import { InlineKeyboard } from 'grammy';
import type { MyContext } from '../types/context.js';
import { prisma } from '../db.js';
import { formatDate } from '@alsaada/regional-engine';
import { GuestJoinRepository } from '@alsaada/workforce';

export async function handleWorkerSubHub(
  ctx: MyContext,
  hub: 'profile' | 'finance' | 'attendance' | 'custody' | 'support'
): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => {});
  }

  let title = '';
  let text = '';
  const kb = new InlineKeyboard();

  if (hub === 'profile') {
    title = '👤 *بوابة الملف الشخصي والبيانات الوظيفية*';
    text =
      `${title}\n` +
      `────────────────────────────\n` +
      `هنا يمكنك استعراض بطاقة ملفك الوظيفي، بيانات التأمينات، أو تقديم طلب تعديل بياناتك الشخصية.\n\n` +
      `👇 *اختر الخدمة المطلوبة:*`;

    kb.text('👤 استعراض بطاقة ملفي الوظيفي', 'action:worker:my_profile')
      .row()
      .text('✏️ طلب تحديث بياناتي الشخصية', 'wizard:worker_self_edit:start')
      .row()
      .text('🆔 بطاقتي الرقمية وكود العامل', 'action:worker:id_card')
      .row()
      .text('🔙 العودة لبوابة العامل', 'action:main_menu');
  } else if (hub === 'finance') {
    title = '💰 *بوابة المستحقات والماليات*';
    text =
      `${title}\n` +
      `────────────────────────────\n` +
      `متابعة السلف، المسحوبات، قسائم الرواتب الشهرية، وتقديم طلبات السلف.\n\n` +
      `👇 *اختر الخدمة المطلوبة:*`;

    kb.text('📊 كشف حسابي ومسحوباتي', 'menu:worker:statement')
      .row()
      .text('🧾 مفردات قسيمة الراتب', 'menu:worker:payslip')
      .row()
      .text('💵 تقديم طلب سلفة مالية', 'menu:worker:advance_req')
      .row()
      .text('🔙 العودة لبوابة العامل', 'action:main_menu');
  } else if (hub === 'attendance') {
    title = '⏱️ *بوابة الدوام والحضور والإجازات*';
    text =
      `${title}\n` +
      `────────────────────────────\n` +
      `استعراض دورة العمل والورديات، رصيد الإجازات السنوية، وتقديم طلبات الإجازة الرسمية.\n\n` +
      `👇 *اختر الخدمة المطلوبة:*`;

    kb.text('🏖️ تقديم طلب إجازة', 'menu:worker:leave_req')
      .row()
      .text('🌴 رصيد الإجازات السنوية', 'menu:worker:leaves_balance')
      .row()
      .text('🔄 نظام الوردية ومواعيد العمل', 'menu:worker:shift_info')
      .row()
      .text('🔙 العودة لبوابة العامل', 'action:main_menu');
  } else if (hub === 'custody') {
    title = '🦺 *بوابة العهد ومهمات السلامة (PPE)*';
    text =
      `${title}\n` +
      `────────────────────────────\n` +
      `متابعة مهمات الوقاية الشخصية المسلمة لك، وتاريخ استحقاق التجديد والاستبدال.\n\n` +
      `👇 *اختر الخدمة المطلوبة:*`;

    kb.text('🦺 عهدي ومهمات السلامة المسلمة', 'menu:worker:ppe')
      .row()
      .text('🔄 طلب استبدال مهمات وقاية', 'menu:worker:ppe_replace')
      .row()
      .text('🔙 العودة لبوابة العامل', 'action:main_menu');
  } else {
    // support
    title = '💬 *بوابة الدعم والشكاوى واللوائح*';
    text =
      `${title}\n` +
      `────────────────────────────\n` +
      `تقديم التظلمات الميدانية، استعراض لوائح العمل الرسمية، وأرقام الطوارئ.\n\n` +
      `👇 *اختر الخدمة المطلوبة:*`;

    kb.text('💬 تقديم استفسار / تظلم ميداني', 'menu:worker:ticket')
      .row()
      .text('📜 لوائح وسياسات العمل بالشركة', 'menu:worker:policies')
      .row()
      .text('📞 أرقام الطوارئ والتواصل الميداني', 'menu:worker:emergency_contacts')
      .row()
      .text('🔙 العودة لبوابة العامل', 'action:main_menu');
  }

  if (ctx.isImpersonating && ctx.isRealSuperAdmin) {
    kb.row().text('🎭 إنهاء وضع المحاكاة (العودة كمدير عام)', 'action:exit_impersonate');
  }

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
      return;
    } catch {}
  }
  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
}

export async function handleMyWorkerProfile(ctx: MyContext): Promise<void> {
  if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

  const telegramId = ctx.from ? BigInt(ctx.from.id) : 0n;
  const guestJoinRepo = new GuestJoinRepository(prisma);
  const worker = await guestJoinRepo.findWorkerProfile(ctx.workerId, telegramId);

  if (!worker) {
    await ctx.reply('❌ تعذر العثور على سجل العامل المرتبط بحسابك.');
    return;
  }

  const hireDateStr = formatDate(worker.hireDate);
  const text =
    `👤 *بطاقة الملف الوظيفي للعامل*\n` +
    `────────────────────────────\n` +
    `🔹 *الاسم:* *${worker.nickname || worker.name}*\n` +
    `🔹 *الكود الوظيفي:* \`#${worker.code}\`\n` +
    `🔹 *المسمى الوظيفي:* ${worker.jobTitle}\n` +
    `🔹 *القسم:* ${worker.department?.name || 'التشغيل'}\n` +
    `🔹 *الموقع الميداني:* ${worker.site?.name || 'الموقع العام'}\n` +
    `🔹 *تاريخ المباشرة:* ${hireDateStr}\n` +
    `🔹 *الحالة الوظيفية:* 🟢 نشط\n` +
    `────────────────────────────\n` +
    `📌 لتحديث بيانات التواصل أو المحفظة، اضغط على زر التحديث أدناه:`;

  const kb = new InlineKeyboard()
    .text('✏️ طلب تعديل بياناتي', 'wizard:worker_self_edit:start')
    .row()
    .text('🔙 العودة لبوابة العامل', 'action:main_menu');

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
      return;
    } catch {}
  }
  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
}

export async function handleWorkerIdCard(ctx: MyContext): Promise<void> {
  if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});

  const telegramId = ctx.from ? BigInt(ctx.from.id) : 0n;
  const guestJoinRepo = new GuestJoinRepository(prisma);
  const worker = await guestJoinRepo.findWorkerProfile(ctx.workerId, telegramId);

  const workerCode = worker?.code || ctx.workerCode || 'N/A';
  const workerName = worker?.nickname || worker?.name || ctx.from?.first_name || 'عامل';
  const siteName = worker?.site?.name || 'موقع العمل';

  const text =
    `🆔 *بطاقة الهوية الرقمية للعامل*\n` +
    `🏢 *شركة السعادة للمقاولات العامة والتعدين*\n` +
    `────────────────────────────\n` +
    `🔹 *الاسم المعتمد:* *${workerName}*\n` +
    `🔹 *الكود المعتمد:* \`#${workerCode}\`\n` +
    `🔹 *الموقع:* ${siteName}\n` +
    `🔹 *معرف التيليجرام:* \`${telegramId.toString()}\`\n` +
    `────────────────────────────\n` +
    `✅ هذه البطاقة الرقمية معتمدة لإثبات الشخصية واستلام المهمات بالمواقع الميدانية.`;

  const kb = new InlineKeyboard()
    .text('🔙 العودة لبوابة العامل', 'action:main_menu');

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
      return;
    } catch {}
  }
  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
}

export async function handleGuestIdentity(ctx: MyContext): Promise<void> {
  if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
  const telegramId = ctx.from?.id ? ctx.from.id.toString() : '0';
  const name = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ') || 'زائر جديد';

  const text =
    `🆔 *بطاقة المعرف الرقمي الخاصة بك*\n` +
    `────────────────────────────\n` +
    `🔹 *المعرف الرقمي:* \`${telegramId}\`\n` +
    `🔹 *الاسم:* *${name}*\n` +
    `🔹 *الصفة:* *زائر (GUEST)*\n` +
    `🔹 *حالة الحساب:* ⏳ غير مرتبط بسجل وظيفي\n\n` +
    `يمكنك تزويد إدارة الموارد البشرية بهذا المعرف لاعتماد حسابك أو تقديم طلب انضمام عبر زر التقديم أدناه.`;

  const kb = new InlineKeyboard()
    .text('📝 تقديم طلب انضمام وربط حساب', 'wizard:guest_join:start')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb });
      return;
    } catch {}
  }
  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
}
