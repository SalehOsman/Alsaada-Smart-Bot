import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  createResult,
  fail,
  isCliEntrypoint,
  listFilesRecursive,
  type VerificationResult,
} from './common.js';

export interface ModuleBoundaryReport extends VerificationResult {
  checkedImports: number;
  violations: Array<{ file: string; target: string; rule: string }>;
}

export function verifyModuleBoundaries(root = process.cwd()): ModuleBoundaryReport {
  const result = createResult() as ModuleBoundaryReport;
  result.checkedImports = 0;
  result.violations = [];

  const modulesDir = join(root, 'modules');
  const packagesDir = join(root, 'packages');

  const importRegex = /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;

  // 1. Audit packages: Packages must NEVER import from modules/* or apps/*
  if (existsSync(packagesDir)) {
    const pkgFiles = listFilesRecursive(packagesDir).filter(
      (f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.includes('/dist/') && !f.includes('/node_modules/')
    );

    for (const file of pkgFiles) {
      const relFile = relative(root, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      let match: RegExpExecArray | null;

      while ((match = importRegex.exec(content)) !== null) {
        result.checkedImports++;
        const target = match[1];
        if (!target) continue;
        if (target.includes('/modules/') || target.startsWith('modules/') || target.includes('/apps/') || target.startsWith('apps/')) {
          result.violations.push({
            file: relFile,
            target,
            rule: 'Reverse Dependency: Packages cannot import from modules or apps.',
          });
          fail(result, `Package file "${relFile}" imports from restricted target "${target}".`);
        }
      }
    }
  }

  // 2. Audit modules: No direct cross-module internal imports
  if (existsSync(modulesDir)) {
    const moduleEntries = readdirSync(modulesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

    for (const modName of moduleEntries) {
      const modPath = join(modulesDir, modName, 'src');
      if (!existsSync(modPath)) continue;

      const modFiles = listFilesRecursive(modPath).filter(
        (f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.includes('/tests/')
      );

      for (const file of modFiles) {
        const relFile = relative(root, file).replace(/\\/g, '/');
        const content = readFileSync(file, 'utf8');
        let match: RegExpExecArray | null;

        while ((match = importRegex.exec(content)) !== null) {
          result.checkedImports++;
          const target = match[1];
          if (!target) continue;

          // Check if it imports another module's internal source
          for (const otherMod of moduleEntries) {
            if (otherMod === modName) continue;
            const crossModulePattern = new RegExp(`(?:\\.\\./)+${otherMod}/src`, 'i');
            if (crossModulePattern.test(target) || target.includes(`/modules/${otherMod}/src`)) {
              result.violations.push({
                file: relFile,
                target,
                rule: 'Cross-Module Isolation: Modules cannot import from another module internal source.',
              });
              fail(result, `Module file "${relFile}" violates boundary by importing from "${target}".`);
            }
          }
        }
      }
    }
  }

  result.checked = result.checkedImports;
  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  const report = verifyModuleBoundaries();
  console.log(`🛡️ [MODULE BOUNDARIES VERIFIER] Checked ${report.checkedImports} module & package imports.`);
  if (!report.ok) {
    console.error(`❌ Boundary violations found (${report.violations.length}):`);
    for (const v of report.violations) {
      console.error(`   - ${v.file} -> ${v.target} (${v.rule})`);
    }
    process.exit(1);
  }
  console.log('✅ All architectural module boundaries 100% verified.');
  process.exit(0);
}
