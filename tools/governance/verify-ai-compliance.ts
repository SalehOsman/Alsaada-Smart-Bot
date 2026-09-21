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
    const base = file.replace(/\\/g, '/').split('/').pop() ?? '';
    const text = readUtf8(file);

    // Anti-Self-Authorization Check for Unlock Evidence (Work Plan 90)
    if (/^\d{4}-\d{2}-\d{2}-unlock-/.test(base)) {
      const dateMatch = base.match(/^(\d{4}-\d{2}-\d{2})/);
      const dateStr = dateMatch?.[1] ?? '';
      if (dateStr >= '2026-09-21') {
        const hasOtpNonce = /رمز التحدي|OTP Nonce|UNLOCK-[A-F0-9]+/i.test(text);
        const hasHumanProvenance = /USER_EXPLICIT|مصدر الاعتماد|التحقق الجنائي/i.test(text);
        if (!hasOtpNonce || !hasHumanProvenance) {
          fail(
            result,
            `Unlock evidence [${base}] lacks human OTP challenge provenance (Work Plan 90 violation).`
          );
        }
      }
      continue;
    }

    // Exclude non-gate documentation: lock receipts, authorization records, release notes, walkthroughs, audits, inventories, plans, and assessments
    const isExcludedDoc =
      /^\d{4}-\d{2}-\d{2}-lock-/.test(base) ||
      /^\d{4}-\d{2}-\d{2}-unlock-/.test(base) ||
      base.includes('walkthrough') ||
      base.includes('authorized') ||
      base.includes('release-scripts') ||
      base.includes('audit') ||
      base.includes('inventory') ||
      base.includes('assessment') ||
      base.includes('dashboard-') ||
      base.includes('report') ||
      base.includes('plan-') ||
      base.startsWith('p00-');

    if (isExcludedDoc) {
      continue;
    }

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
  const requireCleanGit = process.argv.includes('--clean-git');
  printAndExit('ai-compliance:verify', verifyAiCompliance(process.cwd(), { requireEvidence: true, requireCleanGit }));
}
