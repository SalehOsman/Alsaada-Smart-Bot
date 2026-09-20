import { Prisma } from '../generated/client/index.js';
import { computeRecordHash, GENESIS_HASH, computeHmacSignature, DEFAULT_KEYRING } from './hash-chain.js';

export const FINANCIAL_MODELS = new Set<string>([
  'FinancialLedger',
  'financialLedger',
  'FinancialCustody',
  'financialCustody',
  'CustodyExpenseItem',
  'custodyExpenseItem',
  'CustodySettlement',
  'custodySettlement',
  'HospitalityExpense',
  'hospitalityExpense',
  'WorkerExpenseClaim',
  'workerExpenseClaim',
  'SupplierPayment',
  'supplierPayment',
  'SupplierInvoice',
  'supplierInvoice',
  'AdvanceRequest',
  'advanceRequest',
  'AdvanceInstallment',
  'advanceInstallment',
  'PayrollTransaction',
  'payrollTransaction',
  'PayrollRecord',
  'payrollRecord',
  'AttendanceRecord',
  'attendanceRecord',
  // legacy aliases
  'WorkerAdvance',
  'workerAdvance',
  'CustodyTransaction',
  'custodyTransaction',
  'ExpenseRecord',
  'expenseRecord',
]);

export const HASH_CHAIN_MODELS = new Set<string>([
  'FinancialLedger',
  'financialLedger',
  'SupplierPayment',
  'supplierPayment',
  'CustodyExpenseItem',
  'custodyExpenseItem',
  'CustodySettlement',
  'custodySettlement',
  'HospitalityExpense',
  'hospitalityExpense',
  'WorkerExpenseClaim',
  'workerExpenseClaim',
]);

export class ImmutableLedgerError extends Error {
  constructor(message: string) {
    super(`[LEDGER_IMMUTABILITY_VIOLATION] ${message}`);
    this.name = 'ImmutableLedgerError';
  }
}

export class LedgerHardDeleteForbiddenError extends Error {
  constructor(model: string) {
    super(
      `[LEDGER_IMMUTABILITY_VIOLATION] Direct hard deletion on financial model '${model}' is strictly forbidden. Use reversal vouchers or soft-delete.`
    );
    this.name = 'LedgerHardDeleteForbiddenError';
  }
}

export interface LedgerRecordPayload extends Record<string, unknown> {
  previousHash?: string;
  recordHash?: string;
  hashTimestamp?: Date | string;
  ledgerSeq?: bigint | number;
  hmacKid?: string;
  hmacSignature?: string;
}

export const LEDGER_LOCK_NAMESPACE = 0x53414144; // 'SAAD' in hex

export const MODEL_LOCK_IDS: Record<string, number> = {
  financialledger: 1,
  financialcustody: 2,
  custodyexpenseitem: 3,
  custodysettlement: 4,
  hospitalityexpense: 5,
  workerexpenseclaim: 6,
  supplierpayment: 7,
  supplierinvoice: 8,
  advancerequest: 9,
  advanceinstallment: 10,
  payrolltransaction: 11,
  payrollrecord: 11,
  attendancerecord: 12,
  // legacy aliases
  workeradvance: 9,
  custodytransaction: 2,
  expenserecord: 3,
};

export const LEDGER_UPDATE_WHITELIST = new Set<string>([
  'isDeleted',
  'deletedAt',
  'deletedBy',
  'deletionReason',
  'approvalStatus',
  'status',
  'reviewedBy',
  'auditNotes',
  'updatedAt',
  'syncedToSheets',
  'syncedAt',
  'settledAt',
  'auditedByUserId',
  'approvedByUserId',
]);

/**
 * Acquires transaction-scoped PostgreSQL advisory locks (pg_advisory_xact_lock)
 * in strict ascending order (lockId_1 < lockId_2) to prevent circular wait deadlocks.
 */
export async function acquireModelLocks(
  client: any,
  models: string | string[]
): Promise<number[]> {
  const modelList = Array.isArray(models) ? models : [models];
  const lockIds = Array.from(
    new Set(
      modelList
        .map((m) => {
          const lower = m.toLowerCase();
          return MODEL_LOCK_IDS[lower] ?? 99;
        })
        .filter((id) => id !== undefined)
    )
  ).sort((a, b) => a - b);

  for (const lockId of lockIds) {
    if (typeof client.$executeRawUnsafe === 'function') {
      await client.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(($1)::integer, ($2)::integer)',
        LEDGER_LOCK_NAMESPACE,
        lockId
      );
    }
  }
  return lockIds;
}

export function extractAmount(data: Record<string, unknown>): number {
  if (data.amount !== undefined && data.amount !== null) return Number(data.amount);
  if (data.totalAmount !== undefined && data.totalAmount !== null) return Number(data.totalAmount);
  if (data.netSalaryPayable !== undefined && data.netSalaryPayable !== null) return Number(data.netSalaryPayable);
  if (data.grossEarnings !== undefined && data.grossEarnings !== null) return Number(data.grossEarnings);
  if (data.amountRequested !== undefined && data.amountRequested !== null) return Number(data.amountRequested);
  if (data.approvedAmount !== undefined && data.approvedAmount !== null) return Number(data.approvedAmount);
  if (data.installmentAmount !== undefined && data.installmentAmount !== null) return Number(data.installmentAmount);
  if (data.initialAmount !== undefined && data.initialAmount !== null) return Number(data.initialAmount);
  if (data.currentBalance !== undefined && data.currentBalance !== null) return Number(data.currentBalance);
  if (data.closingTotalInvoices !== undefined && data.closingTotalInvoices !== null) return Number(data.closingTotalInvoices);
  if (data.remainingCashReturned !== undefined && data.remainingCashReturned !== null) return Number(data.remainingCashReturned);
  return 0;
}

export function extractVoucherNumber(data: Record<string, unknown>): string {
  if (data.voucherNumber !== undefined && data.voucherNumber !== null) return String(data.voucherNumber);
  if (data.voucherId !== undefined && data.voucherId !== null) return String(data.voucherId);
  if (data.paymentNumber !== undefined && data.paymentNumber !== null) return String(data.paymentNumber);
  if (data.claimNumber !== undefined && data.claimNumber !== null) return String(data.claimNumber);
  if (data.requestNumber !== undefined && data.requestNumber !== null) return String(data.requestNumber);
  if (data.settlementNumber !== undefined && data.settlementNumber !== null) return String(data.settlementNumber);
  if (data.custodyNumber !== undefined && data.custodyNumber !== null) return String(data.custodyNumber);
  if (data.originalVoucherNumber !== undefined && data.originalVoucherNumber !== null) return String(data.originalVoucherNumber);
  if (data.invoiceNumber !== undefined && data.invoiceNumber !== null) return String(data.invoiceNumber);
  if (data.itemSequence !== undefined && data.itemSequence !== null) {
    return `${String(data.custodyId ?? '')}#${String(data.itemSequence)}`;
  }
  return '';
}

export function extractTransactionType(data: Record<string, unknown>, model?: string): string {
  if (data.transactionType !== undefined && data.transactionType !== null) return String(data.transactionType);
  if (data.expenseCategory !== undefined && data.expenseCategory !== null) return String(data.expenseCategory);
  if (data.paymentMethod !== undefined && data.paymentMethod !== null) return String(data.paymentMethod);
  if (data.settlementDisposition !== undefined && data.settlementDisposition !== null) return String(data.settlementDisposition);
  if (data.purpose !== undefined && data.purpose !== null) return String(data.purpose);
  if (model) return normalizeModelName(model);
  return 'TRANSACTION';
}

export function extractCurrency(data: Record<string, unknown>): string {
  if (data.currency !== undefined && data.currency !== null) return String(data.currency).toUpperCase();
  return 'EGP';
}

export function extractSourceAccount(data: Record<string, unknown>): string {
  if (data.sourceAccount !== undefined && data.sourceAccount !== null) return String(data.sourceAccount);
  if (data.sourceCustodyId !== undefined && data.sourceCustodyId !== null) return String(data.sourceCustodyId);
  if (data.disbursedFromCustodyId !== undefined && data.disbursedFromCustodyId !== null) return String(data.disbursedFromCustodyId);
  if (data.custodyId !== undefined && data.custodyId !== null) return String(data.custodyId);
  if (data.disbursedFromTreasuryId !== undefined && data.disbursedFromTreasuryId !== null) return String(data.disbursedFromTreasuryId);
  if (data.settlementCustodyId !== undefined && data.settlementCustodyId !== null) return String(data.settlementCustodyId);
  return '';
}

export function extractDestinationAccount(data: Record<string, unknown>): string {
  if (data.destinationAccount !== undefined && data.destinationAccount !== null) return String(data.destinationAccount);
  if (data.destinationCustodyId !== undefined && data.destinationCustodyId !== null) return String(data.destinationCustodyId);
  if (data.vendorName !== undefined && data.vendorName !== null) return String(data.vendorName);
  if (data.guestNameOrEntity !== undefined && data.guestNameOrEntity !== null) return String(data.guestNameOrEntity);
  if (data.supplierId !== undefined && data.supplierId !== null) return String(data.supplierId);
  return '';
}

export function extractBeneficiaryId(data: Record<string, unknown>): string {
  if (data.beneficiaryId !== undefined && data.beneficiaryId !== null) return String(data.beneficiaryId);
  if (data.workerId !== undefined && data.workerId !== null) return String(data.workerId);
  if (data.custodianWorkerId !== undefined && data.custodianWorkerId !== null) return String(data.custodianWorkerId);
  if (data.supplierId !== undefined && data.supplierId !== null) return String(data.supplierId);
  if (data.canteenItemId !== undefined && data.canteenItemId !== null) return String(data.canteenItemId);
  return '';
}

export function extractActorTelegramId(data: Record<string, unknown>): string {
  if (data.actorTelegramId !== undefined && data.actorTelegramId !== null) return String(data.actorTelegramId);
  if (data.changedByTelegramId !== undefined && data.changedByTelegramId !== null) return String(data.changedByTelegramId);
  if (data.actorId !== undefined && data.actorId !== null) return String(data.actorId);
  if (data.recordedByUserId !== undefined && data.recordedByUserId !== null) return String(data.recordedByUserId);
  if (data.auditedByUserId !== undefined && data.auditedByUserId !== null) return String(data.auditedByUserId);
  if (data.approvedByUserId !== undefined && data.approvedByUserId !== null) return String(data.approvedByUserId);
  if (data.disbursedByWorkerId !== undefined && data.disbursedByWorkerId !== null) return String(data.disbursedByWorkerId);
  if (data.workerId !== undefined && data.workerId !== null) return String(data.workerId);
  if (data.custodyId !== undefined && data.custodyId !== null) return String(data.custodyId);
  if (data.supplierId !== undefined && data.supplierId !== null) return String(data.supplierId);
  if (data.deletedBy !== undefined && data.deletedBy !== null) return String(data.deletedBy);
  return 'system';
}

export const extractActorId = extractActorTelegramId;

export function normalizeModelName(model: string): string {
  return model.charAt(0).toUpperCase() + model.slice(1);
}

function getModelDelegate(client: any, model: string): any {
  const camel = model.charAt(0).toLowerCase() + model.slice(1);
  return client[camel] ?? client[model];
}

async function resolveNextLedgerSeq(client: any, delegate: any, model: string): Promise<bigint | null> {
  const canonicalModel = normalizeModelName(model);
  if (canonicalModel !== 'FinancialLedger') {
    return null;
  }
  try {
    if (typeof client.$queryRawUnsafe === 'function') {
      const rows = await client.$queryRawUnsafe(
        'SELECT COALESCE(MAX(ledger_seq), 0) + 1 AS next_seq FROM financial_ledgers'
      );
      if (Array.isArray(rows) && rows.length > 0 && rows[0]?.next_seq !== undefined) {
        return BigInt(rows[0].next_seq);
      }
    }
  } catch {}
  if (delegate && typeof delegate.findFirst === 'function') {
    try {
      const maxRec = await delegate.findFirst({
        orderBy: { ledgerSeq: 'desc' },
        select: { ledgerSeq: true },
      });
      return maxRec?.ledgerSeq ? BigInt(maxRec.ledgerSeq) + 1n : 1n;
    } catch {}
  }
  return 1n;
}

interface LedgerQueryArgs {
  model: string;
  operation: string;
  args: any;
  query: (args: any) => Promise<any>;
}

export const hashLedgerExtension: any = Prisma.defineExtension((client: any) => {
  return client.$extends({
    name: 'hashLedgerExtension',
    query: {
      $allModels: {
        async create({ model, operation, args, query }: LedgerQueryArgs) {
          if (!FINANCIAL_MODELS.has(model)) {
            return query(args);
          }

          await acquireModelLocks(client, model);

          if (!HASH_CHAIN_MODELS.has(model)) {
            return query(args);
          }

          const delegate = getModelDelegate(client, model);
          const canonicalModel = normalizeModelName(model);

          // Fetch the latest committed record in this ledger table
          let previousHash = GENESIS_HASH;
          if (delegate) {
            const orderBy = canonicalModel === 'FinancialLedger'
              ? [{ ledgerSeq: 'desc' }, { id: 'desc' }]
              : [
                  { hashTimestamp: 'desc' },
                  { createdAt: 'desc' },
                  { id: 'desc' },
                ];
            const latest = await delegate.findFirst({
              orderBy,
              select: { recordHash: true },
            });
            if (latest?.recordHash && latest.recordHash.trim() !== '') {
              previousHash = latest.recordHash;
            }
          }

          const recordData = args.data as LedgerRecordPayload;

          const timestamp = recordData.hashTimestamp instanceof Date
            ? recordData.hashTimestamp
            : (recordData.hashTimestamp ? new Date(recordData.hashTimestamp) : new Date());

          const amount = extractAmount(recordData);
          const voucherNumber = extractVoucherNumber(recordData);
          const transactionType = extractTransactionType(recordData, canonicalModel);
          const currency = extractCurrency(recordData);
          const sourceAccount = extractSourceAccount(recordData);
          const destinationAccount = extractDestinationAccount(recordData);
          const beneficiaryId = extractBeneficiaryId(recordData);
          const actorTelegramId = extractActorTelegramId(recordData);

          const recordHash = computeRecordHash({
            previousHash,
            voucherNumber,
            transactionType,
            amount,
            currency,
            sourceAccount,
            destinationAccount,
            beneficiaryId,
            actorTelegramId,
            timestamp,
          });

          recordData.previousHash = previousHash;
          recordData.recordHash = recordHash;
          recordData.hashTimestamp = timestamp;

          if (canonicalModel === 'FinancialLedger') {
            if (recordData.ledgerSeq === undefined || recordData.ledgerSeq === null) {
              const nextSeq = await resolveNextLedgerSeq(client, delegate, model);
              if (nextSeq !== null) {
                recordData.ledgerSeq = nextSeq;
              }
            }
            const hmacKid = (recordData.hmacKid as string) || DEFAULT_KEYRING.activeKid;
            const activeKey =
              DEFAULT_KEYRING.keys[hmacKid]?.key ||
              process.env.HMAC_SECRET_KEY ||
              'alsaada-default-sovereign-hmac-key-2026-q1-do-not-leak';
            const hmacSignature = computeHmacSignature(
              {
                ledgerSeq: recordData.ledgerSeq ?? 1n,
                prevHash: previousHash,
                currentHash: recordHash,
                createdAt: timestamp,
                amount,
              },
              activeKey
            );
            recordData.hmacKid = hmacKid;
            recordData.hmacSignature = hmacSignature;
          }

          return await query(args);
        },

        async createMany({ model, operation, args, query }: LedgerQueryArgs) {
          if (!FINANCIAL_MODELS.has(model)) {
            return query(args);
          }

          const records = Array.isArray(args.data) ? args.data : [args.data];
          if (records.length === 0) return query(args);

          await acquireModelLocks(client, model);

          if (!HASH_CHAIN_MODELS.has(model)) {
            return query(args);
          }

          const delegate = getModelDelegate(client, model);
          const canonicalModel = normalizeModelName(model);

          let currentPreviousHash = GENESIS_HASH;
          if (delegate) {
            const orderBy = canonicalModel === 'FinancialLedger'
              ? [{ ledgerSeq: 'desc' }, { id: 'desc' }]
              : [
                  { hashTimestamp: 'desc' },
                  { createdAt: 'desc' },
                  { id: 'desc' },
                ];
            const latest = await delegate.findFirst({
              orderBy,
              select: { recordHash: true },
            });
            if (latest?.recordHash && latest.recordHash.trim() !== '') {
              currentPreviousHash = latest.recordHash;
            }
          }

          let nextSeq = canonicalModel === 'FinancialLedger'
            ? await resolveNextLedgerSeq(client, delegate, model)
            : null;

          for (const record of records) {
            const recordData = record as LedgerRecordPayload;

            const timestamp = recordData.hashTimestamp instanceof Date
              ? recordData.hashTimestamp
              : (recordData.hashTimestamp ? new Date(recordData.hashTimestamp) : new Date());

            const amount = extractAmount(recordData);
            const voucherNumber = extractVoucherNumber(recordData);
            const transactionType = extractTransactionType(recordData, canonicalModel);
            const currency = extractCurrency(recordData);
            const sourceAccount = extractSourceAccount(recordData);
            const destinationAccount = extractDestinationAccount(recordData);
            const beneficiaryId = extractBeneficiaryId(recordData);
            const actorTelegramId = extractActorTelegramId(recordData);

            const recordHash = computeRecordHash({
              previousHash: currentPreviousHash,
              voucherNumber,
              transactionType,
              amount,
              currency,
              sourceAccount,
              destinationAccount,
              beneficiaryId,
              actorTelegramId,
              timestamp,
            });

            recordData.previousHash = currentPreviousHash;
            recordData.recordHash = recordHash;
            recordData.hashTimestamp = timestamp;

            if (canonicalModel === 'FinancialLedger') {
              if (recordData.ledgerSeq === undefined || recordData.ledgerSeq === null) {
                if (nextSeq !== null) {
                  recordData.ledgerSeq = nextSeq;
                  nextSeq = nextSeq + 1n;
                }
              }
              const hmacKid = (recordData.hmacKid as string) || DEFAULT_KEYRING.activeKid;
              const activeKey =
                DEFAULT_KEYRING.keys[hmacKid]?.key ||
                process.env.HMAC_SECRET_KEY ||
                'alsaada-default-sovereign-hmac-key-2026-q1-do-not-leak';
              const hmacSignature = computeHmacSignature(
                {
                  ledgerSeq: recordData.ledgerSeq ?? 1n,
                  prevHash: currentPreviousHash,
                  currentHash: recordHash,
                  createdAt: timestamp,
                  amount,
                },
                activeKey
              );
              recordData.hmacKid = hmacKid;
              recordData.hmacSignature = hmacSignature;
            }

            currentPreviousHash = recordHash;
          }

          return await query(args);
        },

        async update({ model, operation, args, query }: LedgerQueryArgs) {
          if (FINANCIAL_MODELS.has(model)) {
            const data = args.data || {};
            for (const field of Object.keys(data)) {
              if (!LEDGER_UPDATE_WHITELIST.has(field)) {
                throw new ImmutableLedgerError(
                  `FINANCIAL_LEDGER_MUTATION_FORBIDDEN: Field '${field}' is not in the allowed update whitelist for financial model '${model}'. Accounting entries are append-only.`
                );
              }
            }
          }
          return query(args);
        },

        async updateMany({ model, operation, args, query }: LedgerQueryArgs) {
          if (FINANCIAL_MODELS.has(model)) {
            const data = args.data || {};
            for (const field of Object.keys(data)) {
              if (!LEDGER_UPDATE_WHITELIST.has(field)) {
                throw new ImmutableLedgerError(
                  `FINANCIAL_LEDGER_MUTATION_FORBIDDEN: Field '${field}' is not in the allowed update whitelist for financial model '${model}'. Accounting entries are append-only.`
                );
              }
            }
          }
          return query(args);
        },

        async upsert({ model, operation, args, query }: LedgerQueryArgs) {
          if (FINANCIAL_MODELS.has(model)) {
            const updateData = args.update || {};
            for (const field of Object.keys(updateData)) {
              if (!LEDGER_UPDATE_WHITELIST.has(field)) {
                throw new ImmutableLedgerError(
                  `FINANCIAL_LEDGER_MUTATION_FORBIDDEN: Field '${field}' is not in the allowed update whitelist for financial model '${model}'. Accounting entries are append-only.`
                );
              }
            }

            await acquireModelLocks(client, model);

            if (!HASH_CHAIN_MODELS.has(model)) {
              return query(args);
            }

            const delegate = getModelDelegate(client, model);
            const canonicalModel = normalizeModelName(model);

            let previousHash = GENESIS_HASH;
            if (delegate) {
              const latest = await delegate.findFirst({
                orderBy: [
                  { hashTimestamp: 'desc' },
                  { createdAt: 'desc' },
                  { id: 'desc' },
                ],
                select: { recordHash: true },
              });
              if (latest?.recordHash && latest.recordHash.trim() !== '') {
                previousHash = latest.recordHash;
              }
            }

            const createData = (args.create || {}) as LedgerRecordPayload;
            const timestamp = createData.hashTimestamp instanceof Date
              ? createData.hashTimestamp
              : (createData.hashTimestamp ? new Date(createData.hashTimestamp) : new Date());

            const amount = extractAmount(createData);
            const voucherNumber = extractVoucherNumber(createData);
            const transactionType = extractTransactionType(createData, canonicalModel);
            const currency = extractCurrency(createData);
            const sourceAccount = extractSourceAccount(createData);
            const destinationAccount = extractDestinationAccount(createData);
            const beneficiaryId = extractBeneficiaryId(createData);
            const actorTelegramId = extractActorTelegramId(createData);

            const recordHash = computeRecordHash({
              previousHash,
              voucherNumber,
              transactionType,
              amount,
              currency,
              sourceAccount,
              destinationAccount,
              beneficiaryId,
              actorTelegramId,
              timestamp,
            });

            createData.previousHash = previousHash;
            createData.recordHash = recordHash;
            createData.hashTimestamp = timestamp;
          }
          return query(args);
        },

        async delete({ model, operation, args, query }: LedgerQueryArgs) {
          if (FINANCIAL_MODELS.has(model)) {
            throw new LedgerHardDeleteForbiddenError(model);
          }
          return query(args);
        },

        async deleteMany({ model, operation, args, query }: LedgerQueryArgs) {
          if (FINANCIAL_MODELS.has(model)) {
            throw new LedgerHardDeleteForbiddenError(model);
          }
          return query(args);
        },
      },
    },
  });
});
