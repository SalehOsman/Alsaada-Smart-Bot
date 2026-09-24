import { existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import ts from 'typescript';
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
  'flow.docs.md',
] as const;

const PURE_FP_CORE_FILE_NAMES = new Set([
  'flow.keyboard.ts',
  'menu.builder.ts',
  'flow.validators.ts',
  'validator.ts',
  'flow.messages.ts',
  'action.handler.ts',
  'error.handler.ts',
  'flow.types.ts',
  'types.ts',
  'page.tsx',
  'route.ts',
]);

const PURE_FUNCTION_REQUIRED_FILE_NAMES = new Set([
  'flow.keyboard.ts',
  'menu.builder.ts',
  'flow.validators.ts',
  'validator.ts',
  'flow.messages.ts',
]);

const DI_OOP_SHELL_FILE_NAMES = new Set([
  'flow.handler.ts',
  'controller.ts',
  'flow.service.ts',
  'service.ts',
  'flow.repository.ts',
  'repository.ts',
]);

export function validateStrictFlowIsolation(
  repoFilePath: string,
  currentFlowDirName: string,
  content: string
): string[] {
  const errors: string[] = [];
  const sf = ts.createSourceFile(repoFilePath, content, ts.ScriptTarget.Latest, true);

  for (const stmt of sf.statements) {
    let specifier: string | null = null;
    if (ts.isImportDeclaration(stmt) && stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
      specifier = stmt.moduleSpecifier.text;
    } else if (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
      specifier = stmt.moduleSpecifier.text;
    }

    if (!specifier) continue;
    const normSpec = specifier.replace(/\\/g, '/');

    // Check if importing from a sibling flow directory: e.g. ../01.1-worker-registration/... or ../../flows/01.1-...
    const siblingFlowMatch =
      normSpec.match(/^\.\.\/([0-9]+\.[0-9A-Za-z.-]+-[a-z0-9-]+)(\/|$)/) ??
      normSpec.match(/\/flows\/([0-9]+\.[0-9A-Za-z.-]+-[a-z0-9-]+)(\/|$)/);

    if (siblingFlowMatch && siblingFlowMatch[1] && siblingFlowMatch[1] !== currentFlowDirName) {
      errors.push(
        `CROSS_FLOW_ISOLATION_BREACH: ${repoFilePath} imports from sibling flow "${specifier}". Each flow must be a 100% self-contained vertical slice.`
      );
    }
  }

  return errors;
}

export function validateFcisCodingParadigm(repoFilePath: string, content: string): string[] {
  const errors: string[] = [];
  const fileName = basename(repoFilePath);
  const scriptKind = repoFilePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(repoFilePath, content, ts.ScriptTarget.Latest, true, scriptKind);

  const isPureFpLayer = PURE_FP_CORE_FILE_NAMES.has(fileName);
  const requiresExportedFunction = PURE_FUNCTION_REQUIRED_FILE_NAMES.has(fileName);
  const isDiShellLayer = DI_OOP_SHELL_FILE_NAMES.has(fileName) || /\.service\.ts$|\.repository\.ts$/.test(fileName);

  let exportedFunctionCount = 0;

  for (const stmt of sf.statements) {
    const modifiers = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
    const isExported = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;

    if (ts.isFunctionDeclaration(stmt) && isExported) {
      exportedFunctionCount++;
    }

    if (ts.isClassDeclaration(stmt)) {
      const className = stmt.name?.text ?? '<anonymous>';

      // 1. No class declarations allowed in Pure FP Core layers
      if (isPureFpLayer) {
        errors.push(
          `FCIS_PARADIGM_VIOLATION: ${repoFilePath} declares class "${className}" in a Pure Functional Core layer (${fileName}). Export standalone pure functions (export function) instead.`
        );
        continue;
      }

      // 2. Check heritage clauses (extends) in DI Service / Repository layers
      if (isDiShellLayer && stmt.heritageClauses) {
        for (const hc of stmt.heritageClauses) {
          if (hc.token === ts.SyntaxKind.ExtendsKeyword) {
            const baseText = hc.types.map((t) => t.getText(sf)).join(', ');
            if (!/Error\b/.test(baseText)) {
              errors.push(
                `FCIS_PARADIGM_VIOLATION: ${repoFilePath} class "${className}" uses class inheritance (extends ${baseText}). Composition over inheritance is strictly required in FCIS.`
              );
            }
          }
        }
      }

      // 3. Universal ban on Static-Only Utility Classes across all monorepo zones (except legacy V1 flow.telemetry.ts adapter)
      const hasConstructor = stmt.members.some((m) => ts.isConstructorDeclaration(m));
      const methodMembers = stmt.members.filter((m) => ts.isMethodDeclaration(m));
      const allMethodsStatic =
        methodMembers.length > 0 &&
        methodMembers.every((m) =>
          (ts.canHaveModifiers(m) ? ts.getModifiers(m) : undefined)?.some(
            (mod) => mod.kind === ts.SyntaxKind.StaticKeyword
          )
        );
      if (!hasConstructor && allMethodsStatic && fileName !== 'flow.telemetry.ts') {
        errors.push(
          `FCIS_PARADIGM_VIOLATION: ${repoFilePath} declares static utility class "${className}". Export standalone pure functions (export function) instead.`
        );
      }
    }
  }

  // 4. Require at least one top-level exported pure function in keyboard, messages, and validators files
  // (unless it is a pure Zod schema file exporting *Schema or a 1-line empty test fixture stub)
  if (requiresExportedFunction && exportedFunctionCount === 0 && content.trim() !== 'export {};') {
    const hasZodSchemaExport = /export\s+const\s+\w+Schema\b/.test(content);
    if (!hasZodSchemaExport) {
      errors.push(
        `FCIS_PARADIGM_VIOLATION: ${repoFilePath} must export top-level pure functions (export function ...) rather than only wrapping methods in an object or class.`
      );
    }
  }

  return errors;
}

export function validateMermaidStateDiagram(filePath: string, content: string): string[] {
  const errors: string[] = [];

  // 1. Must contain stateDiagram-v2 or stateDiagram
  if (!content.includes('stateDiagram-v2') && !content.includes('stateDiagram')) {
    errors.push(`${filePath} is missing mandatory Mermaid state diagram (stateDiagram-v2)`);
    return errors;
  }

  // 2. Extract Mermaid blocks
  const mermaidMatches = content.match(/```mermaid[\s\S]*?```/g);
  if (!mermaidMatches || mermaidMatches.length === 0) {
    errors.push(`${filePath} contains no valid fenced \`\`\`mermaid code block`);
    return errors;
  }

  let validDiagramFound = false;

  for (const block of mermaidMatches) {
    if (!block.includes('stateDiagram-v2') && !block.includes('stateDiagram')) {
      continue;
    }

    const blockErrors: string[] = [];

    // Check entry transition: [*] -->
    if (!/\[\*\]\s*-->/.test(block)) {
      blockErrors.push(`${filePath}: state diagram is missing initial entry transition ([*] -->)`);
    }

    // Check terminal transition: --> [*]
    if (!/-->\s*\[\*\]/.test(block)) {
      blockErrors.push(`${filePath}: state diagram is missing terminal transition (--> [*])`);
    }

    // Count transitions (-->)
    const arrowCount = (block.match(/-->/g) || []).length;
    if (arrowCount < 3) {
      blockErrors.push(
        `${filePath}: state diagram must contain at least 3 state transitions (found ${arrowCount})`
      );
    }

    // Check balanced braces for sub-states: count { and }
    const openBraces = (block.match(/\{/g) || []).length;
    const closeBraces = (block.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      blockErrors.push(
        `${filePath}: state diagram has unbalanced sub-state braces ({: ${openBraces}, }: ${closeBraces})`
      );
    }

    if (blockErrors.length === 0) {
      validDiagramFound = true;
      break;
    } else {
      errors.push(...blockErrors);
    }
  }

  if (validDiagramFound) {
    return [];
  }

  return errors.length > 0 ? errors : [`${filePath} does not contain a valid stateDiagram-v2 block`];
}

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
    const flowDirName = basename(flowDir);
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

      if (file.endsWith('.ts') && !file.endsWith('.spec.ts') && !file.endsWith('.test.ts')) {
        const isoErrors = validateStrictFlowIsolation(repoFilePath, flowDirName, text);
        for (const err of isoErrors) fail(result, err);

        const fcisErrors = validateFcisCodingParadigm(repoFilePath, text);
        for (const err of fcisErrors) fail(result, err);
      }
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

    // Validate mandatory Mermaid state diagram in flow.docs.md / walkthrough.md (Rule 07 Section 5 & Gate G22)
    const flowDocsFile = join(flowDir, 'flow.docs.md');
    const walkthroughFile = join(flowDir, 'walkthrough.md');
    const activeDocFile = existsSync(flowDocsFile)
      ? flowDocsFile
      : existsSync(walkthroughFile)
        ? walkthroughFile
        : null;

    if (activeDocFile) {
      const docContent = readUtf8(activeDocFile);
      const diagramErrors = validateMermaidStateDiagram(toRepoPath(root, activeDocFile), docContent);
      for (const diagErr of diagramErrors) {
        fail(result, diagErr);
      }
    } else {
      fail(
        result,
        `${repoFlowPath} is missing mandatory flow documentation file (flow.docs.md or walkthrough.md)`
      );
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
