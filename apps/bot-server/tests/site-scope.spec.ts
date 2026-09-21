import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getScopedSiteId, buildSiteScopeWhere } from '../src/services/scope.service.js';
import type { MyContext } from '../src/types/context.js';

const PINNED_BASE_TIME = new Date('2026-09-21T12:00:00.000Z');

describe('Site-Scoped Authorization Service (RBAC Isolation)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('grants global access (null scope) to Super Admin', () => {
    // Arrange
    const mockCtx = {
      effectiveRole: 'SUPER_ADMIN',
      dbUser: { assignedSiteId: 'site-abc-123' },
    } as unknown as MyContext;

    // Act
    const scopedSiteId = getScopedSiteId(mockCtx);
    const scopeWhere = buildSiteScopeWhere(mockCtx);

    // Assert
    expect(scopedSiteId).toBeNull();
    expect(scopedSiteId).not.toBe('site-abc-123');
    expect(scopeWhere).toEqual({});
    expect(scopeWhere).not.toHaveProperty('siteId');
  });

  it('grants global access (null scope) to General Admin', () => {
    // Arrange
    const mockCtx = {
      effectiveRole: 'GENERAL_ADMIN',
      dbUser: { assignedSiteId: 'site-abc-123' },
    } as unknown as MyContext;

    // Act
    const scopedSiteId = getScopedSiteId(mockCtx);
    const scopeWhere = buildSiteScopeWhere(mockCtx);

    // Assert
    expect(scopedSiteId).toBeNull();
    expect(scopedSiteId).not.toBe('site-abc-123');
    expect(scopeWhere).toEqual({});
    expect(scopeWhere).not.toHaveProperty('siteId');
  });

  it('strictly scopes Field Admin to their assigned site', () => {
    // Arrange
    const mockCtx = {
      effectiveRole: 'FIELD_ADMIN',
      dbUser: { assignedSiteId: 'site-kharga-01' },
    } as unknown as MyContext;

    // Act
    const scopedSiteId = getScopedSiteId(mockCtx);
    const scopeWhere = buildSiteScopeWhere(mockCtx);

    // Assert
    expect(scopedSiteId).toBe('site-kharga-01');
    expect(scopedSiteId).not.toBeNull();
    expect(scopeWhere).toEqual({ siteId: 'site-kharga-01' });
    expect(scopeWhere).not.toEqual({});
  });

  it('supports custom field name for scoping', () => {
    // Arrange
    const mockCtx = {
      effectiveRole: 'FIELD_ADMIN',
      dbUser: { assignedSiteId: 'site-seb-02' },
    } as unknown as MyContext;

    // Act
    const scopeWhere = buildSiteScopeWhere(mockCtx, 'targetSiteId');

    // Assert
    expect(scopeWhere).toEqual({
      targetSiteId: 'site-seb-02',
    });
    expect(scopeWhere).not.toHaveProperty('siteId');
  });

  it('returns empty where clause if non-admin has no assigned site', () => {
    // Arrange
    const mockCtx = {
      effectiveRole: 'FIELD_ADMIN',
      dbUser: { assignedSiteId: null },
    } as unknown as MyContext;

    // Act
    const scopedSiteId = getScopedSiteId(mockCtx);
    const scopeWhere = buildSiteScopeWhere(mockCtx);

    // Assert
    expect(scopedSiteId).toBeNull();
    expect(scopedSiteId).not.toBe('site-kharga-01');
    expect(scopeWhere).toEqual({});
    expect(scopeWhere).not.toHaveProperty('siteId');
  });
});
