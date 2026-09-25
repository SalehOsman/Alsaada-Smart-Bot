import fs from 'node:fs';
import path from 'node:path';
import { isCliEntrypoint } from './common.js';

export interface DocRealityParityResult {
  ok: boolean;
  violations: string[];
  checkedScripts: number;
}

export function verifyDocRealityParity(root = process.cwd()): DocRealityParityResult {
  const violations: string[] = [];
  let checkedScripts = 0;

  // 1. Verify all tsx script files in root package.json exist on disk
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    violations.push('Root package.json does not exist.');
  } else {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const scripts = (pkg.scripts || {}) as Record<string, string>;

    for (const [name, cmd] of Object.entries(scripts)) {
      const matches = [...cmd.matchAll(/\btsx\s+([^\s"'&|;]+\.(?:ts|js))\b/g)];
      for (const match of matches) {
        const scriptFile = match[1];
        if (!scriptFile) continue;
        checkedScripts++;
        const absPath = path.join(root, scriptFile);
        if (!fs.existsSync(absPath)) {
          violations.push(
            `[package.json -> scripts."${name}"] Referenced script "${scriptFile}" does not exist on disk.`
          );
        }
      }
    }
  }

  // 2. Verify README.md and docs/06 reality parity
  const readmePath = path.join(root, 'README.md');
  if (fs.existsSync(readmePath)) {
    const readme = fs.readFileSync(readmePath, 'utf8');
    if (!readme.includes('PostgreSQL 16')) {
      violations.push('[README.md] Must explicitly declare PostgreSQL 16 as canonical storage engine.');
    }
    if (!readme.includes('pnpm system:provision')) {
      violations.push('[README.md] Must reference canonical provisioning script "pnpm system:provision".');
    }
  } else {
    violations.push('[README.md] Missing root README.md.');
  }

  const doc06Path = path.join(root, 'docs/06-tenant-onboarding-and-provisioning-wizard.md');
  if (fs.existsSync(doc06Path)) {
    const doc06 = fs.readFileSync(doc06Path, 'utf8');
    if (!doc06.includes('CompanyProfile')) {
      violations.push('[docs/06] Must reference Singleton CompanyProfile architecture.');
    }
    if (!doc06.includes('pnpm system:provision')) {
      violations.push('[docs/06] Must reference "pnpm system:provision".');
    }
  } else {
    violations.push('[docs/06] Missing docs/06-tenant-onboarding-and-provisioning-wizard.md.');
  }

  return {
    ok: violations.length === 0,
    violations,
    checkedScripts,
  };
}

if (isCliEntrypoint(import.meta.url)) {
  const res = verifyDocRealityParity();
  if (!res.ok) {
    console.error('❌ [DOC REALITY PARITY SENTINEL] Violations detected:');
    for (const v of res.violations) {
      console.error(`   - ${v}`);
    }
    process.exit(1);
  }
  console.log(
    `✅ [DOC REALITY PARITY SENTINEL] Passed (${res.checkedScripts} package.json script paths and docs verified against disk reality).`
  );
}
