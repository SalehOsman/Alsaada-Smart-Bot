import crypto from 'node:crypto';

export const GENESIS_HASH = 'GENESIS_ALSAADA_LEDGER_2026';

export interface RecordHashPayload {
  previousHash: string;
  model: string;
  amount: number | string;
  actorId: string | number | bigint;
  timestamp: string | Date;
}

export interface TransactionHashPayload {
  id: string;
  previousHash: string;
  timestamp: string | Date;
  amount: number;
  currency: string;
  transactionType: string;
  sourceAccount: string;
  destinationAccount: string;
  actorTelegramId: string;
}

export interface ChainedRecord extends TransactionHashPayload {
  recordHash: string;
}

/**
 * Computes canonical SHA-256 hash according to Plan 13 & enterprise integrity mandate:
 * recordHash = SHA-256(previousHash + ":" + model + ":" + amount + ":" + actorId + ":" + timestamp)
 */
export function computeRecordHash(payload: RecordHashPayload): string {
  const ts = payload.timestamp instanceof Date ? payload.timestamp.toISOString() : String(payload.timestamp);
  const normalizedAmount = typeof payload.amount === 'number'
    ? payload.amount.toFixed(2)
    : Number(payload.amount || 0).toFixed(2);
  const normalizedActor = String(payload.actorId);
  const normalizedPrev = payload.previousHash || GENESIS_HASH;

  const canonicalString = `${normalizedPrev}:${payload.model}:${normalizedAmount}:${normalizedActor}:${ts}`;
  return crypto.createHash('sha256').update(canonicalString).digest('hex');
}

/**
 * Legacy / In-memory transaction hash computation (preserved for backward compatibility).
 */
export function computeTransactionHash(payload: TransactionHashPayload): string {
  const ts = payload.timestamp instanceof Date ? payload.timestamp.toISOString() : payload.timestamp;
  const canonicalString = [
    payload.id,
    payload.previousHash,
    ts,
    payload.amount.toFixed(2),
    payload.currency.toUpperCase(),
    payload.transactionType,
    payload.sourceAccount,
    payload.destinationAccount,
    payload.actorTelegramId,
  ].join('|');

  return crypto.createHash('sha256').update(canonicalString).digest('hex');
}

export interface VerificationResult {
  isValid: boolean;
  totalVerified: number;
  brokenRecordId?: string;
  error?: string;
}

/**
 * Verifies an in-memory sequential chain of transaction records.
 * Returns valid if every record's hash matches and correctly points to its predecessor.
 */
export function verifyLedgerChainMemory(
  records: ChainedRecord[],
  genesisHash = GENESIS_HASH
): VerificationResult {
  if (records.length === 0) {
    return { isValid: true, totalVerified: 0 };
  }

  let expectedPreviousHash = genesisHash;

  for (let i = 0; i < records.length; i++) {
    const record = records[i]!;

    // 1. Verify previous hash pointer
    if (record.previousHash !== expectedPreviousHash) {
      return {
        isValid: false,
        totalVerified: i,
        brokenRecordId: record.id,
        error: `Broken chain link at record ${record.id}: expected prev_hash ${expectedPreviousHash}, got ${record.previousHash}`,
      };
    }

    // 2. Verify record hash integrity
    const calculatedHash = computeTransactionHash(record);
    if (calculatedHash !== record.recordHash) {
      return {
        isValid: false,
        totalVerified: i,
        brokenRecordId: record.id,
        error: `Tampered record detected at ${record.id}: calculated hash ${calculatedHash} !== stored hash ${record.recordHash}`,
      };
    }

    // Advance chain pointer
    expectedPreviousHash = record.recordHash;
  }

  return {
    isValid: true,
    totalVerified: records.length,
  };
}
