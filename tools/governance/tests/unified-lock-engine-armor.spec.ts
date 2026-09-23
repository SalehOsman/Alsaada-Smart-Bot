import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveLockTarget } from '../unified-lock-engine.js';
import {
  buildGovernanceLock,
  type GovernanceLock,
} from '../verify-governance-lock.js';
import { createUnlockChallenge, clearPendingUnlockChallenge } from '../unlock-challenge-engine.js';
import {
  registerActiveGovernanceUnlock,
  isPathAuthorizedByActiveUnlock,
  consumeActiveGovernanceUnlockForPath,
  clearActiveGovernanceUnlocks,
  isProtectedGovernancePath,
} from '../governance-unlock-session.js';

describe('Work Plan 100 — Cryptographic Lock Physical Armor & Governance Unlock Engine', () => {
  beforeEach(() => {
    clearPendingUnlockChallenge();
    clearActiveGovernanceUnlocks();
  });

  afterEach(() => {
    clearPendingUnlockChallenge();
    clearActiveGovernanceUnlocks();
  });

  describe('1. Governance Target Resolution & Protection Identification', () => {
    it('identifies canonical governance files and directories as protected', () => {
      expect(isProtectedGovernancePath('GEMINI.md')).toBe(true);
      expect(isProtectedGovernancePath('AGENTS.md')).toBe(true);
      expect(isProtectedGovernancePath('package.json')).toBe(true);
      expect(isProtectedGovernancePath('tools/governance/unified-lock-engine.ts')).toBe(true);
      expect(isProtectedGovernancePath('.githooks/pre-commit')).toBe(true);
      expect(
        isProtectedGovernancePath('.agents/rules/10-ai-agent-discipline-and-preflight.md')
      ).toBe(true);

      // Non-protected paths
      expect(isProtectedGovernancePath('src/index.ts')).toBe(false);
      expect(isProtectedGovernancePath('modules/workforce/src/flows/01.1/controller.ts')).toBe(
        false
      );
      expect(isProtectedGovernancePath('docs/work-plans/100-plan.md')).toBe(false);
    });

    it('resolves governance file paths to governance:* lock targets', () => {
      const resGemini = resolveLockTarget(process.cwd(), 'GEMINI.md');
      expect(resGemini).not.toBeNull();
      expect(resGemini?.id).toBe('governance:GEMINI.md');
      expect(resGemini?.type).toBe('infra');

      const resEngine = resolveLockTarget(
        process.cwd(),
        'tools/governance/unified-lock-engine.ts'
      );
      expect(resEngine).not.toBeNull();
      expect(resEngine?.id).toBe('governance:tools/governance/unified-lock-engine.ts');

      const resExplicit = resolveLockTarget(process.cwd(), 'governance:GEMINI.md');
      expect(resExplicit).not.toBeNull();
      expect(resExplicit?.id).toBe('governance:GEMINI.md');
    });
  });

  describe('2. Dynamic OTP Unlock Challenge for Governance Targets', () => {
    it('creates a valid OTP challenge for protected governance target', () => {
      const result = createUnlockChallenge(
        'GEMINI.md',
        'Work Plan 100: Updating constitutional lock armor specification'
      );

      expect(result.ok).toBe(true);
      expect(result.challenge).toBeDefined();
      expect(result.challenge?.challengeNonce).toMatch(/^UNLOCK-[A-F0-9]{6}$/);
      expect(result.challenge?.entityId).toBe('governance:GEMINI.md');
      expect(result.challenge?.status).toBe('PENDING');
    });

    it('creates a valid OTP challenge for tools/governance target', () => {
      const result = createUnlockChallenge(
        'tools/governance/unified-lock-engine.ts',
        'Work Plan 100: Installing physical armor checks'
      );

      expect(result.ok).toBe(true);
      expect(result.challenge?.entityId).toBe(
        'governance:tools/governance/unified-lock-engine.ts'
      );
    });
  });

  describe('3. Governance Unlock Session Store Lifecycle', () => {
    it('registers, checks, and consumes active governance unlock sessions', () => {
      expect(isPathAuthorizedByActiveUnlock('GEMINI.md')).toBe(false);

      registerActiveGovernanceUnlock({
        entityId: 'governance:GEMINI.md',
        target: 'GEMINI.md',
        challengeNonce: 'UNLOCK-TEST01',
        unlockedAt: new Date().toISOString(),
        allowedPaths: ['GEMINI.md'],
      });

      expect(isPathAuthorizedByActiveUnlock('GEMINI.md')).toBe(true);
      expect(isPathAuthorizedByActiveUnlock('AGENTS.md')).toBe(false);

      const consumed = consumeActiveGovernanceUnlockForPath('GEMINI.md');
      expect(consumed).toBe(true);
      expect(isPathAuthorizedByActiveUnlock('GEMINI.md')).toBe(false);
    });

    it('authorizes all files under a directory when directory is unlocked', () => {
      registerActiveGovernanceUnlock({
        entityId: 'governance:tools/governance',
        target: 'tools/governance',
        challengeNonce: 'UNLOCK-DIR001',
        unlockedAt: new Date().toISOString(),
        allowedPaths: ['tools/governance'],
      });

      expect(
        isPathAuthorizedByActiveUnlock('tools/governance/unified-lock-engine.ts')
      ).toBe(true);
      expect(
        isPathAuthorizedByActiveUnlock('tools/governance/verify-governance-lock.ts')
      ).toBe(true);
      expect(isPathAuthorizedByActiveUnlock('tools/scaffold/lock.ts')).toBe(false);
    });
  });

  describe('4. Physical Lock Armor Against Unauthorized Sealing', () => {
    it('throws critical governance breach when a protected file hash changes without active session', () => {
      const fakeLock: GovernanceLock = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        approvalPhrase: 'موافق على التعديل او الايقاف او الحذف',
        protectedPaths: {
          files: ['GEMINI.md'],
          directories: ['tools/governance'],
        },
        files: [
          {
            path: 'GEMINI.md',
            sha256: '0000000000000000000000000000000000000000000000000000000000000000',
          },
        ],
      };

      expect(() => {
        buildGovernanceLock(process.cwd(), undefined, fakeLock);
      }).toThrow(/CRITICAL GOVERNANCE BREACH: UNAUTHORIZED PROTECTED ENTITY MODIFICATION/);
    });

    it('permits hash update when file has an active authorized unlock session', () => {
      const fakeLock: GovernanceLock = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        approvalPhrase: 'موافق على التعديل او الايقاف او الحذف',
        protectedPaths: {
          files: ['GEMINI.md'],
          directories: [],
        },
        files: [
          {
            path: 'GEMINI.md',
            sha256: '0000000000000000000000000000000000000000000000000000000000000000',
          },
        ],
      };

      registerActiveGovernanceUnlock({
        entityId: 'governance:GEMINI.md',
        target: 'GEMINI.md',
        challengeNonce: 'UNLOCK-AUTH01',
        unlockedAt: new Date().toISOString(),
        allowedPaths: ['GEMINI.md'],
      });

      const lock = buildGovernanceLock(process.cwd(), undefined, fakeLock);
      expect(lock).toBeDefined();
      const geminiEntry = lock.files.find((f) => f.path === 'GEMINI.md');
      expect(geminiEntry).toBeDefined();
      expect(geminiEntry?.sha256).not.toBe(
        '0000000000000000000000000000000000000000000000000000000000000000'
      );
    });

    it('permits hash update when allowProtectedModifications option is true', () => {
      const fakeLock: GovernanceLock = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        approvalPhrase: 'موافق على التعديل او الايقاف او الحذف',
        protectedPaths: {
          files: ['GEMINI.md'],
          directories: [],
        },
        files: [
          {
            path: 'GEMINI.md',
            sha256: '0000000000000000000000000000000000000000000000000000000000000000',
          },
        ],
      };

      const lock = buildGovernanceLock(process.cwd(), undefined, fakeLock, {
        allowProtectedModifications: true,
      });
      expect(lock).toBeDefined();
    });
  });
});
