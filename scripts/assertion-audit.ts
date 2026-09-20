#!/usr/bin/env tsx
/**
 * 🔍 AST-Based Assertion Quality Auditor
 *
 * Uses the TypeScript Compiler API to parse test files and audit
 * assertion quality per test case. No regex — real AST analysis.
 *
 * Usage:
 *   tsx scripts/assertion-audit.ts              # same as --report
 *   tsx scripts/assertion-audit.ts --report      # table sorted by assertion count
 *   tsx scripts/assertion-audit.ts --check       # exit 1 if critical issues found
 *   tsx scripts/assertion-audit.ts --fix-suggest  # suggest additional assertions
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TestCaseInfo {
  file: string;
  testName: string;
  assertionCount: number;
  classification: '🔴' | '🟡' | '🟢';
  isIntegration: boolean;
}

// ─── AST Helpers ────────────────────────────────────────────────────────────

function countExpectCalls(node: ts.Node): number {
  let count = 0;
  function visit(n: ts.Node): void {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'expect') {
      count++;
    }
    ts.forEachChild(n, visit);
  }
  ts.forEachChild(node, visit);
  return count;
}

function extractTestName(callExpr: ts.CallExpression): string | null {
  if (callExpr.arguments.length === 0) return null;
  const firstArg = callExpr.arguments[0]!;
  if (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) return firstArg.text;
  if (ts.isTemplateExpression(firstArg)) return firstArg.head.text + '...';
  return '<dynamic>';
}

function isTestCall(node: ts.Node): node is ts.CallExpression {
  if (!ts.isCallExpression(node)) return false;
  const expr = node.expression;
  if (ts.isIdentifier(expr)) return expr.text === 'it' || expr.text === 'test';
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression))
    return (expr.expression.text === 'it' || expr.expression.text === 'test') &&
           ['each','skip','only','todo','concurrent'].includes(expr.name.text);
  if (ts.isCallExpression(expr) && ts.isPropertyAccessExpression(expr.expression) && ts.isIdentifier(expr.expression.expression))
    return (expr.expression.expression.text === 'it' || expr.expression.expression.text === 'test') && expr.expression.name.text === 'each';
  return false;
}

function getTestCallback(callExpr: ts.CallExpression): ts.Node | null {
  for (let i = callExpr.arguments.length - 1; i >= 0; i--) {
    const arg = callExpr.arguments[i]!;
    if (ts.isFunctionExpression(arg) || ts.isArrowFunction(arg)) return arg.body;
  }
  return null;
}

// ─── File Discovery ─────────────────────────────────────────────────────────

const EXCLUDED = new Set(['node_modules','dist','.git','.githooks','.husky','.cache']);

function findTestFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(d: string): void {
    let entries: string[];
    try { entries = readdirSync(d); } catch { return; }
    for (const e of entries) {
      if (EXCLUDED.has(e)) continue;
      const p = join(d, e);
      let s; try { s = statSync(p); } catch { continue; }
      if (s.isDirectory()) walk(p);
      else if (/\.(spec|test)\.[jt]sx?$/.test(e)) results.push(p);
    }
  }
  walk(dir);
  return results;
}

// ─── Analysis ───────────────────────────────────────────────────────────────

function analyzeFile(filePath: string, rootDir: string): TestCaseInfo[] {
  const source = readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const relPath = relative(rootDir, filePath).replace(/\\/g, '/');
  const isIntegration = relPath.toLowerCase().includes('integration');
  const results: TestCaseInfo[] = [];

  function visit(node: ts.Node): void {
    if (isTestCall(node)) {
      const testName = extractTestName(node) ?? '<unnamed>';
      const body = getTestCallback(node);
      const assertionCount = body ? countExpectCalls(body) : 0;
      let classification: '🔴' | '🟡' | '🟢';
      if (isIntegration && assertionCount <= 1) classification = '🔴';
      else if (assertionCount === 0) classification = '🔴';
      else if (assertionCount === 1) classification = '🟡';
      else classification = '🟢';
      results.push({ file: relPath, testName, assertionCount, classification, isIntegration });
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sf, visit);
  return results;
}

// ─── Output ─────────────────────────────────────────────────────────────────

function printReport(cases: TestCaseInfo[]): void {
  const sorted = [...cases].sort((a, b) => a.assertionCount - b.assertionCount);
  console.log('\n┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│                    🔍 Assertion Quality Audit Report                        │');
  console.log('└─────────────────────────────────────────────────────────────────────────────┘\n');
  const fW = 55, tW = 50, cW = 6;
  console.log(`${'File'.padEnd(fW)} ${'Test Name'.padEnd(tW)} ${'Count'.padStart(cW)} Class`);
  console.log(`${'─'.repeat(fW)} ${'─'.repeat(tW)} ${'─'.repeat(cW)} ─────`);
  for (const c of sorted) {
    const f = c.file.length > fW ? '…' + c.file.slice(-(fW-1)) : c.file.padEnd(fW);
    const n = c.testName.length > tW ? c.testName.slice(0, tW-1) + '…' : c.testName.padEnd(tW);
    console.log(`${f} ${n} ${String(c.assertionCount).padStart(cW)} ${c.classification}`);
  }
}

function printFixSuggestions(cases: TestCaseInfo[]): void {
  const critical = cases.filter(c => c.classification === '🔴');
  if (!critical.length) { console.log('\n✅ No critical issues — no fix suggestions needed.\n'); return; }
  console.log('\n┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│               💡 Fix Suggestions for Critical Test Cases                    │');
  console.log('└─────────────────────────────────────────────────────────────────────────────┘');
  for (const c of critical) {
    console.log(`\n📁 ${c.file}`);
    console.log(`   🧪 "${c.testName}" (${c.assertionCount} assertion${c.assertionCount === 1 ? '' : 's'})`);
    console.log('   Suggested additions:');
    if (c.assertionCount === 0) {
      console.log('     • Add expect(result).toBeDefined()');
      console.log('     • Add expect(() => fn()).not.toThrow()');
      console.log('     • Add expect(result).toMatchSnapshot() for complex outputs');
    }
    if (c.isIntegration) {
      console.log('     • Add expect(response.status).toBe(200) or equivalent status check');
      console.log('     • Add expect(result).toHaveProperty(\'key\') for shape validation');
      console.log('     • Add boundary/edge-case assertion');
    } else {
      console.log('     • Add expect(result).not.toBeNull()');
      console.log('     • Add edge-case assertion (empty string, zero, negative, etc.)');
    }
  }
}

function printSummary(cases: TestCaseInfo[]): void {
  const good = cases.filter(c => c.classification === '🟢').length;
  const warning = cases.filter(c => c.classification === '🟡').length;
  const critical = cases.filter(c => c.classification === '🔴').length;
  const total = cases.reduce((s, c) => s + c.assertionCount, 0);
  const avg = cases.length > 0 ? (total / cases.length).toFixed(2) : '0.00';
  console.log('\n📊 Assertion Quality Audit Summary');
  console.log(`   Total test cases: ${cases.length}`);
  console.log(`   🟢 Good (2+ assertions): ${good}`);
  console.log(`   🟡 Warning (1 assertion): ${warning}`);
  console.log(`   🔴 Critical (0-1 in integration): ${critical}`);
  console.log(`   Average assertions/test: ${avg}\n`);
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  const mode = args.includes('--check') ? 'check' : args.includes('--fix-suggest') ? 'fix-suggest' : 'report';
  const rootDir = join(import.meta.dirname ?? process.cwd(), '..');
  const testFiles = findTestFiles(rootDir);
  console.log(`\n🔍 Scanning ${testFiles.length} test files for assertion quality...\n`);
  const allCases: TestCaseInfo[] = [];
  for (const file of testFiles) allCases.push(...analyzeFile(file, rootDir));

  switch (mode) {
    case 'report': printReport(allCases); printSummary(allCases); break;
    case 'check': {
      printSummary(allCases);
      const crit = allCases.filter(c => c.classification === '🔴');
      if (crit.length > 0) {
        console.log(`❌ Found ${crit.length} critical assertion quality issue(s):\n`);
        for (const c of crit) console.log(`   🔴 ${c.file} → "${c.testName}" (${c.assertionCount} assertions)`);
        console.log('');
        process.exit(1);
      } else console.log('✅ No critical assertion quality issues found.\n');
      break;
    }
    case 'fix-suggest': printReport(allCases); printFixSuggestions(allCases); printSummary(allCases); break;
  }
}

main();
