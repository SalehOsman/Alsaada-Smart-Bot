import { describe, expect, it } from 'vitest';
import {
  auditPresentationCompliance,
  formatSalehVerdictReport,
  runSalehAuditSuite,
  verifyTripleGuardArsenal,
  verifyUnlockAuditProvenance,
  type SalehAuditReport,
} from '../saleh-audit-suite.js';
import { createResult, fail, warn } from '../common.js';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('tools/governance/saleh-audit-suite', () => {
  it('should scan flows and return presentation findings and flow count', () => {
    const { result, findings, flowCount } = auditPresentationCompliance();

    expect(flowCount).toBeGreaterThan(0);
    expect(result.checked).toBeGreaterThan(0);
    expect(Array.isArray(findings)).toBe(true);
  });

  it('should format a clean PASS verdict report', () => {
    const mockReport: SalehAuditReport = {
      verdict: 'PASS',
      timestamp: '2026-09-21T12:00:00.000Z',
      checkedTotals: {
        flows: 20,
        files: 2800,
        checks: 1250,
      },
      checkResults: {
        architecture: createResult(),
        telegramContracts: createResult(),
      },
      presentationFindings: [],
      summary: {
        passed: true,
        errorsCount: 0,
        warningsCount: 0,
      },
    };

    const formatted = formatSalehVerdictReport(mockReport);
    expect(formatted).toContain('## ⚖️ /saleh Forensic Audit Verdict: [PASS] ✅');
    expect(formatted).toContain('### 1. The Claim vs The Physical Reality');
    expect(formatted).toContain('### 2. Bullshit-Buster Findings');
    expect(formatted).toContain('### 3. Concrete Evidence');
    expect(formatted).toContain('### 4. Corrective Prompt (Ready to Copy)');
    expect(formatted).toContain('All quality gates and presentation contracts passed.');
    expect(formatted).toContain('[ ] **Presentation Bypass (Raw Replies):** Clean');
    expect(formatted).toContain('[ ] **Mobile Ergonomics (36/16/7/3):** Clean');
  });

  it('should format a REJECT verdict report with corrective directive when errors exist', () => {
    const archResult = createResult();
    fail(archResult, 'Missing 10-file vertical slice in test flow');

    const mockReport: SalehAuditReport = {
      verdict: 'REJECT',
      timestamp: '2026-09-21T12:00:00.000Z',
      checkedTotals: {
        flows: 20,
        files: 2800,
        checks: 1250,
      },
      checkResults: {
        architecture: archResult,
      },
      presentationFindings: [
        {
          file: 'modules/test/flow.handler.ts',
          line: 42,
          type: 'RAW_MESSAGE_BYPASS',
          severity: 'ERROR',
          message: 'Direct hardcoded raw string in ctx.reply()',
        },
        {
          file: 'modules/test/walkthrough.md',
          line: 1,
          type: 'MISSING_STATE_DIAGRAM',
          severity: 'WARNING',
          message: 'Missing Mermaid stateDiagram-v2',
        },
        {
          file: 'modules/test',
          line: 1,
          type: 'MISSING_PROTECT_CONTENT',
          severity: 'WARNING',
          message: 'Financial flow does not configure protect_content',
        },
      ],
      summary: {
        passed: false,
        errorsCount: 2,
        warningsCount: 2,
      },
    };

    const formatted = formatSalehVerdictReport(mockReport);
    expect(formatted).toContain('## ⚖️ /saleh Forensic Audit Verdict: [REJECT] 🚨');
    expect(formatted).toContain('[x] **Presentation Bypass (Raw Replies):** DETECTED');
    expect(formatted).toContain('[x] **Architecture & 10-File Slice (G2):** VIOLATIONS');
    expect(formatted).toContain('[x] **Content Protection (protect_content):** UNCONFIGURED');
    expect(formatted).toContain('[x] **Walkthrough State Diagrams (G22):** MISSING DIAGRAMS');
    expect(formatted).toContain('### 🎯 Corrective Directive from /saleh:');
    expect(formatted).toContain('Remove all hardcoded string literals and raw template strings');
    expect(formatted).toContain('Configure protect_content: true on financial');
    expect(formatted).toContain('Add Mermaid stateDiagram-v2 to walkthrough.md');
  });

  it('should report accurate flowCount even when only --arch is requested', async () => {
    const report = await runSalehAuditSuite({ arch: true });
    expect(report.checkedTotals.flows).toBeGreaterThan(0);
    expect(report.checkResults.architecture).toBeDefined();
    expect(report.checkResults.architecture?.ok).toBe(true);
    expect(report.checkResults.telegramContracts).toBeUndefined();
  });

  it('should run individual checks via runSalehAuditSuite options', async () => {
    const report = await runSalehAuditSuite({ telegram: true });
    expect(report.checkResults.telegramContracts).toBeDefined();
    expect(report.checkResults.telegramContracts?.ok).toBe(true);
    expect(report.checkResults.architecture).toBeUndefined();
  });

  describe('verifyUnlockAuditProvenance (WP 90)', () => {
    it('passes on repository evidence baseline', () => {
      const res = verifyUnlockAuditProvenance(process.cwd());
      expect(res.ok).toBe(true);
      expect(res.failures).toHaveLength(0);
    });

    it('detects AI self-authorization in unlock evidence lacking OTP nonce or human provenance', () => {
      const tempDir = join(tmpdir(), `saleh-unlock-test-${Date.now()}`);
      const evidenceDir = join(tempDir, 'docs', 'ai-execution-evidence');
      mkdirSync(evidenceDir, { recursive: true });

      // Create an illicit unlock file dated today without OTP nonce or human provenance
      const illicitFile = join(evidenceDir, '2026-09-21-unlock-package_test.md');
      writeFileSync(
        illicitFile,
        `# ترخيص فك قفل الحوكمة: (package:test)
- **التاريخ:** 2026-09-21
- **معرف الكيان المفكوك:** package:test
- **عبارة الاعتماد:** موافق على الفتح
## المبرر
Testing self authorization bypass`
      );

      const res = verifyUnlockAuditProvenance(tempDir);
      expect(res.ok).toBe(false);
      expect(res.failures.length).toBeGreaterThan(0);
      expect(res.failures[0]).toContain('lacks verified human OTP challenge provenance');

      rmSync(tempDir, { recursive: true, force: true });
    });

    it('passes for compliant unlock evidence containing OTP nonce and USER_EXPLICIT provenance', () => {
      const tempDir = join(tmpdir(), `saleh-unlock-valid-${Date.now()}`);
      const evidenceDir = join(tempDir, 'docs', 'ai-execution-evidence');
      mkdirSync(evidenceDir, { recursive: true });

      const validFile = join(evidenceDir, '2026-09-21-unlock-package_valid.md');
      writeFileSync(
        validFile,
        `# ترخيص فك قفل الحوكمة: (package:valid)
- **التاريخ:** 2026-09-21
- **معرف الكيان المفكوك:** package:valid
- **عبارة الاعتماد الصريحة المعتمدة:** **موافق على الفتح**
- **رمز التحدي لمرة واحدة (OTP Nonce):** \`UNLOCK-A4F1E2\`
- **مصدر الاعتماد والتحقق الجنائي:** \`USER_EXPLICIT\`
- **التوقيع الزمني لمدخل المستخدم:** \`2026-09-21T12:00:00.000Z\`
- **مبدأ العزل:** 🔒 **Zero Blast Radius**
## المبرر
Compliant justification reason`
      );

      const res = verifyUnlockAuditProvenance(tempDir);
      expect(res.ok).toBe(true);
      expect(res.failures).toHaveLength(0);

      rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('verifyTripleGuardArsenal', () => {
    it('verifies that the triple guard arsenal is intact and leak-free in real repo', () => {
      const res = verifyTripleGuardArsenal();
      expect(res.ok).toBe(true);
      expect(res.failures).toHaveLength(0);
      expect(res.checked).toBeGreaterThan(5);
    });

    it('fails when a SKILL.md is leaked inside arsenal directory', () => {
      const tempDir = join(tmpdir(), `saleh-arsenal-leak-${Date.now()}`);
      const arsenalDir = join(tempDir, '.agents', 'skills', 'saleh', 'arsenal');
      const cleanGuard = join(arsenalDir, 'clean-code-guard');
      const testGuard = join(arsenalDir, 'test-guard');
      const docsGuard = join(arsenalDir, 'docs-guard');
      mkdirSync(join(cleanGuard, 'references'), { recursive: true });
      mkdirSync(join(testGuard, 'references'), { recursive: true });
      mkdirSync(join(docsGuard, 'references'), { recursive: true });
      mkdirSync(join(tempDir, 'docs'), { recursive: true });

      writeFileSync(join(cleanGuard, 'rules.md'), '# Clean code');
      writeFileSync(join(testGuard, 'rules.md'), '# Test guard');
      writeFileSync(join(docsGuard, 'rules.md'), '# Docs guard');
      writeFileSync(join(tempDir, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md'), '# Docs 19');
      writeFileSync(join(tempDir, 'docs', '26-locked-flows-and-features-registry.md'), '# Docs 26');

      // Add a leaked SKILL.md
      writeFileSync(join(cleanGuard, 'SKILL.md'), '--- name: leaked ---');

      const res = verifyTripleGuardArsenal(tempDir);
      expect(res.ok).toBe(false);
      expect(res.failures.some((f) => f.includes('Public skill leakage detected'))).toBe(true);

      rmSync(tempDir, { recursive: true, force: true });
    });
  });
});

