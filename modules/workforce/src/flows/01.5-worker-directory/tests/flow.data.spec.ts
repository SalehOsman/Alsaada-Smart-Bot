import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerDirectoryService } from '../flow.service.js';
import { WorkerDirectoryRepository } from '../flow.repository.js';
import type { PrismaClient } from '@alsaada/database';

describe('Flow 01.5 Data Tests — Financial Masking & PII Protection', () => {
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

  it('masks sensitive wage information from non-super-admin viewers', async () => {
    // Arrange
    const mockWorker = {
      id: 'wrk-1',
      code: 'OP-001',
      name: 'سالم حسن',
      idType: 'NATIONAL_ID',
      nationalIdEncrypted: null,
      phoneEncrypted: null,
      jobTitle: 'عامل',
      hireDate: new Date('2026-09-01'),
      dailyWage: 450,
      status: 'ACTIVE',
    };

    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(mockWorker),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerDirectoryRepository(mockPrisma);
    const service = new WorkerDirectoryService(repo);

    // Act
    const fieldAdminProfile = await service.getWorkerProfile360('wrk-1', 'FIELD_ADMIN');
    const superAdminProfile = await service.getWorkerProfile360('wrk-1', 'SUPER_ADMIN');

    // Assert
    expect(fieldAdminProfile?.dailyWageMasked).toBeUndefined();
    expect(superAdminProfile?.dailyWageMasked).toContain('450');
  });

  it('displays unmasked National ID to admins/super admins and masked to others', async () => {
    // Arrange
    const rawSecret = 'test-secret-key-32-chars-long-abc!!';
    const { encryptField } = await import('@alsaada/database');
    const { createHash } = await import('node:crypto');
    const encryptionKey = createHash('sha256').update(rawSecret).digest('hex');

    const encryptedNatId = encryptField('28009010100332', encryptionKey);

    const mockWorker = {
      id: 'wrk-1',
      code: 'OP-001',
      name: 'صالح عثمان',
      idType: 'NATIONAL_ID',
      nationalIdEncrypted: encryptedNatId,
      phoneEncrypted: null,
      jobTitle: 'إداري',
      hireDate: new Date('2026-09-01'),
      dailyWage: 800,
      status: 'ACTIVE',
    };

    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(mockWorker),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerDirectoryRepository(mockPrisma);
    const service = new WorkerDirectoryService(repo, encryptionKey);

    // Act
    const superAdminProfile = await service.getWorkerProfile360('wrk-1', 'SUPER_ADMIN');
    const fieldAdminProfile = await service.getWorkerProfile360('wrk-1', 'FIELD_ADMIN');
    const guestProfile = await service.getWorkerProfile360('wrk-1', 'GUEST');

    // Assert
    expect(superAdminProfile?.idNumberMasked).toBe('28009010100332');
    expect(fieldAdminProfile?.idNumberMasked).toBe('28009010100332');
    expect(guestProfile?.idNumberMasked).toBe('**********0332');
    expect(guestProfile?.idNumberMasked).not.toContain('28009010100332');
  });

  it('omits separate call button since phone is clickable in the profile card directly', async () => {
    // Arrange
    const { WorkerDirectoryKeyboards } = await import('../flow.keyboard.js');

    // Act
    const kb = WorkerDirectoryKeyboards.profile360ActionsKeyboard('wrk-1', 'https://wa.me/2010', true);
    const flat = kb.inline_keyboard.flat();
    const callBtn = flat.find((b) => 'callback_data' in b && b.callback_data === 'action:worker:call:wrk-1');

    // Assert
    expect(callBtn).toBeUndefined();
    expect(flat.some((b) => 'callback_data' in b && b.callback_data === 'action:worker:call:wrk-1')).toBe(false);
  });

  it('detects missing documents/data and generates WhatsApp prompt URL', async () => {
    // Arrange
    const rawSecret = 'test-secret-key-32-chars-long-abc!!';
    const { createHash } = await import('node:crypto');
    const encryptionKey = createHash('sha256').update(rawSecret).digest('hex');

    const mockIncompleteWorker = {
      id: 'wrk-inc',
      code: 'OP-002',
      name: 'إبراهيم علي',
      nickname: 'هيما',
      idType: 'NATIONAL_ID',
      nationalIdEncrypted: null,
      phoneEncrypted: null,
      emergencyPhoneEncrypted: null,
      jobTitle: 'سائق لودر',
      gender: 'MALE',
      militaryStatus: null,
      drivingLicense: null,
      address: null,
      insuranceNumber: null,
      insuranceStatus: null,
      idCardFrontPath: null,
      idCardBackPath: null,
      hireDate: new Date('2026-09-01'),
      dailyWage: 500,
      paymentMethod: 'CASH_SITE',
      status: 'ACTIVE',
    };

    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(mockIncompleteWorker),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerDirectoryRepository(mockPrisma);
    const service = new WorkerDirectoryService(repo, encryptionKey);

    // Act
    const profile = await service.getWorkerProfile360('wrk-inc', 'SUPER_ADMIN');

    // Assert
    expect(profile).not.toBeNull();
    expect(profile?.isProfileComplete).toBe(false);
    expect(profile?.completionPercentage).toBeLessThan(100);
    expect(profile?.missingItems).toContain('صورة وجه البطاقة');
    expect(profile?.missingItems).toContain('صورة ظهر البطاقة');
    expect(profile?.missingItems).toContain('رقم هاتف العامل');
    expect(profile?.missingItems).toContain('رقم هاتف الطوارئ');
    expect(profile?.missingItems).toContain('محل الإقامة والعنوان');
    expect(profile?.missingItems).toContain('الموقف التأميني / الرقم التأميني');
    expect(profile?.missingItems).toContain('الموقف التجنيدي');
    expect(profile?.missingItems).toContain('رخصة القيادة');
    expect(profile?.missingDataWhatsAppUrl).toBeDefined();
    expect(decodeURIComponent(profile?.missingDataWhatsAppUrl || '')).toContain('هيما');

    // Act 2: Keyboard generation
    const { WorkerDirectoryKeyboards } = await import('../flow.keyboard.js');
    const kb = WorkerDirectoryKeyboards.profile360ActionsKeyboard(
      'wrk-inc',
      undefined,
      false,
      profile?.missingDataWhatsAppUrl
    );
    const flat = kb.inline_keyboard.flat();
    const missingBtn = flat.find((b) => b.text.includes('طلب استكمال النواقص عبر واتساب'));

    // Assert 2
    expect(missingBtn).toBeDefined();
    expect(missingBtn && 'callback_data' in missingBtn ? missingBtn.callback_data : undefined).toBe('action:worker:mwa:wrk-inc');

    // Act 3: Short URL direct button
    const safeShortUrl = 'https://wa.me/201012345678';
    const kbShort = WorkerDirectoryKeyboards.profile360ActionsKeyboard(
      'wrk-inc',
      undefined,
      false,
      safeShortUrl
    );
    const flatShort = kbShort.inline_keyboard.flat();
    const missingBtnShort = flatShort.find((b) => b.text.includes('طلب استكمال النواقص عبر واتساب'));

    // Assert 3
    expect(missingBtnShort && 'url' in missingBtnShort ? missingBtnShort.url : undefined).toBe(safeShortUrl);
    expect(missingBtnShort && 'callback_data' in missingBtnShort ? missingBtnShort.callback_data : undefined).toBeUndefined();
  });

  it('evaluates 100% complete profile without missing data button', async () => {
    // Arrange
    const rawSecret = 'test-secret-key-32-chars-long-abc!!';
    const { encryptField } = await import('@alsaada/database');
    const { createHash } = await import('node:crypto');
    const encryptionKey = createHash('sha256').update(rawSecret).digest('hex');

    const encryptedPhone = encryptField('01012345678', encryptionKey);
    const encryptedEmergencyPhone = encryptField('01098765432', encryptionKey);

    const mockCompleteWorker = {
      id: 'wrk-complete',
      code: 'OP-003',
      name: 'محمود كامل',
      nickname: 'حودة',
      idType: 'PASSPORT',
      nationalIdEncrypted: null,
      passportNumberEncrypted: null,
      phoneEncrypted: encryptedPhone,
      emergencyPhoneEncrypted: encryptedEmergencyPhone,
      jobTitle: 'عامل عادي',
      gender: 'FEMALE',
      address: 'القاهرة - المعادي',
      insuranceNumber: '12345678',
      insuranceStatus: 'مؤمن عليه',
      idCardFrontPath: '/uploads/passport.jpg',
      hireDate: new Date('2026-09-01'),
      dailyWage: 400,
      paymentMethod: 'CASH_SITE',
      status: 'ACTIVE',
    };

    const mockPrisma = {
      worker: {
        findUnique: vi.fn().mockResolvedValue(mockCompleteWorker),
      },
    } as unknown as PrismaClient;

    const repo = new WorkerDirectoryRepository(mockPrisma);
    const service = new WorkerDirectoryService(repo, encryptionKey);

    // Act
    const profile = await service.getWorkerProfile360('wrk-complete', 'SUPER_ADMIN');

    // Assert
    expect(profile?.isProfileComplete).toBe(true);
    expect(profile?.completionPercentage).toBe(100);
    expect(profile?.missingItems.length).toBe(0);
    expect(profile?.missingDataWhatsAppUrl).toBeUndefined();
    expect(profile?.missingItems).not.toContain('رقم هاتف العامل');
  });
});
