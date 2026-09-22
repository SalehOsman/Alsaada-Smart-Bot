import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateWorkerInviteToken } from '@alsaada/workforce';
import { config } from '../src/config/env.js';
import { prisma } from '../src/db.js';
import type { MyContext } from '../src/types/context.js';
import {
  handleStart,
  handleSubmitJoinRequest,
  handleApproveWorkerLink,
  handleRejectWorkerLink,
  handleAdminUnlinkWorker,
} from '../src/handlers/start.handler.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

vi.mock('../src/db.js', () => ({
  prisma: {
    worker: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    approvalTicket: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-id' }),
    },
    outboxEvent: {
      create: vi.fn().mockResolvedValue({ id: 'outbox-id' }),
    },
    companyProfile: {
      findFirst: vi.fn().mockResolvedValue({
        tradeName: 'شركة السعادة للمقاولات',
        legalName: 'شركة السعادة للمقاولات العامة',
      }),
    },
    tenant: {
      findFirst: vi.fn().mockResolvedValue({ name: 'شركة السعادة' }),
    },
    $transaction: vi.fn().mockImplementation((actions) =>
      Array.isArray(actions) ? Promise.all(actions) : actions(prisma)
    ),
  },
}));

vi.mock('../src/middlewares/auth.middleware.js', () => ({
  invalidateUserCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/redis.js', () => ({
  redis: {
    status: 'ready',
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    on: vi.fn(),
  },
  safeRedisGet: vi.fn().mockResolvedValue(null),
  safeRedisSet: vi.fn().mockResolvedValue(true),
  safeRedisDel: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/services/command-scope.service.js', () => ({
  syncUserCommandsScope: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/services/screen-flow.service.js', () => ({
  screenFlowService: {
    cleanupIncomingUserMessage: vi.fn().mockResolvedValue(undefined),
    cleanupUnfinishedFlow: vi.fn().mockResolvedValue(undefined),
    ensurePersistentKeyboard: vi.fn().mockResolvedValue(undefined),
    trackActiveScreen: vi.fn().mockResolvedValue(undefined),
    shouldRenderInPlace: vi.fn().mockResolvedValue(true),
  },
}));

describe('Worker Invitation Approval Workflow & Admin Shield Suite', () => {
  const secretKey = 'test-secret-encryption-key-for-worker-linking';
  const workerCode = 'OP-DRV-0001';
  let inviteToken: string;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.clearAllMocks();
    config.databaseEncryptionKey = secretKey;
    config.superAdminTelegramId = 999999n;
    inviteToken = generateWorkerInviteToken(workerCode, secretKey);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. Admin Shield on /start inv_...', () => {
    const adminRoles = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'];

    adminRoles.forEach((role) => {
      it(`shows Admin Preview Mode card and suppresses claim button for role: ${role}`, async () => {
        // Arrange
        const mockWorker = {
          id: 'worker-uuid-1',
          code: workerCode,
          name: 'محمد أحمد إبراهيم',
          jobTitle: 'سائق قلاب',
          telegramId: null,
          status: 'ACTIVE',
          site: { name: 'موقع العلمين' },
          hireDate: new Date('2026-01-01T00:00:00.000Z'),
        };

        vi.mocked(prisma.worker.findFirst).mockResolvedValueOnce(mockWorker as any);

        const replyMock = vi.fn().mockResolvedValue({ message_id: 123 });
        const ctx = {
          match: `inv_${workerCode}_${inviteToken}`,
          from: { id: 888888, first_name: 'Admin', username: 'admin_user' },
          effectiveRole: role,
          reply: replyMock,
          api: { sendMessage: vi.fn() },
        } as unknown as MyContext;

        // Act
        await handleStart(ctx);

        // Assert
        expect(replyMock).toHaveBeenCalledTimes(1);
        const [cardText, options] = replyMock.mock.calls[0] as [string, any];

        expect(cardText).toContain('🛡️ *[وضع معاينة الإدارة]*');
        expect(cardText).toContain('لا يمكن ربط هذا العامل بحسابك الإداري');
        expect(cardText).toContain(mockWorker.name);
        expect(cardText).toContain(mockWorker.code);

        const buttons = options.reply_markup.inline_keyboard.flat();
        const hasClaimButton = buttons.some((b: any) =>
          b.callback_data.includes('claim_worker') || b.callback_data.includes('submit_join_request')
        );
        expect(hasClaimButton).toBe(false);
      });
    });
  });

  describe('2. Pre-filled Join Request for Guests/Workers', () => {
    it('shows pre-filled join card with submit button for GUEST', async () => {
      // Arrange
      const mockWorker = {
        id: 'worker-uuid-1',
        code: workerCode,
        name: 'حسن علي محمود',
        jobTitle: 'فني كهرباء',
        telegramId: null,
        status: 'ACTIVE',
        site: { name: 'موقع العاصمة' },
        hireDate: new Date('2026-02-01T00:00:00.000Z'),
      };

      vi.mocked(prisma.worker.findFirst).mockResolvedValueOnce(mockWorker as any);
      vi.mocked(prisma.approvalTicket.findFirst).mockResolvedValueOnce(null);

      const replyMock = vi.fn().mockResolvedValue({ message_id: 456 });
      const ctx = {
        match: `inv_${workerCode}_${inviteToken}`,
        from: { id: 111222, first_name: 'Hassan', username: 'hassan_worker' },
        effectiveRole: 'GUEST',
        reply: replyMock,
        api: { sendMessage: vi.fn() },
      } as unknown as MyContext;

      // Act
      await handleStart(ctx);

      // Assert
      expect(replyMock).toHaveBeenCalledTimes(1);
      const [cardText, options] = replyMock.mock.calls[0] as [string, any];

      expect(cardText).toContain(mockWorker.name);
      expect(cardText).toContain(mockWorker.code);
      expect(cardText).toContain('المسمى الوظيفي');

      const buttons = options.reply_markup.inline_keyboard.flat();
      const submitButton = buttons.find((b: any) =>
        b.callback_data === `action:submit_join_request:${workerCode}:${inviteToken}` ||
        b.callback_data === `act:sub_join:${workerCode}:${inviteToken}`
      );
      expect(submitButton).toBeDefined();
      expect(submitButton.text).toContain('إرسال طلب ربط وتفعيل حسابي');
    });

    it('informs user when they already have a pending ticket for this worker', async () => {
      // Arrange
      const mockWorker = {
        id: 'worker-uuid-1',
        code: workerCode,
        name: 'حسن علي محمود',
        jobTitle: 'فني كهرباء',
        telegramId: null,
        status: 'ACTIVE',
        site: { name: 'موقع العاصمة' },
        hireDate: new Date('2026-02-01T00:00:00.000Z'),
      };

      vi.mocked(prisma.worker.findFirst).mockResolvedValueOnce(mockWorker as any);
      vi.mocked(prisma.approvalTicket.findFirst).mockResolvedValueOnce({
        id: 'ticket-123',
        ticketNumber: '#TCK-JOIN-ABC123',
        status: 'PENDING',
      } as any);

      const replyMock = vi.fn().mockResolvedValue({ message_id: 457 });
      const ctx = {
        match: `inv_${workerCode}_${inviteToken}`,
        from: { id: 111222, first_name: 'Hassan' },
        effectiveRole: 'GUEST',
        reply: replyMock,
        api: { sendMessage: vi.fn() },
      } as unknown as MyContext;

      // Act
      await handleStart(ctx);

      // Assert
      expect(replyMock).toHaveBeenCalledTimes(1);
      const [cardText] = replyMock.mock.calls[0] as [string];
      expect(cardText).toContain('طلبك قيد المراجعة الإدارية');
      expect(cardText).toContain('#TCK-JOIN-ABC123');
    });
  });

  describe('3. Ticket Submission & Admin Notification', () => {
    it('creates ApprovalTicket and sends interactive approval card to Super Admins', async () => {
      // Arrange
      const mockWorker = {
        id: 'worker-uuid-1',
        code: workerCode,
        name: 'محمود سعد',
        jobTitle: 'سائق لودر',
        telegramId: null,
        status: 'ACTIVE',
        site: { name: 'موقع المحاجر' },
      };

      vi.mocked(prisma.worker.findFirst).mockResolvedValueOnce(mockWorker as any);
      vi.mocked(prisma.approvalTicket.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.approvalTicket.create).mockResolvedValueOnce({
        id: 'new-ticket-uuid',
        ticketNumber: '#TCK-JOIN-9999',
        status: 'PENDING',
      } as any);

      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        { telegramId: 999999n } as any,
      ]);

      const editMock = vi.fn().mockResolvedValue(true);
      const sendMsgMock = vi.fn().mockResolvedValue({ message_id: 789 });

      const ctx = {
        callbackQuery: {
          data: `action:submit_join_request:${workerCode}:${inviteToken}`,
          message: { message_id: 555 },
        },
        from: { id: 333444, first_name: 'Mahmoud', username: 'mahmoud_saad' },
        effectiveRole: 'GUEST',
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        editMessageText: editMock,
        reply: vi.fn(),
        api: { sendMessage: sendMsgMock },
      } as unknown as MyContext;

      // Act
      await handleSubmitJoinRequest(ctx);

      // Assert
      expect(prisma.approvalTicket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ticketType: 'GUEST_JOIN_LINKING',
            entityId: mockWorker.id,
            requestedByTelegramId: 333444n,
            status: 'PENDING',
          }),
        })
      );

      expect(editMock).toHaveBeenCalledTimes(1);
      expect((editMock.mock.calls[0] as any)[0]).toContain('#TCK-JOIN-9999');

      expect(sendMsgMock).toHaveBeenCalledWith(
        999999,
        expect.stringContaining('#TCK-JOIN-9999'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ callback_data: 'action:approve_worker_link:new-ticket-uuid' }),
                expect.objectContaining({ callback_data: 'action:reject_worker_link:new-ticket-uuid' }),
              ]),
            ]),
          }),
        })
      );
    });
  });

  describe('4. Instant Activation upon Admin Approval', () => {
    it('links worker, promotes user to WORKER, and notifies worker when approved', async () => {
      // Arrange
      const applicantTelegramId = 555666n;
      const mockTicket = {
        id: 'ticket-to-approve',
        ticketNumber: '#TCK-JOIN-7777',
        ticketType: 'GUEST_JOIN_LINKING',
        entityId: 'worker-uuid-2',
        requestedByTelegramId: applicantTelegramId,
        status: 'PENDING',
        reviewDecisionNotes: 'طلب انضمام',
      };

      const mockWorker = {
        id: 'worker-uuid-2',
        code: 'OP-EQP-0042',
        name: 'سامح فوزي',
        jobTitle: 'مشغل خلاطة',
        telegramId: null,
        site: { name: 'المصنع' },
      };

      vi.mocked(prisma.approvalTicket.findUnique).mockResolvedValueOnce(mockTicket as any);
      vi.mocked(prisma.worker.findUnique).mockResolvedValueOnce(mockWorker as any);
      vi.mocked(prisma.approvalTicket.update).mockResolvedValueOnce({ ...mockTicket, status: 'APPROVED' } as any);
      vi.mocked(prisma.worker.update).mockResolvedValueOnce({ ...mockWorker, telegramId: applicantTelegramId } as any);
      vi.mocked(prisma.user.upsert).mockResolvedValueOnce({ id: 'user-id', role: 'WORKER' } as any);

      const editMock = vi.fn().mockResolvedValue(true);
      const sendMsgMock = vi.fn().mockResolvedValue({ message_id: 999 });

      const ctx = {
        callbackQuery: {
          data: 'action:approve_worker_link:ticket-to-approve',
          message: { message_id: 888 },
        },
        from: { id: 999999, first_name: 'Super', last_name: 'Admin' },
        effectiveRole: 'SUPER_ADMIN',
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        editMessageText: editMock,
        api: { sendMessage: sendMsgMock },
      } as unknown as MyContext;

      // Act
      await handleApproveWorkerLink(ctx);

      // Assert
      expect(prisma.approvalTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ticket-to-approve' },
          data: expect.objectContaining({
            status: 'APPROVED',
            reviewedByTelegramId: 999999n,
          }),
        })
      );

      expect(prisma.worker.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'worker-uuid-2' },
          data: { telegramId: applicantTelegramId },
        })
      );

      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { telegramId: applicantTelegramId },
          update: expect.objectContaining({ role: 'WORKER', workerId: 'worker-uuid-2' }),
        })
      );

      expect(editMock).toHaveBeenCalledTimes(1);
      expect((editMock.mock.calls[0] as any)[0]).toContain('تم اعتماد وتفعيل ربط حساب العامل بنجاح');

      expect(sendMsgMock).toHaveBeenCalledWith(
        Number(applicantTelegramId),
        expect.stringContaining('تم اعتماد وتفعيل حسابك رسمياً من قبل الإدارة'),
        expect.anything()
      );
    });

    it('rejects approval attempt if performer is not an admin', async () => {
      // Arrange
      const replyMock = vi.fn().mockResolvedValue(true);
      const ctx = {
        callbackQuery: { data: 'action:approve_worker_link:ticket-id' },
        from: { id: 123456 },
        effectiveRole: 'WORKER',
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        reply: replyMock,
      } as unknown as MyContext;

      // Act
      await handleApproveWorkerLink(ctx);

      // Assert
      expect(replyMock).toHaveBeenCalledWith(expect.stringContaining('غير مصرح لك'), expect.anything());
      expect(prisma.approvalTicket.update).not.toHaveBeenCalled();
    });
  });

  describe('5. Rejection Handling', () => {
    it('sets ticket to REJECTED and notifies worker politely', async () => {
      // Arrange
      const applicantTelegramId = 666777n;
      const mockTicket = {
        id: 'ticket-to-reject',
        ticketNumber: '#TCK-JOIN-REJ1',
        entityId: 'worker-uuid-3',
        requestedByTelegramId: applicantTelegramId,
        status: 'PENDING',
      };

      vi.mocked(prisma.approvalTicket.findUnique).mockResolvedValueOnce(mockTicket as any);
      vi.mocked(prisma.approvalTicket.update).mockResolvedValueOnce({ ...mockTicket, status: 'REJECTED' } as any);

      const editMock = vi.fn().mockResolvedValue(true);
      const sendMsgMock = vi.fn().mockResolvedValue(true);

      const ctx = {
        callbackQuery: {
          data: 'action:reject_worker_link:ticket-to-reject',
          message: { message_id: 111 },
        },
        from: { id: 999999, first_name: 'Super', last_name: 'Admin' },
        effectiveRole: 'SUPER_ADMIN',
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        editMessageText: editMock,
        api: { sendMessage: sendMsgMock },
      } as unknown as MyContext;

      // Act
      await handleRejectWorkerLink(ctx);

      // Assert
      expect(prisma.approvalTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ticket-to-reject' },
          data: expect.objectContaining({ status: 'REJECTED' }),
        })
      );

      expect(sendMsgMock).toHaveBeenCalledWith(
        Number(applicantTelegramId),
        expect.stringContaining('تم رفض طلب ربط حسابك'),
        expect.anything()
      );
      expect(prisma.worker.update).not.toHaveBeenCalled();
    });
  });

  describe('6. Admin Unlink Worker Account', () => {
    it('cleanly unlinks worker Telegram ID and demotes user to GUEST', async () => {
      // Arrange
      const previousTelegramId = 444555n;
      const mockWorker = {
        id: 'worker-uuid-4',
        code: 'OP-DRV-0088',
        name: 'طارق عبد الله',
        nickname: 'أبو طارق',
        telegramId: previousTelegramId,
      };

      vi.mocked(prisma.worker.findUnique).mockResolvedValueOnce(mockWorker as any);
      vi.mocked(prisma.worker.update).mockResolvedValueOnce({ ...mockWorker, telegramId: null } as any);
      vi.mocked(prisma.user.updateMany).mockResolvedValueOnce({ count: 1 } as any);

      const editMock = vi.fn().mockResolvedValue(true);
      const sendMsgMock = vi.fn().mockResolvedValue(true);

      const ctx = {
        callbackQuery: {
          data: 'action:worker:unlink_telegram:worker-uuid-4',
          message: { message_id: 222 },
        },
        from: { id: 999999, first_name: 'Field', last_name: 'Admin' },
        effectiveRole: 'FIELD_ADMIN',
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        editMessageText: editMock,
        api: { sendMessage: sendMsgMock },
      } as unknown as MyContext;

      // Act
      await handleAdminUnlinkWorker(ctx);

      // Assert
      expect(prisma.worker.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'worker-uuid-4' },
          data: { telegramId: null },
        })
      );

      expect(prisma.user.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { telegramId: previousTelegramId, role: 'WORKER' },
          data: { role: 'GUEST' },
        })
      );

      expect(editMock).toHaveBeenCalledWith(
        expect.stringContaining('تم إلغاء ربط حساب التليجرام بنجاح'),
        expect.anything()
      );

      expect(sendMsgMock).toHaveBeenCalledWith(
        Number(previousTelegramId),
        expect.stringContaining('تم إلغاء ربط حساب التليجرام الخاص بك بالسجل الوظيفي من قبل الإدارة'),
        expect.anything()
      );
      expect(prisma.worker.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: { telegramId: previousTelegramId },
        })
      );
    });
  });
});
