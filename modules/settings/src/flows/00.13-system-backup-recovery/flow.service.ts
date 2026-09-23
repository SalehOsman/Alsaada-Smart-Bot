import type { SystemBackupRecoveryRepository } from './flow.repository.js';
import type {
  BackupStatusDto,
  BackupExecutionResultDto,
  DisasterRecoveryDrillDto,
  BackupListItemDto,
} from './flow.types.js';
import {
  createFullBackup,
  listBackups,
} from '../../../../../tools/backup/backup-manager.js';
import { runDisasterRecoveryDrill } from '../../../../../tools/backup/verify-disaster-recovery.js';

export class SystemBackupRecoveryService {
  constructor(private readonly repo?: SystemBackupRecoveryRepository) {}

  async getBackupStatus(): Promise<BackupStatusDto> {
    const backups = this.repo ? await this.repo.getBackupsList() : await listBackups();
    const latest = backups[0] ?? null;

    return {
      totalBackups: backups.length,
      latestBackupId: latest?.backupId ?? null,
      latestBackupAt: latest?.createdAt ?? null,
      rpoStatus: latest ? 'HEALTHY' : 'NEEDS_BACKUP',
      cloudSyncEnabled: Boolean(process.env.GDRIVE_FOLDER_ID),
      encryptionType: 'AES-256-GCM',
      zeroBloatLimitMb: 30,
    };
  }

  async executeBackupNow(): Promise<BackupExecutionResultDto> {
    const manifest = await createFullBackup({
      syncCloud: Boolean(process.env.GDRIVE_FOLDER_ID),
    });

    let totalSizeBytes = 0;
    for (const art of manifest.artifacts) {
      totalSizeBytes += art.sizeBytes;
    }

    return {
      success: true,
      backupId: manifest.backupId,
      createdAt: manifest.createdAt,
      artifactsCount: manifest.artifacts.length,
      cloudSyncStatus: manifest.cloudSyncStatus,
      totalSizeBytes,
    };
  }

  async runDrill(): Promise<DisasterRecoveryDrillDto> {
    const result = await runDisasterRecoveryDrill();
    return {
      ok: result.ok,
      rtoSeconds: result.metrics.rtoSeconds,
      bundleSizeMb: result.metrics.bundleSizeBytes / (1024 * 1024),
      errors: result.errors,
    };
  }

  async listRecentBackups(): Promise<BackupListItemDto[]> {
    const backups = this.repo ? await this.repo.getBackupsList() : await listBackups();
    return backups.map((b) => ({
      backupId: b.backupId,
      createdAt: b.createdAt,
      totalSizeBytes: b.totalSizeBytes,
      isIntegrityIntact: b.isIntegrityIntact,
    }));
  }
}
