import { resolve } from 'node:path';
import ts from 'typescript';
import { createResult, fail, isCliEntrypoint, listFilesRecursive, printAndExit, readUtf8, toRepoPath, type VerificationResult } from './common.js';

export function scanSpecContentForAuthenticity(filePath: string, content: string): string[] {
  const violations: string[] = [];
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );
  const localLiterals = new Map<string, number | string>();

  function visit(node: ts.Node) {
    // 1. Track local variable declarations initialized with constant literals
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (ts.isNumericLiteral(node.initializer)) {
        localLiterals.set(node.name.text, parseFloat(node.initializer.text));
      } else if (ts.isStringLiteral(node.initializer)) {
        localLiterals.set(node.name.text, node.initializer.text);
      }
    }

    // 2. Check for synthetic concurrency primitives (Mutex / Semaphore classes)
    if ((ts.isClassDeclaration(node) || ts.isClassExpression(node)) && node.name) {
      const className = node.name.text;
      if (className.includes('Mutex') || className.includes('Semaphore')) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        violations.push(
          `[Synthetic Test Concurrency Gate] ${filePath}:${line + 1} declares synthetic concurrency control class '${className}'. Real database advisory locking (pg_advisory_xact_lock) must be tested without synthetic client-side mutexes.`
        );
      }
    }

    // 3. Check call expressions for assertions
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr)) {
        const methodName = expr.name.text;

        // Check: .toBeGreaterThanOrEqual(0)
        if (methodName === 'toBeGreaterThanOrEqual') {
          const firstArg = node.arguments[0];
          if (firstArg && ts.isNumericLiteral(firstArg) && firstArg.text === '0') {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            violations.push(
              `[Sham Assertion] ${filePath}:${line + 1} uses 'toBeGreaterThanOrEqual(0)', which passes vacuously for non-negative numbers/counts.`
            );
          }
        }

        // Check: Tautologies like expect(x).toBe(x) or expect(x).toEqual(x)
        if (methodName === 'toBe' || methodName === 'toEqual') {
          const expectCall = expr.expression;
          if (ts.isCallExpression(expectCall) && ts.isIdentifier(expectCall.expression) && expectCall.expression.text === 'expect') {
            const expectedArg = expectCall.arguments[0];
            const actualArg = node.arguments[0];
            if (expectedArg && actualArg && expectedArg.getText(sourceFile).trim() === actualArg.getText(sourceFile).trim()) {
              const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
              violations.push(
                `[Tautological Assertion] ${filePath}:${line + 1} compares '${expectedArg.getText(sourceFile)}' to itself.`
              );
            }
          }
        }

        // Check: Tautological boolean assertions like expect(true).toBeTruthy() or expect(false).toBeFalsy()
        if (methodName === 'toBeTruthy' || methodName === 'toBeFalsy') {
          const expectCall = expr.expression;
          if (ts.isCallExpression(expectCall) && ts.isIdentifier(expectCall.expression) && expectCall.expression.text === 'expect') {
            const subjectArg = expectCall.arguments[0];
            if (subjectArg && (subjectArg.kind === ts.SyntaxKind.TrueKeyword || subjectArg.kind === ts.SyntaxKind.FalseKeyword)) {
              const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
              violations.push(
                `[Sham Tautological Assertion] ${filePath}:${line + 1} asserts constant boolean '${subjectArg.getText(sourceFile)}' with .${methodName}().`
              );
            }
          }
        }

        // Check: Local variable constant assertion tautology:
        // e.g. const sampleAmount = 250.75; expect(sampleAmount).toBeGreaterThan(0);
        if (methodName === 'toBeGreaterThan') {
          const expectCall = expr.expression;
          if (ts.isCallExpression(expectCall) && ts.isIdentifier(expectCall.expression) && expectCall.expression.text === 'expect') {
            const subjectArg = expectCall.arguments[0];
            if (subjectArg && ts.isIdentifier(subjectArg)) {
              const varName = subjectArg.text;
              const localVal = localLiterals.get(varName);
              if (typeof localVal === 'number' && localVal > 0) {
                const firstArg = node.arguments[0];
                if (firstArg && ts.isNumericLiteral(firstArg) && firstArg.text === '0') {
                  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                  violations.push(
                    `[Sham Dummy Assertion] ${filePath}:${line + 1} asserts constant '${varName} = ${localVal}' > 0.`
                  );
                }
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

export function verifyTestAuthenticity(root = process.cwd()): VerificationResult {
  const result = createResult();
  const repoRoot = resolve(root);

  const targetDirs = [
    resolve(repoRoot, 'apps'),
    resolve(repoRoot, 'modules'),
    resolve(repoRoot, 'packages'),
    resolve(repoRoot, 'tools'),
  ];

  const specFiles: string[] = [];
  for (const dir of targetDirs) {
    const files = listFilesRecursive(dir);
    for (const f of files) {
      if ((f.endsWith('.spec.ts') || f.endsWith('.test.ts') || f.endsWith('.spec.tsx')) && !f.includes('node_modules')) {
        specFiles.push(f);
      }
    }
  }

  for (const filePath of specFiles) {
    result.checked++;
    const content = readUtf8(filePath);
    const relativePath = toRepoPath(repoRoot, filePath);
    const violations = scanSpecContentForAuthenticity(relativePath, content);
    for (const v of violations) {
      fail(result, v);
    }
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  printAndExit('test-authenticity:verify', verifyTestAuthenticity(process.cwd()));
}
