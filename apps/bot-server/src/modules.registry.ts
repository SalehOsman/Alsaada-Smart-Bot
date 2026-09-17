import type { MyContext } from './types/context.js';
import type { AppModuleDefinition, ModuleRuntimeContext } from '@alsaada/core-components';
import { createWorkforceAppModule } from '@alsaada/workforce';
import { createSettingsAppModule } from '@alsaada/settings';

export class ModulePrefixRouter<C extends MyContext = MyContext> {
  private readonly prefixMap = new Map<string, AppModuleDefinition<C>>();
  private readonly activeModules: AppModuleDefinition<C>[] = [];

  constructor(modules: AppModuleDefinition<C>[]) {
    for (const mod of modules) {
      if (mod.status === 'active' || process.env.NODE_ENV !== 'production') {
        this.activeModules.push(mod);
        for (const prefix of mod.callbackPrefixes) {
          this.prefixMap.set(prefix, mod);
        }
      }
    }
  }

  resolveByCallback(data: string): AppModuleDefinition<C> | undefined {
    for (const [prefix, mod] of this.prefixMap.entries()) {
      if (data.startsWith(prefix)) return mod;
    }
    return undefined;
  }

  getActiveModules(): AppModuleDefinition<C>[] {
    return this.activeModules;
  }
}

export function buildRegisteredModules(
  runtime: ModuleRuntimeContext<MyContext>,
  options?: {
    onImpersonationChange?: (telegramId: bigint, targetRole?: string) => Promise<void>;
  }
): {
  router: ModulePrefixRouter<MyContext>;
  modules: AppModuleDefinition<MyContext>[];
} {
  const modules: AppModuleDefinition<MyContext>[] = [
    createWorkforceAppModule(runtime as any) as unknown as AppModuleDefinition<MyContext>,
    createSettingsAppModule(
      runtime as any,
      options?.onImpersonationChange
        ? { onImpersonationChange: options.onImpersonationChange }
        : undefined
    ) as unknown as AppModuleDefinition<MyContext>,
  ];
  const router = new ModulePrefixRouter(modules);
  return { router, modules };
}
