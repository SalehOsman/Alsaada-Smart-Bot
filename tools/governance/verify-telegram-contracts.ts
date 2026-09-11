import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createResult,
  fail,
  isCliEntrypoint,
  listFilesRecursive,
  printAndExit,
  toRepoPath,
  type VerificationResult,
} from './common.js';

export const MAX_TELEGRAM_URL_BYTES = 512;
export const MAX_TELEGRAM_CALLBACK_BYTES = 64;

export interface TelegramContractViolation {
  file: string;
  line: number;
  type: 'URL_OVERFLOW' | 'CALLBACK_OVERFLOW' | 'INVALID_URL_PROTOCOL';
  detail: string;
  byteLength: number;
  maxAllowed: number;
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
      lower.includes('type')
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

export function verifyTelegramContracts(root: string = process.cwd()): VerificationResult {
  const result = createResult();
  const violations: TelegramContractViolation[] = [];

  const candidateFiles = listFilesRecursive(root).filter((file) => {
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
    const relativePath = toRepoPath(root, file);
    const content = readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;

      // 1. Check callback_data in .text(...) calls, object literals, and string literals
      const scannedCallbacks = new Set<string>();

      // A. Match .text(..., 'cb_data' | "cb_data" | `cb_data`)
      const textMatches = lineText.matchAll(/\.text\s*\((?:(?!,\s*['"`]).)*?,\s*(['"`])([^'"`]+?)\1\s*[,)]/g);
      for (const match of textMatches) {
        const raw = match[2] ?? '';
        scannedCallbacks.add(raw);
      }

      // B. Match callback property in object literals: callbackData: '...' or callback_data: '...'
      const propMatches = lineText.matchAll(/(?:callbackData|callback_data)\s*:\s*(['"`])([^'"`]+?)\1/g);
      for (const match of propMatches) {
        const raw = match[2] ?? '';
        scannedCallbacks.add(raw);
      }

      // C. Match known callback patterns: action:, wizard:, menu:, adm:, w:, site:, dept:, qty_val:, amount_val:
      const literalMatches = lineText.matchAll(/(['"`])((?:action:|wizard:|menu:|adm:|w:|site:|dept:|qty_val:|amount_val:)[^'"`]+)\1/g);
      for (const match of literalMatches) {
        const raw = match[2] ?? '';
        scannedCallbacks.add(raw);
      }

      for (const raw of scannedCallbacks) {
        const sampleResolved = resolveSampleCallbackData(raw);
        const byteLen = Buffer.byteLength(sampleResolved, 'utf8');
        result.checked += 1;
        if (byteLen > MAX_TELEGRAM_CALLBACK_BYTES) {
          violations.push({
            file: relativePath,
            line: lineNum,
            type: 'CALLBACK_OVERFLOW',
            detail: `${raw} -> resolved as "${sampleResolved}"`,
            byteLength: byteLen,
            maxAllowed: MAX_TELEGRAM_CALLBACK_BYTES,
          });
        }
      }

      // 2. Check URL buttons: e.g. .url('...', 'https://...')
      const urlMatches = lineText.matchAll(/\.url\(\s*(?:['"`].*?['"`]|[^,]+)\s*,\s*(['"`])([^'"`]+)\1\s*\)/g);
      for (const match of urlMatches) {
        const urlStr = match[2] ?? '';
        result.checked += 1;

        if (urlStr.startsWith('tel:')) {
          violations.push({
            file: relativePath,
            line: lineNum,
            type: 'INVALID_URL_PROTOCOL',
            detail: `Telegram Bot API rejects 'tel:' protocol in InlineKeyboardButton.url: ${urlStr}`,
            byteLength: Buffer.byteLength(urlStr, 'utf8'),
            maxAllowed: MAX_TELEGRAM_URL_BYTES,
          });
          continue;
        }

        const sampleResolvedUrl = urlStr.replace(/\$\{[^}]+\}/g, 'sample_param');
        const byteLen = Buffer.byteLength(sampleResolvedUrl, 'utf8');
        if (byteLen > MAX_TELEGRAM_URL_BYTES) {
          violations.push({
            file: relativePath,
            line: lineNum,
            type: 'URL_OVERFLOW',
            detail: sampleResolvedUrl,
            byteLength: byteLen,
            maxAllowed: MAX_TELEGRAM_URL_BYTES,
          });
        }
      }
    });
  }

  if (violations.length > 0) {
    for (const v of violations) {
      fail(
        result,
        `[${v.type}] ${v.file}:${v.line} -> length ${v.byteLength} bytes exceeds limit of ${v.maxAllowed} bytes: "${v.detail}"`
      );
    }
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
 const result = verifyTelegramContracts();
 printAndExit('Telegram Bot API Contract Guard (<= 512 URL, <= 64 Callback)', result);
}
