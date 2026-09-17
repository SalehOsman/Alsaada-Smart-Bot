import { describe, it, expect, vi } from 'vitest';
import { WorkerRegistrationHandler } from '../flow.handler.js';
import { WorkerRegistrationService, RedisWorkerWizardStateStore } from '../flow.service.js';
import { WorkerRegistrationRepository } from '../flow.repository.js';
import { WorkerWizardStep } from '../flow.types.js';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.1 UX Tests — Single Message Lifecycle & Navigation', () => {
  it('should update messages in place via editMessageText on wizard step transitions', async () => {
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

    await handler.handleDocType(mockCtx, 'NATIONAL_ID');

    expect(editMessageCalled).toBe(true);
    expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
  });

  it('should preserve previous step data when navigating backwards via handleBack', async () => {
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

    await handler.handleBack(mockCtx);

    const draft = await service.getDraft(telegramId);
    expect(draft?.currentStep).toBe(WorkerWizardStep.DOC_TYPE);
    expect(draft?.name).toBe('عمر خالد');
    expect(backEdited).toBe(true);
  });

  it('should edit message in place via ctx.api.editMessageText when receiving text input with activeMessageId', async () => {
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

    await handler.handleTextInput(mockCtx, 'محمد حسني مبارك علي');

    expect(deletedUserMessage).toBe(true);
    expect(apiEditCalled).toBe(true);
    expect(mockCtx.reply).not.toHaveBeenCalled();

    const draft = await service.getDraft(telegramId);
    expect(draft?.currentStep).toBe(WorkerWizardStep.NICKNAME);
    expect(draft?.name).toBe('محمد حسني مبارك علي');
  });

  it('should strictly reject "تخطي" or "-" or short text in CUSTOM_WALLET_INPUT to enforce mandatory payment info', async () => {
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

    // Attempt to bypass with "تخطي"
    await handler.handleTextInput(mockCtx, 'تخطي');
    expect(renderedError).toBe(true);

    // State should NOT have advanced to JOB_CHOICE or CASH_SITE
    let draft = await service.getDraft(telegramId);
    expect(draft?.currentStep).toBe(WorkerWizardStep.CUSTOM_WALLET_INPUT);
    expect(draft?.paymentMethod).toBeUndefined();

    // Attempt to enter a valid wallet number
    renderedError = false;
    await handler.handleTextInput(mockCtx, '01099887766');

    draft = await service.getDraft(telegramId);
    expect(draft?.currentStep).toBe(WorkerWizardStep.PAYOUT_METHOD_CHOICE);
    expect(draft?.accountNumber).toBe('01099887766');
  });

  describe('AI Vision Dual-Path Onboarding UX', () => {
    it('should process front photo, scan with AI, and advance to PHOTO_BACK for NATIONAL_ID', async () => {
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

      await handler.handlePhotoInput(mockCtx, 'tg-file-front-123');

      expect(deletedUserMsg).toBe(true);
      expect(editedMessage).toBe(true);

      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.PHOTO_BACK);
      expect(draft?.frontPhotoFileId).toBe('tg-file-front-123');
      expect(draft?.name).toBe('أحمد محمود إبراهيم خليل');
      expect(draft?.idNumber).toBe('29205151234567');
      expect(draft?.aiDetectedData?.nationalId).toBe('29205151234567');
    });

    it('should process passport photo, scan with AI, and advance directly to AI_CONFIRMATION', async () => {
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

      await handler.handlePhotoInput(mockCtx, 'tg-file-pass-123');

      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_CONFIRMATION);
      expect(draft?.idNumber).toBe('A12345678');
      expect(draft?.aiDetectedData?.passportNumber).toBe('A12345678');
    });

    it('should reject blurry or invalid identity photo and render error without advancing step', async () => {
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

      await handler.handlePhotoInput(mockCtx, 'tg-file-blurry-123');

      expect(renderedErrorMessage).toContain('الصورة غير واضحة');

      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.PHOTO_FRONT);
      expect(draft?.frontPhotoFileId).toBeUndefined();
    });

    it('should advance to FULL_NAME when user clicks skip photo on PHOTO_FRONT', async () => {
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

      await handler.handleSkipPhoto(mockCtx);

      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.FULL_NAME);
    });

    it('should advance to AI_CONFIRMATION when user clicks skip photo on PHOTO_BACK after front was scanned', async () => {
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

      await handler.handleSkipPhoto(mockCtx);

      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_CONFIRMATION);
    });

    it('should approve AI draft and advance to PHONE step', async () => {
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

      await handler.handleAiApprove(mockCtx);

      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.PHONE);
      expect(draft?.name).toBe('كريم محمود الدسوقي');
      expect(draft?.idNumber).toBe('29001012701234');
      expect(draft?.governorateCode).toBe('27');
    });

    it('should block AI approval if duplicate national ID exists and render warning', async () => {
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

      await handler.handleAiApprove(mockCtx);

      expect(renderedWarning).toContain('العامل مسجل مسبقاً باسم');
      expect(renderedWarning).toContain('OP-HLP-099');

      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_CONFIRMATION);
    });

    it('should support inline editing of name, ID, address, and expiry from AI_CONFIRMATION', async () => {
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

      // 1. Edit Name
      await handler.handleAiEdit(mockCtx, 'name');
      let draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_EDIT_NAME);

      await handler.handleTextInput(mockCtx, 'محمود صبحي جاد');
      draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_CONFIRMATION);
      expect(draft?.name).toBe('محمود صبحي جاد');
      expect(draft?.aiDetectedData?.name).toBe('محمود صبحي جاد');

      // 2. Edit ID
      await handler.handleAiEdit(mockCtx, 'id');
      draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_EDIT_ID);

      await handler.handleTextInput(mockCtx, '29508101234567');
      draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_CONFIRMATION);
      expect(draft?.idNumber).toBe('29508101234567');
      expect(draft?.aiDetectedData?.nationalId).toBe('29508101234567');

      // 3. Edit Address
      await handler.handleAiEdit(mockCtx, 'address');
      draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_EDIT_ADDRESS);

      await handler.handleTextInput(mockCtx, 'القاهرة - المعادي شارع النصر');
      draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_CONFIRMATION);
      expect(draft?.address).toBe('القاهرة - المعادي شارع النصر');

      // 4. Edit Expiry
      await handler.handleAiEdit(mockCtx, 'expiry');
      draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_EDIT_EXPIRY);

      await handler.handleTextInput(mockCtx, '2030-05-15');
      draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_CONFIRMATION);
      expect(draft?.expiryDate).toBe('15-05-2030');
    });

    it('should render error and stay on PHOTO_FRONT when photo buffer download fails', async () => {
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

      await handler.handlePhotoInput(mockCtx, 'tg-file-fail-123');

      expect(renderedError).toContain('تعذر تنزيل الصورة من تليجرام');

      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.PHOTO_FRONT);
      expect(draft?.frontPhotoFileId).toBeUndefined();
    });

    it('should reject duplicate ID immediately during AI_EDIT_ID inline editing', async () => {
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

      await handler.handleTextInput(mockCtx, '29001012701234');

      expect(renderedDupMsg).toContain('العامل مسجل مسبقاً باسم');
      expect(renderedDupMsg).toContain('OP-DRV-007');

      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_EDIT_ID);
    });

    it('should reject AI approval if ID number is missing from draft', async () => {
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

      await handler.handleAiApprove(mockCtx);

      expect(renderedMissingMsg).toContain('بيانات الهوية غير مكتملة');

      const draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_CONFIRMATION);
    });

    it('should immediately display aiProcessingPrompt and trigger typing action on photo input', async () => {
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

      await handler.handlePhotoInput(mockCtx, 'tg-photo-feedback-123');

      // The first call should be the AI processing screen
      expect(renderedPrompts.length).toBeGreaterThanOrEqual(2);
      expect(renderedPrompts[0]).toContain('قراءة وفحص البطاقة بالذكاء الاصطناعي');
      expect(renderedPrompts[0]).toContain('جارٍ تنزيل الصورة وتحليل البيانات الرسمية بالذكاء الاصطناعي');
      expect(chatActionSent).toBe('typing');
    });

    it('should normalize Arabic/Eastern digits to English ASCII in all numeric text input steps', async () => {
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

      // 1. ID_NUMBER with Arabic digits: ٢٩٠٠١٠١٢٧٠١٢٣٤
      await service.pushStep(telegramId, WorkerWizardStep.ID_NUMBER, {
        idType: 'NATIONAL_ID',
        activeMessageId: 212,
        chatId: 312,
      });
      await handler.handleTextInput(mockCtx, '٢٩٠٠١٠١٢٧٠١٢٣٤');
      let draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.PHONE);
      expect(draft?.idNumber).toBe('29001012701234');

      // 2. PHONE with Arabic digits: ٠١٠١٢٣٤٥٦٧٨
      await handler.handleTextInput(mockCtx, '٠١٠١٢٣٤٥٦٧٨');
      draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.PAYOUT_TRANSFER_CHOICE);
      expect(draft?.phone).toBe('01012345678');

      // 3. CUSTOM_WALLET_INPUT with Arabic digits: ٠١٠٩٩٨٨٧٧٦٦
      await service.pushStep(telegramId, WorkerWizardStep.CUSTOM_WALLET_INPUT, {
        activeMessageId: 212,
        chatId: 312,
      });
      await handler.handleTextInput(mockCtx, '٠١٠٩٩٨٨٧٧٦٦');
      draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.PAYOUT_METHOD_CHOICE);
      expect(draft?.accountNumber).toBe('01099887766');

      // 4. CUSTOM_START_DATE_INPUT with Arabic digits: ٢٠٢٦-٠٩-٠١
      await service.pushStep(telegramId, WorkerWizardStep.CUSTOM_START_DATE_INPUT, {
        activeMessageId: 212,
        chatId: 312,
      });
      await handler.handleTextInput(mockCtx, '٢٠٢٦-٠٩-٠١');
      draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.DRIVING_LICENSE);
      expect(draft?.hireDate).toBe('2026-09-01');

      // 5. EMERGENCY_PHONE with Arabic digits: ٠١١٢٢٣٣٤٤٥٥
      await service.pushStep(telegramId, WorkerWizardStep.EMERGENCY_PHONE, {
        activeMessageId: 212,
        chatId: 312,
      });
      await handler.handleTextInput(mockCtx, '٠١١٢٢٣٣٤٤٥٥');
      draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.INSURANCE_STATUS);
      expect(draft?.emergencyPhone).toBe('01122334455');

      // 6. AI_EDIT_ID with Arabic digits: ٢٩٥٠٨١٠١٢٣٤٥٦٧
      await service.pushStep(telegramId, WorkerWizardStep.AI_EDIT_ID, {
        idType: 'NATIONAL_ID',
        activeMessageId: 212,
        chatId: 312,
      });
      await handler.handleTextInput(mockCtx, '٢٩٥٠٨١٠١٢٣٤٥٦٧');
      draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_CONFIRMATION);
      expect(draft?.idNumber).toBe('29508101234567');
      expect(draft?.aiDetectedData?.nationalId).toBe('29508101234567');

      // 7. AI_EDIT_EXPIRY with Arabic digits: ٢٠٣٠-٠٥-١٥
      await service.pushStep(telegramId, WorkerWizardStep.AI_EDIT_EXPIRY, {
        activeMessageId: 212,
        chatId: 312,
      });
      await handler.handleTextInput(mockCtx, '٢٠٣٠-٠٥-١٥');
      draft = await service.getDraft(telegramId);
      expect(draft?.currentStep).toBe(WorkerWizardStep.AI_CONFIRMATION);
      expect(draft?.expiryDate).toBe('15-05-2030');
      expect(draft?.aiDetectedData?.expiryDate).toBe('15-05-2030');
    });

    it('should update age and governorate when editing National ID to underage worker and include legal notice', async () => {
      const mockPrisma = {
        worker: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as unknown as PrismaClient;
      const repo = new WorkerRegistrationRepository(mockPrisma);
      const service = new WorkerRegistrationService(repo);
      const handler = new WorkerRegistrationHandler(service, repo);

      const telegramId = BigInt(112224);
      // Initial state: adult worker scanned as born in 1990 (age 36) in Luxor (gov 27)
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

      // User corrects ID to 16-year-old worker born in 2010 in Cairo (gov 01): 31001010101234
      await handler.handleTextInput(mockCtx, '٣١٠٠١٠١٠١٠١٢٣٤');
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

    it('should handle confirm registration successfully with flexible DD-MM-YYYY dates', async () => {
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
        birthDate: '15-05-1990', // non-ISO DD-MM-YYYY format
        hireDate: '01-09-2026',  // non-ISO DD-MM-YYYY format
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

      await handler.handleConfirm(mockCtx);

      expect(completionText).toContain('تم تسجيل وتعيين العامل بنجاح');
      expect(createdRecord.birthDate).toBeInstanceOf(Date);
      expect(isNaN((createdRecord.birthDate as Date).getTime())).toBe(false);
      expect(createdRecord.hireDate).toBeInstanceOf(Date);
      expect(isNaN((createdRecord.hireDate as Date).getTime())).toBe(false);
    });
  });

  describe('Cancellation Lifecycle & Reply Keyboard Interception Immunity (Plan 54)', () => {
    it('should cleanly cancel active wizard, answer callback query, clear draft, and render cancelExitKeyboard', async () => {
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

      await handler.handleCancel(mockCtx);

      expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
      const remainingDraft = await service.getDraft(telegramId);
      expect(remainingDraft).toBeNull();
      expect(promptRendered).toContain('تم إلغاء');
      expect(replyMarkupAttached).toBeDefined();
      // Verify exit options exist in keyboard
      const buttons = replyMarkupAttached?.inline_keyboard.flat() || [];
      const buttonTexts = buttons.map((b) => b.text);
      expect(buttonTexts.some((t: string) => t.includes('تسجيل عامل'))).toBe(true);
      expect(buttonTexts.some((t: string) => t.includes('شؤون العاملين'))).toBe(true);
      expect(buttonTexts.some((t: string) => t.includes('القائمة الرئيسية'))).toBe(true);
    });

    it('should store and clear wizard state via RedisWorkerWizardStateStore with 1800s TTL', async () => {
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

      await stateStore.set(telegramId, {
        currentStep: WorkerWizardStep.DOC_TYPE,
        name: 'حسام حسن علي',
      });

      expect(mockRedis.set).toHaveBeenCalledWith(
        'pending:worker_wizard:user:443322',
        expect.stringContaining('حسام حسن علي'),
        'EX',
        1800
      );

      const retrieved = await stateStore.get(telegramId);
      expect(retrieved?.name).toBe('حسام حسن علي');
      expect(retrieved?.currentStep).toBe(WorkerWizardStep.DOC_TYPE);

      await stateStore.delete(telegramId);
      expect(mockRedis.del).toHaveBeenCalledWith('pending:worker_wizard:user:443322');

      const afterDelete = await stateStore.get(telegramId);
      expect(afterDelete).toBeNull();
    });

    it('should gracefully fall back to in-memory state store if Redis throws an error', async () => {
      const mockFailingRedis = {
        get: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        set: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        del: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      };

      const stateStore = new RedisWorkerWizardStateStore(mockFailingRedis);
      const telegramId = BigInt(887766);

      // Should not throw even when Redis is down
      await stateStore.set(telegramId, {
        currentStep: WorkerWizardStep.FULL_NAME,
        name: 'عماد متعب',
      });

      const retrieved = await stateStore.get(telegramId);
      expect(retrieved?.name).toBe('عماد متعب');

      await stateStore.delete(telegramId);
      const afterDelete = await stateStore.get(telegramId);
      expect(afterDelete).toBeNull();
    });

    it('should ensure text input is NOT intercepted as National ID after wizard is cancelled', async () => {
      const repo = new WorkerRegistrationRepository({} as PrismaClient);
      const service = new WorkerRegistrationService(repo);
      const handler = new WorkerRegistrationHandler(service, repo);

      const telegramId = BigInt(112233);
      // Draft active at ID_NUMBER step
      await service.pushStep(telegramId, WorkerWizardStep.ID_NUMBER, {
        name: 'محمود الخطيب',
        activeMessageId: 701,
        chatId: 801,
      });

      // User cancels
      await service.clearDraft(telegramId);

      // Subsequent input (e.g. from persistent reply keyboard "🖥️ فتح لوحة التحكم")
      const draft = await service.getDraft(telegramId);
      expect(draft).toBeNull();

      // Calling handler with null draft does nothing
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

      await handler.handleTextInput(mockCtx, '🖥️ فتح لوحة التحكم');
      expect(editCalled).toBe(false);
    });
  });
});
