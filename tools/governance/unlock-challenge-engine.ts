import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveLockTarget } from './unified-lock-engine.js';
import { GOVERNANCE_LOCK_PATH, type GovernanceLock } from './verify-governance-lock.js';

export const PENDING_UNLOCK_FILE = '.governance-cache/pending-unlock.json';
export const DEFAULT_CHALLENGE_TTL_MS = 300_000; // 5 minutes (300 seconds)

const SECRET_SALT = 'ALSAADA_GOVERNANCE_CHALLENGE_SALT_2026_WP90';

export interface PendingUnlockChallenge {
  target: string;
  entityId: string;
  reason: string;
  challengeNonce: string; // e.g. "UNLOCK-A4F1E2"
  createdAt: string; // ISO 8601
  expiresAt: string; // ISO 8601
  status: 'PENDING' | 'CONSUMED' | 'EXPIRED';
  signature: string;
}

export interface CreateChallengeResult {
  ok: boolean;
  challenge?: PendingUnlockChallenge;
  error?: string;
}

export interface GetChallengeResult {
  ok: boolean;
  challenge?: PendingUnlockChallenge;
  error?: string;
}

export function generateUnlockNonce(): string {
  const hex = randomBytes(3).toString('hex').toUpperCase();
  return `UNLOCK-${hex}`;
}

export function computeChallengeSignature(data: {
  target: string;
  entityId: string;
  reason: string;
  challengeNonce: string;
  createdAt: string;
  expiresAt: string;
  status: string;
}): string {
  const payload = `${SECRET_SALT}:${data.target}:${data.entityId}:${data.reason}:${data.challengeNonce}:${data.createdAt}:${data.expiresAt}:${data.status}`;
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

export function createUnlockChallenge(
  rawTarget: string,
  rawReason: string,
  options: { root?: string; ttlMs?: number; customNonce?: string } = {}
): CreateChallengeResult {
  const root = options.root ?? process.cwd();
  const target = (rawTarget ?? '').trim();
  const reason = (rawReason ?? '').trim();

  if (!target) {
    return { ok: false, error: 'Target component is required to request an unlock challenge.' };
  }

  if (!reason || reason.length < 5) {
    return {
      ok: false,
      error: 'A detailed justification reason (minimum 5 characters) is required to request an unlock challenge.',
    };
  }

  // Verify that the entity exists and is actually locked in governance.lock.json
  const lockPath = join(root, GOVERNANCE_LOCK_PATH);
  if (!existsSync(lockPath)) {
    return { ok: false, error: 'governance.lock.json does not exist.' };
  }

  let lockData: GovernanceLock & { lockedEntities?: Record<string, unknown> };
  try {
    lockData = JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch {
    return { ok: false, error: 'Failed to read/parse governance.lock.json' };
  }

  const lockedEntities = lockData.lockedEntities ?? {};
  let entityId: string | null = null;

  if (lockedEntities[target]) {
    entityId = target;
  } else {
    const resolved = resolveLockTarget(root, target);
    if (resolved && lockedEntities[resolved.id]) {
      entityId = resolved.id;
    } else if (resolved) {
      entityId = resolved.id;
    }
  }

  // Check legacy locks or governance targets if not found in lockedEntities
  if (!entityId || !lockedEntities[entityId]) {
    const isLegacyFlow =
      lockData.lockedFlows &&
      Object.keys(lockData.lockedFlows).includes(target.replace(/^flow:/, ''));
    const isLegacyDash =
      lockData.lockedDashboardFeatures &&
      Object.keys(lockData.lockedDashboardFeatures).includes(target.replace(/^dashboard:/, ''));
    const isGov = entityId && entityId.startsWith('governance:');

    if (isGov) {
      // Governance target recognized
    } else if (isLegacyFlow) {
      entityId = `flow:${target.replace(/^flow:/, '')}`;
    } else if (isLegacyDash) {
      entityId = `dashboard:${target.replace(/^dashboard:/, '')}`;
    } else {
      return {
        ok: false,
        error: `Entity "${target}" is not currently locked in governance.lock.json.`,
      };
    }
  }

  if (!entityId) {
    return {
      ok: false,
      error: `Could not resolve a locked entity ID for target "${target}".`,
    };
  }

  const now = new Date();
  const ttl = options.ttlMs ?? DEFAULT_CHALLENGE_TTL_MS;
  const expiresAt = new Date(now.getTime() + ttl);
  const challengeNonce = options.customNonce ?? generateUnlockNonce();

  const challengeData = {
    target,
    entityId,
    reason,
    challengeNonce,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'PENDING' as const,
  };

  const signature = computeChallengeSignature(challengeData);
  const challenge: PendingUnlockChallenge = {
    ...challengeData,
    signature,
  };

  // Save to .governance-cache/pending-unlock.json
  const cacheDir = join(root, '.governance-cache');
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }

  const cacheFilePath = join(root, PENDING_UNLOCK_FILE);
  try {
    writeFileSync(cacheFilePath, JSON.stringify(challenge, null, 2) + '\n', 'utf8');
  } catch (err) {
    return { ok: false, error: `Failed to write pending unlock file: ${String(err)}` };
  }

  return { ok: true, challenge };
}

export function getPendingUnlockChallenge(
  rawTarget?: string,
  options: { root?: string; now?: Date } = {}
): GetChallengeResult {
  const root = options.root ?? process.cwd();
  const cacheFilePath = join(root, PENDING_UNLOCK_FILE);

  if (!existsSync(cacheFilePath)) {
    return {
      ok: false,
      error: 'No pending unlock challenge found. Run "pnpm unlock:request <target> --reason=..." first.',
    };
  }

  let challenge: PendingUnlockChallenge;
  try {
    challenge = JSON.parse(readFileSync(cacheFilePath, 'utf8'));
  } catch {
    return { ok: false, error: 'Corrupted pending unlock file in .governance-cache.' };
  }

  // Verify signature integrity against tampering
  const expectedSig = computeChallengeSignature({
    target: challenge.target,
    entityId: challenge.entityId,
    reason: challenge.reason,
    challengeNonce: challenge.challengeNonce,
    createdAt: challenge.createdAt,
    expiresAt: challenge.expiresAt,
    status: challenge.status,
  });

  if (challenge.signature !== expectedSig) {
    return {
      ok: false,
      error: 'Cryptographic signature mismatch in pending unlock challenge. Tampering detected.',
    };
  }

  // Verify status
  if (challenge.status !== 'PENDING') {
    return {
      ok: false,
      error: `Pending unlock challenge is already ${challenge.status}. Request a new challenge.`,
    };
  }

  // Verify expiration
  const checkTime = options.now ?? new Date();
  const expiresAt = new Date(challenge.expiresAt);
  if (checkTime > expiresAt) {
    // Mark as expired
    challenge.status = 'EXPIRED';
    challenge.signature = computeChallengeSignature(challenge);
    try {
      writeFileSync(cacheFilePath, JSON.stringify(challenge, null, 2) + '\n', 'utf8');
    } catch {
      // ignore
    }
    return {
      ok: false,
      error: `Unlock challenge ${challenge.challengeNonce} expired at ${challenge.expiresAt}. You must generate a new challenge.`,
    };
  }

  // If target specified, verify match
  if (rawTarget) {
    const trimmed = rawTarget.trim();
    const resolved = resolveLockTarget(root, trimmed);
    const resolvedId = resolved?.id ?? trimmed;

    const matchesTarget = challenge.target === trimmed || challenge.entityId === trimmed;
    const matchesResolved = challenge.entityId === resolvedId || challenge.target === resolvedId;

    if (!matchesTarget && !matchesResolved) {
      return {
        ok: false,
        error: `Active pending challenge is for "${challenge.entityId}", not "${rawTarget}".`,
      };
    }
  }

  return { ok: true, challenge };
}

export function consumeUnlockChallenge(
  challengeNonce: string,
  options: { root?: string } = {}
): boolean {
  const root = options.root ?? process.cwd();
  const cacheFilePath = join(root, PENDING_UNLOCK_FILE);

  if (!existsSync(cacheFilePath)) return false;

  let challenge: PendingUnlockChallenge;
  try {
    challenge = JSON.parse(readFileSync(cacheFilePath, 'utf8'));
  } catch {
    return false;
  }

  if (challenge.challengeNonce !== challengeNonce) return false;

  challenge.status = 'CONSUMED';
  challenge.signature = computeChallengeSignature(challenge);

  try {
    // Write consumed state then remove file to prevent replay
    writeFileSync(cacheFilePath, JSON.stringify(challenge, null, 2) + '\n', 'utf8');
    unlinkSync(cacheFilePath);
    return true;
  } catch {
    return false;
  }
}

export function clearPendingUnlockChallenge(options: { root?: string } = {}): void {
  const root = options.root ?? process.cwd();
  const cacheFilePath = join(root, PENDING_UNLOCK_FILE);
  if (existsSync(cacheFilePath)) {
    try {
      unlinkSync(cacheFilePath);
    } catch {
      // ignore
    }
  }
}
