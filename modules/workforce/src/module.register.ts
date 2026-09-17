import type { Bot } from 'grammy';
import type { PrismaClient } from '@alsaada/database';
import type { AppModuleDefinition, ModuleRuntimeContext } from '@alsaada/core-components';
import type { WorkforceModuleContext } from './shared/module.types.js';
import { registerWorkforceRoutes } from './module.routes.js';
import { registerWorkforceHubRoutes } from './hub/hub.routes.js';
import { WorkerExpiryAlertService } from './services/worker-expiry-alert.service.js';
import { setWorkforcePrisma, setWorkforceEncryptionKey } from './services/worker-facade.service.js';

export interface WorkforceModuleOptions {
  prisma: PrismaClient;
  encryptionKey?: string;
  superAdminTelegramId?: bigint;
  autoStartExpiryAlerts?: boolean;
  onWorkerDemoted?: (demotedTelegramId: bigint) => Promise<void>;
  redis?: any;
}

export function registerWorkforceModule(
  bot: Bot<WorkforceModuleContext>,
  options: WorkforceModuleOptions
) {
  // Wire centralized prisma singleton and encryption key into workforce facade
  setWorkforcePrisma(options.prisma);
  if (options.encryptionKey) {
    setWorkforceEncryptionKey(options.encryptionKey);
  }

  const expiryAlertService = new WorkerExpiryAlertService({
    prisma: options.prisma,
    ...(options.encryptionKey ? { encryptionKey: options.encryptionKey } : {}),
    ...(options.superAdminTelegramId ? { superAdminTelegramId: options.superAdminTelegramId } : {}),
  });

  const routes = registerWorkforceRoutes(
    bot,
    options.prisma,
    options.encryptionKey,
    options.onWorkerDemoted,
    options.redis
  );
  registerWorkforceHubRoutes(bot, options.prisma);

  if (options.autoStartExpiryAlerts !== false) {
    setTimeout(() => {
      expiryAlertService.checkAndDispatchExpiryAlerts(bot.api).catch((err) => {
        console.warn('⚠️ Expiry alert startup check failed:', err);
      });
    }, 10000);
    setInterval(() => {
      expiryAlertService.checkAndDispatchExpiryAlerts(bot.api).catch((err) => {
        console.warn('⚠️ Daily expiry alert scheduler failed:', err);
      });
    }, 24 * 60 * 60 * 1000);
  }

  return { expiryAlertService, ...routes };
}

export function createWorkforceAppModule(
  runtime: ModuleRuntimeContext<WorkforceModuleContext>
): AppModuleDefinition<WorkforceModuleContext> & {
  handlers?: ReturnType<typeof registerWorkforceRoutes>;
  expiryAlertService?: WorkerExpiryAlertService;
} {
  let expiryAlertService: WorkerExpiryAlertService | undefined;
  let routes: ReturnType<typeof registerWorkforceRoutes> | undefined;

  const appModule: AppModuleDefinition<WorkforceModuleContext> & {
    handlers?: ReturnType<typeof registerWorkforceRoutes>;
    expiryAlertService?: WorkerExpiryAlertService;
  } = {
    name: 'workforce',
    titleArabic: 'شؤون العاملين والتشغيل',
    version: '2.0.0-alpha.1',
    status: 'active',
    callbackPrefixes: [
      'action:worker:',
      'wizard:worker:',
      'menu:hr_sub:',
      'menu:worker_sub:',
      'act:wrk:',
    ],
    init: async (bot: Bot<WorkforceModuleContext>, rt: ModuleRuntimeContext<WorkforceModuleContext>) => {
      setWorkforcePrisma(rt.prisma);
      expiryAlertService = new WorkerExpiryAlertService({
        prisma: rt.prisma,
      });
      appModule.expiryAlertService = expiryAlertService;
    },
    shutdown: async () => {
      // Graceful shutdown
    },
    registerRoutes: (bot: Bot<WorkforceModuleContext>, rt: ModuleRuntimeContext<WorkforceModuleContext>) => {
      setWorkforcePrisma(rt.prisma);
      routes = registerWorkforceRoutes(bot, rt.prisma, undefined, undefined, rt.redis);
      registerWorkforceHubRoutes(bot, rt.prisma);
      appModule.handlers = routes;
    },
    onTextInput: async (ctx: WorkforceModuleContext, text: string) => {
      if (routes?.plugins) {
        for (const plugin of routes.plugins) {
          if (plugin.handleTextInput && (await plugin.handleTextInput(ctx, text))) {
            return true;
          }
        }
      }
      return false;
    },
    onPhotoInput: async (ctx: WorkforceModuleContext, fileId: string) => {
      if (routes?.plugins) {
        for (const plugin of routes.plugins) {
          if (plugin.handlePhotoInput && (await plugin.handlePhotoInput(ctx, fileId))) {
            return true;
          }
        }
      }
      return false;
    },
    onDocumentInput: async (ctx: WorkforceModuleContext, doc: NonNullable<NonNullable<WorkforceModuleContext['message']>['document']>) => {
      if (routes?.plugins) {
        for (const plugin of routes.plugins) {
          if (plugin.handleDocumentInput && (await plugin.handleDocumentInput(ctx, doc))) {
            return true;
          }
        }
      }
      return false;
    },
    getPersistentReplyButtons: (role: string) => {
      if (role === 'SUPER_ADMIN' || role === 'FIELD_ADMIN' || role === 'OPERATIONS_MANAGER') {
        return ['🚜 تسجيل منسوب', 'التبديل لحسابي كعامل'];
      }
      if (role === 'WORKER') {
        return ['بطاقة معرفي', 'العودة لبوابة الإشراف'];
      }
      return [];
    },
  };

  return appModule;
}
