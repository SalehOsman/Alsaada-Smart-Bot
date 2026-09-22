/**
 * Monorepo Module & Flow Catalog Validator (Work Plan 89)
 * 
 * Verifies catalog integrity, prefix collision immunity, capability resolution,
 * path boundary security, and Telegram mobile budget compliance.
 */

import { existsSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  CORE_CAPABILITIES,
  validateModuleCapabilities,
  type CapabilityId,
} from '../../packages/core-components/src/index.js';
import type { MonorepoCatalog } from './catalog.js';

export interface CatalogValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checked: {
    modules: number;
    flows: number;
    prefixes: number;
    capabilities: number;
  };
}

export function validateMonorepoCatalog(
  catalog: MonorepoCatalog,
  root = process.cwd()
): CatalogValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const seenModuleIds = new Set<string>();
  const seenFlowIds = new Set<string>();
  const seenPrefixes = new Map<string, string>(); // prefix -> moduleId

  const resolvedRoot = realpathSync(resolve(root));
  const availableCapabilities: CapabilityId[] = [...CORE_CAPABILITIES.map((c) => c.id)];

  // 1. Collect all provided capabilities from all modules
  for (const mod of catalog.modules) {
    if (mod.providedCapabilities) {
      for (const cap of mod.providedCapabilities) {
        availableCapabilities.push(cap);
      }
    }
  }

  // 2. Validate Modules
  for (const mod of catalog.modules) {
    // Unique Module ID
    if (seenModuleIds.has(mod.id)) {
      errors.push(`Duplicate Module ID detected: "${mod.id}". Module IDs must be globally unique.`);
    }
    seenModuleIds.add(mod.id);

    // Boundary check: physical directory must exist inside repository root
    const physicalDir = join(root, mod.sourceDirectory);
    if (!existsSync(physicalDir)) {
      errors.push(`Module "${mod.id}" source directory does not exist: "${mod.sourceDirectory}".`);
    } else {
      try {
        const realPhysicalDir = realpathSync(physicalDir);
        if (!realPhysicalDir.startsWith(resolvedRoot)) {
          errors.push(`Module "${mod.id}" escapes repository boundary via symlink: "${realPhysicalDir}".`);
        }
      } catch {
        errors.push(`Could not resolve realpath for module "${mod.id}".`);
      }
    }

    // Callback prefixes uniqueness
    for (const prefix of mod.callbackPrefixes) {
      if (seenPrefixes.has(prefix)) {
        const previousOwner = seenPrefixes.get(prefix);
        errors.push(
          `Prefix collision: Callback prefix "${prefix}" is declared by both "${previousOwner}" and "${mod.id}".`
        );
      } else {
        seenPrefixes.set(prefix, mod.id);
      }
    }

    // Required capabilities resolution
    const capResult = validateModuleCapabilities(mod.requiredCapabilities, availableCapabilities);
    if (!capResult.valid) {
      for (const missing of capResult.missing) {
        errors.push(
          `Unresolved Capability: Module "${mod.id}" requires "${missing}" which is not provided by core or any module.`
        );
      }
    }
  }

  // 3. Validate Flows
  for (const flow of catalog.flows) {
    // Unique Flow ID
    if (seenFlowIds.has(flow.id)) {
      errors.push(`Duplicate Flow ID detected: "${flow.id}". Flow IDs must be unique across the monorepo.`);
    }
    seenFlowIds.add(flow.id);

    // Flow must belong to a known module
    if (!seenModuleIds.has(flow.module)) {
      errors.push(`Flow "${flow.id}" references unknown module "${flow.module}".`);
    }

    // Boundary check
    const flowPhysicalDir = join(root, flow.sourceDirectory);
    if (!existsSync(flowPhysicalDir)) {
      errors.push(`Flow "${flow.id}" source directory does not exist: "${flow.sourceDirectory}".`);
    } else {
      try {
        const realFlowDir = realpathSync(flowPhysicalDir);
        if (!realFlowDir.startsWith(resolvedRoot)) {
          errors.push(`Flow "${flow.id}" escapes repository boundary: "${realFlowDir}".`);
        }
      } catch {
        errors.push(`Could not resolve realpath for flow "${flow.id}".`);
      }
    }

    // Telegram Budget Enforcement (G5, G22)
    if (flow.menuButton) {
      if (flow.menuButton.labelArabic.length > 16) {
        errors.push(
          `Flow "${flow.id}" menuButton labelArabic exceeds maximum 16 characters (${flow.menuButton.labelArabic.length}).`
        );
      }
      const callbackBytes = Buffer.byteLength(flow.menuButton.callbackData, 'utf8');
      if (callbackBytes > 64) {
        errors.push(
          `Flow "${flow.id}" menuButton callbackData exceeds maximum 64 bytes (${callbackBytes} bytes).`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checked: {
      modules: catalog.modules.length,
      flows: catalog.flows.length,
      prefixes: seenPrefixes.size,
      capabilities: availableCapabilities.length,
    },
  };
}
