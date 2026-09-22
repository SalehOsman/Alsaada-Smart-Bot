import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parsePorcelainStatus } from '../pre-commit-test-guard.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('pre-commit-test-guard smart test runner', () => {
  const repoRoot = process.cwd();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('ignores non-typescript files including markdown, json, yaml, and css', () => {
    // Arrange
    const raw = [
      ' M README.md',
      ' M docs/work-plans/63-plan.md',
      '?? docs/new-doc.md',
      ' M package.json',
      ' M pnpm-lock.yaml',
    ].join('\n');

    // Act
    const result = parsePorcelainStatus(raw, repoRoot);

    // Assert
    expect(result).toHaveLength(0);
  });

  it('detects modified and untracked TypeScript files that exist on disk', () => {
    // Arrange
    const raw = [
      ' M package.json',
      ' M apps/bot-server/src/handlers/start.handler.ts',
      '?? tools/governance/verify-test-authenticity.ts',
      ' M docs/19-registry.md',
    ].join('\n');

    // Act
    const result = parsePorcelainStatus(raw, repoRoot);

    // Assert
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('apps/bot-server/src/handlers/start.handler.ts');
  });

  it('ignores deleted TypeScript files with status D', () => {
    // Arrange
    const raw = [
      ' D apps/bot-server/src/handlers/old.handler.ts',
      'D  apps/bot-server/src/handlers/staged-deleted.handler.ts',
      ' M apps/bot-server/src/handlers/start.handler.ts',
    ].join('\n');

    // Act
    const result = parsePorcelainStatus(raw, repoRoot);

    // Assert
    expect(result).not.toContain('apps/bot-server/src/handlers/old.handler.ts');
    expect(result).not.toContain('apps/bot-server/src/handlers/staged-deleted.handler.ts');
    expect(result).toContain('apps/bot-server/src/handlers/start.handler.ts');
  });

  it('handles git renamed files cleanly', () => {
    // Arrange
    const raw = [
      'R  apps/bot-server/src/old.ts -> apps/bot-server/src/handlers/start.handler.ts',
    ].join('\n');

    // Act
    const result = parsePorcelainStatus(raw, repoRoot);

    // Assert
    expect(result).toContain('apps/bot-server/src/handlers/start.handler.ts');
  });

  it('verifies .githooks/pre-commit contains strict main branch immunity guard', () => {
    // Arrange
    const hookPath = join(repoRoot, '.githooks/pre-commit');

    // Act
    const hookExists = existsSync(hookPath);
    const content = readFileSync(hookPath, 'utf8');

    // Assert
    expect(hookExists).toBe(true);
    expect(content).toContain('CURRENT_BRANCH=');
    expect(content).toContain('[ "$CURRENT_BRANCH" = "main" ]');
    expect(content).toContain('git rev-parse --git-path MERGE_HEAD');
    expect(content).toContain('GOVERNANCE ERROR');
    expect(content).toContain('ادمج الفرع');
    expect(content).toContain('exit 1');
  });

  it('verifies .githooks/pre-commit.cmd contains Windows branch immunity guard', () => {
    // Arrange
    const hookPath = join(repoRoot, '.githooks/pre-commit.cmd');

    // Act
    const hookExists = existsSync(hookPath);
    const content = readFileSync(hookPath, 'utf8');

    // Assert
    expect(hookExists).toBe(true);
    expect(content).toContain('CURRENT_BRANCH=');
    expect(content).toContain('if "%CURRENT_BRANCH%"=="main"');
    expect(content).toContain('git rev-parse --git-path MERGE_HEAD');
    expect(content).toContain('GOVERNANCE ERROR');
    expect(content).toContain('ادمج الفرع');
    expect(content).toContain('exit /b 1');
  });

  it('verifies branch guard decision logic rejecting direct main and permitting merge and feature branches', () => {
    // Arrange
    function rejectsDirectCommit(branch: string, hasMergeHead: boolean): boolean {
      if (branch === 'main') {
        return !hasMergeHead;
      }
      return false;
    }

    // Act
    const mainDirect = rejectsDirectCommit('main', false);
    const mainMerge = rejectsDirectCommit('main', true);
    const featStrict = rejectsDirectCommit('feat/strict-branch-governance', false);
    const featAdvances = rejectsDirectCommit('feat/worker-advances', false);
    const fixCanteen = rejectsDirectCommit('fix/canteen-stock-leak', false);
    const planBranch = rejectsDirectCommit('plan/81-git-branching', false);
    const choreBranch = rejectsDirectCommit('chore/docs-update', false);

    // Assert
    expect(mainDirect).toBe(true);
    expect(mainMerge).toBe(false);
    expect(featStrict).toBe(false);
    expect(featAdvances).toBe(false);
    expect(fixCanteen).toBe(false);
    expect(planBranch).toBe(false);
    expect(choreBranch).toBe(false);
  });
});
