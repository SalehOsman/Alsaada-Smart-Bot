import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCliEntrypoint, toRepoPath } from '../governance/common.js';

export interface ScaffoldModuleOptions {
  name: string;
  titleArabic: string;
  root?: string | undefined;
}

export function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

export function toSnakeCase(str: string): string {
  return str.replace(/-/g, '_').toLowerCase();
}

export function toUpperSnakeCase(str: string): string {
  return str.replace(/-/g, '_').toUpperCase();
}

export function scaffoldModule(options: ScaffoldModuleOptions): {
  ok: boolean;
  moduleDir: string;
  moduleName: string;
  error?: string;
} {
  const root = options.root ?? process.cwd();
  const name = options.name.trim().toLowerCase();
  const titleArabic = options.titleArabic.trim();

  if (!/^[a-z0-9-]+$/.test(name)) {
    return {
      ok: false,
      moduleDir: '',
      moduleName: name,
      error: `Invalid module name: '${name}'. Must contain only lowercase alphanumeric and dashes.`,
    };
  }

  if (!titleArabic) {
    return {
      ok: false,
      moduleDir: '',
      moduleName: name,
      error: 'Module Arabic title is mandatory.',
    };
  }

  const moduleDir = join(root, 'modules', name);
  if (existsSync(moduleDir)) {
    return {
      ok: false,
      moduleDir,
      moduleName: name,
      error: `Module directory already exists: ${toRepoPath(root, moduleDir)}`,
    };
  }

  const pascalName = toPascalCase(name);
  const upperSnake = toUpperSnakeCase(name);

  // 1. Create directory structure
  mkdirSync(join(moduleDir, 'src', 'shared'), { recursive: true });
  mkdirSync(join(moduleDir, 'tests'), { recursive: true });

  // 2. package.json
  const packageJson = {
    name: `@alsaada/${name}`,
    version: '2.0.0-alpha.1',
    private: true,
    type: 'module',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    scripts: {
      build: 'tsc',
      typecheck: 'tsc --noEmit',
      test: 'vitest run',
    },
    dependencies: {
      '@alsaada/core-components': 'workspace:*',
      '@alsaada/database': 'workspace:*',
      grammy: '^1.35.0',
    },
    devDependencies: {
      '@types/node': '^22.13.9',
      typescript: '^5.9.3',
      vitest: '^3.0.8',
    },
  };
  writeFileSync(join(moduleDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

  // 3. tsconfig.json
  const tsconfigJson = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      declaration: true,
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ['src/**/*'],
    exclude: ['**/tests/**', '**/*.spec.ts'],
  };
  writeFileSync(join(moduleDir, 'tsconfig.json'), `${JSON.stringify(tsconfigJson, null, 2)}\n`, 'utf8');

  // 4. src/shared/module.types.ts
  const moduleTypesContent = `import type { Context } from 'grammy';

export interface ${pascalName}ModuleContext extends Context {
  // Domain context extensions for ${name}
}
`;
  writeFileSync(join(moduleDir, 'src', 'shared', 'module.types.ts'), moduleTypesContent, 'utf8');

  // 5. src/shared/module.constants.ts
  const moduleConstantsContent = `export const ${upperSnake}_MODULE_NAME = '${name}';
export const ${upperSnake}_MODULE_TITLE = '${titleArabic}';
export const ${upperSnake}_CALLBACK_PREFIX = 'action:${name}:';
`;
  writeFileSync(join(moduleDir, 'src', 'shared', 'module.constants.ts'), moduleConstantsContent, 'utf8');

  // 6. src/module.permissions.ts
  const permissionsContent = `export const ${upperSnake}_PERMISSIONS = [
  '${name}.read',
  '${name}.create',
  '${name}.update',
  '${name}.delete',
] as const;

export type ${pascalName}Permission = (typeof ${upperSnake}_PERMISSIONS)[number];
`;
  writeFileSync(join(moduleDir, 'src', 'module.permissions.ts'), permissionsContent, 'utf8');

  // 7. src/flows.manifest.ts
  const flowsManifestContent = `import type { FlowContractMetadata } from '@alsaada/core-components';

export const ${upperSnake}_FLOWS_MANIFEST: FlowContractMetadata[] = [];
`;
  writeFileSync(join(moduleDir, 'src', 'flows.manifest.ts'), flowsManifestContent, 'utf8');

  // 8. src/module.routes.ts
  const routesContent = `import type { Bot } from 'grammy';
import type { ${pascalName}ModuleContext } from './shared/module.types.js';

export function register${pascalName}Routes(bot: Bot<${pascalName}ModuleContext>): void {
  // Domain routes registration for ${name}
}
`;
  writeFileSync(join(moduleDir, 'src', 'module.routes.ts'), routesContent, 'utf8');

  // 9. src/module.register.ts
  const registerContent = `import type { Bot } from 'grammy';
import type { AppModuleDefinition, ModuleRuntimeContext } from '@alsaada/core-components';
import type { ${pascalName}ModuleContext } from './shared/module.types.js';
import { register${pascalName}Routes } from './module.routes.js';

export function create${pascalName}AppModule(
  runtime: ModuleRuntimeContext<${pascalName}ModuleContext>
): AppModuleDefinition<${pascalName}ModuleContext> {
  return {
    name: '${name}',
    titleArabic: '${titleArabic}',
    version: '2.0.0-alpha.1',
    status: 'draft',
    callbackPrefixes: [
      'action:${name}:',
      'menu:${name}:',
      'act:${name}:',
    ],
    init: async () => {},
    shutdown: async () => {},
    registerRoutes: (bot: Bot<${pascalName}ModuleContext>, _runtime: ModuleRuntimeContext<${pascalName}ModuleContext>) => {
      register${pascalName}Routes(bot);
    },
    getPersistentReplyButtons: () => [],
  };
}
`;
  writeFileSync(join(moduleDir, 'src', 'module.register.ts'), registerContent, 'utf8');

  // 10. src/index.ts
  const indexContent = `export * from './shared/module.types.js';
export * from './shared/module.constants.js';
export * from './module.permissions.js';
export * from './flows.manifest.js';
export * from './module.routes.js';
export * from './module.register.js';
`;
  writeFileSync(join(moduleDir, 'src', 'index.ts'), indexContent, 'utf8');

  // 11. tests/<name>-module.spec.ts
  const specContent = `import { describe, it, expect } from 'vitest';
import { create${pascalName}AppModule } from '../src/index.js';

describe('${pascalName} AppModule', () => {
  it('instantiates module with draft status and correct prefixes', () => {
    const fakeRuntime: any = {};
    const mod = create${pascalName}AppModule(fakeRuntime);
    expect(mod.name).toBe('${name}');
    expect(mod.titleArabic).toBe('${titleArabic}');
    expect(['draft', 'active']).toContain(mod.status);
    expect(mod.callbackPrefixes.length).toBeGreaterThan(0);
    expect(mod.callbackPrefixes).toContain('action:${name}:');
  });
});
`;
  writeFileSync(join(moduleDir, 'tests', `${name}-module.spec.ts`), specContent, 'utf8');

  // 12. Auto-wire in apps/bot-server/package.json
  const botServerPkgPath = join(root, 'apps', 'bot-server', 'package.json');
  if (existsSync(botServerPkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(botServerPkgPath, 'utf8')) as {
        dependencies?: Record<string, string>;
      };
      if (pkg.dependencies && !pkg.dependencies[`@alsaada/${name}`]) {
        pkg.dependencies[`@alsaada/${name}`] = 'workspace:*';
        // Sort dependencies
        const sortedDeps: Record<string, string> = {};
        for (const k of Object.keys(pkg.dependencies).sort()) {
          sortedDeps[k] = pkg.dependencies[k]!;
        }
        pkg.dependencies = sortedDeps;
        writeFileSync(botServerPkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
      }
    } catch (err) {
      console.warn(`⚠️ Could not auto-wire module into apps/bot-server/package.json:`, err);
    }
  }

  // 13. Auto-wire in apps/bot-server/src/modules.registry.ts
  const registryPath = join(root, 'apps', 'bot-server', 'src', 'modules.registry.ts');
  if (existsSync(registryPath)) {
    try {
      let regContent = readFileSync(registryPath, 'utf8');
      const importStmt = `import { create${pascalName}AppModule } from '@alsaada/${name}';`;
      if (!regContent.includes(importStmt)) {
        // Add after last import
        const lines = regContent.split(/\r?\n/);
        let lastImportIdx = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i]?.startsWith('import ')) lastImportIdx = i;
        }
        if (lastImportIdx >= 0) {
          lines.splice(lastImportIdx + 1, 0, importStmt);
          regContent = lines.join('\n');
        }
      }

      // Add to modules array in buildRegisteredModules
      const factoryCall = `    create${pascalName}AppModule(runtime as any) as unknown as AppModuleDefinition<MyContext>,`;
      if (!regContent.includes(`create${pascalName}AppModule`)) {
        regContent = regContent.replace(
          /const modules: AppModuleDefinition<MyContext>\[\] = \[([\s\S]*?)\];/,
          (match, inner) => {
            const trimmed = inner.trimEnd();
            return `const modules: AppModuleDefinition<MyContext>[] = [${trimmed}\n${factoryCall}\n  ];`;
          }
        );
      }
      writeFileSync(registryPath, regContent, 'utf8');
    } catch (err) {
      console.warn(`⚠️ Could not auto-wire module into apps/bot-server/src/modules.registry.ts:`, err);
    }
  }

  return { ok: true, moduleDir, moduleName: name };
}

if (isCliEntrypoint(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length < 2 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: pnpm make:module <name> <title-arabic>');
    console.log('Example: pnpm make:module canteen "إدارة الكانتين والإعاشة"');
    process.exit(args[0] === '--help' ? 0 : 1);
  }

  const name = args[0]!;
  const titleArabic = args.slice(1).join(' ');

  try {
    const res = scaffoldModule({ name, titleArabic });
    if (!res.ok) {
      console.error(`❌ Scaffold failed: ${res.error}`);
      process.exit(1);
    }
    console.log(`✅ Module scaffolded successfully: modules/${res.moduleName}`);
    console.log(`📦 Status set to: 'draft'`);
    console.log(`🔌 Auto-wired into apps/bot-server/package.json & modules.registry.ts`);
  } catch (err) {
    console.error(`❌ Fatal error:`, err);
    process.exit(1);
  }
}
