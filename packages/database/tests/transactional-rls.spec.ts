import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * 🔒 RLS (Row-Level Security) & SET LOCAL Connection Pool Bleed Prevention
 *
 * Requirements:
 * 1. SET LOCAL must be executed inside interactive transactions ($transaction(async tx => ...))
 * 2. Fail-closed default: if app.current_site_id is null/empty and role != GENERAL_ADMIN, 0 rows are returned
 * 3. Zero session bleed: SET LOCAL variables terminate strictly with transaction boundary
 */

const PINNED_BASE_TIME = new Date('2026-09-11T12:00:00.000Z');

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

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('enforces fail-closed default when no session context is provided', () => {
    // Arrange
    const uninitializedContext = undefined;

    // Act
    const isAllowed = pool.evaluateWorkerRlsPolicy(uninitializedContext, sampleWorkers[0]!);

    // Assert
    expect(isAllowed).toBe(false);
  });

  it('enforces fail-closed default when siteId is empty string or null', () => {
    // Arrange
    const contextWithNullSite = { siteId: null, role: 'FIELD_ADMIN' };
    const contextWithEmptySite = { siteId: '', role: 'FIELD_ADMIN' };

    // Act
    const isAllowedNull = pool.evaluateWorkerRlsPolicy(contextWithNullSite, sampleWorkers[0]!);
    const isAllowedEmpty = pool.evaluateWorkerRlsPolicy(contextWithEmptySite, sampleWorkers[0]!);

    // Assert
    expect(isAllowedNull).toBe(false);
    expect(isAllowedEmpty).toBe(false);
  });

  it('allows FIELD_ADMIN to access ONLY their assigned site workers', async () => {
    // Arrange
    const connId = 'conn-pool-1';
    let visibleWorkers: typeof sampleWorkers = [];

    // Act
    await pool.executeInTransaction(
      connId,
      { siteId: 'site-alpha', userId: 'usr-1', role: 'FIELD_ADMIN' },
      async (session) => {
        visibleWorkers = sampleWorkers.filter((w) => pool.evaluateWorkerRlsPolicy(session, w));
      }
    );

    // Assert
    expect(visibleWorkers).toHaveLength(1);
    expect(visibleWorkers[0]!.siteId).toBe('site-alpha');
    expect(visibleWorkers[0]!.name).toBe('عامل موقع ألفا');
    expect(visibleWorkers.some((w) => w.siteId === 'site-beta')).toBe(false);
  });

  it('allows GENERAL_ADMIN to access all sites', async () => {
    // Arrange
    const connId = 'conn-pool-2';
    let visibleWorkers: typeof sampleWorkers = [];

    // Act
    await pool.executeInTransaction(
      connId,
      { siteId: null, userId: 'usr-gen', role: 'GENERAL_ADMIN' },
      async (session) => {
        visibleWorkers = sampleWorkers.filter((w) => pool.evaluateWorkerRlsPolicy(session, w));
      }
    );

    // Assert
    expect(visibleWorkers).toHaveLength(2);
    expect(visibleWorkers.length).toBeGreaterThan(0);
  });

  it('prevents connection pool bleed with immediate session termination at transaction boundary', async () => {
    // Arrange
    const connId = 'conn-pool-reused-3';
    let sessionSiteInTx = '';

    // Act
    await pool.executeInTransaction(
      connId,
      { siteId: 'site-alpha', userId: 'usr-alpha', role: 'FIELD_ADMIN' },
      async (session) => {
        sessionSiteInTx = session.siteId ?? '';
      }
    );

    const contextAfterTx = pool.getConnectionContext(connId);
    const isAllowedAfterTx = pool.evaluateWorkerRlsPolicy(contextAfterTx, sampleWorkers[0]!);

    // Assert
    expect(sessionSiteInTx).toBe('site-alpha');
    expect(contextAfterTx).toBeUndefined();
    expect(isAllowedAfterTx).toBe(false);
  });
});
