import { CopyTextButton } from '../types.js';

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
