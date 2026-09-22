import type { Bot } from 'grammy';
import type { AppModuleDefinition, ModuleRuntimeContext } from '@alsaada/core-components';
import type { SettingsModuleContext, SettingsModuleOptions } from './shared/module.types.js';
import { registerSettingsRoutes, type SettingsModuleHandlers } from './module.routes.js';

export function registerSettingsModule(
  bot: Bot<SettingsModuleContext>,
  options: SettingsModuleOptions
): SettingsModuleHandlers {
  return registerSettingsRoutes(bot, options);
}

export function createSettingsAppModule(
  runtime: ModuleRuntimeContext<SettingsModuleContext>,
  options?: Partial<SettingsModuleOptions>
): AppModuleDefinition<SettingsModuleContext> & { handlers?: SettingsModuleHandlers } {
  let handlers: SettingsModuleHandlers | undefined;

  const appModule: AppModuleDefinition<SettingsModuleContext> & { handlers?: SettingsModuleHandlers } = {
    name: 'settings',
    titleArabic: 'إعدادات المنظومة والرقابة',
    version: '2.0.0-alpha.1',
    status: 'active',
    callbackPrefixes: [
      'menu:settings:',
      'act:settings:',
      'action:admin_assign:',
    ],
    init: async () => {
      // Any initialization needed
    },
    shutdown: async () => {
      // Any cleanup needed
    },
    registerRoutes: (bot: Bot<SettingsModuleContext>, rt: ModuleRuntimeContext<SettingsModuleContext>) => {
      handlers = registerSettingsRoutes(bot, {
        prisma: rt.prisma,
        redis: rt.redis,
        screenFlow: rt.screenFlow,
        ...options,
      });
      appModule.handlers = handlers;
    },
    onTextInput: async (ctx: SettingsModuleContext, _text: string) => {
      if (handlers?.handleTextInput) {
        return handlers.handleTextInput(ctx);
      }
      return false;
    },
    onLocationInput: async (ctx: SettingsModuleContext, _location: any) => {
      if (handlers?.handleLocationInput) {
        return handlers.handleLocationInput(ctx);
      }
      return false;
    },
    onPhotoInput: async (ctx: SettingsModuleContext, fileId: string) => {
      if (handlers?.handlePhotoInput) return handlers.handlePhotoInput(ctx, fileId);
      return false;
    },
    getPersistentReplyButtons: (role: string) => {
      if (role === 'SUPER_ADMIN') {
        return ['إعدادات النظام', 'ملفي الشخصي'];
      }
      return [];
    },
  };

  return appModule;
}
