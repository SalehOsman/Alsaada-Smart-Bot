import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { listEntityFiles } from '../unified-lock-engine.js';
import { hashDirectoryFiles, type GovernanceLock } from '../verify-governance-lock.js';

const tempDirs: string[] = [];

function createFixtureDir(name: string): string {
  const dir = join(tmpdir(), `alsaada-ci-lock-attachments-${name}-${Date.now()}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

describe('CI governance lock attachments exclusion and Dockerfile module parity (INC-20260923-CI-LOCK-AND-DOCKERFILE)', () => {
  afterAll(() => {
    for (const dir of tempDirs) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors on Windows
      }
    }
  });

  test('excludes gitignored runtime attachments directories and .tsbuildinfo in listEntityFiles and hashDirectoryFiles', () => {
    const root = createFixtureDir('module-attachments');
    const moduleDir = join(root, 'modules', 'workforce');
    mkdirSync(join(moduleDir, 'src'), { recursive: true });
    mkdirSync(join(moduleDir, 'attachments', 'workers', 'OP-DRV-001'), { recursive: true });

    writeFileSync(join(moduleDir, 'package.json'), '{"name":"@alsaada/workforce"}\n', 'utf8');
    writeFileSync(join(moduleDir, 'src', 'index.ts'), 'export const workforce = true;\n', 'utf8');
    writeFileSync(
      join(moduleDir, 'attachments', 'workers', 'OP-DRV-001', 'national_id.jpg'),
      'fake-binary-attachment',
      'utf8'
    );
    writeFileSync(join(moduleDir, 'tsconfig.tsbuildinfo'), '{}', 'utf8');

    const entityFiles = listEntityFiles(root, 'modules/workforce', 'module');
    expect(entityFiles).toContain('modules/workforce/package.json');
    expect(entityFiles).toContain('modules/workforce/src/index.ts');
    expect(entityFiles.some((f) => f.includes('/attachments/'))).toBe(false);
    expect(entityFiles.some((f) => f.endsWith('.tsbuildinfo'))).toBe(false);

    const hashedFiles = hashDirectoryFiles(moduleDir, root).map((entry) => entry.path);
    expect(hashedFiles).toContain('modules/workforce/package.json');
    expect(hashedFiles).toContain('modules/workforce/src/index.ts');
    expect(hashedFiles.some((f) => f.includes('/attachments/'))).toBe(false);
    expect(hashedFiles.some((f) => f.endsWith('.tsbuildinfo'))).toBe(false);
  });

  test('ensures 100% of files recorded in governance.lock.json are tracked in git ls-files with zero gitignored files', () => {
    const root = process.cwd();
    const lockRaw = readFileSync(join(root, 'governance.lock.json'), 'utf8');
    const lock = JSON.parse(lockRaw) as GovernanceLock;

    const gitTrackedRaw = execFileSync('git', ['-c', 'core.quotepath=false', 'ls-files'], {
      cwd: root,
      encoding: 'utf8',
    });
    const gitTrackedSet = new Set(
      gitTrackedRaw
        .split(/\r?\n/)
        .map((line) => line.trim().replace(/\\/g, '/'))
        .filter((line) => line.length > 0)
    );

    const recordedPaths: string[] = [];
    for (const file of lock.files) {
      recordedPaths.push(file.path);
    }
    if (lock.lockedEntities) {
      for (const entity of Object.values(lock.lockedEntities)) {
        for (const file of entity.files) {
          recordedPaths.push(file.path);
        }
      }
    }

    expect(recordedPaths.length).toBeGreaterThan(0);
    expect(recordedPaths.some((p) => p.includes('/attachments/') || p.startsWith('attachments/'))).toBe(false);

    const untrackedInLock = recordedPaths.filter((p) => !gitTrackedSet.has(p));
    expect(untrackedInLock).toEqual([]);
  });

  test('verifies docker/Dockerfile copies package.json and source files for all monorepo modules and packages dynamically', () => {
    const root = process.cwd();
    const dockerfile = readFileSync(join(root, 'docker', 'Dockerfile'), 'utf8');

    const moduleDirs = readdirSync(join(root, 'modules'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(root, 'modules', entry.name, 'package.json')))
      .map((entry) => entry.name);

    expect(moduleDirs).toEqual(expect.arrayContaining(['workforce', 'settings', 'sandbox']));

    for (const mod of moduleDirs) {
      expect(dockerfile).toContain(`COPY modules/${mod}/package.json modules/${mod}/`);
      expect(dockerfile).toContain(`COPY modules/${mod}/src/ modules/${mod}/src/`);
      expect(dockerfile).toContain(`COPY modules/${mod}/index.ts modules/${mod}/`);
      expect(dockerfile).toContain(`COPY modules/${mod}/module.contract.json modules/${mod}/`);
      expect(dockerfile).toContain(`COPY modules/${mod}/tsconfig.json modules/${mod}/`);
    }

    const packageDirs = readdirSync(join(root, 'packages'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(root, 'packages', entry.name, 'package.json')))
      .map((entry) => entry.name);

    expect(packageDirs.length).toBeGreaterThanOrEqual(8);

    for (const pkg of packageDirs) {
      expect(dockerfile).toContain(`COPY packages/${pkg}/package.json packages/${pkg}/`);
      expect(dockerfile).toContain(`COPY packages/${pkg}/src/ packages/${pkg}/src/`);
      expect(dockerfile).toContain(`COPY packages/${pkg}/tsconfig.json packages/${pkg}/`);
    }
  });
});

