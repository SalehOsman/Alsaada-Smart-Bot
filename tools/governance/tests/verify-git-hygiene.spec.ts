import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  verifyGitHygiene,
  WORKSPACE_PACKAGE_DIRS,
  PROHIBITED_ROOT_CLUTTER_PATTERNS,
} from '../verify-git-hygiene.js';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');
let tempDirSequence = 0;

function createTempDir(prefix: string): string {
  tempDirSequence += 1;
  const dir = join(tmpdir(), `${prefix}-${tempDirSequence}`);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('🏛️ G17: verify-git-hygiene governance gate', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('defines all 11 monorepo workspace packages', () => {
    // Arrange
    const expectedCount = 11;

    // Act
    const packageCount = WORKSPACE_PACKAGE_DIRS.length;

    // Assert
    expect(packageCount).toBe(expectedCount);
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
    expect(WORKSPACE_PACKAGE_DIRS).not.toContain('apps/unknown-app');
  });

  it('passes on the real repository with version parity and no root clutter with isCi false', () => {
    // Arrange
    const cwd = process.cwd();
    const options = {
      checkVersionParity: true,
      checkRootClutter: true,
      checkCiCleanTree: false,
      isCi: false,
    };

    // Act
    const result = verifyGitHygiene(cwd, options);

    // Assert
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.checked).toBeGreaterThan(0);
    expect(result.failures).toHaveLength(0);
  });

  it('detects version parity mismatch when a package has different version', () => {
    // Arrange
    const tempDir = createTempDir('git-hygiene-mismatch');
    try {
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({ name: 'root', version: '2.0.0-alpha.1' })
      );

      for (const dir of WORKSPACE_PACKAGE_DIRS) {
        const fullDir = join(tempDir, dir);
        mkdirSync(fullDir, { recursive: true });
        const version = dir === 'modules/settings' ? '1.0.0' : '2.0.0-alpha.1';
        writeFileSync(
          join(fullDir, 'package.json'),
          JSON.stringify({ name: dir, version })
        );
      }

      // Act
      const result = verifyGitHygiene(tempDir, {
        checkVersionParity: true,
        checkRootClutter: false,
        checkCiCleanTree: false,
        isCi: false,
      });

      // Assert
      expect(result.ok).toBe(false);
      expect(result.failures.some((f) => f.includes('Version mismatch') && f.includes('modules/settings'))).toBe(true);
      expect(result.failures).not.toHaveLength(0);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('detects missing workspace package.json', () => {
    // Arrange
    const tempDir = createTempDir('git-hygiene-missing');
    try {
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({ name: 'root', version: '2.0.0-alpha.1' })
      );

      // Act
      const result = verifyGitHygiene(tempDir, {
        checkVersionParity: true,
        checkRootClutter: false,
        checkCiCleanTree: false,
        isCi: false,
      });

      // Assert
      expect(result.ok).toBe(false);
      expect(result.failures.some((f) => f.includes('Workspace package.json missing'))).toBe(true);
      expect(result.failures).not.toHaveLength(0);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('detects root clutter files matching prohibited patterns', () => {
    // Arrange
    const tempDir = createTempDir('git-hygiene-clutter');
    try {
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({ name: 'root', version: '2.0.0-alpha.1' })
      );

      writeFileSync(join(tempDir, 'scratch.ts'), 'console.log("temp");');
      writeFileSync(join(tempDir, 'test.ts'), 'console.log("temp");');
      writeFileSync(join(tempDir, 'temp.json'), '{}');

      // Act
      const result = verifyGitHygiene(tempDir, {
        checkVersionParity: false,
        checkRootClutter: true,
        checkCiCleanTree: false,
        isCi: false,
      });

      // Assert
      expect(result.ok).toBe(false);
      expect(result.failures.length).toBeGreaterThan(0);
      expect(result.failures.some((f) => f.includes('scratch.ts'))).toBe(true);
      expect(result.failures.some((f) => f.includes('test.ts'))).toBe(true);
      expect(result.failures.some((f) => f.includes('temp.json'))).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('validates prohibited clutter patterns against typical junk filenames', () => {
    // Arrange
    const testCases = [
      { filename: 'scratch.ts', expectedMatch: true },
      { filename: 'scratch-test.js', expectedMatch: true },
      { filename: 'scratch_file.ts', expectedMatch: true },
      { filename: 'temp.json', expectedMatch: true },
      { filename: 'temp-data.txt', expectedMatch: true },
      { filename: 'temp_file.txt', expectedMatch: true },
      { filename: 'tmp.log', expectedMatch: true },
      { filename: 'test.ts', expectedMatch: true },
      { filename: 'test-file.js', expectedMatch: true },
      { filename: 'verify.ts', expectedMatch: true },
      { filename: 'verify-check.ts', expectedMatch: true },
      { filename: 'dump.tmp', expectedMatch: true },
      { filename: 'backup.bak', expectedMatch: true },
      { filename: 'scratch.scratch', expectedMatch: true },
      { filename: 'README.md', expectedMatch: false },
      { filename: 'package.json', expectedMatch: false },
      { filename: 'vitest.config.ts', expectedMatch: false },
      { filename: 'tsconfig.json', expectedMatch: false },
    ];

    // Act & Assert
    for (const { filename, expectedMatch } of testCases) {
      // Act
      const matched = PROHIBITED_ROOT_CLUTTER_PATTERNS.some((pattern) => pattern.test(filename));

      // Assert
      expect(matched).toBe(expectedMatch);
    }
  });

  it('fails when isCi is true and there are uncommitted changes', () => {
    // Arrange
    const mockStatus = () => ' M package.json\n?? temp.txt';

    // Act
    const result = verifyGitHygiene(process.cwd(), {
      checkVersionParity: false,
      checkRootClutter: false,
      checkCiCleanTree: true,
      isCi: true,
      gitStatusFn: mockStatus,
    });

    // Assert
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('CI Clean Tree violation'))).toBe(true);
    expect(result.failures).not.toHaveLength(0);
  });

  it('passes when isCi is true and working tree is clean', () => {
    // Arrange
    const mockStatus = () => '';

    // Act
    const result = verifyGitHygiene(process.cwd(), {
      checkVersionParity: false,
      checkRootClutter: false,
      checkCiCleanTree: true,
      isCi: true,
      gitStatusFn: mockStatus,
    });

    // Assert
    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.failures).toHaveLength(0);
  });

  it('warns and does not fail when isCi is false and there are uncommitted changes', () => {
    // Arrange
    const mockStatus = () => ' M package.json';

    // Act
    const result = verifyGitHygiene(process.cwd(), {
      checkVersionParity: false,
      checkRootClutter: false,
      checkCiCleanTree: true,
      isCi: false,
      gitStatusFn: mockStatus,
    });

    // Assert
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('Local working tree has uncommitted changes');
    expect(result.failures).toHaveLength(0);
  });

  it('does not warn when isCi is false and working tree is clean', () => {
    // Arrange
    const mockStatus = () => '';

    // Act
    const result = verifyGitHygiene(process.cwd(), {
      checkVersionParity: false,
      checkRootClutter: false,
      checkCiCleanTree: true,
      isCi: false,
      gitStatusFn: mockStatus,
    });

    // Assert
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
    expect(result.failures).toHaveLength(0);
  });

  it('verifies monorepo root and workspace version parity and sync script wiring', () => {
    // Arrange
    const rootPkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      version: string;
      scripts: Record<string, string>;
    };

    // Act & Assert
    // Assert root version format and presence
    expect(rootPkg.version).toBeDefined();
    expect(rootPkg.version).toMatch(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/);

    // Assert version-packages script wires sync-root-version
    expect(rootPkg.scripts['version-packages']).toBe(
      'changeset version && tsx tools/release/sync-root-version.ts'
    );
    expect(rootPkg.scripts['release:tag']).toBe('changeset publish');

    // Assert version parity across all 11 workspace packages
    for (const pkgRelDir of WORKSPACE_PACKAGE_DIRS) {
      // Act
      const pkgJsonPath = join(process.cwd(), pkgRelDir, 'package.json');
      const exists = existsSync(pkgJsonPath);
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as { version: string };

      // Assert
      expect(exists).toBe(true);
      expect(pkgJson.version).toBe(rootPkg.version);
    }
  });
});
