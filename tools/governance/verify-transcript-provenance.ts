import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { PendingUnlockChallenge } from './unlock-challenge-engine.js';
import { VALID_UNLOCK_PHRASES } from './unified-unlock-engine.js';

export interface TranscriptEntry {
  step_index?: number;
  source?: string;
  type?: string;
  status?: string;
  created_at?: string;
  content?: string;
  thinking?: string;
  tool_calls?: Array<{ name: string; args: Record<string, unknown> }>;
}

export interface TranscriptVerificationResult {
  ok: boolean;
  userTimestamp?: string | undefined;
  phrase?: string | undefined;
  nonce?: string | undefined;
  userContent?: string | undefined;
  transcriptPath?: string | undefined;
  fraudDetected?: boolean | undefined;
  error?: string | undefined;
}

export interface VerifyTranscriptOptions {
  transcriptPath?: string;
  root?: string;
  brainDir?: string;
  now?: Date;
}

/**
 * Locate the active session transcript.jsonl file on disk
 */
export function findActiveTranscriptFile(options: VerifyTranscriptOptions = {}): string | null {
  // 1. Explicit options
  if (options.transcriptPath !== undefined) {
    return existsSync(options.transcriptPath) ? options.transcriptPath : null;
  }

  // 2. Environment variable
  if (process.env.TRANSCRIPT_PATH && existsSync(process.env.TRANSCRIPT_PATH)) {
    return process.env.TRANSCRIPT_PATH;
  }

  // 3. Local repo check (.system_generated/logs/transcript.jsonl)
  const root = options.root ?? process.cwd();
  const repoTranscript = join(root, '.system_generated', 'logs', 'transcript.jsonl');
  if (existsSync(repoTranscript)) {
    return repoTranscript;
  }

  // 4. Search antigravity brain sessions in user home
  const brainDir =
    options.brainDir ??
    process.env.GEMINI_BRAIN_DIR ??
    join(homedir(), '.gemini', 'antigravity', 'brain');

  if (existsSync(brainDir)) {
    try {
      const sessionDirs = readdirSync(brainDir)
        .map((dirName) => join(brainDir, dirName))
        .filter((dirPath) => {
          try {
            return statSync(dirPath).isDirectory();
          } catch {
            return false;
          }
        });

      // Find all transcript.jsonl files
      const candidateFiles: Array<{ path: string; mtime: number }> = [];
      for (const sDir of sessionDirs) {
        const candidate = join(sDir, '.system_generated', 'logs', 'transcript.jsonl');
        if (existsSync(candidate)) {
          try {
            const mtime = statSync(candidate).mtimeMs;
            candidateFiles.push({ path: candidate, mtime });
          } catch {
            // ignore
          }
        }
      }

      // Sort by newest first
      if (candidateFiles.length > 0) {
        candidateFiles.sort((a, b) => b.mtime - a.mtime);
        return candidateFiles[0]?.path ?? null;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Forensically verifies that the approval phrase and OTP nonce originate exclusively
 * from a human user (source: 'USER_EXPLICIT', type: 'USER_INPUT') in transcript.jsonl.
 */
export function verifyTranscriptProvenance(
  challenge: PendingUnlockChallenge,
  options: VerifyTranscriptOptions = {}
): TranscriptVerificationResult {
  const transcriptPath = findActiveTranscriptFile(options);

  if (!transcriptPath || !existsSync(transcriptPath)) {
    return {
      ok: false,
      fraudDetected: false,
      error:
        'Could not locate active session transcript.jsonl log to verify human provenance. ' +
        'Set TRANSCRIPT_PATH or run within an active interactive session.',
    };
  }

  let rawContent: string;
  try {
    rawContent = readFileSync(transcriptPath, 'utf8');
  } catch (err) {
    return {
      ok: false,
      transcriptPath,
      error: `Failed to read transcript.jsonl: ${String(err)}`,
    };
  }

  const lines = rawContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const entries: TranscriptEntry[] = [];

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // ignore malformed line
    }
  }

  const challengeCreatedAt = new Date(challenge.createdAt).getTime();
  // Allow 60 seconds of clock skew prior to challenge creation
  const minTimestamp = challengeCreatedAt - 60_000;

  let matchedUserEntry: TranscriptEntry | null = null;
  let matchedPhrase: string | null = null;

  // Scan user messages for explicit approval
  for (const entry of entries) {
    if (entry.source !== 'USER_EXPLICIT' || entry.type !== 'USER_INPUT') {
      continue;
    }

    const content = entry.content ?? '';
    const entryTime = entry.created_at ? new Date(entry.created_at).getTime() : 0;

    // Must be after (or within clock skew of) challenge generation
    if (entryTime < minTimestamp) {
      continue;
    }

    // Check if content contains the OTP nonce
    const nonceMatch = new RegExp(challenge.challengeNonce, 'i').test(content);
    if (!nonceMatch) {
      continue;
    }

    // Check if content contains a valid approval phrase
    for (const validPhrase of VALID_UNLOCK_PHRASES) {
      if (content.includes(validPhrase)) {
        matchedUserEntry = entry;
        matchedPhrase = validPhrase;
        break;
      }
    }

    if (matchedUserEntry) break;
  }

  // If no user entry matched, check if model attempted self-authorization
  if (!matchedUserEntry || !matchedPhrase) {
    // Forensic check: did the MODEL emit the phrase or nonce in its own messages?
    let modelSelfAuthSuspected = false;
    for (const entry of entries) {
      if (entry.source === 'MODEL') {
        const text = (entry.content ?? '') + (entry.thinking ?? '');
        if (text.includes(challenge.challengeNonce)) {
          for (const validPhrase of VALID_UNLOCK_PHRASES) {
            if (text.includes(validPhrase)) {
              modelSelfAuthSuspected = true;
              break;
            }
          }
        }
      }
    }

    return {
      ok: false,
      transcriptPath,
      fraudDetected: modelSelfAuthSuspected,
      error: modelSelfAuthSuspected
        ? `FATAL: AI Self-Authorization Fraud Detected! The approval phrase and OTP nonce "${challenge.challengeNonce}" were emitted by the MODEL, not by a human operator.`
        : `Verification failed: No human user message (USER_EXPLICIT) found containing both the approval phrase and OTP nonce "${challenge.challengeNonce}".`,
    };
  }

  return {
    ok: true,
    userTimestamp: matchedUserEntry.created_at,
    phrase: matchedPhrase,
    nonce: challenge.challengeNonce,
    userContent: matchedUserEntry.content,
    transcriptPath,
  };
}
