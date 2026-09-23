import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EXPECTED_SKILL_IDS,
  querySkillGraphForTask,
  readSkillGraph,
  verifySkillGraph,
} from '../verify-skill-graph.js';
import {
  analyzeCodeWithAst,
  collectFlowTestFiles,
  runJevAudit,
} from '../jev-auditor.js';
import { JEV_AUDIT_CATALOG, JEV_GOVERNANCE_WEIGHTS } from '../typesafe/audit-catalog.js';

describe('JEV Permanent Skill Consultant & Sovereign Knowledge Graph (WP 96)', () => {
  const root = process.cwd();

  describe('1. Sovereign Skill Graph Integrity & Taxonomy', () => {
    it('successfully loads and validates sovereign-skill-graph.json', () => {
      const graph = readSkillGraph(root);
      expect(graph.version).toBe('1.0.0');
      expect(graph.totalSkills).toBe(11);
      expect(graph.skills.length).toBe(11);
    });

    it('contains all 11 expected skills with zero orphan skills', () => {
      const result = verifySkillGraph(root);
      expect(result.failures).toEqual([]);
      expect(result.checked).toBeGreaterThanOrEqual(300);
    });

    it('ensures each skill file path physically exists on disk and is non-empty', () => {
      const graph = readSkillGraph(root);
      for (const skill of graph.skills) {
        const absPath = join(root, skill.skillFilePath);
        expect(existsSync(absPath), `Skill [${skill.skillId}] file missing: ${skill.skillFilePath}`).toBe(true);

        // Triple Guard Arsenal files must be named rules.md to prevent public skill leakage
        if (skill.category === 'arsenal_guard') {
          expect(skill.skillFilePath.endsWith('rules.md')).toBe(true);
        }
      }
    });

    it('verifies all linked rulebooks, work plans, and quality gates are valid', () => {
      const graph = readSkillGraph(root);
      for (const skill of graph.skills) {
        expect(skill.linkedRulebooks.length).toBeGreaterThan(0);
        expect(skill.linkedWorkPlans.length).toBeGreaterThan(0);
        expect(skill.enforcedQualityGates.length).toBeGreaterThan(0);

        for (const gate of skill.enforcedQualityGates) {
          expect(/^G(?:[1-9]|1[0-9]|2[0-3])$/.test(gate), `Invalid gate: ${gate}`).toBe(true);
        }
      }
    });

    it('verifies all JEV consultation questions exist in JEV_AUDIT_CATALOG', () => {
      const graph = readSkillGraph(root);
      for (const skill of graph.skills) {
        for (const qPath of skill.jevConsultationQuestions) {
          const [cat, qName] = qPath.split('.');
          const category = (JEV_AUDIT_CATALOG as Record<string, Record<string, unknown>>)[cat!];
          expect(category, `Unknown category [${cat}] in skill [${skill.skillId}]`).toBeDefined();
          expect(category![qName!], `Unknown question [${qName}] in category [${cat}]`).toBeDefined();
        }
      }
    });
  });

  describe('2. Task Query API (querySkillGraphForTask)', () => {
    it('returns filtered skills, rulebooks, gates, and checklists when querying specific skill IDs', () => {
      const summary = querySkillGraphForTask({
        skillIds: ['saleh', 'jev'],
        root,
      });

      expect(summary.skills.length).toBe(2);
      expect(summary.skills.map((s) => s.skillId)).toContain('saleh');
      expect(summary.skills.map((s) => s.skillId)).toContain('jev');

      expect(summary.allRulebooks.length).toBeGreaterThan(0);
      expect(summary.allGates.length).toBeGreaterThan(0);
      expect(summary.preTaskChecklist.length).toBeGreaterThan(0);
      expect(summary.postTaskChecklist.length).toBeGreaterThan(0);
      expect(summary.jevQuestions.length).toBeGreaterThan(0);
    });

    it('returns full sovereign skill graph summary when querying without filters', () => {
      const summary = querySkillGraphForTask({ root });
      expect(summary.skills.length).toBe(11);
      expect(summary.allRulebooks).toContain('01');
      expect(summary.allRulebooks).toContain('12');
      expect(summary.allGates).toContain('G1');
      expect(summary.allGates).toContain('G23');
    });

    it('throws an error when querying an unrecognized skill ID', () => {
      expect(() =>
        querySkillGraphForTask({
          skillIds: ['unknown-invalid-skill'],
          root,
        })
      ).toThrow(/Unrecognized skill ID/);
    });
  });

  describe('3. Test Discovery & State Blindness Resolution', () => {
    it('discovers tests for a flow in modules/<mod>/tests/flows/*.spec.ts', () => {
      const flowDir = join(root, 'modules', 'sandbox', 'src', 'flows', '99.1-sandbox-ping');
      const testFiles = collectFlowTestFiles(flowDir, root);

      expect(testFiles.length).toBeGreaterThan(0);
      expect(testFiles.some((f) => f.includes('99.1-sandbox-ping.spec.ts'))).toBe(true);
    });

    it('returns empty array when a flow has no matching test file (no test stealing)', () => {
      const nonExistentFlowDir = join(root, 'modules', 'sandbox', 'src', 'flows', 'non-existent-flow-12345');
      const testFiles = collectFlowTestFiles(nonExistentFlowDir, root);
      expect(testFiles).toEqual([]);
    });

    it('resolves real test assertions and avoids false test-authenticity failures', async () => {
      const report = await runJevAudit(
        {
          flowPath: 'modules/sandbox/src/flows/99.1-sandbox-ping',
          skipTypecheck: true,
          engine: 'heuristic',
        },
        root
      );

      expect(report.physicalChecks.assertionsVerified).toBeGreaterThan(0);
      const testDim = report.dimensions.find((d) => d.name.includes('Test Authenticity'));
      expect(testDim).toBeDefined();
      expect(testDim!.verdict).toBe('PASS');
      expect(testDim!.score).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('4. Permanent Pre/Mid/Post Skill Consultation (--consult)', () => {
    it('generates consultationScorecard with plan readiness score and checklists', async () => {
      const report = await runJevAudit(
        {
          consult: true,
          skipTypecheck: true,
          engine: 'heuristic',
        },
        root
      );

      expect(report.consultationScorecard).toBeDefined();
      const scorecard = report.consultationScorecard!;
      expect(scorecard.planReadinessScore).toBeGreaterThanOrEqual(75);
      expect(scorecard.skillsCovered.length).toBeGreaterThanOrEqual(5);
      expect(scorecard.preTaskChecklist.length).toBeGreaterThan(0);
      expect(scorecard.postTaskChecklist.length).toBeGreaterThan(0);
    });

    it('returns planReadinessScore 0 and REJECT when consultSkill has an invalid skill ID', async () => {
      const report = await runJevAudit(
        {
          consult: true,
          consultSkill: 'non-existent-skill',
          skipTypecheck: true,
          engine: 'heuristic',
        },
        root
      );
      expect(report.overallVerdict).toBe('REJECT');
      expect(report.consultationScorecard?.planReadinessScore).toBe(0);
      expect(report.consultationScorecard?.preTaskChecklist[0]).toContain('FAILED');
    });

    it('returns planReadinessScore 0 and REJECT when consultPlan points to non-existent file', async () => {
      const report = await runJevAudit(
        {
          consult: true,
          consultPlan: 'docs/work-plans/non-existent-plan-999.md',
          skipTypecheck: true,
          engine: 'heuristic',
        },
        root
      );
      expect(report.overallVerdict).toBe('REJECT');
      expect(report.consultationScorecard?.planReadinessScore).toBe(0);
      expect(report.consultationScorecard?.preTaskChecklist[0]).toContain('FAILED');
    });

    it('evaluates real work plan with 6-pillar completeness and returns readiness >= 90', async () => {
      const report = await runJevAudit(
        {
          consult: true,
          consultPlan: 'docs/work-plans/96-plan-jev-permanent-skill-consultant-and-knowledge-graph.md',
          skipTypecheck: true,
          engine: 'heuristic',
        },
        root
      );
      expect(report.consultationScorecard).toBeDefined();
      expect(report.consultationScorecard!.planReadinessScore).toBeGreaterThanOrEqual(90);
      expect(report.consultationScorecard!.preTaskChecklist.some((item) => item.includes('6-Pillar Analysis'))).toBe(true);
    });
  });

  describe('5. CGI v2.0 Dimension Weights Calibration', () => {
    it('verifies all 10 governance dimensions sum to exactly 1.00', () => {
      const sum =
        JEV_GOVERNANCE_WEIGHTS.securityAndPrivacy +
        JEV_GOVERNANCE_WEIGHTS.architectureAndTypes +
        JEV_GOVERNANCE_WEIGHTS.telegramErgonomics +
        JEV_GOVERNANCE_WEIGHTS.testAuthenticity +
        JEV_GOVERNANCE_WEIGHTS.legacyParity +
        JEV_GOVERNANCE_WEIGHTS.temporalInvariants +
        JEV_GOVERNANCE_WEIGHTS.semanticReuse +
        JEV_GOVERNANCE_WEIGHTS.docCodeParity +
        JEV_GOVERNANCE_WEIGHTS.observabilityAndG9 +
        JEV_GOVERNANCE_WEIGHTS.triLifecycleAndRichMessage;

      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-9);
    });
  });

  describe('6. AST Analysis & Raw Message Bypass Guard', () => {
    it('flags hasRawMessageBypass and richMessageCompliance false on raw ctx.reply call', () => {
      const rawCode = `
        export async function handleAction(ctx: any) {
          await ctx.reply("هذه رسالة نصية مجردة غير مطابقة للعقد الموحد");
        }
      `;
      const ast = analyzeCodeWithAst(rawCode, 'modules/demo/src/flows/demo/action.handler.ts');
      expect(ast.hasRawMessageBypass).toBe(true);
      expect(ast.richMessageCompliance).toBe(false);
    });

    it('passes richMessageCompliance when using official rich message builder without raw bypass', () => {
      const validCode = `
        import { buildRichPage } from '@alsaada/core-components/rich-message';
        export async function handleAction(ctx: any) {
          const page = buildRichPage({ title: 'Success' });
        }
      `;
      const ast = analyzeCodeWithAst(validCode, 'modules/demo/src/flows/demo/action.handler.ts');
      expect(ast.hasRawMessageBypass).toBe(false);
      expect(ast.richMessageCompliance).toBe(true);
    });
  });
});
