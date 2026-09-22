/**
 * Admin Dashboard Module Catalog Bridge (Work Plan 89)
 * 
 * Provides unified, cached access to autodiscovered modules and flows
 * for dashboard navigation, extensions routing, and RBAC authorization.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface CatalogFlowSummary {
  id: string;
  module: string;
  slug: string;
  titleArabic: string;
  descriptionArabic: string;
  category: string;
  status: 'draft' | 'active' | 'disabled';
  allowedRoles: readonly string[];
}

export interface CatalogModuleSummary {
  id: string;
  version: string;
  titleArabic: string;
  descriptionArabic: string;
  category: string;
  status: 'draft' | 'active' | 'disabled';
  callbackPrefixes: readonly string[];
  flows: readonly CatalogFlowSummary[];
}

let cachedModules: CatalogModuleSummary[] | null = null;
let cachedFlows: CatalogFlowSummary[] | null = null;

function loadCatalogFromDisk(root = process.cwd()): { modules: CatalogModuleSummary[]; flows: CatalogFlowSummary[] } {
  if (cachedModules && cachedFlows) {
    return { modules: cachedModules, flows: cachedFlows };
  }

  const catalogDir = join(root, '.generated', 'catalog');
  const modulesFile = join(catalogDir, 'modules.json');
  const flowsFile = join(catalogDir, 'flows.json');

  if (existsSync(modulesFile) && existsSync(flowsFile)) {
    try {
      const mods = JSON.parse(readFileSync(modulesFile, 'utf8')) as CatalogModuleSummary[];
      const fls = JSON.parse(readFileSync(flowsFile, 'utf8')) as CatalogFlowSummary[];
      cachedModules = mods;
      cachedFlows = fls;
      return { modules: mods, flows: fls };
    } catch {
      // ignore, fallback
    }
  }

  // Fallback defaults if catalog has not been generated yet
  const fallbackMods: CatalogModuleSummary[] = [
    {
      id: 'settings',
      version: '1.0.0',
      titleArabic: 'الإعدادات والتحكم السيادي',
      descriptionArabic: 'إدارة ملف الشركة والمواقع والمصفوفة الإدارية',
      category: 'operations',
      status: 'active',
      callbackPrefixes: ['settings:'],
      flows: [],
    },
    {
      id: 'workforce',
      version: '1.0.0',
      titleArabic: 'الموارد البشرية وشؤون العاملين',
      descriptionArabic: 'تسجيل وتعديل وتصفية العمالة والدليل الميداني 360°',
      category: 'operations',
      status: 'active',
      callbackPrefixes: ['workforce:'],
      flows: [],
    },
  ];

  return { modules: fallbackMods, flows: [] };
}

export function getDiscoveredModules(): readonly CatalogModuleSummary[] {
  return loadCatalogFromDisk().modules;
}

export function getDiscoveredFlows(moduleId?: string): readonly CatalogFlowSummary[] {
  const { flows } = loadCatalogFromDisk();
  if (moduleId) {
    return flows.filter((f) => f.module === moduleId);
  }
  return flows;
}

export function getModuleById(moduleId: string): CatalogModuleSummary | undefined {
  return getDiscoveredModules().find((m) => m.id === moduleId);
}

export function getFlowById(flowId: string): CatalogFlowSummary | undefined {
  return getDiscoveredFlows().find((f) => f.id === flowId);
}

export function isModuleAuthorized(moduleId: string, userRole: string): boolean {
  const mod = getModuleById(moduleId);
  if (!mod || mod.status !== 'active') return false;

  // Super Admin can access all active modules
  if (userRole === 'SUPER_ADMIN') return true;

  // If module has flows, user is authorized if authorized for at least one active flow
  if (mod.flows.length > 0) {
    return mod.flows.some(
      (f) => f.status === 'active' && (f.allowedRoles.includes(userRole) || f.allowedRoles.includes('*'))
    );
  }

  return true;
}

export function isFlowAuthorized(flowId: string, userRole: string): boolean {
  const flow = getFlowById(flowId);
  if (!flow || flow.status !== 'active') return false;
  if (userRole === 'SUPER_ADMIN') return true;
  return flow.allowedRoles.includes(userRole) || flow.allowedRoles.includes('*');
}
