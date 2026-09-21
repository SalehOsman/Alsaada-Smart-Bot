import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import {
  createResult,
  fail,
  warn,
  isCliEntrypoint,
  listFilesRecursive,
  listFlowDirs,
  readUtf8,
  toRepoPath,
  type VerificationResult,
} from './common.js';
import { verifyArchitecture } from './verify-architecture.js';
import { verifyTelegramContracts } from './verify-telegram-contracts.js';
import { verifyTestAuthenticity } from './verify-test-authenticity.js';
import { verifyFieldMasking } from './verify-field-masking.js';
import { checkCodeSecurity } from './verify-code-security.js';

// ============================================================================
// Types & Contracts
// ============================================================================

export type AuditVerdict = 'PASS' | 'CONDITIONAL PASS' | 'REJECT';

export interface PresentationFinding {
  file: string;
  line: number;
  type:
    | 'RAW_MESSAGE_BYPASS'
    | 'MISSING_PRESENTATION_IMPORT'
    | 'MISSING_BREADCRUMBS'
    | 'UNMASKED_SENSITIVE_DATA'
    | 'MISSING_PROTECT_CONTENT'
    | 'MESSAGE_CHUNKING_OVERFLOW'
    | 'BUTTON_LABEL_OVERFLOW'
    | 'KEYBOARD_BUDGET_OVERFLOW'
    | 'MISSING_STATE_DIAGRAM';
  severity: 'ERROR' | 'WARNING';
  message: string;
}

export interface SalehAuditReport {
  verdict: AuditVerdict;
  timestamp: string;
  checkedTotals: {
    flows: number;
    files: number;
    checks: number;
  };
  checkResults: {
    presentation?: VerificationResult | undefined;
    architecture?: VerificationResult | undefined;
    telegramContracts?: VerificationResult | undefined;
    testAuthenticity?: VerificationResult | undefined;
    fieldMasking?: VerificationResult | undefined;
    security?: VerificationResult | undefined;
  };
  presentationFindings: PresentationFinding[];
  summary: {
    passed: boolean;
    errorsCount: number;
    warningsCount: number;
  };
}

// ============================================================================
// 1. AST Presentation & Telegram Mobile Ergonomics Sentinel
// ============================================================================

const ARABIC_UNICODE_REGEX = /[\u0600-\u06FF]/;
const FINANCIAL_FLOW_KEYWORDS = ['salary', 'payout', 'compensation', 'wage', 'advance', 'custody', 'expense', 'settlement', 'financial'];
const MAX_MESSAGE_TEXT_LENGTH = 4096;

function extractLiteralStringsFromNode(node: ts.Node): string[] {
  const strings: string[] = [];

  const extract = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const text = n.text.trim();
      if (text) strings.push(text);
    } else if (ts.isTemplateExpression(n)) {
      if (n.head.text.trim()) strings.push(n.head.text.trim());
      for (const span of n.templateSpans) {
        if (span.literal.text.trim()) strings.push(span.literal.text.trim());
        extract(span.expression);
      }
    } else if (ts.isBinaryExpression(n)) {
      extract(n.left);
      extract(n.right);
    } else if (ts.isConditionalExpression(n)) {
      extract(n.whenTrue);
      extract(n.whenFalse);
    } else if (ts.isParenthesizedExpression(n)) {
      extract(n.expression);
    }
  };

  extract(node);
  return strings;
}

function getReplyMethodInfo(callNode: ts.CallExpression): { methodName: string; textArgIndex: number } | null {
  if (!ts.isPropertyAccessExpression(callNode.expression)) return null;
  const methodName = callNode.expression.name.text;
  const parentExpr = callNode.expression.expression;

  const directMethods = new Set([
    'reply',
    'replyWithMarkdown',
    'replyWithHTML',
    'replyWithMarkdownV2',
    'editMessageText',
    'editMessageCaption',
  ]);

  if (directMethods.has(methodName)) {
    if (
      methodName === 'editMessageText' &&
      ts.isPropertyAccessExpression(parentExpr) &&
      parentExpr.name.text === 'api'
    ) {
      return { methodName: 'api.editMessageText', textArgIndex: 2 };
    }
    return { methodName, textArgIndex: 0 };
  }

  if (methodName === 'sendMessage') {
    return { methodName: 'sendMessage', textArgIndex: 1 };
  }

  return null;
}

export function auditPresentationCompliance(root: string = process.cwd()): {
  result: VerificationResult;
  findings: PresentationFinding[];
  flowCount: number;
} {
  const result = createResult();
  const findings: PresentationFinding[] = [];
  const repoRoot = resolve(root);
  const flowDirs = listFlowDirs(repoRoot);

  for (const flowDir of flowDirs) {
    const relativeFlowDir = toRepoPath(repoRoot, flowDir);
    const flowName = flowDir.split(/[\\/]/).pop() ?? '';
    const isFinancialFlow = FINANCIAL_FLOW_KEYWORDS.some((kw) => flowName.toLowerCase().includes(kw));

    // A. Check walkthrough.md / flow.docs.md for mandatory Mermaid stateDiagram-v2
    const walkthroughPath = join(flowDir, 'walkthrough.md');
    const flowDocsPath = join(flowDir, 'flow.docs.md');
    let hasStateDiagram = false;

    if (existsSync(walkthroughPath)) {
      result.checked++;
      const content = readUtf8(walkthroughPath);
      if (content.includes('stateDiagram-v2') || content.includes('stateDiagram')) {
        hasStateDiagram = true;
      }
    } else if (existsSync(flowDocsPath)) {
      result.checked++;
      const content = readUtf8(flowDocsPath);
      if (content.includes('stateDiagram-v2') || content.includes('stateDiagram')) {
        hasStateDiagram = true;
      }
    }

    if (!hasStateDiagram) {
      const targetFile = existsSync(walkthroughPath) ? walkthroughPath : flowDocsPath;
      const finding: PresentationFinding = {
        file: toRepoPath(repoRoot, targetFile),
        line: 1,
        type: 'MISSING_STATE_DIAGRAM',
        severity: 'WARNING',
        message: `Flow '${flowName}' walkthrough is missing mandatory Mermaid stateDiagram-v2 (Rule 07 Section 5)`,
      };
      findings.push(finding);
      warn(result, `[${finding.type}] ${finding.file}: ${finding.message}`);
    }

    // B. Check flow.messages.ts
    const messagesPath = join(flowDir, 'flow.messages.ts');
    if (!existsSync(messagesPath)) {
      const finding: PresentationFinding = {
        file: relativeFlowDir,
        line: 1,
        type: 'MISSING_PRESENTATION_IMPORT',
        severity: 'ERROR',
        message: `Flow '${flowName}' is missing required flow.messages.ts (Domain Rulebook 07 Section 1)`,
      };
      findings.push(finding);
      fail(result, `[${finding.type}] ${finding.file}: ${finding.message}`);
    } else {
      result.checked++;
      const relativePath = toRepoPath(repoRoot, messagesPath);
      const content = readUtf8(messagesPath);
      const sourceFile = ts.createSourceFile(messagesPath, content, ts.ScriptTarget.Latest, true);

      // Check imports: must import from @alsaada/core-components or @alsaada/regional-engine
      let hasPresentationImport = false;
      let hasBreadcrumbsUsage = false;
      let hasSpoilerUsage = false;

      ts.forEachChild(sourceFile, (node) => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          const importPath = node.moduleSpecifier.text;
          if (
            importPath.includes('@alsaada/core-components') ||
            importPath.includes('@alsaada/regional-engine') ||
            importPath.includes('telegram-formatters')
          ) {
            hasPresentationImport = true;
          }
          if (node.importClause && node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
            for (const spec of node.importClause.namedBindings.elements) {
              if (spec.name.text === 'formatBreadcrumbs') hasBreadcrumbsUsage = true;
              if (spec.name.text === 'formatSpoiler') hasSpoilerUsage = true;
            }
          }
        }
      });

      if (!hasPresentationImport) {
        const finding: PresentationFinding = {
          file: relativePath,
          line: 1,
          type: 'MISSING_PRESENTATION_IMPORT',
          severity: 'ERROR',
          message: `flow.messages.ts must import from @alsaada/core-components or @alsaada/regional-engine`,
        };
        findings.push(finding);
        fail(result, `[${finding.type}] ${finding.file}: ${finding.message}`);
      }

      if (!hasBreadcrumbsUsage && !content.includes('formatBreadcrumbs') && !content.includes('📍')) {
        const finding: PresentationFinding = {
          file: relativePath,
          line: 1,
          type: 'MISSING_BREADCRUMBS',
          severity: 'WARNING',
          message: `flow.messages.ts does not use formatBreadcrumbs for navigation header (Rule 07 Section 1)`,
        };
        findings.push(finding);
        warn(result, `[${finding.type}] ${finding.file}: ${finding.message}`);
      }

      // Check for financial flows missing spoiler masking
      if (isFinancialFlow && !hasSpoilerUsage && !content.includes('formatSpoiler') && !content.includes('||') && !content.includes('tg-spoiler')) {
        const finding: PresentationFinding = {
          file: relativePath,
          line: 1,
          type: 'UNMASKED_SENSITIVE_DATA',
          severity: 'WARNING',
          message: `Financial flow '${flowName}' does not use formatSpoiler or spoiler tags for net compensation (Gate G8, Rule 07 Section 2)`,
        };
        findings.push(finding);
        warn(result, `[${finding.type}] ${finding.file}: ${finding.message}`);
      }

      // Check message chunking limit (< 4096 characters)
      const checkMessageLength = (node: ts.Node) => {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
          if (node.text.length > MAX_MESSAGE_TEXT_LENGTH) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            const finding: PresentationFinding = {
              file: relativePath,
              line: line + 1,
              type: 'MESSAGE_CHUNKING_OVERFLOW',
              severity: 'ERROR',
              message: `Message template exceeds Telegram maximum message length of 4096 characters (${node.text.length} chars) (Rule 07 Section 2)`,
            };
            findings.push(finding);
            fail(result, `[${finding.type}] ${finding.file}:${finding.line}: ${finding.message}`);
          }
        }
        ts.forEachChild(node, checkMessageLength);
      };
      checkMessageLength(sourceFile);
    }

    // C. Check financial flows for protect_content: true
    if (isFinancialFlow) {
      let mentionsProtectContent = false;
      try {
        const flowEntries = readdirSync(flowDir, { withFileTypes: true });
        for (const entry of flowEntries) {
          if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.includes('.spec.') && !entry.name.includes('.test.')) {
            const fileText = readUtf8(join(flowDir, entry.name));
            if (fileText.includes('protect_content') || fileText.includes('protectContent')) {
              mentionsProtectContent = true;
              break;
            }
          }
        }
      } catch {
        // ignore read error
      }

      if (!mentionsProtectContent) {
        const finding: PresentationFinding = {
          file: relativeFlowDir,
          line: 1,
          type: 'MISSING_PROTECT_CONTENT',
          severity: 'WARNING',
          message: `Financial flow '${flowName}' does not configure protect_content: true for sensitive compensation data (Rule 07 Section 2)`,
        };
        findings.push(finding);
        warn(result, `[${finding.type}] ${finding.file}: ${finding.message}`);
      }
    }

    // D. Check all flow TypeScript files for raw message bypassing
    const flowFiles = listFilesRecursive(flowDir).filter((f) => {
      const norm = f.replace(/\\/g, '/');
      return (
        norm.endsWith('.ts') &&
        !norm.endsWith('flow.messages.ts') &&
        !norm.endsWith('flow.types.ts') &&
        !norm.includes('/tests/') &&
        !norm.includes('.spec.') &&
        !norm.includes('.test.')
      );
    });

    for (const filePath of flowFiles) {
      result.checked++;
      const relativePath = toRepoPath(repoRoot, filePath);
      const content = readUtf8(filePath);
      const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

      const inspectCallForRawReply = (node: ts.CallExpression) => {
        const methodInfo = getReplyMethodInfo(node);
        if (!methodInfo) return;

        const { methodName, textArgIndex } = methodInfo;
        if (node.arguments.length <= textArgIndex) return;

        const textArg = node.arguments[textArgIndex];
        if (!textArg) return;

        const stringLiterals = extractLiteralStringsFromNode(textArg);
        if (stringLiterals.length === 0) return;

        for (const text of stringLiterals) {
          const isArabic = ARABIC_UNICODE_REGEX.test(text) && text.length >= 3;
          const isLongEnglish = text.length > 25;

          if (isArabic || isLongEnglish) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(textArg.getStart());
            const snippet = text.length > 35 ? text.slice(0, 32) + '...' : text;
            const finding: PresentationFinding = {
              file: relativePath,
              line: line + 1,
              type: 'RAW_MESSAGE_BYPASS',
              severity: 'ERROR',
              message: `Direct hardcoded raw string "${snippet}" in ctx.${methodName}() bypasses Unified Presentation Library and flow.messages.ts`,
            };
            findings.push(finding);
            fail(result, `[${finding.type}] ${finding.file}:${finding.line}: ${finding.message}`);
            break; // Report once per call expression
          }
        }
      };

      const visitNode = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
          inspectCallForRawReply(node);
        }
        ts.forEachChild(node, visitNode);
      };

      visitNode(sourceFile);
    }

    // E. Check flow.keyboard.ts for 36/16/7/3 Mobile Ergonomics
    const keyboardPath = join(flowDir, 'flow.keyboard.ts');
    if (existsSync(keyboardPath)) {
      result.checked++;
      const relativePath = toRepoPath(repoRoot, keyboardPath);
      const content = readUtf8(keyboardPath);
      const sourceFile = ts.createSourceFile(keyboardPath, content, ts.ScriptTarget.Latest, true);

      const visitKeyboard = (node: ts.Node) => {
        // Inspect .text('Label', 'callback_data')
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
          const method = node.expression.name.text;
          if (method === 'text' && node.arguments.length >= 1) {
            const labelArg = node.arguments[0];
            if (labelArg && (ts.isStringLiteral(labelArg) || ts.isNoSubstitutionTemplateLiteral(labelArg))) {
              const label = labelArg.text.trim();
              if (label.length > 32) {
                const { line } = sourceFile.getLineAndCharacterOfPosition(labelArg.getStart());
                const finding: PresentationFinding = {
                  file: relativePath,
                  line: line + 1,
                  type: 'BUTTON_LABEL_OVERFLOW',
                  severity: 'WARNING',
                  message: `Button label "${label}" is ${label.length} characters (exceeds mobile viewport ergonomic limit of 16-32 chars)`,
                };
                findings.push(finding);
                warn(result, `[${finding.type}] ${finding.file}:${finding.line}: ${finding.message}`);
              }
            }

            // Check callback data budget (<= 36 bytes)
            if (node.arguments.length >= 2) {
              const cbArg = node.arguments[1];
              if (cbArg && (ts.isStringLiteral(cbArg) || ts.isNoSubstitutionTemplateLiteral(cbArg))) {
                const cb = cbArg.text;
                const byteLength = Buffer.byteLength(cb, 'utf8');
                if (byteLength > 36) {
                  const { line } = sourceFile.getLineAndCharacterOfPosition(cbArg.getStart());
                  const finding: PresentationFinding = {
                    file: relativePath,
                    line: line + 1,
                    type: 'KEYBOARD_BUDGET_OVERFLOW',
                    severity: byteLength > 64 ? 'ERROR' : 'WARNING',
                    message: `Callback data "${cb}" is ${byteLength} bytes (budget: <=36 bytes, hard limit: 64 bytes)`,
                  };
                  findings.push(finding);
                  if (byteLength > 64) {
                    fail(result, `[${finding.type}] ${finding.file}:${finding.line}: ${finding.message}`);
                  } else {
                    warn(result, `[${finding.type}] ${finding.file}:${finding.line}: ${finding.message}`);
                  }
                }
              }
            }
          }
        }

        ts.forEachChild(node, visitKeyboard);
      };

      visitKeyboard(sourceFile);
    }
  }

  return { result, findings, flowCount: flowDirs.length };
}

// ============================================================================
// 2. Comprehensive Forensic Audit Runner
// ============================================================================

export interface AuditSuiteOptions {
  root?: string | undefined;
  all?: boolean | undefined;
  presentation?: boolean | undefined;
  arch?: boolean | undefined;
  telegram?: boolean | undefined;
  tests?: boolean | undefined;
  fieldMasking?: boolean | undefined;
  security?: boolean | undefined;
  strict?: boolean | undefined;
  json?: boolean | undefined;
}

export async function runSalehAuditSuite(options: AuditSuiteOptions = {}): Promise<SalehAuditReport> {
  const root = resolve(options.root ?? process.cwd());
  const allFlowDirs = listFlowDirs(root);
  const totalFlowCount = allFlowDirs.length;
  const runAll = options.all ?? (!options.presentation && !options.arch && !options.telegram && !options.tests && !options.fieldMasking && !options.security);

  let presentationRes: VerificationResult | undefined;
  let presentationFindings: PresentationFinding[] = [];

  if (runAll || options.presentation) {
    const data = auditPresentationCompliance(root);
    presentationRes = data.result;
    presentationFindings = data.findings;
  }

  let archRes: VerificationResult | undefined;
  let telegramRes: VerificationResult | undefined;
  let testAuthRes: VerificationResult | undefined;
  let fieldMaskRes: VerificationResult | undefined;
  let securityRes: VerificationResult | undefined;

  if (runAll || options.arch) {
    archRes = verifyArchitecture(root);
  }

  if (runAll || options.telegram) {
    telegramRes = verifyTelegramContracts(root);
  }

  if (runAll || options.tests) {
    testAuthRes = verifyTestAuthenticity(root);
  }

  if (runAll || options.fieldMasking) {
    try {
      fieldMaskRes = await verifyFieldMasking(root);
    } catch (err) {
      fieldMaskRes = createResult();
      fail(fieldMaskRes, `Field masking verification threw error: ${String(err)}`);
    }
  }

  if (options.security) {
    securityRes = checkCodeSecurity();
  }

  // Aggregate errors & warnings
  const allResults: VerificationResult[] = [
    ...(presentationRes ? [presentationRes] : []),
    ...(archRes ? [archRes] : []),
    ...(telegramRes ? [telegramRes] : []),
    ...(testAuthRes ? [testAuthRes] : []),
    ...(fieldMaskRes ? [fieldMaskRes] : []),
    ...(securityRes ? [securityRes] : []),
  ];

  const totalErrors = allResults.reduce((acc, r) => acc + r.failures.length, 0);
  const totalWarnings = allResults.reduce((acc, r) => acc + r.warnings.length, 0);
  const totalChecked = allResults.reduce((acc, r) => acc + r.checked, 0);

  // Determine Verdict
  let verdict: AuditVerdict = 'PASS';
  if (totalErrors > 0) {
    verdict = 'REJECT';
  } else if (totalWarnings > 0) {
    verdict = options.strict ? 'REJECT' : 'CONDITIONAL PASS';
  }

  const checkResults: SalehAuditReport['checkResults'] = {};
  if (presentationRes) checkResults.presentation = presentationRes;
  if (archRes) checkResults.architecture = archRes;
  if (telegramRes) checkResults.telegramContracts = telegramRes;
  if (testAuthRes) checkResults.testAuthenticity = testAuthRes;
  if (fieldMaskRes) checkResults.fieldMasking = fieldMaskRes;
  if (securityRes) checkResults.security = securityRes;

  return {
    verdict,
    timestamp: new Date().toISOString(),
    checkedTotals: {
      flows: totalFlowCount,
      files: listFilesRecursive(root).filter((f) => !f.includes('node_modules') && !f.includes('.git')).length,
      checks: totalChecked,
    },
    checkResults,
    presentationFindings,
    summary: {
      passed: totalErrors === 0 && (!options.strict || totalWarnings === 0),
      errorsCount: totalErrors,
      warningsCount: totalWarnings,
    },
  };
}

// ============================================================================
// 3. Report Formatter (/saleh Radical Candor Template)
// ============================================================================

export function formatSalehVerdictReport(report: SalehAuditReport): string {
  const verdictEmoji = report.verdict === 'PASS' ? '✅' : report.verdict === 'CONDITIONAL PASS' ? '⚠️' : '🚨';
  const lines: string[] = [];

  lines.push(`## ⚖️ /saleh Forensic Audit Verdict: [${report.verdict}] ${verdictEmoji}`);
  lines.push('');
  lines.push('### 1. The Claim vs The Physical Reality');
  lines.push(`- **Audited Scope:** ${report.checkedTotals.flows} bot flows across ${report.checkedTotals.files} files (${report.checkedTotals.checks} individual AST/rule assertions).`);
  lines.push(`- **Physical Status:** ${report.summary.errorsCount} fatal failure(s), ${report.summary.warningsCount} warning(s).`);
  lines.push(`- **Audit Timestamp:** \`${report.timestamp}\``);
  lines.push('');

  lines.push('### 2. Bullshit-Buster Findings');
  const hasRawMessageBypass = report.presentationFindings.some((f) => f.type === 'RAW_MESSAGE_BYPASS');
  const hasKeyboardOverflow = report.presentationFindings.some((f) => f.type === 'KEYBOARD_BUDGET_OVERFLOW' || f.type === 'BUTTON_LABEL_OVERFLOW');
  const hasMissingStateDiagram = report.presentationFindings.some((f) => f.type === 'MISSING_STATE_DIAGRAM');
  const hasMissingProtectContent = report.presentationFindings.some((f) => f.type === 'MISSING_PROTECT_CONTENT');
  const hasChunkingOverflow = report.presentationFindings.some((f) => f.type === 'MESSAGE_CHUNKING_OVERFLOW');
  const hasShamAssertions = (report.checkResults.testAuthenticity?.failures.length ?? 0) > 0;
  const hasArchViolations = (report.checkResults.architecture?.failures.length ?? 0) > 0;
  const hasMaskingViolations = (report.checkResults.fieldMasking?.failures.length ?? 0) > 0;
  const hasTelegramContractFailures = (report.checkResults.telegramContracts?.failures.length ?? 0) > 0;

  lines.push(`- [${hasShamAssertions ? 'x' : ' '}] **Sham Assertions & Test Cheating:** ${hasShamAssertions ? 'DETECTED' : 'Clean (No fake assertions)'}`);
  lines.push(`- [${hasRawMessageBypass ? 'x' : ' '}] **Presentation Bypass (Raw Replies):** ${hasRawMessageBypass ? 'DETECTED' : 'Clean (Unified Library used)'}`);
  lines.push(`- [${hasKeyboardOverflow ? 'x' : ' '}] **Mobile Ergonomics (36/16/7/3):** ${hasKeyboardOverflow ? 'WARNINGS/OVERFLOWS' : 'Clean (Within budget)'}`);
  lines.push(`- [${hasArchViolations ? 'x' : ' '}] **Architecture & 10-File Slice (G2):** ${hasArchViolations ? 'VIOLATIONS' : 'Clean (100% compliant)'}`);
  lines.push(`- [${hasTelegramContractFailures ? 'x' : ' '}] **Telegram Contracts (G5):** ${hasTelegramContractFailures ? 'FAILURES' : 'Clean (Contracts intact)'}`);
  lines.push(`- [${hasMaskingViolations ? 'x' : ' '}] **Field Masking & Privacy (G8):** ${hasMaskingViolations ? 'LEAKS' : 'Clean (Role privacy intact)'}`);
  lines.push(`- [${hasMissingProtectContent ? 'x' : ' '}] **Content Protection (protect_content):** ${hasMissingProtectContent ? 'UNCONFIGURED' : 'Clean (Protected)'}`);
  lines.push(`- [${hasMissingStateDiagram ? 'x' : ' '}] **Walkthrough State Diagrams (G22):** ${hasMissingStateDiagram ? 'MISSING DIAGRAMS' : 'Clean (Diagrams present)'}`);
  if (hasChunkingOverflow) {
    lines.push(`- [x] **Message Chunking (>4096 chars):** OVERFLOW DETECTED`);
  }
  lines.push('');

  lines.push('### 3. Concrete Evidence');
  if (report.summary.errorsCount === 0 && report.summary.warningsCount === 0) {
    lines.push('All audited components passed physical inspection with 0 defects.');
  } else {
    for (const [checkName, res] of Object.entries(report.checkResults)) {
      if (!res) continue;
      if (res.failures.length > 0) {
        lines.push(`**[${checkName.toUpperCase()} FAILURES]:**`);
        for (const f of res.failures) lines.push(`- ❌ ${f}`);
      }
      if (res.warnings.length > 0) {
        lines.push(`**[${checkName.toUpperCase()} WARNINGS]:**`);
        for (const w of res.warnings) lines.push(`- ⚠️ ${w}`);
      }
    }
  }
  lines.push('');

  lines.push('### 4. Corrective Prompt (Ready to Copy)');
  if (report.verdict === 'PASS') {
    lines.push('> All quality gates and presentation contracts passed. No corrective action needed.');
  } else {
    lines.push('```markdown');
    lines.push('### 🎯 Corrective Directive from /saleh:');
    lines.push(`- **Status:** Please remediate the ${report.summary.errorsCount} error(s) and ${report.summary.warningsCount} warning(s) listed below.`);
    lines.push('- **Enforcement Standard:** Domain Rulebook 07 (Telegram UX) & GEMINI.md Part 8.');
    if (hasRawMessageBypass) {
      lines.push('- **Action Required:** Remove all hardcoded string literals and raw template strings from ctx.reply / editMessageText / sendMessage. Move all copy to flow.messages.ts using formatBreadcrumbs and Unified Presentation Library formatters.');
    }
    if (hasKeyboardOverflow) {
      lines.push('- **Action Required:** Fix button labels exceeding 16 chars and ensure callback data does not exceed 36 bytes.');
    }
    if (hasMissingProtectContent) {
      lines.push('- **Action Required:** Configure protect_content: true on financial and sensitive compensation messages (Rule 07 Section 2).');
    }
    if (hasMissingStateDiagram) {
      lines.push('- **Action Required:** Add Mermaid stateDiagram-v2 to walkthrough.md for each flow (Rule 07 Section 5).');
    }
    lines.push('- **Verification:** Run `tsx tools/governance/saleh-audit-suite.ts` to confirm 100% compliance.');
    lines.push('```');
  }

  return lines.join('\n');
}

// ============================================================================
// 4. CLI Entrypoint
// ============================================================================

if (isCliEntrypoint(import.meta.url)) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: tsx tools/governance/saleh-audit-suite.ts [options]

Options:
  --all             Run all audit checks (default)
  --presentation    Run Presentation & Telegram Ergonomics AST audit
  --arch            Run 10-File Architecture Slice audit
  --telegram        Run Telegram Contracts audit (callbacks, URLs)
  --tests           Run Test Authenticity & Sham Detection audit
  --field-masking   Run Field Masking & Privacy audit
  --security        Run Semgrep SAST security scan
  --strict          Treat warnings as failures (returns Exit 1 on warnings)
  --json            Output results as JSON
  --help, -h        Show this help message
    `);
    process.exit(0);
  }

  const options: AuditSuiteOptions = {
    all: args.includes('--all'),
    presentation: args.includes('--presentation') || args.includes('--ux'),
    arch: args.includes('--arch'),
    telegram: args.includes('--telegram'),
    tests: args.includes('--tests'),
    fieldMasking: args.includes('--field-masking'),
    security: args.includes('--security'),
    strict: args.includes('--strict'),
    json: args.includes('--json'),
  };

  runSalehAuditSuite(options)
    .then((report) => {
      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(formatSalehVerdictReport(report));
      }
      process.exit(report.summary.passed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Fatal error in saleh-audit-suite:', err);
      process.exit(1);
    });
}
