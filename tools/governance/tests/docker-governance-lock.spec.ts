import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, describe, expect, test } from 'vitest';

import {
  buildGovernanceLock,
  verifyGovernanceLock,
  type GovernanceLock,
} from '../verify-governance-lock.js';
import { verifyGovernanceTamper } from '../verify-governance-tamper.js';
import { lockEntity } from '../unified-lock-engine.js';
import { unlockEntity } from '../unified-unlock-engine.js';

function lockDocker(root: string) {
  const lockPath = join(root, 'governance.lock.json');
  if (!existsSync(lockPath)) {
    const initialLock = buildGovernanceLock(root);
    writeFileSync(lockPath, JSON.stringify(initialLock, null, 2), 'utf8');
  }
  const res = lockEntity(root, 'infra:docker');
  return {
    ok: res.ok,
    files: res.entity?.files.map((f) => f.path) ?? [],
    entity: res.entity,
  };
}

let fixtureSequence = 0;
const trackedFixtures: string[] = [];

function fixtureRoot(name: string): string {
  fixtureSequence += 1;
  const root = join(tmpdir(), `alsaada-docker-lock-${name}-${fixtureSequence}`);
  rmSync(root, { recursive: true, force: true });
  trackedFixtures.push(root);
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
  afterAll(() => {
    for (const dir of trackedFixtures) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // Best effort cleanup of temporary fixture directories
      }
    }
  });

  test('seals all docker infrastructure files with sha256 hashes when locking infra:docker entity', () => {
    // Arrange
    const root = fixtureRoot('docker-seal');

    // Act
    const lockRes = lockDocker(root);

    // Assert
    expect(lockRes.ok).toBe(true);
    expect(lockRes.files).toContain('docker-compose.yml');
    expect(lockRes.files).toContain('.dockerignore');
    expect(lockRes.files).toContain('docker/Dockerfile');
    expect(lockRes.files).toContain('docker/Dockerfile.dashboard');
    expect(lockRes.files).toContain('docker/postgres/init-scripts/01-init.sql');

    const lockRaw = readFileSync(join(root, 'governance.lock.json'), 'utf8');
    const lock = JSON.parse(lockRaw) as GovernanceLock;
    const dockerEntry = lock.lockedEntities?.['infra:docker'] ?? lock.lockedDocker;
    expect(dockerEntry).toBeDefined();
    expect(dockerEntry?.files.length).toBe(5);
    expect(dockerEntry?.files.every((f) => /^[a-f0-9]{64}$/.test(f.sha256))).toBe(true);

    const lockVerify = verifyGovernanceLock(root);
    expect(lockVerify.ok).toBe(true);

    const tamperVerify = verifyGovernanceTamper(root);
    expect(tamperVerify.ok).toBe(true);
  });

  test('fails tamper verification when tracked docker-compose.yml content is modified', () => {
    // Arrange
    const root = fixtureRoot('compose-tamper');
    lockDocker(root);

    // Act
    writeFileSync(join(root, 'docker-compose.yml'), 'name: hacked\n', 'utf8');
    const lockVerify = verifyGovernanceLock(root);
    const tamperVerify = verifyGovernanceTamper(root);

    // Assert
    expect(lockVerify.ok).toBe(false);
    expect(lockVerify.failures.some((f) => f.includes('docker-compose.yml') && f.includes('Modified'))).toBe(true);
    expect(tamperVerify.ok).toBe(false);
    expect(tamperVerify.failures.some((f) => f.includes('docker-compose.yml'))).toBe(true);
  });

  test('fails tamper verification when a tracked docker file is deleted from disk', () => {
    // Arrange
    const root = fixtureRoot('docker-delete');
    lockDocker(root);

    // Act
    unlinkSync(join(root, 'docker', 'Dockerfile.dashboard'));
    const lockVerify = verifyGovernanceLock(root);
    const tamperVerify = verifyGovernanceTamper(root);

    // Assert
    expect(lockVerify.ok).toBe(false);
    expect(lockVerify.failures.some((f) => f.includes('Dockerfile.dashboard') && f.includes('missing'))).toBe(true);
    expect(tamperVerify.ok).toBe(false);
    expect(tamperVerify.failures.some((f) => f.includes('Dockerfile.dashboard'))).toBe(true);
  });

  test('fails tamper verification when an unrecorded rogue file is added to docker directory', () => {
    // Arrange
    const root = fixtureRoot('docker-rogue');
    lockDocker(root);

    // Act
    writeFileSync(join(root, 'docker', 'backdoor.sh'), '#!/bin/sh\nrm -rf /\n', 'utf8');
    const lockVerify = verifyGovernanceLock(root);
    const tamperVerify = verifyGovernanceTamper(root);

    // Assert
    expect(lockVerify.ok).toBe(false);
    expect(lockVerify.failures.some((f) => f.includes('unrecorded file') && f.includes('backdoor.sh'))).toBe(true);
    expect(tamperVerify.ok).toBe(false);
    expect(tamperVerify.failures.some((f) => f.includes('unrecorded file') && f.includes('backdoor.sh'))).toBe(true);
  });

  test('rejects entity unlock when approval phrase is invalid or reason is shorter than five characters', () => {
    // Arrange
    const root = fixtureRoot('docker-unlock-invalid');
    lockEntity(root, 'infra:docker');

    // Act
    const res1 = unlockEntity('infra:docker', { phrase: 'تمام يا ريس', reason: 'Detailed reason about upgrade', root });
    const res2 = unlockEntity('infra:docker', { phrase: 'نعم موافق على التعديل', reason: 'sh', root });

    // Assert
    expect(res1.ok).toBe(false);
    expect(res1.error).toContain('Invalid approval phrase');
    expect(res2.ok).toBe(false);
    expect(res2.error).toContain('minimum 5 characters');
  });

  test('allows docker modifications after unlocking with approved phrase and re-locks cleanly', () => {
    // Arrange
    const root = fixtureRoot('docker-unlock-valid');
    lockEntity(root, 'infra:docker');

    // Act
    const unlockRes = unlockEntity('infra:docker', {
      phrase: 'نعم موافق على التعديل',
      reason: 'Upgrading PostgreSQL from 16 to 17',
      root,
    });
    const lockRaw = readFileSync(join(root, 'governance.lock.json'), 'utf8');
    const lock = JSON.parse(lockRaw) as GovernanceLock;
    writeFileSync(join(root, 'docker-compose.yml'), 'name: alsaada-upgraded\n', 'utf8');
    const lockVerify = verifyGovernanceLock(root);
    const reLockRes = lockEntity(root, 'infra:docker');
    const postReLockVerify = verifyGovernanceLock(root);

    // Assert
    expect(unlockRes.ok).toBe(true);
    expect(unlockRes.evidenceFile).toBeDefined();
    expect(existsSync(unlockRes.evidenceFile!)).toBe(true);
    expect(lock.lockedEntities?.['infra:docker']).toBeUndefined();
    expect(lockVerify.ok).toBe(true);
    expect(reLockRes.ok).toBe(true);
    expect(postReLockVerify.ok).toBe(true);
  });

  test('verifies repository docker infrastructure is cryptographically sealed in governance.lock.json with valid hashes', () => {
    // Arrange
    const root = process.cwd();
    const lockPath = join(root, 'governance.lock.json');
    const composePath = join(root, 'docker-compose.yml');

    // Act
    const lockExists = existsSync(lockPath);
    const composeExists = existsSync(composePath);
    const lock = lockExists ? (JSON.parse(readFileSync(lockPath, 'utf8')) as GovernanceLock) : null;
    const dockerEntity = lock?.lockedEntities?.['infra:docker'] ?? lock?.lockedDocker;

    // Assert
    expect(lockExists).toBe(true);
    expect(composeExists).toBe(true);
    expect(dockerEntity).toBeDefined();
    expect(dockerEntity?.files.length).toBeGreaterThanOrEqual(4);
    expect(dockerEntity?.files.some((f) => f.path === 'docker-compose.yml')).toBe(true);
    expect(dockerEntity?.files.some((f) => f.path === 'docker/Dockerfile')).toBe(true);
    expect(dockerEntity?.files.every((f) => /^[a-f0-9]{64}$/.test(f.sha256))).toBe(true);
  });

  test('passes tamper verification with zero failures and positive checked count in current workspace', () => {
    // Arrange
    const root = process.cwd();

    // Act
    const result = verifyGovernanceTamper(root);

    // Assert
    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.checked).toBeGreaterThan(0);
  });
});
