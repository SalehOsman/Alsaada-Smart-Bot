import { Bot } from 'grammy';
import { MyContext } from './types/context.js';
import { config } from './config/env.js';
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
} from './handlers/sites-hub.handler.js';

export function createBot(): Bot<MyContext> {
  const token = config.botToken;
  if (!token || token === 'YOUR_NEW_BOT_TOKEN_HERE') {
    throw new Error('❌ [BOT FATAL] BOT_TOKEN is not set in .env. Please configure your bot token.');
  }

  const bot = new Bot<MyContext>(token);

  // 1. Error boundary
  bot.catch((err) => {
    console.error(`❌ [BOT ERROR] Error in update ${err.ctx?.update?.update_id}:`, err.error);
  });

  // 2. Authentication & Zero-Trust RBAC Middleware
  bot.use(authMiddleware);

  // 3. Pending Input Interceptors (Company Profile, Admin Profile, Sites Wizard)
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

  // 9. Admin Personal Profile Callbacks
  bot.callbackQuery('action:settings:admin_profile', async (ctx) => {
    await renderAdminProfileCard(ctx, true);
  });
  bot.callbackQuery(/^action:edit_admin:(.+)$/, async (ctx) => {
    const fieldKey = ctx.match[1];
    await handleStartEditAdminField(ctx, fieldKey);
  });

  // 10. System Health & Ghost Mode Callbacks
  bot.callbackQuery('action:settings:ghost_mode', handleGhostModeMenu);
  bot.callbackQuery('action:settings:ping', handlePing);
  bot.callbackQuery('action:exit_impersonate', handleExitImpersonate);

  // 11. Dynamic Impersonation Callbacks (Regex)
  bot.callbackQuery(/^action:impersonate:(.+)$/, async (ctx) => {
    const role = ctx.match[1];
    await handleImpersonateRole(ctx, role);
  });

  // 12. Sub-Menu Placeholders (Catch-all for unbuilt domain buttons)
  bot.callbackQuery(/^menu:.+$/, handleMenuPlaceholder);

  return bot;
}



