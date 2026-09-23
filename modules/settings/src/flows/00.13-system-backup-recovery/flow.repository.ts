import type { PrismaClient } from '@alsaada/database';
import { listBackups, type BackupListItem } from '../../../../../tools/backup/backup-manager.js';

export class SystemBackupRecoveryRepository {
  constructor(private readonly prisma?: PrismaClient) {}

  async getBackupsList(): Promise<BackupListItem[]> {
    return listBackups();
  }

  async listSnapshots(): Promise<BackupListItem[]> {
    return listBackups();
  }

  async getLatestBackup(): Promise<BackupListItem | null> {
    const list = await listBackups();
    return list[0] ?? null;
  }

  async getLatestSnapshot(): Promise<BackupListItem | null> {
    const list = await listBackups();
    return list[0] ?? null;
  }
}
