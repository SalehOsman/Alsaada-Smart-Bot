/**
 * Test Bot Context Factory — Standardized Mock Context for Flow Tests
 */

import { PINNED_BASE_TIME } from "./pinned-clock.js";

export interface TestBotContextOptions {
  userId?: number | undefined;
  chatId?: number | undefined;
  username?: string | undefined;
  firstName?: string | undefined;
  text?: string | undefined;
  callbackData?: string | undefined;
  session?: Record<string, unknown> | undefined;
}

export interface TestBotContext {
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string | undefined;
  };
  chat: {
    id: number;
    type: "private" | "group" | "supergroup";
  };
  message?:
    | {
        message_id: number;
        text?: string | undefined;
        date: number;
      }
    | undefined;
  callbackQuery?:
    | {
        id: string;
        data?: string | undefined;
        message?:
          | {
              message_id: number;
              text?: string | undefined;
              date: number;
            }
          | undefined;
      }
    | undefined;
  session: Record<string, unknown>;
  replies: Array<{
    text: string;
    options?: Record<string, unknown> | undefined;
  }>;
  edits: Array<{ text: string; options?: Record<string, unknown> | undefined }>;
  answeredCallbacks: Array<{
    text?: string | undefined;
    showAlert?: boolean | undefined;
  }>;
  reply(
    text: string,
    options?: Record<string, unknown> | undefined,
  ): Promise<{ message_id: number }>;
  editMessageText(
    text: string,
    options?: Record<string, unknown> | undefined,
  ): Promise<{ message_id: number }>;
  answerCallbackQuery(
    textOrOptions?:
      | string
      | { text?: string | undefined; show_alert?: boolean | undefined }
      | undefined,
  ): Promise<boolean>;
}

export function createTestBotContext(
  options: TestBotContextOptions = {},
): TestBotContext {
  const userId = options.userId ?? 123456789;
  const chatId = options.chatId ?? userId;
  const username = options.username ?? "test_user";
  const firstName = options.firstName ?? "Test User";
  const session = options.session ?? {};

  const replies: Array<{
    text: string;
    options?: Record<string, unknown> | undefined;
  }> = [];
  const edits: Array<{
    text: string;
    options?: Record<string, unknown> | undefined;
  }> = [];
  const answeredCallbacks: Array<{
    text?: string | undefined;
    showAlert?: boolean | undefined;
  }> = [];

  let nextMessageId = 1000;

  const ctx: TestBotContext = {
    from: {
      id: userId,
      is_bot: false,
      first_name: firstName,
      username,
    },
    chat: {
      id: chatId,
      type: "private",
    },
    session,
    replies,
    edits,
    answeredCallbacks,
    reply: async (text: string, opts?: Record<string, unknown> | undefined) => {
      const msgId = ++nextMessageId;
      replies.push({ text, options: opts });
      return { message_id: msgId };
    },
    editMessageText: async (
      text: string,
      opts?: Record<string, unknown> | undefined,
    ) => {
      const msgId = 999;
      edits.push({ text, options: opts });
      return { message_id: msgId };
    },
    answerCallbackQuery: async (
      textOrOpts?:
        | string
        | { text?: string | undefined; show_alert?: boolean | undefined }
        | undefined,
    ) => {
      if (typeof textOrOpts === "string") {
        answeredCallbacks.push({ text: textOrOpts, showAlert: undefined });
      } else if (textOrOpts) {
        answeredCallbacks.push({
          text: textOrOpts.text,
          showAlert: textOrOpts.show_alert,
        });
      } else {
        answeredCallbacks.push({ text: undefined, showAlert: undefined });
      }
      return true;
    },
  };

  if (options.callbackData !== undefined) {
    ctx.callbackQuery = {
      id: "cb_query_123",
      data: options.callbackData,
      message: {
        message_id: 999,
        text: options.text ?? "Previous wizard prompt",
        date: Math.floor(PINNED_BASE_TIME.getTime() / 1000),
      },
    };
  } else if (options.text !== undefined) {
    ctx.message = {
      message_id: ++nextMessageId,
      text: options.text,
      date: Math.floor(PINNED_BASE_TIME.getTime() / 1000),
    };
  }

  return ctx;
}
