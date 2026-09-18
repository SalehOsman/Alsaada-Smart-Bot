import { InlineKeyboard } from 'grammy';
import { prisma } from '../db.js';
import { redis } from '../redis.js';
import { fastCache } from './fast-cache.service.js';
import {
  BotFeatureRegistryService,
  FeatureGateGuard,
  type BotMenuNodeDTO,
  BotNodeType,
  BotNodeStatus,
  DisabledBehavior,
} from '@alsaada/core-components';

export const BOT_MENU_SYNC_CHANNEL = 'system:bot_menu_sync';

export class DynamicMenuService {
  private readonly CACHE_KEY = 'bot:menu:nodes:all';
  private readonly TTL_SECONDS = 300; // 5 minutes cache TTL
  private isPubSubInitialized = false;

  /**
   * Initializes Redis Pub/Sub listener for real-time sub-5ms cache invalidation.
   */
  public initializeSyncListener(): void {
    if (this.isPubSubInitialized || !redis) return;

    try {
      const subscriber = redis.duplicate();
      subscriber.subscribe(BOT_MENU_SYNC_CHANNEL, (err) => {
        if (err) {
          console.error('❌ [DYNAMIC MENU] Failed to subscribe to menu sync channel:', err.message);
          return;
        }
        console.log(`📡 [DYNAMIC MENU] Subscribed to ${BOT_MENU_SYNC_CHANNEL} for instant menu synchronization.`);
      });

      subscriber.on('message', async (channel) => {
        if (channel === BOT_MENU_SYNC_CHANNEL) {
          console.log('⚡ [DYNAMIC MENU] Received instant menu cache invalidation signal via Redis Pub/Sub.');
          await this.invalidateCache();
        }
      });

      this.isPubSubInitialized = true;
    } catch (err) {
      console.warn('⚠️ [DYNAMIC MENU] Could not initialize Pub/Sub listener:', err);
    }
  }

  /**
   * Invalidates local RAM and Redis cache for bot menu nodes.
   */
  public async invalidateCache(): Promise<void> {
    await fastCache.invalidate(this.CACHE_KEY);
    fastCache.clearMemoizedKeyboards();
  }

  /**
   * Fetches all menu nodes from cache or DB.
   */
  public async getAllNodes(): Promise<BotMenuNodeDTO[]> {
    return fastCache.remember<BotMenuNodeDTO[]>(this.CACHE_KEY, this.TTL_SECONDS, async () => {
      if (!prisma?.botMenuNode?.findMany) {
        return [];
      }
      const dbNodes = await prisma.botMenuNode.findMany({
        orderBy: { sortOrder: 'asc' },
      });


      return dbNodes.map((n) => ({
        id: n.id,
        code: n.code,
        parentId: n.parentId,
        type: n.type as BotNodeType,
        title: n.title,
        icon: n.icon,
        callbackData: n.callbackData,
        status: n.status as BotNodeStatus,
        disabledBehavior: n.disabledBehavior as DisabledBehavior,
        maintenanceMessage: n.maintenanceMessage,
        sortOrder: n.sortOrder,
        isProtected: n.isProtected,
        allowedRoles: n.allowedRoles,
        metadata: (n.metadata as Record<string, unknown>) ?? null,
      }));
    });
  }

  /**
   * Finds a node by its Telegram callback data.
   */
  public async findNodeByCallback(callbackData: string): Promise<BotMenuNodeDTO | null> {
    const nodes = await this.getAllNodes();
    return BotFeatureRegistryService.findNodeByCallback(callbackData, nodes);
  }

  /**
   * Finds a node by its unique code (e.g. "mod:hr", "flow:01.1").
   */
  public async findNodeByCode(code: string): Promise<BotMenuNodeDTO | null> {
    const nodes = await this.getAllNodes();
    return BotFeatureRegistryService.findNodeByCode(code, nodes);
  }

  /**
   * Builds the dynamic main menu keyboard for the effective user role.
   * Returns null if no nodes are seeded, allowing graceful fallback to static keyboard.
   */
  public async buildMainMenuKeyboard(
    role: string,
    isDual = false
  ): Promise<InlineKeyboard | null> {
    const nodes = await this.getAllNodes();
    if (!nodes || nodes.length === 0) {
      return null;
    }

    // Main menu displays MODULE nodes (top level)
    const moduleNodes = nodes.filter((n) => n.type === BotNodeType.MODULE);
    const visibleModules = BotFeatureRegistryService.filterNodesForUser(moduleNodes, role);

    if (visibleModules.length === 0) {
      return null;
    }

    const keyboard = new InlineKeyboard();

    for (const mod of visibleModules) {
      const title = BotFeatureRegistryService.formatButtonTitle(mod);
      // Determine callback
      const callback = mod.callbackData || `menu:domain:${mod.code.replace('mod:', '')}`;
      keyboard.text(title, callback).row();
    }

    // If dual worker mode is active, append switch identity button
    if (isDual && role === 'WORKER') {
      keyboard.row().text('🛡️ العودة لبوابة الإشراف الميداني', 'action:switch_identity:field_admin');
    }

    return keyboard;
  }

  /**
   * Builds a keyboard for children under a parent node (e.g. section or subsection).
   */
  public async buildSubMenuKeyboard(
    parentCode: string,
    role: string,
    backCallback = 'menu:root'
  ): Promise<InlineKeyboard | null> {
    const nodes = await this.getAllNodes();
    const parent = BotFeatureRegistryService.findNodeByCode(parentCode, nodes);
    if (!parent) return null;

    const children = nodes.filter((n) => n.parentId === parent.id);
    const visibleChildren = BotFeatureRegistryService.filterNodesForUser(children, role);

    const keyboard = new InlineKeyboard();

    for (const child of visibleChildren) {
      const title = BotFeatureRegistryService.formatButtonTitle(child);
      const callback = child.callbackData || `node:${child.code}`;
      keyboard.text(title, callback).row();
    }

    // Add back button
    keyboard.row().text('🔙 رجوع', backCallback);

    return keyboard;
  }

  /**
   * Checks feature access status for a callback query.
   */
  public async verifyCallbackAccess(callbackData: string, userRole?: string): Promise<{
    found: boolean;
    allowed: boolean;
    node?: BotMenuNodeDTO;
    status?: BotNodeStatus;
    behavior?: DisabledBehavior;
    maintenanceMessage?: string;
    isProtected?: boolean;
    reason?: 'INACTIVE' | 'MAINTENANCE' | 'ROLE_UNAUTHORIZED' | 'NOT_FOUND';
  }> {
    const node = await this.findNodeByCallback(callbackData);
    if (!node) {
      return { found: false, allowed: true };
    }
    const check = FeatureGateGuard.checkFeatureAccess(node, userRole);
    return { found: true, node, ...check };
  }
}

export const dynamicMenuService = new DynamicMenuService();
