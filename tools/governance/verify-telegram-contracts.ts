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

export function verifyTelegramContracts(root: string = process.cwd()): VerificationResult {
  const result = createResult();
  const violations: TelegramContractViolation[] = [];

  const candidateFiles = listFilesRecursive(root).filter((file) => {
    const norm = file.replace(/\\/g, '/');
    if (norm.includes('/node_modules/') || norm.includes('/dist/') || norm.includes('/.git/')) {
      return false;
    }
    return norm.endsWith('.keyboard.ts') || norm.includes('/keyboards/') || norm.endsWith('keyboard.ts');
  });

  for (const file of candidateFiles) {
    const relativePath = toRepoPath(root, file);
    const content = readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;

      // 1. Check callback_data literals: e.g. 'action:...', callbackData: '...'
      const callbackMatches = lineText.matchAll(/['](action:[^']+|wizard:[^']+|menu:[^']+)[']/g);
 for (const match of callbackMatches) {
 const raw = match[1];
 // Calculate effective length assuming sample 36-character UUID if template is used
 const sampleResolved = raw.replace(/\$\{[^}]+\}/g, '12345678-1234-1234-1234-123456789abc');
 const byteLen = Buffer.byteLength(sampleResolved, 'utf8');
 result.checked += 1;
 if (byteLen > MAX_TELEGRAM_CALLBACK_BYTES) {
 violations.push({
 file: relativePath,
 line: lineNum,
 type: 'CALLBACK_OVERFLOW',
 detail: sampleResolved,
 byteLength: byteLen,
 maxAllowed: MAX_TELEGRAM_CALLBACK_BYTES,
 });
 }
 }

 // 2. Check URL buttons: e.g. .url('...', 'https://...')
 const urlMatches = lineText.matchAll(/\.url\(\s*['][^']+[']\s*,\s*[']([^']+)[']\s*\)/g);
 for (const match of urlMatches) {
 const urlStr = match[1];
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
