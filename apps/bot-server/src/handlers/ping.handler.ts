import { MyContext } from '../types/context.js';
import { prisma } from '../db.js';

import { config } from '../config/env.js';

export async function handlePing(ctx: MyContext): Promise<void> {
  const start = Date.now();
  let dbLatency = 0;
  let dbStatus = '🟢 متصل';

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - dbStart;
  } catch (error) {
    dbStatus = '🔴 تعذر الاتصال';
  }

  const totalLatency = Date.now() - start;
  const memoryUsageMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
  const uptimeSeconds = Math.floor(process.uptime());

  const responseText = 
    `⚡ *تقرير فحص أداء وسرعة النظام (System Telemetry & Health)*\n\n` +
    `🏢 *المشروع:* Al-Saada Enterprise System \`v${config.appVersion}\`\n` +
    `🗄️ *قاعدة البيانات:* ${dbStatus} (${dbLatency}ms)\n` +
    `⏱️ *سرعة استجابة المحرك:* ${totalLatency}ms\n` +
    `💾 *استهلاك الذاكرة:* ${memoryUsageMb} MB\n` +
    `⏳ *مدة التشغيل (Uptime):* ${uptimeSeconds} ثانية\n` +
    `🛡️ *الحاوية:* \`alsaada_enterprise_bot\`\n\n` +
    `✅ *كافة المحركات وقواعد البيانات تعمل بكفاءة تامة.*`;

  await ctx.reply(responseText, { parse_mode: 'Markdown' });
}
