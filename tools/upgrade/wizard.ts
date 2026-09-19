/**
 * tools/upgrade/wizard.ts
 * Interactive Guided CLI Wizard for Enterprise Upgrades
 * Fuses Impact Scanning, Snapshot Creation, Atomic Release Bump, and Quality Gates.
 * Compliance: Plan 84 - Living Release Engine & Safe Upgrade Architecture
 */

import { resolve } from 'node:path';
import { scanRepositoryImpact, printImpactReport } from './impact-scanner.js';
import { createUpgradeSnapshot } from './rollback-manager.js';
import { executeAtomicReleaseBump, detectActivePlanNumber } from '../release/release-engine.js';
import { executeFullUpgradeVerification } from './verify-upgrade.js';

export function runUpgradeWizard(): void {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  const targetIdx = args.indexOf('--target');
  const target = targetIdx !== -1 ? args[targetIdx + 1] : undefined;

  const planIdx = args.indexOf('--plan');
  const planVal = planIdx !== -1 ? args[planIdx + 1] : undefined;
  const planArg = planVal !== undefined ? parseInt(planVal, 10) : undefined;
  const activePlan = planArg || detectActivePlanNumber() || 84;


  console.log(`\n================================================================`);
  console.log(`🧙‍♂️ [AL-SAADA ENTERPRISE UPGRADE WIZARD]`);
  console.log(`   Mode: ${isDryRun ? '🔍 SIMULATION / DRY-RUN' : '🚀 LIVE EXECUTION'}`);
  console.log(`   Active Work Plan: Plan ${activePlan}`);
  console.log(`================================================================\n`);

  // Step 1: Impact Scanning
  if (target) {
    console.log(`📍 STEP 1: Multi-Vector Blast Radius & Flow Impact Analysis`);
    const impactReport = scanRepositoryImpact(target);
    printImpactReport(impactReport);
  } else {
    console.log(`ℹ️  No specific target package provided with --target.`);
    console.log(`   Proceeding with repository-wide release synchronization.\n`);
  }

  // Step 2: Snapshot Anchor
  console.log(`📍 STEP 2: Instant Disaster Recovery Snapshot`);
  if (!isDryRun) {
    createUpgradeSnapshot();
  } else {
    console.log(`🔍 [DRY-RUN] Would create Git/Lockfile recovery snapshot in .upgrades/snapshots/\n`);
  }

  // Step 3: Atomic Release Bump & Changelog
  console.log(`📍 STEP 3: Atomic Living Release Bump & Governance Sealing`);
  executeAtomicReleaseBump({
    planNumber: activePlan,
    dryRun: isDryRun,
  });

  // Step 4: Quality Gate Verification
  console.log(`\n📍 STEP 4: 4-Tier Zero-Regression Quality Gate Verification`);
  if (!isDryRun) {
    const verified = executeFullUpgradeVerification();
    if (!verified) {
      console.error(`\n🚨 Verification failed! Please inspect logs above.`);
      process.exit(1);
    }
  } else {
    console.log(`🔍 [DRY-RUN] Simulation completed successfully with zero file mutations.`);
  }

  console.log(`\n🎉 [WIZARD FINISHED] Upgrade and release synchronization completed!`);
}

if (process.argv[1]?.endsWith('wizard.ts')) {
  runUpgradeWizard();
}
