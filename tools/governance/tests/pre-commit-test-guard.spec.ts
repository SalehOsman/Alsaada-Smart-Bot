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
});
