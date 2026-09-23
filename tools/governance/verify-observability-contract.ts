import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import {
  createResult,
  fail,
  isCliEntrypoint,
  listFilesRecursive,
  listFlowDirs,
  readUtf8,
  toRepoPath,
} from './common.js';
import { GOVERNANCE_LOCK_PATH, type GovernanceLock } from './verify-governance-lock.js';

export type ObservabilityAstRule =
  | 'CONSOLE_ERROR'
  | 'EMPTY_CATCH_SWALLOW'
  | 'UNIMPORTED_CAPTURE_FLOW_ERROR'
  | 'UNAWAITED_CAPTURE_FLOW_ERROR'
  | 'MISSING_CAPTURE_FLOW_ERROR'
  | 'UNAWAITED_FLOW_ERROR_HANDLER'
  | 'UNBOUNDED_UNKNOWN_CTX'
  | 'INNER_LAYER_DIRECT_VAULT_CALL';

export interface ObservabilityAstFinding {
  rule: ObservabilityAstRule;
  message: string;
  line: number;
}

export interface ObservabilityAstInspectionResult {
  ok: boolean;
  findings: ObservabilityAstFinding[];
  hasImportedCaptureFlowError: boolean;
  hasAwaitedCaptureFlowError: boolean;
}

export interface InspectAstOptions {
  fileName?: string | undefined;
  role?: 'error.handler' | 'controller' | 'service' | 'critical' | 'v1-flow' | undefined;
}

function getLineNumber(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function getCalleeName(expr: ts.Expression): string | null {
  if (ts.isIdentifier(expr)) {
    return expr.text;
  }
  if (ts.isPropertyAccessExpression(expr)) {
    return expr.name.text;
  }
  return null;
}

function isConsoleErrorCall(node: ts.CallExpression): boolean {
  return (
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === 'console' &&
    node.expression.name.text === 'error'
  );
}

function isFlowErrorHandlerCallee(calleeName: string | null): boolean {
  if (!calleeName) return false;
  if (calleeName === 'captureFlowError') return true;
  return /^handle[A-Z][A-Za-z0-9_]*Error$/.test(calleeName);
}

function isRecognizedErrorHandlingCall(calleeName: string | null): boolean {
  if (!calleeName) return false;
  if (
    calleeName === 'captureFlowError' ||
    calleeName === 'recordError' ||
    calleeName === 'recordErrorIncident' ||
    calleeName === 'writeEmergencyIncident' ||
    calleeName === 'fail' ||
    calleeName === 'error' ||
    calleeName === 'warn' ||
    calleeName === 'fatal'
  ) {
    return true;
  }
  return /^handle[A-Z][A-Za-z0-9_]*Error$/.test(calleeName);
}

function isAwaitedOrReturnedInAsync(callNode: ts.CallExpression): boolean {
  const parent = callNode.parent;
  if (ts.isAwaitExpression(parent)) {
    return true;
  }
  if (ts.isReturnStatement(parent)) {
    let curr: ts.Node | undefined = parent.parent;
    while (curr) {
      if (
        ts.isFunctionDeclaration(curr) ||
        ts.isMethodDeclaration(curr) ||
        ts.isArrowFunction(curr) ||
        ts.isFunctionExpression(curr)
      ) {
        const modifiers = ts.canHaveModifiers(curr) ? ts.getModifiers(curr) : undefined;
        return Boolean(modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword));
      }
      curr = curr.parent;
    }
  }
  return false;
}

/**
 * Deep TypeScript AST Inspector for Gate G9 Observability & Flow Telemetry Enforcement (Work Plan 94 - NEW-91)
 */
export function inspectSourceObservabilityAst(
  sourceCode: string,
  options: InspectAstOptions = {},
): ObservabilityAstInspectionResult {
  const fileName = options.fileName ?? 'module.ts';
  const role = options.role ?? 'critical';
  const sourceFile = ts.createSourceFile(fileName, sourceCode, ts.ScriptTarget.Latest, true);
  const findings: ObservabilityAstFinding[] = [];

  const telemetryImportedBindings = new Set<string>();
  const localShadowDeclarations = new Set<string>();
  let captureFlowErrorCallsCount = 0;
  let hasAwaitedCaptureFlowError = false;
  let controllerAwaitedHandlerInCatch = false;
  let controllerHasDispatchCatch = false;

  // 1. Collect top-level imports and local declarations
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const moduleName = node.moduleSpecifier.text;
      if (moduleName === '@alsaada/telemetry' || moduleName.startsWith('@alsaada/telemetry/')) {
        const namedBindings = node.importClause?.namedBindings;
        if (namedBindings && ts.isNamedImports(namedBindings)) {
          for (const element of namedBindings.elements) {
            const importedName = element.propertyName ? element.propertyName.text : element.name.text;
            if (importedName === 'captureFlowError') {
              telemetryImportedBindings.add(element.name.text);
            }
          }
        }
      }
    }

    if (ts.isFunctionDeclaration(node) && node.name?.text === 'captureFlowError') {
      localShadowDeclarations.add('captureFlowError');
    }

    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === 'captureFlowError') {
          localShadowDeclarations.add('captureFlowError');
        }
      }
    }
  });

  const isTrustedTelemetryBinding = (bindingName: string): boolean => {
    return telemetryImportedBindings.has(bindingName) && !localShadowDeclarations.has(bindingName);
  };

  // 2. Recursive AST traversal
  const visit = (node: ts.Node): void => {
    // Rule A: Zero console.error
    if (ts.isCallExpression(node) && isConsoleErrorCall(node)) {
      findings.push({
        rule: 'CONSOLE_ERROR',
        message: `Forbidden console.error call in ${fileName}. Use structured telemetry or captureFlowError.`,
        line: getLineNumber(sourceFile, node),
      });
    }

    // Check captureFlowError calls
    if (ts.isCallExpression(node)) {
      const callee = getCalleeName(node.expression);
      const isCaptureCall =
        callee === 'captureFlowError' ||
        (ts.isIdentifier(node.expression) && telemetryImportedBindings.has(node.expression.text));

      if (isCaptureCall) {
        captureFlowErrorCallsCount++;
        const isImportedFromTelemetry =
          ts.isIdentifier(node.expression) && isTrustedTelemetryBinding(node.expression.text);

        if (!isImportedFromTelemetry && role === 'error.handler') {
          findings.push({
            rule: 'UNIMPORTED_CAPTURE_FLOW_ERROR',
            message: `captureFlowError in ${fileName} is not genuinely imported from '@alsaada/telemetry' (local shadow or untrusted binding).`,
            line: getLineNumber(sourceFile, node),
          });
        }

        if (isAwaitedOrReturnedInAsync(node)) {
          if (isImportedFromTelemetry) {
            hasAwaitedCaptureFlowError = true;
          }
        } else {
          findings.push({
            rule: 'UNAWAITED_CAPTURE_FLOW_ERROR',
            message: `captureFlowError(...) call in ${fileName} must be awaited (missing 'await').`,
            line: getLineNumber(sourceFile, node),
          });
        }

        if (role === 'service') {
          findings.push({
            rule: 'INNER_LAYER_DIRECT_VAULT_CALL',
            message: `Inner layer (${fileName}) must not call captureFlowError directly; throw/rethrow to flow boundary (Single Point of Responsibility).`,
            line: getLineNumber(sourceFile, node),
          });
        }
      }

      if (role === 'service' && (callee === 'recordError' || callee === 'recordErrorIncident')) {
        findings.push({
          rule: 'INNER_LAYER_DIRECT_VAULT_CALL',
          message: `Inner layer (${fileName}) must not call ErrorVaultService.${callee} directly; throw/rethrow to flow boundary.`,
          line: getLineNumber(sourceFile, node),
        });
      }
    }

    // Rule B: CatchClause analysis (Empty catch / silent swallow vs rethrow vs awaited handler)
    if (ts.isCatchClause(node)) {
      const statements = node.block.statements;
      const isUiEditFallthrough =
        (role === 'controller' || role === 'v1-flow') &&
        ts.isTryStatement(node.parent) &&
        (() => {
          let hasTelegramUiEditCall = false;
          let hasActionDispatchCall = false;
          const scanTry = (n: ts.Node): void => {
            if (ts.isCallExpression(n)) {
              const cName = getCalleeName(n.expression);
              if (
                cName === 'editMessageText' ||
                cName === 'deleteMessage' ||
                cName === 'answerCallbackQuery' ||
                cName === 'editMessageReplyMarkup'
              ) {
                hasTelegramUiEditCall = true;
              }
              if (cName && /^handle[A-Z][A-Za-z0-9_]*Action$/.test(cName)) {
                hasActionDispatchCall = true;
              }
            }
            ts.forEachChild(n, scanTry);
          };
          scanTry(node.parent.tryBlock);
          return hasTelegramUiEditCall && !hasActionDispatchCall;
        })();

      if (statements.length === 0) {
        if (!isUiEditFallthrough) {
          findings.push({
            rule: 'EMPTY_CATCH_SWALLOW',
            message: `Silent empty or comment-only catch block in ${fileName}. Exceptions must be rethrown or handled via awaited captureFlowError.`,
            line: getLineNumber(sourceFile, node),
          });
        }
      } else {
        let hasThrow = false;
        let hasErrorCall = false;
        let hasAwaitedFlowHandlerCall = false;
        let hasUnawaitedFlowHandlerCall = false;

        const inspectCatchBody = (child: ts.Node): void => {
          if (ts.isThrowStatement(child)) {
            hasThrow = true;
          }
          if (ts.isCallExpression(child)) {
            const callee = getCalleeName(child.expression);
            if (isRecognizedErrorHandlingCall(callee)) {
              hasErrorCall = true;
            }
            if (isFlowErrorHandlerCallee(callee)) {
              if (isAwaitedOrReturnedInAsync(child)) {
                hasAwaitedFlowHandlerCall = true;
              } else {
                hasUnawaitedFlowHandlerCall = true;
              }
            }
          }
          ts.forEachChild(child, inspectCatchBody);
        };

        inspectCatchBody(node.block);

        if (role === 'controller') {
          controllerHasDispatchCatch = true;
          if (hasUnawaitedFlowHandlerCall && !hasAwaitedFlowHandlerCall) {
            findings.push({
              rule: 'UNAWAITED_FLOW_ERROR_HANDLER',
              message: `Flow controller (${fileName}) calls error handler in catch block without 'await'.`,
              line: getLineNumber(sourceFile, node),
            });
          }
          if (hasAwaitedFlowHandlerCall) {
            controllerAwaitedHandlerInCatch = true;
          }
          if (!hasThrow && !hasErrorCall) {
            findings.push({
              rule: 'EMPTY_CATCH_SWALLOW',
              message: `Catch block in controller (${fileName}) swallows error without rethrowing or awaiting flow error handler.`,
              line: getLineNumber(sourceFile, node),
            });
          }
        } else if (role === 'error.handler' || role === 'service') {
          if (!hasThrow && !hasErrorCall) {
            findings.push({
              rule: 'EMPTY_CATCH_SWALLOW',
              message: `Catch block in ${fileName} silently swallows error without rethrowing or invoking telemetry handler.`,
              line: getLineNumber(sourceFile, node),
            });
          }
        }
      }
    }

    // Rule C: Check error.handler signature for untyped `ctx?: unknown`
    if (role === 'error.handler' && (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node))) {
      const fnName = ts.isFunctionDeclaration(node) ? node.name?.text ?? '' : '';
      if (/^handle[A-Z][A-Za-z0-9_]*Error$/.test(fnName) || ts.isFunctionDeclaration(node)) {
        for (let i = 1; i < node.parameters.length; i++) {
          const param = node.parameters[i]!;
          const paramName = ts.isIdentifier(param.name) ? param.name.text : '';
          if (
            (paramName === 'ctx' || paramName === 'context' || paramName === 'boundedContext') &&
            param.type &&
            param.type.kind === ts.SyntaxKind.UnknownKeyword
          ) {
            findings.push({
              rule: 'UNBOUNDED_UNKNOWN_CTX',
              message: `Error handler '${fnName || 'anonymous'}' in ${fileName} uses untyped '${paramName}: unknown'. Must use BoundedFlowContext.`,
              line: getLineNumber(sourceFile, param),
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  // Post-traversal checks for error.handler role
  if (role === 'error.handler') {
    if (localShadowDeclarations.has('captureFlowError')) {
      findings.push({
        rule: 'UNIMPORTED_CAPTURE_FLOW_ERROR',
        message: `Local shadow declaration of 'captureFlowError' in ${fileName} is forbidden. Must import from '@alsaada/telemetry'.`,
        line: 1,
      });
    }
    if (captureFlowErrorCallsCount === 0) {
      findings.push({
        rule: 'MISSING_CAPTURE_FLOW_ERROR',
        message: `Flow error handler (${fileName}) does not invoke captureFlowError(...) in executable AST (comments do not count).`,
        line: 1,
      });
    } else if (telemetryImportedBindings.size === 0) {
      findings.push({
        rule: 'UNIMPORTED_CAPTURE_FLOW_ERROR',
        message: `Flow error handler (${fileName}) calls captureFlowError without importing it from '@alsaada/telemetry'.`,
        line: 1,
      });
    }
  }

  if (role === 'controller' && (!controllerHasDispatchCatch || !controllerAwaitedHandlerInCatch)) {
    const alreadyFlagged = findings.some(
      (f) => f.rule === 'UNAWAITED_FLOW_ERROR_HANDLER' || f.rule === 'EMPTY_CATCH_SWALLOW',
    );
    if (!alreadyFlagged) {
      findings.push({
        rule: 'UNAWAITED_FLOW_ERROR_HANDLER',
        message: `Flow controller (${fileName}) must wrap dispatchAction in try/catch and await handle*Error(...) inside its catch boundary.`,
        line: 1,
      });
    }
  }

  return {
    ok: findings.length === 0,
    findings,
    hasImportedCaptureFlowError:
      telemetryImportedBindings.size > 0 && !localShadowDeclarations.has('captureFlowError'),
    hasAwaitedCaptureFlowError,
  };
}

/**
 * Inspects a V2 10-file flow slice directory (`error.handler.ts`, `controller.ts`, and inner layers)
 */
export function inspectFlowV2Observability(flowDir: string): {
  ok: boolean;
  findings: ObservabilityAstFinding[];
} {
  const allFindings: ObservabilityAstFinding[] = [];

  const errorHandlerPath = join(flowDir, 'error.handler.ts');
  if (existsSync(errorHandlerPath)) {
    const res = inspectSourceObservabilityAst(readUtf8(errorHandlerPath), {
      fileName: errorHandlerPath,
      role: 'error.handler',
    });
    allFindings.push(...res.findings);
  }

  const controllerPath = join(flowDir, 'controller.ts');
  if (existsSync(controllerPath)) {
    const res = inspectSourceObservabilityAst(readUtf8(controllerPath), {
      fileName: controllerPath,
      role: 'controller',
    });
    allFindings.push(...res.findings);
  }

  const innerLayerFiles = [
    'service.ts',
    'validator.ts',
    'repository.ts',
    'menu.builder.ts',
    'types.ts',
  ];
  for (const innerFile of innerLayerFiles) {
    const innerPath = join(flowDir, innerFile);
    if (existsSync(innerPath)) {
      const res = inspectSourceObservabilityAst(readUtf8(innerPath), {
        fileName: innerPath,
        role: 'service',
      });
      allFindings.push(...res.findings);
    }
  }

  return {
    ok: allFindings.length === 0,
    findings: allFindings,
  };
}

function isPreWp94LockedV2Flow(repoRoot: string, flowDir: string): boolean {
  const lockPath = join(repoRoot, GOVERNANCE_LOCK_PATH);
  if (!existsSync(lockPath)) return false;
  try {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as GovernanceLock;
    const relFlowDir = toRepoPath(repoRoot, flowDir).replace(/\\/g, '/');
    const errorHandlerPath = join(flowDir, 'error.handler.ts');
    if (existsSync(errorHandlerPath)) {
      const content = readUtf8(errorHandlerPath);
      if (content.includes('captureFlowError')) {
        return false;
      }
    }
    if (lock.lockedEntities) {
      for (const entity of Object.values(lock.lockedEntities)) {
        if (entity.type === 'flow' && entity.directory.replace(/\\/g, '/') === relFlowDir) {
          return true;
        }
      }
    }
  } catch {
    return false;
  }
  return false;
}

export async function verifyObservabilityContract(
  repoRoot: string,
  options: { enforceAllV2Flows?: boolean } = {},
) {
  const result = createResult();

  const criticalDirs = [
    resolve(repoRoot, 'apps/admin-dashboard/src/app/api/auth'),
    resolve(repoRoot, 'apps/admin-dashboard/src/app/api/export'),
    resolve(repoRoot, 'apps/admin-dashboard/src/app/api/delegations'),
  ];

  const criticalFiles = [
    resolve(repoRoot, 'apps/bot-server/src/services/dashboard-auth.service.ts'),
    resolve(repoRoot, 'apps/bot-server/src/services/session-monitor.service.ts'),
  ];

  const allFiles: string[] = [...criticalFiles];
  for (const dir of criticalDirs) {
    if (existsSync(dir)) {
      allFiles.push(...listFilesRecursive(dir));
    }
  }

  for (const file of allFiles) {
    if (!existsSync(file) || (!file.endsWith('.ts') && !file.endsWith('.tsx'))) continue;
    result.checked++;
    const content = readUtf8(file);
    const astRes = inspectSourceObservabilityAst(content, {
      fileName: toRepoPath(repoRoot, file),
      role: 'critical',
    });

    for (const finding of astRes.findings) {
      fail(result, `[${finding.rule}] ${finding.message} (line ${finding.line})`);
    }

    if (file.includes('api') && !content.includes('traceId') && !content.includes('extractTraceId')) {
      fail(result, `API route ${toRepoPath(repoRoot, file)} missing traceId tracking.`);
    }
  }

  // Scan all flow slices across modules/
  const flowDirs = listFlowDirs(repoRoot);
  for (const flowDir of flowDirs) {
    const errorHandlerPath = join(flowDir, 'error.handler.ts');
    const isV2Flow = existsSync(errorHandlerPath);

    if (isV2Flow) {
      if (!options.enforceAllV2Flows && isPreWp94LockedV2Flow(repoRoot, flowDir)) {
        continue;
      }
      result.checked++;
      const v2Res = inspectFlowV2Observability(flowDir);
      for (const finding of v2Res.findings) {
        fail(result, `[${finding.rule}] ${finding.message} (line ${finding.line})`);
      }
    } else {
      // V1 Flow: ensure zero silent empty business catch blocks and zero console.error in flow.handler.ts
      const v1HandlerPath = join(flowDir, 'flow.handler.ts');
      if (existsSync(v1HandlerPath)) {
        result.checked++;
        const astRes = inspectSourceObservabilityAst(readUtf8(v1HandlerPath), {
          fileName: toRepoPath(repoRoot, v1HandlerPath),
          role: 'v1-flow',
        });
        for (const finding of astRes.findings) {
          fail(result, `[${finding.rule}] ${finding.message} (line ${finding.line})`);
        }
      }
    }
  }

  return result;
}

if (isCliEntrypoint(import.meta.url) || process.argv[1]?.includes('verify-observability-contract')) {
  const repoRoot = resolve(process.cwd());
  verifyObservabilityContract(repoRoot)
    .then((res) => {
      console.log(`\n📡 [Observability Gate G9 AST] Checked ${res.checked} critical security & flow targets.`);
      if (!res.ok) {
        console.error('❌ Failures found:');
        for (const f of res.failures) {
          console.error(`  - ${f}`);
        }
        process.exit(1);
      }
      console.log('✅ Zero console.error, AST anti-silent swallow & flow telemetry contract 100% verified.\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Crash in verify-observability-contract:', err);
      process.exit(1);
    });
}
