import { resolve } from 'node:path';
import { createResult, fail, isCliEntrypoint, printAndExit, readUtf8 } from './common.js';
import {
  DASHBOARD_ALLOWED_ROLES,
  DASHBOARD_AUTH_LINK_TTL_MINUTES,
  DASHBOARD_INITIAL_SESSION_HOURS,
  DASHBOARD_MAX_CONCURRENT_SESSIONS,
  DASHBOARD_MAX_SESSION_HOURS,
  DASHBOARD_REPLY_BUTTON_TEXT,
  DASHBOARD_SESSION_EXTENSION_HOURS,
} from '../../packages/rbac/src/dashboard-auth.js';

export async function verifyDashboardAuthContract(repoRoot = process.cwd()) {
  const result = createResult();

  // 1. Verify SSOT Contract constants
  result.checked++;
  if (DASHBOARD_REPLY_BUTTON_TEXT !== '🖥️ فتح لوحة التحكم') {
    fail(result, `DASHBOARD_REPLY_BUTTON_TEXT must be exactly '🖥️ فتح لوحة التحكم'`);
  }

  result.checked++;
  if (DASHBOARD_AUTH_LINK_TTL_MINUTES !== 5) {
    fail(result, `DASHBOARD_AUTH_LINK_TTL_MINUTES must be 5`);
  }

  result.checked++;
  if (DASHBOARD_INITIAL_SESSION_HOURS !== 8 || DASHBOARD_SESSION_EXTENSION_HOURS !== 8 || DASHBOARD_MAX_SESSION_HOURS !== 16) {
    fail(result, `Session durations must be 8h initial, 8h extension, 16h max ceiling`);
  }

  result.checked++;
  if (DASHBOARD_MAX_CONCURRENT_SESSIONS !== 3) {
    fail(result, `DASHBOARD_MAX_CONCURRENT_SESSIONS must be 3`);
  }

  result.checked++;
  const expectedRoles = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'];
  if (JSON.stringify(DASHBOARD_ALLOWED_ROLES) !== JSON.stringify(expectedRoles)) {
    fail(result, `DASHBOARD_ALLOWED_ROLES must be exactly ${JSON.stringify(expectedRoles)}`);
  }

  // 2. Verify Next.js Edge Middleware Safety (No Prisma/Node imports)
  const middlewarePath = resolve(repoRoot, 'apps/admin-dashboard/src/middleware.ts');
  const middlewareContent = readUtf8(middlewarePath);
  result.checked++;
  if (middlewareContent.includes('@alsaada/database') || middlewareContent.includes('prisma')) {
    fail(result, `apps/admin-dashboard/src/middleware.ts must NOT import @alsaada/database or prisma (Edge runtime violation)`);
  }
  if (!middlewareContent.includes('isValidOpaqueTokenFormat')) {
    fail(result, `apps/admin-dashboard/src/middleware.ts must validate opaque token format`);
  }

  // 3. Verify Server-Side Auth Guard (lib/auth.ts) is DB as SSOT with Fail-Closed
  const authLibPath = resolve(repoRoot, 'apps/admin-dashboard/src/lib/auth.ts');
  const authLibContent = readUtf8(authLibPath);
  result.checked++;
  if (!authLibContent.includes('prisma.dashboardSession.findUnique')) {
    fail(result, `apps/admin-dashboard/src/lib/auth.ts must query prisma.dashboardSession.findUnique as DB SSOT`);
  }
  if (authLibContent.includes('alsaada_admin_role') || authLibContent.includes('DEMO_USERS')) {
    fail(result, `apps/admin-dashboard/src/lib/auth.ts contains legacy alsaada_admin_role or DEMO_USERS simulation`);
  }

  // 4. Verify Single-Transaction Atomic Claim (claim/route.ts)
  const claimRoutePath = resolve(repoRoot, 'apps/admin-dashboard/src/app/api/auth/claim/route.ts');
  const claimContent = readUtf8(claimRoutePath);
  result.checked++;
  if (!claimContent.includes('prisma.$transaction')) {
    fail(result, `claim/route.ts must execute claim atomically inside prisma.$transaction`);
  }
  if (!claimContent.includes('isExactOriginMatch')) {
    fail(result, `claim/route.ts must enforce exact-origin verification via isExactOriginMatch`);
  }
  if (!claimContent.includes('FOR UPDATE')) {
    fail(result, `claim/route.ts must acquire row-level lock FOR UPDATE on users table to serialize concurrent claims`);
  }

  // 5. Verify Bot Server entrypoint and services
  const botPath = resolve(repoRoot, 'apps/bot-server/src/bot.ts');
  const botContent = readUtf8(botPath);
  result.checked++;
  if (botContent.includes("bot.command('dashboard'") || botContent.includes("'menu:exec:dashboard'")) {
    fail(result, `apps/bot-server/src/bot.ts contains legacy dashboard command or callback registration`);
  }
  if (!botContent.includes('bot.hears(DASHBOARD_REPLY_BUTTON_TEXT')) {
    fail(result, `apps/bot-server/src/bot.ts must register bot.hears(DASHBOARD_REPLY_BUTTON_TEXT, handleDashboardCommand)`);
  }

  const dashAuthServicePath = resolve(repoRoot, 'apps/bot-server/src/services/dashboard-auth.service.ts');
  const dashAuthContent = readUtf8(dashAuthServicePath);
  result.checked++;
  if (dashAuthContent.includes('generateMagicToken') || dashAuthContent.includes('MagicTokenPayload')) {
    fail(result, `apps/bot-server/src/services/dashboard-auth.service.ts contains legacy generateMagicToken/MagicTokenPayload`);
  }

  return result;
}

if (isCliEntrypoint(import.meta.url)) {
  const repoRoot = resolve(process.cwd());
  const res = await verifyDashboardAuthContract(repoRoot);
  printAndExit('dashboard-auth-contract:verify', res);
}
