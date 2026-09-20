import type { Prisma } from '../generated/client/index.js';

export class CustodyNotFoundError extends Error {
  constructor(custodyId: string) {
    super(`[CUSTODY_NOT_FOUND] Financial custody with ID '${custodyId}' was not found.`);
    this.name = 'CustodyNotFoundError';
  }
}

export class InsufficientCustodyBalanceError extends Error {
  constructor(custodyId: string, requestedAmount: number, availableBalance: number) {
    super(
      `[INSUFFICIENT_CUSTODY_BALANCE] Custody '${custodyId}' has balance ${availableBalance}, which is insufficient for deduction of ${requestedAmount}.`
    );
    this.name = 'InsufficientCustodyBalanceError';
  }
}

export class CustodyInactiveError extends Error {
  constructor(custodyId: string, status: string) {
    super(`[CUSTODY_INACTIVE] Custody '${custodyId}' is not active (status: ${status}). Operations are forbidden.`);
    this.name = 'CustodyInactiveError';
  }
}

export interface CustodyRecord {
  id: string;
  custodyNumber: string;
  siteId: string;
  custodianWorkerId: string;
  initialAmount: Prisma.Decimal | number;
  currentBalance: Prisma.Decimal | number;
  totalLiquidatedExpenses: Prisma.Decimal | number;
  totalCashAdvancesDisbursed: Prisma.Decimal | number;
  purpose: string;
  status: string;
  disbursedAt: Date;
  closedAt: Date | null;
  disbursedFromTreasuryId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustodyDeductParams {
  custodyId: string;
  amount: number | Prisma.Decimal;
  transactionType?: 'ADVANCE' | 'EXPENSE' | string;
  purpose?: string;
}

export interface CustodyRefundParams {
  custodyId: string;
  amount: number | Prisma.Decimal;
  reason?: string;
  transactionType?: 'ADVANCE' | 'EXPENSE' | string;
}

/**
 * 🏛️ CustodyTransactionRepository
 *
 * Implements atomic, row-level locking (SELECT ... FOR UPDATE) and conditional
 * deduction (WHERE "currentBalance" >= $amount AND "status" = 'ACTIVE') to eliminate
 * race conditions and ensure forensic accounting integrity.
 */
export class CustodyTransactionRepository {
  constructor(private readonly prisma: any) {}

  /**
   * Retrieves custody row and acquires exclusive row lock (SELECT ... FOR UPDATE)
   * within an interactive transaction.
   * tx is mandatory to guarantee the row lock is held within a transaction.
   */
  async findAndLock(custodyId: string, tx: any): Promise<CustodyRecord | null> {
    if (!tx) {
      throw new Error(
        `[TRANSACTION_REQUIRED] findAndLock requires an active interactive transaction client (tx) to hold the row-level lock (FOR UPDATE).`
      );
    }
    const rows = await tx.$queryRawUnsafe(
      `SELECT * FROM "financial_custodies" WHERE "id" = $1 FOR UPDATE`,
      custodyId
    );
    return Array.isArray(rows) && rows.length > 0 ? (rows[0] as CustodyRecord) : null;
  }

  /**
   * Conditionally and atomically deducts funds from the custody:
   * WHERE "currentBalance" >= $amount AND "status" = 'ACTIVE'
   *
   * Increments totalCashAdvancesDisbursed (for advances) or totalLiquidatedExpenses (for expenses),
   * increments optimistic locking version, and updates timestamp.
   */
  async deductFunds(params: CustodyDeductParams, tx?: any): Promise<CustodyRecord> {
    if (!tx && typeof this.prisma?.$transaction === 'function') {
      return this.prisma.$transaction(async (txClient: any) => {
        return this.deductFunds(params, txClient);
      });
    }

    const client = tx ?? this.prisma;
    const amountNum = typeof params.amount === 'number' ? params.amount : Number(params.amount);
    if (amountNum <= 0 || isNaN(amountNum)) {
      throw new Error(`[INVALID_CUSTODY_AMOUNT] Deduction amount must be a positive number greater than 0.`);
    }

    // Inspect under row lock for fine-grained forensic diagnostics
    const existing = await this.findAndLock(params.custodyId, client);
    if (!existing) {
      throw new CustodyNotFoundError(params.custodyId);
    }
    if (existing.status !== 'ACTIVE') {
      throw new CustodyInactiveError(params.custodyId, existing.status);
    }

    const currentBal = Number(existing.currentBalance);
    if (currentBal < amountNum) {
      throw new InsufficientCustodyBalanceError(params.custodyId, amountNum, currentBal);
    }

    const isExpense = String(params.transactionType || '').toUpperCase() === 'EXPENSE';
    const expenseIncrement = isExpense ? amountNum : 0;
    const advanceIncrement = isExpense ? 0 : amountNum;

    // Atomic conditional SQL mutation
    const updatedRows = await client.$queryRawUnsafe(
      `UPDATE "financial_custodies"
       SET "currentBalance" = "currentBalance" - $1,
           "totalLiquidatedExpenses" = "totalLiquidatedExpenses" + $2,
           "totalCashAdvancesDisbursed" = "totalCashAdvancesDisbursed" + $3,
           "version" = "version" + 1,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $4
         AND "currentBalance" >= $1
         AND "status" = 'ACTIVE'
       RETURNING *`,
      amountNum,
      expenseIncrement,
      advanceIncrement,
      params.custodyId
    );

    if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
      const recheck = await this.findAndLock(params.custodyId, client);
      if (!recheck) throw new CustodyNotFoundError(params.custodyId);
      if (recheck.status !== 'ACTIVE') throw new CustodyInactiveError(params.custodyId, recheck.status);
      throw new InsufficientCustodyBalanceError(params.custodyId, amountNum, Number(recheck.currentBalance));
    }

    return updatedRows[0] as CustodyRecord;
  }

  /**
   * Atomically refunds funds back to the active custody balance.
   * Decrements cumulative advances or expenses if transactionType is provided.
   */
  async refundFunds(params: CustodyRefundParams, tx?: any): Promise<CustodyRecord> {
    if (!tx && typeof this.prisma?.$transaction === 'function') {
      return this.prisma.$transaction(async (txClient: any) => {
        return this.refundFunds(params, txClient);
      });
    }

    const client = tx ?? this.prisma;
    const amountNum = typeof params.amount === 'number' ? params.amount : Number(params.amount);
    if (amountNum <= 0 || isNaN(amountNum)) {
      throw new Error(`[INVALID_CUSTODY_AMOUNT] Refund amount must be a positive number greater than 0.`);
    }

    const existing = await this.findAndLock(params.custodyId, client);
    if (!existing) {
      throw new CustodyNotFoundError(params.custodyId);
    }
    if (existing.status !== 'ACTIVE') {
      throw new CustodyInactiveError(params.custodyId, existing.status);
    }

    const txType = String(params.transactionType || '').toUpperCase();
    const isExpense = txType === 'EXPENSE';
    const isAdvance = txType === 'ADVANCE';
    const expenseDecrement = isExpense ? amountNum : 0;
    const advanceDecrement = isAdvance ? amountNum : 0;

    const updatedRows = await client.$queryRawUnsafe(
      `UPDATE "financial_custodies"
       SET "currentBalance" = "currentBalance" + $1,
           "totalLiquidatedExpenses" = GREATEST(0, "totalLiquidatedExpenses" - $2),
           "totalCashAdvancesDisbursed" = GREATEST(0, "totalCashAdvancesDisbursed" - $3),
           "version" = "version" + 1,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $4
         AND "status" = 'ACTIVE'
       RETURNING *`,
      amountNum,
      expenseDecrement,
      advanceDecrement,
      params.custodyId
    );

    if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
      const recheck = await this.findAndLock(params.custodyId, client);
      if (!recheck) throw new CustodyNotFoundError(params.custodyId);
      if (recheck.status !== 'ACTIVE') throw new CustodyInactiveError(params.custodyId, recheck.status);
      throw new Error(`[CUSTODY_REFUND_FAILED] Failed to refund ${amountNum} to custody '${params.custodyId}'.`);
    }

    return updatedRows[0] as CustodyRecord;
  }
}
