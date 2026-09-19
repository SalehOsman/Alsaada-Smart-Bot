import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Context } from 'grammy';
import type {
  AppModuleDefinition,
  ModuleRuntimeContext,
  ModuleFactory,
  ModuleContractJson,
} from '../contracts/module.contract.js';

export class CriticalModuleLoadError extends Error {
  constructor(
    message: string,
    public readonly moduleName: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'CriticalModuleLoadError';
  }
}

export class SovereignHandshakeError extends Error {
  constructor(
    message: string,
    public readonly moduleName: string,
    public readonly missingServices: string[]
  ) {
    super(message);
    this.name = 'SovereignHandshakeError';
  }
}

export interface ModuleLoadDiagnostic {
  name: string;
  status: 'loaded' | 'skipped' | 'failed';
  isCritical: boolean;
  contractFound: boolean;
  requiredServices: string[];
  verifiedServices: string[];
  missingServices: string[];
  error?: string;
}

export interface SovereignAutoLoaderOptions<C extends Context = Context> {
  /**
   * Root directory containing module subdirectories (e.g., F:/Alsaada-Smart-Bot/modules).
   * If omitted, attempts automatic resolution from process.cwd() or parent directories.
   */
  modulesDir?: string | undefined;

  /**
   * Names of modules considered sovereign critical (default: ['settings', 'workforce']).
   * A failure in any critical module halts initialization with a fatal diagnostic error.
   */
  criticalModules?: string[] | undefined;

  /**
   * Base persistent navigation button texts/patterns to always include in getNavigationRegex().
   */
  baseNavigationPatterns?: string[] | undefined;

  /**
   * Module-specific configuration options passed as second argument to module factories.
   */
  moduleOptions?: Record<string, any> | undefined;

  /**
   * Explicit module factory overrides or pre-registered factories.
   * Takes precedence over dynamic filesystem import when specified.
   */
  factories?: Record<string, ModuleFactory<C>> | undefined;

  /**
   * Optional custom logger interface.
   */
  logger?: {
    info: (msg: string, ...args: any[]) => void;
    warn: (msg: string, ...args: any[]) => void;
    error: (msg: string, ...args: any[]) => void;
  } | undefined;
}

export interface SovereignAutoLoaderResult<C extends Context = Context> {
  modules: AppModuleDefinition<C>[];
  activeModules: AppModuleDefinition<C>[];
  failedModules: ModuleLoadDiagnostic[];
  diagnostics: ModuleLoadDiagnostic[];
  navigationPatterns: string[];
  navigationRegex: RegExp;
}

const DEFAULT_CRITICAL_MODULES = new Set(['settings', 'workforce']);

const CANONICAL_ROLES_FOR_BUTTONS = [
  'SUPER_ADMIN',
  'GENERAL_ADMIN',
  'FIELD_ADMIN',
  'OPERATIONS_MANAGER',
  'WORKER_SUPERVISOR',
  'WORKER',
  'SUPPLIER',
  'GUEST',
];

/**
 * Safely escapes regular expression metacharacters in literal strings.
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolves the absolute path to the `modules/` directory across dev and production.
 */
export function resolveModulesDirectory(customDir?: string): string {
  if (customDir) {
    const resolved = path.resolve(customDir);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      return resolved;
    }
  }

  // 1. Walk up from process.cwd() to locate monorepo root containing 'modules'
  let current = process.cwd();
  for (let i = 0; i < 6; i++) {
    const cand = path.join(current, 'modules');
    if (fs.existsSync(cand) && fs.statSync(cand).isDirectory()) {
      return cand;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // 2. Additional candidate fallbacks
  const candidates = [
    path.resolve(process.cwd(), 'modules'),
    path.resolve(process.cwd(), 'dist/modules'),
    path.resolve(process.cwd(), '../modules'),
    path.resolve(process.cwd(), '../../modules'),
  ];

  for (const cand of candidates) {
    if (fs.existsSync(cand) && fs.statSync(cand).isDirectory()) {
      return cand;
    }
  }

  return path.resolve(process.cwd(), 'modules');
}

/**
 * Resolves the entrypoint of a module directory for both live dev (src/index.ts) and compiled prod (dist/index.js).
 */
export function resolveModuleEntrypoint(modDir: string): string | null {
  const isProd = process.env.NODE_ENV === 'production';
  const devCandidates = [
    path.join(modDir, 'src', 'index.ts'),
    path.join(modDir, 'src', 'index.js'),
    path.join(modDir, 'dist', 'index.js'),
    path.join(modDir, 'index.ts'),
    path.join(modDir, 'index.js'),
  ];
  const prodCandidates = [
    path.join(modDir, 'dist', 'index.js'),
    path.join(modDir, 'index.js'),
    path.join(modDir, 'src', 'index.ts'),
    path.join(modDir, 'src', 'index.js'),
  ];

  const candidates = isProd ? prodCandidates : devCandidates;
  for (const cand of candidates) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
      return cand;
    }
  }
  return null;
}

/**
 * Converts a filesystem path (POSIX or Windows Drive e.g. `F:\...`) to a valid file URL string for ESM import.
 */
export function toValidImportUrl(filePath: string): string {
  if (filePath.startsWith('file://')) {
    try {
      return new URL(filePath).href;
    } catch {
      return filePath;
    }
  }
  return pathToFileURL(path.resolve(filePath)).href;
}

/**
 * Checks whether a regex pattern presents ReDoS risk (catastrophic backtracking / exponential complexity).
 * Note: Plain literal strings with characters like '+' or brackets are NOT ReDoS risks.
 */
export function hasReDoSRisk(pattern: string): boolean {
  if (!pattern || typeof pattern !== 'string') return false;

  // Catastrophic backtracking detection:
  // 1. Nested / repeated quantifiers across groups: (a+)+, (a*)*, ([a-z]+)+, ((a+)|b)+, (a|b+)+, (a+){2,}
  // 2. Multiple quantifiers on same token: a++, a*+, a+?+
  const catastrophicBacktracking = [
    /(\+|\*|\{\d*,?\d+\})[^\(]*\)+[^\(]*(\+|\*|\{\d*,?\d+\})/,
    /(\+|\*|\?)\s*(\+|\*)/,
  ];

  for (const rx of catastrophicBacktracking) {
    if (rx.test(pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Builds a unified, ReDoS-safe navigation RegExp from pattern strings.
 * Returns /(?!)/ if patterns are empty, anchors to match full messages, and ensures lastIndex is reset to 0.
 */
export function buildSafeNavigationRegex(patterns: string[]): RegExp {
  if (!patterns || patterns.length === 0) {
    const emptyGuard = /(?!)/;
    emptyGuard.lastIndex = 0;
    return emptyGuard;
  }

  const cleaned: string[] = [];
  const seen = new Set<string>();

  for (const raw of patterns) {
    if (!raw || typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;

    if (hasReDoSRisk(trimmed)) {
      console.warn(`⚠️ [SOVEREIGN AUTO-LOADER] Dropping ReDoS-vulnerable navigation pattern: "${trimmed}"`);
      continue;
    }

    // A navigation pattern is intended as a regex if it has alternation '|' or explicit anchors '^' / '$'.
    // Otherwise, treat as a literal button label and escape regex metacharacters to match the button text exactly.
    const isIntentionalRegex = trimmed.includes('|') || /^\^|\$$/.test(trimmed);
    let safePattern: string;

    if (isIntentionalRegex) {
      try {
        new RegExp(trimmed);
        safePattern = trimmed;
      } catch {
        safePattern = escapeRegExp(trimmed);
      }
    } else {
      safePattern = escapeRegExp(trimmed);
    }

    seen.add(trimmed);
    cleaned.push(safePattern);
  }

  if (cleaned.length === 0) {
    const emptyGuard = /(?!)/;
    emptyGuard.lastIndex = 0;
    return emptyGuard;
  }

  // Wrap each in non-capturing group and anchor to match full message with optional surrounding whitespace
  const combined = cleaned.map((p) => `(?:${p})`).join('|');
  const regex = new RegExp(`^\\s*(?:${combined})\\s*$`);
  regex.lastIndex = 0;
  return regex;
}

/**
 * Converts kebab-case or snake-case strings to PascalCase (e.g. cash-outflow -> CashOutflow).
 */
export function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Verifies readiness of a required service against the runtime context.
 */
export function verifyServiceReadiness(
  serviceName: string,
  runtime: ModuleRuntimeContext<any>
): { ready: boolean; reason?: string } {
  if (!runtime || typeof runtime !== 'object') {
    return { ready: false, reason: 'Runtime context is null or not an object' };
  }

  const rt = runtime as Record<string, any>;
  const key = serviceName.trim().toLowerCase();

  switch (key) {
    case 'prisma':
    case 'database':
    case 'db': {
      const db = rt.prisma || rt.database;
      if (!db) return { ready: false, reason: 'Prisma/Database instance is missing or null' };
      return { ready: true };
    }
    case 'redis':
    case 'cache': {
      const redis = rt.redis || rt.cache;
      if (!redis) return { ready: false, reason: 'Redis client instance is missing or null' };
      return { ready: true };
    }
    case 'api':
    case 'botapi': {
      const api = rt.api;
      if (!api) return { ready: false, reason: 'Telegram Bot API instance is missing or null' };
      return { ready: true };
    }
    case 'screenflow':
    case 'screenflowservice': {
      const sf = rt.screenFlow || rt.screenFlowService;
      if (!sf) return { ready: false, reason: 'ScreenFlow service instance is missing or null' };
      return { ready: true };
    }
    case 'telemetry':
    case 'telemetryservice': {
      const tel = rt.telemetry || rt.telemetryService;
      if (!tel) return { ready: false, reason: 'Telemetry service instance is missing or null' };
      return { ready: true };
    }
    default: {
      const direct =
        rt[serviceName] ??
        rt[key] ??
        Object.entries(rt).find(([k]) => k.toLowerCase() === key)?.[1];

      if (direct === undefined || direct === null) {
        return {
          ready: false,
          reason: `Service "${serviceName}" is missing or null in runtime context`,
        };
      }
      return { ready: true };
    }
  }
}

/**
 * Extracts a factory function from an imported module object.
 */
function extractFactoryFromImport<C extends Context>(
  modName: string,
  imported: any
): ModuleFactory<C> | null {
  if (!imported) return null;

  if (typeof imported === 'function') {
    return imported;
  }
  if (typeof imported.default === 'function') {
    return imported.default;
  }

  const pascalName = toPascalCase(modName);
  const candidateNames = [
    `create${pascalName}AppModule`,
    `create${pascalName}Module`,
    `createAppModule`,
    `createModule`,
    `register${pascalName}Module`,
    `get${pascalName}AppModule`,
  ];

  for (const fnName of candidateNames) {
    if (typeof imported[fnName] === 'function') {
      return imported[fnName];
    }
  }

  // Scan any exported function matching create*Module
  for (const [k, v] of Object.entries(imported)) {
    if (typeof v === 'function' && /^create.*(?:App)?Module$/i.test(k)) {
      return v as ModuleFactory<C>;
    }
  }

  // If already an AppModuleDefinition object
  const candidateObj = imported.default || imported.appModule || imported;
  if (
    candidateObj &&
    typeof candidateObj === 'object' &&
    typeof candidateObj.registerRoutes === 'function'
  ) {
    return () => candidateObj as AppModuleDefinition<C>;
  }

  return null;
}

/**
 * Sovereign Auto-Loader:
 * Hybrid Dev/Prod zero-touch module discovery, runtime contract service handshake,
 * fault-tolerant circuit breaker, and dynamic navigation aggregation.
 */
export class SovereignAutoLoader<C extends Context = Context> {
  private readonly criticalModules: Set<string>;
  private readonly baseNavigationPatterns: string[];
  private readonly moduleOptions: Record<string, any>;
  private readonly factories: Record<string, ModuleFactory<C>>;
  private readonly logger: {
    info: (msg: string, ...args: any[]) => void;
    warn: (msg: string, ...args: any[]) => void;
    error: (msg: string, ...args: any[]) => void;
  };

  private modules: AppModuleDefinition<C>[] = [];
  private activeModules: AppModuleDefinition<C>[] = [];
  private diagnostics: ModuleLoadDiagnostic[] = [];
  private failedModules: ModuleLoadDiagnostic[] = [];
  private navigationPatterns: string[] = [];
  private cachedNavigationRegex: RegExp | null = null;

  constructor(private readonly options: SovereignAutoLoaderOptions<C> = {}) {
    this.criticalModules = new Set([
      ...DEFAULT_CRITICAL_MODULES,
      ...(options.criticalModules || []),
    ]);
    this.baseNavigationPatterns = [
      'القائمة الرئيسية',
      '🏠 القائمة الرئيسية',
      '🖥️ فتح لوحة التحكم',
      'إنهاء وضع المحاكاة',
      'العودة كمدير عام',
      '🎭 إنهاء وضع المحاكاة (العودة كمدير عام)',
      ...(options.baseNavigationPatterns || []),
    ];
    this.navigationPatterns = [...this.baseNavigationPatterns];
    this.moduleOptions = options.moduleOptions || {};
    this.factories = options.factories || {};
    this.logger = options.logger || {
      info: (msg, ...args) => console.log(msg, ...args),
      warn: (msg, ...args) => console.warn(msg, ...args),
      error: (msg, ...args) => console.error(msg, ...args),
    };
  }

  /**
   * Scans the modules directory, validates contracts & services, and loads all active modules.
   */
  async loadModules(runtime: ModuleRuntimeContext<C>): Promise<SovereignAutoLoaderResult<C>> {
    this.modules = [];
    this.activeModules = [];
    this.diagnostics = [];
    this.failedModules = [];
    this.cachedNavigationRegex = null;

    const aggregatedPatterns = new Set<string>(this.baseNavigationPatterns);
    const modulesDir = resolveModulesDirectory(this.options.modulesDir);

    // Identify module candidates: from filesystem and/or explicitly registered factories
    const discoveredNames = new Set<string>();

    if (fs.existsSync(modulesDir)) {
      const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          discoveredNames.add(entry.name);
        }
      }
    }

    for (const factoryName of Object.keys(this.factories)) {
      discoveredNames.add(factoryName);
    }

    for (const modName of discoveredNames) {
      const modDir = path.join(modulesDir, modName);
      const isCritical = this.criticalModules.has(modName);
      let contract: ModuleContractJson | undefined;
      let contractFound = false;

      // 1. Read module.contract.json if present
      const contractPath = path.join(modDir, 'module.contract.json');
      if (fs.existsSync(contractPath)) {
        contractFound = true;
        try {
          const raw = fs.readFileSync(contractPath, 'utf-8');
          contract = JSON.parse(raw);
        } catch (parseErr: any) {
          const msg = `[SOVEREIGN AUTO-LOADER] Invalid JSON syntax in contract for module "${modName}" at ${contractPath}: ${parseErr.message}`;
          const diag: ModuleLoadDiagnostic = {
            name: modName,
            status: 'failed',
            isCritical,
            contractFound: true,
            requiredServices: [],
            verifiedServices: [],
            missingServices: [],
            error: msg,
          };
          this.diagnostics.push(diag);
          this.failedModules.push(diag);

          if (isCritical) {
            throw new CriticalModuleLoadError(msg, modName, parseErr);
          } else {
            this.logger.warn(`⚠️ [MODULE BUS CIRCUIT BREAKER] Isolated contract syntax error:`, msg);
            continue;
          }
        }
      }

      // Check if contract explicitly specifies critical
      const effectiveCritical = isCritical || Boolean(contract?.critical);

      // 2. Runtime Contract Service Handshake
      const requiredServices = Array.isArray(contract?.requiredServices)
        ? contract.requiredServices
        : [];
      const verifiedServices: string[] = [];
      const missingServices: string[] = [];

      for (const reqService of requiredServices) {
        const check = verifyServiceReadiness(reqService, runtime);
        if (check.ready) {
          verifiedServices.push(reqService);
        } else {
          missingServices.push(reqService);
        }
      }

      if (missingServices.length > 0) {
        const available = Object.keys(runtime).filter(
          (k) => (runtime as Record<string, any>)[k] != null
        );
        const report =
          `[SOVEREIGN AUTO-LOADER] Runtime Handshake Failed for module "${modName}". ` +
          `Missing required service(s): [${missingServices.join(', ')}]. ` +
          `Available runtime services in context: [${available.join(', ')}].`;

        const diag: ModuleLoadDiagnostic = {
          name: modName,
          status: 'failed',
          isCritical: effectiveCritical,
          contractFound,
          requiredServices,
          verifiedServices,
          missingServices,
          error: report,
        };
        this.diagnostics.push(diag);
        this.failedModules.push(diag);

        if (effectiveCritical) {
          throw new SovereignHandshakeError(report, modName, missingServices);
        } else {
          this.logger.warn(
            `⚠️ [MODULE BUS CIRCUIT BREAKER] Module "${modName}" missing services, skipped:`,
            missingServices
          );
          continue;
        }
      }

      // 3. Resolve Module Factory (Explicit factory vs Dynamic Filesystem import)
      let factory: ModuleFactory<C> | null = this.factories[modName] || null;

      if (!factory) {
        const entrypoint = resolveModuleEntrypoint(modDir);
        if (!entrypoint) {
          const msg = `[SOVEREIGN AUTO-LOADER] No entrypoint found for module "${modName}" in ${modDir}`;
          const diag: ModuleLoadDiagnostic = {
            name: modName,
            status: 'failed',
            isCritical: effectiveCritical,
            contractFound,
            requiredServices,
            verifiedServices,
            missingServices: [],
            error: msg,
          };
          this.diagnostics.push(diag);
          this.failedModules.push(diag);

          if (effectiveCritical) {
            throw new CriticalModuleLoadError(msg, modName);
          } else {
            this.logger.warn(`⚠️ [MODULE BUS CIRCUIT BREAKER] ${msg}`);
            continue;
          }
        }

        try {
          const importUrl = toValidImportUrl(entrypoint);
          const imported = await import(importUrl);
          factory = extractFactoryFromImport<C>(modName, imported);

          if (!factory) {
            throw new Error(`Failed to extract module factory from ${importUrl}`);
          }
        } catch (importErr: any) {
          const msg = `[SOVEREIGN AUTO-LOADER] Failed to import module "${modName}": ${importErr.message}`;
          const diag: ModuleLoadDiagnostic = {
            name: modName,
            status: 'failed',
            isCritical: effectiveCritical,
            contractFound,
            requiredServices,
            verifiedServices,
            missingServices: [],
            error: msg,
          };
          this.diagnostics.push(diag);
          this.failedModules.push(diag);

          if (effectiveCritical) {
            throw new CriticalModuleLoadError(msg, modName, importErr);
          } else {
            this.logger.warn(`⚠️ [MODULE BUS CIRCUIT BREAKER] ${msg}`, importErr);
            continue;
          }
        }
      }

      // 4. Instantiate Module via Factory
      let moduleDef: AppModuleDefinition<C>;
      try {
        const customModOptions = this.moduleOptions[modName];
        moduleDef = factory(runtime, customModOptions);
      } catch (instErr: any) {
        const msg = `[SOVEREIGN AUTO-LOADER] Factory execution failed for module "${modName}": ${instErr.message}`;
        const diag: ModuleLoadDiagnostic = {
          name: modName,
          status: 'failed',
          isCritical: effectiveCritical,
          contractFound,
          requiredServices,
          verifiedServices,
          missingServices: [],
          error: msg,
        };
        this.diagnostics.push(diag);
        this.failedModules.push(diag);

        if (effectiveCritical) {
          throw new CriticalModuleLoadError(msg, modName, instErr);
        } else {
          this.logger.warn(`⚠️ [MODULE BUS CIRCUIT BREAKER] ${msg}`, instErr);
          continue;
        }
      }

      this.modules.push(moduleDef);

      const isActive =
        moduleDef.status === 'active' || process.env.NODE_ENV !== 'production';

      if (isActive) {
        this.activeModules.push(moduleDef);

        // 5. Aggregate Navigation Patterns
        // From Contract
        if (Array.isArray(contract?.navigationPatterns)) {
          for (const pat of contract.navigationPatterns) {
            aggregatedPatterns.add(pat);
          }
        }

        // From Module Definition
        if (Array.isArray(moduleDef.navigationPatterns)) {
          for (const pat of moduleDef.navigationPatterns) {
            aggregatedPatterns.add(pat);
          }
        }

        // From Persistent Reply Buttons across roles
        if (typeof moduleDef.getPersistentReplyButtons === 'function') {
          for (const role of CANONICAL_ROLES_FOR_BUTTONS) {
            const buttons = moduleDef.getPersistentReplyButtons(role);
            if (Array.isArray(buttons)) {
              for (const btn of buttons) {
                aggregatedPatterns.add(btn);
              }
            }
          }
        }
      }

      const diag: ModuleLoadDiagnostic = {
        name: modName,
        status: isActive ? 'loaded' : 'skipped',
        isCritical: effectiveCritical,
        contractFound,
        requiredServices,
        verifiedServices,
        missingServices: [],
      };
      this.diagnostics.push(diag);
    }

    this.navigationPatterns = Array.from(aggregatedPatterns);
    const navRegex = this.getNavigationRegex();

    return {
      modules: this.modules,
      activeModules: this.activeModules,
      failedModules: this.failedModules,
      diagnostics: this.diagnostics,
      navigationPatterns: this.navigationPatterns,
      navigationRegex: navRegex,
    };
  }

  /**
   * Returns all instantiated modules.
   */
  getModules(): AppModuleDefinition<C>[] {
    return this.modules;
  }

  /**
   * Returns only active modules.
   */
  getActiveModules(): AppModuleDefinition<C>[] {
    return this.activeModules;
  }

  /**
   * Returns the aggregated list of navigation pattern strings.
   */
  getNavigationPatterns(): string[] {
    return this.navigationPatterns;
  }

  /**
   * Returns the compiled, ReDoS-safe navigation RegExp.
   * Ensures lastIndex is always 0.
   */
  getNavigationRegex(): RegExp {
    if (!this.cachedNavigationRegex) {
      this.cachedNavigationRegex = buildSafeNavigationRegex(this.navigationPatterns);
    }
    this.cachedNavigationRegex.lastIndex = 0;
    return this.cachedNavigationRegex;
  }

  /**
   * Checks if a user message text matches any active navigation button.
   */
  isNavigationMessage(text: string): boolean {
    if (!text || typeof text !== 'string' || text.trim().length === 0) return false;
    const regex = this.getNavigationRegex();
    regex.lastIndex = 0;
    return regex.test(text.trim());
  }

  /**
   * Returns full diagnostic report of the load operation.
   */
  getDiagnostics(): ModuleLoadDiagnostic[] {
    return this.diagnostics;
  }
}
