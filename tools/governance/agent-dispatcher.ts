import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  createResult,
  fail,
  isCliEntrypoint,
  listFlowDirs,
  printAndExit,
  type VerificationResult,
} from './common.js';
import { verifyArchitecture } from './verify-architecture.js';
import { verifyMigrationRegistry } from './verify-migration-registry.js';
import { verifyFlowContracts } from './verify-flow-contracts.js';
import { verifyTelegramContracts } from './verify-telegram-contracts.js';
import { verifyDocsAudit } from './verify-docs-audit.js';
import { verifyDocsParity } from './verify-docs-parity.js';
import { verifyGovernanceTamper } from './verify-governance-tamper.js';
import { verifySsotPreflight } from './rag-engine.js';
import { verifyFlowFast } from './verify-flow-fast.js';
import { verifyAiCompliance, type AiComplianceOptions } from './verify-ai-compliance.js';

export interface AgentAuditOptions extends AiComplianceOptions {
  skipTypecheck?: boolean | undefined;
  skipTests?: boolean | undefined;
}

/**
 * Fast in-process verification check.
 * Executes all 7 core verifiers + SSOT preflight in < 400ms.
 * If target flow is provided, also validates flow fast contracts.
 */
export async function runAgentCheck(
  root?: string | undefined,
  target?: string | undefined,
): Promise<VerificationResult> {
  const currentRoot = root ?? process.cwd();
  const overall = createResult();

  const merge = (sub: VerificationResult): void => {
    if (!sub.ok) {
      overall.ok = false;
    }
    overall.checked += sub.checked;
    for (const f of sub.failures) {
      overall.failures.push(f);
    }
    for (const w of sub.warnings) {
      overall.warnings.push(w);
    }
  };

  // 1. In-process core governance verifiers
  merge(verifyArchitecture(currentRoot));
  merge(verifyMigrationRegistry(currentRoot));
  merge(verifyFlowContracts(currentRoot));
  merge(verifyTelegramContracts(currentRoot));
  merge(verifyDocsAudit(currentRoot));
  merge(verifyDocsParity(currentRoot));
  merge(verifyGovernanceTamper(currentRoot));

  // 2. SSOT Preflight verification & target-specific checks
  if (target) {
    const directPath = resolve(currentRoot, target);
    const flowDirs = listFlowDirs(currentRoot);
    const matchedDir = flowDirs.find((dir) => {
      const folder = dir.replace(/\\/g, '/').split('/').pop() ?? '';
      return (
        folder.toLowerCase().includes(target.toLowerCase()) ||
        dir.replace(/\\/g, '/').toLowerCase().includes(target.toLowerCase())
      );
    });

    if (!existsSync(directPath) && !matchedDir) {
      fail(overall, `[Flow Check] Could not find flow directory matching target: "${target}"`);
    } else {
      merge(verifyFlowFast({ flowPath: target, skipTests: true, root: currentRoot }));
    }

    overall.checked += 1;
    try {
      const preflight = verifySsotPreflight(target, currentRoot);
      if (!preflight.found) {
        fail(
          overall,
          `[SSOT Preflight] No SSOT documentation found for target "${target}": ${preflight.status}`,
        );
      }
    } catch (error) {
      fail(overall, `[SSOT Preflight] Preflight check failed for target "${target}": ${String(error)}`);
    }
  } else {
    overall.checked += 1;
    try {
      const preflight = verifySsotPreflight('00', currentRoot);
      if (!preflight.found) {
        fail(
          overall,
          `[SSOT Preflight] Baseline SSOT documentation check failed: ${preflight.status}`,
        );
      }
    } catch (error) {
      fail(overall, `[SSOT Preflight] Baseline documentation check failed: ${String(error)}`);
    }
  }

  return overall;
}

/**
 * Comprehensive verification audit.
 * Executes runAgentCheck + TypeScript typecheck + Vitest suite + AI compliance.
 */
export async function runAgentAudit(
  root?: string | undefined,
  options?: AgentAuditOptions | undefined,
): Promise<VerificationResult> {
  const currentRoot = root ?? process.cwd();
  const overall = await runAgentCheck(currentRoot);

  const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

  // 1. TypeScript compilation check (tsc --noEmit)
  if (!options?.skipTypecheck) {
    overall.checked += 1;
    try {
      execFileSync(pnpmCmd, ['typecheck'], {
        cwd: currentRoot,
        stdio: 'pipe',
        encoding: 'utf8',
        shell: true,
      });
    } catch (error) {
      const stderr =
        typeof error === 'object' && error && 'stderr' in error ? String(error.stderr) : '';
      const stdout =
        typeof error === 'object' && error && 'stdout' in error ? String(error.stdout) : '';
      fail(overall, `Typecheck failed:\n${stderr || stdout || String(error)}`);
    }
  }

  // 2. Automated test suite (vitest run)
  if (!options?.skipTests) {
    overall.checked += 1;
    try {
      execFileSync(pnpmCmd, ['test'], {
        cwd: currentRoot,
        stdio: 'pipe',
        encoding: 'utf8',
        shell: true,
      });
    } catch (error) {
      const stderr =
        typeof error === 'object' && error && 'stderr' in error ? String(error.stderr) : '';
      const stdout =
        typeof error === 'object' && error && 'stdout' in error ? String(error.stdout) : '';
      fail(overall, `Vitest tests failed:\n${stderr || stdout || String(error)}`);
    }
  }

  // 3. AI Compliance check (evidence files & clean git status)
  const requireEvidence = options?.requireEvidence ?? true;
  const requireCleanGit = options?.requireCleanGit ?? true;
  const compliance = verifyAiCompliance(currentRoot, { requireEvidence, requireCleanGit });
  if (!compliance.ok) {
    overall.ok = false;
  }
  overall.checked += compliance.checked;
  for (const f of compliance.failures) {
    overall.failures.push(f);
  }
  for (const w of compliance.warnings) {
    overall.warnings.push(w);
  }

  return overall;
}

export async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();
  const target = args[1];

  if (!command || command === '--help' || command === '-h') {
    console.log(`Agent Dispatcher CLI
Usage:
  tsx tools/governance/agent-dispatcher.ts check [target]
  tsx tools/governance/agent-dispatcher.ts audit
  pnpm agent:check [target]
  pnpm agent:audit
`);
    process.exit(0);
  }

  const start = performance.now();
  if (command === 'check') {
    const targetMsg = target ? ` for target: ${target}` : '';
    console.log(`[Agent Dispatcher] Running in-process agent:check${targetMsg}...`);
    const result = await runAgentCheck(process.cwd(), target);
    const elapsed = (performance.now() - start).toFixed(2);
    console.log(`[Agent Dispatcher] Completed in ${elapsed}ms`);
    printAndExit('agent:check', result);
  } else if (command === 'audit') {
    console.log('[Agent Dispatcher] Running full agent:audit scorecard...');
    const result = await runAgentAudit(process.cwd());
    const elapsed = (performance.now() - start).toFixed(2);
    console.log(`[Agent Dispatcher] Completed in ${elapsed}ms`);
    printAndExit('agent:audit', result);
  } else {
    console.error(`[Agent Dispatcher] Unknown command "${command}". Expected "check" or "audit".`);
    process.exit(1);
  }
}

if (isCliEntrypoint(import.meta.url)) {
  void runCli();
}
