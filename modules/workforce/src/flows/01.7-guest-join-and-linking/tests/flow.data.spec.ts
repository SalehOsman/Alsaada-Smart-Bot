import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GuestJoinRepository } from '../flow.repository.js';
import type { PrismaClient } from '@alsaada/database';

describe('01.7 Guest Join & WhatsApp Linking — Data Integrity Tests', () => {
  const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('creates approval ticket with proper ticketType and applicantTelegramId', async () => {
    // Arrange
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

    // Act
    const ticket = await repo.createJoinApplication(
      applicantId,
      'w-1',
      'OP-01',
      'حسام حسن',
      'طلب انضمام جديد'
    );

    // Assert
    expect(ticket.ticketNumber).toBe('#TCK-JOIN-ABC');
    expect(ticket.status).toBe('PENDING');
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
    expect(ticket.status).not.toBe('REJECTED');
  });
});
