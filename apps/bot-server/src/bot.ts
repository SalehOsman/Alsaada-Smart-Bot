import dns from 'node:dns';

// Fix for Egyptian ISP IPv6 routing blackhole: prioritize IPv4 to eliminate 1.5s - 3s DNS timeouts
dns.setDefaultResultOrder('ipv4first');

import { Agent as UndiciAgent, setGlobalDispatcher } from 'undici';
import { Bot } from 'grammy';
import { MyContext } from './types/context.js';
import { config } from './config/env.js';

// High-Performance TCP/TLS Connection Pool for Telegram Bot API (Reuses TLS connections for sub-second responses)
export const undiciDispatcher = new UndiciAgent({
  keepAliveTimeout: 60000,
  keepAliveMaxTimeout: 600000,
  connections: 50,
  pipelining: 1,
  connect: {
    timeout: 10000,
    keepAlive: true,
  },
});
setGlobalDispatcher(undiciDispatcher);
import { authMiddleware } from './middlewares/auth.middleware.js';
import { handleStart, renderRoleHome } from './handlers/start.handler.js';
import { handlePing } from './handlers/ping.handler.js';
import {
  handleSettings,
  handleSettingsSubCorporate,
  handleSettingsSubIdentity,
  handleSettingsSubSystem,
  handleGhostModeMenu,
  handleImpersonateRole,
  handleExitImpersonate,
  handleExitGhostCommand,
} from './handlers/settings.handler.js';
import { handleMenuPlaceholder } from './handlers/placeholder.handler.js';
import {
  renderCompanyProfileCard,
  handleStartEditCompanyField,
  handleCompanyFieldTextInput,
} from './handlers/company-profile.handler.js';
import {
  renderAdminProfileCard,
  handleStartEditAdminField,
  handleAdminFieldTextInput,
} from './handlers/admin-profile.handler.js';
import {
  renderSitesHub,
  renderSiteDetail,
  handleToggleSiteStatus,
  handleStartAddSite,
  handleSiteTextInput,
  handleSiteLocationInput,
  handleStartEditSiteField,
  handleSetSiteGeofence,
  handleConfirmSiteCode,
  handleSelectSiteGov,
} from './handlers/sites-hub.handler.js';
import {
  renderAdminAssignmentsHub,
  renderUserAssignmentCard,
  handleSetUserSiteAssignment,
} from './handlers/admin-assignment.handler.js';

export function createBot(): Bot<MyContext> {
  const token = config.botToken;
  if (!token || token === 'YOUR_NEW_BOT_TOKEN_HERE') {
    throw new Error('❌ [BOT FATAL] BOT_TOKEN is not set in .env. Please configure your bot token.');
  }

  const bot = new Bot<MyContext>(token, {
    client: {
      baseFetchConfig: {
        compress: true,
        dispatcher: undiciDispatcher,
      } as any,
    },
  });

  // 1. Error boundary
  bot.catch((err) => {
    console.error(`❌ [BOT ERROR] Error in update ${err.ctx?.update?.update_id}:`, err.error);
  });

  // 2. Authentication & Zero-Trust RBAC Middleware
  bot.use(authMiddleware);

  // 3. Ultra-Fast Non-Blocking Callback Query Acknowledgment
  bot.on('callback_query', async (ctx, next) => {
    // Immediately acknowledge callback query in background to remove button spinner without blocking
    void ctx.answerCallbackQuery().catch(() => {});
    return next();
  });

  // 4. Pending Input Interceptors (Company Profile, Admin Profile, Sites Wizard, GPS Location)
  bot.on('message:location', async (ctx, next) => {
    if (await handleSiteLocationInput(ctx)) return;
    return next();
  });

  bot.on('message:text', async (ctx, next) => {
    if (await handleCompanyFieldTextInput(ctx)) return;
    if (await handleAdminFieldTextInput(ctx)) return;
    if (await handleSiteTextInput(ctx)) return;
    return next();
  });

  // 4. Base Commands
  bot.command('start', handleStart);
  bot.command(['ping', 'health', 'speed'], handlePing);
  bot.command(['settings', 'admin'], handleSettings);
  bot.command(['company', 'org'], async (ctx) => {
    await renderCompanyProfileCard(ctx, false);
  });
  bot.command(['me', 'profile'], async (ctx) => {
    await renderAdminProfileCard(ctx, false);
  });
  bot.command(['sites', 'projects'], async (ctx) => {
    await renderSitesHub(ctx, false);
  });
  bot.command(['exit_ghost', 'exit_impersonate', 'exit_simulation'], handleExitGhostCommand);

  // 5. Navigation & Main Settings Callbacks
  bot.callbackQuery('action:main_menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderRoleHome(ctx, true);
  });
  bot.callbackQuery('menu:super_admin_settings', handleSettings);

  // 6. Settings Sub-Category Callbacks
  bot.callbackQuery('action:settings_sub:corporate', handleSettingsSubCorporate);
  bot.callbackQuery('action:settings_sub:identity', handleSettingsSubIdentity);
  bot.callbackQuery('action:settings_sub:system', handleSettingsSubSystem);

  // 7. Corporate & Company Profile Callbacks
  bot.callbackQuery('action:settings:company_profile', async (ctx) => {
    await renderCompanyProfileCard(ctx, true);
  });
  bot.callbackQuery(/^action:edit_comp:(.+)$/, async (ctx) => {
    const fieldKey = ctx.match[1];
    await handleStartEditCompanyField(ctx, fieldKey);
  });

  // 8. Sites & Projects Hub Callbacks
  bot.callbackQuery('action:settings:sites_hub', async (ctx) => {
    await renderSitesHub(ctx, true);
  });
  bot.callbackQuery(/^action:site:view:(.+)$/, async (ctx) => {
    const siteCode = ctx.match[1];
    await renderSiteDetail(ctx, siteCode, true);
  });
  bot.callbackQuery(/^action:site:toggle:(.+)$/, async (ctx) => {
    const siteCode = ctx.match[1];
    await handleToggleSiteStatus(ctx, siteCode);
  });
  bot.callbackQuery('action:site:add_new', handleStartAddSite);
  bot.callbackQuery(/^action:site:edit:(.+):(.+)$/, async (ctx) => {
    const fieldKey = ctx.match[1];
    const siteCode = ctx.match[2];
    await handleStartEditSiteField(ctx, fieldKey, siteCode);
  });
  bot.callbackQuery(/^action:site:set_geo(?:fence)?:(.+):(\d+)$/, async (ctx) => {
    const siteCode = ctx.match[1];
    const radius = parseInt(ctx.match[2], 10);
    await handleSetSiteGeofence(ctx, siteCode, radius);
  });
  bot.callbackQuery(/^action:site:confirm_code:(.+)$/, async (ctx) => {
    const confirmedCode = ctx.match[1];
    await handleConfirmSiteCode(ctx, confirmedCode);
  });
  bot.callbackQuery(/^action:site:set_gov:(.+):(.+)$/, async (ctx) => {
    const siteCode = ctx.match[1];
    const govName = ctx.match[2];
    await handleSelectSiteGov(ctx, siteCode, govName);
  });

  // 9. Admin Personal Profile Callbacks
  bot.callbackQuery('action:settings:admin_profile', async (ctx) => {
    await renderAdminProfileCard(ctx, true);
  });
  bot.callbackQuery(/^action:edit_admin:(.+)$/, async (ctx) => {
    const fieldKey = ctx.match[1];
    await handleStartEditAdminField(ctx, fieldKey);
  });

  // 10. Admin Site Assignments & Scoping Callbacks
  bot.callbackQuery('action:settings:admin_assignments', async (ctx) => {
    await renderAdminAssignmentsHub(ctx, true);
  });
  bot.callbackQuery(/^action:admin_assign:user:(\d+)$/, async (ctx) => {
    const targetTelegramId = BigInt(ctx.match[1]);
    await renderUserAssignmentCard(ctx, targetTelegramId, true);
  });
  bot.callbackQuery(/^action:admin_assign:set:(\d+):(.+)$/, async (ctx) => {
    const targetTelegramId = BigInt(ctx.match[1]);
    const siteIdOrGlobal = ctx.match[2];
    await handleSetUserSiteAssignment(ctx, targetTelegramId, siteIdOrGlobal);
  });

  // 11. System Health & Ghost Mode Callbacks
  bot.callbackQuery('action:settings:ghost_mode', handleGhostModeMenu);
  bot.callbackQuery('action:settings:ping', handlePing);
  bot.callbackQuery('action:exit_impersonate', handleExitImpersonate);

  // 12. Dynamic Impersonation Callbacks (Regex)
  bot.callbackQuery(/^action:impersonate:(.+)$/, async (ctx) => {
    const role = ctx.match[1];
    await handleImpersonateRole(ctx, role);
  });

  // 13. Sub-Menu Placeholders (Catch-all for unbuilt domain buttons)
  bot.callbackQuery(/^menu:.+$/, handleMenuPlaceholder);

  return bot;
}
