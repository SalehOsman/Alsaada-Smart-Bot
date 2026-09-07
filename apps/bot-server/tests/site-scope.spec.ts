import { describe, it, expect } from 'vitest';
import { getScopedSiteId, buildSiteScopeWhere } from '../src/services/scope.service.js';
import { MyContext } from '../src/types/context.js';

describe('Site-Scoped Authorization Service (RBAC Isolation)', () => {
  it('should grant global access (null scope) to Super Admin', () => {
    const mockCtx = {
      effectiveRole: 'SUPER_ADMIN',
      dbUser: { assignedSiteId: 'site-abc-123' },
    } as unknown as MyContext;

    expect(getScopedSiteId(mockCtx)).toBeNull();
    expect(buildSiteScopeWhere(mockCtx)).toEqual({});
  });

  it('should grant global access (null scope) to Executive', () => {
    const mockCtx = {
      effectiveRole: 'EXECUTIVE',
      dbUser: { assignedSiteId: 'site-abc-123' },
    } as unknown as MyContext;

    expect(getScopedSiteId(mockCtx)).toBeNull();
    expect(buildSiteScopeWhere(mockCtx)).toEqual({});
  });

  it('should strictly scope Field Admin to their assigned site', () => {
    const mockCtx = {
      effectiveRole: 'FIELD_ADMIN',
      dbUser: { assignedSiteId: 'site-kharga-01' },
    } as unknown as MyContext;

    expect(getScopedSiteId(mockCtx)).toBe('site-kharga-01');
    expect(buildSiteScopeWhere(mockCtx)).toEqual({ siteId: 'site-kharga-01' });
  });

  it('should support custom field name for scoping', () => {
    const mockCtx = {
      effectiveRole: 'SITE_ENGINEER',
      dbUser: { assignedSiteId: 'site-seb-02' },
    } as unknown as MyContext;

    expect(buildSiteScopeWhere(mockCtx, 'targetSiteId')).toEqual({
      targetSiteId: 'site-seb-02',
    });
  });

  it('should return empty where clause if non-admin has no assigned site', () => {
    const mockCtx = {
      effectiveRole: 'FIELD_ADMIN',
      dbUser: { assignedSiteId: null },
    } as unknown as MyContext;

    expect(getScopedSiteId(mockCtx)).toBeNull();
    expect(buildSiteScopeWhere(mockCtx)).toEqual({});
  });
});
