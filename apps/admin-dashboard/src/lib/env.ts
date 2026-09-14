import {
  validateDashboardAuthOrigins,
  type DashboardAuthOrigins,
} from '@alsaada/rbac';

/**
 * Edge-runtime safe environment configuration.
 * Next.js automatically injects .env and .env.local variables into process.env.
 */

function resolveTunnelUrl(): string {
  const rawDashboardUrl = process.env.DASHBOARD_URL || process.env.ADMIN_DASHBOARD_URL || '';
  const isLoopback =
    rawDashboardUrl.includes('localhost') ||
    rawDashboardUrl.includes('127.0.0.1') ||
    rawDashboardUrl.includes('localtest.me');
  return (
    process.env.DASHBOARD_TUNNEL_URL ||
    (rawDashboardUrl && !isLoopback ? rawDashboardUrl : 'https://panel.alsaada.org')
  ).replace(/\/+$/, '');
}

/**
 * Validates dashboard authentication environment variables against @alsaada/rbac SSOT contract.
 * Pure wrapper over validateDashboardAuthOrigins, fails fast on demand without crashing on module import.
 */
export function validateDashboardAuthEnv(): DashboardAuthOrigins {
  const localUrl = process.env.DASHBOARD_LOCAL_URL || 'http://localtest.me:3002';
  const tunnelUrl = resolveTunnelUrl();
  return validateDashboardAuthOrigins({ localUrl, tunnelUrl });
}

export const envConfig = {
  get DASHBOARD_LOCAL_URL(): string {
    return process.env.DASHBOARD_LOCAL_URL || 'http://localtest.me:3002';
  },
  get DASHBOARD_TUNNEL_URL(): string {
    return resolveTunnelUrl();
  },
  TELEGRAM_BOT_USERNAME: (process.env.TELEGRAM_BOT_USERNAME || process.env.BOT_USERNAME || 'Al_Saada_smart_bot').replace(/^@/, '').trim(),
  DASHBOARD_SESSION_TTL_HOURS: parseInt(process.env.DASHBOARD_SESSION_TTL_HOURS || '8', 10),
};

