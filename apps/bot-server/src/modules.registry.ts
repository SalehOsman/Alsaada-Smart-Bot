import type { MyContext } from './types/context.js';
import {
  type AppModuleDefinition,
  type ModuleRuntimeContext,
  SovereignAutoLoader,
} from '@alsaada/core-components';

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

export interface BuildModulesOptions {
  onImpersonationChange?: (telegramId: bigint, targetRole?: string) => Promise<void>;
  modulesDir?: string;
  criticalModules?: string[];
  baseNavigationPatterns?: string[];
  factories?: Record<string, (runtime: ModuleRuntimeContext<MyContext>, options?: any) => AppModuleDefinition<MyContext>>;
  moduleOptions?: Record<string, any>;
}

/**
 * Enterprise Microkernel Module Bus & Sovereign Auto-Loader:
 * Fully decoupled, zero-touch dynamic module discovery and contract verification.
 */
export async function buildRegisteredModules(
  runtime: ModuleRuntimeContext<MyContext>,
  options?: BuildModulesOptions
): Promise<{
  router: ModulePrefixRouter<MyContext>;
  modules: AppModuleDefinition<MyContext>[];
  loader: SovereignAutoLoader<MyContext>;
}> {
  const loader = new SovereignAutoLoader<MyContext>({
    modulesDir: options?.modulesDir,
    criticalModules: options?.criticalModules,
    baseNavigationPatterns: options?.baseNavigationPatterns,
    factories: options?.factories,
    moduleOptions: {
      settings: options?.onImpersonationChange
        ? { onImpersonationChange: options.onImpersonationChange }
        : undefined,
      ...(options?.moduleOptions || {}),
    },
  });

  const result = await loader.loadModules(runtime);
  const router = new ModulePrefixRouter(result.activeModules);

  return {
    router,
    modules: result.activeModules,
    loader,
  };
}
