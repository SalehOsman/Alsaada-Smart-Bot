#!/usr/bin/env tsx
/**
 * 🛡️ TypeSafe Constitutional Test Sentinel
 *
 * Sovereign Test Quality & Physical Reality Auditor
 * Evaluates test files against the 7 Constitutional Test Rules (R1–R7):
 *   R1: Triple-A Structure (Arrange, Act, Assert explicit separation)
 *   R2: Zero Sham Assertions (Deep property evaluation, no empty checks)
 *   R3: Declarative Descriptive Naming (No 'should', purely descriptive)
 *   R4: Timeout Ceiling (<= 5000ms, zero real sleep delays)
 *   R5: Deterministic Clocks & RNG (PINNED_BASE_TIME, vi.setSystemTime, zero Date.now())
 *   R6: Console Silence (Silence stdout/stderr leakage)
 *   R7: Boundary & Negative Assertions (Assert forbidden roles/paths fail)
 *
 * Uses TypeSafe AI (System One Engine via https://api.typesafe.ai/v1/systemone)
 * when TYPESAFE_API_KEY is available, with full deterministic AST inspection.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { execSync } from 'node:child_process';
import ts from 'typescript';
import { listFilesRecursive } from './common.js';

export const RULE_NAMES = {
  R1: 'Triple-A Structure (Arrange, Act, Assert explicit separation)',
  R2: 'Zero Sham Assertions (Deep property evaluation, no empty checks)',
  R3: 'Declarative Descriptive Naming (No "should", purely descriptive)',
  R4: 'Timeout Ceiling (<= 5000ms, zero real sleep delays)',
  R5: 'Deterministic Clocks & RNG (PINNED_BASE_TIME, vi.setSystemTime)',
  R6: 'Console Silence (Silence stdout/stderr leakage)',
  R7: 'Boundary & Negative Assertions (Assert forbidden roles/paths fail)',
} as const;

export type ConstitutionalRule = keyof typeof RULE_NAMES;

export interface RuleViolation {
  rule: ConstitutionalRule;
  ruleName: string;
  message: string;
  line?: number;
}

export interface FileAuditResult {
  filePath: string;
  ok: boolean;
  violations: RuleViolation[];
  engine: 'TypeSafe AI System One' | 'Deterministic AST Sentinel';
}

/**
 * Perform deep AST and semantic analysis on a spec file.
 */
export function auditTestFileAST(filePath: string, content: string): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  let hasPinnedTime = false;
  let hasSetSystemTime = false;
  let hasNegativeAssertion = false;
  let hasConsoleSpiesOrSilence = false;

  // Track global patterns
  if (content.includes('PINNED_BASE_TIME')) {
    hasPinnedTime = true;
  }
  if (content.includes('vi.setSystemTime')) {
    hasSetSystemTime = true;
  }
  if (
    content.includes('spyOn(console') ||
    content.includes('vi.spyOn(process.stderr') ||
    content.includes('vi.spyOn(process.stdout') ||
    content.includes('silent:') ||
    content.includes('logger.silent')
  ) {
    hasConsoleSpiesOrSilence = true;
  }

  // Check R4: Real sleep delays (e.g., setTimeout in promise without fake timers)
  const realSleepRegex = /new Promise\s*\(\s*(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>\s*setTimeout\s*\(\s*(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*,\s*(\d+)\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = realSleepRegex.exec(content)) !== null) {
    const delay = parseInt(match[1] || '0', 10);
    if (delay > 50 && !content.includes('vi.useFakeTimers')) {
      const pos = sourceFile.getLineAndCharacterOfPosition(match.index);
      violations.push({
        rule: 'R4',
        ruleName: RULE_NAMES.R4,
        line: pos.line + 1,
        message: `Real sleep delay of ${delay}ms detected. Real delays must be replaced with vi.advanceTimersByTimeAsync.`,
      });
    }
  }

  let totalTests = 0;

  function visit(node: ts.Node) {
    // Check R5 & R6 via AST call expressions
    if (ts.isCallExpression(node)) {
      const expr = node.expression;

      // Check R5: Date.now() or Math.random() via AST
      if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression) && ts.isIdentifier(expr.name)) {
        if (expr.expression.text === 'Date' && expr.name.text === 'now') {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          violations.push({
            rule: 'R5',
            ruleName: RULE_NAMES.R5,
            line: line + 1,
            message: 'Unmocked Date.now() call detected. Direct clocks cause test flakiness. Use PINNED_BASE_TIME.',
          });
        }
        if (expr.expression.text === 'Math' && expr.name.text === 'random') {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          violations.push({
            rule: 'R5',
            ruleName: RULE_NAMES.R5,
            line: line + 1,
            message: 'Unseeded Math.random() call detected. Non-deterministic RNG causes test flakiness. Use a seeded PRNG or mock.',
          });
        }
        if (expr.expression.text === 'console' && ['log', 'error', 'warn'].includes(expr.name.text)) {
          if (!hasConsoleSpiesOrSilence) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            violations.push({
              rule: 'R6',
              ruleName: RULE_NAMES.R6,
              line: line + 1,
              message: `Direct console.${expr.name.text} call detected. Console output leaks noise into CI. Silence via vi.spyOn.`,
            });
          }
        }
      }

      // Detect test blocks: it('...', ...), test('...', ...), it.each(...)(...), test.each(...)(...)
      let isTest = false;
      let testName = '';

      if (ts.isIdentifier(expr) && (expr.text === 'it' || expr.text === 'test')) {
        isTest = true;
      } else if (
        ts.isPropertyAccessExpression(expr) &&
        ts.isIdentifier(expr.expression) &&
        (expr.expression.text === 'it' || expr.expression.text === 'test')
      ) {
        isTest = true;
      } else if (
        ts.isCallExpression(expr) &&
        ts.isPropertyAccessExpression(expr.expression) &&
        ts.isIdentifier(expr.expression.expression) &&
        (expr.expression.expression.text === 'it' || expr.expression.expression.text === 'test') &&
        expr.expression.name.text === 'each'
      ) {
        isTest = true;
      }

      if (isTest && node.arguments.length > 0) {
        totalTests++;
        const firstArg = node.arguments[0]!;
        if (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) {
          testName = firstArg.text;
        }

        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

        // Check R3: Declarative naming (no 'should')
        if (/\bshould\b/i.test(testName)) {
          violations.push({
            rule: 'R3',
            ruleName: RULE_NAMES.R3,
            line: line + 1,
            message: `Test title "${testName}" contains "should". Must use declarative phrasing (e.g. "rejects invalid id", "returns 200").`,
          });
        }

        // Check R4: Explicit timeout ceiling <= 5000ms
        if (node.arguments.length >= 3) {
          const timeoutArg = node.arguments[2];
          if (timeoutArg && ts.isNumericLiteral(timeoutArg)) {
            const timeoutVal = parseInt(timeoutArg.text, 10);
            if (timeoutVal > 5000) {
              violations.push({
                rule: 'R4',
                ruleName: RULE_NAMES.R4,
                line: line + 1,
                message: `Test timeout ${timeoutVal}ms exceeds constitutional ceiling of 5000ms.`,
              });
            }
          }
        }

        // Inspect the test body
        const body = node.arguments[1];
        if (body && (ts.isArrowFunction(body) || ts.isFunctionExpression(body))) {
          const bodyText = body.getText(sourceFile);

          // Check R1: Triple-A Structure (Arrange, Act, Assert)
          const hasArrange = /\/\/\s*(?:1\.?\s*)?Arrange/i.test(bodyText);
          const hasAct = /\/\/\s*(?:2\.?\s*)?Act/i.test(bodyText);
          const hasAssert = /\/\/\s*(?:3\.?\s*)?Assert/i.test(bodyText);

          // If the test has more than 2 statements but lacks Triple-A comments
          if (body.body && ts.isBlock(body.body)) {
            const statementCount = body.body.statements.length;
            if (statementCount >= 2 && (!hasArrange || !hasAct || !hasAssert)) {
              violations.push({
                rule: 'R1',
                ruleName: RULE_NAMES.R1,
                line: line + 1,
                message: `Test "${testName || 'unnamed'}" lacks explicit Triple-A separation (missing ${
                  [!hasArrange && 'Arrange', !hasAct && 'Act', !hasAssert && 'Assert'].filter(Boolean).join(', ')
                } markers).`,
              });
            }
          }

          // Count expect calls inside this test
          let expectCount = 0;
          function countExpects(n: ts.Node) {
            if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'expect') {
              expectCount++;
            }
            ts.forEachChild(n, countExpects);
          }
          ts.forEachChild(body, countExpects);

          if (expectCount === 0) {
            violations.push({
              rule: 'R2',
              ruleName: RULE_NAMES.R2,
              line: line + 1,
              message: `Test "${testName || 'unnamed'}" contains zero assertions. Sham test detected.`,
            });
          }
        }
      }

      // Check R2 & R7: Expect call checks
      if (ts.isPropertyAccessExpression(expr)) {
        const methodName = expr.name.text;

        // Check R2: Tautological assertions expect(true).toBe(true)
        if (methodName === 'toBe' || methodName === 'toEqual') {
          const expectCall = expr.expression;
          if (ts.isCallExpression(expectCall) && ts.isIdentifier(expectCall.expression) && expectCall.expression.text === 'expect') {
            const expectedArg = expectCall.arguments[0];
            const actualArg = node.arguments[0];
            if (expectedArg && actualArg && expectedArg.getText(sourceFile).trim() === actualArg.getText(sourceFile).trim()) {
              const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
              violations.push({
                rule: 'R2',
                ruleName: RULE_NAMES.R2,
                line: line + 1,
                message: `Tautological assertion: comparing '${expectedArg.getText(sourceFile)}' to itself.`,
              });
            }
          }
        }

        // Check R2: toBeGreaterThanOrEqual(0)
        if (methodName === 'toBeGreaterThanOrEqual') {
          const firstArg = node.arguments[0];
          if (firstArg && ts.isNumericLiteral(firstArg) && firstArg.text === '0') {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            violations.push({
              rule: 'R2',
              ruleName: RULE_NAMES.R2,
              line: line + 1,
              message: `Vacuous assertion 'toBeGreaterThanOrEqual(0)' passes for any non-negative value.`,
            });
          }
        }

        // Check R7: Negative assertions presence
        if (
          methodName === 'toThrow' ||
          methodName === 'rejects' ||
          methodName === 'toBeNull' ||
          methodName === 'toBeUndefined' ||
          methodName === 'toBeFalsy'
        ) {
          hasNegativeAssertion = true;
        }

        // Check for toBe(false) / toEqual(false)
        if (
          (methodName === 'toBe' || methodName === 'toEqual') &&
          node.arguments.length > 0 &&
          node.arguments[0]?.kind === ts.SyntaxKind.FalseKeyword
        ) {
          hasNegativeAssertion = true;
        }

        // Check for .not. modifier
        if (ts.isPropertyAccessExpression(expr.expression) && expr.expression.name.text === 'not') {
          hasNegativeAssertion = true;
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Check R5: PINNED_BASE_TIME requirement when time or dates are involved
  if ((content.includes('new Date(') || content.includes('Date.now()')) && !hasPinnedTime && !hasSetSystemTime) {
    violations.push({
      rule: 'R5',
      ruleName: RULE_NAMES.R5,
      message: 'Test file uses dates but lacks PINNED_BASE_TIME / vi.setSystemTime pinned clock initialization.',
    });
  }

  // Check R7: Boundary & Negative Assertions requirement
  if (totalTests > 0 && !hasNegativeAssertion && !content.includes('.not.') && !content.includes('rejects')) {
    violations.push({
      rule: 'R7',
      ruleName: RULE_NAMES.R7,
      message: 'Test suite lacks negative/boundary contrast assertions (missing .not., rejects, or error path validation).',
    });
  }

  return violations;
}

/**
 * Audit test file using TypeSafe AI System One if API key is present,
 * or fallback to deterministic AST analysis.
 */
export async function auditTestFile(filePath: string): Promise<FileAuditResult> {
  const fullPath = resolve(filePath);
  if (!existsSync(fullPath)) {
    return {
      filePath,
      ok: false,
      violations: [
        {
          rule: 'R1',
          ruleName: 'File Existence',
          message: `File not found: ${filePath}`,
        },
      ],
      engine: 'Deterministic AST Sentinel',
    };
  }

  const content = readFileSync(fullPath, 'utf8');
  let apiKey = process.env.TYPESAFE_API_KEY;

  if (!apiKey) {
    try {
      const regKey = execSync('powershell.exe -NoProfile -Command "[System.Environment]::GetEnvironmentVariable(\'TYPESAFE_API_KEY\', \'User\')"', { encoding: 'utf8' }).trim();
      if (regKey) {
        apiKey = regKey;
      }
    } catch {}
  }

  if (apiKey) {
    try {
      const payload = {
        state: content,
        model: 'jev-latest',
        questions: {
          r1_triple_a: {
            type: 'noul',
            instructions: 'Does this test file clearly structure test cases into Arrange, Act, and Assert stages with explicit comments or visual sections?',
          },
          r2_zero_sham: {
            type: 'noul',
            instructions: 'Is this test file completely free of empty assertions, vacuous checks, or tautologies like expect(true).toBe(true)?',
          },
          r3_declarative_naming: {
            type: 'noul',
            instructions: 'Do all test case names avoid the word "should" and describe behavior declaratively in plain language?',
          },
          r4_timeout: {
            type: 'noul',
            instructions: 'Does the test avoid real sleep delays like setTimeout and maintain a fast timeout ceiling?',
          },
          r5_deterministic_clock: {
            type: 'noul',
            instructions: 'Does the test use deterministic pinned clocks (PINNED_BASE_TIME or vi.setSystemTime) and avoid unpinned Date.now() or unseeded random?',
          },
          r6_console_silence: {
            type: 'noul',
            instructions: 'Does the test silence or spy on console.log, process stdout, and stderr to prevent unmuted log leakage?',
          },
          r7_negative_assertions: {
            type: 'noul',
            instructions: 'Does the test file include boundary, error, or negative contrast assertions (e.g. .not., rejects, or forbidden roles)?',
          },
          compliance_verdict: {
            type: 'choice',
            instructions: 'What is the constitutional compliance verdict for this test file?',
            criteria: {
              COMPLIANT: 'The test meets high quality standards, deterministic, Triple-A, and tests concrete outcomes',
              VIOLATING: 'The test violates quality rules such as unpinned clocks, missing negative assertions, or poor structure',
            },
          },
        },
      };

      const response = await fetch('https://api.typesafe.ai/v1/systemone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          model: string;
          answers: Record<string, { type: string; noul?: number; choice?: string; confidence?: number }>;
        };

        const ans = data.answers;
        const apiViolations: RuleViolation[] = [];

        if (ans.r1_triple_a && ans.r1_triple_a.noul !== undefined && ans.r1_triple_a.noul < 0.5) {
          apiViolations.push({
            rule: 'R1',
            ruleName: RULE_NAMES.R1,
            message: `[TypeSafe Jev: ${Math.round(ans.r1_triple_a.noul * 100)}% confidence] Test cases lack explicit Arrange, Act, Assert separation.`,
          });
        }
        if (ans.r2_zero_sham && ans.r2_zero_sham.noul !== undefined && ans.r2_zero_sham.noul < 0.5) {
          apiViolations.push({
            rule: 'R2',
            ruleName: RULE_NAMES.R2,
            message: `[TypeSafe Jev: ${Math.round(ans.r2_zero_sham.noul * 100)}% confidence] Sham or vacuous assertions detected.`,
          });
        }
        if (ans.r3_declarative_naming && ans.r3_declarative_naming.noul !== undefined && ans.r3_declarative_naming.noul < 0.5) {
          apiViolations.push({
            rule: 'R3',
            ruleName: RULE_NAMES.R3,
            message: `[TypeSafe Jev: ${Math.round(ans.r3_declarative_naming.noul * 100)}% confidence] Test names contain non-declarative phrasing or 'should'.`,
          });
        }
        if (ans.r4_timeout && ans.r4_timeout.noul !== undefined && ans.r4_timeout.noul < 0.5) {
          apiViolations.push({
            rule: 'R4',
            ruleName: RULE_NAMES.R4,
            message: `[TypeSafe Jev: ${Math.round(ans.r4_timeout.noul * 100)}% confidence] Test timeout ceiling or real sleep delays detected.`,
          });
        }
        if (ans.r5_deterministic_clock && ans.r5_deterministic_clock.noul !== undefined && ans.r5_deterministic_clock.noul < 0.5) {
          apiViolations.push({
            rule: 'R5',
            ruleName: RULE_NAMES.R5,
            message: `[TypeSafe Jev: ${Math.round(ans.r5_deterministic_clock.noul * 100)}% confidence] Unpinned Date.now() or unpinned clock usage detected.`,
          });
        }
        if (ans.r6_console_silence && ans.r6_console_silence.noul !== undefined && ans.r6_console_silence.noul < 0.5) {
          apiViolations.push({
            rule: 'R6',
            ruleName: RULE_NAMES.R6,
            message: `[TypeSafe Jev: ${Math.round(ans.r6_console_silence.noul * 100)}% confidence] Unmuted console.log or process stdout/stderr output detected.`,
          });
        }
        if (ans.r7_negative_assertions && ans.r7_negative_assertions.noul !== undefined && ans.r7_negative_assertions.noul < 0.5) {
          apiViolations.push({
            rule: 'R7',
            ruleName: RULE_NAMES.R7,
            message: `[TypeSafe Jev: ${Math.round(ans.r7_negative_assertions.noul * 100)}% confidence] Missing negative/boundary contrast assertions.`,
          });
        }

        // Complement with AST parser to provide exact source line numbers
        const astViolations = auditTestFileAST(filePath, content);
        const combined = [
          ...apiViolations,
          ...astViolations.filter((av) => !apiViolations.some((v) => v.rule === av.rule)),
        ];

        return {
          filePath,
          ok: combined.length === 0,
          violations: combined,
          engine: 'TypeSafe AI System One',
        };
      } else {
        const errText = await response.text();
        console.warn(`⚠️ [TypeSafe Sentinel Warning] API returned ${response.status}: ${errText}`);
      }
    } catch (err: any) {
      console.warn(`⚠️ [TypeSafe Sentinel Warning] Network error contacting TypeSafe API: ${err?.message}`);
    }
  }

  const violations = auditTestFileAST(filePath, content);
  return {
    filePath,
    ok: violations.length === 0,
    violations,
    engine: 'Deterministic AST Sentinel',
  };
}

/**
 * Helper to process items with limited concurrency
 */
async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      if (item !== undefined) {
        results[currentIndex] = await fn(item, currentIndex);
      }
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * CLI Runner
 */
async function main() {
  const args = process.argv.slice(2);
  const isJson = args.includes('--json');
  const concurrencyArg = args.find((a) => a.startsWith('--concurrency='));
  const concurrency = concurrencyArg ? Math.max(1, parseInt(concurrencyArg.split('=')[1] ?? '4', 10)) : 1;
  let filesToScan: string[] = [];

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
🛡️ TypeSafe Constitutional Test Sentinel
Usage:
  pnpm test:sentinel <file-or-dir> [more files...]
  pnpm test:sentinel --all [--concurrency=4]
  pnpm test:sentinel <file> --json
`);
    process.exit(0);
  }

  if (args.includes('--all')) {
    filesToScan = listFilesRecursive(process.cwd()).filter((f) => f.endsWith('.spec.ts') || f.endsWith('.test.ts'));
  } else {
    for (const arg of args) {
      if (arg.startsWith('--')) continue;
      const resolved = resolve(arg);
      if (existsSync(resolved)) {
        if (statSync(resolved).isDirectory()) {
          const files = listFilesRecursive(resolved).filter((f) => f.endsWith('.spec.ts') || f.endsWith('.test.ts'));
          filesToScan.push(...files);
        } else if (resolved.endsWith('.ts') || resolved.endsWith('.js')) {
          filesToScan.push(resolved);
        }
      }
    }
  }

  if (filesToScan.length === 0) {
    if (isJson) {
      console.log(JSON.stringify({ ok: true, filesCount: 0, results: [] }));
    } else {
      console.log('No test files found to audit.');
    }
    process.exit(0);
  }

  let allPassed = true;
  let totalViolations = 0;

  if (!isJson) {
    console.log(`\n======================================================================`);
    console.log(`🛡️  TypeSafe Constitutional Test Sentinel — Physical Reality Audit`);
    console.log(`   Scanning ${filesToScan.length} file(s) with concurrency=${concurrency}`);
    console.log(`======================================================================`);
  }

  const results = await mapConcurrent(filesToScan, concurrency, async (file, i) => {
    const res = await auditTestFile(file);
    if (!isJson && concurrency > 1) {
      const relPath = relative(process.cwd(), file).replace(/\\/g, '/');
      const statusIcon = res.ok ? '🟢' : '🔴';
      console.log(`[${i + 1}/${filesToScan.length}] ${statusIcon} ${relPath} (${res.engine})`);
    }
    return res;
  });

  for (let i = 0; i < filesToScan.length; i++) {
    const file = filesToScan[i]!;
    const result = results[i]!;
    const relPath = relative(process.cwd(), file).replace(/\\/g, '/');

    if (!isJson) {
      if (concurrency === 1) {
        console.log(`\n📄 File: ${relPath}`);
        console.log(`   Engine: ${result.engine}`);
      }

      const rules: ConstitutionalRule[] = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'];

      for (const rule of rules) {
        const ruleViolations = result.violations.filter((v) => v.rule === rule);
        const ruleLabel = (RULE_NAMES[rule] ?? rule).split('(')[0]?.trim().padEnd(32) ?? rule;
        if (ruleViolations.length === 0) {
          if (concurrency === 1) {
            console.log(`   [${rule}] ${ruleLabel}: 🟢 PASS`);
          }
        } else {
          allPassed = false;
          totalViolations += ruleViolations.length;
          if (concurrency === 1) {
            console.log(`   [${rule}] ${ruleLabel}: 🔴 FAIL (${ruleViolations.length} issue${ruleViolations.length > 1 ? 's' : ''})`);
            for (const v of ruleViolations) {
              console.log(`        └─ Line ${v.line || 'global'}: ${v.message}`);
            }
          } else {
            console.log(`\n📄 Violations in ${relPath}:`);
            console.log(`   [${rule}] ${ruleLabel}: 🔴 FAIL (${ruleViolations.length} issue${ruleViolations.length > 1 ? 's' : ''})`);
            for (const v of ruleViolations) {
              console.log(`        └─ Line ${v.line || 'global'}: ${v.message}`);
            }
          }
        }
      }

      if (concurrency === 1) {
        if (result.ok) {
          console.log(`   Verdict: 🟢 100% COMPLIANT`);
        } else {
          console.log(`   Verdict: 🔴 VIOLATIONS DETECTED`);
        }
      }
    } else {
      if (!result.ok) {
        allPassed = false;
        totalViolations += result.violations.length;
      }
    }
  }

  if (isJson) {
    console.log(JSON.stringify({
      ok: allPassed,
      totalFiles: filesToScan.length,
      totalViolations,
      results,
    }, null, 2));
    process.exit(allPassed ? 0 : 1);
  }

  console.log(`\n======================================================================`);
  if (allPassed) {
    console.log(`🏆 FINAL VERDICT: 🟢 ALL ${filesToScan.length} TEST FILE(S) COMPLIANT (0 violations)`);
    console.log(`======================================================================\n`);
    process.exit(0);
  } else {
    console.log(`❌ FINAL VERDICT: 🔴 AUDIT FAILED (${totalViolations} constitutional violations across ${filesToScan.length} file(s))`);
    console.log(`======================================================================\n`);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('test-constitutional-sentinel.ts')) {
  main().catch((err) => {
    console.error('Sentinel execution error:', err);
    process.exit(1);
  });
}
