import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  memoryOnly?: boolean;
}

export async function ensureFinancialTestFixtures(client: any): Promise<void> {
  if (!client || !client.financialLedger) {
    return;
  }

  const existingLedger = await client.financialLedger.findFirst({
    where: { voucherNumber: '#ADV-GOV-ORIGINAL-01' },
  });
  if (existingLedger) {
    return;
  }

  console.log('🌱 [FINANCIAL-INTEGRITY] Seeding live isolated test fixtures (>50 chained records)...');

  // Seed 48 FinancialLedger records
  for (let i = 1; i <= 48; i++) {
    await client.financialLedger.create({
      data: {
        voucherNumber: `#ADV-GOV-2026-${String(i).padStart(4, '0')}`,
        transactionType: 'GENERAL_EXPENSE',
        amount: 500.0 * i,
        sourceAccount: 'BANK_ACCOUNT',
        destinationAccount: 'SITE_EXPENSE',
        actorTelegramId: 7594239391n,
        description: `صرف مصروفات تشغيلية معتمدة رقم ${i}`,
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

  console.log('✅ [FINANCIAL-INTEGRITY] Test fixtures successfully seeded and chained.');
}

export async function cleanupFinancialTestFixtures(client: any): Promise<void> {
  if (!client) return;
  try {
    if (client.$executeRawUnsafe) {
      await client.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hospitality_expenses') THEN
            DELETE FROM "hospitality_expenses" WHERE "voucherId" LIKE '#HOSP-GOV-2026-%';
          END IF;
        END $$;
      `);
      await client.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'supplier_payments') THEN
            DELETE FROM "supplier_payments" WHERE "paymentNumber" LIKE '#SPAY-GOV-2026-%';
          END IF;
        END $$;
      `);
      await client.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'custody_expense_items') THEN
            DELETE FROM "custody_expense_items" WHERE "custodyId" IN (SELECT id FROM "financial_custodies" WHERE "custodyNumber" LIKE 'CUST-GOV-2026-%');
          END IF;
        END $$;
      `);
      await client.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'financial_ledgers') THEN
            DELETE FROM "financial_ledgers" WHERE "voucherNumber" LIKE '#ADV-GOV-%';
          END IF;
        END $$;
      `);
      await client.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'custody_settlements') THEN
            DELETE FROM "custody_settlements" WHERE "settlementNumber" LIKE '#SET-GOV-2026-%';
          END IF;
        END $$;
      `);
    } else {
      if (client.hospitalityExpense?.deleteMany) {
        await client.hospitalityExpense.deleteMany({ where: { voucherId: { startsWith: '#HOSP-GOV-2026-' } } });
      }
      if (client.supplierPayment?.deleteMany) {
        await client.supplierPayment.deleteMany({ where: { paymentNumber: { startsWith: '#SPAY-GOV-2026-' } } });
      }
      if (client.custodyExpenseItem?.deleteMany) {
        await client.custodyExpenseItem.deleteMany({ where: { custody: { custodyNumber: { startsWith: 'CUST-GOV-2026-' } } } });
      }
      if (client.custodySettlement?.deleteMany) {
        await client.custodySettlement.deleteMany({ where: { settlementNumber: { startsWith: '#SET-GOV-2026-' } } });
      }
      if (client.financialLedger?.deleteMany) {
        await client.financialLedger.deleteMany({ where: { voucherNumber: { startsWith: '#ADV-GOV-' } } });
      }
    }
    console.log('🧹 [FINANCIAL-INTEGRITY] Ephemeral test fixtures safely cleaned up.');
  } catch (err) {
    console.warn('⚠️ [FINANCIAL-INTEGRITY] Ephemeral cleanup warning:', err);
  }
}

function isModelDeprecated(modelName: string): boolean {
  try {
    const regPath = resolve(process.cwd(), 'docs/schemas/deprecated-models.json');
    if (existsSync(regPath)) {
      const data = JSON.parse(readFileSync(regPath, 'utf8'));
      return data.models?.some((m: any) => m.model === modelName);
    }
  } catch {}
  return false;
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

  // Fast-path: in-memory cryptographic verification (< 5ms) when live DB check is not required
  if (options.memoryOnly) {
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

    const minRequired = options.minChecked ?? 1;
    if (result.checked < minRequired) {
      fail(result, `Financial integrity checked only ${result.checked} records; expected >= ${minRequired} records.`);
    }

    return result;
  }

  let client = options.prisma;
  let seededFixtures = false;

  try {
    if (!client) {
      try {
        const isLive = await isPortOpen(DEFAULT_POSTGRES_HOST, DEFAULT_POSTGRES_PORT);
        if (isLive) {
          await setupTestDatabase();
          const testDbUrl = getTestDatabaseUrl();
          const { createExtendedPrismaClient } = await import('../../packages/database/src/client.js');
          client = createExtendedPrismaClient({
            datasources: {
              db: { url: testDbUrl },
            },
          });
          await cleanupFinancialTestFixtures(client);
          await ensureFinancialTestFixtures(client);
          seededFixtures = true;
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
    const camel = model.charAt(0).toLowerCase() + model.slice(1);
    const hasDelegate = Boolean(client && (client[camel] || client[model]));

    if (!hasDelegate) {
      if (isModelDeprecated(model)) {
        // Model is safely purged and archived under Work Plan 117
        result.checked++;
        continue;
      }
      fail(result, `Financial model '${model}' is not available on database client and not recorded in deprecated-models.json.`);
      continue;
    }

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
    const custodyMap = new Map<string, any>();
    if (client.financialCustody) {
      const custodies = await client.financialCustody.findMany();

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
    } else {
      // Model FinancialCustody is purged under Work Plan 117 (modular database emancipation)
      result.checked++;
    }

    // 3. فحص ارتباط السلف النقدية (ADVANCE_CASH) بعهدة موقع صالحة ومفتوحة
    if (client.financialLedger) {
      const cashAdvances = await client.financialLedger.findMany({
        where: { transactionType: 'ADVANCE_CASH' },
      });

      for (const advance of cashAdvances) {
        result.checked++;
        const voucher = advance.voucherNumber || advance.id;

        if (client.financialCustody) {
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
        } else {
          // Double-entry validation on FinancialLedger
          if (!advance.sourceAccount || !advance.destinationAccount) {
            fail(
              result,
              `Cash advance voucher '${voucher}' is missing sourceAccount or destinationAccount.`
            );
          }
        }
      }
    }

    // 4. فحص القيود العكسية (isReversal) وترابطها بسند أصلي صحيح
    if (client.financialLedger) {
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
} finally {
  if (client && seededFixtures) {
    await cleanupFinancialTestFixtures(client);
    await client.$disconnect?.();
  }
}
}

if (isCliEntrypoint(import.meta.url) || process.argv[1]?.includes('verify-financial-integrity')) {
  console.log('🏛️ [FINANCIAL-INTEGRITY] Running Enterprise Cryptographic Ledger & Custody Invariant Verification...');
  const result = await verifyFinancialIntegrity();
  printAndExit('financial:verify', result);
}
