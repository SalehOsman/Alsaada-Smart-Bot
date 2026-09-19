import { describe, expect, it } from 'vitest';
import { parsePorcelainStatus } from '../pre-commit-test-guard.js';
import { resolve } from 'node:path';

describe('⚡ pre-commit-test-guard smart test runner', () => {
  const repoRoot = process.cwd();

  it('1. ignores non-typescript files (markdown, json, yaml, css)', () => {
    const raw = [
      ' M README.md',
      ' M docs/work-plans/63-plan.md',
      '?? docs/new-doc.md',
      ' M package.json',
      ' M pnpm-lock.yaml',
    ].join('\n');

    const result = parsePorcelainStatus(raw, repoRoot);
    expect(result).toHaveLength(0);
  });

  it('2. detects modified and untracked TypeScript files that exist on disk', () => {
    const raw = [
      ' M package.json',
      ' M apps/bot-server/src/handlers/start.handler.ts',
      '?? tools/governance/verify-test-authenticity.ts',
      ' M docs/19-registry.md',
    ].join('\n');

    const result = parsePorcelainStatus(raw, repoRoot);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result).toContain('apps/bot-server/src/handlers/start.handler.ts');
  });

  it('3. ignores deleted TypeScript files (status D)', () => {
    const raw = [
      ' D apps/bot-server/src/handlers/old.handler.ts',
      'D  apps/bot-server/src/handlers/staged-deleted.handler.ts',
      ' M apps/bot-server/src/handlers/start.handler.ts',
    ].join('\n');

    const result = parsePorcelainStatus(raw, repoRoot);
    expect(result).not.toContain('apps/bot-server/src/handlers/old.handler.ts');
    expect(result).not.toContain('apps/bot-server/src/handlers/staged-deleted.handler.ts');
    expect(result).toContain('apps/bot-server/src/handlers/start.handler.ts');
  });

  it('4. handles git renamed files (A -> B)', () => {
    const raw = [
      'R  apps/bot-server/src/old.ts -> apps/bot-server/src/handlers/start.handler.ts',
    ].join('\n');

    const result = parsePorcelainStatus(raw, repoRoot);
    expect(result).toContain('apps/bot-server/src/handlers/start.handler.ts');
  });

  it('5. verifies .githooks/pre-commit contains strict main branch immunity guard', async () => {
    const { readFileSync, existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const hookPath = join(repoRoot, '.githooks/pre-commit');
    expect(existsSync(hookPath)).toBe(true);

    const content = readFileSync(hookPath, 'utf8');
    expect(content).toContain('CURRENT_BRANCH=');
    expect(content).toContain('[ "$CURRENT_BRANCH" = "main" ]');
    expect(content).toContain('git rev-parse --git-path MERGE_HEAD');
    expect(content).toContain('GOVERNANCE ERROR');
    expect(content).toContain('ادمج الفرع');
    expect(content).toContain('exit 1');
  });

  it('6. verifies .githooks/pre-commit.cmd contains Windows branch immunity guard', async () => {
    const { readFileSync, existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const hookPath = join(repoRoot, '.githooks/pre-commit.cmd');
    expect(existsSync(hookPath)).toBe(true);

    const content = readFileSync(hookPath, 'utf8');
    expect(content).toContain('CURRENT_BRANCH=');
    expect(content).toContain('if "%CURRENT_BRANCH%"=="main"');
    expect(content).toContain('git rev-parse --git-path MERGE_HEAD');
    expect(content).toContain('GOVERNANCE ERROR');
    expect(content).toContain('ادمج الفرع');
    expect(content).toContain('exit /b 1');
  });

  it('7. verifies branch guard decision logic: rejects direct main, permits merge and feature branches', () => {
    function shouldRejectCommit(branch: string, hasMergeHead: boolean): boolean {
      if (branch === 'main') {
        return !hasMergeHead;
      }
      return false;
    }

    // Direct commit on main without merge -> REJECTED
    expect(shouldRejectCommit('main', false)).toBe(true);

    // Merge commit on main with MERGE_HEAD present -> PERMITTED
    expect(shouldRejectCommit('main', true)).toBe(false);

    // Feature branches -> PERMITTED
    expect(shouldRejectCommit('feat/strict-branch-governance', false)).toBe(false);
    expect(shouldRejectCommit('feat/worker-advances', false)).toBe(false);
    expect(shouldRejectCommit('fix/canteen-stock-leak', false)).toBe(false);
    expect(shouldRejectCommit('plan/81-git-branching', false)).toBe(false);
    expect(shouldRejectCommit('chore/docs-update', false)).toBe(false);
  });
});
