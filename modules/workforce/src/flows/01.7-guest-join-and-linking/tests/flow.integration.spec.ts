import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GuestJoinService } from '../flow.service.js';
import { GuestJoinRepository } from '../flow.repository.js';
import type { PrismaClient } from '@alsaada/database';

describe('01.7 Guest Join & WhatsApp Linking — Integration Tests', () => {
  const secretKey = 'integration-secret-test';

  beforeEach(() => {
    GuestJoinRepository.clearStateForTesting();
  });

  it('should generate WhatsApp verification URL and consume linking token to promote user', async () => {
    const mockPrisma = {
      worker: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'w-42',
          code: 'OP-DRV-0042',
          name: 'صلاح عثمان',
          nickname: 'أبو علي',
          jobTitle: 'سائق لودر',
          phoneEncrypted: '01012345678',
          telegramId: null,
          site: { name: 'موقع أبو طرطور' },
        }),
        update: vi.fn().mockResolvedValue({ id: 'w-42' }),
      },
      user: {
        upsert: vi.fn().mockResolvedValue({ id: 'u-42', role: 'WORKER' }),
      },
      approvalTicket: {
        create: vi.fn().mockResolvedValue({ ticketNumber: '#TCK-JOIN-1234' }),
        findFirst: vi.fn().mockResolvedValue({ ticketNumber: '#TCK-JOIN-1234', status: 'PENDING' }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'aud-1' }),
      },
      outboxEvent: {
        create: vi.fn().mockResolvedValue({ id: 'out-1' }),
      },
      $transaction: vi.fn().mockImplementation(async (fns: unknown[]) => Promise.all(fns)),
    } as unknown as PrismaClient;

    const repo = new GuestJoinRepository(mockPrisma);
    const service = new GuestJoinService(repo, secretKey);

    const applicantId = 77665544n;
    const { whatsAppUrl, tokenString } = service.generateVerificationWhatsAppUrl(
      'OP-DRV-0042',
      'صلاح عثمان',
      '01012345678',
      applicantId
    );

    expect(whatsAppUrl).toContain('https://wa.me/201012345678?text=');
    expect(whatsAppUrl).toContain(tokenString);

    // Parse token components
    const parts = tokenString.replace('link_', '').split('_');
    const workerCode = parts[0]!;
    const parsedApplicantId = BigInt(parts[1]!);
    const expiresAt = parseInt(parts[2]!, 10);
    const signature = parts[3]!;

    // Consume the token
    const consumeRes = await service.consumeLinkingToken(
      workerCode,
      parsedApplicantId,
      expiresAt,
      signature,
      applicantId,
      'saleh_test'
    );

    expect(consumeRes.success).toBe(true);
    expect(consumeRes.workerCode).toBe('OP-DRV-0042');
    expect(mockPrisma.worker.update).toHaveBeenCalled();
    expect(mockPrisma.user.upsert).toHaveBeenCalled();

    // Single-use token check: consuming it second time must fail!
    await expect(
      service.consumeLinkingToken(
        workerCode,
        parsedApplicantId,
        expiresAt,
        signature,
        applicantId
      )
    ).rejects.toThrow(/تم استهلاك هذا الرابط مسبقاً/);
  });

  it('should invalidate an older token when a new token is generated for the same worker', async () => {
    const mockPrisma = {
      worker: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'w-42',
          code: 'OP-DRV-0042',
          name: 'صلاح عثمان',
          status: 'ACTIVE',
          telegramId: null,
        }),
        update: vi.fn().mockResolvedValue({ id: 'w-42' }),
      },
      user: { upsert: vi.fn().mockResolvedValue({ id: 'u-42' }) },
      approvalTicket: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'aud-1' }) },
      outboxEvent: { create: vi.fn().mockResolvedValue({ id: 'out-1' }) },
      $transaction: vi.fn().mockImplementation(async (fns: unknown[]) => Promise.all(fns)),
    } as unknown as PrismaClient;

    const repo = new GuestJoinRepository(mockPrisma);
    const service = new GuestJoinService(repo, secretKey);
    const applicantId = 77665544n;

    const t0 = Math.floor(Date.now() / 1000);
    // Token 1
    const { tokenString: token1 } = service.generateVerificationWhatsAppUrl(
      'OP-DRV-0042',
      'صلاح عثمان',
      '01012345678',
      applicantId,
      undefined,
      t0
    );

    // Token 2 (supersedes Token 1)
    const { tokenString: token2 } = service.generateVerificationWhatsAppUrl(
      'OP-DRV-0042',
      'صلاح عثمان',
      '01012345678',
      applicantId,
      undefined,
      t0 + 10
    );

    const parts1 = token1.replace('link_', '').split('_');
    const parts2 = token2.replace('link_', '').split('_');

    // Attempting to consume Token 1 must fail as superseded
    await expect(
      service.consumeLinkingToken(
        parts1[0]!,
        BigInt(parts1[1]!),
        parseInt(parts1[2]!, 10),
        parts1[3]!,
        applicantId
      )
    ).rejects.toThrow(/تم إبطال هذا الرابط لتوليد رابط أحدث للعامل/);

    // Consuming Token 2 succeeds
    const res2 = await service.consumeLinkingToken(
      parts2[0]!,
      BigInt(parts2[1]!),
      parseInt(parts2[2]!, 10),
      parts2[3]!,
      applicantId
    );
    expect(res2.success).toBe(true);
  });

  it('should reject linking when worker status is TERMINATED', async () => {
    const mockPrisma = {
      worker: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'w-99',
          code: 'OP-HLP-0099',
          name: 'محمد أحمد',
          status: 'TERMINATED',
          telegramId: null,
        }),
      },
    } as unknown as PrismaClient;

    const repo = new GuestJoinRepository(mockPrisma);
    const service = new GuestJoinService(repo, secretKey);
    const applicantId = 99887766n;

    const { tokenString } = service.generateVerificationWhatsAppUrl(
      'OP-HLP-0099',
      'محمد أحمد',
      '01099999999',
      applicantId
    );

    const parts = tokenString.replace('link_', '').split('_');

    await expect(
      service.consumeLinkingToken(
        parts[0]!,
        BigInt(parts[1]!),
        parseInt(parts[2]!, 10),
        parts[3]!,
        applicantId
      )
    ).rejects.toThrow(/تم إنهاء خدمة هذا السجل الوظيفي/);
  });
});
