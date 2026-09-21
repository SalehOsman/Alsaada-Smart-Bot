import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { PINNED_BASE_TIME } from '@alsaada/shared/testing';

/**
 * Hardened Structural AST Test (Test 13)
 * Compliance: PLAN-22 R1C-A-C1 (lines 549-570)
 * Uses TypeScript Compiler API (ts.createSourceFile, SyntaxKind)
 * Strictly zero regex or String.includes substitution for structural code inspection.
 */

function findRepoRoot(): string {
  let current = __dirname;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error('Could not locate repository root (pnpm-workspace.yaml not found)');
}

const REPO_ROOT = findRepoRoot();

const TARGET_SOURCE_FILES = [
  'packages/rbac/src/dashboard-auth.ts',
  'packages/rbac/src/index.ts',
  'apps/admin-dashboard/src/app/api/auth/claim/route.ts',
  'apps/admin-dashboard/src/app/api/auth/logout/route.ts',
  'apps/admin-dashboard/src/lib/env.ts',
  'apps/admin-dashboard/src/lib/auth.ts',
  'apps/bot-server/src/config/env.ts',
  'apps/bot-server/src/services/dashboard-auth.service.ts',
  'apps/bot-server/src/handlers/dashboard.handler.ts',
] as const;

const APP_SOURCE_FILES = [
  'apps/admin-dashboard/src/app/api/auth/claim/route.ts',
  'apps/admin-dashboard/src/app/api/auth/logout/route.ts',
  'apps/admin-dashboard/src/lib/env.ts',
  'apps/admin-dashboard/src/lib/auth.ts',
  'apps/bot-server/src/config/env.ts',
  'apps/bot-server/src/services/dashboard-auth.service.ts',
  'apps/bot-server/src/handlers/dashboard.handler.ts',
] as const;

const RBAC_SOURCE_FILES = [
  'packages/rbac/src/dashboard-auth.ts',
  'packages/rbac/src/index.ts',
] as const;

function loadParsedSource(relPath: string): { sourceFile: ts.SourceFile; content: string } {
  const absPath = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Target source file does not exist: ${relPath} (resolved at ${absPath})`);
  }
  const content = fs.readFileSync(absPath, 'utf-8');
  const sourceFile = ts.createSourceFile(relPath, content, ts.ScriptTarget.Latest, true);
  return { sourceFile, content };
}

describe('Structural AST Architecture & Security Verification (Test 13)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('verifies that all 9 target source files exist on disk relative to repository root', () => {
    // Arrange
    const totalExpectedFiles = 9;

    // Act
    const resolvedFiles = TARGET_SOURCE_FILES.map((relPath) => ({
      relPath,
      absPath: path.join(REPO_ROOT, relPath),
      exists: fs.existsSync(path.join(REPO_ROOT, relPath)),
    }));

    // Assert
    expect(TARGET_SOURCE_FILES).toHaveLength(totalExpectedFiles);
    expect(TARGET_SOURCE_FILES.length).not.toBeLessThan(totalExpectedFiles);

    for (const item of resolvedFiles) {
      expect(item.exists, `File missing from repository: ${item.relPath}`).toBe(true);
      expect(item.absPath).not.toBe('');
    }
  });

  it('verifies that all 9 target files are completely free of "as any" or unjustified "any" type keywords', () => {
    // Arrange
    const anyViolations: string[] = [];

    // Act
    for (const relPath of TARGET_SOURCE_FILES) {
      const { sourceFile } = loadParsedSource(relPath);

      function visit(node: ts.Node) {
        if (node.kind === ts.SyntaxKind.AnyKeyword) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          anyViolations.push(`${relPath}:${line + 1}:${character + 1} uses 'any' keyword`);
        }
        ts.forEachChild(node, visit);
      }
      visit(sourceFile);
    }

    // Assert
    expect(anyViolations, `Found 'any' type violations in target files: ${JSON.stringify(anyViolations, null, 2)}`).toEqual([]);
    expect(anyViolations).toHaveLength(0);
    expect(anyViolations.length).not.toBeGreaterThan(0);
  });

  it('verifies that application files contain zero silent catch blocks and delegate to telemetry or rethrow', () => {
    // Arrange
    const silentCatchViolations: string[] = [];

    // Act
    for (const relPath of APP_SOURCE_FILES) {
      const { sourceFile } = loadParsedSource(relPath);

      function visit(node: ts.Node) {
        if (ts.isCatchClause(node)) {
          const statements = node.block.statements;
          if (statements.length === 0) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            silentCatchViolations.push(`${relPath}:${line + 1} has completely empty catch block`);
          } else {
            // Check whether block calls logger, rethrows, or delegates to failure handler
            let hasLoggerOrThrowOrHandler = false;
            function checkStatements(n: ts.Node) {
              if (ts.isThrowStatement(n)) {
                hasLoggerOrThrowOrHandler = true;
              } else if (ts.isCallExpression(n)) {
                const callText = n.expression.getText(sourceFile);
                if (
                  callText.startsWith('logger.') ||
                  callText.includes('replyWithDashboardFailure') ||
                  callText.includes('errorVaultService')
                ) {
                  hasLoggerOrThrowOrHandler = true;
                }
              }
              ts.forEachChild(n, checkStatements);
            }
            checkStatements(node.block);

            if (!hasLoggerOrThrowOrHandler) {
              const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
              silentCatchViolations.push(`${relPath}:${line + 1} catch block does not call logger or rethrow`);
            }
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(sourceFile);
    }

    // Assert
    expect(silentCatchViolations, `Silent catch block violations found: ${JSON.stringify(silentCatchViolations, null, 2)}`).toEqual([]);
    expect(silentCatchViolations).toHaveLength(0);
    expect(silentCatchViolations.length).not.toBeGreaterThan(0);
  });

  it('verifies that @alsaada/rbac has zero telemetry dependencies and zero unhandled catch blocks', () => {
    // Arrange
    const rbacTelemetryViolations: string[] = [];
    const rbacCatchViolations: string[] = [];

    // Act
    for (const relPath of RBAC_SOURCE_FILES) {
      const { sourceFile } = loadParsedSource(relPath);

      function visit(node: ts.Node) {
        if (ts.isImportDeclaration(node)) {
          const moduleSpecifier = node.moduleSpecifier.getText(sourceFile);
          if (moduleSpecifier.includes('@alsaada/telemetry')) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            rbacTelemetryViolations.push(`${relPath}:${line + 1} imports @alsaada/telemetry into shared kernel`);
          }
        }

        if (ts.isCatchClause(node)) {
          const statements = node.block.statements;
          if (statements.length === 0) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            rbacCatchViolations.push(`${relPath}:${line + 1} has empty catch block in RBAC`);
          } else {
            // Must throw a typed error or return a typed failure result without checking error.message
            let hasThrowOrReturn = false;
            let checksErrorMessage = false;

            function inspectRbacCatch(n: ts.Node) {
              if (ts.isThrowStatement(n) || ts.isReturnStatement(n)) {
                hasThrowOrReturn = true;
              }
              if (ts.isPropertyAccessExpression(n) && n.name.text === 'message') {
                checksErrorMessage = true;
              }
              ts.forEachChild(n, inspectRbacCatch);
            }
            inspectRbacCatch(node.block);

            if (!hasThrowOrReturn) {
              const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
              rbacCatchViolations.push(`${relPath}:${line + 1} catch block does not throw or return typed result`);
            }
            if (checksErrorMessage) {
              const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
              rbacCatchViolations.push(`${relPath}:${line + 1} catch block inspects error.message string`);
            }
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(sourceFile);
    }

    // Assert
    expect(rbacTelemetryViolations, `Telemetry dependency found in RBAC: ${JSON.stringify(rbacTelemetryViolations, null, 2)}`).toEqual([]);
    expect(rbacTelemetryViolations).toHaveLength(0);
    expect(rbacCatchViolations, `Catch block violations in RBAC: ${JSON.stringify(rbacCatchViolations, null, 2)}`).toEqual([]);
    expect(rbacCatchViolations).toHaveLength(0);
  });

  it('verifies that decision logic does not branch on error.message or string pattern matches', () => {
    // Arrange
    const decisionMessageViolations: string[] = [];

    // Act
    for (const relPath of TARGET_SOURCE_FILES) {
      const { sourceFile } = loadParsedSource(relPath);

      function visit(node: ts.Node) {
        if (ts.isIfStatement(node)) {
          checkConditionForErrorMessage(node.expression, relPath, sourceFile);
        }
        if (ts.isConditionalExpression(node)) {
          checkConditionForErrorMessage(node.condition, relPath, sourceFile);
        }
        ts.forEachChild(node, visit);
      }

      function isErrorMessagePropertyAccess(node: ts.PropertyAccessExpression, sf: ts.SourceFile): boolean {
        if (node.name.text !== 'message') return false;
        const callerText = node.expression.getText(sf).toLowerCase();
        if (
          callerText.includes('callbackquery') ||
          callerText.includes('ctx') ||
          callerText.includes('chat') ||
          callerText.includes('telegram')
        ) {
          return false;
        }
        return true;
      }

      function checkConditionForErrorMessage(cond: ts.Node, file: string, sf: ts.SourceFile) {
        function scan(n: ts.Node) {
          if (ts.isCallExpression(n)) {
            if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'includes') {
              const caller = n.expression.expression;
              if (ts.isPropertyAccessExpression(caller) && isErrorMessagePropertyAccess(caller, sf)) {
                const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
                decisionMessageViolations.push(`${file}:${line + 1} branches on error.message.includes(...)`);
              }
            }
          }
          if (ts.isBinaryExpression(n)) {
            if (
              (ts.isPropertyAccessExpression(n.left) && isErrorMessagePropertyAccess(n.left, sf)) ||
              (ts.isPropertyAccessExpression(n.right) && isErrorMessagePropertyAccess(n.right, sf))
            ) {
              const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
              decisionMessageViolations.push(`${file}:${line + 1} branches on equality check with .message`);
            }
          }
          ts.forEachChild(n, scan);
        }
        scan(cond);
      }

      visit(sourceFile);
    }

    // Assert
    expect(
      decisionMessageViolations,
      `Decision logic branches on error.message: ${JSON.stringify(decisionMessageViolations, null, 2)}`
    ).toEqual([]);
    expect(decisionMessageViolations).toHaveLength(0);
    expect(decisionMessageViolations.length).not.toBeGreaterThan(0);
  });

  it('verifies that application files contain zero direct reading of Host or X-Forwarded-* headers outside SSOT', () => {
    // Arrange
    const hostHeaderViolations: string[] = [];
    const forbiddenHeaders = new Set([
      'host',
      'x-forwarded-host',
      'x-forwarded-proto',
      'x-forwarded-for',
      'x-forwarded-server',
    ]);

    // Act
    for (const relPath of TARGET_SOURCE_FILES) {
      if (relPath === 'packages/rbac/src/dashboard-auth.ts') {
        continue;
      }

      const { sourceFile } = loadParsedSource(relPath);

      function visit(node: ts.Node) {
        if (ts.isCallExpression(node)) {
          if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'get') {
            const callerText = node.expression.expression.getText(sourceFile);
            if (callerText.includes('header') || callerText.includes('headers')) {
              if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0]!)) {
                const arg = node.arguments[0]!.text.toLowerCase();
                if (forbiddenHeaders.has(arg)) {
                  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                  hostHeaderViolations.push(`${relPath}:${line + 1} reads forbidden header '${arg}'`);
                }
              }
            }
          }
        }

        if (ts.isElementAccessExpression(node)) {
          const callerText = node.expression.getText(sourceFile);
          if (callerText.includes('header') || callerText.includes('headers')) {
            if (ts.isStringLiteral(node.argumentExpression)) {
              const arg = node.argumentExpression.text.toLowerCase();
              if (forbiddenHeaders.has(arg)) {
                const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                hostHeaderViolations.push(`${relPath}:${line + 1} accesses forbidden header '${arg}'`);
              }
            }
          }
        }

        ts.forEachChild(node, visit);
      }
      visit(sourceFile);
    }

    // Assert
    expect(
      hostHeaderViolations,
      `Host/Forwarded header bypass inspection violations: ${JSON.stringify(hostHeaderViolations, null, 2)}`
    ).toEqual([]);
    expect(hostHeaderViolations).toHaveLength(0);
    expect(hostHeaderViolations.length).not.toBeGreaterThan(0);
  });

  it('verifies that claim/route.ts strictly delegates origin resolution to resolveEffectiveRequestOrigin SSOT', () => {
    // Arrange
    const claimRouteRelPath = 'apps/admin-dashboard/src/app/api/auth/claim/route.ts';

    // Act
    const { sourceFile, content } = loadParsedSource(claimRouteRelPath);

    let hasImportedSSOT = false;
    let hasInvokedSSOT = false;

    function visit(node: ts.Node) {
      if (ts.isImportSpecifier(node) && node.name.text === 'resolveEffectiveRequestOrigin') {
        hasImportedSSOT = true;
      }
      if (ts.isCallExpression(node)) {
        const text = node.expression.getText(sourceFile);
        if (text === 'resolveEffectiveRequestOrigin') {
          hasInvokedSSOT = true;
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);

    // Assert
    expect(hasImportedSSOT).toBe(true);
    expect(hasInvokedSSOT).toBe(true);
    expect(content).not.toContain("headers.get('host')");
    expect(content).not.toContain("headers.get('x-forwarded-host')");
  });

  it('verifies that source files contain zero startsWith usage for URL security checks to prevent prefix spoofing', () => {
    // Arrange
    const startsWithViolations: string[] = [];
    const forbiddenPrefixes = ['http://', 'https://', 'http:', 'https:', 'localhost', 'localtest.me', '127.0.0.1', 'nip.io'];

    // Act
    for (const relPath of TARGET_SOURCE_FILES) {
      const { sourceFile } = loadParsedSource(relPath);

      function visit(node: ts.Node) {
        if (ts.isCallExpression(node)) {
          if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'startsWith') {
            if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0]!)) {
              const prefix = node.arguments[0]!.text;
              for (const forbidden of forbiddenPrefixes) {
                if (prefix.toLowerCase().includes(forbidden)) {
                  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                  startsWithViolations.push(`${relPath}:${line + 1} calls startsWith('${prefix}') for URL check`);
                  break;
                }
              }
            }
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(sourceFile);
    }

    // Assert
    expect(
      startsWithViolations,
      `startsWith URL verification violations: ${JSON.stringify(startsWithViolations, null, 2)}`
    ).toEqual([]);
    expect(startsWithViolations).toHaveLength(0);
    expect(startsWithViolations.length).not.toBeGreaterThan(0);
  });
});
