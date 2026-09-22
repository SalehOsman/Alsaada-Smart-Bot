import type {
  InputRichBlock,
  InputRichBlockTable,
  InputRichMessage,
  RichMessageButton,
  RichText,
  RichTextButton,
  InputMediaAnimation,
  InputMediaAudio,
  InputMediaDocument,
  InputMediaPhoto,
  InputMediaVideo,
  InputMediaVoiceNote,
  Location,
  User,
  WebAppInfo,
  LoginUrl,
  SwitchInlineQueryChosenChat,
  CopyTextButton,
  DisabledButton,
} from 'grammy/types';

export interface RichPageOptions { title: string; blocks?: InputRichBlock[]; rtl?: boolean; }
export interface RichTableOptions { headers: RichText[]; rows: RichText[][]; rtl?: boolean; bordered?: boolean; striped?: boolean; compact?: boolean; caption?: RichText; }
export interface RichConfirmationOptions { question: RichText; confirmCallback: string; cancelCallback: string; confirmLabel?: string; cancelLabel?: string; }

const entity = <T extends RichText>(value: T): T => value;
export const richBold = (text: RichText): RichText => entity({ type: 'bold', text });
export const richItalic = (text: RichText): RichText => entity({ type: 'italic', text });
export const richUnderline = (text: RichText): RichText => entity({ type: 'underline', text });
export const richStrike = (text: RichText): RichText => entity({ type: 'strikethrough', text });
export const richSpoiler = (text: RichText): RichText => entity({ type: 'spoiler', text });
export const richDateTime = (text: RichText, unix_time: number, date_time_format: 'r' | `${'w' | ''}${'d' | 'D' | ''}${'t' | 'T' | ''}`): RichText => entity({ type: 'date_time', text, unix_time, date_time_format });
export const richTextMention = (text: RichText, user: User): RichText => entity({ type: 'text_mention', text, user });
export const richSubscript = (text: RichText): RichText => entity({ type: 'subscript', text });
export const richSuperscript = (text: RichText): RichText => entity({ type: 'superscript', text });
export const richMarked = (text: RichText): RichText => entity({ type: 'marked', text });
export const richCode = (text: RichText): RichText => entity({ type: 'code', text });
export const richCustomEmoji = (custom_emoji_id: string, alternative_text: string): RichText => entity({ type: 'custom_emoji', custom_emoji_id, alternative_text });
export const richMath = (expression: string): RichText => entity({ type: 'mathematical_expression', expression });
export const richUrl = (text: RichText, url: string): RichText => entity({ type: 'url', text, url });
export const richEmail = (text: RichText, email: string): RichText => entity({ type: 'email_address', text, email_address: email });
export const richPhone = (text: RichText, phone_number: string): RichText => entity({ type: 'phone_number', text, phone_number });
export const richBankCard = (text: RichText, card_number: string): RichText => entity({ type: 'bank_card_number', text, bank_card_number: card_number });
export const richMention = (text: RichText, user_name: string): RichText => entity({ type: 'mention', text, username: user_name });
export const richHashtag = (text: RichText, hashtag: string): RichText => entity({ type: 'hashtag', text, hashtag });
export const richCashtag = (text: RichText, cashtag: string): RichText => entity({ type: 'cashtag', text, cashtag });
export const richBotCommand = (text: RichText, bot_command: string): RichText => entity({ type: 'bot_command', text, bot_command });
export const richAnchor = (name: string): RichText => entity({ type: 'anchor', name });
export const richAnchorLink = (text: RichText, anchor_name: string): RichText => entity({ type: 'anchor_link', text, anchor_name });
export const richReference = (text: RichText, name: string): RichText => entity({ type: 'reference', text, name });
export const richReferenceLink = (text: RichText, reference_name: string): RichText => entity({ type: 'reference_link', text, reference_name });

export const richParagraph = (text: RichText): InputRichBlock => ({ type: 'paragraph', text });
export const richHeading = (text: RichText, size: 1 | 2 | 3 | 4 | 5 | 6 = 3): InputRichBlock => ({ type: 'heading', text, size });
export const richPre = (text: RichText, language?: string): InputRichBlock => ({ type: 'pre', text, ...(language ? { language } : {}) });
export const richFooter = (text: RichText): InputRichBlock => ({ type: 'footer', text });
export const richDivider = (): InputRichBlock => ({ type: 'divider' });
export const richMathBlock = (expression: string): InputRichBlock => ({ type: 'mathematical_expression', expression });
export const richAnchorBlock = (name: string): InputRichBlock => ({ type: 'anchor', name });
export const richList = (items: Array<{ blocks: InputRichBlock[]; has_checkbox?: true; is_checked?: true; value?: number; type?: 'a' | 'A' | 'i' | 'I' | '1' }>): InputRichBlock => ({ type: 'list', items });
export const richBlockQuote = (blocks: InputRichBlock[], credit?: RichText): InputRichBlock => ({ type: 'blockquote', blocks, ...(credit ? { credit } : {}) });
export const richExpandableQuote = (text: RichText, credit?: RichText): InputRichBlock => ({ type: 'expandable_blockquote', text, ...(credit ? { credit } : {}) });
export const richPullQuote = (text: RichText, credit?: RichText): InputRichBlock => ({ type: 'pullquote', text, ...(credit ? { credit } : {}) });
export const richCollage = (blocks: InputRichBlock[], caption?: { text: RichText; credit?: RichText }): InputRichBlock => ({ type: 'collage', blocks, ...(caption ? { caption } : {}) });
export const richSlideshow = (blocks: InputRichBlock[], caption?: { text: RichText; credit?: RichText }): InputRichBlock => ({ type: 'slideshow', blocks, ...(caption ? { caption } : {}) });
export const richDetails = (summary: RichText, blocks: InputRichBlock[], open = false): InputRichBlock => ({ type: 'details', summary, blocks, ...(open ? { is_open: true as const } : {}) });
export const richMap = (location: Location, zoom: number, width: number, height: number, caption?: { text: RichText; credit?: RichText }): InputRichBlock => ({ type: 'map', location, zoom, width, height, ...(caption ? { caption } : {}) });
export const richAnimation = (animation: InputMediaAnimation, caption?: { text: RichText; credit?: RichText }): InputRichBlock => ({ type: 'animation', animation, ...(caption ? { caption } : {}) });
export const richAudio = (audio: InputMediaAudio, caption?: { text: RichText; credit?: RichText }): InputRichBlock => ({ type: 'audio', audio, ...(caption ? { caption } : {}) });
export const richDocument = (document: InputMediaDocument, caption?: { text: RichText; credit?: RichText }): InputRichBlock => ({ type: 'document', document, ...(caption ? { caption } : {}) });
export const richPhoto = (photo: InputMediaPhoto, caption?: { text: RichText; credit?: RichText }): InputRichBlock => ({ type: 'photo', photo, ...(caption ? { caption } : {}) });
export const richVideo = (video: InputMediaVideo, caption?: { text: RichText; credit?: RichText }): InputRichBlock => ({ type: 'video', video, ...(caption ? { caption } : {}) });
export const richVoiceNote = (voice_note: InputMediaVoiceNote, caption?: { text: RichText; credit?: RichText }): InputRichBlock => ({ type: 'voice_note', voice_note, ...(caption ? { caption } : {}) });
export const richThinking = (text: RichText): InputRichBlock => ({ type: 'thinking', text });

export const richCallbackButton = (text: RichText, callback_data: string, style: 'danger' | 'success' | 'primary' | 'link' = 'primary'): RichMessageButton => ({ text, callback_data, style });
export const richUrlButton = (text: RichText, url: string, style?: 'danger' | 'success' | 'primary' | 'link'): RichMessageButton => ({ text, url, ...(style ? { style } : {}) });
export const richWebAppButton = (text: RichText, web_app: WebAppInfo, style?: 'danger' | 'success' | 'primary' | 'link'): RichMessageButton => ({ text, web_app, ...(style ? { style } : {}) });
export const richLoginUrlButton = (text: RichText, login_url: Omit<LoginUrl, 'bot_username'>, style?: 'danger' | 'success' | 'primary' | 'link'): RichMessageButton => ({ text, login_url, ...(style ? { style } : {}) });
export const richSwitchInlineButton = (text: RichText, switch_inline_query: string, style?: 'danger' | 'success' | 'primary' | 'link'): RichMessageButton => ({ text, switch_inline_query, ...(style ? { style } : {}) });
export const richSwitchInlineCurrentChatButton = (text: RichText, switch_inline_query_current_chat: string, style?: 'danger' | 'success' | 'primary' | 'link'): RichMessageButton => ({ text, switch_inline_query_current_chat, ...(style ? { style } : {}) });
export const richSwitchInlineChosenChatButton = (text: RichText, switch_inline_query_chosen_chat: SwitchInlineQueryChosenChat, style?: 'danger' | 'success' | 'primary' | 'link'): RichMessageButton => ({ text, switch_inline_query_chosen_chat, ...(style ? { style } : {}) });
export const richCopyTextButton = (text: RichText, copy_text: CopyTextButton, style?: 'danger' | 'success' | 'primary' | 'link'): RichMessageButton => ({ text, copy_text, ...(style ? { style } : {}) });
export const richDisabledButton = (text: RichText, disabled: DisabledButton, style?: 'danger' | 'success' | 'primary' | 'link'): RichMessageButton => ({ text, disabled, ...(style ? { style } : {}) });
export const richInlineButton = (button: RichMessageButton): RichText => ({ type: 'button', button } as RichTextButton);
export const richButtons = (buttons: RichMessageButton[], align: 'left' | 'center' | 'right' = 'center'): InputRichBlock => ({ type: 'buttons', buttons, align });

export function buildRichPage(options: RichPageOptions): InputRichMessage {
  return { is_rtl: options.rtl ?? true, blocks: [richHeading(options.title), ...(options.blocks ?? [])] };
}

export function buildRichTable(options: RichTableOptions): InputRichBlockTable {
  return {
    type: 'table',
    cells: [
      options.headers.map((text) => ({ text, is_header: true as const, align: 'center' as const, valign: 'middle' as const })),
      ...options.rows.map((row) => row.map((text) => ({ text, align: 'right' as const, valign: 'top' as const }))),
    ],
    is_bordered: (options.bordered ?? true) as true,
    is_striped: (options.striped ?? true) as true,
    is_compact: (options.compact ?? true) as true,
    ...(options.caption ? { caption: options.caption } : {}),
  };
}

export function buildRichConfirmation(options: RichConfirmationOptions): InputRichMessage {
  return { is_rtl: true, blocks: [richParagraph(options.question), richButtons([
    richCallbackButton(options.confirmLabel ?? '✅ نعم', options.confirmCallback, 'primary'),
    richCallbackButton(options.cancelLabel ?? '❌ إلغاء', options.cancelCallback, 'link'),
  ])] };
}

function countBlocks(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  const record = value as Record<string, unknown>;
  let count = record.type ? 1 : 0;
  for (const key of ['blocks', 'items', 'cells']) {
    const child = record[key];
    if (Array.isArray(child)) count += child.reduce((sum, item) => sum + countBlocks(item), 0);
  }
  return count;
}

function countMedia(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  const record = value as Record<string, unknown>;
  let count = ['photo', 'video', 'audio', 'document', 'animation', 'voice_note'].some((key) => key in record) ? 1 : 0;
  for (const child of Object.values(record)) count += countMedia(child);
  return count;
}

export function validateRichMessageLimits(message: InputRichMessage): string[] {
  const payload = JSON.stringify(message);
  const violations: string[] = [];
  const bytes = new TextEncoder().encode(payload).length;
  if (bytes > 32768) violations.push('Rich message exceeds the 32768 UTF-8 character limit');
  const blocks = countBlocks(message.blocks);
  if (blocks > 500) violations.push('Rich message exceeds the 500 block limit');
  if (countMedia(message.blocks) > 50) violations.push('Rich message exceeds the 50 media attachment limit');
  const tables = payload.match(/"type":"table"/g)?.length ?? 0;
  if (tables > 0 && Array.isArray(message.blocks)) {
    const maxColumns = Math.max(0, ...message.blocks.filter((b) => b.type === 'table').map((b) => (b as InputRichBlockTable).cells[0]?.length ?? 0));
    if (maxColumns > 20) violations.push('A rich table exceeds the 20 column limit');
  }
  if (violations.length) throw new Error(violations.join('; '));
  return violations;
}

export function assertRichMessage(message: InputRichMessage): void {
  const modes = [message.blocks !== undefined, message.markdown !== undefined, message.html !== undefined].filter(Boolean).length;
  if (modes !== 1) throw new Error('A rich message must define exactly one of blocks, markdown, or html');
  validateRichMessageLimits(message);
}
