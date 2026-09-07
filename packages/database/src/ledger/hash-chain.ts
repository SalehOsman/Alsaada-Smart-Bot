import crypto from 'node:crypto';

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
 * Computes the SHA-256 cryptographic hash for a transaction.
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
 * Verifies a sequential chain of transaction records.
 * Returns valid if every record's hash matches and correctly points to its predecessor.
 */
export function verifyLedgerChain(records: ChainedRecord[], genesisHash = 'GENESIS_ALSAADA_LEDGER_2026'): VerificationResult {
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
