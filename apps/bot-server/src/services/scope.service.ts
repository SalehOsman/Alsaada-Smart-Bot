import { MyContext } from '../types/context.js';

/**
 * Returns the site ID that the current user is restricted to.
 * Returns null if the user has unrestricted global access (Super Admin, Executive, or unassigned Admin).
 */
export function getScopedSiteId(ctx: MyContext): string | null {
  if (ctx.effectiveRole === 'SUPER_ADMIN' || ctx.effectiveRole === 'EXECUTIVE') {
    return null;
  }
  return ctx.dbUser?.assignedSiteId || null;
}

/**
 * Builds a Prisma where condition scoped to the user's assigned site.
 * If field is 'siteId', returns { siteId: scopedSiteId } or {}.
 */
export function buildSiteScopeWhere(ctx: MyContext, fieldName = 'siteId'): Record<string, any> {
  const scopedSiteId = getScopedSiteId(ctx);
  if (!scopedSiteId) {
    return {};
  }
  return { [fieldName]: scopedSiteId };
}
