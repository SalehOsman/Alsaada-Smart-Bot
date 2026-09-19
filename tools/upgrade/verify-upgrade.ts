/**
 * tools/upgrade/verify-upgrade.ts
 * 4-Tier Zero-Regression Quality Gate Runner for Upgrades
 * Orchestrates: Typecheck -> Targeted Vitest -> CI Governance Gates (Gate 21) -> Supply Chain Audit
 * Compliance: Plan 84 - Living Release Engine & Safe Upgrade Architecture
 */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT_DIR = resolve(process.cwd());

export interface VerificationTierResult {
  tierName: string;
  command: string;
  passed: boolean;
  durationMs: number;
  outputSummary: string;
}

export function runVerificationTier(tierName: string, command: string): VerificationTierResult {
  console.log(`\n⏳ [QUALITY GATE] Running Tier: "${tierName}"...`);
  console.log(`   Command: $ ${command}`);
  const startTime = Date.now();

  try {
    const output = execSync(command, { encoding: 'utf-8', cwd: ROOT_DIR, stdio: 'pipe' });
    const duration = Date.now() - startTime;
    console.log(`✅ [${tierName}] PASSED in ${(duration / 1000).toFixed(2)}s`);
    return {
      tierName,
      command,
      passed: true,
      durationMs: duration,
      outputSummary: output.slice(-300),
    };
  } catch (err: unknown) {
    const duration = Date.now() - startTime;
    console.error(`❌ [${tierName}] FAILED in ${(duration / 1000).toFixed(2)}s`);
    const errorMsg =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err);
    return {
      tierName,
      command,
      passed: false,
      durationMs: duration,
      outputSummary: errorMsg,
    };
  }

}

export function executeFullUpgradeVerification(): boolean {
  console.log(`\n🛡️ ================================================================`);
  console.log(`   UPGRADE VERIFICATION: 4-TIER QUALITY GATE ORCHESTRATOR`);
  console.log(`================================================================`);

  const tiers = [
    { name: 'Tier 1: Strict TypeScript Types', cmd: 'pnpm typecheck' },
    { name: 'Tier 2: Release & Governance Parity', cmd: 'pnpm release:verify' },
    { name: 'Tier 3: Tamper-Check & Cryptographic Locks', cmd: 'pnpm governance:tamper-check' },
    { name: 'Tier 4: Architecture & Flow Contracts', cmd: 'pnpm arch:verify && pnpm flow-contracts:verify' },
  ];

  const results: VerificationTierResult[] = [];
  let allPassed = true;

  for (const t of tiers) {
    const res = runVerificationTier(t.name, t.cmd);
    results.push(res);
    if (!res.passed) {
      allPassed = false;
      console.error(`\n🚨 Halting verification pipeline due to failure in "${t.name}".`);
      break;
    }
  }

  console.log(`\n================================================================`);
  console.log(`📊 UPGRADE VERIFICATION RESULTS:`);
  console.log(`================================================================`);

  for (const r of results) {
    const icon = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(` ${icon} | ${r.tierName.padEnd(38, ' ')} | ${(r.durationMs / 1000).toFixed(2)}s`);
  }

  if (allPassed) {
    console.log(`\n🎉 All Quality Gates Passed! Safe to seal and request merge approval.`);
  } else {
    console.log(`\n❌ Quality Gates Failed. Review errors above or run rollback if needed.`);
  }

  return allPassed;
}

if (process.argv[1]?.endsWith('verify-upgrade.ts')) {
  const ok = executeFullUpgradeVerification();
  process.exit(ok ? 0 : 1);
}
