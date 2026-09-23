import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  createResult,
  countLines,
  fail,
  fileIsNonEmpty,
  isCliEntrypoint,
  listFilesRecursive,
  listFlowDirs,
  printAndExit,
  readUtf8,
  toRepoPath,
  type VerificationResult,
} from './common.js';

const REQUIRED_FLOW_FILES_V1 = [
  'flow.contract.json',
  'flow.handler.ts',
  'flow.keyboard.ts',
  'flow.service.ts',
  'flow.repository.ts',
  'flow.types.ts',
  'flow.validators.ts',
  'flow.messages.ts',
  'flow.telemetry.ts',
  'flow.docs.md',
  'tests/flow.unit.spec.ts',
  'tests/flow.integration.spec.ts',
  'tests/flow.ux.spec.ts',
  'tests/flow.rbac.spec.ts',
  'tests/flow.data.spec.ts',
] as const;

const REQUIRED_FLOW_FILES_V2 = [
  'flow.contract.json',
  'index.ts',
  'controller.ts',
  'menu.builder.ts',
  'action.handler.ts',
  'service.ts',
  'types.ts',
  'validator.ts',
  'error.handler.ts',
] as const;

const COMPLETED_STATUSES = new Set(['Implemented', 'UAT_PASS']);

interface FlowContractPreview {
  schemaVersion?: string | undefined;
  status?: string | undefined;
  allowAny?: boolean | undefined;
}

function readContract(flowDir: string): FlowContractPreview {
  try {
    return JSON.parse(readUtf8(join(flowDir, 'flow.contract.json'))) as FlowContractPreview;
  } catch {
    return {};
  }
}

export function verifyArchitecture(root = process.cwd()): VerificationResult {
  const result = createResult();
  const flowDirs = listFlowDirs(root);
  result.checked = flowDirs.length;

  // 1. Flow file structure, lines, placeholders & any prohibition
  for (const flowDir of flowDirs) {
    const repoFlowPath = toRepoPath(root, flowDir);
    const contract = readContract(flowDir);
    const isV2 = contract.schemaVersion === '2.0.0' || existsSync(join(flowDir, 'controller.ts'));
    const requiredFiles = isV2 ? REQUIRED_FLOW_FILES_V2 : REQUIRED_FLOW_FILES_V1;

    for (const requiredFile of requiredFiles) {
      const fullPath = join(flowDir, requiredFile);
      if (!fileIsNonEmpty(fullPath)) {
        fail(result, `${repoFlowPath} is missing non-empty required file: ${requiredFile}`);
      }
    }

    const handlerFileName = isV2
      ? existsSync(join(flowDir, 'action.handler.ts'))
        ? 'action.handler.ts'
        : 'controller.ts'
      : 'flow.handler.ts';
    const handlerLines = countLines(join(flowDir, handlerFileName));
    if (handlerLines > 350) fail(result, `${repoFlowPath}/${handlerFileName} exceeds 350 lines (${handlerLines})`);

    const serviceFileName = isV2 ? 'service.ts' : 'flow.service.ts';
    const serviceLines = countLines(join(flowDir, serviceFileName));
    if (serviceLines > 500) fail(result, `${repoFlowPath}/${serviceFileName} exceeds 500 lines (${serviceLines})`);

    const isCompleted = contract.status ? COMPLETED_STATUSES.has(contract.status) : true;
    const flowFiles = listFilesRecursive(flowDir).filter((file) => /\.(ts|md|json)$/.test(file));
    for (const file of flowFiles) {
      const text = readUtf8(file);
      const repoFilePath = toRepoPath(root, file);
      if (isCompleted && /placeholder/i.test(text))
        fail(result, `${repoFilePath} contains placeholder text in a completed flow`);
      if (!contract.allowAny && /\bany\b/.test(text) && file.endsWith('.ts'))
        fail(result, `${repoFilePath} uses any without a documented exception`);
    }

    // If flow directory has its own flow.plugin.ts, it must import FlowPlugin from @alsaada/core-components
    const pluginFile = join(flowDir, 'flow.plugin.ts');
    if (existsSync(pluginFile)) {
      const pluginText = readUtf8(pluginFile);
      if (/interface\s+(FlowPlugin|FlowContractMetadata|FlowMenuButton)\b/.test(pluginText)) {
        fail(
          result,
          `${toRepoPath(root, pluginFile)} defines local shadow flow contract interface instead of importing from @alsaada/core-components`
        );
      }
      if (!pluginText.includes('@alsaada/core-components')) {
        fail(result, `${toRepoPath(root, pluginFile)} must import FlowPlugin from @alsaada/core-components`);
      }
    }
  }

  // 2. Sovereign Flow Contracts in Module Manifests
  const modulesRoot = join(root, 'modules');
  if (existsSync(modulesRoot)) {
    for (const moduleEntry of readdirSync(modulesRoot, { withFileTypes: true })) {
      if (!moduleEntry.isDirectory()) continue;
      const manifestPath = join(modulesRoot, moduleEntry.name, 'src', 'flows.manifest.ts');
      if (existsSync(manifestPath)) {
        result.checked += 1;
        const manifestText = readUtf8(manifestPath);
        const repoManifest = toRepoPath(root, manifestPath);

        // Disallow local shadow interfaces
        if (/interface\s+FlowPlugin\b/.test(manifestText)) {
          fail(
            result,
            `${repoManifest} declares a local shadow FlowPlugin interface instead of importing sovereign contract from @alsaada/core-components`
          );
        }
        if (/interface\s+FlowContractMetadata\b/.test(manifestText)) {
          fail(
            result,
            `${repoManifest} declares a local shadow FlowContractMetadata interface instead of importing sovereign contract from @alsaada/core-components`
          );
        }
        if (/interface\s+FlowMenuButton\b/.test(manifestText)) {
          fail(
            result,
            `${repoManifest} declares a local shadow FlowMenuButton interface instead of importing sovereign contract from @alsaada/core-components`
          );
        }

        // Must import from @alsaada/core-components
        if (!manifestText.includes('@alsaada/core-components')) {
          fail(result, `${repoManifest} must import FlowPlugin and FlowContractMetadata from @alsaada/core-components`);
        }

        // All flows in this module must be registered in the manifest
        const flowsDir = join(modulesRoot, moduleEntry.name, 'src', 'flows');
        if (existsSync(flowsDir)) {
          for (const flowEntry of readdirSync(flowsDir, { withFileTypes: true })) {
            if (!flowEntry.isDirectory()) continue;
            const flowCode = flowEntry.name.split('-')[0]?.trim();
            if (
              flowCode &&
              !manifestText.includes(`'${flowCode}'`) &&
              !manifestText.includes(`"${flowCode}"`) &&
              !manifestText.includes(flowEntry.name)
            ) {
              fail(result, `Flow ${flowEntry.name} in module ${moduleEntry.name} is not registered in ${repoManifest}`);
            }
          }
        }
      }
    }
  }

  // 3. Sovereign Dashboard Contracts in Dashboard Manifest
  const dashboardManifestPath = join(root, 'apps', 'admin-dashboard', 'src', 'dashboard.manifest.ts');
  if (existsSync(dashboardManifestPath)) {
    result.checked += 1;
    const dashText = readUtf8(dashboardManifestPath);
    const repoDash = toRepoPath(root, dashboardManifestPath);

    // Disallow local shadow interfaces
    if (/interface\s+DashboardFeature\b/.test(dashText)) {
      fail(
        result,
        `${repoDash} declares a local shadow DashboardFeature interface instead of importing sovereign contract from @alsaada/core-components`
      );
    }
    if (/interface\s+DashboardSectionManifest\b/.test(dashText)) {
      fail(
        result,
        `${repoDash} declares a local shadow DashboardSectionManifest interface instead of importing sovereign contract from @alsaada/core-components`
      );
    }
    if (/interface\s+DashboardSubSection\b/.test(dashText)) {
      fail(
        result,
        `${repoDash} declares a local shadow DashboardSubSection interface instead of importing sovereign contract from @alsaada/core-components`
      );
    }

    // Must import from @alsaada/core-components
    if (!dashText.includes('@alsaada/core-components')) {
      fail(
        result,
        `${repoDash} must import DashboardFeature and DashboardSectionManifest from @alsaada/core-components`
      );
    }

    // Must declare and export DASHBOARD_SECTIONS_MANIFEST
    if (!dashText.includes('DASHBOARD_SECTIONS_MANIFEST')) {
      fail(result, `${repoDash} must export DASHBOARD_SECTIONS_MANIFEST conforming to DashboardSectionManifest[]`);
    }

    // Validate feature definitions and route presence
    const featureBlockRegex =
      /{\s*id:\s*['"]([^'"]+)['"]\s*,\s*module:\s*['"]([^'"]+)['"]\s*,\s*title:\s*['"]([^'"]+)['"]\s*,\s*href:\s*['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    let featureCount = 0;
    while ((match = featureBlockRegex.exec(dashText)) !== null) {
      featureCount++;
      const [, id, moduleName, title, href] = match;
      if (!id || !moduleName || !title || !href) {
        fail(result, `${repoDash}: Dashboard feature has missing required properties`);
        continue;
      }
      const trimmedHref = href.startsWith('/') ? href.slice(1) : href;
      const expectedPage = join(root, 'apps', 'admin-dashboard', 'src', 'app', trimmedHref, 'page.tsx');
      if (!existsSync(expectedPage)) {
        fail(
          result,
          `${repoDash}: Dashboard feature '${id}' href '${href}' does not resolve to an existing page at ${toRepoPath(root, expectedPage)}`
        );
      }
    }
    result.checked += featureCount;
  }

  // 4. Gateway Layer Hardening: Forbid direct database calls via prisma.* inside bot-server handlers
  const botHandlersDir = join(root, 'apps', 'bot-server', 'src', 'handlers');
  if (existsSync(botHandlersDir)) {
    const handlerFiles = listFilesRecursive(botHandlersDir).filter((file) => file.endsWith('.ts'));
    for (const file of handlerFiles) {
      const text = readUtf8(file);
      const repoFilePath = toRepoPath(root, file);
      if (/\bprisma\s*\.\s*(\$|[a-zA-Z])/.test(text)) {
        fail(
          result,
          `${repoFilePath} makes direct database calls via prisma.* (gateway handlers must delegate to module repositories/services)`
        );
      }
    }
  }

  // 5. Sovereign Module Contract: Every module in modules/* must implement AppModuleDefinition
  if (existsSync(modulesRoot)) {
    for (const moduleEntry of readdirSync(modulesRoot, { withFileTypes: true })) {
      if (!moduleEntry.isDirectory()) continue;
      const modName = moduleEntry.name;
      const modPkg = join(modulesRoot, modName, 'package.json');
      if (!existsSync(modPkg)) continue;

      result.checked += 1;
      const registerFile = join(modulesRoot, modName, 'src', 'module.register.ts');
      const repoRegister = toRepoPath(root, registerFile);

      if (!existsSync(registerFile)) {
        fail(result, `Module ${modName} is missing required ${repoRegister}`);
        continue;
      }

      const registerText = readUtf8(registerFile);

      // Disallow local shadow interfaces
      if (/interface\s+AppModuleDefinition\b/.test(registerText)) {
        fail(
          result,
          `${repoRegister} declares local shadow AppModuleDefinition interface instead of importing from @alsaada/core-components`
        );
      }

      // Must import AppModuleDefinition from @alsaada/core-components
      if (!registerText.includes('AppModuleDefinition') || !registerText.includes('@alsaada/core-components')) {
        fail(result, `${repoRegister} must import and implement AppModuleDefinition from @alsaada/core-components`);
      }
    }
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  printAndExit('arch:verify', verifyArchitecture(process.cwd()));
}
