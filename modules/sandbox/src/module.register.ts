import type { ModuleDefinitionV2, AppModuleDefinition, ModuleRuntimeContext } from '@alsaada/core-components';
import { registerSandboxRoutes, type BotLike, type SandboxModuleHandlers } from './module.routes.js';

export const MODULE_DEFINITION: ModuleDefinitionV2 = {
  schemaVersion: '2.0.0',
  id: 'sandbox' as any,
  version: '1.0.0',
  titleArabic: 'مختبر التجارب والتطوير الميداني',
  descriptionArabic: 'وحدة مختبر التجارب والتطوير الميداني',
  category: 'operations',
  status: 'active',
  requiredCapabilities: ['storage:attachment' as any],
  providedCapabilities: [],
  flows: [],
  callbackPrefixes: ['action:sandbox:', 'wizard:sandbox:', 'menu:domain:sandbox', 'flow:99.'],
  navigationPatterns: ['🧪 المختبر التجريبي', 'المختبر التجريبي'],
};

export function createSandboxAppModule(
  runtime?: unknown
): AppModuleDefinition & { id: string; runtime: unknown; handlers?: SandboxModuleHandlers } {
  let handlers: SandboxModuleHandlers | undefined;

  const appMod: AppModuleDefinition & { id: string; runtime: unknown; handlers?: SandboxModuleHandlers } = {
    ...MODULE_DEFINITION,
    name: 'sandbox',
    status: 'active',
    callbackPrefixes: [...MODULE_DEFINITION.callbackPrefixes],
    navigationPatterns: ['🧪 المختبر التجريبي', 'المختبر التجريبي'],
    registerRoutes: (bot: any, rt?: any) => {
      handlers = registerSandboxRoutes(bot as BotLike, rt ?? (runtime as any));
      appMod.handlers = handlers;
    },
    onTextInput: async (ctx: any, text: string) => {
      if (text && text.includes('المختبر التجريبي')) {
        if (handlers?.renderHub) {
          await handlers.renderHub(ctx);
          return true;
        }
      }
      return false;
    },
    getPersistentReplyButtons: (role: string) => {
      if (role === 'SUPER_ADMIN' || role === 'FIELD_ADMIN') {
        return ['🧪 المختبر التجريبي'];
      }
      return [];
    },
    runtime,
  };

  return appMod;
}
