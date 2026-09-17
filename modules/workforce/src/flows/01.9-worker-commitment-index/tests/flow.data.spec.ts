import { describe, it, expect } from 'vitest';
import { WorkerCommitmentEngine } from '@alsaada/core-components';
import type { WorkerCommitmentInput } from '@alsaada/core-components';

describe('Flow 01.9 Data Tests — Worker Commitment Index', () => {
  const baseInput: WorkerCommitmentInput = {
    workerId: 'w-data-1',
    workerName: 'كريم إبراهيم',
    workerCode: 'OP-LAB-0050',
    contractType: 'PERMANENT',
    hireDate: new Date('2024-01-01'),
    periodStart: new Date('2026-06-01'),
    periodEnd: new Date('2026-09-01'),
    leaves: [],
    disciplinaryRecords: [],
    ppeAssets: [],
    advanceRecords: [],
  };

  it('1. should uphold mathematical invariant: sum of categories equals total score', () => {
    const result = WorkerCommitmentEngine.calculateScore(baseInput);
    const sum =
      result.leaveShiftScore +
      result.disciplinaryScore +
      result.ppeScore +
      result.financialScore;

    expect(result.leaveShiftScore).toBe(40);
    expect(result.disciplinaryScore).toBe(30);
    expect(result.ppeScore).toBe(15);
    expect(result.financialScore).toBe(15);
    expect(sum).toBe(100);
    expect(result.totalScore).toBe(100);
  });

  it('2. should enforce category maximum bounds', () => {
    const result = WorkerCommitmentEngine.calculateScore(baseInput);
    expect(result.leaveShiftScore).toBeLessThanOrEqual(40);
    expect(result.disciplinaryScore).toBeLessThanOrEqual(30);
    expect(result.ppeScore).toBeLessThanOrEqual(15);
    expect(result.financialScore).toBeLessThanOrEqual(15);
  });

  it('3. should verify forensic SHA-256 reproducibility and tamper detection', () => {
    const res1 = WorkerCommitmentEngine.calculateScore(baseInput);
    const res2 = WorkerCommitmentEngine.calculateScore(baseInput);
    expect(res1.sha256Checksum).toBe(res2.sha256Checksum);

    // Tampered input (different workerCode)
    const tampered = WorkerCommitmentEngine.calculateScore({
      ...baseInput,
      workerCode: 'OP-LAB-TAMPERED',
    });
    expect(tampered.sha256Checksum).not.toBe(res1.sha256Checksum);
  });

  it('4. should validate snapshot key format (YYYY-MM)', () => {
    const validSnapshotRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    expect(validSnapshotRegex.test('2026-09')).toBe(true);
    expect(validSnapshotRegex.test('2026-13')).toBe(false);
    expect(validSnapshotRegex.test('invalid')).toBe(false);
  });
});
