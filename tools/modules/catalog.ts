/**
 * Monorepo Module & Flow Catalog Scanner (Work Plan 89)
 * 
 * Scans, normalizes, and deterministically hashes all modules and vertical slices
 * in `modules/*` supporting both native V2 specifications and V1 compatibility adapters.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  asCapabilityId,
  asFlowId,
  asModuleId,
  CORE_CAPABILITIES,
  TELEGRAM_BUDGET,
  type CapabilityId,
  type FlowDefinitionV2,
  type FlowId,
  type ModuleDefinitionV2,
  type ModuleId,
  type TelegramErgonomicsBudget,
} from '../../packages/core-components/src/index.js';

export interface CatalogFlowEntry extends FlowDefinitionV2 {
  sourceDirectory: string;
  filesHash: string;
}

export interface CatalogModuleEntry extends ModuleDefinitionV2 {
  sourceDirectory: string;
  isV1Compatible: boolean;
  moduleHash: string;
}

export interface MonorepoCatalog {
  version: '2.0.0';
  generatedAt: string;
  catalogHash: string;
  modules: CatalogModuleEntry[];
  flows: CatalogFlowEntry[];
  sourceMap: Record<string, { module: string; flow?: string; type: 'module' | 'flow' | 'fragment' }>;
}

export function sha256String(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

export function sha256Buffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Deterministically computes a hash over all relevant source files in a directory.
 */
export function hashDirectoryFiles(dir: string, extensions = ['.ts', '.json', '.md']): string {
  if (!existsSync(dir)) return '';
  const hashes: string[] = [];

  function walk(current: string) {
    const entries = readdirSync(current, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const ent of entries) {
      const full = join(current, ent.name);
      if (ent.isDirectory()) {
        if (ent.name !== 'node_modules' && ent.name !== 'dist' && !ent.name.startsWith('.')) {
          walk(full);
        }
      } else if (extensions.some((ext) => ent.name.endsWith(ext))) {
        try {
          const content = readFileSync(full);
          const fileSha = sha256Buffer(content);
          const relPath = relative(dir, full).replace(/\\/g, '/');
          hashes.push(`${relPath}:${fileSha}`);
        } catch {
          // ignore unreadable file
        }
      }
    }
  }

  walk(dir);
  return sha256String(hashes.join('\n'));
}

/**
 * Scans modules directory and builds the complete catalog.
 */
export function scanMonorepoCatalog(root = process.cwd()): MonorepoCatalog {
  const modulesDir = join(root, 'modules');
  const catalogModules: CatalogModuleEntry[] = [];
  const catalogFlows: CatalogFlowEntry[] = [];
  const sourceMap: MonorepoCatalog['sourceMap'] = {};

  if (!existsSync(modulesDir)) {
    return {
      version: '2.0.0',
      generatedAt: new Date().toISOString(),
      catalogHash: sha256String('empty'),
      modules: [],
      flows: [],
      sourceMap: {},
    };
  }

  const moduleEntries = readdirSync(modulesDir, { withFileTypes: true });
  // Deterministic sorting by directory name
  moduleEntries.sort((a, b) => a.name.localeCompare(b.name));

  for (const modDirent of moduleEntries) {
    if (!modDirent.isDirectory()) continue;
    const modDir = join(modulesDir, modDirent.name);
    const modPackageJsonPath = join(modDir, 'package.json');
    if (!existsSync(modPackageJsonPath)) continue;

    const modName = modDirent.name;
    const moduleId = asModuleId(modName);

    // Check if V2 module.contract.json exists
    const v2ContractPath = join(modDir, 'module.contract.json');
    const flowsManifestPath = join(modDir, 'src', 'flows.manifest.ts');
    const moduleRegisterPath = join(modDir, 'src', 'module.register.ts');

    let titleArabic = modName;
    let descriptionArabic = `Module ${modName}`;
    let version = '1.0.0';
    let category = 'operations';
    let status: 'draft' | 'active' | 'disabled' = 'active';
    let requiredCapabilities: CapabilityId[] = [asCapabilityId('storage:attachment')];
    let callbackPrefixes: string[] = [`action:${modName}:`, `wizard:${modName}:`];
    let isV1Compatible = false;

    if (existsSync(v2ContractPath)) {
      try {
        const parsed = JSON.parse(readFileSync(v2ContractPath, 'utf8'));
        if (parsed.titleArabic) {
          titleArabic = parsed.titleArabic;
        } else if (parsed.displayName) {
          titleArabic = parsed.displayName;
        } else if (modName === 'settings') {
          titleArabic = 'الإعدادات والتحكم السيادي';
        } else if (modName === 'workforce') {
          titleArabic = 'الموارد البشرية وشؤون العاملين';
        }

        if (parsed.descriptionArabic) {
          descriptionArabic = parsed.descriptionArabic;
        } else if (parsed.description) {
          descriptionArabic = parsed.description;
        } else if (modName === 'settings') {
          descriptionArabic = 'إدارة ملف الشركة والمواقع والمصفوفة الإدارية وقنوات التليجرام';
        } else if (modName === 'workforce') {
          descriptionArabic = 'تسجيل وتعديل وتصفية العمالة ودليل العاملين 360°';
        }

        if (parsed.version) version = parsed.version;
        if (parsed.category) category = parsed.category;
        if (parsed.status) status = parsed.status;
        if (Array.isArray(parsed.requiredCapabilities)) {
          requiredCapabilities = parsed.requiredCapabilities.map((c: string) => asCapabilityId(c));
        }
        if (Array.isArray(parsed.callbackPrefixes)) {
          callbackPrefixes = parsed.callbackPrefixes;
        }
      } catch {
        // fallback to defaults
      }
    } else if (existsSync(moduleRegisterPath) || existsSync(flowsManifestPath)) {
      // V1 module compatibility adapter (e.g. settings, workforce)
      isV1Compatible = true;
      if (modName === 'settings') {
        titleArabic = 'الإعدادات والتحكم السيادي';
        descriptionArabic = 'إدارة ملف الشركة والمواقع والمصفوفة الإدارية وقنوات التليجرام';
        requiredCapabilities = [
          asCapabilityId('rbac:cascading'),
          asCapabilityId('telemetry:error-vault'),
        ];
        callbackPrefixes = ['settings:', 'action:settings:', 'wizard:settings:'];
      } else if (modName === 'workforce') {
        titleArabic = 'الموارد البشرية وشؤون العاملين';
        descriptionArabic = 'تسجيل وتعديل وتصفية العمالة ودليل العاملين 360°';
        requiredCapabilities = [
          asCapabilityId('storage:attachment'),
          asCapabilityId('regional:egyptian-national-id'),
          asCapabilityId('regional:governorates'),
          asCapabilityId('ledger:double-entry'),
        ];
        callbackPrefixes = ['workforce:', 'action:workforce:', 'wizard:workforce:'];
      }
    }

    // Scan flows within this module
    const flowsDir = join(modDir, 'src', 'flows');
    const moduleFlows: CatalogFlowEntry[] = [];

    if (existsSync(flowsDir)) {
      const flowDirents = readdirSync(flowsDir, { withFileTypes: true });
      flowDirents.sort((a, b) => a.name.localeCompare(b.name));

      for (const flowDirent of flowDirents) {
        if (!flowDirent.isDirectory()) continue;
        const flowPath = join(flowsDir, flowDirent.name);
        const flowContractPath = join(flowPath, 'flow.contract.json');
        if (!existsSync(flowContractPath)) continue;

        try {
          const contractContent = readFileSync(flowContractPath, 'utf8');
          const parsed = JSON.parse(contractContent);

          // Extract code and slug
          const codeFromDir = flowDirent.name.split('-')[0]?.trim() ?? '00.0';
          const slugFromDir = flowDirent.name.includes('-')
            ? flowDirent.name.substring(flowDirent.name.indexOf('-') + 1)
            : flowDirent.name;

          const rawId = parsed.id ?? parsed.flowCode ?? codeFromDir;
          const flowId = asFlowId(rawId);
          const slug = parsed.slug ?? slugFromDir;

          const flowTitle = parsed.titleArabic ?? parsed.flowName ?? slug;
          const flowDesc = parsed.descriptionArabic ?? parsed.description ?? flowTitle;
          const flowStatus = (parsed.status === 'Implemented' || parsed.status === 'UAT_PASS' || parsed.status === 'active')
            ? 'active'
            : (parsed.status === 'disabled' ? 'disabled' : 'draft');

          const allowedRoles: string[] = Array.isArray(parsed.allowedRoles)
            ? parsed.allowedRoles
            : ['SUPER_ADMIN', 'FIELD_ADMIN', 'ADMIN'];

          const flowFilesHash = hashDirectoryFiles(flowPath);

          const catalogFlow: CatalogFlowEntry = {
            schemaVersion: '2.0.0',
            id: flowId,
            module: moduleId,
            slug,
            titleArabic: flowTitle,
            descriptionArabic: flowDesc,
            category: parsed.category ?? category,
            status: flowStatus,
            allowedRoles,
            menuButton: parsed.menuButton ? {
              labelArabic: parsed.menuButton.labelArabic ?? parsed.menuButton.label ?? 'إجراء',
              callbackData: parsed.menuButton.callbackData ?? `flow:${rawId}:start`,
              subSection: parsed.menuButton.subSection ?? 'general',
              order: parsed.menuButton.order ?? 1,
              requiresSuperAdmin: parsed.menuButton.requiresSuperAdmin ?? false,
            } : undefined,
            telegramBudget: TELEGRAM_BUDGET,
            idempotencyRequired: parsed.idempotencyRequired ?? true,
            typesafeQuestions: parsed.typesafeQuestions ?? [],
            entrypointFiles: {
              contract: 'flow.contract.json',
              handler: 'flow.handler.ts',
              service: 'flow.service.ts',
              keyboard: 'flow.keyboard.ts',
              types: 'flow.types.ts',
              validators: 'flow.validators.ts',
              messages: 'flow.messages.ts',
              telemetry: 'flow.telemetry.ts',
              docs: 'flow.docs.md',
            },
            sourceDirectory: relative(root, flowPath).replace(/\\/g, '/'),
            filesHash: flowFilesHash,
          };

          moduleFlows.push(catalogFlow);
          catalogFlows.push(catalogFlow);

          sourceMap[catalogFlow.sourceDirectory] = {
            module: modName,
            flow: rawId,
            type: 'flow',
          };
        } catch {
          // skip invalid flow contract in scan, validator will catch
        }
      }
    }

    const moduleDirRel = relative(root, modDir).replace(/\\/g, '/');
    const moduleHash = hashDirectoryFiles(modDir);

    const catalogModule: CatalogModuleEntry = {
      schemaVersion: '2.0.0',
      id: moduleId,
      version,
      titleArabic,
      descriptionArabic,
      category,
      status,
      requiredCapabilities,
      providedCapabilities: [],
      flows: moduleFlows,
      callbackPrefixes,
      sourceDirectory: moduleDirRel,
      isV1Compatible,
      moduleHash,
    };

    catalogModules.push(catalogModule);
    sourceMap[moduleDirRel] = {
      module: modName,
      type: 'module',
    };
  }

  // Deterministic order: modules by ID; flows by module then ID
  catalogModules.sort((a, b) => a.id.localeCompare(b.id));
  catalogFlows.sort((a, b) => {
    const modCompare = a.module.localeCompare(b.module);
    if (modCompare !== 0) return modCompare;
    return a.id.localeCompare(b.id);
  });

  const catalogSummary = catalogModules
    .map((m) => `${m.id}:${m.version}:${m.moduleHash}:[${m.flows.map((f) => f.id).join(',')}]`)
    .join('\n');
  const catalogHash = sha256String(catalogSummary);

  return {
    version: '2.0.0',
    generatedAt: new Date().toISOString(),
    catalogHash,
    modules: catalogModules,
    flows: catalogFlows,
    sourceMap,
  };
}
