/**
 * Sovereign Catalog Adapter & Dynamic Router Bridge (Work Plan 89)
 * 
 * Bridges generated catalog metadata with runtime Grammy Bot dispatcher,
 * enforcing status checks (draft/active/disabled), RBAC permissions, and callback resolution.
 */

import type { Context } from 'grammy';
import type { FlowDefinitionV2, ModuleDefinitionV2 } from '../contracts/index.js';

export interface CatalogAdapterConfig {
  modules: readonly ModuleDefinitionV2[];
  flows: readonly FlowDefinitionV2[];
  callbackPrefixMap?: ReadonlyMap<string, string>;
}

export interface RoutingDecision {
  allowed: boolean;
  moduleId?: string;
  flow?: FlowDefinitionV2;
  rejectionReason?: 'UNKNOWN_PREFIX' | 'FLOW_NOT_FOUND' | 'FLOW_DRAFT' | 'FLOW_DISABLED' | 'UNAUTHORIZED_ROLE';
  messageArabic?: string;
}

export class CatalogAdapter {
  private readonly moduleMap = new Map<string, ModuleDefinitionV2>();
  private readonly flowMap = new Map<string, FlowDefinitionV2>();
  private readonly callbackPrefixes: Array<{ prefix: string; moduleId: string }> = [];

  constructor(config: CatalogAdapterConfig) {
    for (const mod of config.modules) {
      this.moduleMap.set(mod.id, mod);
      for (const prefix of mod.callbackPrefixes) {
        this.callbackPrefixes.push({ prefix, moduleId: mod.id });
      }
    }

    for (const flow of config.flows) {
      this.flowMap.set(flow.id, flow);
    }

    // Sort prefixes longest first for greedy matching
    this.callbackPrefixes.sort((a, b) => b.prefix.length - a.prefix.length);
  }

  /**
   * Resolves the target module based on callback query data.
   */
  public resolveModuleFromCallback(callbackData: string): string | undefined {
    for (const { prefix, moduleId } of this.callbackPrefixes) {
      if (callbackData.startsWith(prefix)) {
        return moduleId;
      }
    }
    return undefined;
  }

  /**
   * Resolves the target flow definition by flow ID (e.g. '01.1', '89.1').
   */
  public getFlow(flowId: string): FlowDefinitionV2 | undefined {
    return this.flowMap.get(flowId);
  }

  /**
   * Evaluates routing decision for an incoming action/callback including status and RBAC.
   */
  public evaluateRouting(callbackData: string, userRole = 'GUEST'): RoutingDecision {
    const moduleId = this.resolveModuleFromCallback(callbackData);
    if (!moduleId) {
      return {
        allowed: false,
        rejectionReason: 'UNKNOWN_PREFIX',
        messageArabic: 'الإجراء المطلوب غير مسجل في فهرس المنظومة.',
      };
    }

    const mod = this.moduleMap.get(moduleId);
    if (mod && mod.status === 'disabled') {
      return {
        allowed: false,
        moduleId,
        rejectionReason: 'FLOW_DISABLED',
        messageArabic: 'هذا القسم معطل مؤقتاً لأعمال الصيانة.',
      };
    }

    // Search matching flow in module
    let matchedFlow: FlowDefinitionV2 | undefined;
    for (const flow of this.flowMap.values()) {
      if (flow.module === moduleId) {
        // If callback matches flow menu button or start action
        if (
          flow.menuButton?.callbackData === callbackData ||
          callbackData.includes(`:${flow.id}:`) ||
          callbackData.includes(`:${flow.slug}:`)
        ) {
          matchedFlow = flow;
          break;
        }
      }
    }

    if (!matchedFlow) {
      // Allow module-level fallback handler if no specific flow matched
      return { allowed: true, moduleId };
    }

    // Status check
    if (matchedFlow.status === 'draft') {
      return {
        allowed: false,
        moduleId,
        flow: matchedFlow,
        rejectionReason: 'FLOW_DRAFT',
        messageArabic: 'هذا التدفق قيد الإعداد التجريبي (Draft) وغير متاح للتشغيل العام.',
      };
    }

    if (matchedFlow.status === 'disabled') {
      return {
        allowed: false,
        moduleId,
        flow: matchedFlow,
        rejectionReason: 'FLOW_DISABLED',
        messageArabic: 'تم إيقاف هذا التدفق مؤقتاً.',
      };
    }

    // RBAC check
    if (!matchedFlow.allowedRoles.includes(userRole) && !matchedFlow.allowedRoles.includes('*')) {
      return {
        allowed: false,
        moduleId,
        flow: matchedFlow,
        rejectionReason: 'UNAUTHORIZED_ROLE',
        messageArabic: 'عفواً، حسابك غير مصرح له بتنفيذ هذا الإجراء.',
      };
    }

    return {
      allowed: true,
      moduleId,
      flow: matchedFlow,
    };
  }
}
