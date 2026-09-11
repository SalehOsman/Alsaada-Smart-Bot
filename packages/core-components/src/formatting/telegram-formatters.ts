import {
  CopyTextButton,
  TelegramChatAction,
  LinkPreviewOptions,
  ModalAlertOptions,
} from '../types.js';

/**
 * Formats an enterprise UX navigation breadcrumb header.
 * Example: formatBreadcrumbs(['⚙️ الإعدادات', '🏢 الكيان المؤسسي', '🏗️ مصفوفة المشاريع'])
 * Returns: "📍 *المسار:* ⚙️ الإعدادات ❯ 🏢 الكيان المؤسسي ❯ 🏗️ مصفوفة المشاريع\n\n"
 */
export function formatBreadcrumbs(segments: string[]): string {
  if (!segments || segments.length === 0) return '';
  const clean = segments
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s.length > 0);
  if (clean.length === 0) return '';
  return `📍 *المسار:* ${clean.join(' ❯ ')}\n\n`;
}

/**
 * Wraps text in Telegram spoiler tag.
 * Renders as shimmering pixelated/blurred text that is smoothly revealed upon a single user tap.
 * Supports HTML (<tg-spoiler>) by default, or Markdown (||text||).
 */
export function formatSpoiler(text: string, mode: 'html' | 'markdown' = 'html'): string {
  if (!text || text.trim() === '') return '';
  return mode === 'markdown' ? `||${text}||` : `<tg-spoiler>${text}</tg-spoiler>`;
}

/**
 * Wraps text in Telegram expandable blockquote.
 * Collapses long text to 2 lines with a native interactive expand/collapse toggle.
 * Supports HTML (<blockquote expandable>) by default, or Markdown (**>...).
 */
export function formatExpandableQuote(text: string, mode: 'html' | 'markdown' = 'html'): string {
  if (!text || text.trim() === '') return '';
  if (mode === 'markdown') {
    const lines = text.split('\n').map((line) => `>${line}`).join('\n');
    return `**${lines}**`;
  }
  return `<blockquote expandable>${text}</blockquote>`;
}

/**
 * Wraps text in Telegram monospace code tag (<code>).
 * Enables native 1-tap direct copy on mobile devices.
 */
export function formatMonospace(text: string): string {
  if (!text || text.trim() === '') return '';
  return `<code>${text}</code>`;
}

/**
 * Formats codes, IDs, and tokens for 1-tap direct copy on mobile devices.
 * Semantic alias to formatMonospace that supports strings, numbers, and BigInts.
 */
export function formatClickToCopy(code: string | number | bigint): string {
  if (code === undefined || code === null) return '';
  const str = String(code).trim();
  if (str === '') return '';
  return `<code>${str}</code>`;
}

/**
 * Constructs a native Telegram CopyTextButton for InlineKeyboards (Bot API 7.10+).
 * Copies target text directly to the device clipboard with Telegram's native toast confirmation.
 */
export function buildCopyTextButton(text: string, textToCopy: string): CopyTextButton {
  return {
    text,
    copy_text: {
      text: textToCopy,
    },
  };
}

/**
 * Builds input field placeholder configuration for ForceReply or ReplyKeyboardMarkup.
 */
export function buildInputFieldPlaceholder(placeholder: string): { input_field_placeholder: string } {
  return {
    input_field_placeholder: placeholder,
  };
}

/**
 * Standard pre-built link preview options suppressing link previews.
 * Prevents huge preview cards from obscuring inline keyboards.
 */
export const DISABLED_LINK_PREVIEWS: Readonly<LinkPreviewOptions> = Object.freeze({
  is_disabled: true,
});

/**
 * Builds standard LinkPreviewOptions (Bot API 7.0+).
 */
export function buildLinkPreviewOptions(disabled = true): LinkPreviewOptions {
  return {
    is_disabled: disabled,
  };
}

/**
 * Builds standard ModalAlertOptions for Telegram answerCallbackQuery with show_alert: true.
 */
export function buildModalAlertOptions(text: string): ModalAlertOptions {
  return {
    text,
    show_alert: true,
  };
}

/**
 * Sends a native modal alert dialog to the Telegram client in response to a callback query.
 * Falls back gracefully if the callback query has already expired.
 */
export async function showModalAlert(
  ctx: { answerCallbackQuery?: (opts: { text: string; show_alert: boolean }) => Promise<unknown> },
  text: string
): Promise<void> {
  if (!ctx || typeof ctx.answerCallbackQuery !== 'function') return;
  try {
    await ctx.answerCallbackQuery({ text, show_alert: true });
  } catch {
    // Gracefully ignore expired callback query errors
  }
}

/**
 * Safely sends a chat action indicator (e.g. typing, upload_document).
 */
export async function sendChatActionSafe(
  ctx: { replyWithChatAction?: (action: TelegramChatAction) => Promise<unknown> },
  action: TelegramChatAction
): Promise<void> {
  if (!ctx || typeof ctx.replyWithChatAction !== 'function') return;
  try {
    await ctx.replyWithChatAction(action);
  } catch {
    // Ignore network or Telegram API errors on chat actions
  }
}

/**
 * Wraps an asynchronous task with pulsating chat action indicators.
 * Periodically refreshes the chat action (every 4.5s) until the task finishes.
 */
export async function withChatAction<T>(
  ctx: { replyWithChatAction?: (action: TelegramChatAction) => Promise<unknown> },
  action: TelegramChatAction,
  task: () => Promise<T>,
  intervalMs = 4500
): Promise<T> {
  await sendChatActionSafe(ctx, action);

  let timer: NodeJS.Timeout | undefined;
  if (typeof ctx?.replyWithChatAction === 'function') {
    timer = setInterval(() => {
      void sendChatActionSafe(ctx, action);
    }, intervalMs);
  }

  try {
    return await task();
  } finally {
    if (timer) {
      clearInterval(timer);
    }
  }
}
