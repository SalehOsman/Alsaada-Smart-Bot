import { FEATURE_CATALOG, type FeatureContract, type CanonicalRole } from '@alsaada/rbac';

export interface ModuleAnalyticsMeta {
  moduleKey: string;
  nameAr: string;
  features: Array<{
    key: string;
    flowCode: string;
    nameAr: string;
    kpiKeys: string[];
    hasDrilldown: boolean;
  }>;
}

export const MODULE_NAMES_AR: Record<string, string> = {
  workforce: '👥 شؤون العاملين والقوى العاملة',
  advances: '💵 السلف والمسحوبات',
  canteen: '🛒 الكانتين ومهمات الوقاية',
  custody: '💰 الخزينة والعهد المالية',
  equipment: '🚜 المعدات والمحروقات الميدانية',
  settings: '⚙️ الحوكمة وإدارة النظام',
  analytics: '📊 التحليلات والتقارير',
};

/**
 * Discover and build analytics hierarchy from RBAC feature catalog filtered by user role
 */
export function getAnalyticsModulesForRole(role: CanonicalRole): ModuleAnalyticsMeta[] {
  const modulesMap = new Map<string, ModuleAnalyticsMeta>();

  for (const [key, feature] of Object.entries(FEATURE_CATALOG)) {
    if (!feature.allowedRoles.includes(role) && role !== 'SUPER_ADMIN') {
      continue;
    }

    const moduleKey = feature.module;
    if (!modulesMap.has(moduleKey)) {
      modulesMap.set(moduleKey, {
        moduleKey,
        nameAr: MODULE_NAMES_AR[moduleKey] || moduleKey,
        features: [],
      });
    }

    const mod = modulesMap.get(moduleKey)!;
    mod.features.push({
      key,
      flowCode: feature.flowCode,
      nameAr: feature.nameAr,
      kpiKeys: feature.analytics?.kpiKeys || [],
      hasDrilldown: feature.analytics?.hasDrilldown || false,
    });
  }

  return Array.from(modulesMap.values());
}
