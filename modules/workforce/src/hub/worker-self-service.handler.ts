import {
  formatBreadcrumbs,
  formatSpoiler,
  buildRichPage,
  richParagraph,
  assertRichMessage,
} from '@alsaada/core-components';
import type { WorkforceModuleContext } from '../shared/module.types.js';

const PAYSLIP_CRUMBS = ['👤 بوابة العامل', '💰 المستحقات والماليات', '🧾 قسيمة راتبي'];
const STATEMENT_CRUMBS = ['👤 بوابة العامل', '💰 المستحقات والماليات', '📊 كشف حسابي'];
const TANK_CRUMBS = ['👤 بوابة العامل', '🚜 العمليات الميدانية', 'تسجيل منسوب'];

/**
 * تحديد الشهر المحاسبي وفق قاعدة دورة الرواتب المصرية (من 26 الشهر السابق إلى 25 الشهر الحالي)
 * مع دعم التثبيت الزمني الحتمي PINNED_BASE_TIME في بيئة الاختبارات.
 */
export function resolvePayrollAccountingMonth(referenceDate?: Date): string {
  const pinnedRaw = process.env.PINNED_BASE_TIME;
  const baseDate = referenceDate ?? (pinnedRaw ? new Date(pinnedRaw) : new Date());
  const validDate = isNaN(baseDate.getTime()) ? new Date('2026-09-25T12:00:00Z') : baseDate;

  let year = validDate.getUTCFullYear();
  let month = validDate.getUTCMonth() + 1; // 1..12
  const day = validDate.getUTCDate();

  // إذا كان اليوم 26 فأكثر، تنتقل المعاملة للدورة المحاسبية للشهر التالي
  if (day >= 26) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return `${year}-${String(month).padStart(2, '0')}`;
}

export async function handleWorkerPayslipHears(
  ctx: WorkforceModuleContext,
  dbClient?: any
): Promise<void> {
  const prisma = dbClient ?? (ctx as any).prisma;
  if (!ctx.workerId) {
    const warningText =
      formatBreadcrumbs(PAYSLIP_CRUMBS) +
      '⚠️ *عذراً، حسابك غير مرتبط بملف عامل ميداني.*\n\nيرجى التواصل مع مشرف الموقع للحصول على كود الدعوة الخاص بك لربط حسابك الوظيفي.';
    const richMsg = buildRichPage({
      title: 'قسيمة راتبي',
      blocks: [richParagraph(warningText)],
    });
    assertRichMessage(richMsg);
    await ctx.reply(warningText, { parse_mode: 'Markdown' });
    return;
  }

  if (!prisma?.worker) return;

  const worker = await prisma.worker.findUnique({
    where: { id: ctx.workerId },
    select: {
      basicSalary: true,
      additionalSalary: true,
      name: true,
      jobTitle: true,
      customAllowances: { where: { isActive: true } },
      dutyRosters: { where: { status: 'PRESENT' } },
      leaves: { where: { status: 'APPROVED' } },
    },
  });

  if (!worker) return;

  const allowances = (worker.customAllowances || []).reduce(
    (acc: number, curr: any) => acc + Number(curr.amount),
    0
  );
  const presentDays = (worker.dutyRosters || []).length;
  const leaveDays = (worker.leaves || []).length;

  const maskedBasic = formatSpoiler(`${worker.basicSalary} ج.م`, 'markdown');
  const maskedAdditional = formatSpoiler(`${worker.additionalSalary} ج.م`, 'markdown');
  const maskedAllowances = formatSpoiler(`${allowances} ج.م`, 'markdown');

  const bodyText =
    formatBreadcrumbs(PAYSLIP_CRUMBS) +
    `🧾 *قسيمة راتبي*\n\n` +
    `الاسم: ${worker.name}\n` +
    `الوظيفة: ${worker.jobTitle}\n\n` +
    `الراتب الأساسي: ${maskedBasic}\n` +
    `الراتب الإضافي: ${maskedAdditional}\n` +
    `البدلات: ${maskedAllowances}\n\n` +
    `أيام الحضور: ${presentDays}\n` +
    `أيام الإجازات المعتمدة: ${leaveDays}\n\n` +
    `_سيتم دمج تفاصيل الحضور والانصراف والمكافآت فور إغلاق دورة الرواتب الشهرية._`;

  const richMsg = buildRichPage({
    title: 'قسيمة راتبي',
    blocks: [richParagraph(bodyText)],
  });
  assertRichMessage(richMsg);

  await ctx.reply(bodyText, { parse_mode: 'Markdown' });
}

export async function handleWorkerStatementHears(
  ctx: WorkforceModuleContext,
  dbClient?: any
): Promise<void> {
  const prisma = dbClient ?? (ctx as any).prisma;
  if (!ctx.workerId) {
    const warningText =
      formatBreadcrumbs(STATEMENT_CRUMBS) +
      '⚠️ *عذراً، حسابك غير مرتبط بملف عامل.*';
    const richMsg = buildRichPage({
      title: 'كشف حسابي',
      blocks: [richParagraph(warningText)],
    });
    assertRichMessage(richMsg);
    await ctx.reply(warningText, { parse_mode: 'Markdown' });
    return;
  }

  if (!prisma?.financialLedger) return;

  const currentMonth = resolvePayrollAccountingMonth();
  const ledgers = await prisma.financialLedger.findMany({
    where: {
      workerId: ctx.workerId,
      transactionType: { in: ['ADVANCE_CASH', 'WITHDRAWAL_CIGARETTES', 'WITHDRAWAL_PURCHASES'] },
      accountingMonth: currentMonth,
      isDeleted: false,
    },
  });

  const cashAdvances = (ledgers || [])
    .filter((l: any) => l.transactionType === 'ADVANCE_CASH')
    .reduce((acc: number, l: any) => acc + Number(l.amount), 0);

  const canteenWithdrawals = (ledgers || [])
    .filter(
      (l: any) =>
        l.transactionType === 'WITHDRAWAL_CIGARETTES' ||
        l.transactionType === 'WITHDRAWAL_PURCHASES'
    )
    .reduce((acc: number, l: any) => acc + Number(l.amount), 0);

  if (cashAdvances === 0 && canteenWithdrawals === 0) {
    const emptyText =
      formatBreadcrumbs(STATEMENT_CRUMBS) +
      '📊 *كشف حسابي*\n\nلا توجد سلف أو مسحوبات (كانتين/نقدي) مسجلة لك خلال الشهر الحالي.\n\n_يتم تحديث الرصيد لحظياً بعد كل عملية سحب._';
    const richMsg = buildRichPage({
      title: 'كشف حسابي',
      blocks: [richParagraph(emptyText)],
    });
    assertRichMessage(richMsg);
    await ctx.reply(emptyText, { parse_mode: 'Markdown' });
    return;
  }

  const maskedAdvances = formatSpoiler(`${cashAdvances} ج.م`, 'markdown');
  const maskedCanteen = formatSpoiler(`${canteenWithdrawals} ج.م`, 'markdown');

  const statementText =
    formatBreadcrumbs(STATEMENT_CRUMBS) +
    `📊 *كشف حسابي لشهر ${currentMonth}*\n\n` +
    `سلف نقدية: ${maskedAdvances}\n` +
    `مسحوبات (كانتين/عينية): ${maskedCanteen}\n\n` +
    `_يتم تحديث الرصيد لحظياً بعد كل عملية سحب._`;

  const richMsg = buildRichPage({
    title: `كشف حسابي لشهر ${currentMonth}`,
    blocks: [richParagraph(statementText)],
  });
  assertRichMessage(richMsg);

  await ctx.reply(statementText, { parse_mode: 'Markdown' });
}

export async function handleFieldTankLevelHears(ctx: WorkforceModuleContext): Promise<void> {
  const promptText =
    formatBreadcrumbs(TANK_CRUMBS) +
    '🚜 *تسجيل منسوب*\n\nيرجى التوجه إلى وحدة القياس بالموقع ورفع صورة واضحة لشريط القياس والمؤشر الخاص بالخزان لإتمام المطابقة الميدانية.';
  const richMsg = buildRichPage({
    title: 'تسجيل منسوب',
    blocks: [richParagraph(promptText)],
  });
  assertRichMessage(richMsg);
  await ctx.reply(promptText, { parse_mode: 'Markdown' });
}
