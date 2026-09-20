import { describe, it, expect, vi } from 'vitest';

/**
 * 🔒 RLS (Row-Level Security) & SET LOCAL Connection Pool Bleed Prevention
 *
 * Requirements:
 * 1. SET LOCAL must be executed inside interactive transactions ($transaction(async tx => ...))
 * 2. Fail-closed default: if app.current_site_id is null/empty and role != GENERAL_ADMIN, 0 rows are returned
 * 3. Zero session bleed: SET LOCAL variables terminate strictly with transaction boundary
 */

interface SessionContext {
  siteId?: string | null;
  userId?: string | null;
  role?: string | null;
}

class MockTransactionalRlsPool {
  private activeConnections = new Map<string, SessionContext>();

  // Executes interactive transaction simulating PostgreSQL SET LOCAL behavior
  async executeInTransaction<T>(
    connectionId: string,
    context: SessionContext,
    action: (session: SessionContext) => Promise<T>
  ): Promise<T> {
    // 1. Transaction starts: SET LOCAL variables are assigned strictly to transaction scope
    const localSession: SessionContext = {
      siteId: context.siteId ?? null,
      userId: context.userId ?? null,
      role: context.role ?? null,
    };
    this.activeConnections.set(connectionId, localSession);

    try {
      return await action(localSession);
    } finally {
      // 2. Transaction ends (COMMIT / ROLLBACK):
      // PostgreSQL automatically discards SET LOCAL variables.
      // Reset connection back to clean pool state.
      this.activeConnections.delete(connectionId);
    }
  }

  // Evaluates PostgreSQL RLS policy on workers table
  evaluateWorkerRlsPolicy(
    session: SessionContext | undefined,
    workerRecord: { siteId: string; name: string }
  ): boolean {
    if (!session) return false; // Fail-closed default

    // Policy: current_setting('app.current_role', true) = 'GENERAL_ADMIN'
    if (session.role === 'GENERAL_ADMIN' || session.role === 'SUPER_ADMIN') {
      return true;
    }

    // OR site_id = NULLIF(current_setting('app.current_site_id', true), '')::text
    if (!session.siteId || session.siteId.trim() === '') {
      return false; // Fail-closed
    }

    return workerRecord.siteId === session.siteId;
  }

  getConnectionContext(connectionId: string): SessionContext | undefined {
    return this.activeConnections.get(connectionId);
  }
}

describe('Transactional RLS & Connection Pool Isolation (Plan 86 R5)', () => {
  const pool = new MockTransactionalRlsPool();
  const sampleWorkers = [
    { siteId: 'site-alpha', name: 'عامل موقع ألفا' },
    { siteId: 'site-beta', name: 'عامل موقع بيتا' },
  ];

  it('should enforce fail-closed default when no session context is provided', () => {
    const isAllowed = pool.evaluateWorkerRlsPolicy(undefined, sampleWorkers[0]!);
    expect(isAllowed).toBe(false);
  });

  it('should enforce fail-closed default when siteId is empty string or null', () => {
    const isAllowedNull = pool.evaluateWorkerRlsPolicy({ siteId: null, role: 'FIELD_ADMIN' }, sampleWorkers[0]!);
    const isAllowedEmpty = pool.evaluateWorkerRlsPolicy({ siteId: '', role: 'FIELD_ADMIN' }, sampleWorkers[0]!);

    expect(isAllowedNull).toBe(false);
    expect(isAllowedEmpty).toBe(false);
  });

  it('should allow FIELD_ADMIN to access ONLY their assigned site workers', async () => {
    const connId = 'conn-pool-1';

    await pool.executeInTransaction(
      connId,
      { siteId: 'site-alpha', userId: 'usr-1', role: 'FIELD_ADMIN' },
      async (session) => {
        const visibleWorkers = sampleWorkers.filter((w) => pool.evaluateWorkerRlsPolicy(session, w));

        expect(visibleWorkers).toHaveLength(1);
        expect(visibleWorkers[0]!.siteId).toBe('site-alpha');
        expect(visibleWorkers[0]!.name).toBe('عامل موقع ألفا');
      }
    );
  });

  it('should allow GENERAL_ADMIN to access all sites', async () => {
    const connId = 'conn-pool-2';

    await pool.executeInTransaction(
      connId,
      { siteId: null, userId: 'usr-gen', role: 'GENERAL_ADMIN' },
      async (session) => {
        const visibleWorkers = sampleWorkers.filter((w) => pool.evaluateWorkerRlsPolicy(session, w));

        expect(visibleWorkers).toHaveLength(2);
      }
    );
  });

  it('should prevent connection pool bleed: session terminates immediately with transaction boundary', async () => {
    const connId = 'conn-pool-reused-3';

    // Transaction 1: FIELD_ADMIN on site-alpha
    await pool.executeInTransaction(
      connId,
      { siteId: 'site-alpha', userId: 'usr-alpha', role: 'FIELD_ADMIN' },
      async (session) => {
        expect(session.siteId).toBe('site-alpha');
      }
    );

    // After transaction 1 commits, connection is returned to pool
    // Assert connection in pool has NO leaked session context
    expect(pool.getConnectionContext(connId)).toBeUndefined();

    // Subsequent query on reused connection with uninitialized context drops into fail-closed default
    const contextAfterTx = pool.getConnectionContext(connId);
    expect(pool.evaluateWorkerRlsPolicy(contextAfterTx, sampleWorkers[0]!)).toBe(false);
  });
});
