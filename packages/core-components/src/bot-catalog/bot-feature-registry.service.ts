import { BotNodeStatus, DisabledBehavior, type BotMenuNodeDTO } from './types.js';

export class BotFeatureRegistryService {
  /**
   * Constructs a nested hierarchical tree from a flat list of nodes.
   */
  public static buildMenuTree(nodes: BotMenuNodeDTO[]): BotMenuNodeDTO[] {
    const nodeMap = new Map<string, BotMenuNodeDTO>();
    const roots: BotMenuNodeDTO[] = [];

    // Clone nodes so we don't mutate external objects
    for (const node of nodes) {
      nodeMap.set(node.id, { ...node, children: [] });
    }

    for (const node of nodes) {
      const current = nodeMap.get(node.id)!;
      if (node.parentId && nodeMap.has(node.parentId)) {
        const parent = nodeMap.get(node.parentId)!;
        parent.children = parent.children ?? [];
        parent.children.push(current);
      } else {
        roots.push(current);
      }
    }

    // Sort by sortOrder ascending
    const sortTree = (items: BotMenuNodeDTO[]) => {
      items.sort((a, b) => a.sortOrder - b.sortOrder);
      for (const item of items) {
        if (item.children && item.children.length > 0) {
          sortTree(item.children);
        }
      }
    };

    sortTree(roots);
    return roots;
  }

  /**
   * Finds a node by unique code in a flat list of nodes.
   */
  public static findNodeByCode(code: string, nodes: BotMenuNodeDTO[]): BotMenuNodeDTO | null {
    return nodes.find((n) => n.code === code) ?? null;
  }

  /**
   * Finds a node by Telegram callbackData in a flat list of nodes.
   * Supports exact callback matching, domain prefixes (e.g. menu:domain:hr -> mod:hr),
   * node prefixes (e.g. node:sec:workforce -> sec:workforce), and flow actions (e.g. flow:01.1:start -> flow:01.1).
   */
  public static findNodeByCallback(callbackData: string, nodes: BotMenuNodeDTO[]): BotMenuNodeDTO | null {
    // 1. Exact match on callbackData
    const exact = nodes.find((n) => n.callbackData === callbackData);
    if (exact) return exact;

    // 2. Exact match on node code
    const byCode = nodes.find((n) => n.code === callbackData);
    if (byCode) return byCode;

    // 3. Domain module callbacks: "menu:domain:hr" -> matches node "mod:hr"
    if (callbackData.startsWith('menu:domain:')) {
      const domainSuffix = callbackData.replace('menu:domain:', '');
      const modNode = nodes.find((n) => n.code === `mod:${domainSuffix}`);
      if (modNode) return modNode;
    }

    // 4. Section/Node callbacks: "node:sec:workforce" -> matches node "sec:workforce"
    if (callbackData.startsWith('node:')) {
      const nodeCode = callbackData.replace('node:', '');
      const secNode = nodes.find((n) => n.code === nodeCode);
      if (secNode) return secNode;
    }

    // 5. Flow callbacks with actions/steps: "flow:01.1:start" -> matches node "flow:01.1"
    if (callbackData.startsWith('flow:')) {
      const flowNode = nodes.find((n) => {
        if (n.code === callbackData) return true;
        if (callbackData.startsWith(`${n.code}:`)) return true;
        if (n.callbackData && callbackData.startsWith(`${n.callbackData}:`)) return true;
        return false;
      });
      if (flowNode) return flowNode;
    }

    return null;
  }

  /**
   * Evaluates if a node is visible for a user with the given role.
   * If disabled with HIDE, it should not appear.
   */
  public static isNodeVisible(node: BotMenuNodeDTO, userRole?: string): boolean {
    if (userRole && node.allowedRoles && node.allowedRoles.length > 0) {
      if (!node.allowedRoles.includes(userRole) && userRole !== 'SUPER_ADMIN') {
        return false;
      }
    }

    if (node.isProtected) {
      return true;
    }

    if (node.status === BotNodeStatus.ACTIVE) {
      return true;
    }

    // If disabled or maintenance, check disabledBehavior
    return node.disabledBehavior !== DisabledBehavior.HIDE;
  }

  /**
   * Evaluates if a node can be actively executed/pressed.
   */
  public static isNodeInteractive(node: BotMenuNodeDTO): boolean {
    if (node.isProtected) {
      return true;
    }
    return node.status === BotNodeStatus.ACTIVE;
  }

  /**
   * Formats the title displayed on Telegram buttons.
   * Adds lock icon 🔒 if node is disabled/maintenance and set to LOCK_WITH_ALERT.
   */
  public static formatButtonTitle(node: BotMenuNodeDTO): string {
    const icon = node.icon ? `${node.icon} ` : '';
    let title = `${icon}${node.title}`.trim();

    if (!node.isProtected && node.status !== BotNodeStatus.ACTIVE) {
      if (node.disabledBehavior === DisabledBehavior.LOCK_WITH_ALERT) {
        title = `🔒 ${title}`;
      }
    }

    return title;
  }

  /**
   * Filters a list of nodes for a specific user role, removing hidden nodes.
   */
  public static filterNodesForUser(nodes: BotMenuNodeDTO[], userRole?: string): BotMenuNodeDTO[] {
    return nodes
      .filter((n) => this.isNodeVisible(n, userRole))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
}
