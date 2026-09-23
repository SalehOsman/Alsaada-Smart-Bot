export interface BackupStatusDto {
  totalBackups: number;
  latestBackupId: string | null;
  latestBackupAt: string | null;
  rpoStatus: 'HEALTHY' | 'NEEDS_BACKUP';
  cloudSyncEnabled: boolean;
  encryptionType: string;
  zeroBloatLimitMb: number;
}

export interface BackupExecutionResultDto {
  success: boolean;
  backupId: string;
  createdAt: string;
  artifactsCount: number;
  cloudSyncStatus: string;
  totalSizeBytes?: number;
  error?: string | undefined;
}

export interface DisasterRecoveryDrillDto {
  ok: boolean;
  rtoSeconds: number;
  bundleSizeMb: number;
  errors: string[];
}

export interface BackupListItemDto {
  backupId: string;
  createdAt: string;
  totalSizeBytes: number;
  isIntegrityIntact: boolean;
}
