import { InlineKeyboard } from 'grammy';
import { PrismaClient, decryptField } from '@alsaada/database';
import { formatDate } from '@alsaada/regional-engine';


export interface WorkerExpiryAlertOptions {
  prisma: PrismaClient;
  encryptionKey?: string;
  superAdminTelegramId?: bigint;
}

export class WorkerExpiryAlertService {
  private prisma?: PrismaClient | undefined;
  private encryptionKey?: string | undefined;
  private superAdminTelegramId?: bigint | undefined;

  constructor(options?: WorkerExpiryAlertOptions) {
    if (options) {
      this.prisma = options.prisma;
      this.encryptionKey = options.encryptionKey;
      this.superAdminTelegramId = options.superAdminTelegramId;
    }
  }

  setContext(options: WorkerExpiryAlertOptions) {
    this.prisma = options.prisma;
    this.encryptionKey = options.encryptionKey;
    this.superAdminTelegramId = options.superAdminTelegramId;
  }
  /**
   * فحص العمال الذين تنتهي بطاقاتهم خلال 30 يوماً وإرسال الإشعارات الاستباقية
   */
  async checkAndDispatchExpiryAlerts(botApi?: any): Promise<{ checkedCount: number; alertedCount: number }> {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    // جلب العمال الذين تنتهي بطاقتهم خلال الـ 30 يوماً القادمة
    const workersNearExpiry = await (this.prisma || (globalThis as any).prisma).worker.findMany({
      where: {
        isDeleted: false,
        status: 'ACTIVE',
        idCardExpiryDate: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
        OR: [
          { idCardExpiryAlertSentAt: null },
          { idCardExpiryAlertSentAt: { lte: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000) } },
        ],
      },
      include: {
        site: true,
      },
    });

    let alertedCount = 0;

    for (const worker of workersNearExpiry) {
      if (!worker.idCardExpiryDate) continue;

      const diffMs = worker.idCardExpiryDate.getTime() - now.getTime();
      const daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      const expiryFormatted = formatDate(worker.idCardExpiryDate);

      let cleanPhone = worker.phoneEncrypted || '';
      if (this.encryptionKey && worker.phoneEncrypted) {
        try {
          cleanPhone = decryptField(worker.phoneEncrypted, this.encryptionKey);
        } catch {
          cleanPhone = worker.phoneEncrypted;
        }
      }

      // 1. إرسال إشعار مباشر للعامل إن كان حسابه مربوطاً في تليجرام
      if (botApi && worker.telegramId) {
        try {
          await botApi.sendMessage(
            Number(worker.telegramId),
            '🔔 *تنبيه رسمي: اقتراب انتهاء سريان بطاقة الرقم القومي*\n' +
            '━━━━━━━━━━━━━━━━━━━━━\n' +
            'عزيزي الزميل/ *' + worker.name + '*،\n\n' +
            'نحيطكم علماً بأن بطاقة الرقم القومي الخاصة بكم تنتهي في *' + expiryFormatted + '* (متبقي *' + daysRemaining + ' يوماً*).\n\n' +
            '⚠️ يرجى سرعة التوجه للسجل المدني لتجديد البطاقة وتسليم صورة الوجه والظهر بعد التجديد لمكتب الشؤون الإدارية بالموقع.\n\n' +
            '_شركة السعادة للمقاولات العامة - إدارة الموارد البشرية_',
            { parse_mode: 'Markdown' }
          );
        } catch (err) {
          console.warn('⚠️ Could not send Telegram expiry alert to worker ' + worker.code + ':', err);
        }
      }

      // 2. إرسال بطاقة حوكمة إدارية للمدير العام (السوبر أدمن)
      if (botApi && this.superAdminTelegramId && this.superAdminTelegramId > 0n) {
        const waText = encodeURIComponent(
          'السلام عليكم يا ' + worker.name + '، نود إحاطتك علماً بأن بطاقة الرقم القومي الخاصة بك تنتهي بتاريخ ' + expiryFormatted + ' (متبقي ' + daysRemaining + ' يوماً). يرجى التكرم ببدء إجراءات التجديد وتسليم الصورة للإدارة بالموقع.'
        );
        const waPhone = cleanPhone.startsWith('0') ? '20' + cleanPhone.substring(1) : cleanPhone;
        const waUrl = 'https://wa.me/' + waPhone + '?text=' + waText;

        const adminKb = new InlineKeyboard()
          .url('📲 إرسال إشعار التجديد للعامل عبر واتساب', waUrl)
          .row()
          .text('👤 فتح ملف العامل', 'action:worker_view:' + worker.id);

        try {
          await botApi.sendMessage(
            Number(this.superAdminTelegramId),
            '⚠️ *تنبيه حوكمة: بطاقة رقم قومي لعامل تشارف على الانتهاء*\n' +
            '━━━━━━━━━━━━━━━━━━━━━\n' +
            '• كود العامل: `' + worker.code + '`\n' +
            '• الاسم: *' + worker.name + '* (' + (worker.nickname || 'بدون شهرة') + ')\n' +
            '• الوظيفة: ' + worker.jobTitle + ' | الموقع: ' + (worker.site?.name || 'غير محدد') + '\n' +
            '• تاريخ الانتهاء: *' + expiryFormatted + '*\n' +
            '• المدة المتبقية: *' + daysRemaining + ' يوماً* (أقل من شهر)\n' +
            '• هاتف العامل: `' + cleanPhone + '`\n' +
            '━━━━━━━━━━━━━━━━━━━━━\n' +
            '💡 يمكنك التنبيه على المشرف بالموقع أو إرسال تذكير واتساب فوري للعامل عبر الزر أدناه.',
            { parse_mode: 'Markdown', reply_markup: adminKb }
          );
        } catch (err) {
          console.warn('⚠️ Could not send Super Admin expiry alert for worker ' + worker.code + ':', err);
        }
      }

      // 3. تحديث تاريخ الإشعار لمنع التكرار
      await (this.prisma || (globalThis as any).prisma).worker.update({
        where: { id: worker.id },
        data: { idCardExpiryAlertSentAt: new Date() },
      });

      alertedCount++;
    }

    return { checkedCount: workersNearExpiry.length, alertedCount };
  }
}

export const workerExpiryAlertService = new WorkerExpiryAlertService();
