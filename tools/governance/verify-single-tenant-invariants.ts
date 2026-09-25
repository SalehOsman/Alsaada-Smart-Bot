import fs from 'node:fs';
import path from 'node:path';
import { isCliEntrypoint } from './common.js';

export interface SingleTenantVerificationResult {
  ok: boolean;
  violations: string[];
  checkedFiles: number;
}

function collectTsFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.next') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTsFiles(fullPath, acc);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      acc.push(fullPath);
    }
  }
  return acc;
}

export function verifySingleTenantInvariants(root = process.cwd()): SingleTenantVerificationResult {
  const violations: string[] = [];
  let checkedFiles = 0;

  // 1. Check Prisma schemas
  const schemaPaths = [
    path.join(root, 'packages/database/prisma/schema.prisma'),
  ];
  const generatedSchemaDir = path.join(root, '.generated/database/schema');
  if (fs.existsSync(generatedSchemaDir)) {
    for (const f of fs.readdirSync(generatedSchemaDir)) {
      if (f.endsWith('.prisma')) {
        schemaPaths.push(path.join(generatedSchemaDir, f));
      }
    }
  }

  for (const sp of schemaPaths) {
    if (!fs.existsSync(sp)) continue;
    checkedFiles++;
    const content = fs.readFileSync(sp, 'utf8');
    const rel = path.relative(root, sp).replace(/\\/g, '/');

    if (/^\s*model\s+Tenant\b/m.test(content)) {
      violations.push(`[${rel}] Prohibited multi-tenant "model Tenant" declaration found.`);
    }
    if (/^\s*tenantId\s+/m.test(content)) {
      violations.push(`[${rel}] Prohibited "tenantId" field found in Prisma schema.`);
    }
    if (/provider\s*=\s*"sqlite"/i.test(content)) {
      violations.push(`[${rel}] Prohibited "sqlite" datasource provider found; must be "postgresql".`);
    }
  }

  // 2. Check source files in apps/ and modules/ for prisma.tenant calls
  const sourceDirs = [path.join(root, 'apps'), path.join(root, 'modules')];
  const tsFiles: string[] = [];
  for (const d of sourceDirs) {
    collectTsFiles(d, tsFiles);
  }

  for (const file of tsFiles) {
    checkedFiles++;
    const content = fs.readFileSync(file, 'utf8');
    if (/\bprisma\.tenant\b/.test(content)) {
      const rel = path.relative(root, file).replace(/\\/g, '/');
      violations.push(`[${rel}] Prohibited "prisma.tenant" query detected.`);
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    checkedFiles,
  };
}

if (isCliEntrypoint(import.meta.url)) {
  const res = verifySingleTenantInvariants();
  if (!res.ok) {
    console.error('❌ [SINGLE-TENANT SENTINEL] Violations detected:');
    for (const v of res.violations) {
      console.error(`   - ${v}`);
    }
    process.exit(1);
  }
  console.log(`✅ [SINGLE-TENANT SENTINEL] Passed (${res.checkedFiles} files verified, 0 multi-tenant or SQLite artifacts).`);
}
