import {
  computeRecordHash,
  GENESIS_HASH,
  verifyLedgerChainMemory,
  type ChainedRecord,
  type VerificationResult,
} from './hash-chain.js';
import { extractAmount, extractActorId, normalizeModelName } from './hash-ledger.extension.js';

export interface VerifyLedgerChainOptions {
  model?: string;
  genesisHash?: string;
  where?: Record<string, any>;
  batchSize?: number;
}

export interface LedgerAuditReport {
  isValid: boolean;
  model: string;
  totalVerified: number;
  genesisHash: string;
  brokenRecordId?: string;
  brokenRecordIndex?: number;
  error?: string;
  tamperedField?: 'previousHash' | 'recordHash';
  expectedValue?: string;
  actualValue?: string;
  durationMs: number;
  verifiedAt: Date;
}

export class CorruptedLedgerChainError extends Error {
  constructor(public readonly report: LedgerAuditReport) {
    super(
      `[CRITICAL_SECURITY_ALERT] Financial ledger chain corrupted in model '${report.model}' at record '${report.brokenRecordId}': ${report.error}`
    );
    this.name = 'CorruptedLedgerChainError';
  }
}

function getModelDelegate(client: any, model: string): any {
  const camel = model.charAt(0).toLowerCase() + model.slice(1);
  return client[camel] ?? client[model];
}

/**
 * Performs database-backed cryptographic audit across a financial model ledger.
 * Validates sequential pointer integrity and SHA-256 content hashes with cursor pagination.
 */
export async function verifyLedgerChainDb(
  prisma: any,
  options: VerifyLedgerChainOptions = {}
): Promise<LedgerAuditReport> {
  const startTime = Date.now();
  const rawModel = options.model ?? 'FinancialLedger';
  const canonicalModel = normalizeModelName(rawModel);
  const genesisHash = options.genesisHash ?? GENESIS_HASH;
  const batchSize = options.batchSize ?? 1000;

  const delegate = getModelDelegate(prisma, rawModel);
  if (!delegate) {
    throw new Error(`Model '${rawModel}' not found on Prisma Client instance.`);
  }

  let expectedPreviousHash = genesisHash;
  let totalVerified = 0;
  let cursor: string | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    const queryArgs: any = {
      where: options.where,
      orderBy: [
        { hashTimestamp: 'asc' },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
      take: batchSize,
    };

    if (cursor) {
      queryArgs.skip = 1;
      queryArgs.cursor = { id: cursor };
    }

    const records: Array<Record<string, any>> = await delegate.findMany(queryArgs);

    if (records.length === 0) {
      break;
    }

    for (let i = 0; i < records.length; i++) {
      const record = records[i]!;
      const recordId = String(record.id);

      // 1. Verify previous hash pointer integrity
      const storedPrev = record.previousHash || GENESIS_HASH;
      if (storedPrev !== expectedPreviousHash) {
        return {
          isValid: false,
          model: canonicalModel,
          totalVerified,
          genesisHash,
          brokenRecordId: recordId,
          brokenRecordIndex: totalVerified,
          error: `Broken chain link at record ${recordId}: expected previousHash '${expectedPreviousHash}', got '${storedPrev}'`,
          tamperedField: 'previousHash',
          expectedValue: expectedPreviousHash,
          actualValue: storedPrev,
          durationMs: Date.now() - startTime,
          verifiedAt: new Date(),
        };
      }

      // 2. Verify record hash computation integrity
      const amount = extractAmount(record);
      const actorId = extractActorId(record);
      const timestamp = record.hashTimestamp ?? record.createdAt;

      const calculatedHash = computeRecordHash({
        previousHash: record.previousHash || GENESIS_HASH,
        model: canonicalModel,
        amount,
        actorId,
        timestamp,
      });

      if (calculatedHash !== record.recordHash) {
        return {
          isValid: false,
          model: canonicalModel,
          totalVerified,
          genesisHash,
          brokenRecordId: recordId,
          brokenRecordIndex: totalVerified,
          error: `Tampered record detected at ${recordId}: calculated hash '${calculatedHash}' !== stored hash '${record.recordHash}'`,
          tamperedField: 'recordHash',
          expectedValue: calculatedHash,
          actualValue: record.recordHash,
          durationMs: Date.now() - startTime,
          verifiedAt: new Date(),
        };
      }

      expectedPreviousHash = record.recordHash;
      totalVerified++;
    }

    if (records.length < batchSize) {
      hasMore = false;
    } else {
      cursor = records[records.length - 1]!.id;
    }
  }

  return {
    isValid: true,
    model: canonicalModel,
    totalVerified,
    genesisHash,
    durationMs: Date.now() - startTime,
    verifiedAt: new Date(),
  };
}

/**
 * Universal ledger verifier supporting both in-memory arrays and database clients.
 */
export function verifyLedgerChain(
  records: ChainedRecord[],
  genesisHash?: string
): VerificationResult;
export function verifyLedgerChain(
  prisma: any,
  options?: VerifyLedgerChainOptions
): Promise<LedgerAuditReport>;
export function verifyLedgerChain(
  target: ChainedRecord[] | any,
  optionsOrGenesis?: string | VerifyLedgerChainOptions
): VerificationResult | Promise<LedgerAuditReport> {
  if (Array.isArray(target)) {
    return verifyLedgerChainMemory(
      target,
      typeof optionsOrGenesis === 'string' ? optionsOrGenesis : undefined
    );
  }
  return verifyLedgerChainDb(
    target,
    typeof optionsOrGenesis === 'object' ? optionsOrGenesis : undefined
  );
}

/**
 * Asserts that the ledger chain is 100% intact.
 * Throws CorruptedLedgerChainError on any tampering or gap.
 */
export async function assertLedgerChainIntegrity(
  prisma: any,
  options?: VerifyLedgerChainOptions
): Promise<LedgerAuditReport> {
  const report = await verifyLedgerChainDb(prisma, options);
  if (!report.isValid) {
    throw new CorruptedLedgerChainError(report);
  }
  return report;
}
