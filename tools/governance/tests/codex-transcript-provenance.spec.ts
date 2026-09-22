import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findActiveTranscriptFile, verifyTranscriptProvenance } from '../verify-transcript-provenance.js';
import type { PendingUnlockChallenge } from '../unlock-challenge-engine.js';
const challenge: PendingUnlockChallenge = {
  target: 'flow:test', entityId: 'flow:test', reason: 'Test fixture only',
  challengeNonce: 'UNLOCK-ABC123', createdAt: '2026-09-22T08:00:00.000Z',
  expiresAt: '2026-09-22T08:05:00.000Z', status: 'PENDING', signature: 'fixture',
};
describe('Codex native transcript provenance', () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'codex-provenance-')); });
  afterEach(() => { vi.unstubAllEnvs(); rmSync(root, { recursive: true, force: true }); });
  function verify(role: string, timestamp = '2026-09-22T08:01:00.000Z', text = 'موافق على الفتح UNLOCK-ABC123') {
    const transcriptPath = join(root, 'rollout.jsonl');
    writeFileSync(transcriptPath, JSON.stringify({ timestamp, type: 'response_item', payload: {
      type: 'message', role, content: [{ type: role === 'user' ? 'input_text' : 'output_text', text }],
    } }));
    return verifyTranscriptProvenance(challenge, { transcriptPath, now: new Date('2026-09-22T08:02:00.000Z') });
  }
  it('accepts native user approval with its original timestamp', () => {
    expect(verify('user')).toMatchObject({ ok: true, userTimestamp: '2026-09-22T08:01:00.000Z', nonce: challenge.challengeNonce });
  });
  it.each(['assistant', 'tool', 'developer', 'system'])('rejects %s messages', (role) => { expect(verify(role).ok).toBe(false); });
  it.each(['invalid', '2026-09-22T07:00:00.000Z', '2026-09-22T08:06:00.000Z'])('rejects invalid or out-of-window timestamp %s', (time) => { expect(verify('user', time).ok).toBe(false); });
  it('rejects approvals missing nonce', () => { expect(verify('user', undefined, 'موافق على الفتح').ok).toBe(false); });
  it('discovers only the current Codex session in the current workspace', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    vi.stubEnv('CODEX_THREAD_ID', id);
    vi.stubEnv('CODEX_HOME', root);
    vi.stubEnv('TRANSCRIPT_PATH', '');
    const sessions = join(root, 'sessions', '2026', '09', '22');
    mkdirSync(sessions, { recursive: true });
    const current = join(sessions, `rollout-${id}.jsonl`);
    writeFileSync(current, JSON.stringify({ type: 'session_meta', payload: { id, cwd: root } }));
    writeFileSync(join(sessions, 'rollout-22222222-2222-2222-2222-222222222222.jsonl'), '{}');
    expect(findActiveTranscriptFile({ root })).toBe(current);
    expect(findActiveTranscriptFile({ root: join(root, 'other-workspace') })).toBeNull();
    writeFileSync(current, JSON.stringify({ type: 'session_meta', payload: { id: 'other', cwd: root } }));
    expect(findActiveTranscriptFile({ root })).toBeNull();
  });
  it('fails closed when the current session is missing instead of selecting a legacy log', () => {
    vi.stubEnv('CODEX_THREAD_ID', '11111111-1111-1111-1111-111111111111');
    vi.stubEnv('CODEX_HOME', root);
    vi.stubEnv('TRANSCRIPT_PATH', '');
    const logs = join(root, '.system_generated', 'logs');
    mkdirSync(logs, { recursive: true });
    writeFileSync(join(logs, 'transcript.jsonl'), '{}');
    expect(findActiveTranscriptFile({ root })).toBeNull();
  });

});
