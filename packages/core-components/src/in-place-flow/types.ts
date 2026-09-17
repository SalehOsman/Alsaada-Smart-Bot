import type { InlineKeyboard } from 'grammy';

export interface ActiveScreenTracker {
  trackActiveScreen(
    telegramId: bigint,
    chatId: number,
    messageId: number,
    flowType: string,
    isCompleted?: boolean
  ): Promise<void> | void;

  getActiveScreen?(
    telegramId: bigint
  ): Promise<{ messageId: number; chatId: number; isCompleted?: boolean | undefined } | null>;

  shouldRenderInPlace?(
    ctx: unknown,
    requestedInPlace?: boolean
  ): Promise<boolean> | boolean;
}

export interface RenderInPlaceOptions {
  /** The text prompt or message content to display */
  prompt: string;
  /** Optional inline keyboard */
  keyboard?: InlineKeyboard | undefined;
  /** Current active message ID from draft / session. If not provided, will infer from callback query or tracker */
  activeMessageId?: number | undefined;
  /** Chat ID if not inferred from context */
  chatId?: number | undefined;
  /** Telegram user ID if not inferred from context */
  telegramId?: bigint | undefined;
  /** Flow type identifier for telemetry and screen tracking (e.g. 'worker_registration') */
  flowType?: string | undefined;
  /** Whether this step is the final completed operation receipt/card */
  isCompleted?: boolean | undefined;
  /** Whether to prevent overwriting an already completed screen receipt (default: true) */
  preservePreviousCompletedScreen?: boolean | undefined;
  /** Parse mode for Telegram formatting (default: 'Markdown') */
  parseMode?: 'Markdown' | 'HTML' | undefined;
  /** Whether to silently delete incoming user text/photo/document message (default: true) */
  deleteUserInput?: boolean | undefined;
  /** Disable link previews (default: true) */
  disableWebPagePreview?: boolean | undefined;
  /** Custom tracker override for this call */
  screenTracker?: ActiveScreenTracker | undefined;
  /** Callback fired when a message ID is determined or changed */
  onMessageIdUpdated?: ((newMsgId: number) => Promise<void> | void) | undefined;
}

export interface RenderInPlaceResult {
  messageId: number;
  chatId: number;
  editedInPlace: boolean;
}
