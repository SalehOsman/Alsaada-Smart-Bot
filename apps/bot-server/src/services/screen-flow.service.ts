import { MyContext } from '../types/context.js';
import {
  getUserActiveScreen,
  setUserActiveScreen,
  clearUserActiveScreen,
  clearAllPendingUserActions,
  getPendingWorkerWizard,
  getPersistentKeyboardMsg,
  setPersistentKeyboardMsg,
  UserActiveScreenState,
} from '../redis.js';
import { buildPersistentReplyKeyboard } from '../keyboards/reply-bar.keyboard.js';
import { systemDataService } from './system-data.service.js';

export class ScreenFlowService {
  /**
   * 📌 ضمان وجود وتثبيت كيبورد الأزرار السفلي الدائم دون حذفه أو اختفائه
   */
  async ensurePersistentKeyboard(ctx: MyContext, customText?: string, forceRefresh = false): Promise<void> {
    if (!ctx.from || !ctx.chat) return;
    const telegramId = BigInt(ctx.from.id);
    const existing = await getPersistentKeyboardMsg(telegramId);

    // إذا كانت هناك رسالة كيبورد مثبتة سابقة، نحافظ عليها حتى لا يختفي الكيبورد من واجهة تليجرام
    if (existing && !forceRefresh) {
      return;
    }

    // إذا طُلب التحديث الصريح، نقوم بتنظيف الرسالة القديمة برفق
    if (existing && ctx.api) {
      await ctx.api.deleteMessage(existing.chatId, existing.messageId).catch(() => {});
    }

    const replyKeyboard = buildPersistentReplyKeyboard(ctx);
    const companyName = await systemDataService.getCompanyTradeName();
    const text =
      customText ||
      `🏢 *${companyName}*\n` +
      `لوحة أزرار التنقل والتحكم الميداني مفعلة ومتاحة بالأسفل دائماً ⬇️`;

    try {
      const sent = await ctx.api.sendMessage(ctx.chat.id, text, {
        parse_mode: 'Markdown',
        reply_markup: replyKeyboard,
      });
      await setPersistentKeyboardMsg(telegramId, ctx.chat.id, sent.message_id);
    } catch {
      // Fallback
    }
  }

  /**
   * 🛑 إزالة لوحة الأزرار السفلية فوراً وتطهير الكاش في تطبيق تليجرام لمنع تسريب الأزرار الإدارية
   */
  async removePersistentKeyboard(ctx: MyContext, customText?: string): Promise<void> {
    if (!ctx.from || !ctx.chat || !ctx.api) return;
    const telegramId = BigInt(ctx.from.id);
    const existing = await getPersistentKeyboardMsg(telegramId);
    if (existing) {
      await ctx.api.deleteMessage(existing.chatId, existing.messageId).catch(() => {});
      await clearUserActiveScreen(telegramId).catch(() => {});
    }
    const text = customText || '🔄 تم تحديث واجهة التنقل وتطهير الصلاحيات السابقة.';
    try {
      const msg = await ctx.api.sendMessage(ctx.chat.id, text, {
        reply_markup: { remove_keyboard: true },
      });
      await ctx.api.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
    } catch {
      // Fallback
    }
  }

  /**
   * 🧹 حذف رسالة القائمة الرئيسية فوراً عند النقر على أي قسم منها
   */
  async cleanupMainMenuIfActive(ctx: MyContext): Promise<boolean> {
    if (!ctx.from) return false;
    const telegramId = BigInt(ctx.from.id);
    const active = await getUserActiveScreen(telegramId);
    if (active && active.flowType === 'main_menu') {
      const clickedMsgId = ctx.callbackQuery?.message?.message_id;
      if (!clickedMsgId || clickedMsgId === active.messageId) {
        if (ctx.api) {
          await ctx.api.deleteMessage(active.chatId, active.messageId).catch(() => {});
        } else if (ctx.callbackQuery?.message?.chat) {
          await ctx.deleteMessage().catch(() => {});
        }
        await clearUserActiveScreen(telegramId);
        (ctx as any).fromMainMenu = true;
        return true;
      }
    }
    return false;
  }

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
   * 🔍 فحص ما إذا كانت النقرة صادرة عن كارت إتمام عملية مكتملة (Completed Operation Card)
   */
  async isClickOnCompletedScreen(ctx: MyContext): Promise<boolean> {
    if (!ctx.callbackQuery || !ctx.from) return false;
    const clickedMsgId = ctx.callbackQuery.message?.message_id;
    if (!clickedMsgId) return false;
    const telegramId = BigInt(ctx.from.id);
    const active = await getUserActiveScreen(telegramId);
    return Boolean(active && active.isCompleted && active.messageId === clickedMsgId);
  }

  /**
   * 🔀 تحديد ما إذا كان يجب تصيير الشاشة التالية موضعياً (in-place) أو كرسالة جديدة
   * إذا كانت النقرة صادرة عن كارت إتمام عملية مكتملة، يتم حظر التعديل الموضعي فوراً
   * لتبقى بطاقة الإتمام وسند العملية في الشات دائماً دون حذف أو استبدال، وتفتح القائمة التالية كرسالة جديدة.
   */
  async shouldRenderInPlace(ctx: MyContext, requestedInPlace = true): Promise<boolean> {
    if (!requestedInPlace) return false;
    if (!ctx.callbackQuery) return false;
    const fromCompleted = await this.isClickOnCompletedScreen(ctx);
    if (fromCompleted) {
      return false; // كارت العملية المكتملة يبقى في الشات دائماً
    }
    return true;
  }

  /**
   * 🧹 محو أي تدفق سابق غير مكتمل فورياً عند الانتقال لوظيفة جديدة
   * يضمن: اختفاء رسائل التدفقات غير المكتملة كلياً وبقاء سندات العمليات المنتهية فقط دائماً في الشات
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
            .editMessageReplyMarkup(active.chatId, active.messageId, { reply_markup: { inline_keyboard: [] } })
            .catch(() => {});
        });
      }
      await clearUserActiveScreen(telegramId);
    } else {
      // ✅ عملية منتهية (Completed Transaction / Receipt):
      // تظل في الشات دائماً وأبداً بدون حذف وبدون أي تعديل على نصها!
      // تجرد فقط من لوحة الأزرار لمنع إعادة الضغط المكرر
      if (ctx.api) {
        await ctx.api
          .editMessageReplyMarkup(active.chatId, active.messageId, { reply_markup: { inline_keyboard: [] } })
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

    const data = ctx.callbackQuery.data || '';
    // Sovereign navigation immunity: Impersonation escape hatch is never stale
    if (data === 'action:exit_impersonate') {
      return { isStale: false };
    }

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
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }).catch(() => {});
    await ctx
      .answerCallbackQuery({
        text: '⚠️ هذه الرسالة منتهية الصلاحية، يرجى استخدام القائمة أو الأزرار النشطة الأخيرة.',
        show_alert: true,
      })
      .catch(() => {});
  }
}

export const screenFlowService = new ScreenFlowService();
