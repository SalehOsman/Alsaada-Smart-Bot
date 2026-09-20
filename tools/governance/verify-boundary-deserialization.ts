import { resolve } from 'node:path';
import ts from 'typescript';
import {
  createResult,
  fail,
  isCliEntrypoint,
  listFilesRecursive,
  printAndExit,
  readUtf8,
  toRepoPath,
  type VerificationResult,
} from './common.js';

export function scanFileForBoundaryViolations(filePath: string, content: string): string[] {
  const violations: string[] = [];
  const normalizedPath = filePath.replace(/\\/g, '/');

  // The single point of re-branding is packages/core-components/src/types.ts
  if (normalizedPath.endsWith('packages/core-components/src/types.ts')) {
    return violations;
  }

  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  function visit(node: ts.Node) {
    // Check `as PositiveFiniteAmount`
    if (ts.isAsExpression(node)) {
      const typeText = node.type.getText(sourceFile).trim();
      if (typeText === 'PositiveFiniteAmount' || typeText.endsWith('.PositiveFiniteAmount')) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        violations.push(
          `[Gate 24 Violation] ${filePath}:${line + 1} uses blind cast 'as ${typeText}'. All values must pass through 'toPositiveFiniteAmount()' re-branding gate.`
        );
      }
      if (typeText === 'SafeFinancialQuantity' || typeText.endsWith('.SafeFinancialQuantity')) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        violations.push(
          `[Gate 24 Violation] ${filePath}:${line + 1} uses blind cast 'as ${typeText}'. All quantities must pass through 'toSafeFinancialQuantity()' re-branding gate.`
        );
      }
    }

    // Check `<PositiveFiniteAmount>x`
    if (ts.isTypeAssertionExpression(node)) {
      const typeText = node.type.getText(sourceFile).trim();
      if (typeText === 'PositiveFiniteAmount' || typeText.endsWith('.PositiveFiniteAmount')) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        violations.push(
          `[Gate 24 Violation] ${filePath}:${line + 1} uses blind type assertion '<${typeText}>'. All values must pass through 'toPositiveFiniteAmount()' re-branding gate.`
        );
      }
      if (typeText === 'SafeFinancialQuantity' || typeText.endsWith('.SafeFinancialQuantity')) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        violations.push(
          `[Gate 24 Violation] ${filePath}:${line + 1} uses blind type assertion '<${typeText}>'. All quantities must pass through 'toSafeFinancialQuantity()' re-branding gate.`
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

export function verifyBoundaryDeserialization(root = process.cwd()): VerificationResult {
  const result = createResult();
  const repoRoot = resolve(root);

  const targetDirs = [
    resolve(repoRoot, 'apps'),
    resolve(repoRoot, 'modules'),
    resolve(repoRoot, 'packages'),
    resolve(repoRoot, 'tools'),
  ];

  const filesToScan: string[] = [];
  for (const dir of targetDirs) {
    const files = listFilesRecursive(dir);
    for (const f of files) {
      if (
        (f.endsWith('.ts') || f.endsWith('.tsx')) &&
        !f.includes('node_modules') &&
        !f.includes('dist') &&
        !f.includes('.next') &&
        !f.includes('.turbo')
      ) {
        filesToScan.push(f);
      }
    }
  }

  for (const filePath of filesToScan) {
    result.checked++;
    const content = readUtf8(filePath);
    if (!content.includes('PositiveFiniteAmount') && !content.includes('SafeFinancialQuantity')) {
      continue;
    }
    const relativePath = toRepoPath(repoRoot, filePath);
    const violations = scanFileForBoundaryViolations(relativePath, content);
    for (const v of violations) {
      fail(result, v);
    }
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  printAndExit('boundary-deserialization:verify', verifyBoundaryDeserialization(process.cwd()));
}
