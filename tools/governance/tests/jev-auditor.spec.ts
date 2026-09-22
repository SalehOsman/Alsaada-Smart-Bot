import { describe, expect, it } from 'vitest';
import { JEV_AUDIT_CATALOG, JEV_GOVERNANCE_WEIGHTS } from '../typesafe/audit-catalog.js';
import {
  evaluateBatchParallel,
  evaluateLocalHeuristics,
  evaluateWithSystemOne,
  generateSquadRouting,
  runJevAudit,
  type DimensionResult,
} from '../jev-auditor.js';

describe('JEV Auditor & TypeSafe Governance Suite', () => {
  describe('1. Audit Catalog & 6 TypeSafe Capabilities', () => {
    it('contains all 11 categories in the audit catalog', () => {
      const categories = Object.keys(JEV_AUDIT_CATALOG);
      expect(categories).toContain('testAuthenticity');
      expect(categories).toContain('telegramUx');
      expect(categories).toContain('legacyParity');
      expect(categories).toContain('architecture');
      expect(categories).toContain('diffAudit');
      // The 6 advanced TypeSafe AI capabilities
      expect(categories).toContain('legacyFeatureDiscovery');
      expect(categories).toContain('speculativeFanOut');
      expect(categories).toContain('temporalInvariantGuard');
      expect(categories).toContain('semanticReuseSentinel');
      expect(categories).toContain('squadAutonomousRouter');
      expect(categories).toContain('docCodeDriftRadar');
    });

    it('has valid question types (noul, choice, score) across all questions', () => {
      for (const [categoryName, category] of Object.entries(JEV_AUDIT_CATALOG)) {
        for (const [questionName, question] of Object.entries(category)) {
          expect(['noul', 'choice', 'score'], `${categoryName}.${questionName} has invalid type`).toContain(
            (question as any).type
          );
          expect((question as any).instructions, `${categoryName}.${questionName} missing instructions`).toBeDefined();
        }
      }
    });

    it('verifies the 6 new TypeSafe questions and rubrics are properly structured', () => {
      // 1. legacyFeatureDiscovery
      expect(JEV_AUDIT_CATALOG.legacyFeatureDiscovery.hasUndiscoveredLegacyRules.type).toBe('noul');
      expect(JEV_AUDIT_CATALOG.legacyFeatureDiscovery.discoveryDepthScore.type).toBe('score');
      expect(JEV_AUDIT_CATALOG.legacyFeatureDiscovery.discoveryDepthScore.criteria.length).toBe(4);

      // 2. speculativeFanOut
      expect(JEV_AUDIT_CATALOG.speculativeFanOut.canSpeculativelyFanOut.type).toBe('noul');
      expect(JEV_AUDIT_CATALOG.speculativeFanOut.batchTopology.type).toBe('choice');
      expect(Object.keys(JEV_AUDIT_CATALOG.speculativeFanOut.batchTopology.criteria)).toContain('parallel_fan_out');

      // 3. temporalInvariantGuard
      expect(JEV_AUDIT_CATALOG.temporalInvariantGuard.violatesTemporalInvariants.type).toBe('noul');
      expect(JEV_AUDIT_CATALOG.temporalInvariantGuard.payrollCycleClassification.type).toBe('choice');
      expect(Object.keys(JEV_AUDIT_CATALOG.temporalInvariantGuard.payrollCycleClassification.criteria)).toContain(
        'canonical_cycle'
      );

      // 4. semanticReuseSentinel
      expect(JEV_AUDIT_CATALOG.semanticReuseSentinel.hasDuplicateDomainHelper.type).toBe('noul');
      expect(JEV_AUDIT_CATALOG.semanticReuseSentinel.reuseRecommendation.type).toBe('choice');
      expect(Object.keys(JEV_AUDIT_CATALOG.semanticReuseSentinel.reuseRecommendation.criteria)).toContain(
        'canonical_reuse'
      );

      // 5. squadAutonomousRouter
      expect(JEV_AUDIT_CATALOG.squadAutonomousRouter.responsibleSquad.type).toBe('choice');
      expect(Object.keys(JEV_AUDIT_CATALOG.squadAutonomousRouter.responsibleSquad.criteria)).toContain(
        'squad_finance_security'
      );
      expect(Object.keys(JEV_AUDIT_CATALOG.squadAutonomousRouter.responsibleSquad.criteria)).toContain(
        'squad_architecture_devops'
      );
      expect(JEV_AUDIT_CATALOG.squadAutonomousRouter.defectSeverityScore.type).toBe('score');

      // 6. docCodeDriftRadar
      expect(JEV_AUDIT_CATALOG.docCodeDriftRadar.hasDocCodeDrift.type).toBe('noul');
      expect(JEV_AUDIT_CATALOG.docCodeDriftRadar.documentationParityScore.type).toBe('score');
      expect(JEV_AUDIT_CATALOG.docCodeDriftRadar.documentationParityScore.criteria.length).toBe(4);
    });
  });

  describe('2. Governance Weights Invariants', () => {
    it('ensures all weights are positive numbers between 0 and 1', () => {
      for (const [key, weight] of Object.entries(JEV_GOVERNANCE_WEIGHTS)) {
        expect(typeof weight).toBe('number');
        expect(weight, `${key} must be > 0`).toBeGreaterThan(0);
        expect(weight, `${key} must be <= 1`).toBeLessThanOrEqual(1);
      }
    });

    it('ensures all 8 dimensions sum to exactly 1.0', () => {
      const dimensions = [
        JEV_GOVERNANCE_WEIGHTS.securityAndPrivacy,
        JEV_GOVERNANCE_WEIGHTS.architectureAndTypes,
        JEV_GOVERNANCE_WEIGHTS.telegramErgonomics,
        JEV_GOVERNANCE_WEIGHTS.testAuthenticity,
        JEV_GOVERNANCE_WEIGHTS.legacyParity,
        JEV_GOVERNANCE_WEIGHTS.temporalInvariants,
        JEV_GOVERNANCE_WEIGHTS.semanticReuse,
        JEV_GOVERNANCE_WEIGHTS.docCodeParity,
      ];

      const sum = dimensions.reduce((acc, curr) => acc + curr, 0);
      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-6);
    });
  });

  describe('3. Speculative Fan-Out & Parallel Execution', () => {
    it('evaluates multiple atomic questions concurrently in sub-200ms', async () => {
      const startTime = performance.now();
      const state = {
        code: `
          // Flow: Advance Request
          import { formatSpoiler } from '@alsaada/shared';
          const PINNED_BASE_TIME = '2026-09-01T00:00:00Z';
          export function handleAdvance() {
            return formatSpoiler('1500 EGP');
          }
        `,
      };

      const results = await evaluateBatchParallel(
        state,
        {
          canSpeculativelyFanOut: JEV_AUDIT_CATALOG.speculativeFanOut.canSpeculativelyFanOut,
          batchTopology: JEV_AUDIT_CATALOG.speculativeFanOut.batchTopology,
          violatesTemporalInvariants: JEV_AUDIT_CATALOG.temporalInvariantGuard.violatesTemporalInvariants,
          hasDuplicateDomainHelper: JEV_AUDIT_CATALOG.semanticReuseSentinel.hasDuplicateDomainHelper,
        },
        'heuristic'
      );

      const elapsed = performance.now() - startTime;
      expect(elapsed).toBeLessThan(200); // Sub-200ms speculative fan-out budget

      expect(results.canSpeculativelyFanOut).toBeDefined();
      expect(results.canSpeculativelyFanOut?.answer).toBe(true);
      expect(results.batchTopology?.answer).toBe('parallel_fan_out');
      expect(results.violatesTemporalInvariants?.answer).toBe(false);
      expect(results.hasDuplicateDomainHelper?.answer).toBe(false);
    });

    it('evaluateWithSystemOne delegates to evaluateBatchParallel', () => {
      expect(evaluateWithSystemOne).toBe(evaluateBatchParallel);
    });
  });

  describe('4. Deterministic AST Heuristics for the 6 Capabilities', () => {
    it('legacyFeatureDiscovery: flags unhandled legacy deductions and rates depth', async () => {
      const codeWithUndiscovered = `
        // TODO: legacy deduction rule missing for penalizing unreturned custody
      `;
      const res1 = await evaluateLocalHeuristics(
        { code: codeWithUndiscovered },
        {
          hasUndiscoveredLegacyRules: JEV_AUDIT_CATALOG.legacyFeatureDiscovery.hasUndiscoveredLegacyRules,
        }
      );
      expect(res1.hasUndiscoveredLegacyRules?.answer).toBe(true);

      const codeWithForensicDeduction = `
        function calculateDeduction(salary: number) {
          // Forensic F:\\HR deduction formula with penalty bounds
          const penalty = salary * 0.05;
          const allowance = 250;
          return validateDomainEntity(penalty + allowance);
        }
      `;
      const res2 = await evaluateLocalHeuristics(
        { code: codeWithForensicDeduction },
        {
          hasUndiscoveredLegacyRules: JEV_AUDIT_CATALOG.legacyFeatureDiscovery.hasUndiscoveredLegacyRules,
          discoveryDepthScore: JEV_AUDIT_CATALOG.legacyFeatureDiscovery.discoveryDepthScore,
        }
      );
      expect(res2.hasUndiscoveredLegacyRules?.answer).toBe(false);
      expect(res2.discoveryDepthScore?.answer).toBe(3);
    });

    it('temporalInvariantGuard: flags unpinned clocks and unanchored drift', async () => {
      const unpinnedCode = `
        it('tests payroll boundary', () => {
          const now = Date.now(); // UNPINNED CLOCK BREACH
          expect(now).toBeGreaterThan(0);
        });
      `;
      const resUnpinned = await evaluateLocalHeuristics(
        { code: unpinnedCode },
        {
          violatesTemporalInvariants: JEV_AUDIT_CATALOG.temporalInvariantGuard.violatesTemporalInvariants,
          payrollCycleClassification: JEV_AUDIT_CATALOG.temporalInvariantGuard.payrollCycleClassification,
        }
      );
      expect(resUnpinned.violatesTemporalInvariants?.answer).toBe(true);
      expect(resUnpinned.payrollCycleClassification?.answer).toBe('unanchored_drift');

      const pinnedCode = `
        const PINNED_BASE_TIME = '2026-09-26T00:00:00Z';
        // 26th to 25th canonical payroll_cycle
        const cycle = getPayrollCycle(PINNED_BASE_TIME);
      `;
      const resPinned = await evaluateLocalHeuristics(
        { code: pinnedCode },
        {
          violatesTemporalInvariants: JEV_AUDIT_CATALOG.temporalInvariantGuard.violatesTemporalInvariants,
          payrollCycleClassification: JEV_AUDIT_CATALOG.temporalInvariantGuard.payrollCycleClassification,
        }
      );
      expect(resPinned.violatesTemporalInvariants?.answer).toBe(false);
      expect(resPinned.payrollCycleClassification?.answer).toBe('canonical_cycle');
    });

    it('semanticReuseSentinel: flags duplicate helper implementations (Constitutional Rule 10.2)', async () => {
      const duplicateCode = `
        function formatCurrency(val: number): string {
          return val.toFixed(2) + ' EGP';
        }
      `;
      const resDup = await evaluateLocalHeuristics(
        { code: duplicateCode },
        {
          hasDuplicateDomainHelper: JEV_AUDIT_CATALOG.semanticReuseSentinel.hasDuplicateDomainHelper,
          reuseRecommendation: JEV_AUDIT_CATALOG.semanticReuseSentinel.reuseRecommendation,
        }
      );
      expect(resDup.hasDuplicateDomainHelper?.answer).toBe(true);
      expect(resDup.reuseRecommendation?.answer).toBe('redundant_duplicate');

      const reuseCode = `
        import { formatCurrency } from '@alsaada/shared';
      `;
      const resReuse = await evaluateLocalHeuristics(
        { code: reuseCode },
        {
          hasDuplicateDomainHelper: JEV_AUDIT_CATALOG.semanticReuseSentinel.hasDuplicateDomainHelper,
          reuseRecommendation: JEV_AUDIT_CATALOG.semanticReuseSentinel.reuseRecommendation,
        }
      );
      expect(resReuse.hasDuplicateDomainHelper?.answer).toBe(false);
      expect(resReuse.reuseRecommendation?.answer).toBe('canonical_reuse');
    });

    it('docCodeDriftRadar: detects drift between code and documentation', async () => {
      const driftCode = `
        // TODO: contract drift between flow.contract.json and code transitions
      `;
      const resDrift = await evaluateLocalHeuristics(
        { code: driftCode },
        {
          hasDocCodeDrift: JEV_AUDIT_CATALOG.docCodeDriftRadar.hasDocCodeDrift,
          documentationParityScore: JEV_AUDIT_CATALOG.docCodeDriftRadar.documentationParityScore,
        }
      );
      expect(resDrift.hasDocCodeDrift?.answer).toBe(true);
      expect(resDrift.documentationParityScore?.answer).toBe(1);

      const cleanCode = `
        // Flow state: SUBMITTED -> APPROVED matching flow.contract.json exactly
      `;
      const resClean = await evaluateLocalHeuristics(
        { code: cleanCode },
        {
          hasDocCodeDrift: JEV_AUDIT_CATALOG.docCodeDriftRadar.hasDocCodeDrift,
          documentationParityScore: JEV_AUDIT_CATALOG.docCodeDriftRadar.documentationParityScore,
        }
      );
      expect(resClean.hasDocCodeDrift?.answer).toBe(false);
      expect(resClean.documentationParityScore?.answer).toBe(3);
    });
  });

  describe('5. Autonomous Squad Routing & Corrective Directives', () => {
    it('returns "none" when overallVerdict is CERTIFIED PASS', () => {
      const routing = generateSquadRouting(
        {},
        [],
        'CERTIFIED PASS',
        'modules/custody/src/flows/01-custody-request'
      );
      expect(routing.responsibleSquad).toBe('none');
      expect(routing.directive).toContain('passed 100%');
    });

    it('hierarchically routes financial/security and temporal defects to squad-finance-security', () => {
      const routing = generateSquadRouting(
        {
          hasUnmaskedCompensation: { answer: true, confidence: 0.95 },
          violatesTemporalInvariants: { answer: true, confidence: 0.94 },
        },
        [],
        'REJECT',
        'modules/advance/src/flows/01-advance-request'
      );
      expect(routing.responsibleSquad).toBe('squad-finance-security');
      expect(routing.suggestedSkill).toBe('squad-finance-security');
      expect(routing.prompt).toContain('@squad-finance-security [Squad:Finance] [Security:Sentinel]');
      expect(routing.prompt).toContain('formatSpoiler');
      expect(routing.prompt).toContain('PINNED_BASE_TIME');
    });

    it('hierarchically routes layer leakage and architecture defects to squad-architecture-devops', () => {
      const dimensions: DimensionResult[] = [
        {
          name: '🏗️ Architecture & 10-File Slice Purity',
          gates: 'G1, G2, G4',
          score: 0.4,
          verdict: 'FAIL',
          confidence: 0.92,
          details: ['Layer leakage detected'],
        },
      ];
      const routing = generateSquadRouting(
        {
          layerResponsibilitySeparation: { answer: false, confidence: 0.96 },
        },
        dimensions,
        'REJECT',
        'modules/payroll/src/flows/01-payroll-run'
      );
      expect(routing.responsibleSquad).toBe('squad-architecture-devops');
      expect(routing.suggestedSkill).toBe('squad-architecture-devops');
      expect(routing.prompt).toContain('@squad-architecture-devops [Squad:Arch] [Arch:Monorepo]');
      expect(routing.prompt).toContain('vertical slice service layer');
    });

    it('hierarchically routes button label truncation to squad-implementation-ux', () => {
      const dimensions: DimensionResult[] = [
        {
          name: '📱 Telegram Mobile Ergonomics',
          gates: 'G5, G8, G22',
          score: 0.75,
          verdict: 'WARN',
          confidence: 0.91,
          details: ['Button label exceeds 16 chars'],
        },
      ];
      const routing = generateSquadRouting(
        {
          buttonLabelErgonomics: { answer: 'truncated', confidence: 0.91 },
        },
        dimensions,
        'CONDITIONAL PASS',
        'modules/canteen/src/flows/01-canteen-purchase'
      );
      expect(routing.responsibleSquad).toBe('squad-implementation-ux');
      expect(routing.suggestedSkill).toBe('squad-implementation-ux');
      expect(routing.prompt).toContain('@squad-implementation-ux [Squad:UX] [UX:Ergonomics]');
      expect(routing.prompt).toContain('16 characters');
    });

    it('hierarchically routes test authenticity and doc drift to squad-qa-migration', () => {
      const dimensions: DimensionResult[] = [
        {
          name: '🧪 Test Authenticity & Anti-Cheating',
          gates: 'G10, G23',
          score: 0.4,
          verdict: 'FAIL',
          confidence: 0.9,
          details: ['Superficial assertions'],
        },
        {
          name: '📡 Doc-Code Drift Radar & Bidirectional Citation',
          gates: 'G3, G4, G19',
          score: 0.5,
          verdict: 'FAIL',
          confidence: 0.92,
          details: ['Doc-code drift detected'],
        },
      ];
      const routing = generateSquadRouting(
        {
          assertsRealDomainState: { answer: false, confidence: 0.9 },
          hasDocCodeDrift: { answer: true, confidence: 0.92 },
        },
        dimensions,
        'REJECT',
        'modules/settlement/src/flows/01-settlement-request'
      );
      expect(routing.responsibleSquad).toBe('squad-qa-migration');
      expect(routing.suggestedSkill).toBe('squad-qa-migration');
      expect(routing.prompt).toContain('@squad-qa-migration [Squad:QA] [QA:Parity]');
      expect(routing.prompt).toContain('Assert real domain state mutations');
    });
  });

  describe('6. Full Audit Report & CGI Computation', () => {
    it('executes runJevAudit and returns all 8 dimensions with CGI calculation', async () => {
      const report = await runJevAudit({ skipTypecheck: true, engine: 'heuristic' });

      expect(report.targetName).toBeDefined();
      expect(report.dimensions.length).toBe(8);

      const dimensionNames = report.dimensions.map((d) => d.name);
      expect(dimensionNames.some((n) => n.includes('Security'))).toBe(true);
      expect(dimensionNames.some((n) => n.includes('Architecture'))).toBe(true);
      expect(dimensionNames.some((n) => n.includes('Telegram Mobile'))).toBe(true);
      expect(dimensionNames.some((n) => n.includes('Test Authenticity'))).toBe(true);
      expect(dimensionNames.some((n) => n.includes('Legacy Parity'))).toBe(true);
      expect(dimensionNames.some((n) => n.includes('Temporal Invariants'))).toBe(true);
      expect(dimensionNames.some((n) => n.includes('Semantic Reuse'))).toBe(true);
      expect(dimensionNames.some((n) => n.includes('Doc-Code Drift'))).toBe(true);

      expect(report.cgi).toBeGreaterThan(0);
      expect(report.cgi).toBeLessThanOrEqual(100);
      expect(['CERTIFIED PASS', 'CONDITIONAL PASS', 'REJECT']).toContain(report.overallVerdict);

      expect(report.physicalChecks.typecheck).toBeDefined();
      expect(typeof report.physicalChecks.maxButtonLabelChars).toBe('number');
      expect(report.physicalChecks.maxButtonLabelChars).toBeGreaterThan(0);
      expect(typeof report.physicalChecks.maxCallbackBytes).toBe('number');
      expect(report.physicalChecks.maxCallbackBytes).toBeGreaterThan(0);

      expect(report.squadRouting).toBeDefined();
    });
  });
});
