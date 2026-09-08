import { MyContext } from '../types/context.js';
import {
  getUserActiveScreen,
  setUserActiveScreen,
  clearUserActiveScreen,
  clearAllPendingUserActions,
  getPendingWorkerWizard,
  UserActiveScreenState,
} from '../redis.js';

export class ScreenFlowService {
  /**
   * 📌 تسجيل الشاشة أو التدفق النشط حالياً للمستخدم
   */
  async trackActiveScreen(
    telegramId: bigint,
    chatId: number,
    messageId: number,
    flowType: string,
    isCompleted = false
  ): Promise<void> {
    await setUserActiveScreen(telegramId, {
      chatId,
      messageId,
      flowType,
      isCompleted,
      updatedAt: Date.now(),
    });
  }

  /**
   * 🔍 استرجاع بيانات الشاشة النشطة للمستخدم
   */
  async getActiveScreen(telegramId: bigint): Promise<UserActiveScreenState | null> {
    return getUserActiveScreen(telegramId);
  }

  /**
   * 🧹 محو أي تدفق سابق غير مكتمل فورياً عند الانتقال لوظيفة جديدة
   * يضمن: اختفاء رسائل التدفقات غير المكتملة كلياً وبقاء سندات العمليات المنتهية فقط
   */
  async cleanupUnfinishedFlow(ctx: MyContext, _newFlowType?: string): Promise<void> {
    if (!ctx.from) return;
    const telegramId = BigInt(ctx.from.id);

    // 1. تفريغ كافة الحالات المعلقة في الذاكرة المؤقتة (Wizards, Prompts, Actions)
    await clearAllPendingUserActions(telegramId);

    // 2. فحص الرسالة النشطة السابقة
    const active = await getUserActiveScreen(telegramId);
    if (!active) return;

    if (!active.isCompleted) {
      // تدفق غير مكتمل -> حذف الرسالة تماماً من الشات دون أي أثر
      if (ctx.api) {
        await ctx.api.deleteMessage(active.chatId, active.messageId).catch(async () => {
          // في حال تعذر الحذف (مثلاً مر عليها أكثر من 48 ساعة)، يتم تجريد الأزرار فوراً
          await ctx.api
            .editMessageReplyMarkup(active.chatId, active.messageId, { reply_markup: undefined })
            .catch(() => {});
        });
      }
      await clearUserActiveScreen(telegramId);
    } else {
      // عملية منتهية (Receipt) -> تبقى في الشات دائماً ولكن تُجرد من أزرار التنقل لمنع إعادة الضغط
      if (ctx.api) {
        await ctx.api
          .editMessageReplyMarkup(active.chatId, active.messageId, { reply_markup: undefined })
          .catch(() => {});
      }
      await clearUserActiveScreen(telegramId);
    }
  }

  /**
   * 🗑️ الحذف الصامت الفوري لرسائل المستخدم النصية والمدخلات (Silent Input Deletion)
   */
  async cleanupIncomingUserMessage(ctx: MyContext): Promise<void> {
    if (ctx.chat && ctx.message?.message_id) {
      await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id).catch(() => {});
    }
  }

  /**
   * 🛡️ التحقق الصارم من حداثة وصلاحية الـ Callback Query
   */
  async isStaleCallback(ctx: MyContext): Promise<{ isStale: boolean; reason?: string }> {
    if (!ctx.callbackQuery || !ctx.from) return { isStale: false };

    const clickedMsgId = ctx.callbackQuery.message?.message_id;
    if (!clickedMsgId) return { isStale: false };

    const telegramId = BigInt(ctx.from.id);
    const active = await getUserActiveScreen(telegramId);

    if (active) {
      if (clickedMsgId !== active.messageId) {
        return { isStale: true, reason: 'message_mismatch' };
      }
      return { isStale: false };
    }

    // فحص احتياطي لمعالج العمال إن لم تكن الشاشة مسجلة في الكاش
    const pendingWizard = await getPendingWorkerWizard(telegramId);
    if (pendingWizard?.messageId && pendingWizard.messageId !== clickedMsgId) {
      return { isStale: true, reason: 'wizard_mismatch' };
    }

    return { isStale: false };
  }

  /**
   * ⚠️ إبطال وتجريد لوحة مفاتيح الرسالة القديمة وتنبيه المستخدم
   */
  async handleStaleCallback(ctx: MyContext): Promise<void> {
    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
    await ctx
      .answerCallbackQuery({
        text: '⚠️ هذه الرسالة منتهية الصلاحية، يرجى استخدام القائمة أو الأزرار النشطة الأخيرة.',
        show_alert: true,
      })
      .catch(() => {});
  }
}

export const screenFlowService = new ScreenFlowService();
