import { GrammyError } from 'grammy';
import { UniversalAttachmentPipeline } from '@alsaada/core-components';
import type { SettingsModuleContext } from '../../shared/module.types.js';
import type { CorporateProfileService } from './flow.service.js';
import type { CompanyFieldKey } from './flow.types.js';
import {
  buildCorporateProfileKeyboard,
  buildCompanyEditConfirmationKeyboard,
  buildCancelCompanyEditKeyboard,
} from './flow.keyboard.js';
import {
  formatCorporateProfileCard,
  formatEditFieldPrompt,
  formatEditConfirmationPrompt,
  formatEditSuccessNotice,
  formatImagePreviewMessage,
} from './flow.messages.js';

export class CorporateProfileHandler {
  constructor(private readonly service: CorporateProfileService) {}

  async renderCard(
    ctx: SettingsModuleContext,
    inPlace = false,
    noticeText?: string
  ): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({
          text: '🔒 هذا القسم مخصص حصرياً للمدير العام.',
          show_alert: true,
        }).catch(() => {});
      } else {
        await ctx.reply('🔒 هذا القسم مخصص حصرياً للمدير العام.');
      }
      return;
    }

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => {});
    }

    if (ctx.from) {
      await this.service.clearPendingEdit(BigInt(ctx.from.id));
    }

    const profile = await this.service.getProfile();
    const keyboard = buildCorporateProfileKeyboard(ctx.isImpersonating);
    const richMessage = formatCorporateProfileCard(profile, noticeText);


    if (inPlace && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(richMessage, { reply_markup: keyboard });
        return;
      } catch (error) {
        if (!(error instanceof GrammyError) || error.error_code !== 400) throw error;
        if (error.description.includes('message is not modified')) return;
        // Only a missing/uneditable message warrants creating a new card.
        if (!error.description.includes('message to edit not found') &&
            !error.description.includes("message can't be edited")) throw error;
      }
    }

    await ctx.replyWithRichMessage(richMessage, { reply_markup: keyboard });
  }


  async handleImagePreview(ctx: SettingsModuleContext, kind: 'logo' | 'header' | 'footer'): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    const profile = await this.service.getProfile();
    const fileId = kind === 'logo' ? profile?.logoFileId : kind === 'header' ? profile?.headerImageFileId : profile?.footerImageFileId;
    if (!fileId) { await ctx.reply('ℹ️ لا توجد صورة معتمدة حالياً. اختر «رفع الصورة» من جدول البيانات.'); return; }
    await ctx.replyWithRichMessage(formatImagePreviewMessage(fileId, kind));
  }

  async handleLogoPreview(ctx: SettingsModuleContext): Promise<void> { await this.handleImagePreview(ctx, 'logo'); }

  async handleStartEdit(ctx: SettingsModuleContext, fieldKey: CompanyFieldKey): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    if (!ctx.from || !ctx.callbackQuery) return;

    await ctx.answerCallbackQuery().catch(() => {});

    const profile = await this.service.getProfile();
    const currentValue = profile ? (profile[fieldKey] || 'غير محدد') : 'غير محدد';
    const messageId = ctx.callbackQuery.message?.message_id;
    if (!messageId) return;

    await this.service.setPendingEdit(BigInt(ctx.from.id), fieldKey, messageId);

    const keyboard = buildCancelCompanyEditKeyboard();
    const text = formatEditFieldPrompt(fieldKey, currentValue);

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch {
      await ctx.reply(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  }


  async handleConfirmEdit(ctx: SettingsModuleContext, fieldKey: CompanyFieldKey): Promise<void> {
    if (!ctx.isRealSuperAdmin && ctx.effectiveRole !== 'SUPER_ADMIN') return;
    if (!ctx.callbackQuery) return;
    await ctx.answerCallbackQuery().catch(() => {});
    await ctx.editMessageText(formatEditConfirmationPrompt(fieldKey), {
      reply_markup: buildCompanyEditConfirmationKeyboard(fieldKey),
    });
  }

  async handleTextInput(ctx: SettingsModuleContext): Promise<boolean> {
    if (!ctx.from || !ctx.message?.text) return false;
    const telegramId = BigInt(ctx.from.id);

    const pending = await this.service.getPendingEdit(telegramId);
    if (!pending) return false;

    const newValue = ctx.message.text.trim();
    const result = await this.service.updateField(pending.fieldKey, newValue);

    // Delete user input message to keep chat clean
    await ctx.deleteMessage().catch(() => {});
    await this.service.clearPendingEdit(telegramId);

    if (!result.success) {
      await ctx.reply(`❌ ${result.error || 'حدث خطأ أثناء التحديث.'}`);
      return true;
    }

    const notice = formatEditSuccessNotice(pending.fieldKey, newValue);
    await this.renderCard(ctx, false, notice);
    return true;
  }

  async handlePhotoInput(ctx: SettingsModuleContext, fileId: string): Promise<boolean> {
    if (!ctx.from || !ctx.message?.photo) return false;
    const pending = await this.service.getPendingEdit(BigInt(ctx.from.id));
    const imageFields = ['logoPath', 'headerImagePath', 'footerImagePath'];
    if (!pending || !imageFields.includes(pending.fieldKey)) return false;

    try {
      const file = await ctx.api.getFile(fileId);
      if (!file.file_path) throw new Error('Telegram file path missing');
      const response = await fetch(`https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`);
      if (!response.ok) throw new Error(`Telegram download failed: ${response.status}`);
      const saved = UniversalAttachmentPipeline.saveAttachment({
        domain: 'COMPANY_LOGO',
        referenceCode: 'COMPANY',
        fileName: 'logo.jpg',
        fileBuffer: Buffer.from(await response.arrayBuffer()),
        mimeType: 'image/jpeg',
        maxSizeMegabytes: 5,
      });
      if (!saved.success) throw new Error(saved.errorArabic || saved.error || 'Logo save failed');
      await this.service.updateImage(pending.fieldKey as 'logoPath' | 'headerImagePath' | 'footerImagePath', saved.relativePath, fileId);
      await this.service.clearPendingEdit(BigInt(ctx.from.id));
      await ctx.deleteMessage().catch(() => {});
      await ctx.replyWithRichMessage(formatImagePreviewMessage(fileId, pending.fieldKey === 'logoPath' ? 'logo' : pending.fieldKey === 'headerImagePath' ? 'header' : 'footer'));
      await this.renderCard(ctx, false, 'تم تحديث صورة هوية المستند بنجاح');
    } catch {
      await ctx.reply('❌ تعذر حفظ اللوجو. أرسل صورة بصيغة مدعومة وحجم لا يتجاوز 5 ميجابايت.');
    }
    return true;
  }}
