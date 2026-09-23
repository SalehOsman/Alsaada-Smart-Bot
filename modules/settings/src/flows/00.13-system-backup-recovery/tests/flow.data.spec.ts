import { describe, it, expect } from 'vitest';
import { SystemBackupRecoveryRepository } from '../flow.repository.js';

describe('Flow 00.13 Data Tests — Snapshot Registry & Data Invariants', () => {
  it('reads snapshot records and verifies data integrity structure', async () => {
    const repo = new SystemBackupRecoveryRepository();
    const snapshots = await repo.listSnapshots();

    expect(Array.isArray(snapshots)).toBe(true);
    for (const snap of snapshots) {
      expect(typeof snap.backupId).toBe('string');
      expect(snap.backupId.startsWith('BCK-')).toBe(true);
      expect(typeof snap.createdAt).toBe('string');
      expect(typeof snap.totalSizeBytes).toBe('number');
      expect(typeof snap.isIntegrityIntact).toBe('boolean');
    }
  });

  it('determines latest snapshot accurately from repository', async () => {
    const repo = new SystemBackupRecoveryRepository();
    const latest = await repo.getLatestSnapshot();

    if (latest) {
      expect(latest.backupId).toMatch(/^BCK-\d{8}-\d{6}$/);
      expect(new Date(latest.createdAt).getTime()).not.toBeNaN();
    } else {
      expect(latest).toBeNull();
    }
  });
});
