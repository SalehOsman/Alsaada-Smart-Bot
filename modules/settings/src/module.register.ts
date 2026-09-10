import type { Bot } from 'grammy';
import type { SettingsModuleContext, SettingsModuleOptions } from './shared/module.types.js';
import { registerSettingsRoutes, type SettingsModuleHandlers } from './module.routes.js';

export function registerSettingsModule(
  bot: Bot<SettingsModuleContext>,
  options: SettingsModuleOptions
): SettingsModuleHandlers {
  return registerSettingsRoutes(bot, options);
}
