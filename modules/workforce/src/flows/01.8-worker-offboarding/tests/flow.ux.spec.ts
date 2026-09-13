import { describe, it, expect } from 'vitest';
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

describe('01.8 Worker Offboarding — UX & Messages Tests', () => {
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
    it('should ensure all keyboards comply with Telegram 64-byte callback limits', () => {
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

      for (const kb of keyboards) {
        for (const button of kb.inline_keyboard.flat()) {
          if ('callback_data' in button && button.callback_data) {
            const byteLen = Buffer.byteLength(button.callback_data, 'utf8');
            expect(byteLen).toBeLessThanOrEqual(64);
          }
        }
      }
    });

    it('should format worker picker buttons prioritizing nickname exclusively', () => {
      const kb = buildWorkerPickerKeyboard([
        { id: 'w-1', name: 'إبراهيم محمد حسنين', nickname: 'هيما', code: 'OP-10', jobTitle: 'سائق شاحنة' },
        { id: 'w-2', name: 'محمود عبد الفتاح', nickname: null, code: 'OP-20', jobTitle: 'عامل موقع' },
      ]);

      const buttons = kb.inline_keyboard.flat().filter((b) => 'callback_data' in b && b.callback_data?.startsWith('action:wob:pick:'));
      expect(buttons).toHaveLength(2);
      expect(buttons[0]?.text).toContain('هيما');
      expect(buttons[1]?.text).toContain('محمود عبد الفتاح');
    });

    it('should build Super Admin Hub keyboard with accurate pending counts', () => {
      const kb = buildSuperAdminHubKeyboard(7, 4);
      const texts = kb.inline_keyboard.flat().map((b) => b.text);

      expect(texts.some((t) => t.includes('اعتماد المخالصات الميدانية المعلقة (7)'))).toBe(true);
      expect(texts.some((t) => t.includes('صندوق القرارات المعلقة (4)'))).toBe(true);
      expect(texts.some((t) => t.includes('تسجيل إنهاء خدمة لعامل جديد'))).toBe(true);
    });

    it('should build Pending Decisions Inbox keyboard with record actions and pagination', () => {
      const kbSingle = buildPendingDecisionsInboxKeyboard([samplePendingRecord], 0, 1);
      const singleTexts = kbSingle.inline_keyboard.flat().map((b) => b.text);
      expect(singleTexts).toContain('✅ اعتماد');
      expect(singleTexts).toContain('❌ استبعاد / رفض');
      expect(singleTexts).toContain('✏️ تعديل القيمة');
      expect(singleTexts.some((t) => t.includes('التالي'))).toBe(false);

      const kbMulti = buildPendingDecisionsInboxKeyboard([samplePendingRecord], 0, 3);
      const multiTexts = kbMulti.inline_keyboard.flat().map((b) => b.text);
      expect(multiTexts.some((t) => t.includes('التالي ▶️'))).toBe(true);
      expect(multiTexts.some((t) => t.includes('1/3'))).toBe(true);
    });

    it('should enforce blocked immediate payout button when pending decisions exist', () => {
      const kbPending = buildPayoutOptionKeyboard(true);
      const pendingButtons = kbPending.inline_keyboard.flat();
      const blockedBtn = pendingButtons.find((b) => 'callback_data' in b && b.callback_data === 'action:wob:payout:immediate_blocked');
      expect(blockedBtn).toBeDefined();
      expect(blockedBtn?.text).toContain('محجوب لوجود قرارات معلقة');

      const kbClean = buildPayoutOptionKeyboard(false);
      const cleanButtons = kbClean.inline_keyboard.flat();
      const immediateBtn = cleanButtons.find((b) => 'callback_data' in b && b.callback_data === 'action:wob:payout:immediate');
      expect(immediateBtn).toBeDefined();
      expect(immediateBtn?.text).toContain('صرف فوري نقدي');
    });

    it('should build completion keyboard complying with Section 5.2 ordering', () => {
      const kb = buildClearanceCompletionKeyboard({
        whatsappUrl: 'https://wa.me/201000000000?text=test',
        isFieldAdmin: false,
      });

      const rows = kb.inline_keyboard;
      expect(rows[0]?.[0]?.text).toContain('واتساب');
      expect(rows[1]?.[0]?.text).toContain('إجراء مخالصة لعامل آخر');
      expect(rows[2]?.[0]?.text).toContain('العودة لقسم شؤون العاملين');
      expect(rows[3]?.[0]?.text).toContain('القائمة الرئيسية');
    });
  });

  // ==========================================================================
  // 2. Field Admin Zero Financial Leakage Review Card
  // ==========================================================================
  describe('Field Admin Operational Card (Zero Leaks)', () => {
    it('should strictly contain zero financial numbers or currency symbols', () => {
      const card = formatFieldAdminReviewCard({
        workerName: 'صابر عبد الجليل',
        workerCode: 'OP-099',
        jobTitle: 'مشغل كسارة',
        siteName: 'محجر العين السخنة',
        reason: 'RESIGNATION',
        workedDays: 24,
        ppeObservations: 'تم تسليم الخوذة سليمة ويوجد كسر بنظارة الحماية',
        leaveStatusText: 'على رأس العمل',
        submitterName: 'م. حسام الدين',
      });

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
    it('should render full financial card with itemized credits, debits, and SHA-256', () => {
      const card = formatSuperAdminSettlementCard({
        clearanceNumber: '#CLR-2026-0042',
        workerName: 'علي حسن عبد الله',
        workerCode: 'OP-042',
        jobTitle: 'سائق معدات ثقيلة',
        siteName: 'مشروع العلمين الجديدة',
        terminationDate: new Date('2026-09-11'),
        reason: 'CONTRACT_END',
        breakdown: sampleBreakdown,
        payoutOption: 'WITH_PAYROLL',
        sha256Checksum: '9a5f27c7d41f0b093e0b2e88a38a7c64d85601be264567ef481f01691234abcd',
        hasLinkedTelegram: true,
      });

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

    it('should format zero balance properly in settlement card', () => {
      const zeroBreakdown: ClearanceFinancialBreakdown = {
        ...sampleBreakdown,
        totalCredits: 1000,
        totalDebits: 1000,
        netSettlementAmount: 0,
      };

      const card = formatSuperAdminSettlementCard({
        clearanceNumber: '#CLR-2026-0099',
        workerName: 'سعيد محمود',
        workerCode: 'OP-99',
        reason: 'RESIGNATION',
        breakdown: zeroBreakdown,
        payoutOption: 'IMMEDIATE',
      });

      expect(card).toContain('الحساب مسوى بالكامل');
    });
  });

  // ==========================================================================
  // 4. Red Alert Negative Balance Card
  // ==========================================================================
  describe('Red Alert Negative Balance Card', () => {
    it('should display debt amount and sovereign resolution options', () => {
      const negBreakdown: ClearanceFinancialBreakdown = {
        ...sampleBreakdown,
        totalCredits: 2000,
        totalDebits: 3500,
        netSettlementAmount: -1500,
        isNegativeBalance: true,
      };

      const card = formatNegativeBalanceAlertCard({
        workerName: 'سامح فوزي',
        workerCode: 'OP-077',
        jobTitle: 'حداد',
        siteName: 'محطة كهرباء البرلس',
        breakdown: negBreakdown,
      });

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
    it('should format pending decisions card with record details', () => {
      const card = formatPendingDecisionsInboxCard([samplePendingRecord], 0, 1);
      expect(card).toContain('DISC-2026-001');
      expect(card).toContain('علي حسن');
      expect(card).toContain('OP-042');
      expect(card).toContain('350');
      expect(card).toContain('تأخير متكرر');
      expect(card).toContain('م. أحمد مشرف');
    });

    it('should format empty pending decisions inbox', () => {
      const card = formatPendingDecisionsInboxCard([], 0, 0);
      expect(card).toContain('لا توجد أي قرارات أو جزاءات معلقة');
    });

    it('should format photo upload prompt message', () => {
      const prompt = formatPPEDamagePhotoPrompt('علي حسن');
      expect(prompt).toContain('إرفاق صورة إثبات تلفيات');
      expect(prompt).toContain('علي حسن');
      expect(prompt).toContain('أرشفة الصورة جنائياً');
    });

    it('should format payout option prompt highlighting mandatory payroll deferral', () => {
      const promptPending = formatPayoutOptionPrompt('علي حسن', true, 2500);
      expect(promptPending).toContain('تنبيه سيادي صارم');
      expect(promptPending).toContain('يُحظر الصرف الفوري نهائياً');
      expect(promptPending).toContain('WITH_PAYROLL');

      const promptClean = formatPayoutOptionPrompt('علي حسن', false, 2500);
      expect(promptClean).not.toContain('يُحظر الصرف الفوري نهائياً');
      expect(promptClean).toContain('اختر طريقة الصرف المعتمدة');
    });
  });

  // ==========================================================================
  // 6. WhatsApp Share URLs & Integration
  // ==========================================================================
  describe('WhatsApp Share URLs', () => {
    it('should format clearance WhatsApp text and generate valid URL', () => {
      const text = formatClearanceWhatsAppText({
        clearanceNumber: 'CLR-2026-0042',
        workerName: 'علي حسن',
        workerCode: 'OP-042',
        jobTitle: 'سائق',
        siteName: 'العلمين',
        terminationDate: new Date('2026-09-11'),
        reason: 'CONTRACT_END',
        breakdown: sampleBreakdown,
        payoutOption: 'WITH_PAYROLL',
        supervisorName: 'م. أحمد كمال',
      });

      expect(text).toContain('وثيقة إخلاء طرف وتصفية حساب نهائية — #CLR-2026-0042');
      expect(text).toContain('علي حسن');
      expect(text).toContain('أجر أيام العمل');
      expect(text).toContain('صافي المستحق صرفه للعامل');

      const url = buildClearanceWhatsAppUrl('01012345678', {
        clearanceNumber: 'CLR-2026-0042',
        workerName: 'علي حسن',
        workerCode: 'OP-042',
        reason: 'CONTRACT_END',
        breakdown: sampleBreakdown,
        payoutOption: 'WITH_PAYROLL',
      });

      expect(url).toBeDefined();
      expect(url).toContain('https://wa.me/201012345678?text=');
    });

    it('should generate Super Admin WhatsApp alert URL for pending decisions', () => {
      const alertText = formatPendingDecisionsWhatsAppAlertText({
        workerName: 'علي حسن',
        workerCode: 'OP-042',
        jobTitle: 'سائق',
        siteName: 'العلمين',
        records: [samplePendingRecord],
      });

      expect(alertText).toContain('تنبيه إداري: معاملات وقرارات معلقة');
      expect(alertText).toContain('علي حسن');
      expect(alertText).toContain('DISC-2026-001');

      const url = buildPendingDecisionsWhatsAppUrl('01298765432', {
        workerName: 'علي حسن',
        workerCode: 'OP-042',
        records: [samplePendingRecord],
      });

      expect(url).toBeDefined();
      expect(url).toContain('https://wa.me/201298765432?text=');
    });
  });

  // ==========================================================================
  // 7. Backward Compatibility Functions
  // ==========================================================================
  describe('Backward Compatibility Preserved Handlers', () => {
    it('should format worker select header', () => {
      const header = formatWorkerSelectHeader();
      expect(header).toContain('إنهاء خدمة عامل وإخلاء طرف');
    });

    it('should format reason select header', () => {
      const header = formatReasonSelectHeader('أحمد', '01');
      expect(header).toContain('أحمد');
      expect(header).toContain('01');
    });

    it('should format confirmation card showing demotion impact when worker has linked telegram', () => {
      const card = formatConfirmationCard('أحمد سعيد', 'OP-01', 'RESIGNATION', true);
      expect(card).toContain('إسقاط الصلاحيات اللحظي');
      expect(card).toContain('زائر (GUEST)');

      const cardNoTelegram = formatConfirmationCard('أحمد سعيد', 'OP-01', 'RESIGNATION', false);
      expect(cardNoTelegram).toContain('ليس لديه حساب تليجرام');
    });

    it('should format success card with clearance reference ID', () => {
      const card = formatSuccessCard('أحمد سعيد', 'OP-01', 'CLR-TEST-99', true);
      expect(card).toContain('CLR-TEST-99');
      expect(card).toContain('تم هبوط حساب التليجرام لدور زائر');
    });

    it('should format offboarding notification text', () => {
      const notif = formatOffboardingNotification('أحمد سعيد', 'OP-01', 'RESIGNATION', 'CLR-TEST-99', 'موقع أ');
      expect(notif).toContain('إشعار إنهاء خدمة');
      expect(notif).toContain('أحمد سعيد');
      expect(notif).toContain('موقع أ');
    });

    it('should format hub menu header', () => {
      const hub = formatHubMenuHeader(3, 2);
      expect(hub).toContain('مخالصات ميدانية معلقة: *3*');
      expect(hub).toContain('قرارات وجزاءات معلقة: *2*');
    });
  });
});
