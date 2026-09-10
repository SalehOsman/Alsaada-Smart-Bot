import { describe, it, expect, vi } from 'vitest';
import { GuestJoinRepository } from '../flow.repository.js';
import type { PrismaClient } from '@alsaada/database';

describe('01.7 Guest Join & WhatsApp Linking — Data Integrity Tests', () => {
  it('should create approval ticket with proper ticketType and applicantTelegramId', async () => {
    const mockPrisma = {
      approvalTicket: {
        create: vi.fn().mockResolvedValue({
          ticketNumber: '#TCK-JOIN-ABC',
          status: 'PENDING',
        }),
      },
    } as unknown as PrismaClient;

    const repo = new GuestJoinRepository(mockPrisma);
    const applicantId = 99881122n;

    const ticket = await repo.createJoinApplication(
      applicantId,
      'w-1',
      'OP-01',
      'حسام حسن',
      'طلب انضمام جديد'
    );

    expect(ticket.ticketNumber).toBe('#TCK-JOIN-ABC');
    expect(mockPrisma.approvalTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ticketType: 'GUEST_JOIN_LINKING',
          entityId: 'w-1',
          requestedByTelegramId: applicantId,
          status: 'PENDING',
        }),
      })
    );
  });
});
