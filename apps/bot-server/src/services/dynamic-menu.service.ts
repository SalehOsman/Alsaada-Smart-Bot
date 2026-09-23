import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
   * Locates the active monorepo modules directory.
   */
  private findModulesDirectory(): string | null {
    const candidates = [
      path.resolve(process.cwd(), 'modules'),
      path.resolve(process.cwd(), '../../modules'),
      path.resolve(__dirname, '../../../../modules'),
      path.resolve(__dirname, '../../../modules'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  /**
   * Discovers authentic active modules and flows directly from monorepo manifests (Zero Phantom Domains).
   */
  public discoverMonorepoNodes(): BotMenuNodeDTO[] {
    const modulesDir = this.findModulesDirectory();
    if (!modulesDir || !fs.existsSync(modulesDir)) {
      return [];
    }

    const nodes: BotMenuNodeDTO[] = [];
    const moduleEntries = fs.readdirSync(modulesDir, { withFileTypes: true });
    moduleEntries.sort((a, b) => a.name.localeCompare(b.name));

    for (const modDirent of moduleEntries) {
      if (!modDirent.isDirectory()) continue;
      const modName = modDirent.name;
      const modDir = path.join(modulesDir, modName);
      const contractPath = path.join(modDir, 'module.contract.json');
      if (!fs.existsSync(contractPath)) continue;

      let contract: any = {};
      try {
        contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
      } catch {
        continue;
      }

      let modCode = `mod:${modName}`;
      let modTitle = contract.displayName || contract.titleArabic || modName;
      let modIcon = '📦';
      let modCallback = `menu:domain:${modName}`;
      let isProtected = Boolean(contract.critical);
      let allowedRoles = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'];

      if (modName === 'workforce') {
        modCode = 'mod:hr';
        modTitle = contract.displayName || 'قطاع الموارد البشرية وشؤون العاملين';
        modIcon = '👥';
        modCallback = 'menu:domain:hr';
        allowedRoles = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN', 'WORKER'];
      } else if (modName === 'settings') {
        modCode = 'mod:governance';
        modTitle = contract.displayName || 'قطاع الإعدادات السيادية والإدارة العامة';
        modIcon = '⚙️';
        modCallback = 'menu:domain:governance';
        isProtected = true;
        allowedRoles = ['SUPER_ADMIN'];
      }

      const modNodeId = `discovered:${modCode}`;
      nodes.push({
        id: modNodeId,
        code: modCode,
        parentId: null,
        type: BotNodeType.MODULE,
        title: modTitle,
        icon: modIcon,
        callbackData: modCallback,
        status: BotNodeStatus.ACTIVE,
        disabledBehavior: DisabledBehavior.LOCK_WITH_ALERT,
        maintenanceMessage: null,
        sortOrder: modName === 'workforce' ? 10 : 20,
        isProtected,
        allowedRoles,
        metadata: { module: modName },
      });

      const flowsDir = path.join(modDir, 'src', 'flows');
      if (fs.existsSync(flowsDir)) {
        const flowEntries = fs.readdirSync(flowsDir, { withFileTypes: true });
        flowEntries.sort((a, b) => a.name.localeCompare(b.name));

        for (let i = 0; i < flowEntries.length; i++) {
          const flowDirent = flowEntries[i];
          if (!flowDirent || !flowDirent.isDirectory()) continue;
          const flowDir = path.join(flowsDir, flowDirent.name);
          const flowContractPath = path.join(flowDir, 'flow.contract.json');
          if (!fs.existsSync(flowContractPath)) continue;

          try {
            const flowContract = JSON.parse(fs.readFileSync(flowContractPath, 'utf8'));
            const flowId = flowContract.id || flowContract.flowCode || flowDirent.name.split('-')[0];
            const flowCode = `flow:${flowId}`;
            const flowTitle = flowContract.titleArabic || flowContract.flowName || flowDirent.name;
            const flowCallback = flowContract.menuButton?.callbackData || `${flowCode}:start`;
            const flowRoles = Array.isArray(flowContract.allowedRoles) ? flowContract.allowedRoles : allowedRoles;
            const flowProtected = Boolean(flowContract.isProtected || modName === 'settings');

            nodes.push({
              id: `discovered:${flowCode}`,
              code: flowCode,
              parentId: modNodeId,
              type: BotNodeType.FLOW,
              title: flowTitle,
              icon: flowProtected ? '🛡️' : '⚡',
              callbackData: flowCallback,
              status: BotNodeStatus.ACTIVE,
              disabledBehavior: DisabledBehavior.LOCK_WITH_ALERT,
              maintenanceMessage: null,
              sortOrder: i + 1,
              isProtected: flowProtected,
              allowedRoles: flowRoles,
              metadata: { module: modName, flowId },
            });
          } catch {
            // skip invalid flow contract
          }
        }
      }
    }

    return nodes;
  }

  /**
   * Fetches all menu nodes derived strictly from active discovered monorepo modules.
   * If database is seeded, merges dynamic status/maintenance toggles while eliminating phantom unbuilt domains.
   */
  public async getAllNodes(): Promise<BotMenuNodeDTO[]> {
    return fastCache.remember<BotMenuNodeDTO[]>(this.CACHE_KEY, this.TTL_SECONDS, async () => {
      const discoveredNodes = this.discoverMonorepoNodes();
      const discoveredCodes = new Set(discoveredNodes.map((n) => n.code));

      if (prisma?.botMenuNode?.findMany) {
        try {
          const dbNodes = await prisma.botMenuNode.findMany({
            orderBy: { sortOrder: 'asc' },
          });

          if (dbNodes.length > 0) {
            // Filter strictly to nodes that belong to active discovered modules (Zero Phantom Nodes)
            const activeDbNodes = dbNodes.filter((n) => discoveredCodes.has(n.code));

            if (activeDbNodes.length > 0) {
              const dbNodeMap = new Map(activeDbNodes.map((n) => [n.code, n]));

              return discoveredNodes.map((disc) => {
                const dbNode = dbNodeMap.get(disc.code);
                if (dbNode) {
                  return {
                    id: dbNode.id,
                    code: dbNode.code,
                    parentId: dbNode.parentId ?? disc.parentId,
                    type: (dbNode.type as BotNodeType) || disc.type,
                    title: dbNode.title || disc.title,
                    icon: dbNode.icon || disc.icon,
                    callbackData: dbNode.callbackData || disc.callbackData,
                    status: (dbNode.status as BotNodeStatus) || disc.status,
                    disabledBehavior: (dbNode.disabledBehavior as DisabledBehavior) || disc.disabledBehavior,
                    maintenanceMessage: dbNode.maintenanceMessage || disc.maintenanceMessage,
                    sortOrder: dbNode.sortOrder ?? disc.sortOrder,
                    isProtected: dbNode.isProtected ?? disc.isProtected,
                    allowedRoles: dbNode.allowedRoles?.length ? dbNode.allowedRoles : disc.allowedRoles,
                    metadata: (dbNode.metadata as Record<string, unknown>) ?? disc.metadata,
                  };
                }
                return disc;
              });
            }
          }
        } catch (err) {
          console.warn('⚠️ [DYNAMIC MENU] Database fetch failed, using discovered manifest:', err);
        }
      }

      return discoveredNodes;
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
   * Returns null if no nodes are discovered, allowing graceful fallback to static keyboard.
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
