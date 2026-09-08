import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createResult, fail, isCliEntrypoint, printAndExit, readUtf8, type VerificationResult } from './common.js';

const REQUIRED_DOCS = [
  'AGENTS.md',
  'GEMINI.md',
  'docs/14-ai-agent-governance-and-file-rules.md',
  'docs/15-universal-module-and-flow-standard.md',
  'docs/19-legacy-to-enterprise-master-feature-migration-registry.md',
  'docs/21-mandatory-module-architecture-and-gates.md',
  'docs/ai-execution-evidence/README.md',
] as const;

const REQUIRED_SCRIPTS = [
  'build',
  'test',
  'lint',
  'arch:verify',
  'migration:verify',
  'flow-contracts:verify',
  'docs:audit',
  'docs:parity',
  'governance:lock',
  'governance:tamper-check',
  'ai-compliance:verify',
] as const;

const REQUIRED_STANDARD_MARKERS = [
  'modules/<module-name>/',
  'src/',
  'flows/',
  'G1',
  'G2',
  'G3',
  'G4',
  'G5',
  'G6',
  'G7',
  'G8',
  'G9',
  'G10',
  'G11',
  'G12',
  'pnpm arch:verify',
  'pnpm migration:verify',
  'pnpm flow-contracts:verify',
  'pnpm docs:audit',
  'pnpm docs:parity',
  'pnpm governance:lock',
  'pnpm governance:tamper-check',
  'pnpm ai-compliance:verify',
] as const;

export function verifyDocsAudit(root = process.cwd()): VerificationResult {
  const result = createResult();

  for (const doc of REQUIRED_DOCS) {
    result.checked += 1;
    if (!existsSync(join(root, doc))) fail(result, `Missing mandatory governance document: ${doc}`);
  }

  const standardPath = join(root, 'docs', '21-mandatory-module-architecture-and-gates.md');
  if (existsSync(standardPath)) {
    const standard = readUtf8(standardPath);
    for (const marker of REQUIRED_STANDARD_MARKERS) {
      result.checked += 1;
      if (!standard.includes(marker)) fail(result, `Governance standard is missing marker: ${marker}`);
    }
  }

  const packagePath = join(root, 'package.json');
  if (!existsSync(packagePath)) {
    fail(result, 'Missing package.json');
    return result;
  }

  const pkg = JSON.parse(readUtf8(packagePath)) as { scripts?: Record<string, string> };
  for (const script of REQUIRED_SCRIPTS) {
    result.checked += 1;
    if (!pkg.scripts?.[script]) fail(result, `package.json is missing required script: ${script}`);
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  printAndExit('docs:audit', verifyDocsAudit(process.cwd()));
}
