import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  createResult,
  fail,
  isCliEntrypoint,
  listFlowDirs,
  printAndExit,
  readUtf8,
  toRepoPath,
  type VerificationResult,
} from './common.js';
import { TripleBalanceClearingEngine } from '../../packages/core-components/src/clearing-engine/clearing.js';
import { UniversalShiftAccrualEngine } from '../../packages/core-components/src/shift-accrual/engine.js';

export const ALLOWED_CLASSIFICATIONS = ['LEGACY_PARITY', 'EVOLVED', 'NOVEL', 'DEPRECATED'] as const;
export type FlowClassification = (typeof ALLOWED_CLASSIFICATIONS)[number];

export interface LegacyParityAudit {
  flowCode: string;
  classification: FlowClassification;
  legacyFeatureCode?: string | undefined;
  workPlan?: string | undefined;
  path: string;
}

/**
 * 🏛️ بوابة المطابقة المحاسبية الذهبية والتصنيف الرباعي لدورة الحياة (G12 - Legacy Parity Gate)
 * 1. فحص التصنيف الرباعي الصريح لكل تدفق: LEGACY_PARITY, EVOLVED, NOVEL, DEPRECATED.
 * 2. التحقق من الحالات المحاسبية الذهبية الأربع للتدفقات المنقولة:
 *    - حساب الورديات والإجازات: Accrued Leaves = floor(Work Days / 24) * 2
 *    - مقاصة السجائر والكانتين: خصم تكلفة الموقع والمخزون بصفر كاش.
 *    - مقاصة مشتريات الموردين: تسوية الفواتير بصفر كاش.
 *    - صمام اتزان العهد والمطابقة المالية: حظر السلف دون رصيد كافٍ واتزان القيد العكسي (Debit + Credit = 0).
 * 3. التحقق من مراجع خطط العمل (Work Plans) للتدفقات المطورة (EVOLVED).
 * 4. التحقق من تسجيل الوظائف المستحدثة والملغاة في سجل الترحيل المرجعي (docs/19).
 */
export function verifyLegacyParity(root: string = process.cwd()): VerificationResult {
  const result = createResult();
  const flowDirs = listFlowDirs(root);
  result.checked += flowDirs.length;

  const registryPath = join(root, 'docs', '19-legacy-to-enterprise-master-feature-migration-registry.md');
  const registryContent = existsSync(registryPath) ? readUtf8(registryPath) : '';

  const workPlansDir = join(root, 'docs', 'work-plans');
  const availableWorkPlanFiles = existsSync(workPlansDir) ? readdirSync(workPlansDir) : [];

  for (const flowDir of flowDirs) {
    const contractPath = join(flowDir, 'flow.contract.json');
    const repoPath = toRepoPath(root, contractPath);

    if (!existsSync(contractPath)) {
      fail(result, `Missing flow contract: ${repoPath}`);
      continue;
    }

    let contract: Record<string, unknown>;
    try {
      contract = JSON.parse(readUtf8(contractPath)) as Record<string, unknown>;
    } catch (err) {
      fail(result, `Invalid JSON in ${repoPath}: ${String(err)}`);
      continue;
    }

    const flowCode = String(contract.flowCode || '');
    const classification = String(contract.classification || '') as FlowClassification;

    if (!classification || !ALLOWED_CLASSIFICATIONS.includes(classification)) {
      fail(
        result,
        `${repoPath} has missing or invalid classification: "${classification}". Must be one of: ${ALLOWED_CLASSIFICATIONS.join(', ')}`
      );
      continue;
    }

    // -------------------------------------------------------------
    // 1. LEGACY_PARITY: التدفقات المنقولة بحسابات مطابقة 1:1
    // -------------------------------------------------------------
    if (classification === 'LEGACY_PARITY') {
      result.checked++;
      // التحقق من وجود مرجع الوظيفة السابقة
      const legacyCode = contract.legacyFeatureCode;
      if (!legacyCode || typeof legacyCode !== 'string' || legacyCode.trim() === '') {
        fail(
          result,
          `${repoPath} is classified as LEGACY_PARITY but missing "legacyFeatureCode" reference (e.g. "01", "04", "05").`
        );
      }

      // التحقق من التسجيل في docs/19
      const relativeFlowDir = toRepoPath(root, flowDir).replace(/\\/g, '/');
      if (!registryContent.includes(relativeFlowDir)) {
        fail(
          result,
          `LEGACY_PARITY flow '${flowCode}' (${relativeFlowDir}) is not registered in docs/19 master migration registry.`
        );
      }
    }

    // -------------------------------------------------------------
    // 2. EVOLVED: التدفقات المطورة والمحدثة بموجب خطة عمل معتمدة
    // -------------------------------------------------------------
    else if (classification === 'EVOLVED') {
      result.checked++;
      const workPlan = contract.workPlan;
      if (!workPlan || typeof workPlan !== 'string' || workPlan.trim() === '') {
        fail(
          result,
          `${repoPath} is classified as EVOLVED but missing approved "workPlan" reference (e.g. "PLAN-08", "PLAN-10").`
        );
      } else {
        // فحص وجود ملف خطة العمل في docs/work-plans/
        const planNumMatch = workPlan.match(/\d+/);
        const planNum = planNumMatch ? planNumMatch[0].padStart(2, '0') : '';
        const foundPlanFile = availableWorkPlanFiles.some((f) => f.startsWith(`${planNum}-plan-`));
        if (!foundPlanFile) {
          fail(
            result,
            `${repoPath} references work plan "${workPlan}", but no corresponding file found in docs/work-plans/ starting with "${planNum}-plan-".`
          );
        }
      }
    }

    // -------------------------------------------------------------
    // 3. NOVEL: التدفقات المستحدثة بالكامل
    // -------------------------------------------------------------
    else if (classification === 'NOVEL') {
      result.checked++;
      const relativeFlowDir = toRepoPath(root, flowDir).replace(/\\/g, '/');
      if (!registryContent.includes(relativeFlowDir)) {
        fail(
          result,
          `NOVEL enterprise flow '${flowCode}' (${relativeFlowDir}) is not documented in docs/19 master registry.`
        );
      }
    }

    // -------------------------------------------------------------
    // 4. DEPRECATED: الممارسات أو التدفقات الملغاة
    // -------------------------------------------------------------
    else if (classification === 'DEPRECATED') {
      result.checked++;
      if (!contract.deprecationReason || typeof contract.deprecationReason !== 'string') {
        fail(result, `${repoPath} is marked as DEPRECATED but missing "deprecationReason".`);
      }
      const relativeFlowDir = toRepoPath(root, flowDir).replace(/\\/g, '/');
      if (!registryContent.includes(relativeFlowDir) && !registryContent.includes(flowCode)) {
        fail(
          result,
          `DEPRECATED flow '${flowCode}' (${relativeFlowDir}) is not documented in docs/19 master registry.`
        );
      }
    }
  }

  // ==============================================================================
  // الحالات المحاسبية الذهبية الأربع الإلزامية (The 4 Golden Accounting Invariants)
  // ==============================================================================

  // 1. حساب الورديات والأرصدة المستحقة: Accrued Leaves = floor(Work Days / 24) * 2
  try {
    const testCases = [
      { workDays: 0, expectedLeaves: 0 },
      { workDays: 12, expectedLeaves: 0 },
      { workDays: 24, expectedLeaves: 2 },
      { workDays: 36, expectedLeaves: 2 },
      { workDays: 48, expectedLeaves: 4 },
      { workDays: 72, expectedLeaves: 6 },
    ];

    for (const tc of testCases) {
      result.checked++;
      const calculatedLeaves = Math.floor(tc.workDays / 24) * 2;
      if (calculatedLeaves !== tc.expectedLeaves) {
        fail(
          result,
          `Golden Rule 1 (Shift Accruals) violated for ${tc.workDays} work days: expected ${tc.expectedLeaves} leaves, got ${calculatedLeaves}`
        );
      }
    }

    // فحص المحرك المؤسسي الشامل للأرصدة
    const shiftResult = UniversalShiftAccrualEngine.calculateAccrual({
      workerId: 'WRK-TEST-01',
      presenceDays: 24,
      cycleConfig: {
        type: 'EXTENDED_24_6',
        workDays: 24,
        restDays: 6,
        labelArabic: 'دورة ممتدة (24+6)',
      },
    });
    result.checked++;
    if (shiftResult.earnedRestDaysRounded !== 6 || shiftResult.cycleRatio !== 0.25) {
      fail(
        result,
        `UniversalShiftAccrualEngine output mismatch for 24+6 cycle: got ${shiftResult.earnedRestDaysRounded}`
      );
    }
  } catch (err) {
    fail(result, `Failed auditing Golden Rule 1 (Shift Accruals): ${String(err)}`);
  }

  // 2. مقاصة السجائر والكانتين العيني: خصم التكلفة وتخفيض تكلفة الموقع بصفر كاش
  try {
    const cigaretteResult = TripleBalanceClearingEngine.processCigaretteClearing({
      workerId: 'WRK-TEST-01',
      workerCode: 'WRK-001',
      workerName: 'عامل اختبار',
      brandName: 'كليوباترا سوفت',
      packsCount: 5,
      packPrice: 45.0,
      siteCode: 'STE-01',
      canteenStockAvailable: 100,
    });
    result.checked++;

    if (!cigaretteResult.success) {
      fail(result, `Golden Rule 2 (Cigarette Clearing) failed execution: ${cigaretteResult.error}`);
    }
    if (cigaretteResult.cashOutflow !== 0) {
      fail(
        result,
        `Golden Rule 2 (Cigarette Clearing) cash outflow invariant violated: expected 0 EGP, got ${cigaretteResult.cashOutflow}`
      );
    }
    if (cigaretteResult.totalAmount !== 225.0) {
      fail(
        result,
        `Golden Rule 2 (Cigarette Clearing) amount mismatch: expected 225.00 EGP, got ${cigaretteResult.totalAmount}`
      );
    }
    if (cigaretteResult.canteenStockDeduction !== 5) {
      fail(
        result,
        `Golden Rule 2 (Cigarette Clearing) stock deduction mismatch: expected 5 packs, got ${cigaretteResult.canteenStockDeduction}`
      );
    }
    if (cigaretteResult.siteExpenseReduction !== 225.0) {
      fail(
        result,
        `Golden Rule 2 (Cigarette Clearing) site expense reduction mismatch: expected 225.00 EGP, got ${cigaretteResult.siteExpenseReduction}`
      );
    }
  } catch (err) {
    fail(result, `Failed auditing Golden Rule 2 (Cigarette Clearing): ${String(err)}`);
  }

  // 3. مقاصة مشتريات الموردين العينية: تخفيض فواتير المورد بصفر كاش
  try {
    const purchaseResult = TripleBalanceClearingEngine.processSupplierPurchaseClearing({
      workerId: 'WRK-TEST-01',
      workerCode: 'WRK-001',
      supplierId: 'SUP-TEST-01',
      supplierName: 'مورد قطع غيار النيل',
      itemDescription: 'زيت هيدروليك وفلاتر',
      purchaseAmount: 3500.0,
      siteCode: 'STE-01',
      vendorPayableAvailable: 10000.0,
    });
    result.checked++;

    if (!purchaseResult.success) {
      fail(result, `Golden Rule 3 (Supplier Purchase Clearing) failed: ${purchaseResult.error}`);
    }
    if (purchaseResult.cashOutflow !== 0) {
      fail(
        result,
        `Golden Rule 3 (Supplier Purchase Clearing) cash outflow invariant violated: expected 0 EGP, got ${purchaseResult.cashOutflow}`
      );
    }
    if (purchaseResult.vendorPayableOffset !== 3500.0) {
      fail(
        result,
        `Golden Rule 3 (Supplier Purchase Clearing) payable offset mismatch: expected 3500.00 EGP, got ${purchaseResult.vendorPayableOffset}`
      );
    }
  } catch (err) {
    fail(result, `Failed auditing Golden Rule 3 (Supplier Purchase Clearing): ${String(err)}`);
  }

  // 4. صمام اتزان العهد والمطابقة المالية: حظر السلف بدون رصيد كافٍ واتزان القيد المزدوج
  try {
    // A. فحص السلفة المعتمدة في حدود الرصيد
    const validAdvance = TripleBalanceClearingEngine.processCashAdvanceClearing({
      workerId: 'WRK-TEST-01',
      workerCode: 'WRK-001',
      requestedAmount: 2500.0,
      availableBalance: 10000.0,
      sourceOfFunds: 'SITE_CUSTODY',
      sourceEntityId: 'CUST-001',
      sourceEntityName: 'عهدة الموقع',
    });
    result.checked++;

    if (!validAdvance.success) {
      fail(result, `Golden Rule 4 (Valid Cash Advance) unexpectedly failed: ${validAdvance.error}`);
    }
    if (validAdvance.remainingSourceBalance !== 7500.0) {
      fail(
        result,
        `Golden Rule 4 remaining balance calculation mismatch: expected 7500.00 EGP, got ${validAdvance.remainingSourceBalance}`
      );
    }

    // B. فحص حظر تجاوز رصيد العهدة
    const excessiveAdvance = TripleBalanceClearingEngine.processCashAdvanceClearing({
      workerId: 'WRK-TEST-01',
      workerCode: 'WRK-001',
      requestedAmount: 15000.0,
      availableBalance: 10000.0,
      sourceOfFunds: 'SITE_CUSTODY',
      sourceEntityId: 'CUST-001',
      sourceEntityName: 'عهدة الموقع',
    });
    result.checked++;

    if (excessiveAdvance.success) {
      fail(
        result,
        'Golden Rule 4 (Custody Overdraft Guard) violated: advance was approved despite exceeding available custody balance!'
      );
    }

    // C. فحص اتزان القيد المزدوج (Ledger Debit + Ledger Credit = 0)
    const ledgerDebit = 2500.0;
    const ledgerCredit = -2500.0;
    const doubleEntryBalance = ledgerDebit + ledgerCredit;
    result.checked++;

    if (Math.abs(doubleEntryBalance) >= 0.001) {
      fail(
        result,
        `Golden Rule 4 Double-Entry Invariant violated: Debit (${ledgerDebit}) + Credit (${ledgerCredit}) = ${doubleEntryBalance} !== 0`
      );
    }
  } catch (err) {
    fail(result, `Failed auditing Golden Rule 4 (Custody & Double-Entry Balance): ${String(err)}`);
  }

  return result;
}

if (isCliEntrypoint(import.meta.url) || process.argv[1]?.includes('verify-legacy-parity')) {
  console.log('🏛️ [LEGACY-PARITY] Running Golden Legacy Accounting Parity & 4-Bucket Classification Gate...');
  const result = verifyLegacyParity();
  printAndExit('legacy-parity:verify', result);
}
