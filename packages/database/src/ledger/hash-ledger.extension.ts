import { Prisma } from '../generated/client/index.js';
import { computeRecordHash, GENESIS_HASH } from './hash-chain.js';

export const FINANCIAL_MODELS = new Set<string>([
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

export interface LedgerRecordPayload extends Record<string, any> {
  previousHash?: string;
  recordHash?: string;
  hashTimestamp?: Date | string;
}

// In-process mutex for serializing hash calculations per model
class AsyncMutex {
  private mutex = Promise.resolve();

  lock(): Promise<() => void> {
    let unlock: () => void;
    const next = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const wait = this.mutex.then(() => unlock);
    this.mutex = this.mutex.then(() => next);
    return wait;
  }
}

const modelMutexes = new Map<string, AsyncMutex>();
function getMutex(model: string): AsyncMutex {
  const key = model.toLowerCase();
  let m = modelMutexes.get(key);
  if (!m) {
    m = new AsyncMutex();
    modelMutexes.set(key, m);
  }
  return m;
}

export function extractAmount(data: Record<string, any>): number {
  if (data.amount !== undefined && data.amount !== null) return Number(data.amount);
  if (data.closingTotalInvoices !== undefined && data.closingTotalInvoices !== null) return Number(data.closingTotalInvoices);
  if (data.remainingCashReturned !== undefined && data.remainingCashReturned !== null) return Number(data.remainingCashReturned);
  return 0;
}

export function extractActorId(data: Record<string, any>): string {
  if (data.actorTelegramId !== undefined && data.actorTelegramId !== null) return String(data.actorTelegramId);
  if (data.actorId !== undefined && data.actorId !== null) return String(data.actorId);
  if (data.recordedByUserId !== undefined && data.recordedByUserId !== null) return String(data.recordedByUserId);
  if (data.auditedByUserId !== undefined && data.auditedByUserId !== null) return String(data.auditedByUserId);
  if (data.approvedByUserId !== undefined && data.approvedByUserId !== null) return String(data.approvedByUserId);
  if (data.disbursedByWorkerId !== undefined && data.disbursedByWorkerId !== null) return String(data.disbursedByWorkerId);
  if (data.workerId !== undefined && data.workerId !== null) return String(data.workerId);
  if (data.custodyId !== undefined && data.custodyId !== null) return String(data.custodyId);
  if (data.supplierId !== undefined && data.supplierId !== null) return String(data.supplierId);
  return 'system';
}

export function normalizeModelName(model: string): string {
  return model.charAt(0).toUpperCase() + model.slice(1);
}

function getModelDelegate(client: any, model: string): any {
  const camel = model.charAt(0).toLowerCase() + model.slice(1);
  return client[camel] ?? client[model];
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

          const mutex = getMutex(model);
          const unlock = await mutex.lock();
          try {
            const delegate = getModelDelegate(client, model);
            const canonicalModel = normalizeModelName(model);

            // Fetch the latest committed record in this ledger table
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

            const recordData = args.data as LedgerRecordPayload;

            const timestamp = recordData.hashTimestamp instanceof Date
              ? recordData.hashTimestamp
              : (recordData.hashTimestamp ? new Date(recordData.hashTimestamp) : new Date());

            const amount = extractAmount(recordData);
            const actorId = extractActorId(recordData);

            const recordHash = computeRecordHash({
              previousHash,
              model: canonicalModel,
              amount,
              actorId,
              timestamp,
            });

            recordData.previousHash = previousHash;
            recordData.recordHash = recordHash;
            recordData.hashTimestamp = timestamp;

            return await query(args);
          } finally {
            unlock();
          }
        },

        async createMany({ model, operation, args, query }: LedgerQueryArgs) {
          if (!FINANCIAL_MODELS.has(model)) {
            return query(args);
          }

          const records = Array.isArray(args.data) ? args.data : [args.data];
          if (records.length === 0) return query(args);

          const mutex = getMutex(model);
          const unlock = await mutex.lock();
          try {
            const delegate = getModelDelegate(client, model);
            const canonicalModel = normalizeModelName(model);

            let currentPreviousHash = GENESIS_HASH;
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
                currentPreviousHash = latest.recordHash;
              }
            }

            for (const record of records) {
              const recordData = record as LedgerRecordPayload;

              const timestamp = recordData.hashTimestamp instanceof Date
                ? recordData.hashTimestamp
                : (recordData.hashTimestamp ? new Date(recordData.hashTimestamp) : new Date());

              const amount = extractAmount(recordData);
              const actorId = extractActorId(recordData);

              const recordHash = computeRecordHash({
                previousHash: currentPreviousHash,
                model: canonicalModel,
                amount,
                actorId,
                timestamp,
              });

              recordData.previousHash = currentPreviousHash;
              recordData.recordHash = recordHash;
              recordData.hashTimestamp = timestamp;

              currentPreviousHash = recordHash;
            }

            return await query(args);
          } finally {
            unlock();
          }
        },

        async update({ model, operation, args, query }: LedgerQueryArgs) {
          if (FINANCIAL_MODELS.has(model)) {
            const forbiddenFields = ['recordHash', 'previousHash', 'amount', 'hashTimestamp'];
            for (const field of forbiddenFields) {
              if (field in (args.data || {})) {
                throw new ImmutableLedgerError(
                  `Cannot update immutable financial ledger field '${field}' on model '${model}'. Accounting entries are append-only.`
                );
              }
            }
          }
          return query(args);
        },

        async updateMany({ model, operation, args, query }: LedgerQueryArgs) {
          if (FINANCIAL_MODELS.has(model)) {
            const forbiddenFields = ['recordHash', 'previousHash', 'amount', 'hashTimestamp'];
            for (const field of forbiddenFields) {
              if (field in (args.data || {})) {
                throw new ImmutableLedgerError(
                  `Cannot update immutable financial ledger field '${field}' on model '${model}'. Accounting entries are append-only.`
                );
              }
            }
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
