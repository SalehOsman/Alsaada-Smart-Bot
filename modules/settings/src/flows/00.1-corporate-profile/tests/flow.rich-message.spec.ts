import { Api, GrammyError } from 'grammy';
import { describe, expect, it, vi } from 'vitest';
import { formatCorporateProfileCard, formatLogoPreviewMessage } from '../flow.messages.js';
import { CorporateProfileHandler } from '../flow.handler.js';
import type { CorporateProfileService } from '../flow.service.js';
import type { SettingsModuleContext } from '../../../shared/module.types.js';
import type { CompanyProfileDto } from '../flow.types.js';

describe('Corporate profile native rich table', () => {
  it('renders the complete company identity fields, headers, compact striped borders and RTL', () => {
    const card = formatCorporateProfileCard(null);
    expect(card.is_rtl).toBe(true);
    const table = card.blocks?.find((block) => block.type === 'table');
    expect(table).toMatchObject({ type: 'table', is_bordered: true, is_striped: true, is_compact: true });
    if (table?.type !== 'table') throw new Error('Missing table');
    expect(table.cells).toHaveLength(25);
    expect(table.cells[0]?.[0]?.text).toMatchObject({ type: 'bold' });
    expect(table.cells[0]?.[1]?.text).toMatchObject({ type: 'bold' });
    expect(table.cells.slice(1).map((row) => row[0]?.text)).toContain('\u200Fلا توجد صورة معتمدة');
  });
  it('renders logo preview as a native rich photo with inline edit action', () => {
    const message = formatLogoPreviewMessage('telegram-file-id');
    const photo = message.blocks?.find((block) => block.type === 'photo') as { photo?: { media?: string } } | undefined;
    const buttons = message.blocks?.find((block) => block.type === 'buttons') as { buttons?: Array<{ callback_data?: string }> } | undefined;
    expect(photo?.photo?.media).toBe('telegram-file-id');
    expect(buttons?.buttons?.map((button) => button.callback_data)).toEqual(['action:company_image_edit:logoPath', 'action:settings:company_profile']);
  });

  it('keeps markup-like company data literal inside cells and notice', () => {
    const legalName = '<b>شركة & شركاء</b> | `اسم`';
    const profile = { legalName } as CompanyProfileDto;
    const card = formatCorporateProfileCard(profile, legalName);
    const table = card.blocks?.find((block) => block.type === 'table');
    if (table?.type !== 'table') throw new Error('Missing table');
    expect(table.cells[1]?.[0]?.text).toBe('\u200F' + legalName);
    expect(table.cells[1]?.[0]?.text).toBe('\u200F' + legalName);
    expect(card.blocks).toContainEqual({ type: 'paragraph', text: { type: 'bold', text: `✨ ${legalName}` } });
    expect(card.html).toBeUndefined();
    expect(card.markdown).toBeUndefined();
  });
  function setup() {
    const service = { clearPendingEdit: vi.fn(), getProfile: vi.fn().mockResolvedValue(null) };
    const ctx = { isRealSuperAdmin: true, from: { id: 123 }, callbackQuery: { data: 'profile' },
      answerCallbackQuery: vi.fn().mockResolvedValue(true), editMessageText: vi.fn().mockResolvedValue(true),
      replyWithRichMessage: vi.fn().mockResolvedValue({}), reply: vi.fn() };
    return { service, ctx, handler: new CorporateProfileHandler(service as unknown as CorporateProfileService) };
  }
  it('asks for confirmation before entering the edit prompt', async () => {
    const { ctx, handler } = setup();
    await handler.handleConfirmEdit(ctx as unknown as SettingsModuleContext, 'legalName');
    expect(ctx.editMessageText).toHaveBeenCalledWith(expect.stringContaining('هل تريد تعديل'), expect.objectContaining({ reply_markup: expect.objectContaining({}) }));
  });
  it('edits the current message with rich content and existing callback buttons', async () => {
    const { ctx, handler } = setup();
    await handler.renderCard(ctx as unknown as SettingsModuleContext, true);
    expect(ctx.editMessageText).toHaveBeenCalledWith(expect.objectContaining({ is_rtl: true, blocks: expect.arrayContaining([]) }), expect.objectContaining({ reply_markup: expect.objectContaining({}) }));
    expect(ctx.replyWithRichMessage).not.toHaveBeenCalled();
  });
  it('sends rich content when a new card is needed', async () => {
    const { ctx, handler } = setup();
    await handler.renderCard(ctx as unknown as SettingsModuleContext);
    expect(ctx.replyWithRichMessage).toHaveBeenCalledWith(expect.objectContaining({ is_rtl: true }), expect.objectContaining({ reply_markup: expect.objectContaining({}) }));
    expect(ctx.reply).not.toHaveBeenCalled();
  });
  it('does not duplicate an unchanged card', async () => {
    const { ctx, handler } = setup();
    ctx.editMessageText.mockRejectedValue(new GrammyError('editMessageText', {
      ok: false, error_code: 400, description: 'Bad Request: message is not modified',
    }, 'editMessageText', {}));
    await handler.renderCard(ctx as unknown as SettingsModuleContext, true);
    expect(ctx.replyWithRichMessage).not.toHaveBeenCalled();
  });
  it('recreates only a missing card and propagates transport failures', async () => {
    const { ctx, handler } = setup();
    ctx.editMessageText.mockRejectedValueOnce(new GrammyError('editMessageText', {
      ok: false, error_code: 400, description: 'Bad Request: message to edit not found',
    }, 'editMessageText', {}));
    await handler.renderCard(ctx as unknown as SettingsModuleContext, true);
    expect(ctx.replyWithRichMessage).toHaveBeenCalledTimes(1);
    const failure = new Error('network unavailable');
    ctx.editMessageText.mockRejectedValueOnce(failure);
    await expect(handler.renderCard(ctx as unknown as SettingsModuleContext, true)).rejects.toBe(failure);
    expect(ctx.replyWithRichMessage).toHaveBeenCalledTimes(1);
  });
  it('serializes the official rich_message parameter for send and edit without parse_mode', async () => {
    const api = new Api('test-token');
    const requests: Array<{ method: string; payload: unknown }> = [];
    api.config.use(async (_previous, method, payload) => {
      requests.push({ method, payload });
      return { ok: true, result: true } as never;
    });
    const card = formatCorporateProfileCard(null);
    await api.sendRichMessage(123, card);
    await api.editMessageText(123, 456, card);
    expect(requests).toEqual([
      { method: 'sendRichMessage', payload: { chat_id: 123, rich_message: card } },
      { method: 'editMessageText', payload: { chat_id: 123, message_id: 456, rich_message: card } },
    ]);
  });

});
