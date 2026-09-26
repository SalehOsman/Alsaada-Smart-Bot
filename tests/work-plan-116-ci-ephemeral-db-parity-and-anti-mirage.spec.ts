import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Work Plan 116 — CI Ephemeral DB Parity, Dynamic Governance & Anti-Mirage Invariants', () => {
  const root = process.cwd();

  describe('Pillar 1: Anti-Mirage Constitution & Methodology Governance (Rulebook 13)', () => {
    it('verifies that Rulebook 13 exists and contains all 4 Anti-Mirage Invariants', () => {
      const rulebookPath = join(root, '.agents/rules/13-ai-agent-methodology-and-anti-mirage-constitution.md');
      expect(existsSync(rulebookPath)).toBe(true);

      const content = readFileSync(rulebookPath, 'utf8');
      expect(content).toContain('Rulebook 13');
      expect(content).toContain('Anti-Local Green Mirage Invariant');
      expect(content).toContain('Anti-Symptom Chasing Invariant');
      expect(content).toContain('Anti-Hardcoded Counter Trap Invariant');
      expect(content).toContain('Mandatory Zero-State Simulation Invariant');
    });

    it('verifies that GEMINI.md codifies Section 7.2 Anti-Mirage Constitution', () => {
      const geminiPath = join(root, 'GEMINI.md');
      expect(existsSync(geminiPath)).toBe(true);

      const content = readFileSync(geminiPath, 'utf8');
      expect(content).toContain('### 7.2 الإلزام الدستوري الصارم بميثاق منهجية وكلاء الذكاء الاصطناعي وحظر السراب البرمجي');
      expect(content).toContain('Zero-Assumption Ephemeral Database Parity Invariant');
      expect(content).toContain('Zero-Mirage Diagnostic Invariant');
      expect(content).toContain('Monorepo Build Optimization Invariant');
      expect(content).toContain('Dynamic Set Governance Invariant');
    });

    it('verifies that AGENTS.md references Rulebook 13', () => {
      const agentsPath = join(root, 'AGENTS.md');
      expect(existsSync(agentsPath)).toBe(true);

      const content = readFileSync(agentsPath, 'utf8');
      expect(content).toContain('.agents/rules/13-ai-agent-methodology-and-anti-mirage-constitution.md');
    });

    it('verifies that sovereign-skill-graph.json links Rulebook 13 and WP 116', () => {
      const graphPath = join(root, '.agents/knowledge/sovereign-skill-graph.json');
      expect(existsSync(graphPath)).toBe(true);

      const graph = JSON.parse(readFileSync(graphPath, 'utf8'));
      const jevSkill = graph.skills?.find((s: { skillId: string }) => s.skillId === 'jev');
      expect(jevSkill).toBeDefined();
      expect(jevSkill.linkedRulebooks).toContain('13');
      expect(jevSkill.linkedWorkPlans).toContain('116');
    });
  });

  describe('Pillar 2: CI Ephemeral Database Parity & Prisma 7 Migration Discovery', () => {
    it('verifies that packages/database/package.json explicitly passes schema to migrate commands', () => {
      const dbPkgPath = join(root, 'packages/database/package.json');
      expect(existsSync(dbPkgPath)).toBe(true);

      const dbPkg = JSON.parse(readFileSync(dbPkgPath, 'utf8'));
      expect(dbPkg.scripts['db:migrate']).toContain('--schema=prisma/schema.prisma');
      expect(dbPkg.scripts['db:migrate:dev']).toContain('--schema=prisma/schema.prisma');
      expect(dbPkg.scripts['db:push']).toContain('--schema=prisma/schema.prisma');
    });

    it('verifies that all 10 enterprise migrations physically exist in prisma/migrations', () => {
      const migrationsDir = join(root, 'packages/database/prisma/migrations');
      expect(existsSync(migrationsDir)).toBe(true);

      const migrationDirs = readdirSync(migrationsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      expect(migrationDirs.length).toBeGreaterThanOrEqual(10);
      expect(migrationDirs).toContain('20260911000000_init_enterprise_hash_ledger');
      expect(migrationDirs).toContain('20260918_immutable_financial_ledger_triggers');
      expect(migrationDirs).toContain('20260925210000_single_company_nullable_tenant');
    });
  });

  describe('Pillar 3: Dynamic Set Governance Invariants (Anti-Hardcoded Counters)', () => {
    it('verifies that unified-lock-engine.spec.ts uses dynamic set assertions instead of brittle scalar equality', () => {
      const lockSpecPath = join(root, 'tools/governance/tests/unified-lock-engine.spec.ts');
      expect(existsSync(lockSpecPath)).toBe(true);

      const content = readFileSync(lockSpecPath, 'utf8');
      expect(content).not.toContain('expect(targets.length).toBe(hasSandbox ? 367 : 360)');
      expect(content).not.toContain('expect(tests.length).toBe(hasSandbox ? 293 : 289)');
      expect(content).toContain('toBeGreaterThanOrEqual');
      expect(content).toContain('new Set(targets).size');
    });
  });

  describe('Pillar 4: Container Build Performance & Dockerfile Optimization', () => {
    it('verifies that Dockerfile does not disable hardlinks with package-import-method copy', () => {
      const dockerfilePath = join(root, 'docker/Dockerfile');
      expect(existsSync(dockerfilePath)).toBe(true);

      const content = readFileSync(dockerfilePath, 'utf8');
      expect(content).not.toContain('package-import-method copy');
    });

    it('verifies that Dockerfile leverages BuildKit cache mount and network concurrency for pnpm', () => {
      const dockerfilePath = join(root, 'docker/Dockerfile');
      const content = readFileSync(dockerfilePath, 'utf8');

      expect(content).toContain('--mount=type=cache,id=pnpm-store');
      expect(content).toContain('network-concurrency');
      expect(content).toContain('fetch-retries');
    });
  });

  describe('Pillar 5: JEV Sentinel Anti-Mirage Armory', () => {
    it('verifies that jev/SKILL.md defines Capability 20 (Anti-Mirage Sentinel)', () => {
      const jevSkillPath = join(root, '.agents/skills/jev/SKILL.md');
      expect(existsSync(jevSkillPath)).toBe(true);

      const content = readFileSync(jevSkillPath, 'utf8');
      expect(content).toContain('### 20. Anti-Mirage Constitution & Methodology Sentinel (`antiMirageSentinel`)');
      expect(content).toContain('Work Plan 116');
      expect(content).toContain('Rulebook 13');
    });
  });
});
