import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createResult, fail, gitStatusShort, isCliEntrypoint, printAndExit, readUtf8, type VerificationResult } from './common.js';

export interface AiComplianceOptions {
  requireEvidence?: boolean;
  requireCleanGit?: boolean;
}

const REQUIRED_GATES = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'] as const;
const REQUIRED_COMMANDS = [
  'pnpm build',
  'pnpm test',
  'pnpm lint',
  'pnpm arch:verify',
  'pnpm migration:verify',
  'pnpm flow-contracts:verify',
  'pnpm docs:audit',
  'pnpm docs:parity',
  'pnpm governance:tamper-check',
  'pnpm ai-compliance:verify',
  'git status --short',
] as const;

function claimsPass(text: string): boolean {
  return /\bPASS\b|100%|مكتمل|جاهز/.test(text);
}

export function verifyAiCompliance(root = process.cwd(), options: AiComplianceOptions = {}): VerificationResult {
  const result = createResult();
  const requireEvidence = options.requireEvidence ?? false;
  const requireCleanGit = options.requireCleanGit ?? true;
  const evidenceRoot = join(root, 'docs', 'ai-execution-evidence');

  if (!existsSync(evidenceRoot)) {
    if (requireEvidence) fail(result, 'Missing docs/ai-execution-evidence directory');
    return result;
  }

  const evidenceFiles = readdirSync(evidenceRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name.toLowerCase() !== 'readme.md')
    .map((entry) => join(evidenceRoot, entry.name));

  result.checked = evidenceFiles.length;
  if (requireEvidence && evidenceFiles.length === 0) fail(result, 'No AI execution evidence files found');

  for (const file of evidenceFiles) {
    const text = readUtf8(file);
    const mustProve = claimsPass(text);
    if (!mustProve) continue;

    for (const gate of REQUIRED_GATES) {
      if (!new RegExp(`${gate}\\b`).test(text)) fail(result, `${file} claims success but does not include ${gate}`);
    }

    for (const command of REQUIRED_COMMANDS) {
      if (!text.includes(command)) fail(result, `${file} claims success but does not include command evidence: ${command}`);
    }
  }

  if (requireCleanGit) {
    const status = gitStatusShort(root);
    if (status.length > 0) fail(result, `Working tree is not clean:\n${status}`);
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  printAndExit('ai-compliance:verify', verifyAiCompliance(process.cwd(), { requireEvidence: true, requireCleanGit: true }));
}
