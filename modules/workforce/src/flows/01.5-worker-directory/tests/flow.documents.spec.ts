import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { InlineKeyboard } from 'grammy';
import { WorkerDirectoryRepository } from '../flow.repository.js';
import { WorkerDirectoryService } from '../flow.service.js';
import { WorkerDocumentsHandler } from '../flow.documents-handler.js';
import type { PrismaClient } from '@alsaada/database';
import type { WorkforceModuleContext } from '../../../shared/module.types.js';

interface InlineKeyboardButtonMock {
  text: string;
  callback_data?: string;
}

interface MockKeyboardContainer {
  inline_keyboard?: InlineKeyboardButtonMock[][];
}

describe('Flow 01.5 — Worker Documents and Attachments Archive', () => {
  const dummyWorker = {
    id: 'worker-101',
    code: 'OP-DRV-001',
    name: 'أحمد محمود حسن',
    nickname: 'أحمد محمود',
    jobTitle: 'سائق لودر',
    isDeleted: false,
    status: 'ACTIVE',
  };

  const dummyDoc = {
    id: 'doc-001',
    workerId: 'worker-101',
    title: 'عقد عمل',
    category: 'CONTRACT',
    fileName: 'contract.pdf',
    fileType: 'application/pdf',
    fileUri: 'attachments/workers/OP-DRV-001/12345_contract.pdf',
    driveFileId: null,
    fileSizeBytes: BigInt(50000),
    uploadedBy: BigInt(123456789),
    createdAt: new Date('2026-09-01T10:00:00Z'),
    updatedAt: new Date('2026-09-01T10:00:00Z'),
    worker: dummyWorker,
  };

  interface MockPrismaInstance {
    worker: {
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    workerDocument: {
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    companyProfile: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    tenant: {
      findFirst: ReturnType<typeof vi.fn>;
    };
  }

  let mockPrisma: MockPrismaInstance;
  let repo: WorkerDirectoryRepository;
  let service: WorkerDirectoryService;
  let handler: WorkerDocumentsHandler;
  const createdTestFiles: string[] = [];

  beforeEach(() => {
    mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(dummyWorker),
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([dummyWorker]),
      },
      workerDocument: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([dummyDoc]),
        findUnique: vi.fn().mockResolvedValue(dummyDoc),
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'new-doc-id', ...data, worker: dummyWorker })
        ),
        delete: vi.fn().mockResolvedValue(dummyDoc),
      },
      companyProfile: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      tenant: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    repo = new WorkerDirectoryRepository(mockPrisma as unknown as PrismaClient);
    service = new WorkerDirectoryService(repo);
    handler = new WorkerDocumentsHandler(service, repo);
  });

  afterEach(() => {
    for (const file of createdTestFiles) {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch {}
    }
    createdTestFiles.length = 0;
  });

  describe('Service & Repository Layer', () => {
    it('should count worker documents correctly and include in worker profile', async () => {
      const count = await repo.countWorkerDocuments('worker-101');
      expect(count).toBe(1);

      const profile = await service.getWorkerProfile360('worker-101', 'SUPER_ADMIN');
      expect(profile).not.toBeNull();
      expect(profile?.documentsCount).toBe(1);
    });

    it('should fetch list of documents for a worker', async () => {
      const docs = await service.getWorkerDocuments('worker-101');
      expect(docs.length).toBe(1);
      expect(docs[0]!.title).toBe('عقد عمل');
      expect(docs[0]!.category).toBe('CONTRACT');
    });

    it('should add a new worker document and save it in dedicated worker folder', async () => {
      const testBuffer = Buffer.from('dummy-document-content-for-testing');
      const added = await service.addWorkerDocument({
        workerId: 'worker-101',
        workerCode: 'OP-DRV-001',
        originalFileName: 'driving_license.jpg',
        fileBuffer: testBuffer,
        title: 'رخصة قيادة',
        category: 'DRIVING_LICENSE',
        mimeType: 'image/jpeg',
        uploadedBy: BigInt(999),
      });

      expect(mockPrisma.workerDocument.create).toHaveBeenCalled();
      expect(added.title).toBe('رخصة قيادة');
      expect(added.category).toBe('DRIVING_LICENSE');
      expect(added.fileUri).toContain('attachments/workers/OP-DRV-001/');

      // Track file for cleanup
      const fullPath = path.resolve(process.cwd(), added.fileUri);
      createdTestFiles.push(fullPath);
      expect(fs.existsSync(fullPath)).toBe(true);
    });

    it('should restrict document deletion to SUPER_ADMIN only', async () => {
      // 1. FIELD_ADMIN attempt must fail
      const fieldAdminResult = await service.deleteWorkerDocument('doc-001', 'FIELD_ADMIN');
      expect(fieldAdminResult.success).toBe(false);
      expect(fieldAdminResult.error).toContain('محصور حصراً بالسوبر أدمن');
      expect(mockPrisma.workerDocument.delete).not.toHaveBeenCalled();

      // 2. SUPER_ADMIN attempt must succeed
      const superAdminResult = await service.deleteWorkerDocument('doc-001', 'SUPER_ADMIN');
      expect(superAdminResult.success).toBe(true);
      expect(mockPrisma.workerDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-001' } });
    });
  });

  describe('Handler UX & Telegram Flow', () => {
    it('should render documents list with count and upload button for authorized roles', async () => {
      let sentText = '';
      let sentKeyboard: MockKeyboardContainer | null = null;

      const ctx = {
        effectiveRole: 'FIELD_ADMIN',
        callbackQuery: {
          message: { message_id: 123 },
        },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        editMessageText: vi.fn().mockImplementation((text: string, opts?: { reply_markup?: InlineKeyboard }) => {
          sentText = text;
          sentKeyboard = (opts?.reply_markup as unknown as MockKeyboardContainer) || null;
          return Promise.resolve();
        }),
      } as unknown as WorkforceModuleContext;

      await handler.handleListDocuments(ctx, 'worker-101');

      expect(ctx.answerCallbackQuery).toHaveBeenCalled();
      expect(sentText).toContain('أرشيف مستندات ومرفقات العامل');
      expect(sentText).toContain('1 مستند');
      expect(sentText).toContain('أحمد محمود حسن');

      // Check keyboard has document view button and add document button
      const buttonsFlat = ((sentKeyboard as MockKeyboardContainer | null)?.inline_keyboard?.flat() || []) as unknown as InlineKeyboardButtonMock[];
      const hasDocBtn = buttonsFlat.some((b) => b.text.includes('عقد عمل'));
      const hasAddBtn = buttonsFlat.some((b) => b.text.includes('إضافة / رفع مستند جديد'));
      expect(hasDocBtn).toBe(true);
      expect(hasAddBtn).toBe(true);
    });

    it('should block unauthorized roles (e.g. WORKER) from viewing documents', async () => {
      let sentText = '';
      const ctx = {
        effectiveRole: 'WORKER',
        callbackQuery: { message: { message_id: 123 } },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        reply: vi.fn().mockImplementation((text: string) => {
          sentText = text;
          return Promise.resolve();
        }),
      } as unknown as WorkforceModuleContext;

      await handler.handleListDocuments(ctx, 'worker-101');
      expect(sentText).toContain('لا تملك الصلاحية');
    });

    it('should send document as photo or document when viewed by user', async () => {
      // Create a physical test file
      const workerDir = path.resolve(process.cwd(), 'attachments/workers/OP-DRV-001');
      if (!fs.existsSync(workerDir)) fs.mkdirSync(workerDir, { recursive: true });
      const testFilePath = path.join(workerDir, 'test_image.jpg');
      fs.writeFileSync(testFilePath, Buffer.from('fake-jpg'));
      createdTestFiles.push(testFilePath);

      mockPrisma.workerDocument.findUnique.mockResolvedValue({
        ...dummyDoc,
        fileName: 'test_image.jpg',
        fileType: 'image/jpeg',
        fileUri: 'attachments/workers/OP-DRV-001/test_image.jpg',
      });

      let photoSent = false;
      let replyMarkup: MockKeyboardContainer | null = null;

      const ctx = {
        effectiveRole: 'FIELD_ADMIN',
        callbackQuery: { message: { message_id: 123 } },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        replyWithPhoto: vi.fn().mockImplementation((_file: unknown, opts?: { reply_markup?: InlineKeyboard }) => {
          photoSent = true;
          replyMarkup = (opts?.reply_markup as unknown as MockKeyboardContainer) || null;
          return Promise.resolve();
        }),
      } as unknown as WorkforceModuleContext;

      await handler.handleViewDocument(ctx, 'doc-001');

      expect(photoSent).toBe(true);
      const buttonsFlat = ((replyMarkup as MockKeyboardContainer | null)?.inline_keyboard?.flat() || []) as unknown as InlineKeyboardButtonMock[];
      // FIELD_ADMIN must NOT have delete button
      const hasDeleteBtn = buttonsFlat.some((b) => b.text.includes('حذف'));
      expect(hasDeleteBtn).toBe(false);
    });

    it('should show delete button when document is viewed by SUPER_ADMIN', async () => {
      // Create a physical test file
      const workerDir = path.resolve(process.cwd(), 'attachments/workers/OP-DRV-001');
      if (!fs.existsSync(workerDir)) fs.mkdirSync(workerDir, { recursive: true });
      const testFilePath = path.join(workerDir, 'test_contract.pdf');
      fs.writeFileSync(testFilePath, Buffer.from('fake-pdf'));
      createdTestFiles.push(testFilePath);

      mockPrisma.workerDocument.findUnique.mockResolvedValue({
        ...dummyDoc,
        fileName: 'test_contract.pdf',
        fileType: 'application/pdf',
        fileUri: 'attachments/workers/OP-DRV-001/test_contract.pdf',
      });

      let docSent = false;
      let replyMarkup: MockKeyboardContainer | null = null;

      const ctx = {
        effectiveRole: 'SUPER_ADMIN',
        isRealSuperAdmin: true,
        callbackQuery: { message: { message_id: 123 } },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        replyWithDocument: vi.fn().mockImplementation((_file: unknown, opts?: { reply_markup?: InlineKeyboard }) => {
          docSent = true;
          replyMarkup = (opts?.reply_markup as unknown as MockKeyboardContainer) || null;
          return Promise.resolve();
        }),
      } as unknown as WorkforceModuleContext;

      await handler.handleViewDocument(ctx, 'doc-001');

      expect(docSent).toBe(true);
      const buttonsFlat = ((replyMarkup as MockKeyboardContainer | null)?.inline_keyboard?.flat() || []) as unknown as InlineKeyboardButtonMock[];
      const hasDeleteBtn = buttonsFlat.some((b) => b.text.includes('حذف'));
      expect(hasDeleteBtn).toBe(true);
    });

    it('should execute complete upload wizard: category -> file -> persistence', async () => {
      const fromUser = { id: 556677 };
      let stepPrompt = '';
      let stepMarkup: MockKeyboardContainer | null = null;

      // 1. Start upload wizard
      const ctxStart = {
        effectiveRole: 'FIELD_ADMIN',
        from: fromUser,
        callbackQuery: { message: { message_id: 123 } },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        editMessageText: vi.fn().mockImplementation((text: string, opts?: { reply_markup?: InlineKeyboard }) => {
          stepPrompt = text;
          stepMarkup = (opts?.reply_markup as unknown as MockKeyboardContainer) || null;
          return Promise.resolve();
        }),
      } as unknown as WorkforceModuleContext;

      await handler.handleStartAddDocument(ctxStart, 'worker-101');
      expect(stepPrompt).toContain('إضافة / رفع مستند جديد');
      const startBtns = ((stepMarkup as MockKeyboardContainer | null)?.inline_keyboard?.flat() || []) as unknown as InlineKeyboardButtonMock[];
      expect(startBtns.some((b) => b.text.includes('عقد عمل'))).toBe(true);
      expect(startBtns.some((b) => b.text.includes('مستند مخصص'))).toBe(true);

      // 2. Select category CONTRACT
      await handler.handleSelectDocCategory(ctxStart, 'CONTRACT');
      expect(stepPrompt).toContain('إرسال ملف المستند');
      expect(stepPrompt).toContain('عقد عمل');
      expect(handler.isWaitingForDocFile(String(fromUser.id))).toBe(true);

      // 3. Send file
      const sentReplies: string[] = [];
      const ctxFile = {
        effectiveRole: 'FIELD_ADMIN',
        from: fromUser,
        reply: vi.fn().mockImplementation((text: string) => {
          sentReplies.push(text);
          return Promise.resolve();
        }),
        editMessageText: vi.fn().mockResolvedValue(undefined),
      } as unknown as WorkforceModuleContext;

      const pdfBuffer = Buffer.from('test-pdf-contract-binary');
      await handler.handleDocumentFileInput(ctxFile, {
        buffer: pdfBuffer,
        fileName: 'my_contract.pdf',
        mimeType: 'application/pdf',
      });

      expect(mockPrisma.workerDocument.create).toHaveBeenCalled();
      expect(sentReplies.some((r) => r.includes('تم رفع وأرشفة المستند'))).toBe(true);
      expect(handler.isWaitingForDocFile(String(fromUser.id))).toBe(false);
    });

    it('should support custom title input for novel document categories', async () => {
      const fromUser = { id: 778899 };
      let stepPrompt = '';

      const ctx = {
        effectiveRole: 'FIELD_ADMIN',
        from: fromUser,
        callbackQuery: { message: { message_id: 123 } },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        deleteMessage: vi.fn().mockResolvedValue(true),
        editMessageText: vi.fn().mockImplementation((text: string) => {
          stepPrompt = text;
          return Promise.resolve();
        }),
        reply: vi.fn().mockImplementation((text: string) => {
          stepPrompt = text;
          return Promise.resolve();
        }),
      } as unknown as WorkforceModuleContext;

      // Start wizard & select custom
      await handler.handleStartAddDocument(ctx, 'worker-101');
      await handler.handleSelectDocCategory(ctx, 'CUSTOM');

      expect(stepPrompt).toContain('كتابة عنوان المستند المخصص');
      expect(handler.isWaitingForDocTitle(String(fromUser.id))).toBe(true);

      // Provide custom title
      await handler.handleCustomTitleInput(ctx, 'إقرار استلام عهدة سلاح');

      expect(stepPrompt).toContain('إرسال ملف المستند');
      expect(stepPrompt).toContain('إقرار استلام عهدة سلاح');
      expect(handler.isWaitingForDocFile(String(fromUser.id))).toBe(true);

      const uploadState = handler.getUploadState(String(fromUser.id));
      expect(uploadState?.title).toBe('إقرار استلام عهدة سلاح');
      expect(uploadState?.category).toBe('OTHER');
    });

    it('should support preset selection of National ID, Passport, and Work Permit', async () => {
      const fromUser = { id: 889900 };
      let stepPrompt = '';
      let stepMarkup: MockKeyboardContainer | null = null;

      const ctx = {
        effectiveRole: 'FIELD_ADMIN',
        from: fromUser,
        callbackQuery: { message: { message_id: 456 } },
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        editMessageText: vi.fn().mockImplementation((text: string, opts?: { reply_markup?: InlineKeyboard }) => {
          stepPrompt = text;
          stepMarkup = (opts?.reply_markup as unknown as MockKeyboardContainer) || null;
          return Promise.resolve();
        }),
      } as unknown as WorkforceModuleContext;

      await handler.handleStartAddDocument(ctx, 'worker-101');
      const buttons = ((stepMarkup as MockKeyboardContainer | null)?.inline_keyboard?.flat() || []) as unknown as InlineKeyboardButtonMock[];

      expect(buttons.some((b) => b.text.includes('بطاقة الرقم القومي') && b.callback_data === 'act:wdoc:cat:NATIONAL_ID')).toBe(true);
      expect(buttons.some((b) => b.text.includes('جواز السفر') && b.callback_data === 'act:wdoc:cat:PASSPORT')).toBe(true);
      expect(buttons.some((b) => b.text.includes('تصريح العمل') && b.callback_data === 'act:wdoc:cat:WORK_PERMIT')).toBe(true);

      // Select National ID
      await handler.handleSelectDocCategory(ctx, 'NATIONAL_ID');
      expect(stepPrompt).toContain('بطاقة الرقم القومي');
      expect(handler.getUploadState(String(fromUser.id))?.category).toBe('NATIONAL_ID');
      expect(handler.getUploadState(String(fromUser.id))?.title).toBe('بطاقة الرقم القومي');

      // Select Passport
      await handler.handleSelectDocCategory(ctx, 'PASSPORT');
      expect(stepPrompt).toContain('جواز السفر');
      expect(handler.getUploadState(String(fromUser.id))?.category).toBe('PASSPORT');
      expect(handler.getUploadState(String(fromUser.id))?.title).toBe('جواز السفر');

      // Select Work Permit
      await handler.handleSelectDocCategory(ctx, 'WORK_PERMIT');
      expect(stepPrompt).toContain('تصريح العمل');
      expect(handler.getUploadState(String(fromUser.id))?.category).toBe('WORK_PERMIT');
      expect(handler.getUploadState(String(fromUser.id))?.title).toBe('تصريح العمل');
    });
  });
});
