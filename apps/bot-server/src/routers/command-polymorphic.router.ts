import type { Bot } from 'grammy';
import type { MyContext } from '../types/context.js';
import { screenFlowService } from '../services/screen-flow.service.js';
import {
  handleWorkerSubHub,
  handleMyWorkerProfile,
  handleGuestIdentity,
} from '../handlers/worker-portal.handler.js';

export interface PolymorphicRouterOptions {
  renderAdminProfile: (ctx: MyContext, inPlace: boolean) => Promise<void>;
  startGuestJoin: (ctx: MyContext) => Promise<void>;
  checkGuestStatus: (ctx: MyContext) => Promise<void>;
}

export async function handleProfileCommand(
  ctx: MyContext,
  options: PolymorphicRouterOptions
): Promise<void> {
  await screenFlowService.cleanupIncomingUserMessage(ctx);
  const role = ctx.effectiveRole || 'GUEST';

  if (role === 'SUPER_ADMIN' || role === 'FIELD_ADMIN') {
    await options.renderAdminProfile(ctx, false);
    return;
  }

  if (role === 'WORKER') {
    await handleMyWorkerProfile(ctx);
    return;
  }

  if (role === 'GUEST') {
    await handleGuestIdentity(ctx);
    return;
  }

  await ctx.reply(
    `👤 *ملفك الشخصي*\n` +
    `────────────────────────────\n` +
    `🔹 *المعرف الرقمي:* \`${ctx.from?.id}\`\n` +
    `🔹 *الدور:* *${role}*\n` +
    `🔹 *الاسم:* *${ctx.from?.first_name || ''} ${ctx.from?.last_name || ''}*`,
    { parse_mode: 'Markdown' }
  );
}

export async function handleLeaveCommand(ctx: MyContext): Promise<void> {
  await screenFlowService.cleanupIncomingUserMessage(ctx);
  const role = ctx.effectiveRole || 'GUEST';

  if (role === 'WORKER') {
    await handleWorkerSubHub(ctx, 'attendance');
    return;
  }

  await ctx.reply('⚠️ *تنبيه:* خدمة تقديم طلبات الإجازات مخصصة حصرياً للعاملين المسجلين بالمنظومة.', {
    parse_mode: 'Markdown',
  });
}

export async function handleAdvanceCommand(ctx: MyContext): Promise<void> {
  await screenFlowService.cleanupIncomingUserMessage(ctx);
  const role = ctx.effectiveRole || 'GUEST';

  if (role === 'WORKER') {
    await handleWorkerSubHub(ctx, 'finance');
    return;
  }

  await ctx.reply('ℹ️ خدمة طلب السلف النقدية متاحة للعاملين عبر بوابتهم الذاتية.', {
    parse_mode: 'Markdown',
  });
}

export async function handleHelpCommand(ctx: MyContext): Promise<void> {
  await screenFlowService.cleanupIncomingUserMessage(ctx);
  const role = ctx.effectiveRole || 'GUEST';

  if (role === 'GUEST') {
    await ctx.reply(
      `❓ *دليل استخدام الزوار والمستخدمين الجدد*\n` +
      `────────────────────────────\n` +
      `• لتقديم طلب انضمام وربط حسابك بسجلك الوظيفي، استخدم الأمر \`/apply\` أو زر تقديم الطلب.\n` +
      `• لمتابعة حالة طلب الانضمام، استخدم الأمر \`/status\`.\n` +
      `• لإلغاء أي إجراء، استخدم الأمر \`/cancel\`.\n` +
      `• للمساعدة والتواصل، راجع إدارة الموارد البشرية بالشركة.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (role === 'WORKER') {
    await ctx.reply(
      `❓ *دليل خدمات العامل الميداني الذاتية*\n` +
      `────────────────────────────\n` +
      `• \`/profile\`: استعراض وتحديث بياناتك الشخصية.\n` +
      `• \`/leave\`: تقديم طلب إجازة واستعراض رصيدك.\n` +
      `• \`/advance\`: تقديم طلب سلفة مالية.\n` +
      `• \`/start\`: القائمة الرئيسية وبوابات الخدمات الخمس.\n` +
      `• \`/cancel\`: إلغاء أي إجراء مؤقت والعودة.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  await ctx.reply(
    `❓ *دليل الأوامر الإدارية والتشغيلية*\n` +
    `────────────────────────────\n` +
    `• \`/start\`: اللوحة التشغيلية المركزية.\n` +
    `• \`/profile\`: إدارة الحساب والملف الشخصي.\n` +
    `• \`/cancel\`: إلغاء المعاملة الجارية فوراً.\n` +
    `• \`/ping\`: فحص سلامة وسرعة استجابة المنظومة.`,
    { parse_mode: 'Markdown' }
  );
}

export async function handleApplyCommand(
  ctx: MyContext,
  options: PolymorphicRouterOptions
): Promise<void> {
  await screenFlowService.cleanupIncomingUserMessage(ctx);
  const role = ctx.effectiveRole || 'GUEST';

  if (role === 'GUEST') {
    await options.startGuestJoin(ctx);
    return;
  }

  await ctx.reply('ℹ️ حسابك مسجل ومفعل بالفعل بالمنظومة بالدور: *' + role + '*.', {
    parse_mode: 'Markdown',
  });
}

export async function handleStatusCommand(
  ctx: MyContext,
  options: PolymorphicRouterOptions
): Promise<void> {
  await screenFlowService.cleanupIncomingUserMessage(ctx);
  const role = ctx.effectiveRole || 'GUEST';

  if (role === 'GUEST') {
    await options.checkGuestStatus(ctx);
    return;
  }

  await ctx.reply(`🟢 *حالة الحساب:* معتمد ونشط بالمنظومة بصلاحية *${role}*.`, {
    parse_mode: 'Markdown',
  });
}

export async function handleIdCommand(ctx: MyContext): Promise<void> {
  await screenFlowService.cleanupIncomingUserMessage(ctx);
  const role = ctx.effectiveRole || 'GUEST';
  if (role === 'WORKER') {
    await handleMyWorkerProfile(ctx);
  } else {
    await handleGuestIdentity(ctx);
  }
}

export function registerPolymorphicCommands(
  bot: Bot<MyContext>,
  options: PolymorphicRouterOptions
): void {
  bot.command('profile', (ctx) => handleProfileCommand(ctx, options));
  bot.command(['leave', 'vacation'], (ctx) => handleLeaveCommand(ctx));
  bot.command(['advance', 'loan'], (ctx) => handleAdvanceCommand(ctx));
  bot.command('help', (ctx) => handleHelpCommand(ctx));
  bot.command('apply', (ctx) => handleApplyCommand(ctx, options));
  bot.command('status', (ctx) => handleStatusCommand(ctx, options));
  bot.command(['my_id', 'id'], (ctx) => handleIdCommand(ctx));
}
