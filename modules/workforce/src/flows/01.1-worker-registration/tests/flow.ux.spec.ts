import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerRegistrationHandler } from '../flow.handler.js';
import { WorkerRegistrationService, RedisWorkerWizardStateStore } from '../flow.service.js';
import { WorkerRegistrationRepository } from '../flow.repository.js';
import { WorkerWizardStep } from '../flow.types.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.1 UX Tests — Single Message Lifecycle & Navigation', () => {
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

  it('updates messages in place via editMessageText on wizard step transitions', async () => {
    // Arrange
    const repo = new WorkerRegistrationRepository({} as PrismaClient);
    const service = new WorkerRegistrationService(repo);
    const handler = new WorkerRegistrationHandler(service, repo);

    let editMessageCalled = false;
    const mockCtx = {
      from: { id: 123456 },
      callbackQuery: {
        id: 'cb-1',
        message: { message_id: 999 },
      },
      effectiveRole: 'FIELD_ADMIN',
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockImplementation(() => {
        editMessageCalled = true;
        return Promise.resolve(true);
      }),
      reply: vi.fn(),
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleDocType(mockCtx, 'NATIONAL_ID');

    // Assert
    expect(editMessageCalled).toBe(true);
    expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
  });

  it('preserves previous step data when navigating backwards via handleBack', async () => {
    // Arrange
    const repo = new WorkerRegistrationRepository({} as PrismaClient);
    const service = new WorkerRegistrationService(repo);
    const handler = new WorkerRegistrationHandler(service, repo);

    const telegramId = BigInt(778899);
    await service.pushStep(telegramId, WorkerWizardStep.DOC_TYPE);
    await service.pushStep(telegramId, WorkerWizardStep.FULL_NAME, { name: 'عمر خالد' });

    let backEdited = false;
    const mockCtx = {
      from: { id: 778899 },
      callbackQuery: {
        id: 'cb-back',
        message: { message_id: 1001 },
      },
      effectiveRole: 'SUPER_ADMIN',
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockImplementation(() => {
        backEdited = true;
        return Promise.resolve(true);
      }),
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleBack(mockCtx);

    // Assert
    const draft = await service.getDraft(telegramId);
    expect(draft?.currentStep).toBe(WorkerWizardStep.DOC_TYPE);
    expect(draft?.name).toBe('عمر خالد');
    expect(backEdited).toBe(true);
  });

  it('edits message in place via ctx.api.editMessageText when receiving text input with activeMessageId', async () => {
    // Arrange
    const repo = new WorkerRegistrationRepository({} as PrismaClient);
    const service = new WorkerRegistrationService(repo);
    const handler = new WorkerRegistrationHandler(service, repo);

    const telegramId = BigInt(554433);
    await service.pushStep(telegramId, WorkerWizardStep.FULL_NAME, {
      activeMessageId: 777,
      chatId: 999888,
    });

    let apiEditCalled = false;
    let deletedUserMessage = false;

    const mockCtx = {
      from: { id: 554433 },
      chat: { id: 999888 },
      effectiveRole: 'SUPER_ADMIN',
      deleteMessage: vi.fn().mockImplementation(() => {
        deletedUserMessage = true;
        return Promise.resolve(true);
      }),
      api: {
        editMessageText: vi.fn().mockImplementation(() => {
          apiEditCalled = true;
          return Promise.resolve(true);
        }),
      },
      reply: vi.fn(),
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleTextInput(mockCtx, 'محمد حسني مبارك علي');

    // Assert
    expect(deletedUserMessage).toBe(true);
    expect(apiEditCalled).toBe(true);
    expect(mockCtx.reply).not.toHaveBeenCalled();

    const draft = await service.getDraft(telegramId);
    expect(draft?.currentStep).toBe(WorkerWizardStep.NICKNAME);
    expect(draft?.name).toBe('محمد حسني مبارك علي');
  });

  it('strictly rejects "تخطي" or "-" or short text in CUSTOM_WALLET_INPUT to enforce mandatory payment info', async () => {
    // Arrange
    const mockPrisma = {
      worker: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaClient;
    const repo = new WorkerRegistrationRepository(mockPrisma);
    const service = new WorkerRegistrationService(repo);
    const handler = new WorkerRegistrationHandler(service, repo);

    const telegramId = BigInt(667788);
    await service.pushStep(telegramId, WorkerWizardStep.CUSTOM_WALLET_INPUT, {
      activeMessageId: 888,
      chatId: 999888,
    });

    let renderedError = false;
    const mockCtx = {
      from: { id: 667788 },
      chat: { id: 999888 },
      effectiveRole: 'SUPER_ADMIN',
      deleteMessage: vi.fn().mockResolvedValue(true),
      api: {
        editMessageText: vi.fn().mockImplementation((_chatId: number, _msgId: number, text: string) => {
          if (text.includes('رقم المحفظة أو الحساب إلزامي ولا يمكن تخطيه')) {
            renderedError = true;
          }
          return Promise.resolve(true);
        }),
      },
      reply: vi.fn(),
    } as unknown as WorkforceModuleContext;

    // Act
    await handler.handleTextInput(mockCtx, 'تخطي');

    // Assert
    expect(renderedError).toBe(true);
    let draft = await service.getDraft(telegramId);
    expect(draft?.currentStep).toBe(WorkerWizardStep.CUSTOM_WALLET_INPUT);
    expect(draft?.paymentMethod).toBeUndefined();

    // Act: enter a valid wallet number
    renderedError = false;
    await handler.handleTextInput(mockCtx, '01099887766');

    // Assert
    draft = await service.getDraft(telegramId);
    expect(draft?.currentStep).toBe(WorkerWizardStep.PAYOUT_METHOD_CHOICE);
    expect(draft?.accountNumber).toBe('01099887766');
  });

  describe('AI Vision Dual-Path Onboarding UX', () => {
    it('processes front photo, scans with AI, and advances to PHOTO_BACK for NATIONAL_ID', async () => {
      // Arrange
      const repo = new WorkerRegistrationRepository({} as PrismaClient);
      const service = new WorkerRegistrationService(repo);
      const handler = new WorkerRegistrationHandler(service, repo);

      const telegramId = BigInt(112211);
      await service.pushStep(telegramId, WorkerWizardStep.PHOTO_FRONT, {
        idType: 'NATIONAL_ID',
        activeMessageId: 200,
        chatId: 300,
      });

      vi.spyOn(service, 'downloadTelegramPhotoBuffer').mockResolvedValue(Buffer.from('fake-front-photo'));
      vi.spyOn(service, 'scanIdentityPhoto').mockResolvedValue({
        isValid: true,
        detectedDocType: 'EGYPTIAN_NATIONAL_ID_FRONT',
        isQualityAcceptable: true,
        nationalIdNumber: '29205151234567',
        fullName: 'أحمد محمود إبراهيم خليل',
        birthDate: new Date('1992-05-15'),
        age: 34,
        gender: 'MALE',
        governorateCode: '12',
        governorateNameAr: 'الدقهلية',
        address: 'المنصورة شارع الجمهورية',
        confidenceScore: 0.95,
      });

      let editedMessage = false;
      let deletedUserMsg = false;

      const mockCtx = {
        from: { id: 112211 },
        chat: { id: 300 },
        effectiveRole: 'FIELD_ADMIN',
        deleteMessage: vi.fn().mockImplementation(() => {
          deletedUserMsg = true;
          return Promise.resolve(true);
        }),
        api: {
          editMessageText: vi.fn().mockImplementation(() => {
            editedMessage = true;
            return Promise.resolve(true);
          }),
        },
      } as unknown as WorkforceModuleContext;

      // Act
      await handler.handlePhotoInput(mockCtx, 'tg-file-front-123');

      // Assert
      expect(deletedUserMsg).toBe(true);
      expect(editedMessage).toBe(true);

      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.PHOTO_BACK);
      expect(draft?.frontPhotoFileId).toBe('tg-file-front-123');
      expect(draft?.name).toBe('أحمد محمود إبراهيم خليل');
      expect(draft?.idNumber).toBe('29205151234567');
      expect(draft?.aiDetectedData?.nationalId).toBe('29205151234567');
    });

    it('processes passport photo, scans with AI, and advances directly to AI_CONFIRMATION', async () => {
      // Arrange
      const repo = new WorkerRegistrationRepository({} as PrismaClient);
      const service = new WorkerRegistrationService(repo);
      const handler = new WorkerRegistrationHandler(service, repo);

      const telegramId = BigInt(112212);
      await service.pushStep(telegramId, WorkerWizardStep.PHOTO_FRONT, {
        idType: 'PASSPORT',
        activeMessageId: 201,
        chatId: 301,
      });

      vi.spyOn(service, 'downloadTelegramPhotoBuffer').mockResolvedValue(Buffer.from('fake-pass-photo'));
      vi.spyOn(service, 'scanIdentityPhoto').mockResolvedValue({
        isValid: true,
        detectedDocType: 'PASSPORT',
        isQualityAcceptable: true,
        passportNumber: 'A12345678',
        fullName: 'John Doe Smith',
        birthDate: new Date('1990-01-01'),
        gender: 'MALE',
        confidenceScore: 0.93,
      });

      const mockCtx = {
        from: { id: 112212 },
        chat: { id: 301 },
        effectiveRole: 'FIELD_ADMIN',
        deleteMessage: vi.fn().mockResolvedValue(true),
        api: {
          editMessageText: vi.fn().mockResolvedValue(true),
        },
      } as unknown as WorkforceModuleContext;

      // Act
      await handler.handlePhotoInput(mockCtx, 'tg-file-pass-123');

      // Assert
      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_CONFIRMATION);
      expect(draft?.idNumber).toBe('A12345678');
      expect(draft?.aiDetectedData?.passportNumber).toBe('A12345678');
    });

    it('rejects blurry or invalid identity photo and renders error without advancing step', async () => {
      // Arrange
      const repo = new WorkerRegistrationRepository({} as PrismaClient);
      const service = new WorkerRegistrationService(repo);
      const handler = new WorkerRegistrationHandler(service, repo);

      const telegramId = BigInt(112213);
      await service.pushStep(telegramId, WorkerWizardStep.PHOTO_FRONT, {
        idType: 'NATIONAL_ID',
        activeMessageId: 202,
        chatId: 302,
      });

      vi.spyOn(service, 'downloadTelegramPhotoBuffer').mockResolvedValue(Buffer.from('fake-blurry-photo'));
      vi.spyOn(service, 'scanIdentityPhoto').mockResolvedValue({
        isValid: false,
        detectedDocType: 'OTHER',
        isQualityAcceptable: false,
        userErrorMessage: '⚠️ الصورة غير واضحة أو مشوشة، يرجى إعادة التصوير بإضاءة جيدة.',
        confidenceScore: 0.2,
      });

      let renderedErrorMessage = '';
      const mockCtx = {
        from: { id: 112213 },
        chat: { id: 302 },
        effectiveRole: 'FIELD_ADMIN',
        deleteMessage: vi.fn().mockResolvedValue(true),
        api: {
          editMessageText: vi.fn().mockImplementation((_c: number, _m: number, text: string) => {
            renderedErrorMessage = text;
            return Promise.resolve(true);
          }),
        },
      } as unknown as WorkforceModuleContext;

      // Act
      await handler.handlePhotoInput(mockCtx, 'tg-file-blurry-123');

      // Assert
      expect(renderedErrorMessage).toContain('الصورة غير واضحة');

      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.PHOTO_FRONT);
      expect(draft?.frontPhotoFileId).toBeUndefined();
    });

    it('advances to FULL_NAME when user clicks skip photo on PHOTO_FRONT', async () => {
      // Arrange
      const repo = new WorkerRegistrationRepository({} as PrismaClient);
      const service = new WorkerRegistrationService(repo);
      const handler = new WorkerRegistrationHandler(service, repo);

      const telegramId = BigInt(112214);
      await service.pushStep(telegramId, WorkerWizardStep.PHOTO_FRONT, {
        idType: 'NATIONAL_ID',
        activeMessageId: 203,
        chatId: 303,
      });

      const mockCtx = {
        from: { id: 112214 },
        chat: { id: 303 },
        effectiveRole: 'FIELD_ADMIN',
        callbackQuery: { id: 'cb-skip-1' },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        editMessageText: vi.fn().mockResolvedValue(true),
      } as unknown as WorkforceModuleContext;

      // Act
      await handler.handleSkipPhoto(mockCtx);

      // Assert
      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.FULL_NAME);
    });

    it('advances to AI_CONFIRMATION when user clicks skip photo on PHOTO_BACK after front was scanned', async () => {
      // Arrange
      const repo = new WorkerRegistrationRepository({} as PrismaClient);
      const service = new WorkerRegistrationService(repo);
      const handler = new WorkerRegistrationHandler(service, repo);

      const telegramId = BigInt(112215);
      await service.pushStep(telegramId, WorkerWizardStep.PHOTO_BACK, {
        idType: 'NATIONAL_ID',
        frontPhotoFileId: 'front-photo-already-uploaded',
        activeMessageId: 204,
        chatId: 304,
      });

      const mockCtx = {
        from: { id: 112215 },
        chat: { id: 304 },
        effectiveRole: 'FIELD_ADMIN',
        callbackQuery: { id: 'cb-skip-2' },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        editMessageText: vi.fn().mockResolvedValue(true),
      } as unknown as WorkforceModuleContext;

      // Act
      await handler.handleSkipPhoto(mockCtx);

      // Assert
      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_CONFIRMATION);
    });

    it('approves AI draft and advances to PHONE step', async () => {
      // Arrange
      const mockPrisma = {
        worker: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as unknown as PrismaClient;
      const repo = new WorkerRegistrationRepository(mockPrisma);
      const service = new WorkerRegistrationService(repo);
      const handler = new WorkerRegistrationHandler(service, repo);

      const telegramId = BigInt(112216);
      await service.pushStep(telegramId, WorkerWizardStep.AI_CONFIRMATION, {
        idType: 'NATIONAL_ID',
        name: 'كريم محمود الدسوقي',
        idNumber: '29001012701234',
        aiDetectedData: {
          name: 'كريم محمود الدسوقي',
          nationalId: '29001012701234',
          birthDate: '1990-01-01',
          age: 36,
          gender: 'MALE',
          governorateCode: '27',
          governorateName: 'الأقصر',
          address: 'الأقصر - البياضية',
          expiryDate: '2029-05-01',
        },
        activeMessageId: 205,
        chatId: 305,
      });

      const mockCtx = {
        from: { id: 112216 },
        chat: { id: 305 },
        effectiveRole: 'FIELD_ADMIN',
        callbackQuery: { id: 'cb-approve' },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        editMessageText: vi.fn().mockResolvedValue(true),
      } as unknown as WorkforceModuleContext;

      // Act
      await handler.handleAiApprove(mockCtx);

      // Assert
      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.PHONE);
      expect(draft?.name).toBe('كريم محمود الدسوقي');
      expect(draft?.idNumber).toBe('29001012701234');
      expect(draft?.governorateCode).toBe('27');
    });

    it('blocks AI approval if duplicate national ID exists and renders warning', async () => {
      // Arrange
      const mockPrisma = {
        worker: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'existing-worker-id',
            code: 'OP-HLP-099',
            name: 'كريم القديم',
          }),
        },
      } as unknown as PrismaClient;
      const repo = new WorkerRegistrationRepository(mockPrisma);
      const service = new WorkerRegistrationService(repo);
      const handler = new WorkerRegistrationHandler(service, repo);

      const telegramId = BigInt(112217);
      await service.pushStep(telegramId, WorkerWizardStep.AI_CONFIRMATION, {
        idType: 'NATIONAL_ID',
        name: 'كريم الجديد',
        idNumber: '29001012701234',
        aiDetectedData: {
          name: 'كريم الجديد',
          nationalId: '29001012701234',
        },
        activeMessageId: 206,
        chatId: 306,
      });

      let renderedWarning = '';
      const mockCtx = {
        from: { id: 112217 },
        chat: { id: 306 },
        effectiveRole: 'FIELD_ADMIN',
        callbackQuery: { id: 'cb-approve-dup' },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        api: {
          editMessageText: vi.fn().mockImplementation((_c: number, _m: number, text: string) => {
            renderedWarning = text;
            return Promise.resolve(true);
          }),
        },
      } as unknown as WorkforceModuleContext;

      // Act
      await handler.handleAiApprove(mockCtx);

      // Assert
      expect(renderedWarning).toContain('العامل مسجل مسبقاً باسم');
      expect(renderedWarning).toContain('OP-HLP-099');

      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_CONFIRMATION);
    });

    it('supports inline editing of name, ID, address, and expiry from AI_CONFIRMATION', async () => {
      // Arrange
      const mockPrisma = {
        worker: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as unknown as PrismaClient;
      const repo = new WorkerRegistrationRepository(mockPrisma);
      const service = new WorkerRegistrationService(repo);
      const handler = new WorkerRegistrationHandler(service, repo);

      const telegramId = BigInt(112218);
      await service.pushStep(telegramId, WorkerWizardStep.AI_CONFIRMATION, {
        idType: 'NATIONAL_ID',
        name: 'اسم أولي غير دقيق',
        idNumber: '29001012701234',
        aiDetectedData: {
          name: 'اسم أولي غير دقيق',
          nationalId: '29001012701234',
        },
        activeMessageId: 207,
        chatId: 307,
      });

      const mockCtx = {
        from: { id: 112218 },
        chat: { id: 307 },
        effectiveRole: 'FIELD_ADMIN',
        callbackQuery: { id: 'cb-edit' },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        deleteMessage: vi.fn().mockResolvedValue(true),
        api: {
          editMessageText: vi.fn().mockResolvedValue(true),
        },
        editMessageText: vi.fn().mockResolvedValue(true),
      } as unknown as WorkforceModuleContext;

      // Act
      await handler.handleAiEdit(mockCtx, 'name');
      await handler.handleTextInput(mockCtx, 'محمود صبحي جاد');
      await handler.handleAiEdit(mockCtx, 'id');
      await handler.handleTextInput(mockCtx, '29508101234567');
      await handler.handleAiEdit(mockCtx, 'address');
      await handler.handleTextInput(mockCtx, 'القاهرة - المعادي شارع النصر');
      await handler.handleAiEdit(mockCtx, 'expiry');
      await handler.handleTextInput(mockCtx, '2030-05-15');

      // Assert
      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_CONFIRMATION);
      expect(draft?.name).toBe('محمود صبحي جاد');
      expect(draft?.aiDetectedData?.name).toBe('محمود صبحي جاد');
      expect(draft?.idNumber).toBe('29508101234567');
      expect(draft?.aiDetectedData?.nationalId).toBe('29508101234567');
      expect(draft?.address).toBe('القاهرة - المعادي شارع النصر');
      expect(draft?.expiryDate).toBe('15-05-2030');
    });

    it('renders error and stays on PHOTO_FRONT when photo buffer download fails', async () => {
      // Arrange
      const repo = new WorkerRegistrationRepository({} as PrismaClient);
      const service = new WorkerRegistrationService(repo);
      const handler = new WorkerRegistrationHandler(service, repo);

      const telegramId = BigInt(112219);
      await service.pushStep(telegramId, WorkerWizardStep.PHOTO_FRONT, {
        idType: 'NATIONAL_ID',
        activeMessageId: 208,
        chatId: 308,
      });

      vi.spyOn(service, 'downloadTelegramPhotoBuffer').mockResolvedValue(null);

      let renderedError = '';
      const mockCtx = {
        from: { id: 112219 },
        chat: { id: 308 },
        effectiveRole: 'FIELD_ADMIN',
        deleteMessage: vi.fn().mockResolvedValue(true),
        api: {
          editMessageText: vi.fn().mockImplementation((_c: number, _m: number, text: string) => {
            renderedError = text;
            return Promise.resolve(true);
          }),
        },
      } as unknown as WorkforceModuleContext;

      // Act
      await handler.handlePhotoInput(mockCtx, 'tg-file-fail-123');

      // Assert
      expect(renderedError).toContain('تعذر تنزيل الصورة من تليجرام');

      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.PHOTO_FRONT);
      expect(draft?.frontPhotoFileId).toBeUndefined();
    });

    it('rejects duplicate ID immediately during AI_EDIT_ID inline editing', async () => {
      // Arrange
      const mockPrisma = {
        worker: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'existing-dup-id',
            code: 'OP-DRV-007',
            name: 'محمود القديم',
          }),
        },
      } as unknown as PrismaClient;
      const repo = new WorkerRegistrationRepository(mockPrisma);
      const service = new WorkerRegistrationService(repo);
      const handler = new WorkerRegistrationHandler(service, repo);

      const telegramId = BigInt(112220);
      await service.pushStep(telegramId, WorkerWizardStep.AI_EDIT_ID, {
        idType: 'NATIONAL_ID',
        name: 'محمود الجديد',
        activeMessageId: 209,
        chatId: 309,
      });

      let renderedDupMsg = '';
      const mockCtx = {
        from: { id: 112220 },
        chat: { id: 309 },
        effectiveRole: 'FIELD_ADMIN',
        deleteMessage: vi.fn().mockResolvedValue(true),
        api: {
          editMessageText: vi.fn().mockImplementation((_c: number, _m: number, text: string) => {
            renderedDupMsg = text;
            return Promise.resolve(true);
          }),
        },
      } as unknown as WorkforceModuleContext;

      // Act
      await handler.handleTextInput(mockCtx, '29001012701234');

      // Assert
      expect(renderedDupMsg).toContain('العامل مسجل مسبقاً باسم');
      expect(renderedDupMsg).toContain('OP-DRV-007');

      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_EDIT_ID);
    });

    it('rejects AI approval if ID number is missing from draft', async () => {
      // Arrange
      const repo = new WorkerRegistrationRepository({} as PrismaClient);
      const service = new WorkerRegistrationService(repo);
      const handler = new WorkerRegistrationHandler(service, repo);

      const telegramId = BigInt(112221);
      await service.pushStep(telegramId, WorkerWizardStep.AI_CONFIRMATION, {
        idType: 'NATIONAL_ID',
        name: 'عامل بدون رقم',
        activeMessageId: 210,
        chatId: 310,
      });

      let renderedMissingMsg = '';
      const mockCtx = {
        from: { id: 112221 },
        chat: { id: 310 },
        effectiveRole: 'FIELD_ADMIN',
        callbackQuery: { id: 'cb-approve-missing' },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        api: {
          editMessageText: vi.fn().mockImplementation((_c: number, _m: number, text: string) => {
            renderedMissingMsg = text;
            return Promise.resolve(true);
          }),
        },
      } as unknown as WorkforceModuleContext;

      // Act
      await handler.handleAiApprove(mockCtx);

      // Assert
      expect(renderedMissingMsg).toContain('بيانات الهوية غير مكتملة');

      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_CONFIRMATION);
    });

    it('immediately displays aiProcessingPrompt and triggers typing action on photo input', async () => {
      // Arrange
      const repo = new WorkerRegistrationRepository({} as PrismaClient);
      const service = new WorkerRegistrationService(repo);
      const handler = new WorkerRegistrationHandler(service, repo);

      const telegramId = BigInt(112222);
      await service.pushStep(telegramId, WorkerWizardStep.PHOTO_FRONT, {
        idType: 'NATIONAL_ID',
        activeMessageId: 211,
        chatId: 311,
      });

      vi.spyOn(service, 'downloadTelegramPhotoBuffer').mockResolvedValue(Buffer.from('fake-photo'));
      vi.spyOn(service, 'scanIdentityPhoto').mockResolvedValue({
        isValid: true,
        detectedDocType: 'EGYPTIAN_NATIONAL_ID_FRONT',
        isQualityAcceptable: true,
        nationalIdNumber: '29001012701234',
        fullName: 'أحمد محمود علي',
        confidenceScore: 0.95,
      });

      const renderedPrompts: string[] = [];
      let chatActionSent = '';

      const mockCtx = {
        from: { id: 112222 },
        chat: { id: 311 },
        effectiveRole: 'FIELD_ADMIN',
        deleteMessage: vi.fn().mockResolvedValue(true),
        replyWithChatAction: vi.fn().mockImplementation((action: string) => {
          chatActionSent = action;
          return Promise.resolve(true);
        }),
        api: {
          editMessageText: vi.fn().mockImplementation((_c: number, _m: number, text: string) => {
            renderedPrompts.push(text);
            return Promise.resolve(true);
          }),
        },
      } as unknown as WorkforceModuleContext;

      // Act
      await handler.handlePhotoInput(mockCtx, 'tg-photo-feedback-123');

      // Assert
      expect(renderedPrompts.length).toBeGreaterThanOrEqual(2);
      expect(renderedPrompts[0]).toContain('قراءة وفحص البطاقة بالذكاء الاصطناعي');
      expect(renderedPrompts[0]).toContain('جارٍ تنزيل الصورة وتحليل البيانات الرسمية بالذكاء الاصطناعي');
      expect(chatActionSent).toBe('typing');
    });

    it('normalizes Arabic/Eastern digits to English ASCII in all numeric text input steps', async () => {
      // Arrange
      const mockPrisma = {
        worker: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as unknown as PrismaClient;
      const repo = new WorkerRegistrationRepository(mockPrisma);
      const service = new WorkerRegistrationService(repo);
      const handler = new WorkerRegistrationHandler(service, repo);

      const telegramId = BigInt(112223);

      const mockCtx = {
        from: { id: 112223 },
        chat: { id: 312 },
        effectiveRole: 'FIELD_ADMIN',
        deleteMessage: vi.fn().mockResolvedValue(true),
        api: {
          editMessageText: vi.fn().mockResolvedValue(true),
        },
      } as unknown as WorkforceModuleContext;

      await service.pushStep(telegramId, WorkerWizardStep.ID_NUMBER, {
        idType: 'NATIONAL_ID',
        activeMessageId: 212,
        chatId: 312,
      });

      // Act
      await handler.handleTextInput(mockCtx, '٢٩٠٠١٠١٢٧٠١٢٣٤');
      const draftId = await service.getDraft(telegramId);

      await handler.handleTextInput(mockCtx, '٠١٠١٢٣٤٥٦٧٨');
      const draftPhone = await service.getDraft(telegramId);

      await service.pushStep(telegramId, WorkerWizardStep.CUSTOM_WALLET_INPUT, {
        activeMessageId: 212,
        chatId: 312,
      });
      await handler.handleTextInput(mockCtx, '٠١٠٩٩٨٨٧٧٦٦');
      const draftWallet = await service.getDraft(telegramId);

      await service.pushStep(telegramId, WorkerWizardStep.CUSTOM_START_DATE_INPUT, {
        activeMessageId: 212,
        chatId: 312,
      });
      await handler.handleTextInput(mockCtx, '٢٠٢٦-٠٩-٠١');
      const draftStartDate = await service.getDraft(telegramId);

      await service.pushStep(telegramId, WorkerWizardStep.EMERGENCY_PHONE, {
        activeMessageId: 212,
        chatId: 312,
      });
      await handler.handleTextInput(mockCtx, '٠١١٢٢٣٣٤٤٥٥');
      const draftEmergency = await service.getDraft(telegramId);

      await service.pushStep(telegramId, WorkerWizardStep.AI_EDIT_ID, {
        idType: 'NATIONAL_ID',
        activeMessageId: 212,
        chatId: 312,
      });
      await handler.handleTextInput(mockCtx, '٢٩٥٠٨١٠١٢٣٤٥٦٧');
      const draftAiId = await service.getDraft(telegramId);

      await service.pushStep(telegramId, WorkerWizardStep.AI_EDIT_EXPIRY, {
        activeMessageId: 212,
        chatId: 312,
      });
      await handler.handleTextInput(mockCtx, '٢٠٣٠-٠٥-١٥');
      const draftAiExp = await service.getDraft(telegramId);

      // Assert
      expect(draftId?.currentStep).toBe(WorkerWizardStep.PHONE);
      expect(draftId?.idNumber).toBe('29001012701234');

      expect(draftPhone?.currentStep).toBe(WorkerWizardStep.PAYOUT_TRANSFER_CHOICE);
      expect(draftPhone?.phone).toBe('01012345678');

      expect(draftWallet?.currentStep).toBe(WorkerWizardStep.PAYOUT_METHOD_CHOICE);
      expect(draftWallet?.accountNumber).toBe('01099887766');

      expect(draftStartDate?.currentStep).toBe(WorkerWizardStep.DRIVING_LICENSE);
      expect(draftStartDate?.hireDate).toBe('2026-09-01');

      expect(draftEmergency?.currentStep).toBe(WorkerWizardStep.INSURANCE_STATUS);
      expect(draftEmergency?.emergencyPhone).toBe('01122334455');

      expect(draftAiId?.currentStep).toBe(WorkerWizardStep.AI_CONFIRMATION);
      expect(draftAiId?.idNumber).toBe('29508101234567');
      expect(draftAiId?.aiDetectedData?.nationalId).toBe('29508101234567');

      expect(draftAiExp?.currentStep).toBe(WorkerWizardStep.AI_CONFIRMATION);
      expect(draftAiExp?.expiryDate).toBe('15-05-2030');
      expect(draftAiExp?.aiDetectedData?.expiryDate).toBe('15-05-2030');
    });

    it('updates age and governorate when editing National ID to underage worker and includes legal notice', async () => {
      // Arrange
      const mockPrisma = {
        worker: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as unknown as PrismaClient;
      const repo = new WorkerRegistrationRepository(mockPrisma);
      const service = new WorkerRegistrationService(repo);
      const handler = new WorkerRegistrationHandler(service, repo);

      const telegramId = BigInt(112224);
      await service.pushStep(telegramId, WorkerWizardStep.AI_EDIT_ID, {
        idType: 'NATIONAL_ID',
        name: 'حسن صابر إبراهيم',
        idNumber: '29001012701234',
        activeMessageId: 214,
        chatId: 314,
        aiDetectedData: {
          name: 'حسن صابر إبراهيم',
          nationalId: '29001012701234',
          birthDate: '1990-01-01',
          age: 36,
          governorateCode: '27',
          governorateName: 'الأقصر',
        },
      });

      const mockCtx = {
        from: { id: 112224 },
        chat: { id: 314 },
        effectiveRole: 'FIELD_ADMIN',
        deleteMessage: vi.fn().mockResolvedValue(true),
        api: {
          editMessageText: vi.fn().mockResolvedValue(true),
        },
      } as unknown as WorkforceModuleContext;

      // Act
      await handler.handleTextInput(mockCtx, '٣١٠٠١٠١٠١٠١٢٣٤');

      // Assert
      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_CONFIRMATION);
      expect(draft?.idNumber).toBe('31001010101234');
      expect(draft?.aiDetectedData?.nationalId).toBe('31001010101234');
      expect(draft?.aiDetectedData?.age).toBe(16);
      expect(draft?.aiDetectedData?.governorateCode).toBe('01');
      expect(draft?.aiDetectedData?.governorateName).toBe('القاهرة');

      const { WorkerRegistrationMessages } = await import('../flow.messages.js');
      const card = WorkerRegistrationMessages.aiConfirmationCard(draft!);
      expect(card).toContain('تنبيه قانوني');
      expect(card).toContain('العامل أصغر من سن العمل القانوني (أقل من 18 سنة)');
      expect(card).toContain('(16 سنة)');
      expect(card).toContain('القاهرة');
    });

    it('handles confirm registration successfully with flexible DD-MM-YYYY dates', async () => {
      // Arrange
      const createdRecord: Record<string, unknown> = {};
      const mockPrisma = {
        worker: {
          findFirst: vi.fn().mockResolvedValue(null),
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            Object.assign(createdRecord, data);
            return Promise.resolve({
              id: 'w-new-1',
              code: 'OP-DRV-001',
              name: 'طارق عبد السلام',
              jobTitle: 'سائق معدات',
              hireDate: data.hireDate,
              shiftSystem: data.shiftSystem,
            });
          }),
        },
        jobTitle: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'job-1',
            code: 'DRV',
            name: 'سائق معدات',
            department: { code: 'OP' },
          }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: 'aud-1' }),
        },
        $transaction: vi.fn().mockImplementation((fn: (p: unknown) => Promise<unknown>) => fn(mockPrisma)),
      } as unknown as PrismaClient;

      const repo = new WorkerRegistrationRepository(mockPrisma);
      const service = new WorkerRegistrationService(repo);
      const handler = new WorkerRegistrationHandler(service, repo);

      const telegramId = BigInt(112225);
      await service.pushStep(telegramId, WorkerWizardStep.CONFIRMATION, {
        idType: 'NATIONAL_ID',
        name: 'طارق عبد السلام محمد',
        nickname: 'طارق عبد السلام',
        idNumber: '29001012701234',
        phone: '01012345678',
        birthDate: '15-05-1990',
        hireDate: '01-09-2026',
        shiftSystem: '20 يوم عمل / 10 راحة',
        basicSalary: 8000,
        additionalSalary: 2000,
        paymentMethod: 'CASH_SITE',
        jobTitleId: 'job-1',
        jobTitleName: 'سائق معدات',
        activeMessageId: 215,
        chatId: 315,
      });

      let completionText = '';
      const mockCtx = {
        from: { id: 112225 },
        chat: { id: 315 },
        effectiveRole: 'FIELD_ADMIN',
        callbackQuery: { id: 'cb-confirm-dmy' },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        api: {
          editMessageText: vi.fn().mockImplementation((_c: number, _m: number, text: string) => {
            completionText = text;
            return Promise.resolve(true);
          }),
        },
      } as unknown as WorkforceModuleContext;

      // Act
      await handler.handleConfirm(mockCtx);

      // Assert
      expect(completionText).toContain('تم تسجيل وتعيين العامل بنجاح');
      expect(createdRecord.birthDate).toBeInstanceOf(Date);
      expect(isNaN((createdRecord.birthDate as Date).getTime())).toBe(false);
      expect(createdRecord.hireDate).toBeInstanceOf(Date);
      expect(isNaN((createdRecord.hireDate as Date).getTime())).toBe(false);
    });
  });

  describe('Cancellation Lifecycle & Reply Keyboard Interception Immunity (Plan 54)', () => {
    it('cleanly cancels active wizard, answers callback query, clears draft, and renders cancelExitKeyboard', async () => {
      // Arrange
      const repo = new WorkerRegistrationRepository({} as PrismaClient);
      const service = new WorkerRegistrationService(repo);
      const handler = new WorkerRegistrationHandler(service, repo);

      const telegramId = BigInt(998877);
      await service.pushStep(telegramId, WorkerWizardStep.ID_NUMBER, {
        name: 'أحمد محمود إسماعيل',
        activeMessageId: 501,
        chatId: 601,
      });

      let promptRendered = '';
      let replyMarkupAttached: { inline_keyboard: { text: string }[][] } | undefined;

      const mockCtx = {
        from: { id: 998877 },
        chat: { id: 601 },
        effectiveRole: 'SUPER_ADMIN',
        callbackQuery: { id: 'cb-cancel-test' },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        api: {
          editMessageText: vi.fn().mockImplementation((_c: number, _m: number, text: string, options?: { reply_markup?: { inline_keyboard: { text: string }[][] } }) => {
            promptRendered = text;
            replyMarkupAttached = options?.reply_markup;
            return Promise.resolve(true);
          }),
        },
      } as unknown as WorkforceModuleContext;

      // Act
      await handler.handleCancel(mockCtx);

      // Assert
      expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
      const remainingDraft = await service.getDraft(telegramId);
      expect(remainingDraft).toBeNull();
      expect(promptRendered).toContain('تم إلغاء');
      expect(replyMarkupAttached).toBeDefined();

      const buttons = replyMarkupAttached?.inline_keyboard.flat() || [];
      const buttonTexts = buttons.map((b) => b.text);
      expect(buttonTexts.some((t: string) => t.includes('تسجيل عامل'))).toBe(true);
      expect(buttonTexts.some((t: string) => t.includes('شؤون العاملين'))).toBe(true);
      expect(buttonTexts.some((t: string) => t.includes('القائمة الرئيسية'))).toBe(true);
    });

    it('stores and clears wizard state via RedisWorkerWizardStateStore with 1800s TTL', async () => {
      // Arrange
      const redisStore = new Map<string, string>();
      const mockRedis = {
        get: vi.fn().mockImplementation(async (k: string) => redisStore.get(k) || null),
        set: vi.fn().mockImplementation(async (k: string, v: string, mode?: string, ttl?: number) => {
          expect(mode).toBe('EX');
          expect(ttl).toBe(1800);
          redisStore.set(k, v);
          return 'OK';
        }),
        del: vi.fn().mockImplementation(async (k: string) => {
          redisStore.delete(k);
          return 1;
        }),
      };

      const stateStore = new RedisWorkerWizardStateStore(mockRedis);
      const telegramId = BigInt(443322);

      // Act
      await stateStore.set(telegramId, {
        currentStep: WorkerWizardStep.DOC_TYPE,
        name: 'حسام حسن علي',
      });

      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith(
        'pending:worker_wizard:user:443322',
        expect.stringContaining('حسام حسن علي'),
        'EX',
        1800
      );

      // Act
      const retrieved = await stateStore.get(telegramId);

      // Assert
      expect(retrieved?.name).toBe('حسام حسن علي');
      expect(retrieved?.currentStep).toBe(WorkerWizardStep.DOC_TYPE);

      // Act
      await stateStore.delete(telegramId);

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith('pending:worker_wizard:user:443322');
      const afterDelete = await stateStore.get(telegramId);
      expect(afterDelete).toBeNull();
    });

    it('gracefully falls back to in-memory state store if Redis throws an error', async () => {
      // Arrange
      const mockFailingRedis = {
        get: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        set: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        del: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      };

      const stateStore = new RedisWorkerWizardStateStore(mockFailingRedis);
      const telegramId = BigInt(887766);

      // Act
      await stateStore.set(telegramId, {
        currentStep: WorkerWizardStep.FULL_NAME,
        name: 'عماد متعب',
      });

      const retrieved = await stateStore.get(telegramId);
      await stateStore.delete(telegramId);
      const afterDelete = await stateStore.get(telegramId);

      // Assert
      expect(retrieved?.name).toBe('عماد متعب');
      expect(afterDelete).toBeNull();
    });

    it('ensures text input is NOT intercepted as National ID after wizard is cancelled', async () => {
      // Arrange
      const repo = new WorkerRegistrationRepository({} as PrismaClient);
      const service = new WorkerRegistrationService(repo);
      const handler = new WorkerRegistrationHandler(service, repo);

      const telegramId = BigInt(112233);
      await service.pushStep(telegramId, WorkerWizardStep.ID_NUMBER, {
        name: 'محمود الخطيب',
        activeMessageId: 701,
        chatId: 801,
      });

      // User cancels
      await service.clearDraft(telegramId);

      let editCalled = false;
      const mockCtx = {
        from: { id: 112233 },
        chat: { id: 801 },
        api: {
          editMessageText: vi.fn().mockImplementation(() => {
            editCalled = true;
            return Promise.resolve(true);
          }),
        },
      } as unknown as WorkforceModuleContext;

      // Act
      const draft = await service.getDraft(telegramId);
      await handler.handleTextInput(mockCtx, '🖥️ فتح لوحة التحكم');

      // Assert
      expect(draft).toBeNull();
      expect(editCalled).toBe(false);
    });
  });
});
