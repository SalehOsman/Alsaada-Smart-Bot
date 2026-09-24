import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = process.cwd();

describe('Work Plan 102: Sovereign Air-Gapped AI Development Standard & Zero-Network Dependency Invariant', () => {
  it('verifies .npmrc enforces prefer-offline=true and local store priority', () => {
    const npmrcPath = join(ROOT_DIR, '.npmrc');
    expect(existsSync(npmrcPath)).toBe(true);

    const content = readFileSync(npmrcPath, 'utf8');
    expect(content).toContain('prefer-offline=true');
    expect(content).toContain('verify-deps-before-run=false');
    expect(content).toContain('package-import-method=auto');
    expect(content).toContain('fetch-retries=2');
  });

  it('verifies pnpm-workspace.yaml restricts supportedArchitectures to win32 and linux on x64', () => {
    const workspacePath = join(ROOT_DIR, 'pnpm-workspace.yaml');
    expect(existsSync(workspacePath)).toBe(true);

    const content = readFileSync(workspacePath, 'utf8');
    expect(content).toContain('supportedArchitectures:');
    expect(content).toContain('- win32');
    expect(content).toContain('- linux');
    expect(content).toContain('- x64');
    expect(content).not.toContain('- darwin');
    expect(content).not.toContain('- android');
    expect(content).not.toContain('- openharmony');
    expect(content).not.toContain('- riscv64');
  });

  it('verifies package.json scripts preserve Docker BuildKit cache and expose docker:infra', () => {
    const pkgJsonPath = join(ROOT_DIR, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts['docker:bot']).toBeDefined();
    expect(pkg.scripts['docker:bot']).not.toContain('--no-cache');
    expect(pkg.scripts['docker:bot:fresh']).toContain('--no-cache');
    expect(pkg.scripts['docker:infra']).toBe('docker compose up -d postgres redis');
  });

  it('verifies Rulebook 10 and GEMINI.md codify the Zero-Network Development Invariant', () => {
    const rulebook10Path = join(
      ROOT_DIR,
      '.agents',
      'rules',
      '10-ai-agent-discipline-and-preflight.md'
    );
    const geminiPath = join(ROOT_DIR, 'GEMINI.md');

    const rulebookContent = readFileSync(rulebook10Path, 'utf8');
    const geminiContent = readFileSync(geminiPath, 'utf8');

    expect(rulebookContent).toContain('Zero-Network Development');
    expect(rulebookContent).toContain('supportedArchitectures');
    expect(geminiContent).toContain('Zero-Network Development');
  });

  it('verifies Work Plan 102 specification document exists with all 6 pillars', () => {
    const planPath = join(
      ROOT_DIR,
      'docs',
      'work-plans',
      '102-plan-air-gapped-development-discipline-and-zero-network-ai-invariant.md'
    );
    expect(existsSync(planPath)).toBe(true);

    const content = readFileSync(planPath, 'utf8');
    expect(content).toContain('Pillar 1');
    expect(content).toContain('Pillar 2');
    expect(content).toContain('Pillar 3');
    expect(content).toContain('Pillar 4');
    expect(content).toContain('Pillar 5');
    expect(content).toContain('Pillar 6');
  });
});
