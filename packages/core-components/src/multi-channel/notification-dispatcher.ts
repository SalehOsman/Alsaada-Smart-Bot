import type { Bot, Api } from 'grammy';
import type { NotificationPolicyEngine } from './notification-policy.js';
import { resolveTopicId, type ForumTopicConfig, type TransactionCategory } from './topic-router.js';
import { DISABLED_LINK_PREVIEWS } from '../formatting/telegram-formatters.js';

export interface DispatchNotificationPayload {
  text: string;
  parseMode?: 'Markdown' | 'HTML';
}

export interface DispatchEventOptions {
  featureKey: string;
  siteId?: string | null | undefined;
  siteGroupId?: bigint | number | string | null | undefined;
  siteNotification?: DispatchNotificationPayload | undefined;
  hqNotification?: {
    category: TransactionCategory;
    text: string;
    parseMode?: 'Markdown' | 'HTML' | undefined;
  } | undefined;
}

export interface DispatcherConfig {
  policyEngine: NotificationPolicyEngine;
  hqGroupId?:
    | bigint
    | number
    | string
    | null
    | (() => Promise<bigint | number | string | null | undefined> | bigint | number | string | null | undefined)
    | undefined;
  forumConfig?:
    | ForumTopicConfig
    | (() => Promise<ForumTopicConfig | undefined> | ForumTopicConfig | undefined)
    | undefined;
  api: Api;
}

export class UnifiedNotificationDispatcher {
  constructor(private readonly config: DispatcherConfig) {}

  /**
   * Dispatches a notification event independently to the site group (read-only)
   * and/or the executive HQ group topic, adhering strictly to individual policy switches.
   * Safe asynchronous non-blocking execution to ensure < 15ms caller latency.
   */
  async dispatch(options: DispatchEventOptions): Promise<{ siteSent: boolean; hqSent: boolean }> {
    let siteSent = false;
    let hqSent = false;

    // 1. Dispatch to Site-Isolated Group (Read-Only)
    if (options.siteGroupId && options.siteNotification) {
      try {
        const isSiteEnabled = await this.config.policyEngine.isSiteNotificationEnabled(options.featureKey);
        if (isSiteEnabled) {
          const isSilent = await this.config.policyEngine.isSilentNotification(options.featureKey);
          const chatId = typeof options.siteGroupId === 'bigint' ? Number(options.siteGroupId) : options.siteGroupId;

          await this.config.api.sendMessage(chatId, options.siteNotification.text, {
            parse_mode: options.siteNotification.parseMode ?? 'Markdown',
            disable_notification: isSilent,
            link_preview_options: DISABLED_LINK_PREVIEWS,
          });
          siteSent = true;
        }
      } catch (err) {
        console.warn(`⚠️ [NOTIF DISPATCHER] Failed to send to site group ${options.siteGroupId}:`, err);
      }
    }

    // 2. Dispatch to HQ Executive Group Topic
    let resolvedHqId: bigint | number | string | null | undefined =
      typeof this.config.hqGroupId === 'function' ? await this.config.hqGroupId() : this.config.hqGroupId;

    if (resolvedHqId && options.hqNotification) {
      try {
        const isHqEnabled = await this.config.policyEngine.isHqNotificationEnabled(options.featureKey);
        if (isHqEnabled) {
          const resolvedForum =
            typeof this.config.forumConfig === 'function'
              ? await this.config.forumConfig()
              : this.config.forumConfig;

          const threadId = resolvedForum
            ? resolveTopicId(options.hqNotification.category, resolvedForum)
            : undefined;

          const hqChatId = typeof resolvedHqId === 'bigint' ? Number(resolvedHqId) : resolvedHqId;

          const sendOptions: Record<string, unknown> = {
            parse_mode: options.hqNotification.parseMode ?? 'Markdown',
            disable_notification: false,
            link_preview_options: DISABLED_LINK_PREVIEWS,
          };
          if (threadId) {
            sendOptions.message_thread_id = threadId;
          }

          await this.config.api.sendMessage(hqChatId, options.hqNotification.text, sendOptions as any);
          hqSent = true;
        }
      } catch (err) {
        console.warn(`⚠️ [NOTIF DISPATCHER] Failed to send to HQ group ${resolvedHqId}:`, err);
      }
    }

    return { siteSent, hqSent };
  }
}
