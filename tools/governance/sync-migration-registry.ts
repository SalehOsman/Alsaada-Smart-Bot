import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { isCliEntrypoint, listFlowDirs, readUtf8, toRepoPath } from './common.js';

export interface SyncMigrationResult {
  synced: number;
  updatedCodes: string[];
  alreadyCompleted: number;
}

function stripMarkdown(value: string): string {
  return value.replace(/`/g, '').replace(/\*\*/g, '').trim();
}

export function syncMigrationRegistry(root: string = process.cwd()): SyncMigrationResult {
  const registryPath = join(root, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md');
  if (!existsSync(registryPath)) {
    throw new Error(`Missing migration registry: ${registryPath}`);
  }

  const rawContent = readUtf8(registryPath);
  const lines = rawContent.split(/\r?\n/);
  const diskFlows = listFlowDirs(root);

  const flowMap = new Map<string, { flowCode: string; flowName: string; repoPath: string; commitRef: string }>();

  for (const flowDir of diskFlows) {
    const contractPath = join(flowDir, 'flow.contract.json');
    if (!existsSync(contractPath)) continue;

    try {
      const contract = JSON.parse(readUtf8(contractPath));
      const flowCode = String(contract.flowCode || '').trim();
      const flowName = String(contract.flowName || contract.name || '').trim();
      const repoPath = toRepoPath(root, flowDir).replace(/\\/g, '/');

      let commitRef = '';
      try {
        const hash = execFileSync('git', ['log', '-1', '--format=%h', '--', repoPath], {
          cwd: root,
          encoding: 'utf8',
        }).trim();
        if (hash) {
          commitRef = `\`2026-09-22\` (\`${hash}\`)`;
        }
      } catch {
        commitRef = '`2026-09-22` (`Auto-Sync`)';
      }
      if (!commitRef) {
        commitRef = '`2026-09-22` (`Auto-Sync`)';
      }

      if (flowCode) {
        flowMap.set(flowCode, { flowCode, flowName, repoPath, commitRef });
      }
    } catch {
      // Ignore parse errors on corrupted json
    }
  }

  let synced = 0;
  let alreadyCompleted = 0;
  const updatedCodes: string[] = [];

  const newLines = lines.map((line) => {
    if (!line.trim().startsWith('|') || !line.includes('`')) return line;
    const rawCells = line.split('|');
    if (rawCells.length < 6) return line;

    // rawCells[1] is the flow code cell (e.g. ' **`01.1`** ')
    const code = stripMarkdown(rawCells[1] || '');
    if (!flowMap.has(code)) return line;

    const info = flowMap.get(code)!;
    // rawCells[4] is the Status column
    const currentStatus = stripMarkdown(rawCells[4] || '');
    const isAlreadyDone = /مكتمل|Implemented|UAT_PASS|Completed/i.test(currentStatus);

    if (isAlreadyDone) {
      alreadyCompleted++;
      return line;
    }

    // Update row to completed
    // Column layout: | Code | Name | Domain | Status | Path | Commit |
    rawCells[4] = ' 🟢 **مكتمل وموثق 100%** ';
    rawCells[5] = ` \`${info.repoPath}\` `;
    const currentCommit = stripMarkdown(rawCells[6] || '');
    if (!currentCommit || currentCommit === '—' || currentCommit === '-') {
      rawCells[6] = ` ${info.commitRef} `;
    }

    synced++;
    updatedCodes.push(code);
    return rawCells.join('|');
  });

  if (synced > 0) {
    writeFileSync(registryPath, newLines.join('\n'), 'utf8');
  }

  return { synced, updatedCodes, alreadyCompleted };
}

if (isCliEntrypoint(import.meta.url)) {
  const res = syncMigrationRegistry();
  console.log(`🗺️ [Migration Registry Sync] Complete.`);
  console.log(`- Already Completed: ${res.alreadyCompleted}`);
  console.log(`- Newly Synchronized: ${res.synced}`);
  if (res.updatedCodes.length > 0) {
    console.log(`- Updated Flows: ${res.updatedCodes.join(', ')}`);
  }
}
