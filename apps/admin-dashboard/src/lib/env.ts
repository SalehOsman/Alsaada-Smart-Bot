/**
 * Edge-runtime safe environment configuration.
 * Next.js automatically injects .env and .env.local variables into process.env.
 */

const rawDashboardUrl = process.env.DASHBOARD_URL || process.env.ADMIN_DASHBOARD_URL || '';
const localUrl = (process.env.DASHBOARD_LOCAL_URL || 'http://localhost:3002').replace(/\/+$/, '');
const rawTunnelUrl =
  process.env.DASHBOARD_TUNNEL_URL ||
  (rawDashboardUrl && !rawDashboardUrl.includes('localhost') ? rawDashboardUrl : '') ||
  localUrl;

export const envConfig = {
  DASHBOARD_LOCAL_URL: localUrl,
  DASHBOARD_TUNNEL_URL: rawTunnelUrl.replace(/\/+$/, ''),
  TELEGRAM_BOT_USERNAME: (process.env.TELEGRAM_BOT_USERNAME || process.env.BOT_USERNAME || 'Al_Saada_smart_bot').replace(/^@/, '').trim(),
  DASHBOARD_AUTH_LINK_SECRET: process.env.DASHBOARD_AUTH_LINK_SECRET || process.env.DATABASE_ENCRYPTION_KEY || 'sovereign-dashboard-secret-32-chars',
  DASHBOARD_AUTH_LINK_TTL_MINUTES: parseInt(process.env.DASHBOARD_AUTH_LINK_TTL_MINUTES || '5', 10),
  DASHBOARD_SESSION_TTL_HOURS: parseInt(process.env.DASHBOARD_SESSION_TTL_HOURS || '8', 10),
  DASHBOARD_SESSION_NOTICE_MINUTES: parseInt(process.env.DASHBOARD_SESSION_NOTICE_MINUTES || '60', 10),
  DASHBOARD_SESSION_EXTENSION_HOURS: parseInt(process.env.DASHBOARD_SESSION_EXTENSION_HOURS || '8', 10),
};
