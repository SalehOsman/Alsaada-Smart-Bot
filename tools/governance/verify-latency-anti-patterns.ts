import ts from 'typescript';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createResult,
  fail,
  isCliEntrypoint,
  listFilesRecursive,
  listFlowDirs,
  printAndExit,
  readUtf8,
  toRepoPath,
  type VerificationResult,
} from './common.js';
import { GOVERNANCE_LOCK_PATH, type GovernanceLock } from './verify-governance-lock.js';

export const BYPASS_DIRECTIVE_REGEX = /\/\/\s*@governance-security-blocking-delete:\s*(.+)/;

export interface AntiPatternViolation {
  file: string;
  line: number;
  character: number;
  pattern: 'BLOCKING_DELETE_MESSAGE' | 'AWAITED_SET_MY_COMMANDS' | 'SEQUENTIAL_BLOCKING_DELETES';
  message: string;
}

export function scanFileForLatencyAntiPatterns(
  filePath: string,
  content: string,
  isBotServer = false
): AntiPatternViolation[] {
  const violations: AntiPatternViolation[] = [];
  const lines = content.split(/\r?\n/);
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  function hasSecurityBypass(pos: number): boolean {
    const { line } = sourceFile.getLineAndCharacterOfPosition(pos);
    const currentLine = lines[line] || '';
    const prevLine = line > 0 ? lines[line - 1] || '' : '';
    return BYPASS_DIRECTIVE_REGEX.test(currentLine) || BYPASS_DIRECTIVE_REGEX.test(prevLine);
  }

  function visit(node: ts.Node): void {
    // 1. Detect `await ... deleteMessage`
    if (ts.isAwaitExpression(node)) {
      const expr = node.expression;
      if (ts.isCallExpression(expr)) {
        const callee = expr.expression;
        if (ts.isPropertyAccessExpression(callee)) {
          const methodName = callee.name.text;
          const target = callee.expression;

          // Check for deleteMessage
          if (methodName === 'deleteMessage') {
            let isTargetDelete = false;

            // ctx.deleteMessage()
            if (ts.isIdentifier(target) && target.text === 'ctx') {
              isTargetDelete = true; // Strict in both bot-server and modules per Plan 63
            }
            // ctx.api.deleteMessage()
            else if (
              ts.isPropertyAccessExpression(target) &&
              target.name.text === 'api' &&
              ts.isIdentifier(target.expression) &&
              target.expression.text === 'ctx'
            ) {
              isTargetDelete = true; // Strict in both bot-server and flows
            }

            if (isTargetDelete && !hasSecurityBypass(node.getStart(sourceFile))) {
              const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
              violations.push({
                file: filePath,
                line: line + 1,
                character: character + 1,
                pattern: 'BLOCKING_DELETE_MESSAGE',
                message: `Blocking 'await ${callee.getText(sourceFile)}' detected. Use 'safeDeleteBackground(ctx, messageId)' or non-blocking void pattern, or document bypass with '// @governance-security-blocking-delete: [reason]'.`,
              });
            }
          }

          // Check for setMyCommands inside per-request handlers (prohibited inside flow / message handlers)
          if (methodName === 'setMyCommands') {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
            violations.push({
              file: filePath,
              line: line + 1,
              character: character + 1,
              pattern: 'AWAITED_SET_MY_COMMANDS',
              message: `Blocking 'await ${callee.getText(sourceFile)}' inside per-request handler. Telegram commands scope must be synchronized via non-blocking background queue or startup bootstrap.`,
            });
          }
        }
      }
    }

    // 2. Detect sequential blocking delete calls in a block
    if (ts.isBlock(node)) {
      let consecutiveDeletes = 0;
      for (const statement of node.statements) {
        let isDeleteStmt = false;
        if (ts.isExpressionStatement(statement) && ts.isAwaitExpression(statement.expression)) {
          const innerCall = statement.expression.expression;
          if (ts.isCallExpression(innerCall) && ts.isPropertyAccessExpression(innerCall.expression)) {
            if (innerCall.expression.name.text === 'deleteMessage') {
              isDeleteStmt = true;
            }
          }
        }
        if (isDeleteStmt) {
          consecutiveDeletes++;
          if (consecutiveDeletes >= 2 && !hasSecurityBypass(statement.getStart(sourceFile))) {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile));
            violations.push({
              file: filePath,
              line: line + 1,
              character: character + 1,
              pattern: 'SEQUENTIAL_BLOCKING_DELETES',
              message: `Sequential blocking delete calls detected in same block. Combine or dispatch via safeDeleteBackground().`,
            });
          }
        } else {
          consecutiveDeletes = 0;
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

export function verifyLatencyAntiPatterns(root = process.cwd()): VerificationResult {
  const start = performance.now();
  const result = createResult();

  // 1. Identify locked flows to respect cryptographic immutability
  const lockPath = join(root, GOVERNANCE_LOCK_PATH);
  const lockedFlowDirs = new Set<string>();
  if (existsSync(lockPath)) {
    try {
      const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as GovernanceLock;
      if (lock.lockedFlows) {
        for (const flow of Object.values(lock.lockedFlows)) {
          lockedFlowDirs.add(flow.directory.replace(/\\/g, '/'));
        }
      }
    } catch {}
  }

  // 2. Collect target files
  const filesToScan: Array<{ path: string; isBotServer: boolean }> = [];

  // 2.1 Bot Server handlers, middlewares, routers, and bot.ts
  const botServerSrc = join(root, 'apps', 'bot-server', 'src');
  if (existsSync(botServerSrc)) {
    const candidateDirs = ['handlers', 'middlewares', 'routers', 'services'];
    for (const dir of candidateDirs) {
      const dirPath = join(botServerSrc, dir);
      if (existsSync(dirPath)) {
        const files = listFilesRecursive(dirPath).filter(
          (f) =>
            f.endsWith('.ts') &&
            !f.endsWith('.spec.ts') &&
            !f.endsWith('.test.ts') &&
            !f.endsWith('command-scope.service.ts') // command-scope.service is the background provider
        );
        for (const file of files) {
          filesToScan.push({ path: file, isBotServer: true });
        }
      }
    }
    const botTs = join(botServerSrc, 'bot.ts');
    if (existsSync(botTs)) {
      filesToScan.push({ path: botTs, isBotServer: true });
    }
  }

  // 2.2 Module flows (flow handlers and execution slices, excluding locked flows)
  const flowDirs = listFlowDirs(root);
  for (const flowDir of flowDirs) {
    const repoFlowDir = toRepoPath(root, flowDir).replace(/\\/g, '/');
    if (lockedFlowDirs.has(repoFlowDir)) {
      continue; // Sealed immutable flow
    }
    const flowFiles = listFilesRecursive(flowDir).filter(
      (f) =>
        f.endsWith('.ts') &&
        !f.endsWith('.spec.ts') &&
        !f.endsWith('.test.ts') &&
        (f.includes('handler') || f.includes('wizard') || f.includes('service'))
    );
    for (const file of flowFiles) {
      filesToScan.push({ path: file, isBotServer: false });
    }
  }

  result.checked = filesToScan.length;

  // 3. Scan files
  for (const { path: filePath, isBotServer } of filesToScan) {
    const content = readUtf8(filePath);
    const repoPath = toRepoPath(root, filePath);
    const violations = scanFileForLatencyAntiPatterns(repoPath, content, isBotServer);

    for (const v of violations) {
      fail(result, `[${v.pattern}] ${v.file}:${v.line}:${v.character} — ${v.message}`);
    }
  }

  const durationMs = Math.round((performance.now() - start) * 100) / 100;
  if (durationMs > 300) {
    result.warnings.push(`AST Latency Scanner exceeded 300ms budget (${durationMs}ms)`);
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  printAndExit('latency:verify', verifyLatencyAntiPatterns(process.cwd()));
}
