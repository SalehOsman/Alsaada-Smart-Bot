import type { UnifiedNotificationDispatcher } from './notification-dispatcher.js';
import type { TransactionCategory } from './topic-router.js';
import type { OutboxEnqueueInput } from '../outbox-queue/types.js';

export interface FlowNotificationOptions {
  featureKey: string;
  siteId?: string | null | undefined;
  siteGroupId?: bigint | number | string | null | undefined;
  siteCardText?: string | undefined;
  hqCategory?: TransactionCategory | undefined;
  hqCardText?: string | undefined;
  parseMode?: 'Markdown' | 'HTML' | undefined;
  outboxEvent?: OutboxEnqueueInput | undefined;
}

export interface NotificationHelperConfig {
  dispatcher: UnifiedNotificationDispatcher;
  resolveSiteGroup?: ((siteId: string) => Promise<bigint | number | string | null | undefined>) | undefined;
  enqueueOutbox?: ((event: OutboxEnqueueInput) => Promise<void>) | undefined;
}

let globalConfig: NotificationHelperConfig | undefined;
const siteGroupMemoryCache = new Map<string, { groupId: bigint | number | string | null; expiresAt: number }>();
const CACHE_TTL_MS = 120_000; // 2 minutes RAM cache for site group IDs

export function configureNotificationHelper(config: NotificationHelperConfig): void {
  globalConfig = config;
}

export function getNotificationHelperConfig(): NotificationHelperConfig | undefined {
  return globalConfig;
}

export function clearNotificationHelperCache(): void {
  siteGroupMemoryCache.clear();
}

async function resolveSiteGroupCached(
  siteId: string,
  resolver?: (siteId: string) => Promise<bigint | number | string | null | undefined>
): Promise<bigint | number | string | null | undefined> {
  if (!resolver) return null;
  const now = Date.now();
  const cached = siteGroupMemoryCache.get(siteId);
  if (cached && cached.expiresAt > now) {
    return cached.groupId;
  }

  try {
    const groupId = await resolver(siteId);
    siteGroupMemoryCache.set(siteId, {
      groupId: groupId ?? null,
      expiresAt: now + CACHE_TTL_MS,
    });
    return groupId ?? null;
  } catch (err) {
    console.warn(`⚠️ [NOTIF_HELPER] Failed to resolve site group for ${siteId}:`, err);
    return null;
  }
}

/**
 * Universal safe helper to dispatch flow notifications to site group and/or HQ executive group,
 * and optionally queue a background Outbox sync event. Guaranteed non-blocking and fault-tolerant (< 15ms).
 */
export async function notifyFlowOperation(
  options: FlowNotificationOptions,
  customConfig?: NotificationHelperConfig
): Promise<{ siteSent: boolean; hqSent: boolean; outboxQueued: boolean }> {
  const config = customConfig || globalConfig;
  if (!config?.dispatcher) {
    // Graceful fallback if helper is not configured in current context (e.g. headless unit tests)
    return { siteSent: false, hqSent: false, outboxQueued: false };
  }

  let siteSent = false;
  let hqSent = false;
  let outboxQueued = false;

  try {
    // 1. Resolve Site Group ID if not provided explicitly
    let effectiveSiteGroupId = options.siteGroupId;
    if (!effectiveSiteGroupId && options.siteId && config.resolveSiteGroup) {
      effectiveSiteGroupId = await resolveSiteGroupCached(options.siteId, config.resolveSiteGroup);
    }

    // 2. Dispatch Multi-Channel Notifications (Site + HQ)
    const dispatchRes = await config.dispatcher.dispatch({
      featureKey: options.featureKey,
      siteId: options.siteId,
      siteGroupId: effectiveSiteGroupId,
      siteNotification: options.siteCardText
        ? {
            text: options.siteCardText,
            parseMode: options.parseMode ?? 'Markdown',
          }
        : undefined,
      hqNotification:
        options.hqCategory && options.hqCardText
          ? {
              category: options.hqCategory,
              text: options.hqCardText,
              parseMode: options.parseMode ?? 'Markdown',
            }
          : undefined,
    });

    siteSent = dispatchRes.siteSent;
    hqSent = dispatchRes.hqSent;
  } catch (err) {
    console.warn(`⚠️ [NOTIF_HELPER] Error dispatching telegram notifications for feature "${options.featureKey}":`, err);
  }

  // 3. Queue Outbox Event if provided
  if (options.outboxEvent && config.enqueueOutbox) {
    try {
      await config.enqueueOutbox(options.outboxEvent);
      outboxQueued = true;
    } catch (err) {
      console.warn(`⚠️ [NOTIF_HELPER] Error queuing outbox event for feature "${options.featureKey}":`, err);
    }
  }

  return { siteSent, hqSent, outboxQueued };
}
