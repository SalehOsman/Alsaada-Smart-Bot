import { createResult, fail, warn, printAndExit, isCliEntrypoint, type VerificationResult } from './common.js';
import { verifyLedgerChainDb } from '../../packages/database/src/ledger/verify-ledger-chain.js';
import {
  computeTransactionHash,
  verifyLedgerChainMemory,
  GENESIS_HASH,
  type ChainedRecord,
} from '../../packages/database/src/ledger/hash-chain.js';
import {
  getTestDatabaseUrl,
  isPortOpen,
  setupTestDatabase,
  DEFAULT_POSTGRES_HOST,
  DEFAULT_POSTGRES_PORT,
} from '../../scripts/test-db-setup.js';

export const PROTECTED_FINANCIAL_MODELS = [
  'FinancialLedger',
  'SupplierPayment',
  'CustodyExpenseItem',
  'CustodySettlement',
  'HospitalityExpense',
  'WorkerExpenseClaim',
] as const;

export interface FinancialIntegrityOptions {
  prisma?: any;
  minChecked?: number;
}

export async function ensureFinancialTestFixtures(client: any): Promise<void> {
  const existingCustody = await client.financialCustody.findFirst({
    where: { custodyNumber: 'CUST-GOV-2026-001' },
  });
  if (existingCustody) {
    return;
  }

  console.log('🌱 [FINANCIAL-INTEGRITY] Seeding live isolated test fixtures (>50 chained records)...');

  // 1. Master entities: Tenant, Project, Site, Worker, Supplier
  const tenant = await client.tenant.upsert({
    where: { code: 'TENANT_GOV_TEST' },
    update: {},
    create: {
      code: 'TENANT_GOV_TEST',
      name: 'شركة السعادة للتعدين - بيئة التحقق المالي',
    },
  });

  const project = await client.project.upsert({
    where: { code: 'PRJ_GOV_TEST_01' },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'PRJ_GOV_TEST_01',
      name: 'مشروع التحقق المؤسسي للنزاهة المالية',
    },
  });

  const site = await client.site.upsert({
    where: { code: 'STE_GOV_TEST_01' },
    update: {},
    create: {
      projectId: project.id,
      code: 'STE_GOV_TEST_01',
      name: 'موقع الاختبارات الحية المالي',
    },
  });

  const worker = await client.worker.upsert({
    where: { code: 'WRK-GOV-TEST-01' },
    update: {},
    create: {
      tenantId: tenant.id,
      siteId: site.id,
      code: 'WRK-GOV-TEST-01',
      name: 'عامل اختبار مالي 1',
      birthDate: new Date('1990-01-01'),
      gender: 'MALE',
      jobTitle: 'سائق لودر',
      dailyWage: 300.0,
      contractType: 'PERMANENT',
    },
  });

  const supplier = await client.supplier.upsert({
    where: { code: 'SUP-GOV-TEST-01' },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'SUP-GOV-TEST-01',
      name: 'مورد اختبار مالي 1',
      category: 'SPARE_PARTS',
    },
  });

  // 2. Custodies:
  // A. Active balanced custody:
  // initialAmount: 100,000 | liquidated: 20,000 | advances: 30,000 | currentBalance: 50,000
  // Invariant: 100,000 - 20,000 - 30,000 = 50,000 (Delta = 0.0000)
  const activeCustody = await client.financialCustody.upsert({
    where: { custodyNumber: 'CUST-GOV-2026-001' },
    update: {},
    create: {
      siteId: site.id,
      custodianWorkerId: worker.id,
      custodyNumber: 'CUST-GOV-2026-001',
      initialAmount: 100000.0,
      currentBalance: 50000.0,
      totalLiquidatedExpenses: 20000.0,
      totalCashAdvancesDisbursed: 30000.0,
      purpose: 'عهدة الموقع للمصروفات والسلف الميدانية',
      status: 'ACTIVE',
    },
  });

  // B. Closed balanced custody:
  // initialAmount: 50,000 | liquidated: 50,000 | advances: 0 | currentBalance: 0
  const closedCustody = await client.financialCustody.upsert({
    where: { custodyNumber: 'CUST-GOV-2026-002' },
    update: {},
    create: {
      siteId: site.id,
      custodianWorkerId: worker.id,
      custodyNumber: 'CUST-GOV-2026-002',
      initialAmount: 50000.0,
      currentBalance: 0.0,
      totalLiquidatedExpenses: 50000.0,
      totalCashAdvancesDisbursed: 0.0,
      purpose: 'عهدة سابقة مغلقة ومسواة بالكامل',
      status: 'CLOSED',
      closedAt: new Date(Date.now() - 86400000),
    },
  });

  // 3. Seed 10 CustodyExpenseItems
  for (let i = 1; i <= 10; i++) {
    await client.custodyExpenseItem.create({
      data: {
        custodyId: activeCustody.id,
        itemSequence: i,
        expenseCategory: 'SPARE_PARTS',
        amount: 2000.0,
        vendorName: `محل قطع غيار ${i}`,
        receiptDate: new Date(),
        description: `شراء مستلزمات وصيانة دورية رقم ${i}`,
      },
    });
  }

  // 4. Seed 10 FinancialLedger entries
  for (let i = 1; i <= 8; i++) {
    await client.financialLedger.create({
      data: {
        voucherNumber: `#ADV-GOV-2026-${String(i).padStart(4, '0')}`,
        transactionType: 'ADVANCE_CASH',
        amount: 3750.0,
        sourceAccount: 'CUSTODY_SAFE',
        destinationAccount: 'WORKER_PAYABLE',
        sourceCustodyId: activeCustody.id,
        workerId: worker.id,
        actorTelegramId: 7594239391n,
        description: `صرف سلفة نقدية ميدانية للعامل رقم ${i}`,
      },
    });
  }

  const origVoucher = '#ADV-GOV-ORIGINAL-01';
  await client.financialLedger.create({
    data: {
      voucherNumber: origVoucher,
      transactionType: 'GENERAL_EXPENSE',
      amount: 1500.0,
      sourceAccount: 'BANK_ACCOUNT',
      destinationAccount: 'SITE_EXPENSE',
      actorTelegramId: 7594239391n,
      description: 'سند مصروفات تشغيلية أصلي',
    },
  });

  await client.financialLedger.create({
    data: {
      voucherNumber: '#ADV-GOV-REVERSAL-01',
      transactionType: 'GENERAL_EXPENSE',
      amount: -1500.0,
      sourceAccount: 'SITE_EXPENSE',
      destinationAccount: 'BANK_ACCOUNT',
      isReversal: true,
      reversalOfVoucherId: origVoucher,
      actorTelegramId: 7594239391n,
      description: 'سند قيد عكسي لإلغاء السند الأصلي',
    },
  });

  // 5. Seed 10 SupplierPayment records
  for (let i = 1; i <= 10; i++) {
    await client.supplierPayment.create({
      data: {
        paymentNumber: `#SPAY-GOV-2026-${String(i).padStart(4, '0')}`,
        supplierId: supplier.id,
        amount: 5000.0,
        paymentMethod: 'CASH_CUSTODY',
        disbursedFromCustodyId: activeCustody.id,
        paymentDate: new Date(),
      },
    });
  }

  // 6. Seed 10 HospitalityExpense records
  for (let i = 1; i <= 10; i++) {
    await client.hospitalityExpense.create({
      data: {
        voucherId: `#HOSP-GOV-2026-${String(i).padStart(4, '0')}`,
        siteId: site.id,
        amount: 250.0,
        guestNameOrEntity: `وفد تفتيش ميداني ${i}`,
        occasion: 'ضيافة وفد إشرافي رسمي',
        sourceCustodyId: activeCustody.id,
      },
    });
  }

  // 7. Seed 5 CustodySettlement records
  for (let i = 1; i <= 5; i++) {
    await client.custodySettlement.create({
      data: {
        settlementNumber: `#SET-GOV-2026-${String(i).padStart(4, '0')}`,
        custodyId: closedCustody.id,
        closingTotalInvoices: 50000.0,
        closingTotalAdvances: 0.0,
        remainingCashReturned: 0.0,
        settlementDisposition: 'REFUND_TO_TREASURY',
        status: 'APPROVED',
      },
    });
  }

  // 8. Seed 5 WorkerExpenseClaim records
  for (let i = 1; i <= 5; i++) {
    await client.workerExpenseClaim.create({
      data: {
        claimNumber: `#CLM-GOV-2026-${String(i).padStart(4, '0')}`,
        tenantId: tenant.id,
        workerId: worker.id,
        siteId: site.id,
        amount: 800.0,
        expenseCategory: 'FUEL',
        description: `شراء وقود طوارئ للموقع للمعدة ${i}`,
        status: 'SETTLED',
        settlementType: 'FIELD_CUSTODY',
        settlementCustodyId: activeCustody.id,
      },
    });
  }

  console.log('✅ [FINANCIAL-INTEGRITY] Test fixtures successfully seeded and chained.');
}

/**
 * 🏛️ بوابة النزاهة المالية والحوكمة المحاسبية (G13 - Enterprise Financial Integrity Gate)
 * 1. التحقق من سلامة السلاسل التشفيرية (HMAC-SHA256 Hash Chain) للنماذج المالية الستة.
 * 2. التحقق من معادلة اتزان العهد النقدية ومنع الأرصدة السالبة.
 * 3. التحقق من ربط السلف النقدية (ADVANCE_CASH) بعهدة موقع صالحة ومفتوحة.
 * 4. التحقق من ترابط قيود التسوية والقيود العكسية (isReversal) بسند أصلي صحيح وموجود.
 * 5. فحص قدرة المنظومة التشفيرية على اكتشاف التلاعب بالسجلات وحساباتها فورياً.
 */
export async function verifyFinancialIntegrity(
  options: FinancialIntegrityOptions = {}
): Promise<VerificationResult> {
  const result = createResult();
  let client = options.prisma;

  if (!client) {
    try {
      const isLive = await isPortOpen(DEFAULT_POSTGRES_HOST, DEFAULT_POSTGRES_PORT);
      if (isLive) {
        const testDbUrl = getTestDatabaseUrl();
        const { createExtendedPrismaClient } = await import('../../packages/database/src/client.js');
        client = createExtendedPrismaClient({
          datasources: {
            db: { url: testDbUrl },
          },
        });
        await ensureFinancialTestFixtures(client);
      } else {
        const dbModule = await import('../../packages/database/src/client.js');
        client = dbModule.prisma;
      }
    } catch (err) {
      fail(result, `Failed to load Prisma database client: ${String(err)}`);
      return result;
    }
  }

  // 1. فحص السلاسل التشفيرية لكافة النماذج المالية الستة
  for (const model of PROTECTED_FINANCIAL_MODELS) {
    try {
      const report = await verifyLedgerChainDb(client, { model });
      result.checked += Math.max(1, report.totalVerified);
      if (!report.isValid) {
        fail(
          result,
          `Cryptographic hash chain broken in model '${model}' at record '${report.brokenRecordId ?? 'unknown'}': ${report.error ?? 'tampered hash'}`
        );
      }
    } catch (err) {
      fail(result, `Failed to audit hash chain for model '${model}': ${String(err)}`);
    }
  }

  // 2. فحص معادلة اتزان العهد النقدية ومنع الأرصدة السالبة
  try {
    const custodies = await client.financialCustody.findMany();
    const custodyMap = new Map<string, any>();

    for (const custody of custodies) {
      result.checked++;
      custodyMap.set(custody.id, custody);
      if (custody.custodyNumber) {
        custodyMap.set(custody.custodyNumber, custody);
      }
      const custodyId = custody.custodyNumber || custody.id;

      const initial = Number(custody.initialAmount ?? 0);
      const liquidated = Number(custody.totalLiquidatedExpenses ?? 0);
      const advances = Number(custody.totalCashAdvancesDisbursed ?? 0);
      const current = Number(custody.currentBalance ?? 0);

      // صمام فحص الأرقام الصالحة ومنع القيم غير الرقمية
      if (Number.isNaN(initial) || Number.isNaN(liquidated) || Number.isNaN(advances) || Number.isNaN(current)) {
        fail(
          result,
          `Custody '${custodyId}' contains invalid non-numeric monetary values.`
        );
        continue;
      }

      // صمام منع الأرصدة السالبة
      if (current < 0) {
        fail(
          result,
          `Custody '${custodyId}' has illegal negative balance: ${current.toFixed(2)}`
        );
      }

      // معادلة الاتزان المحاسبي للعهدة:
      // |initialAmount - totalLiquidatedExpenses - totalCashAdvancesDisbursed - currentBalance| < 0.001
      const delta = Math.abs(initial - liquidated - advances - current);
      if (delta >= 0.001) {
        fail(
          result,
          `Custody balance discrepancy in '${custodyId}': initial (${initial.toFixed(2)}) - liquidated (${liquidated.toFixed(2)}) - advances (${advances.toFixed(2)}) = ${(initial - liquidated - advances).toFixed(2)}, but currentBalance is ${current.toFixed(2)} (delta: ${delta.toFixed(4)})`
        );
      }
    }

    // 3. فحص ارتباط السلف النقدية (ADVANCE_CASH) بعهدة موقع صالحة ومفتوحة
    const cashAdvances = await client.financialLedger.findMany({
      where: { transactionType: 'ADVANCE_CASH' },
    });

    for (const advance of cashAdvances) {
      result.checked++;
      const voucher = advance.voucherNumber || advance.id;

      if (!advance.sourceCustodyId) {
        fail(
          result,
          `Cash advance voucher '${voucher}' has no linked site custody (sourceCustodyId is null/missing).`
        );
        continue;
      }

      const linkedCustody = custodyMap.get(advance.sourceCustodyId);
      if (!linkedCustody) {
        fail(
          result,
          `Cash advance voucher '${voucher}' references non-existent custody ID '${advance.sourceCustodyId}'.`
        );
      } else if (linkedCustody.status === 'CLOSED') {
        const advanceTime = advance.createdAt ? new Date(advance.createdAt).getTime() : 0;
        const closedTime = linkedCustody.closedAt ? new Date(linkedCustody.closedAt).getTime() : 0;
        if (closedTime > 0 && advanceTime > closedTime) {
          fail(
            result,
            `Cash advance voucher '${voucher}' was disbursed from already CLOSED custody '${linkedCustody.custodyNumber || linkedCustody.id}'.`
          );
        }
      }
    }

    // 4. فحص القيود العكسية (isReversal) وترابطها بسند أصلي صحيح
    const allLedgers = await client.financialLedger.findMany({
      select: { id: true, voucherNumber: true, isReversal: true, reversalOfVoucherId: true },
    });

    const knownVoucherRefs = new Set<string>();
    for (const entry of allLedgers) {
      if (entry.id) knownVoucherRefs.add(entry.id);
      if (entry.voucherNumber) knownVoucherRefs.add(entry.voucherNumber);
    }

    const reversedOriginals = new Map<string, string>();
    for (const entry of allLedgers) {
      if (entry.isReversal) {
        result.checked++;
        const voucher = entry.voucherNumber || entry.id;

        if (!entry.reversalOfVoucherId || entry.reversalOfVoucherId.trim() === '') {
          fail(
            result,
            `Reversal ledger entry '${voucher}' is marked as isReversal=true but missing reversalOfVoucherId.`
          );
        } else if (
          entry.reversalOfVoucherId === entry.id ||
          entry.reversalOfVoucherId === entry.voucherNumber
        ) {
          fail(
            result,
            `Reversal ledger entry '${voucher}' cannot be a reversal of itself.`
          );
        } else if (!knownVoucherRefs.has(entry.reversalOfVoucherId)) {
          fail(
            result,
            `Reversal ledger entry '${voucher}' references non-existent original voucher '${entry.reversalOfVoucherId}'.`
          );
        } else if (reversedOriginals.has(entry.reversalOfVoucherId)) {
          const prior = reversedOriginals.get(entry.reversalOfVoucherId);
          fail(
            result,
            `Duplicate reversal detected: voucher '${voucher}' and voucher '${prior}' both reverse the same original voucher '${entry.reversalOfVoucherId}'.`
          );
        } else {
          reversedOriginals.set(entry.reversalOfVoucherId, voucher);
        }
      }
    }
  } catch (err) {
    fail(result, `Failed to query financial models from database: ${String(err)}`);
  }

  // 5. التحقق من قدرة المنظومة التشفيرية على رصد التلاعب بالهاش فورياً
  try {
    const fixedTime = '2026-09-17T12:00:00.000Z';
    const rec1Payload = {
      id: 'TEST-REC-1',
      previousHash: GENESIS_HASH,
      timestamp: fixedTime,
      amount: 100,
      currency: 'EGP',
      transactionType: 'ADVANCE_CASH',
      sourceAccount: 'CUSTODY_SAFE',
      destinationAccount: 'WORKER_PAYABLE',
      actorTelegramId: '7594239391',
    };
    const hash1 = computeTransactionHash(rec1Payload);
    const rec1: ChainedRecord = { ...rec1Payload, recordHash: hash1 };

    const rec2Payload = {
      id: 'TEST-REC-2',
      previousHash: hash1,
      timestamp: fixedTime,
      amount: 200,
      currency: 'EGP',
      transactionType: 'ADVANCE_CASH',
      sourceAccount: 'CUSTODY_SAFE',
      destinationAccount: 'WORKER_PAYABLE',
      actorTelegramId: '7594239391',
    };
    const hash2 = computeTransactionHash(rec2Payload);
    const rec2: ChainedRecord = { ...rec2Payload, recordHash: hash2 };

    const rec3Payload = {
      id: 'TEST-REC-3',
      previousHash: hash2,
      timestamp: fixedTime,
      amount: 300,
      currency: 'EGP',
      transactionType: 'ADVANCE_CASH',
      sourceAccount: 'CUSTODY_SAFE',
      destinationAccount: 'WORKER_PAYABLE',
      actorTelegramId: '7594239391',
    };
    const hash3 = computeTransactionHash(rec3Payload);
    const rec3: ChainedRecord = { ...rec3Payload, recordHash: hash3 };

    // فحص سلامة السلسلة السليمة
    const intact = verifyLedgerChainMemory([rec1, rec2, rec3]);
    result.checked++;
    if (!intact.isValid) {
      fail(result, `Cryptographic watchdog baseline validation failed: ${intact.error}`);
    }

    // فحص رصد التلاعب في القيمة المالية
    const tamperedAmount: ChainedRecord = { ...rec2, amount: 99999 };
    const tamperedRes = verifyLedgerChainMemory([rec1, tamperedAmount, rec3]);
    result.checked++;
    if (tamperedRes.isValid) {
      fail(result, 'Cryptographic watchdog failed to detect tampered monetary amount in ledger chain!');
    }

    // فحص رصد التلاعب في مؤشر الهاش السابق
    const tamperedPrev: ChainedRecord = { ...rec3, previousHash: 'corrupted_previous_hash_value' };
    const tamperedPrevRes = verifyLedgerChainMemory([rec1, rec2, tamperedPrev]);
    result.checked++;
    if (tamperedPrevRes.isValid) {
      fail(result, 'Cryptographic watchdog failed to detect broken previousHash pointer in ledger chain!');
    }
  } catch (err) {
    fail(result, `Cryptographic watchdog self-test failed: ${String(err)}`);
  }

  // 6. التحقق من سقف الفحص المؤسسي (> 50 سجلاً في البيئة الحية أو الفحص الكامل)
  const minRequired = options.minChecked ?? (options.prisma ? 1 : 50);
  if (result.checked < minRequired) {
    fail(result, `Financial integrity checked only ${result.checked} records; expected >= ${minRequired} records.`);
  }

  return result;
}

if (isCliEntrypoint(import.meta.url) || process.argv[1]?.includes('verify-financial-integrity')) {
  console.log('🏛️ [FINANCIAL-INTEGRITY] Running Enterprise Cryptographic Ledger & Custody Invariant Verification...');
  const result = await verifyFinancialIntegrity();
  printAndExit('financial:verify', result);
}
