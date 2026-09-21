import { describe, expect, it } from 'vitest';
import {
  auditPresentationCompliance,
  formatSalehVerdictReport,
  runSalehAuditSuite,
  type SalehAuditReport,
} from '../saleh-audit-suite.js';
import { createResult, fail, warn } from '../common.js';

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
});
