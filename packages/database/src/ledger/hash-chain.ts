import crypto from 'node:crypto';

export const GENESIS_HASH = 'GENESIS_ALSAADA_LEDGER_2026';

export interface RecordHashPayload {
  previousHash?: string;
  voucherNumber?: string;
  transactionType?: string;
  amount: number | string;
  currency?: string;
  sourceAccount?: string;
  destinationAccount?: string;
  beneficiaryId?: string;
  actorTelegramId?: string | number | bigint;
  actorId?: string | number | bigint;
  timestamp: string | Date;
  model?: string;
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
  voucherNumber?: string;
  beneficiaryId?: string;
  actorId?: string | number | bigint;
  model?: string;
}

/**
 * Computes canonical closed 10-field SHA-256 hash according to Plan 74 forensic genesis standard:
 * Hash_n = SHA256(Hash_{n-1} : voucherNumber : transactionType : normalizedAmount : currency : sourceAccount : destinationAccount : beneficiaryId : actorTelegramId : timestamp)
 */
export function computeRecordHash(payload: RecordHashPayload): string {
  const ts = payload.timestamp instanceof Date ? payload.timestamp.toISOString() : String(payload.timestamp);
  const normalizedAmount = typeof payload.amount === 'number'
    ? payload.amount.toFixed(2)
    : Number(payload.amount || 0).toFixed(2);
  const normalizedPrev = (payload.previousHash && payload.previousHash.trim() !== '')
    ? payload.previousHash
    : GENESIS_HASH;
  const voucherNumber = payload.voucherNumber !== undefined && payload.voucherNumber !== null
    ? String(payload.voucherNumber)
    : '';
  const transactionType = payload.transactionType !== undefined && payload.transactionType !== null
    ? String(payload.transactionType)
    : (payload.model !== undefined && payload.model !== null ? String(payload.model) : '');
  const currency = payload.currency !== undefined && payload.currency !== null
    ? String(payload.currency).toUpperCase()
    : 'EGP';
  const sourceAccount = payload.sourceAccount !== undefined && payload.sourceAccount !== null
    ? String(payload.sourceAccount)
    : '';
  const destinationAccount = payload.destinationAccount !== undefined && payload.destinationAccount !== null
    ? String(payload.destinationAccount)
    : '';
  const beneficiaryId = payload.beneficiaryId !== undefined && payload.beneficiaryId !== null
    ? String(payload.beneficiaryId)
    : '';
  const actorTelegramId = payload.actorTelegramId !== undefined && payload.actorTelegramId !== null
    ? String(payload.actorTelegramId)
    : (payload.actorId !== undefined && payload.actorId !== null ? String(payload.actorId) : 'system');

  const canonicalString = [
    normalizedPrev,
    voucherNumber,
    transactionType,
    normalizedAmount,
    currency,
    sourceAccount,
    destinationAccount,
    beneficiaryId,
    actorTelegramId,
    ts,
  ].join(':');

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

    // 2. Verify record hash integrity (canonical 10-field check, fallback to legacy pipe-hash)
    let calculatedHash = computeRecordHash(record);
    if (calculatedHash !== record.recordHash) {
      const legacyHash = computeTransactionHash(record);
      if (legacyHash === record.recordHash) {
        calculatedHash = legacyHash;
      }
    }
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
