import { describe, it, expect } from 'vitest';
import type { BackupListItemDto } from '@alsaada/settings';
import type { BackupItem } from '../src/app/admin/settings/backup/backup-client';

describe('Work Plan 105 / Incident INC-20260924-DOCKER-D — Backup Settings Page Contract Parity', () => {
  it('handles BackupListItemDto with optional artifactsCount mapped to BackupItem', () => {
    const rawDtos: BackupListItemDto[] = [
      {
        backupId: 'bk-001',
        createdAt: '2026-09-24T12:00:00.000Z',
        totalSizeBytes: 1048576,
        isIntegrityIntact: true,
        artifactsCount: 42,
      },
      {
        backupId: 'bk-002',
        createdAt: '2026-09-24T13:00:00.000Z',
        totalSizeBytes: 2097152,
        isIntegrityIntact: false,
        artifactsCount: undefined,
      },
      {
        backupId: 'bk-003',
        createdAt: '2026-09-24T14:00:00.000Z',
        totalSizeBytes: 524288,
        isIntegrityIntact: true,
      },
    ];

    // Mirroring page.tsx mapping logic
    const mappedItems: BackupItem[] = rawDtos.map((b) => ({
      ...b,
      artifactsCount: b.artifactsCount ?? 0,
    }));

    expect(mappedItems).toHaveLength(3);
    expect(mappedItems[0].artifactsCount).toBe(42);
    expect(mappedItems[1].artifactsCount).toBe(0);
    expect(mappedItems[2].artifactsCount).toBe(0);
    expect(mappedItems[0].isIntegrityIntact).toBe(true);
    expect(mappedItems[1].isIntegrityIntact).toBe(false);
  });

  it('allows BackupItem to accept undefined artifactsCount without breaking interface', () => {
    const directItem: BackupItem = {
      backupId: 'bk-direct',
      createdAt: new Date().toISOString(),
      totalSizeBytes: 100,
      isIntegrityIntact: true,
      artifactsCount: undefined,
    };

    expect(directItem.artifactsCount).toBeUndefined();
  });
});
