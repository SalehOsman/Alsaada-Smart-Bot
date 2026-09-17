import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';

import {
  APPROVAL_PHRASE,
  buildGovernanceLock,
  lockDockerEntry,
  unlockDockerEntry,
  verifyGovernanceLock,
  type GovernanceLock,
} from '../verify-governance-lock.js';
import { verifyGovernanceTamper } from '../verify-governance-tamper.js';
import { lockDocker } from '../../scaffold/lock-docker.js';
import { unlockDocker } from '../../scaffold/unlock-docker.js';
import { unlockFeature } from '../../scaffold/unlock-feature.js';

function fixtureRoot(name: string): string {
  const root = join(tmpdir(), `alsaada-docker-lock-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(root, 'docs', 'ai-execution-evidence'), { recursive: true });
  mkdirSync(join(root, 'tools', 'governance'), { recursive: true });
  mkdirSync(join(root, 'tools', 'scaffold'), { recursive: true });
  mkdirSync(join(root, 'docker', 'postgres', 'init-scripts'), { recursive: true });

  writeFileSync(join(root, 'AGENTS.md'), '# Agents\n', 'utf8');
  writeFileSync(join(root, 'GEMINI.md'), '# Gemini\n', 'utf8');
  writeFileSync(join(root, 'docs', '14-ai-agent-governance-and-file-rules.md'), '# Doc 14\n', 'utf8');
  writeFileSync(join(root, 'docs', '15-universal-module-and-flow-standard.md'), '# Doc 15\n', 'utf8');
  writeFileSync(join(root, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md'), '# Registry\n', 'utf8');
  writeFileSync(join(root, 'docs', '21-mandatory-module-architecture-and-gates.md'), '# Doc 21\n', 'utf8');
  writeFileSync(join(root, 'docs', 'ai-execution-evidence', 'README.md'), '# Evidence\n', 'utf8');
  writeFileSync(join(root, 'package.json'), '{"name": "test"}\n', 'utf8');
  writeFileSync(join(root, '.dockerignore'), 'node_modules\n.git\n', 'utf8');
  writeFileSync(join(root, 'docker-compose.yml'), 'name: alsaada-test\nservices:\n  postgres:\n    image: postgres:16\n', 'utf8');
  writeFileSync(join(root, 'docker', 'Dockerfile'), 'FROM node:22-alpine\n', 'utf8');
  writeFileSync(join(root, 'docker', 'Dockerfile.dashboard'), 'FROM node:22-alpine\n', 'utf8');
  writeFileSync(join(root, 'docker', 'postgres', 'init-scripts', '01-init.sql'), 'CREATE DATABASE test;\n', 'utf8');

  return root;
}

describe('Docker infrastructure cryptographic governance lock', () => {
  test('lockDocker seals all docker infrastructure files with sha256 hashes', () => {
    const root = fixtureRoot('docker-seal');
    const lockRes = lockDocker(root);

    expect(lockRes.ok).toBe(true);
    expect(lockRes.files).toContain('docker-compose.yml');
    expect(lockRes.files).toContain('.dockerignore');
    expect(lockRes.files).toContain('docker/Dockerfile');
    expect(lockRes.files).toContain('docker/Dockerfile.dashboard');
    expect(lockRes.files).toContain('docker/postgres/init-scripts/01-init.sql');

    const lockRaw = readFileSync(join(root, 'governance.lock.json'), 'utf8');
    const lock = JSON.parse(lockRaw) as GovernanceLock;
    expect(lock.lockedDocker).toBeDefined();
    expect(lock.lockedDocker?.directory).toBe('docker');
    expect(lock.lockedDocker?.files.length).toBe(5);
    expect(lock.lockedDocker?.files.every((f) => /^[a-f0-9]{64}$/.test(f.sha256))).toBe(true);

    const lockVerify = verifyGovernanceLock(root);
    expect(lockVerify.ok).toBe(true);

    const tamperVerify = verifyGovernanceTamper(root);
    expect(tamperVerify.ok).toBe(true);
  });

  test('tamper detection hard-fails when docker-compose.yml is modified', () => {
    const root = fixtureRoot('compose-tamper');
    lockDocker(root);

    writeFileSync(join(root, 'docker-compose.yml'), 'name: hacked\n', 'utf8');

    const lockVerify = verifyGovernanceLock(root);
    expect(lockVerify.ok).toBe(false);
    expect(lockVerify.failures.some((f) => f.includes('docker-compose.yml') && f.includes('Modified'))).toBe(true);

    const tamperVerify = verifyGovernanceTamper(root);
    expect(tamperVerify.ok).toBe(false);
    expect(tamperVerify.failures.some((f) => f.includes('docker-compose.yml'))).toBe(true);
  });

  test('tamper detection hard-fails when a docker file is deleted', () => {
    const root = fixtureRoot('docker-delete');
    lockDocker(root);

    unlinkSync(join(root, 'docker', 'Dockerfile.dashboard'));

    const lockVerify = verifyGovernanceLock(root);
    expect(lockVerify.ok).toBe(false);
    expect(lockVerify.failures.some((f) => f.includes('Dockerfile.dashboard') && f.includes('missing'))).toBe(true);

    const tamperVerify = verifyGovernanceTamper(root);
    expect(tamperVerify.ok).toBe(false);
    expect(tamperVerify.failures.some((f) => f.includes('Dockerfile.dashboard'))).toBe(true);
  });

  test('tamper detection hard-fails when an unrecorded rogue file is added to docker/', () => {
    const root = fixtureRoot('docker-rogue');
    lockDocker(root);

    writeFileSync(join(root, 'docker', 'backdoor.sh'), '#!/bin/sh\nrm -rf /\n', 'utf8');

    const lockVerify = verifyGovernanceLock(root);
    expect(lockVerify.ok).toBe(false);
    expect(lockVerify.failures.some((f) => f.includes('unrecorded file') && f.includes('backdoor.sh'))).toBe(true);

    const tamperVerify = verifyGovernanceTamper(root);
    expect(tamperVerify.ok).toBe(false);
    expect(tamperVerify.failures.some((f) => f.includes('unrecorded file') && f.includes('backdoor.sh'))).toBe(true);
  });

  test('unlockDocker rejects invalid approval phrase or short reason', () => {
    const root = fixtureRoot('docker-unlock-invalid');
    lockDocker(root);

    const res1 = unlockDocker('تمام يا ريس', 'Detailed reason about upgrade', root);
    expect(res1.ok).toBe(false);
    expect(res1.error).toContain('Invalid approval phrase');

    const res2 = unlockDocker('نعم موافق على التعديل', 'short', root);
    expect(res2.ok).toBe(false);
    expect(res2.error).toContain('minimum 10 characters');
  });

  test('unlockDocker succeeds with approved phrase and allows modifications, then re-locks cleanly', () => {
    const root = fixtureRoot('docker-unlock-valid');
    lockDocker(root);

    const unlockRes = unlockDocker('نعم موافق على التعديل', 'Upgrading PostgreSQL from 16 to 17', root);
    expect(unlockRes.ok).toBe(true);
    expect(unlockRes.evidenceFile).toBeDefined();
    expect(existsSync(join(root, unlockRes.evidenceFile!))).toBe(true);

    const lockRaw = readFileSync(join(root, 'governance.lock.json'), 'utf8');
    const lock = JSON.parse(lockRaw) as GovernanceLock;
    expect(lock.lockedDocker).toBeUndefined();

    // Now modifying docker-compose is permitted because lock was removed
    writeFileSync(join(root, 'docker-compose.yml'), 'name: alsaada-upgraded\n', 'utf8');
    const lockVerify = verifyGovernanceLock(root);
    expect(lockVerify.ok).toBe(true);

    // Re-lock after modification
    const reLockRes = lockDocker(root);
    expect(reLockRes.ok).toBe(true);

    const postReLockVerify = verifyGovernanceLock(root);
    expect(postReLockVerify.ok).toBe(true);
  });

  test('unlockFeature delegates to unlockDocker when type is docker', () => {
    const root = fixtureRoot('docker-unlock-feature');
    lockDocker(root);

    const unlockRes = unlockFeature({
      type: 'docker',
      targetKey: 'docker',
      phrase: 'موافق على الفتح',
      reason: 'Updating network configuration for container isolation',
      root,
    });

    expect(unlockRes.ok).toBe(true);
    expect(unlockRes.type).toBe('docker');
    expect(unlockRes.evidenceFile).toBeDefined();

    const lockRaw = readFileSync(join(root, 'governance.lock.json'), 'utf8');
    const lock = JSON.parse(lockRaw) as GovernanceLock;
    expect(lock.lockedDocker).toBeUndefined();
  });

  test('repo docker infrastructure is cryptographically sealed in governance.lock.json', () => {
    const root = process.cwd();
    const lockPath = join(root, 'governance.lock.json');
    if (existsSync(lockPath) && existsSync(join(root, 'docker-compose.yml'))) {
      const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as GovernanceLock;
      expect(lock.lockedDocker).toBeDefined();
      expect(lock.lockedDocker?.directory).toBe('docker');
      expect(lock.lockedDocker?.files.length).toBeGreaterThanOrEqual(4);
      expect(lock.lockedDocker?.files.some((f) => f.path === 'docker-compose.yml')).toBe(true);
      expect(lock.lockedDocker?.files.some((f) => f.path === 'docker/Dockerfile')).toBe(true);
      expect(lock.lockedDocker?.files.every((f) => /^[a-f0-9]{64}$/.test(f.sha256))).toBe(true);
    }
  });

  test('repo workspace passes verifyGovernanceTamper with valid evidence file', () => {
    const root = process.cwd();
    const result = verifyGovernanceTamper(root);
    if (!result.ok) {
      console.error('Tamper check failures:', result.failures);
    }
    expect(result.ok).toBe(true);
  });
});
