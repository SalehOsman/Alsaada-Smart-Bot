import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createResult, fail, isCliEntrypoint, printAndExit, readUtf8, type VerificationResult } from './common.js';

interface RegistryEntry {
  flowCode: string;
  status: string;
  path: string;
  commit: string;
  lineNumber: number;
}

function stripMarkdown(value: string): string {
  return value.replace(/`/g, '').replace(/\*\*/g, '').trim();
}

function parseRegistryEntries(text: string): RegistryEntry[] {
  const entries: RegistryEntry[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line.trim().startsWith('|') || !line.includes('`')) return;
    const cells = line.split('|').slice(1, -1).map(stripMarkdown);
    if (cells.length < 5) return;
    const flowCode = cells[0] ?? '';
    if (!/^\d|^NEW-/i.test(flowCode)) return;
    entries.push({
      flowCode,
      status: cells[3] ?? '',
      path: cells[4] ?? '',
      commit: cells[5] ?? '',
      lineNumber: index + 1,
    });
  });
  return entries;
}

function isCompleted(status: string): boolean {
  return /مكتمل|Implemented|UAT_PASS|Completed/i.test(status);
}

function isPending(status: string): boolean {
  return /بانتظار|Pending/i.test(status);
}

export function verifyMigrationRegistry(root = process.cwd()): VerificationResult {
  const result = createResult();
  const registryPath = join(root, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md');
  if (!existsSync(registryPath)) {
    fail(result, 'Missing migration registry: docs/19-legacy-to-enterprise-master-feature-migration-registry.md');
    return result;
  }

  const entries = parseRegistryEntries(readUtf8(registryPath));
  result.checked = entries.length;
  const seenCodes = new Set<string>();

  for (const entry of entries) {
    if (seenCodes.has(entry.flowCode)) fail(result, `Duplicate migration entry for flow ${entry.flowCode} at line ${entry.lineNumber}`);
    seenCodes.add(entry.flowCode);

    if (isCompleted(entry.status)) {
      if (!entry.path.startsWith('modules/')) {
        fail(result, `Flow ${entry.flowCode} is completed but path must use modules/: ${entry.path}`);
        continue;
      }
      if (!existsSync(join(root, entry.path))) fail(result, `Flow ${entry.flowCode} path does not exist: ${entry.path}`);
      if (!entry.commit || entry.commit === '-' || entry.commit === '—') fail(result, `Flow ${entry.flowCode} is completed without commit reference`);
    }

    if (isPending(entry.status) && entry.path.startsWith('modules/') && existsSync(join(root, entry.path))) {
      fail(result, `Flow ${entry.flowCode} is pending but has an existing module path: ${entry.path}`);
    }
  }

  return result;
}

export function parseMigrationRegistryForTests(text: string): RegistryEntry[] {
  return parseRegistryEntries(text);
}

if (isCliEntrypoint(import.meta.url)) {
  printAndExit('migration:verify', verifyMigrationRegistry(process.cwd()));
}

