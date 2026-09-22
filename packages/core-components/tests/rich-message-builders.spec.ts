import { describe, expect, it } from 'vitest';
import {
  buildRichPage,
  buildRichTable,
  buildRichConfirmation,
  assertRichMessage,
  richBold,
  richDateTime,
  richUrl,
  richList,
  richDetails,
  richCallbackButton,
  richButtons,
  richPhoto,
  validateRichMessageLimits,
} from '../src/rich-message/index.js';

describe('shared Rich Message builders', () => {
  it('builds an RTL page from reusable blocks', () => {
    const message = buildRichPage({
      title: 'بيانات الشركة',
      blocks: [{ type: 'paragraph', text: 'محتوى الصفحة' }],
    });
    expect(message).toMatchObject({ is_rtl: true });
    expect(message.blocks?.[0]).toMatchObject({ type: 'heading', size: 3 });
  });

  it('builds a centered RTL table with headers first in the payload contract', () => {
    const table = buildRichTable({
      headers: ['القيمة', 'البيان'],
      rows: [['EGP', 'العملة']],
    });
    expect(table).toMatchObject({ type: 'table', is_bordered: true, is_striped: true, is_compact: true });
    expect(table.cells[0]?.[0]).toMatchObject({ is_header: true, align: 'center' });
    expect(table.cells[0]?.[1]).toMatchObject({ is_header: true, align: 'center' });
  });

  it('builds confirmation buttons as a rich message block', () => {
    const message = buildRichConfirmation({
      question: 'هل تريد الحفظ؟',
      confirmCallback: 'action:confirm',
      cancelCallback: 'action:cancel',
    });
    const buttons = message.blocks?.find((block) => block.type === 'buttons');
    expect(buttons).toMatchObject({ type: 'buttons' });
    expect((buttons as { buttons?: Array<{ callback_data?: string }> }).buttons?.map((b) => b.callback_data))
      .toEqual(['action:confirm', 'action:cancel']);
  });

  it('rejects a message that is not explicitly rich', () => {
    expect(() => assertRichMessage({ blocks: [] })).not.toThrow();
    expect(() => assertRichMessage({ markdown: '**text**' })).not.toThrow();
    expect(() => assertRichMessage({})).toThrow(/rich message/i);
  });

  it('covers the official inline rich-text entities', () => {
    expect(richBold('نص')).toEqual({ type: 'bold', text: 'نص' });
    expect(richDateTime('الآن', 1, 'wDT')).toMatchObject({ type: 'date_time', unix_time: 1 });
    expect(richUrl('توثيق', 'https://core.telegram.org/bots/api')).toMatchObject({ type: 'url' });
  });

  it('covers nested blocks, details and callback buttons', () => {
    const list = richList([{ blocks: [{ type: 'paragraph', text: 'عنصر' }], has_checkbox: true }]);
    const details = richDetails('التفاصيل', [list], true);
    const buttons = richButtons([richCallbackButton('تعديل', 'edit')]);
    expect(list.type).toBe('list');
    expect(details).toMatchObject({ type: 'details', is_open: true });
    expect(buttons).toMatchObject({ type: 'buttons' });
  });

  it('covers media blocks and official limits', () => {
    expect(richPhoto({ type: 'photo', media: 'photo-id' })).toMatchObject({ type: 'photo' });
    expect(validateRichMessageLimits({ blocks: [{ type: 'heading', size: 3, text: 'ok' }] })).toEqual([]);
    expect(() => validateRichMessageLimits({ markdown: 'x'.repeat(32769) })).toThrow(/32768/);
  });
});
