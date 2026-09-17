import { describe, expect, it } from 'vitest';
import {
  verifyGitHygiene,
  WORKSPACE_PACKAGE_DIRS,
  PROHIBITED_ROOT_CLUTTER_PATTERNS,
} from '../verify-git-hygiene.js';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('🏛️ G17: verify-git-hygiene governance gate', () => {
  it('should define all 11 monorepo workspace packages', () => {
    expect(WORKSPACE_PACKAGE_DIRS).toHaveLength(11);
    expect(WORKSPACE_PACKAGE_DIRS).toContain('apps/bot-server');
    expect(WORKSPACE_PACKAGE_DIRS).toContain('apps/admin-dashboard');
    expect(WORKSPACE_PACKAGE_DIRS).toContain('packages/rbac');
    expect(WORKSPACE_PACKAGE_DIRS).toContain('packages/core-components');
    expect(WORKSPACE_PACKAGE_DIRS).toContain('packages/database');
    expect(WORKSPACE_PACKAGE_DIRS).toContain('packages/regional-engine');
    expect(WORKSPACE_PACKAGE_DIRS).toContain('packages/national-id-engine');
    expect(WORKSPACE_PACKAGE_DIRS).toContain('packages/telemetry');
    expect(WORKSPACE_PACKAGE_DIRS).toContain('packages/ai-vision-engine');
    expect(WORKSPACE_PACKAGE_DIRS).toContain('modules/settings');
    expect(WORKSPACE_PACKAGE_DIRS).toContain('modules/workforce');
  });

  it('should pass on the real repository with version parity and no root clutter (isCi=false)', () => {
    const result = verifyGitHygiene(process.cwd(), {
      checkVersionParity: true,
      checkRootClutter: true,
      checkCiCleanTree: false,
      isCi: false,
    });

    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
    // Root package + 11 workspace packages + 1 root clutter scan = 13 checks
    expect(result.checked).toBeGreaterThanOrEqual(12);
  });

  it('should detect version parity mismatch when a package has different version', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'git-hygiene-mismatch-'));
    try {
      // Create root package.json
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({ name: 'root', version: '2.0.0-alpha.1' })
      );

      // Create valid packages except one
      for (const dir of WORKSPACE_PACKAGE_DIRS) {
        const fullDir = join(tempDir, dir);
        mkdirSync(fullDir, { recursive: true });
        const version = dir === 'modules/settings' ? '1.0.0' : '2.0.0-alpha.1';
        writeFileSync(
          join(fullDir, 'package.json'),
          JSON.stringify({ name: dir, version })
        );
      }

      const result = verifyGitHygiene(tempDir, {
        checkVersionParity: true,
        checkRootClutter: false,
        checkCiCleanTree: false,
        isCi: false,
      });

      expect(result.ok).toBe(false);
      expect(result.failures.some((f) => f.includes('Version mismatch') && f.includes('modules/settings'))).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should detect missing workspace package.json', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'git-hygiene-missing-'));
    try {
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({ name: 'root', version: '2.0.0-alpha.1' })
      );

      const result = verifyGitHygiene(tempDir, {
        checkVersionParity: true,
        checkRootClutter: false,
        checkCiCleanTree: false,
        isCi: false,
      });

      expect(result.ok).toBe(false);
      expect(result.failures.some((f) => f.includes('Workspace package.json missing'))).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should detect root clutter files matching prohibited patterns', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'git-hygiene-clutter-'));
    try {
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({ name: 'root', version: '2.0.0-alpha.1' })
      );

      // Add a prohibited clutter file
      writeFileSync(join(tempDir, 'scratch.ts'), 'console.log("temp");');
      writeFileSync(join(tempDir, 'test.ts'), 'console.log("temp");');
      writeFileSync(join(tempDir, 'temp.json'), '{}');

      const result = verifyGitHygiene(tempDir, {
        checkVersionParity: false,
        checkRootClutter: true,
        checkCiCleanTree: false,
        isCi: false,
      });

      expect(result.ok).toBe(false);
      expect(result.failures.length).toBeGreaterThanOrEqual(3);
      expect(result.failures.some((f) => f.includes('scratch.ts'))).toBe(true);
      expect(result.failures.some((f) => f.includes('test.ts'))).toBe(true);
      expect(result.failures.some((f) => f.includes('temp.json'))).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should test prohibited clutter patterns against typical junk filenames', () => {
    const testCases = [
      { filename: 'scratch.ts', shouldMatch: true },
      { filename: 'scratch-test.js', shouldMatch: true },
      { filename: 'scratch_file.ts', shouldMatch: true },
      { filename: 'temp.json', shouldMatch: true },
      { filename: 'temp-data.txt', shouldMatch: true },
      { filename: 'temp_file.txt', shouldMatch: true },
      { filename: 'tmp.log', shouldMatch: true },
      { filename: 'test.ts', shouldMatch: true },
      { filename: 'test-file.js', shouldMatch: true },
      { filename: 'verify.ts', shouldMatch: true },
      { filename: 'verify-check.ts', shouldMatch: true },
      { filename: 'dump.tmp', shouldMatch: true },
      { filename: 'backup.bak', shouldMatch: true },
      { filename: 'scratch.scratch', shouldMatch: true },
      { filename: 'README.md', shouldMatch: false },
      { filename: 'package.json', shouldMatch: false },
      { filename: 'vitest.config.ts', shouldMatch: false },
      { filename: 'tsconfig.json', shouldMatch: false },
    ];

    for (const { filename, shouldMatch } of testCases) {
      const matched = PROHIBITED_ROOT_CLUTTER_PATTERNS.some((pattern) => pattern.test(filename));
      expect(matched, `Expected ${filename} match to be ${shouldMatch}`).toBe(shouldMatch);
    }
  });

  it('should fail when isCi is true and there are uncommitted changes', () => {
    const result = verifyGitHygiene(process.cwd(), {
      checkVersionParity: false,
      checkRootClutter: false,
      checkCiCleanTree: true,
      isCi: true,
      gitStatusFn: () => ' M package.json\n?? temp.txt',
    });

    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('CI Clean Tree violation'))).toBe(true);
  });

  it('should pass when isCi is true and working tree is clean', () => {
    const result = verifyGitHygiene(process.cwd(), {
      checkVersionParity: false,
      checkRootClutter: false,
      checkCiCleanTree: true,
      isCi: true,
      gitStatusFn: () => '',
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('should warn and not fail when isCi is false and there are uncommitted changes', () => {
    const result = verifyGitHygiene(process.cwd(), {
      checkVersionParity: false,
      checkRootClutter: false,
      checkCiCleanTree: true,
      isCi: false,
      gitStatusFn: () => ' M package.json',
    });

    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('Local working tree has uncommitted changes');
  });

  it('should not warn when isCi is false and working tree is clean', () => {
    const result = verifyGitHygiene(process.cwd(), {
      checkVersionParity: false,
      checkRootClutter: false,
      checkCiCleanTree: true,
      isCi: false,
      gitStatusFn: () => '',
    });

    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});
