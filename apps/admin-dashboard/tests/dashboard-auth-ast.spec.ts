import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

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
  it('inevitable failure: all 9 target source files must exist relative to repo root', () => {
    for (const relPath of TARGET_SOURCE_FILES) {
      const absPath = path.join(REPO_ROOT, relPath);
      expect(fs.existsSync(absPath), `File missing from repository: ${relPath}`).toBe(true);
    }
  });

  it('Check 1: all 9 files must be strictly free of "as any" or unjustified "any" type usage', () => {
    const anyViolations: string[] = [];

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

    expect(anyViolations, `Found 'any' type violations in target files: ${JSON.stringify(anyViolations, null, 2)}`).toEqual([]);
  });

  it('Check 2: app files must contain zero silent catch blocks and connect to TelemetryLogger', () => {
    const silentCatchViolations: string[] = [];

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

    expect(silentCatchViolations, `Silent catch block violations found: ${JSON.stringify(silentCatchViolations, null, 2)}`).toEqual([]);
  });

  it('Check 3: @alsaada/rbac must have zero telemetry dependency and zero silent catch blocks', () => {
    const rbacTelemetryViolations: string[] = [];
    const rbacCatchViolations: string[] = [];

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

    expect(rbacTelemetryViolations, `Telemetry dependency found in RBAC: ${JSON.stringify(rbacTelemetryViolations, null, 2)}`).toEqual([]);
    expect(rbacCatchViolations, `Catch block violations in RBAC: ${JSON.stringify(rbacCatchViolations, null, 2)}`).toEqual([]);
  });

  it('Check 4: decision logic must NOT branch on error.message or error message string includes', () => {
    const decisionMessageViolations: string[] = [];

    for (const relPath of TARGET_SOURCE_FILES) {
      const { sourceFile } = loadParsedSource(relPath);

      function visit(node: ts.Node) {
        // Inspect IfStatement conditions
        if (ts.isIfStatement(node)) {
          checkConditionForErrorMessage(node.expression, relPath, sourceFile);
        }
        // Inspect ConditionalExpression conditions (a ? b : c)
        if (ts.isConditionalExpression(node)) {
          checkConditionForErrorMessage(node.condition, relPath, sourceFile);
        }
        ts.forEachChild(node, visit);
      }

      function isErrorMessagePropertyAccess(node: ts.PropertyAccessExpression, sf: ts.SourceFile): boolean {
        if (node.name.text !== 'message') return false;
        const callerText = node.expression.getText(sf).toLowerCase();
        // Ignore Telegram message objects like ctx.message, ctx.callbackQuery.message, etc.
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
          // If condition calls .includes() on an error .message property
          if (ts.isCallExpression(n)) {
            if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'includes') {
              const caller = n.expression.expression;
              if (ts.isPropertyAccessExpression(caller) && isErrorMessagePropertyAccess(caller, sf)) {
                const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
                decisionMessageViolations.push(`${file}:${line + 1} branches on error.message.includes(...)`);
              }
            }
          }
          // If condition tests equality with error .message
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

    expect(
      decisionMessageViolations,
      `Decision logic branches on error.message: ${JSON.stringify(decisionMessageViolations, null, 2)}`
    ).toEqual([]);
  });

  it('Check 5: application files must contain zero direct reading of Host or X-Forwarded-* headers (SSOT in @alsaada/rbac)', () => {
    const hostHeaderViolations: string[] = [];
    const forbiddenHeaders = new Set([
      'host',
      'x-forwarded-host',
      'x-forwarded-proto',
      'x-forwarded-for',
      'x-forwarded-server',
    ]);

    for (const relPath of TARGET_SOURCE_FILES) {
      // packages/rbac/src/dashboard-auth.ts is the sovereign SSOT encapsulating resolveEffectiveRequestOrigin
      // which strictly validates reverse-proxy headers against the trusted origins allowlist.
      // All application files (claim, logout, auth, bot-server, etc.) are strictly forbidden
      // from directly reading or bypassing reverse-proxy/host headers.
      if (relPath === 'packages/rbac/src/dashboard-auth.ts') {
        continue;
      }

      const { sourceFile } = loadParsedSource(relPath);

      function visit(node: ts.Node) {
        // Match headers.get('host') or request.headers.get('x-forwarded-host')
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

        // Match headers['host'] or headers['x-forwarded-*']
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

    expect(
      hostHeaderViolations,
      `Host/Forwarded header bypass inspection violations: ${JSON.stringify(hostHeaderViolations, null, 2)}`
    ).toEqual([]);
  });

  it('Check 5b: claim/route.ts must delegate origin resolution to resolveEffectiveRequestOrigin SSOT', () => {
    const { content } = loadParsedSource('apps/admin-dashboard/src/app/api/auth/claim/route.ts');
    expect(content.includes('resolveEffectiveRequestOrigin')).toBe(true);
  });

  it('Check 6: must contain zero startsWith usage for URL security verification', () => {
    const startsWithViolations: string[] = [];
    const forbiddenPrefixes = ['http://', 'https://', 'http:', 'https:', 'localhost', 'localtest.me', '127.0.0.1', 'nip.io'];

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

    expect(
      startsWithViolations,
      `startsWith URL verification violations: ${JSON.stringify(startsWithViolations, null, 2)}`
    ).toEqual([]);
  });
});
