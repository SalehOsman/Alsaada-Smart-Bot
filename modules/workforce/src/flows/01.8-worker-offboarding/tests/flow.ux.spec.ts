import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildWorkerPickerKeyboard,
  buildSuperAdminHubKeyboard,
  buildPendingDecisionsInboxKeyboard,
  buildDisciplinaryRadarKeyboard,
  buildReasonKeyboard,
  buildWorkedDaysKeyboard,
  buildPPEAuditKeyboard,
  buildPayoutOptionKeyboard,
  buildNegativeBalanceKeyboard,
  buildConfirmKeyboard,
  buildClearanceCompletionKeyboard,
  buildSuccessKeyboard,
} from '../flow.keyboard.js';
import {
  formatHubMenuHeader,
  formatWorkerSelectHeader,
  formatReasonSelectHeader,
  formatFieldAdminReviewCard,
  formatSuperAdminSettlementCard,
  formatPendingDecisionsInboxCard,
  formatNegativeBalanceAlertCard,
  formatPPEDamagePhotoPrompt,
  formatPayoutOptionPrompt,
  formatClearanceWhatsAppText,
  buildClearanceWhatsAppUrl,
  formatPendingDecisionsWhatsAppAlertText,
  buildPendingDecisionsWhatsAppUrl,
  formatConfirmationCard,
  formatSuccessCard,
  formatOffboardingNotification,
} from '../flow.messages.js';
import type {
  ClearanceFinancialBreakdown,
  PendingDisciplinaryRecord,
} from '../flow.types.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('01.8 Worker Offboarding — UX & Messages Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const sampleBreakdown: ClearanceFinancialBreakdown = {
    workedDays: 20,
    dailyRate: 200,
    earnedSalary: 4000,
    approvedBonuses: 500,
    totalCredits: 4500,
    totalAdvances: 1200,
    totalPenalties: 300,
    assetDamageDeduction: 250,
    totalDebits: 1750,
    netSettlementAmount: 2750,
    isNegativeBalance: false,
  };

  const samplePendingRecord: PendingDisciplinaryRecord = {
    id: 'disc-rec-101',
    recordNumber: 'DISC-2026-001',
    type: 'PENALTY_CASH',
    amount: 350,
    daysEquivalent: null,
    reason: 'تأخير متكرر عن بدء الوردية الميدانية',
    createdAt: new Date('2026-09-01T10:00:00Z'),
    requesterName: 'م. أحمد مشرف',
    workerId: 'w-1',
    workerName: 'علي حسن',
    workerCode: 'OP-042',
  };

  // ==========================================================================
  // 1. Telegram 64-Byte Callback Constraint & Keyboard Integrity
  // ==========================================================================
  describe('Keyboard Callback Limits & Button Layouts', () => {
    it('ensures all keyboards comply with Telegram 64-byte callback limits', () => {
      // Arrange
      const keyboards = [
        buildWorkerPickerKeyboard([
          { id: 'w-1', name: 'أحمد سعيد عبد السلام', nickname: 'أبو حميد', code: 'OP-01', jobTitle: 'سائق لودر' },
          { id: 'w-2', name: 'علي محمود حسن', nickname: null, code: 'OP-02', jobTitle: 'فني كهرباء' },
        ]),
        buildSuperAdminHubKeyboard(5, 3),
        buildPendingDecisionsInboxKeyboard([samplePendingRecord], 0, 3),
        buildDisciplinaryRadarKeyboard(true, { isSuperAdmin: true }),
        buildDisciplinaryRadarKeyboard(true, { isSuperAdmin: false, superAdminWhatsAppUrl: 'https://wa.me/201000000000' }),
        buildReasonKeyboard(),
        buildWorkedDaysKeyboard({ isWorkerOnLeave: true, daysBeforeLeave: 12, daysUntilExpectedReturn: 28 }),
        buildWorkedDaysKeyboard({ isWorkerOnLeave: false, daysUntilToday: 15 }),
        buildPPEAuditKeyboard(true),
        buildPPEAuditKeyboard(false),
        buildPayoutOptionKeyboard(true),
        buildPayoutOptionKeyboard(false),
        buildNegativeBalanceKeyboard(),
        buildConfirmKeyboard(),
        buildClearanceCompletionKeyboard({
          whatsappUrl: 'https://wa.me/201012345678',
          isFieldAdmin: false,
        }),
        buildSuccessKeyboard(),
      ];

      // Act
      const allCallbacks: string[] = [];
      for (const kb of keyboards) {
        for (const button of kb.inline_keyboard.flat()) {
          if ('callback_data' in button && button.callback_data) {
            allCallbacks.push(button.callback_data);
          }
        }
      }

      // Assert
      expect(allCallbacks.length).toBeGreaterThan(0);
      for (const cb of allCallbacks) {
        const byteLen = Buffer.byteLength(cb, 'utf8');
        expect(byteLen).toBeLessThanOrEqual(64);
      }
    });

    it('formats worker picker buttons prioritizing nickname exclusively', () => {
      // Arrange
      const workers = [
        { id: 'w-1', name: 'إبراهيم محمد حسنين', nickname: 'هيما', code: 'OP-10', jobTitle: 'سائق شاحنة' },
        { id: 'w-2', name: 'محمود عبد الفتاح', nickname: null, code: 'OP-20', jobTitle: 'عامل موقع' },
      ];

      // Act
      const kb = buildWorkerPickerKeyboard(workers);
      const buttons = kb.inline_keyboard.flat().filter((b) => 'callback_data' in b && b.callback_data?.startsWith('action:wob:pick:'));

      // Assert
      expect(buttons).toHaveLength(2);
      expect(buttons[0]?.text).toContain('هيما');
      expect(buttons[0]?.text).not.toContain('حسنين');
      expect(buttons[1]?.text).toContain('محمود عبد الفتاح');
    });

    it('builds Super Admin Hub keyboard with accurate pending counts', () => {
      // Arrange
      const pendingClearances = 7;
      const pendingDecisions = 4;

      // Act
      const kb = buildSuperAdminHubKeyboard(pendingClearances, pendingDecisions);
      const texts = kb.inline_keyboard.flat().map((b) => b.text);

      // Assert
      expect(texts).toEqual(
        expect.arrayContaining([
          expect.stringContaining('اعتماد المخالصات الميدانية المعلقة (7)'),
          expect.stringContaining('صندوق القرارات المعلقة (4)'),
          expect.stringContaining('تسجيل إنهاء خدمة لعامل جديد'),
        ])
      );
      expect(texts).not.toEqual(
        expect.arrayContaining([expect.stringContaining('(0)')])
      );
    });

    it('builds Pending Decisions Inbox keyboard with record actions and pagination', () => {
      // Arrange
      const singleRecords = [samplePendingRecord];
      const multiTotal = 3;

      // Act
      const kbSingle = buildPendingDecisionsInboxKeyboard(singleRecords, 0, 1);
      const singleTexts = kbSingle.inline_keyboard.flat().map((b) => b.text);
      const kbMulti = buildPendingDecisionsInboxKeyboard(singleRecords, 0, multiTotal);
      const multiTexts = kbMulti.inline_keyboard.flat().map((b) => b.text);

      // Assert
      expect(singleTexts).toContain('✅ اعتماد');
      expect(singleTexts).toContain('❌ استبعاد / رفض');
      expect(singleTexts).toContain('✏️ تعديل القيمة');
      expect(singleTexts).not.toContain('التالي ▶️');

      expect(multiTexts).toContain('التالي ▶️');
      expect(multiTexts).toContain('📄 1/3');
    });

    it('enforces blocked immediate payout button when pending decisions exist', () => {
      // Arrange
      const hasPending = true;
      const hasNoPending = false;

      // Act
      const kbPending = buildPayoutOptionKeyboard(hasPending);
      const pendingButtons = kbPending.inline_keyboard.flat();
      const blockedBtn = pendingButtons.find((b) => 'callback_data' in b && b.callback_data === 'action:wob:payout:immediate_blocked');

      const kbClean = buildPayoutOptionKeyboard(hasNoPending);
      const cleanButtons = kbClean.inline_keyboard.flat();
      const immediateBtn = cleanButtons.find((b) => 'callback_data' in b && b.callback_data === 'action:wob:payout:immediate');

      // Assert
      expect(blockedBtn?.text).toContain('محجوب لوجود قرارات معلقة');
      expect(immediateBtn?.text).toContain('صرف فوري نقدي');
    });

    it('builds completion keyboard complying with Section 5.2 ordering', () => {
      // Arrange
      const options = {
        whatsappUrl: 'https://wa.me/201000000000?text=test',
        isFieldAdmin: false,
      };

      // Act
      const kb = buildClearanceCompletionKeyboard(options);
      const rows = kb.inline_keyboard;

      // Assert
      expect(rows[0]?.[0]?.text).toContain('واتساب');
      expect(rows[1]?.[0]?.text).toContain('إجراء مخالصة لعامل آخر');
      expect(rows[2]?.[0]?.text).toContain('العودة لقسم شؤون العاملين');
      expect(rows[3]?.[0]?.text).toContain('القائمة الرئيسية');
      expect(rows[0]?.[0]?.text).not.toContain('الرئيسية');
    });
  });

  // ==========================================================================
  // 2. Field Admin Zero Financial Leakage Review Card
  // ==========================================================================
  describe('Field Admin Operational Card (Zero Leaks)', () => {
    it('ensures Field Admin operational card contains zero financial numbers or currency symbols', () => {
      // Arrange
      const reportData = {
        workerName: 'صابر عبد الجليل',
        workerCode: 'OP-099',
        jobTitle: 'مشغل كسارة',
        siteName: 'محجر العين السخنة',
        reason: 'RESIGNATION' as const,
        workedDays: 24,
        ppeObservations: 'تم تسليم الخوذة سليمة ويوجد كسر بنظارة الحماية',
        leaveStatusText: 'على رأس العمل',
        submitterName: 'م. حسام الدين',
      };

      // Act
      const card = formatFieldAdminReviewCard(reportData);

      // Assert
      expect(card).toContain('صابر عبد الجليل');
      expect(card).toContain('OP-099');
      expect(card).toContain('مشغل كسارة');
      expect(card).toContain('محجر العين السخنة');
      expect(card).toContain('24');
      expect(card).toContain('م. حسام الدين');
      expect(card).toContain('سيتم إرسال هذا التقرير للإدارة العليا (Super Admin)');

      // Strict Zero Financial Leaks assertions
      expect(card).not.toContain('ج.م');
      expect(card).not.toContain('EGP');
      expect(card).not.toContain('راتب');
      expect(card).not.toContain('سلفة');
      expect(card).not.toContain('صافي المستحق');
      expect(card).not.toContain('4000');
    });
  });

  // ==========================================================================
  // 3. Super Admin Full Settlement Card (#CLR-YYYY-XXX & SHA-256)
  // ==========================================================================
  describe('Super Admin Full Financial Settlement Card', () => {
    it('renders full financial card with itemized credits, debits, and SHA-256', () => {
      // Arrange
      const settlementData = {
        clearanceNumber: '#CLR-2026-0042',
        workerName: 'علي حسن عبد الله',
        workerCode: 'OP-042',
        jobTitle: 'سائق معدات ثقيلة',
        siteName: 'مشروع العلمين الجديدة',
        terminationDate: new Date('2026-09-11'),
        reason: 'CONTRACT_END' as const,
        breakdown: sampleBreakdown,
        payoutOption: 'WITH_PAYROLL' as const,
        sha256Checksum: '9a5f27c7d41f0b093e0b2e88a38a7c64d85601be264567ef481f01691234abcd',
        hasLinkedTelegram: true,
      };

      // Act
      const card = formatSuperAdminSettlementCard(settlementData);

      // Assert
      expect(card).toContain('#CLR-2026-0042');
      expect(card).toContain('علي حسن عبد الله');
      expect(card).toContain('OP-042');
      expect(card).toContain('أجر أيام العمل');
      expect(card).toContain('مكافآت وحوافز معتمدة');
      expect(card).toContain('سلف نقدية');
      expect(card).toContain('جزاءات واستقطاعات');
      expect(card).toContain('خصم عهد ومهمات');
      expect(card).toContain('صافي المستحق صرفه للعامل');
      expect(card).toContain('مجدول للصرف مع مسير الرواتب الشهري');
      expect(card).toContain('9a5f27c7d41f0b093e0b2e88a38a7c64d85601be264567ef481f01691234abcd');
      expect(card).toContain('زائر (GUEST)');
    });

    it('formats zero balance properly in settlement card', () => {
      // Arrange
      const zeroBreakdown: ClearanceFinancialBreakdown = {
        ...sampleBreakdown,
        totalCredits: 1000,
        totalDebits: 1000,
        netSettlementAmount: 0,
      };

      // Act
      const card = formatSuperAdminSettlementCard({
        clearanceNumber: '#CLR-2026-0099',
        workerName: 'سعيد محمود',
        workerCode: 'OP-99',
        reason: 'RESIGNATION',
        breakdown: zeroBreakdown,
        payoutOption: 'IMMEDIATE',
      });

      // Assert
      expect(card).toContain('الحساب مسوى بالكامل');
      expect(card).not.toContain('مديونية مستحقة على العامل');
    });
  });

  // ==========================================================================
  // 4. Red Alert Negative Balance Card
  // ==========================================================================
  describe('Red Alert Negative Balance Card', () => {
    it('displays debt amount and sovereign resolution options in negative balance card', () => {
      // Arrange
      const negBreakdown: ClearanceFinancialBreakdown = {
        ...sampleBreakdown,
        totalCredits: 2000,
        totalDebits: 3500,
        netSettlementAmount: -1500,
        isNegativeBalance: true,
      };

      // Act
      const card = formatNegativeBalanceAlertCard({
        workerName: 'سامح فوزي',
        workerCode: 'OP-077',
        jobTitle: 'حداد',
        siteName: 'محطة كهرباء البرلس',
        breakdown: negBreakdown,
      });

      // Assert
      expect(card).toContain('تنبيه مالي حرج: رصيد مخالصة سالب');
      expect(card).toContain('سامح فوزي');
      expect(card).toContain('OP-077');
      expect(card).toContain('1,500');
      expect(card).toContain('إسقاط وتراضي إداري');
      expect(card).toContain('تثبيت مديونية وإدراج بالقائمة السوداء');
    });
  });

  // ==========================================================================
  // 5. Pending Decisions Inbox & Alert Cards
  // ==========================================================================
  describe('Pending Decisions Cards & Prompts', () => {
    it('formats pending decisions card with record details', () => {
      // Arrange
      const records = [samplePendingRecord];

      // Act
      const card = formatPendingDecisionsInboxCard(records, 0, 1);

      // Assert
      expect(card).toContain('DISC-2026-001');
      expect(card).toContain('علي حسن');
      expect(card).toContain('OP-042');
      expect(card).toContain('350');
      expect(card).toContain('تأخير متكرر');
      expect(card).toContain('م. أحمد مشرف');
    });

    it('formats empty pending decisions inbox correctly', () => {
      // Arrange
      const emptyRecords: PendingDisciplinaryRecord[] = [];

      // Act
      const card = formatPendingDecisionsInboxCard(emptyRecords, 0, 0);

      // Assert
      expect(card).toContain('لا توجد أي قرارات أو جزاءات معلقة');
      expect(card).not.toContain('DISC-');
    });

    it('formats photo upload prompt message', () => {
      // Arrange
      const workerName = 'علي حسن';

      // Act
      const prompt = formatPPEDamagePhotoPrompt(workerName);

      // Assert
      expect(prompt).toContain('إرفاق صورة إثبات تلفيات');
      expect(prompt).toContain('علي حسن');
      expect(prompt).toContain('أرشفة الصورة جنائياً');
    });

    it('formats payout option prompt highlighting mandatory payroll deferral', () => {
      // Arrange
      const workerName = 'علي حسن';
      const netAmount = 2500;

      // Act
      const promptPending = formatPayoutOptionPrompt(workerName, true, netAmount);
      const promptClean = formatPayoutOptionPrompt(workerName, false, netAmount);

      // Assert
      expect(promptPending).toContain('تنبيه سيادي صارم');
      expect(promptPending).toContain('يُحظر الصرف الفوري نهائياً');
      expect(promptPending).toContain('WITH_PAYROLL');

      expect(promptClean).not.toContain('يُحظر الصرف الفوري نهائياً');
      expect(promptClean).toContain('اختر طريقة الصرف المعتمدة');
    });
  });

  // ==========================================================================
  // 6. WhatsApp Share URLs & Integration
  // ==========================================================================
  describe('WhatsApp Share URLs', () => {
    it('formats clearance WhatsApp text and generates valid URL', () => {
      // Arrange
      const clearanceData = {
        clearanceNumber: 'CLR-2026-0042',
        workerName: 'علي حسن',
        workerCode: 'OP-042',
        jobTitle: 'سائق',
        siteName: 'العلمين',
        terminationDate: new Date('2026-09-11'),
        reason: 'CONTRACT_END' as const,
        breakdown: sampleBreakdown,
        payoutOption: 'WITH_PAYROLL' as const,
        supervisorName: 'م. أحمد كمال',
      };

      // Act
      const text = formatClearanceWhatsAppText(clearanceData);
      const url = buildClearanceWhatsAppUrl('01012345678', {
        clearanceNumber: 'CLR-2026-0042',
        workerName: 'علي حسن',
        workerCode: 'OP-042',
        reason: 'CONTRACT_END',
        breakdown: sampleBreakdown,
        payoutOption: 'WITH_PAYROLL',
      });

      // Assert
      expect(text).toContain('وثيقة إخلاء طرف وتصفية حساب نهائية — #CLR-2026-0042');
      expect(text).toContain('علي حسن');
      expect(text).toContain('أجر أيام العمل');
      expect(text).toContain('صافي المستحق صرفه للعامل');
      expect(url).toContain('https://wa.me/201012345678?text=');
    });

    it('generates Super Admin WhatsApp alert URL for pending decisions', () => {
      // Arrange
      const alertData = {
        workerName: 'علي حسن',
        workerCode: 'OP-042',
        jobTitle: 'سائق',
        siteName: 'العلمين',
        records: [samplePendingRecord],
      };

      // Act
      const alertText = formatPendingDecisionsWhatsAppAlertText(alertData);
      const url = buildPendingDecisionsWhatsAppUrl('01298765432', {
        workerName: 'علي حسن',
        workerCode: 'OP-042',
        records: [samplePendingRecord],
      });

      // Assert
      expect(alertText).toContain('تنبيه إداري: معاملات وقرارات معلقة');
      expect(alertText).toContain('علي حسن');
      expect(alertText).toContain('DISC-2026-001');
      expect(url).toContain('https://wa.me/201298765432?text=');
    });
  });

  // ==========================================================================
  // 7. Backward Compatibility Functions
  // ==========================================================================
  describe('Backward Compatibility Preserved Handlers', () => {
    it('formats worker select header', () => {
      // Arrange
      const expectedSnippet = 'إنهاء خدمة عامل وإخلاء طرف';

      // Act
      const header = formatWorkerSelectHeader();

      // Assert
      expect(header).toContain(expectedSnippet);
      expect(header).toContain('اختر العامل');
    });

    it('formats reason select header', () => {
      // Arrange
      const workerName = 'أحمد';
      const code = '01';

      // Act
      const header = formatReasonSelectHeader(workerName, code);

      // Assert
      expect(header).toContain('أحمد');
      expect(header).toContain('01');
      expect(header).toContain('سبب إنهاء الخدمة');
    });

    it('formats confirmation card showing demotion impact when worker has linked telegram', () => {
      // Arrange
      const workerName = 'أحمد سعيد';
      const code = 'OP-01';
      const reason = 'RESIGNATION';

      // Act
      const card = formatConfirmationCard(workerName, code, reason, true);
      const cardNoTelegram = formatConfirmationCard(workerName, code, reason, false);

      // Assert
      expect(card).toContain('إسقاط الصلاحيات اللحظي');
      expect(card).toContain('زائر (GUEST)');

      expect(cardNoTelegram).toContain('ليس لديه حساب تليجرام');
      expect(cardNoTelegram).not.toContain('إسقاط الصلاحيات اللحظي');
    });

    it('formats success card with clearance reference ID', () => {
      // Arrange
      const workerName = 'أحمد سعيد';
      const code = 'OP-01';
      const clearanceId = 'CLR-TEST-99';

      // Act
      const card = formatSuccessCard(workerName, code, clearanceId, true);

      // Assert
      expect(card).toContain('CLR-TEST-99');
      expect(card).toContain('تم هبوط حساب التليجرام لدور زائر');
      expect(card).not.toContain('فشل');
    });

    it('formats offboarding notification text', () => {
      // Arrange
      const workerName = 'أحمد سعيد';
      const code = 'OP-01';
      const reason = 'RESIGNATION';
      const clearanceId = 'CLR-TEST-99';
      const siteName = 'موقع أ';

      // Act
      const notif = formatOffboardingNotification(workerName, code, reason, clearanceId, siteName);

      // Assert
      expect(notif).toContain('إشعار إنهاء خدمة');
      expect(notif).toContain('أحمد سعيد');
      expect(notif).toContain('موقع أ');
      expect(notif).toContain('استقالة');
    });

    it('formats hub menu header', () => {
      // Arrange
      const pendingClearances = 3;
      const pendingDecisions = 2;

      // Act
      const hub = formatHubMenuHeader(pendingClearances, pendingDecisions);

      // Assert
      expect(hub).toContain('مخالصات ميدانية معلقة: *3*');
      expect(hub).toContain('قرارات وجزاءات معلقة: *2*');
      expect(hub).not.toContain('غير محدد');
    });
  });
});
