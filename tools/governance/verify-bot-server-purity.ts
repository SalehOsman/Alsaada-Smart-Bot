import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { isCliEntrypoint } from './common.js';

export interface BotPurityVerificationResult {
  ok: boolean;
  violations: string[];
  targetFile: string;
}

const FORBIDDEN_PRISMA_MODELS = new Set([
  'worker',
  'financialLedger',
  'supplier',
  'user',
  'site',
  'tenant',
]);

export function verifyBotServerPurity(
  root = process.cwd(),
  customSourceContent?: string
): BotPurityVerificationResult {
  const targetFile = path.join(root, 'apps/bot-server/src/bot.ts');
  const violations: string[] = [];

  if (customSourceContent === undefined && !fs.existsSync(targetFile)) {
    return {
      ok: false,
      violations: ['apps/bot-server/src/bot.ts not found on disk.'],
      targetFile,
    };
  }

  const content = customSourceContent ?? fs.readFileSync(targetFile, 'utf8');
  const sourceFile = ts.createSourceFile(
    'bot.ts',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  function visit(node: ts.Node): void {
    // 1. Check imports for direct `prisma` named import
    if (ts.isImportDeclaration(node)) {
      const namedBindings = node.importClause?.namedBindings;
      if (namedBindings && ts.isNamedImports(namedBindings)) {
        for (const el of namedBindings.elements) {
          if (el.name.text === 'prisma') {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            violations.push(
              `[bot.ts:${line + 1}] Direct import of "prisma" is prohibited in Pure Bot Shell.`
            );
          }
        }
      }
    }

    // 2. Check for `prisma.<model>` property access
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'prisma' &&
      FORBIDDEN_PRISMA_MODELS.has(node.name.text)
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      violations.push(
        `[bot.ts:${line + 1}] Direct domain query "prisma.${node.name.text}" is prohibited in Pure Bot Shell.`
      );
    }

    // 3. Check for raw string literal `ctx.reply('...')` without assertRichMessage
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'ctx' &&
      node.expression.name.text === 'reply' &&
      node.arguments.length > 0
    ) {
      const firstArg = node.arguments[0];
      if (
        firstArg &&
        (ts.isStringLiteral(firstArg) ||
          ts.isNoSubstitutionTemplateLiteral(firstArg) ||
          ts.isTemplateExpression(firstArg) ||
          ts.isBinaryExpression(firstArg))
      ) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        violations.push(
          `[bot.ts:${line + 1}] Raw inline string literal in "ctx.reply(...)" is prohibited; delegate to a module handler or validate via assertRichMessage.`
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    ok: violations.length === 0,
    violations,
    targetFile,
  };
}

if (isCliEntrypoint(import.meta.url)) {
  const res = verifyBotServerPurity();
  if (!res.ok) {
    console.error('❌ [BOT PURITY SENTINEL] Violations detected:');
    for (const v of res.violations) {
      console.error(`   - ${v}`);
    }
    process.exit(1);
  }
  console.log('✅ [BOT PURITY SENTINEL] Passed (apps/bot-server/src/bot.ts is 100% pure micro-kernel shell).');
}
