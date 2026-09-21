import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearPendingUnlockChallenge,
  computeChallengeSignature,
  consumeUnlockChallenge,
  createUnlockChallenge,
  generateUnlockNonce,
  getPendingUnlockChallenge,
  PENDING_UNLOCK_FILE,
} from '../unlock-challenge-engine.js';
import { verifyTranscriptProvenance } from '../verify-transcript-provenance.js';

describe('🏛️ Work Plan 90: Unlock Challenge & Transcript Provenance Engine', () => {
  let testRoot: string;
  let cacheDir: string;
  let lockFile: string;

  beforeEach(() => {
    testRoot = join(tmpdir(), `wp90-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    mkdirSync(testRoot, { recursive: true });

    cacheDir = join(testRoot, '.governance-cache');
    mkdirSync(cacheDir, { recursive: true });

    lockFile = join(testRoot, 'governance.lock.json');
    writeFileSync(
      lockFile,
      JSON.stringify(
        {
          version: '2.0.0',
          lockedEntities: {
            'package:regional-engine': {
              id: 'package:regional-engine',
              type: 'package',
              sha256: 'mock-sha',
            },
            'flow:01.1': {
              id: 'flow:01.1',
              type: 'flow',
              sha256: 'mock-sha',
            },
          },
        },
        null,
        2
      )
    );
  });

  afterEach(() => {
    try {
      rmSync(testRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('1. Nonce Generation & Validation', () => {
    it('generates a valid OTP challenge nonce with UNLOCK- prefix and hex characters', () => {
      const nonce = generateUnlockNonce();
      expect(nonce).toMatch(/^UNLOCK-[A-F0-9]{6}$/);
    });

    it('computes consistent cryptographic signatures', () => {
      const data = {
        target: 'package:regional-engine',
        entityId: 'package:regional-engine',
        reason: 'Upgrade currency support',
        challengeNonce: 'UNLOCK-ABC123',
        createdAt: '2026-09-21T12:00:00.000Z',
        expiresAt: '2026-09-21T12:05:00.000Z',
        status: 'PENDING',
      };
      const sig1 = computeChallengeSignature(data);
      const sig2 = computeChallengeSignature(data);
      expect(sig1).toBe(sig2);
      expect(sig1).toHaveLength(64); // SHA-256
    });
  });

  describe('2. Challenge Creation & Lifecycle', () => {
    it('rejects challenge creation when target is missing or reason is too short', () => {
      const resEmptyTarget = createUnlockChallenge('', 'Valid reason text', { root: testRoot });
      expect(resEmptyTarget.ok).toBe(false);
      expect(resEmptyTarget.error).toContain('Target component is required');

      const resShortReason = createUnlockChallenge('package:regional-engine', 'abc', {
        root: testRoot,
      });
      expect(resShortReason.ok).toBe(false);
      expect(resShortReason.error).toContain('minimum 5 characters');
    });

    it('rejects challenge creation for unlocked or nonexistent entities', () => {
      const resUnlocked = createUnlockChallenge('package:unknown-engine', 'Valid justification', {
        root: testRoot,
      });
      expect(resUnlocked.ok).toBe(false);
      expect(resUnlocked.error).toContain('not currently locked');
    });

    it('creates a signed challenge file with 300s TTL for a locked entity', () => {
      const res = createUnlockChallenge(
        'package:regional-engine',
        'Valid enterprise justification',
        { root: testRoot }
      );
      expect(res.ok).toBe(true);
      expect(res.challenge).toBeDefined();
      expect(res.challenge?.challengeNonce).toMatch(/^UNLOCK-[A-F0-9]{6}$/);
      expect(res.challenge?.status).toBe('PENDING');

      // Check file on disk
      const filePath = join(testRoot, PENDING_UNLOCK_FILE);
      expect(existsSync(filePath)).toBe(true);
      const saved = JSON.parse(readFileSync(filePath, 'utf8'));
      expect(saved.challengeNonce).toBe(res.challenge?.challengeNonce);
      expect(saved.signature).toBe(res.challenge?.signature);
    });

    it('detects tampering with the challenge file signature', () => {
      createUnlockChallenge('package:regional-engine', 'Valid enterprise justification', {
        root: testRoot,
      });
      const filePath = join(testRoot, PENDING_UNLOCK_FILE);
      const saved = JSON.parse(readFileSync(filePath, 'utf8'));

      // Tamper with reason without updating signature
      saved.reason = 'Tampered reason by rogue agent';
      writeFileSync(filePath, JSON.stringify(saved, null, 2));

      const getRes = getPendingUnlockChallenge('package:regional-engine', { root: testRoot });
      expect(getRes.ok).toBe(false);
      expect(getRes.error).toContain('signature mismatch');
    });

    it('rejects challenges that have exceeded their 300s TTL', () => {
      const now = new Date();
      createUnlockChallenge('package:regional-engine', 'Valid enterprise justification', {
        root: testRoot,
        ttlMs: 5000,
      });

      // Query after expiration (6 seconds later)
      const later = new Date(now.getTime() + 6000);
      const getRes = getPendingUnlockChallenge('package:regional-engine', {
        root: testRoot,
        now: later,
      });
      expect(getRes.ok).toBe(false);
      expect(getRes.error).toContain('expired');
    });

    it('prevents replay attacks by consuming the challenge upon use', () => {
      const createRes = createUnlockChallenge(
        'package:regional-engine',
        'Valid enterprise justification',
        { root: testRoot }
      );
      const nonce = createRes.challenge!.challengeNonce;

      // Consume challenge
      const consumed = consumeUnlockChallenge(nonce, { root: testRoot });
      expect(consumed).toBe(true);

      // Subsequent attempt to retrieve challenge must fail
      const getRes = getPendingUnlockChallenge('package:regional-engine', { root: testRoot });
      expect(getRes.ok).toBe(false);
      expect(getRes.error).toContain('No pending unlock challenge found');
    });
  });

  describe('3. Transcript Provenance & Anti-Self-Authorization Guard', () => {
    it('rejects verification if transcript file does not exist', () => {
      const createRes = createUnlockChallenge(
        'package:regional-engine',
        'Valid enterprise justification',
        { root: testRoot }
      );
      const res = verifyTranscriptProvenance(createRes.challenge!, {
        transcriptPath: join(testRoot, 'nonexistent-transcript.jsonl'),
      });
      expect(res.ok).toBe(false);
      expect(res.error).toContain('Could not locate');
    });

    it('rejects verification if user message contains phrase but lacks the OTP nonce', () => {
      const createRes = createUnlockChallenge(
        'package:regional-engine',
        'Valid enterprise justification',
        { root: testRoot }
      );
      const transcriptFile = join(testRoot, 'transcript.jsonl');
      const lines = [
        JSON.stringify({
          source: 'USER_EXPLICIT',
          type: 'USER_INPUT',
          created_at: new Date().toISOString(),
          content: 'موافق على الفتح', // Missing nonce!
        }),
      ];
      writeFileSync(transcriptFile, lines.join('\n'));

      const res = verifyTranscriptProvenance(createRes.challenge!, {
        transcriptPath: transcriptFile,
      });
      expect(res.ok).toBe(false);
      expect(res.error).toContain('No human user message (USER_EXPLICIT) found');
    });

    it('rejects verification if user message contains nonce but lacks the approval phrase', () => {
      const createRes = createUnlockChallenge(
        'package:regional-engine',
        'Valid enterprise justification',
        { root: testRoot }
      );
      const nonce = createRes.challenge!.challengeNonce;
      const transcriptFile = join(testRoot, 'transcript.jsonl');
      const lines = [
        JSON.stringify({
          source: 'USER_EXPLICIT',
          type: 'USER_INPUT',
          created_at: new Date().toISOString(),
          content: `Here is the code: ${nonce}`, // Missing approval phrase!
        }),
      ];
      writeFileSync(transcriptFile, lines.join('\n'));

      const res = verifyTranscriptProvenance(createRes.challenge!, {
        transcriptPath: transcriptFile,
      });
      expect(res.ok).toBe(false);
      expect(res.error).toContain('No human user message (USER_EXPLICIT) found');
    });

    it('forensically detects AI Self-Authorization when MODEL emits the phrase and nonce', () => {
      const createRes = createUnlockChallenge(
        'package:regional-engine',
        'Valid enterprise justification',
        { root: testRoot }
      );
      const nonce = createRes.challenge!.challengeNonce;
      const transcriptFile = join(testRoot, 'transcript.jsonl');
      const lines = [
        JSON.stringify({
          source: 'MODEL', // Emitted by AI model, not human!
          type: 'PLANNER_RESPONSE',
          created_at: new Date().toISOString(),
          content: `Executing self-approval: موافق على الفتح ${nonce}`,
        }),
      ];
      writeFileSync(transcriptFile, lines.join('\n'));

      const res = verifyTranscriptProvenance(createRes.challenge!, {
        transcriptPath: transcriptFile,
      });
      expect(res.ok).toBe(false);
      expect(res.fraudDetected).toBe(true);
      expect(res.error).toContain('FATAL: AI Self-Authorization Fraud Detected');
    });

    it('successfully verifies when human user provides phrase and OTP nonce', () => {
      const createRes = createUnlockChallenge(
        'package:regional-engine',
        'Valid enterprise justification',
        { root: testRoot }
      );
      const nonce = createRes.challenge!.challengeNonce;
      const transcriptFile = join(testRoot, 'transcript.jsonl');
      const nowIso = new Date().toISOString();
      const lines = [
        JSON.stringify({
          source: 'USER_EXPLICIT',
          type: 'USER_INPUT',
          created_at: nowIso,
          content: `موافق على الفتح ${nonce}`,
        }),
      ];
      writeFileSync(transcriptFile, lines.join('\n'));

      const res = verifyTranscriptProvenance(createRes.challenge!, {
        transcriptPath: transcriptFile,
      });
      expect(res.ok).toBe(true);
      expect(res.nonce).toBe(nonce);
      expect(res.phrase).toBe('موافق على الفتح');
      expect(res.userTimestamp).toBe(nowIso);
    });
  });
});
