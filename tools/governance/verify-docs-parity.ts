import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createResult, fail, isCliEntrypoint, printAndExit, readUtf8, type VerificationResult } from './common.js';

const GOVERNANCE_FILES = [
  'AGENTS.md',
  'GEMINI.md',
  'docs/14-ai-agent-governance-and-file-rules.md',
  'docs/15-universal-module-and-flow-standard.md',
] as const;

const STANDARD_REFERENCE = 'docs/21-mandatory-module-architecture-and-gates.md';
const MODULE_PATH_MARKERS = ['modules/<module-name>/', 'src/', 'flows/'] as const;
const REQUIRED_GATES = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10'] as const;

export function verifyDocsParity(root = process.cwd()): VerificationResult {
  const result = createResult();

  for (const file of GOVERNANCE_FILES) {
    result.checked += 1;
    const fullPath = join(root, file);
    if (!existsSync(fullPath)) {
      fail(result, `Missing governance file: ${file}`);
      continue;
    }
    const text = readUtf8(fullPath);
    if (!text.includes(STANDARD_REFERENCE)) fail(result, `${file} does not reference ${STANDARD_REFERENCE}`);
  }

  const standardPath = join(root, STANDARD_REFERENCE);
  if (!existsSync(standardPath)) {
    fail(result, `Missing ${STANDARD_REFERENCE}`);
    return result;
  }

  const standard = readUtf8(standardPath);
  for (const marker of MODULE_PATH_MARKERS) {
    result.checked += 1;
    if (!standard.includes(marker)) fail(result, `${STANDARD_REFERENCE} does not define module path marker ${marker}`);
  }

  for (const gate of REQUIRED_GATES) {
    result.checked += 1;
    if (!new RegExp(`${gate}\\b`).test(standard)) fail(result, `${STANDARD_REFERENCE} does not define gate ${gate}`);
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  printAndExit('docs:parity', verifyDocsParity(process.cwd()));
}
