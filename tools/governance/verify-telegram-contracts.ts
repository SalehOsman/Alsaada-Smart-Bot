import { existsSync } from 'node:fs';
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

export const MAX_TELEGRAM_URL_BYTES = 512;
export const MAX_TELEGRAM_CALLBACK_BYTES = 64;

export interface TelegramContractViolation {
  file: string;
  line: number;
  type: 'URL_OVERFLOW' | 'CALLBACK_OVERFLOW' | 'INVALID_URL_PROTOCOL' | 'DYNAMIC_STRING_INJECTION' | 'MULTILINE_BUTTON_TEXT';
  detail: string;
  byteLength?: number;
  maxAllowed?: number;
}

export function resolveSampleCallbackData(raw: string): string {
  return raw.replace(/\$\{([^}]+)\}/g, (_match, expr: string) => {
    const trimmed = expr.trim();
    const lower = trimmed.toLowerCase();

    // 1. Telegram user IDs (10 digits)
    if (
      lower.includes('telegram') ||
      lower.includes('tg') ||
      lower.includes('chatid') ||
      lower.includes('from.id') ||
      lower.endsWith('userid') ||
      lower.includes('u.telegramid')
    ) {
      return '1234567890';
    }

    // 2. Loop counters, indices, pages, numbers (1-3 chars)
    if (
      lower === 'i' ||
      lower.startsWith('i ') ||
      lower.startsWith('i+') ||
      lower.startsWith('i-') ||
      lower.includes('page') ||
      lower.includes('idx') ||
      lower.includes('index') ||
      lower.includes('offset') ||
      lower === 'val' ||
      lower.startsWith('val') ||
      lower.includes('amount') ||
      lower.includes('count') ||
      lower.includes('qty') ||
      lower.includes('num') ||
      lower === 'c.value'
    ) {
      return '99';
    }

    // 3. Dates & times (10 chars: YYYY-MM-DD)
    if (lower.includes('date') || lower.includes('time')) {
      return '2026-09-11';
    }

    // 4. Prefixes, short codes, tab names, short field names (3-6 chars)
    if (
      lower.includes('prefix') ||
      lower.includes('code') ||
      lower.includes('tab') ||
      lower.includes('field') ||
      lower.includes('key') ||
      lower.includes('mode') ||
      lower.includes('type') ||
      lower.includes('scope') ||
      lower.includes('role') ||
      lower.includes('policy')
    ) {
      return 'SHORT';
    }

    // 5. Short item tokens in pickers/grids (e.g. item1.id)
    if (lower.includes('item1') || lower.includes('item2') || lower.includes('item.')) {
      return '12345';
    }

    // 6. Database entity IDs and UUIDs (36 chars)
    if (lower.includes('id') || lower.includes('uuid')) {
      return '12345678-1234-1234-1234-123456789abc';
    }

    // Default fallback: 36 chars for unknown dynamic expressions
    return '12345678-1234-1234-1234-123456789abc';
  });
}

const KNOWN_CALLBACK_PREFIX = /^(?:action:|wizard:|menu:|adm:|w:|site:|dept:|qty_val:|amount_val:|wob:|pref:|pol:|sess_rev:|sess_ext:|grp:|urb:)/;

export function verifyTelegramContracts(root: string = process.cwd()): VerificationResult {
  const result = createResult();
  const repoRoot = resolve(root);
  const violations: TelegramContractViolation[] = [];

  const candidateFiles = listFilesRecursive(repoRoot).filter((file) => {
    const norm = file.replace(/\\/g, '/');
    if (
      norm.includes('/node_modules/') ||
      norm.includes('/dist/') ||
      norm.includes('/.git/') ||
      norm.includes('/tests/') ||
      norm.includes('.spec.') ||
      norm.includes('.test.')
    ) {
      return false;
    }
    return (
      norm.endsWith('.keyboard.ts') ||
      norm.includes('/keyboards/') ||
      norm.endsWith('keyboard.ts') ||
      norm.endsWith('.handler.ts') ||
      norm.includes('/handlers/') ||
      norm.endsWith('.service.ts') ||
      norm.includes('/services/') ||
      norm.endsWith('hub.ts') ||
      norm.endsWith('bot.ts') ||
      norm.endsWith('settings-hub.ts')
    );
  });

  for (const file of candidateFiles) {
    const relativePath = toRepoPath(repoRoot, file);
    const content = readUtf8(file);
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);

    const checkedNodes = new Set<ts.Node>();

    function inspectButtonText(node: ts.Expression) {
      let label = '';
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        label = node.text;
      }
      if (label && (label.includes('\n') || label.includes('\r'))) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        violations.push({
          file: relativePath,
          line: line + 1,
          type: 'MULTILINE_BUTTON_TEXT',
          detail: `Telegram inline button text must be single-line to prevent layout distortion on clients: "${label.replace(/\r?\n/g, '\\n')}"`,
        });
      }
    }

    function extractDynamicSubExpressions(expr: ts.Expression): ts.Expression[] {
      if (ts.isTemplateExpression(expr)) {
        const results: ts.Expression[] = [];
        for (const span of expr.templateSpans) {
          results.push(...extractDynamicSubExpressions(span.expression));
        }
        return results;
      }
      if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        return [...extractDynamicSubExpressions(expr.left), ...extractDynamicSubExpressions(expr.right)];
      }
      if (ts.isParenthesizedExpression(expr)) {
        return extractDynamicSubExpressions(expr.expression);
      }
      if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
        return [];
      }
      return [expr];
    }

    function inspectCallbackNode(node: ts.Expression) {
      if (checkedNodes.has(node)) return;
      checkedNodes.add(node);
      result.checked += 1;

      // 1. Anti-Dynamic-String Injection Check:
      // Disallow free-form text or names inside callback_data expressions (templates, concatenations, or direct identifiers)
      const subExprs = extractDynamicSubExpressions(node);
      for (const sub of subExprs) {
        const exprText = sub.getText(sourceFile).trim();
        const lower = exprText.toLowerCase();
        const isProhibited =
          /(?:fullname|workername|username|arabicname)/i.test(lower) ||
          /(?:\.name|\[['"`]name['"`]\])/i.test(lower) ||
          /^(?:w|worker|user|emp|admin|u|doc|site|dept|item|p|s)\.name$/i.test(lower) ||
          /(?:\.description|\.comment|\.notes|\.reason|\.message|\.prompt|\.text)$/i.test(lower) ||
          /^(?:description|comment|notes|reason|message|text)$/i.test(lower);

        if (isProhibited) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(sub.getStart());
          violations.push({
            file: relativePath,
            line: line + 1,
            type: 'DYNAMIC_STRING_INJECTION',
            detail: `Prohibited dynamic free-form text/name injection in callback_data: "${exprText}". Names and free-form text must appear in message.text or button label, not in callback_data. Use numeric IDs/UUIDs or static tokens instead.`,
          });
        }
      }

      // 2. Byte Length Limits (<= 64 bytes)
      let sampleResolved = '';
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        sampleResolved = node.text;
      } else if (ts.isTemplateExpression(node)) {
        const rawText = node.getText(sourceFile);
        const unquoted = rawText.startsWith('`') && rawText.endsWith('`') ? rawText.slice(1, -1) : rawText;
        sampleResolved = resolveSampleCallbackData(unquoted);
      } else if (ts.isBinaryExpression(node)) {
        const rawText = node.getText(sourceFile).replace(/\+/g, '').replace(/['"`]/g, '').trim();
        sampleResolved = resolveSampleCallbackData(rawText);
      }

      if (sampleResolved) {
        const byteLen = Buffer.byteLength(sampleResolved, 'utf8');
        if (byteLen > MAX_TELEGRAM_CALLBACK_BYTES) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          violations.push({
            file: relativePath,
            line: line + 1,
            type: 'CALLBACK_OVERFLOW',
            detail: `${node.getText(sourceFile)} -> resolved as "${sampleResolved}"`,
            byteLength: byteLen,
            maxAllowed: MAX_TELEGRAM_CALLBACK_BYTES,
          });
        }
      }
    }

    function inspectUrlNode(node: ts.Expression) {
      if (checkedNodes.has(node)) return;
      checkedNodes.add(node);
      result.checked += 1;

      let urlStr = '';
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        urlStr = node.text;
      } else if (ts.isTemplateExpression(node)) {
        const raw = node.getText(sourceFile);
        const unquoted = raw.startsWith('`') && raw.endsWith('`') ? raw.slice(1, -1) : raw;
        urlStr = unquoted.replace(/\$\{[^}]+\}/g, 'sample_param');
      }

      if (urlStr) {
        if (urlStr.startsWith('tel:')) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          violations.push({
            file: relativePath,
            line: line + 1,
            type: 'INVALID_URL_PROTOCOL',
            detail: `Telegram Bot API rejects 'tel:' protocol in InlineKeyboardButton.url: ${urlStr}`,
            byteLength: Buffer.byteLength(urlStr, 'utf8'),
            maxAllowed: MAX_TELEGRAM_URL_BYTES,
          });
          return;
        }

        const byteLen = Buffer.byteLength(urlStr, 'utf8');
        if (byteLen > MAX_TELEGRAM_URL_BYTES) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          violations.push({
            file: relativePath,
            line: line + 1,
            type: 'URL_OVERFLOW',
            detail: urlStr,
            byteLength: byteLen,
            maxAllowed: MAX_TELEGRAM_URL_BYTES,
          });
        }
      }
    }

    function visit(node: ts.Node) {
      // 1. Call Expressions: .text(label, callbackData), .url(label, url), etc.
      if (ts.isCallExpression(node)) {
        const expr = node.expression;
        if (ts.isPropertyAccessExpression(expr)) {
          const methodName = expr.name.text;
          if (methodName === 'text' && node.arguments.length >= 2) {
            const labelArg = node.arguments[0];
            const cbArg = node.arguments[1];
            if (labelArg) inspectButtonText(labelArg);
            if (cbArg) inspectCallbackNode(cbArg);
          } else if (
            (methodName === 'url' || methodName === 'webApp' || methodName === 'login') &&
            node.arguments.length >= 2
          ) {
            const labelArg = node.arguments[0];
            const urlArg = node.arguments[1];
            if (labelArg) inspectButtonText(labelArg);
            if (urlArg) inspectUrlNode(urlArg);
          }
        }
      }

      // 2. Object Literal Expressions: { callback_data: ... } or { callbackData: ... } or { url: ... } or { text: ... }
      if (ts.isObjectLiteralExpression(node)) {
        for (const prop of node.properties) {
          if (ts.isPropertyAssignment(prop)) {
            const propName = prop.name.getText(sourceFile).replace(/['"`]/g, '');
            if (propName === 'text') {
              inspectButtonText(prop.initializer);
            } else if (propName === 'callback_data' || propName === 'callbackData') {
              inspectCallbackNode(prop.initializer);
            } else if (propName === 'url') {
              inspectUrlNode(prop.initializer);
            }
          }
        }
      }

      // 3. String literals / templates with known callback prefixes that might not be in .text(...) calls
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        if (KNOWN_CALLBACK_PREFIX.test(node.text) && !checkedNodes.has(node)) {
          inspectCallbackNode(node);
        }
      } else if (ts.isTemplateExpression(node)) {
        if (KNOWN_CALLBACK_PREFIX.test(node.head.text) && !checkedNodes.has(node)) {
          inspectCallbackNode(node);
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  if (violations.length > 0) {
    for (const v of violations) {
      if (
        v.type === 'DYNAMIC_STRING_INJECTION' ||
        v.type === 'INVALID_URL_PROTOCOL' ||
        v.type === 'MULTILINE_BUTTON_TEXT'
      ) {
        fail(result, `[${v.type}] ${v.file}:${v.line} -> ${v.detail}`);
      } else {
        fail(
          result,
          `[${v.type}] ${v.file}:${v.line} -> length ${v.byteLength} bytes exceeds limit of ${v.maxAllowed} bytes: "${v.detail}"`
        );
      }
    }
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  const result = verifyTelegramContracts();
  printAndExit('Telegram Bot API Contract Guard (AST: <= 512 URL, <= 64 Callback, Anti-Dynamic Injection)', result);
}
