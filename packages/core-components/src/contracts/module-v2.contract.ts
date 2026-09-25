/**
 * Sovereign Module V2 Contract
 * 
 * Defines standard modular domain specification, boot-time capability requirements,
 * auto-discovery manifests, and zero-modification routing contracts.
 */

import {
  asCapabilityId,
  asModuleId,
  type CapabilityId,
  type ModuleId,
} from './typesafe-primitives.contract.js';
import {
  validateFlowDefinitionV2,
  type FlowDefinitionV2,
} from './flow-v2.contract.js';

export type ModuleStatusV2 = 'draft' | 'active' | 'disabled';

export interface ModuleDashboardRoute {
  id: string;
  titleArabic: string;
  href: string;
  requiredRole: string;
}

export interface ModuleDatabaseContract {
  schemaFiles: readonly string[];
  relationsFile?: string | undefined;
  migrationsDir?: string | null | undefined;
}

export interface ModuleDefinitionV2 {
  schemaVersion: '2.0.0';
  id: ModuleId;
  version: string;
  titleArabic: string;
  descriptionArabic: string;
  category: string;
  status: ModuleStatusV2;
  requiredCapabilities: readonly CapabilityId[];
  providedCapabilities?: readonly CapabilityId[] | undefined;
  flows: readonly FlowDefinitionV2[];
  routes?: readonly ModuleDashboardRoute[] | undefined;
  databaseFragments?: readonly string[] | undefined;
  database?: ModuleDatabaseContract | undefined;
  isTestOnly?: boolean | undefined;
  callbackPrefixes: readonly string[];
  navigationPatterns?: readonly string[] | undefined;
}

export interface ModuleValidationResult {
  valid: boolean;
  errors: string[];
  module?: ModuleDefinitionV2;
}

const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;

export function validateModuleDefinitionV2(raw: unknown): ModuleValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Module contract must be a valid JSON object.'] };
  }

  const obj = raw as Record<string, unknown>;

  if (obj.schemaVersion !== '2.0.0') {
    errors.push(`Invalid schemaVersion "${String(obj.schemaVersion)}". Expected "2.0.0".`);
  }

  let moduleId: ModuleId | undefined;
  try {
    moduleId = asModuleId(String(obj.id ?? ''));
  } catch (err) {
    errors.push(String(err));
  }

  if (typeof obj.version !== 'string' || !SEMVER_REGEX.test(obj.version)) {
    errors.push(`Invalid or missing semver version "${String(obj.version)}". Expected format "X.Y.Z".`);
  }

  if (typeof obj.titleArabic !== 'string' || obj.titleArabic.trim().length === 0) {
    errors.push('Missing required titleArabic.');
  }

  if (typeof obj.descriptionArabic !== 'string' || obj.descriptionArabic.trim().length === 0) {
    errors.push('Missing required descriptionArabic.');
  }

  const validStatuses: ModuleStatusV2[] = ['draft', 'active', 'disabled'];
  if (!validStatuses.includes(obj.status as ModuleStatusV2)) {
    errors.push(`Invalid status "${String(obj.status)}". Allowed: ${validStatuses.join(', ')}.`);
  }

  const requiredCapabilities: CapabilityId[] = [];
  if (Array.isArray(obj.requiredCapabilities)) {
    for (const cap of obj.requiredCapabilities) {
      try {
        requiredCapabilities.push(asCapabilityId(String(cap)));
      } catch (err) {
        errors.push(String(err));
      }
    }
  }

  const providedCapabilities: CapabilityId[] = [];
  if (Array.isArray(obj.providedCapabilities)) {
    for (const cap of obj.providedCapabilities) {
      try {
        providedCapabilities.push(asCapabilityId(String(cap)));
      } catch (err) {
        errors.push(String(err));
      }
    }
  }

  const validatedFlows: FlowDefinitionV2[] = [];
  if (Array.isArray(obj.flows)) {
    for (let i = 0; i < obj.flows.length; i++) {
      const flowRaw = obj.flows[i];
      const flowRes = validateFlowDefinitionV2(flowRaw);
      if (!flowRes.valid) {
        for (const err of flowRes.errors) {
          errors.push(`Flow[${i}]: ${err}`);
        }
      } else if (flowRes.flow) {
        if (moduleId && flowRes.flow.module !== moduleId) {
          errors.push(`Flow[${i}] module mismatch: flow declares "${flowRes.flow.module}", module is "${moduleId}".`);
        }
        validatedFlows.push(flowRes.flow);
      }
    }
  }

  if (!Array.isArray(obj.callbackPrefixes) || obj.callbackPrefixes.length === 0) {
    errors.push('callbackPrefixes must be a non-empty array of string prefixes.');
  }

  let databaseContract: ModuleDatabaseContract | undefined;
  if (obj.database && typeof obj.database === 'object') {
    const rawDb = obj.database as Record<string, unknown>;
    const schemaFiles: string[] = [];
    if (Array.isArray(rawDb.schemaFiles)) {
      schemaFiles.push(...rawDb.schemaFiles.map(String));
    } else if (rawDb.schemaFile) {
      schemaFiles.push(String(rawDb.schemaFile));
    }

    databaseContract = {
      schemaFiles,
      relationsFile: rawDb.relationsFile ? String(rawDb.relationsFile) : undefined,
      migrationsDir: rawDb.migrationsDir !== undefined ? (rawDb.migrationsDir === null ? null : String(rawDb.migrationsDir)) : undefined,
    };
  }

  if (errors.length > 0 || !moduleId) {
    return { valid: false, errors };
  }

  const moduleDef: ModuleDefinitionV2 = {
    schemaVersion: '2.0.0',
    id: moduleId,
    version: String(obj.version),
    titleArabic: String(obj.titleArabic),
    descriptionArabic: String(obj.descriptionArabic),
    category: String(obj.category ?? 'operations'),
    status: obj.status as ModuleStatusV2,
    requiredCapabilities,
    providedCapabilities,
    flows: validatedFlows,
    routes: (obj.routes as ModuleDashboardRoute[]) ?? [],
    databaseFragments: (obj.databaseFragments as string[]) ?? [],
    database: databaseContract,
    isTestOnly: Boolean(obj.isTestOnly),
    callbackPrefixes: (obj.callbackPrefixes as string[]) ?? [],
    navigationPatterns: (obj.navigationPatterns as string[]) ?? [],
  };

  return { valid: true, errors: [], module: moduleDef };
}
