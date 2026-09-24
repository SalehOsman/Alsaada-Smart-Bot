import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { PrismaClient } from '@alsaada/database';

export interface BackupListItem {
  backupId: string;
  createdAt: string;
  dbDumpFile?: string | undefined;
  codeBundleFile?: string | undefined;
  totalSizeBytes: number;
  isIntegrityIntact: boolean;
  artifactsCount: number;
}

export class SystemBackupRecoveryRepository {
  constructor(private readonly prisma?: PrismaClient) {}

  async getBackupsList(baseBackupDir?: string, root = process.cwd()): Promise<BackupListItem[]> {
    const baseDir = resolve(baseBackupDir ?? join(root, 'backups'));
    if (!existsSync(baseDir)) {
      return [];
    }

    const files = readdirSync(baseDir);
    const manifestFiles = files.filter((f) => f.startsWith('manifest-') && f.endsWith('.json'));
    const items: BackupListItem[] = [];

    for (const mf of manifestFiles) {
      try {
        const fullPath = join(baseDir, mf);
        const manifest = JSON.parse(readFileSync(fullPath, 'utf8')) as {
          backupId: string;
          createdAt: string;
          artifacts?: Array<{ type: string; fileName: string; sizeBytes: number }>;
        };

        const artifacts = manifest.artifacts ?? [];
        const totalSize = artifacts.reduce((acc, a) => acc + (a.sizeBytes || 0), 0);
        const dbDump = artifacts.find((a) => a.type === 'database')?.fileName;
        const codeBundle = artifacts.find((a) => a.type === 'codebase')?.fileName;

        items.push({
          backupId: manifest.backupId,
          createdAt: manifest.createdAt,
          dbDumpFile: dbDump,
          codeBundleFile: codeBundle,
          totalSizeBytes: totalSize,
          isIntegrityIntact: true,
          artifactsCount: artifacts.length,
        });
      } catch {
        // Skip corrupted manifest
      }
    }

    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async listSnapshots(): Promise<BackupListItem[]> {
    return this.getBackupsList();
  }

  async getLatestBackup(): Promise<BackupListItem | null> {
    const list = await this.getBackupsList();
    return list[0] ?? null;
  }

  async getLatestSnapshot(): Promise<BackupListItem | null> {
    const list = await this.getBackupsList();
    return list[0] ?? null;
  }
}
