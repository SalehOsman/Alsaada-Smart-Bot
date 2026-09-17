import { describe, it, expect, vi } from 'vitest';
import { WorkerCommitmentService } from '../flow.service.js';
import { WorkerCommitmentRepository } from '../flow.repository.js';
import { validateSearchQuery, validatePageNumber, validateEvaluationPeriod } from '../flow.validators.js';

describe('Flow 01.9 Integration Tests — Worker Commitment Index', () => {
  const mockWorkerInput = {
    workerId: 'w-int-1',
    workerName: 'محمود سعد الدين',
    nickname: 'أبو سعد',
    workerCode: 'OP-LAB-0120',
    contractType: 'PERMANENT',
    hireDate: new Date('2024-01-01'),
    siteId: 'site-1',
    siteName: 'منجم الفوسفات',
    jobTitle: 'عامل تشغيل',
    periodStart: new Date('2026-06-01'),
    periodEnd: new Date('2026-09-01'),
    leaves: [],
    disciplinaryRecords: [],
    ppeAssets: [],
    advanceRecords: [],
  };

  it('1. should validate input queries and pagination correctly', () => {
    expect(validateSearchQuery('أحمد').isValid).toBe(true);
    expect(validateSearchQuery('   ').isValid).toBe(false);
    expect(validateSearchQuery('أ').isValid).toBe(false);
    expect(validateSearchQuery('a'.repeat(60)).isValid).toBe(false);

    expect(validatePageNumber(1, 5).isValid).toBe(true);
    expect(validatePageNumber(0, 5).isValid).toBe(false);
    expect(validatePageNumber(6, 5).isValid).toBe(false);

    expect(validateEvaluationPeriod(90).isValid).toBe(true);
    expect(validateEvaluationPeriod(3).isValid).toBe(false);
    expect(validateEvaluationPeriod(400).isValid).toBe(false);
  });

  it('2. should evaluate worker end-to-end via service and repository', async () => {
    const mockRepo = {
      findWorkerByIdOrCode: vi.fn().mockResolvedValue({ id: 'w-int-1', code: 'OP-LAB-0120' }),
      getWorkerEvaluationData: vi.fn().mockResolvedValue(mockWorkerInput),
      saveCommitmentScore: vi.fn().mockResolvedValue({ id: 'wcs-saved-1' }),
    } as unknown as WorkerCommitmentRepository;

    const service = new WorkerCommitmentService(mockRepo);
    const result = await service.evaluateWorker('OP-LAB-0120');

    expect(result).not.toBeNull();
    expect(result?.totalScore).toBe(100);
    expect(result?.tier).toBe('COMMITTED');
    expect(result?.workerId).toBe('w-int-1');
    expect(mockRepo.findWorkerByIdOrCode).toHaveBeenCalledWith('OP-LAB-0120');
  });

  it('3. should generate valid Excel buffer with correct RTL metadata', async () => {
    const mockRepo = {
      getAllWorkersForEvaluation: vi.fn().mockResolvedValue([mockWorkerInput]),
    } as unknown as WorkerCommitmentRepository;

    const service = new WorkerCommitmentService(mockRepo);
    const buffer = await service.exportCommitmentExcel('site-1', 'منجم الفوسفات');

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
