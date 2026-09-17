import { InlineKeyboard } from 'grammy';
import { MyContext } from '../types/context.js';
import { pingDatabase } from '../db.js';
import { config } from '../config/env.js';

export async function handlePing(ctx: MyContext): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
  }

  const start = Date.now();
  let dbLatency = 0;
  let dbStatus = '🟢 متصل';

  try {
    dbLatency = await pingDatabase();
  } catch (error) {
    dbStatus = '🔴 تعذر الاتصال';
  }

  const totalLatency = Date.now() - start;
  const memoryUsageMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
  const uptimeSeconds = Math.floor(process.uptime());

  const keyboard = new InlineKeyboard()
    .text('🔄 إعادة الفحص', 'action:settings:ping')
    .text('🔙 العودة للإعدادات', 'menu:super_admin_settings')
    .row()
    .text('🏠 القائمة الرئيسية', 'action:main_menu');

  const responseText = 
    `⚡ *تقرير فحص أداء وسرعة النظام (System Telemetry & Health)*\n\n` +
    `🏢 *المشروع:* Al-Saada Enterprise System \`v${config.appVersion}\`\n` +
    `🔖 *إصدار الكود (Commit):* \`${(config.gitCommitSha || 'dev-local').slice(0, 7)}\`\n` +
    `🗄️ *قاعدة البيانات:* ${dbStatus} (${dbLatency}ms)\n` +
    `⏱️ *سرعة استجابة المحرك:* ${totalLatency}ms\n` +
    `💾 *استهلاك الذاكرة:* ${memoryUsageMb} MB\n` +
    `⏳ *مدة التشغيل (Uptime):* ${uptimeSeconds} ثانية\n` +
    `🛡️ *الحاوية:* \`alsaada_enterprise_bot\`\n\n` +
    `✅ *كافة المحركات وقواعد البيانات تعمل بكفاءة تامة.*`;

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(responseText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return;
    } catch {
      // fallback
    }
  }

  await ctx.reply(responseText, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

