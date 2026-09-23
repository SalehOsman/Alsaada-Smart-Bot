import { isCliEntrypoint } from '../governance/common.js';
import {
  createUnlockChallenge,
  getPendingUnlockChallenge,
  consumeUnlockChallenge,
} from '../governance/unlock-challenge-engine.js';
import { verifyTranscriptProvenance } from '../governance/verify-transcript-provenance.js';
import { unlockEntity } from '../governance/unified-unlock-engine.js';

export function runUnlockCli(argv = process.argv.slice(2), root = process.cwd()): void {
  // Check for abolished --phrase argument (Anti-Self-Authorization Guard - WP 90)
  if (argv.some((a) => a.startsWith('--phrase') || a === '-p')) {
    console.error('');
    console.error('🚨 [FATAL GOVERNANCE BREACH: AI SELF-AUTHORIZATION PREVENTED]');
    console.error('   The "--phrase" CLI argument has been PERMANENTLY ABOLISHED per Work Plan 90.');
    console.error('   AI agents are strictly forbidden from passing approval phrases via CLI.');
    console.error('   Approval cannot be pre-authorized or copied from documentation.');
    console.error('');
    console.error('   Mandatory Dynamic OTP Challenge-Response Workflow:');
    console.error('   1. Request OTP challenge:');
    console.error('      pnpm unlock:request <target> --reason="<justification>"');
    console.error('   2. STOP execution and ask Saleh in chat for approval:');
    console.error('      "يرجى التكرم باعتماد فك القفل للكيان [entityId] بكتابة:');
    console.error('       موافق على الفتح <UNLOCK-XXXXXX>"');
    console.error('   3. Once Saleh replies in chat, confirm unlock:');
    console.error('      pnpm unlock:confirm <target>');
    console.error('');
    process.exit(1);
  }

  // Check for prohibited unlock-all attempts
  if (argv.some((a) => a === '--all' || a === 'all' || a === 'unlock:all' || a.includes('all'))) {
    console.error('');
    console.error('🚨 [FATAL CONSTITUTIONAL BREACH: UNLOCK-ALL IS STRICTLY PROHIBITED]');
    console.error('   Mass unlocking (unlock:all) is permanently forbidden.');
    console.error('   Unlocking is strictly granular per entity via dynamic OTP challenge.');
    console.error('');
    process.exit(1);
  }

  const positionalArgs = argv.filter((a) => !a.startsWith('--'));
  const firstArg = positionalArgs[0] ?? '';

  let action: 'request' | 'confirm' | null = null;
  let target: string = '';

  if (firstArg === 'request') {
    action = 'request';
    target = positionalArgs[1] ?? '';
  } else if (firstArg === 'confirm') {
    action = 'confirm';
    target = positionalArgs[1] ?? '';
  } else if (firstArg) {
    // If user ran: pnpm unlock <target> --reason="..."
    // Infer action based on flags
    const hasReason = argv.some((a) => a.startsWith('--reason='));
    target = firstArg;
    if (hasReason) {
      action = 'request';
    } else {
      // Check if a pending challenge already exists for this target
      const pendingCheck = getPendingUnlockChallenge(target, { root });
      if (pendingCheck.ok && pendingCheck.challenge) {
        action = 'confirm';
      } else {
        action = 'request';
      }
    }
  }

  if (!action || !target) {
    console.log(`
🏛️ Al-Saada Smart Bot — Cryptographic Unlock CLI (Work Plan 90)

Usage:
  pnpm unlock:request <target> --reason="<justification>"
  pnpm unlock:confirm <target>

Workflow:
  1. Generate OTP challenge:
     pnpm unlock:request package:regional-engine --reason="Upgrade currency support"
  2. The agent MUST STOP and request Saleh to send the phrase in chat:
     "موافق على الفتح UNLOCK-XXXXXX"
  3. Execute verification and unlock:
     pnpm unlock:confirm package:regional-engine
`);
    process.exit(1);
  }

  if (action === 'request') {
    const reasonArg = argv.find((a) => a.startsWith('--reason='));
    const reason = reasonArg ? reasonArg.replace('--reason=', '').trim() : '';

    if (!reason) {
      console.error('❌ Error: A detailed justification reason is mandatory.');
      console.error('   Usage: pnpm unlock:request <target> --reason="detailed justification (min 5 chars)"');
      process.exit(1);
    }

    const challengeRes = createUnlockChallenge(target, reason, { root });
    if (!challengeRes.ok || !challengeRes.challenge) {
      console.error(`❌ Failed to create unlock challenge: ${challengeRes.error}`);
      process.exit(1);
    }

    const c = challengeRes.challenge;
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════════════════════╗');
    console.log(`║ 🔐 UNLOCK CHALLENGE GENERATED FOR [${c.entityId.padEnd(46)}] ║`);
    console.log('╠══════════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ Target:       ${c.target.padEnd(66)} ║`);
    console.log(`║ Entity ID:    ${c.entityId.padEnd(66)} ║`);
    console.log(`║ OTP Nonce:    ${c.challengeNonce.padEnd(66)} ║`);
    console.log(`║ Expires In:   5 minutes (${c.expiresAt})                         ║`);
    console.log('╠══════════════════════════════════════════════════════════════════════════════════╣');
    console.log('║ 🛑 AGENT MANDATORY HARD STOP — DO NOT SELF-AUTHORIZE                             ║');
    console.log('║ 1. You MUST STOP execution immediately. Do not fabricate responses.             ║');
    console.log('║ 2. Request human authorization from Saleh in chat using the following text:      ║');
    console.log('║                                                                                  ║');
    console.log(`║    "يرجى التكرم باعتماد فك القفل للكيان ${c.entityId} بكتابة:                      ║`);
    console.log(`║     موافق على الفتح ${c.challengeNonce}"                                          ║`);
    console.log('║                                                                                  ║');
    console.log('║ 3. ONLY AFTER Saleh sends this message in chat, execute:                         ║');
    console.log(`║    pnpm unlock:confirm ${c.target.padEnd(58)} ║`);
    console.log('╚══════════════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    return;
  }

  if (action === 'confirm') {
    // 1. Check pending challenge
    const challengeRes = getPendingUnlockChallenge(target, { root });
    if (!challengeRes.ok || !challengeRes.challenge) {
      console.error(`❌ No active unlock challenge found: ${challengeRes.error}`);
      console.error(`   Please run "pnpm unlock:request ${target} --reason='...'" first.`);
      process.exit(1);
    }

    const challenge = challengeRes.challenge;

    // 2. Forensically verify transcript provenance
    console.log(`🔍 Verifying transcript provenance for challenge [${challenge.challengeNonce}]...`);
    const provRes = verifyTranscriptProvenance(challenge, { root });

    if (!provRes.ok) {
      console.error('');
      console.error('❌ FORENSIC VERIFICATION FAILED:');
      console.error(`   ${provRes.error}`);
      if (provRes.fraudDetected) {
        console.error('');
        console.error('🚨 [FRAUD DETECTED]: AI Agent attempted to fabricate or self-authorize approval.');
        console.error('   Action rejected. The incident will be logged.');
      }
      console.error('');
      process.exit(1);
    }

    // 3. Unlock entity
    console.log(`🔓 Unlocking target "${challenge.entityId}" with verified human approval...`);
    const unlockRes = unlockEntity(target, {
      phrase: provRes.phrase!,
      reason: challenge.reason,
      root,
      challengeNonce: challenge.challengeNonce,
      userTimestamp: provRes.userTimestamp,
      verifiedBy: 'USER_EXPLICIT',
    });

    if (!unlockRes.ok) {
      console.error(`❌ Unlock failed: ${unlockRes.error}`);
      process.exit(1);
    }

    // 4. Invalidate challenge (Anti-Replay)
    consumeUnlockChallenge(challenge.challengeNonce, { root });

    console.log('');
    console.log(`✅ Successfully unlocked [${unlockRes.entityId}]!`);
    console.log(`   OTP Challenge:  ${challenge.challengeNonce}`);
    console.log(`   Approved By:    USER_EXPLICIT (Saleh) at ${provRes.userTimestamp}`);
    console.log(`   Evidence File:  ${unlockRes.evidenceFile}`);
    console.log('   🔒 Zero Blast Radius: All other entities in the monorepo remain 100% locked.');
    console.log('');
  }
}

if (isCliEntrypoint(import.meta.url)) {
  runUnlockCli();
}
