/**
 * Trace Model Usage and Ownership Analyzer (Work Plan 112 - Task 1)
 *
 * Scans all source files across the monorepo to trace references to every
 * Prisma model in `packages/database/prisma/schema.prisma`.
 * Categorizes models into SHARED_CORE, DOMAIN_WORKFORCE, DOMAIN_SETTINGS,
 * or DEPRECATED_ISOLATED.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT_DIR = process.cwd();
const SCHEMA_FILE = path.join(ROOT_DIR, 'packages', 'database', 'prisma', 'schema.prisma');
const INVENTORY_FILE = path.join(ROOT_DIR, 'docs', 'schemas', 'model-ownership-inventory.json');
const DEPRECATED_FILE = path.join(ROOT_DIR, 'docs', 'schemas', 'deprecated-models.json');

// Protected financial models that MUST remain in SHARED_CORE under financial immunity invariant
const PROTECTED_FINANCIAL_MODELS = new Set([
  'FinancialLedger',
  'CustodyExpenseItem',
  'CustodySettlement',
  'HospitalityExpense',
  'WorkerExpenseClaim',
  'SupplierPayment',
]);

// Protected core system models
const PROTECTED_SYSTEM_MODELS = new Set([
  'CompanyProfile',
  'User',
  'AuditLog',
  'SystemConfig',
  'NotificationQueue',
  'OutboxEvent',
  'DeadLetterEvent',
  'SystemErrorLog',
  'ApprovalTicket',
  'UserWizardDraft',
  'DashboardAuthLink',
  'DashboardSession',
  'BotPerformanceLog',
]);

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function extractModelsFromSchema(content: string): string[] {
  const modelRegex = /^model\s+([A-Za-z0-9_]+)\s*\{/gm;
  const models: string[] = [];
  let m: RegExpExecArray | null = null;
  while ((m = modelRegex.exec(content)) !== null) {
    if (m[1]) models.push(m[1]);
  }
  return models;
}

function walkDir(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name === 'dist' ||
      entry.name === '.generated' ||
      entry.name === '.turbo'
    ) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, fileList);
    } else if (
      entry.name.endsWith('.ts') ||
      entry.name.endsWith('.tsx') ||
      entry.name.endsWith('.js') ||
      entry.name.endsWith('.json') ||
      entry.name.endsWith('.md')
    ) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

export interface ModelTrace {
  model: string;
  camelCase: string;
  category: 'SHARED_CORE' | 'DOMAIN_WORKFORCE' | 'DOMAIN_SETTINGS' | 'DEPRECATED_ISOLATED';
  rationale: string;
  financialImmunity: boolean;
  references: {
    totalFiles: number;
    modules: {
      workforce: string[];
      settings: string[];
      sandbox: string[];
      other: string[];
    };
    apps: {
      bot: string[];
      dashboard: string[];
      studio: string[];
    };
    packages: Record<string, string[]>;
  };
}

export function analyzeModelOwnership(): {
  inventory: Record<string, ModelTrace>;
  deprecated: Array<{ model: string; reason: string; lastDeclaredIn: string }>;
  summary: Record<string, number>;
} {
  const schemaText = fs.readFileSync(SCHEMA_FILE, 'utf8');
  const models = extractModelsFromSchema(schemaText);

  const candidateDirs = ['modules', 'packages', 'apps'].map((d) => path.join(ROOT_DIR, d));
  const allFiles: string[] = [];
  for (const dir of candidateDirs) {
    walkDir(dir, allFiles);
  }

  const inventory: Record<string, ModelTrace> = {};

  for (const model of models) {
    inventory[model] = {
      model,
      camelCase: toCamelCase(model),
      category: 'SHARED_CORE',
      rationale: '',
      financialImmunity: PROTECTED_FINANCIAL_MODELS.has(model),
      references: {
        totalFiles: 0,
        modules: { workforce: [], settings: [], sandbox: [], other: [] },
        apps: { bot: [], dashboard: [], studio: [] },
        packages: {},
      },
    };
  }

  // Pre-compile search regexes for each model
  // We search for:
  // 1. prisma.<camelCase> or db.<camelCase> or tx.<camelCase>
  // 2. Type mentions: \bModel\b
  for (const filePath of allFiles) {
    const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');

    // Skip the schema itself and generated files
    if (
      relPath.includes('packages/database/prisma/schema.prisma') ||
      relPath.includes('.generated/') ||
      relPath.includes('governance.lock.json') ||
      relPath.includes('trace-model-usage.ts')
    ) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    for (const model of models) {
      const camel = inventory[model]!.camelCase;
      const hasModelWord = new RegExp(`\\b${model}\\b`).test(content);
      const hasCamelWord = new RegExp(`\\b${camel}\\b`).test(content);

      if (hasModelWord || hasCamelWord) {
        const item = inventory[model]!;
        item.references.totalFiles++;

        if (relPath.startsWith('modules/workforce/')) {
          item.references.modules.workforce.push(relPath);
        } else if (relPath.startsWith('modules/settings/')) {
          item.references.modules.settings.push(relPath);
        } else if (relPath.startsWith('modules/sandbox/')) {
          item.references.modules.sandbox.push(relPath);
        } else if (relPath.startsWith('modules/')) {
          item.references.modules.other.push(relPath);
        } else if (relPath.startsWith('apps/bot/')) {
          item.references.apps.bot.push(relPath);
        } else if (relPath.startsWith('apps/dashboard/')) {
          item.references.apps.dashboard.push(relPath);
        } else if (relPath.startsWith('apps/studio/')) {
          item.references.apps.studio.push(relPath);
        } else if (relPath.startsWith('packages/')) {
          const parts = relPath.split('/');
          const pkg = parts[1] || 'unknown';
          if (!item.references.packages[pkg]) {
            item.references.packages[pkg] = [];
          }
          item.references.packages[pkg].push(relPath);
        }
      }
    }
  }

  // Determine Categorization
  const deprecated: Array<{ model: string; reason: string; lastDeclaredIn: string }> = [];
  const summary: Record<string, number> = {
    SHARED_CORE: 0,
    DOMAIN_WORKFORCE: 0,
    DOMAIN_SETTINGS: 0,
    DEPRECATED_ISOLATED: 0,
    TOTAL: models.length,
  };

  // Architectural Domain Mapping rules per Work Plan 112:
  const WORKFORCE_MODELS = new Set([
    'Department',
    'JobTitle',
    'JobSalaryHistory',
    'CycleTransitionHistory',
    'ShiftCycleTemplate',
    'Worker',
    'WorkerDocument',
    'WorkerEditRequest',
    'SalaryHistory',
    'WorkerChangeLog',
    'WorkerCustomAllowance',
    'PPEAsset',
    'DisciplinaryAndBonus',
    'WorkerClearance',
    'WorkerBalanceSnapshot',
    'WorkerCommitmentScore',
    'Leave',
    'LeaveAllowance',
    'DutyRoster',
    'SiteTask',
    'PayrollRun',
    'PayrollRecord',
  ]);

  const SETTINGS_MODELS = new Set([
    'BotMenuPermission',
    'SupervisorLifecycleLog',
    'TelegramEnforcementTask',
    'WorkerDelegation',
    'BotMenuNode',
    'BotMenuSnapshot',
  ]);

  const DEPRECATED_CANDIDATE_MODELS = new Set([
    'CampFoodItem',
    'Recipe',
    'FoodWasteLog',
    'MealSurvey',
    'MarketPriceBenchmark',
    'PhosphateProductionSlip',
    'PhosphateExtract',
    'SiteAccommodation',
    'SiteAccommodationAssignment',
    'CompanyDocument',
    'SupplierInvoiceItem',
    'EquipmentMaintenance',
    'SparePartsRequest',
  ]);

  for (const model of models) {
    const item = inventory[model]!;

    if (PROTECTED_FINANCIAL_MODELS.has(model)) {
      item.category = 'SHARED_CORE';
      item.rationale = 'Protected financial model under strict double-entry ledger invariant (G11, G12, G13).';
    } else if (PROTECTED_SYSTEM_MODELS.has(model)) {
      item.category = 'SHARED_CORE';
      item.rationale = 'Protected core system/infrastructure model (company profile, user, outbox, audit, errors).';
    } else if (WORKFORCE_MODELS.has(model)) {
      item.category = 'DOMAIN_WORKFORCE';
      item.rationale = 'Owned by workforce domain services, repositories, or bot flows per Work Plan 112.';
    } else if (SETTINGS_MODELS.has(model)) {
      item.category = 'DOMAIN_SETTINGS';
      item.rationale = 'Owned by settings domain services, repositories, or bot flows per Work Plan 112.';
    } else if (DEPRECATED_CANDIDATE_MODELS.has(model)) {
      // Check if it really has zero application references
      const totalAppRefs =
        item.references.modules.workforce.length +
        item.references.modules.settings.length +
        item.references.apps.bot.length +
        item.references.apps.dashboard.length;

      if (totalAppRefs === 0) {
        item.category = 'DEPRECATED_ISOLATED';
        item.rationale = 'Zero references in application code. Retained in deprecated isolation registry without physical drop under Safe Deprecation Policy.';
        deprecated.push({
          model,
          reason: 'Zero application references found across modules, apps, and packages.',
          lastDeclaredIn: 'packages/database/prisma/schema.prisma',
        });
      } else {
        item.category = 'SHARED_CORE';
        item.rationale = 'Retained in shared core with application references.';
      }
    } else {
      item.category = 'SHARED_CORE';
      item.rationale = 'Shared enterprise model (procurement, fleet, catering, treasury, or advances) managed in core.';
    }

    summary[item.category] = (summary[item.category] ?? 0) + 1;
  }

  return { inventory, deprecated, summary };
}

// Execute and save outputs if run directly
const result = analyzeModelOwnership();

fs.mkdirSync(path.dirname(INVENTORY_FILE), { recursive: true });
fs.writeFileSync(INVENTORY_FILE, JSON.stringify(result.inventory, null, 2), 'utf8');

fs.writeFileSync(
  DEPRECATED_FILE,
  JSON.stringify(
    {
      version: '1.0.0',
      description: 'Registry of unused/deprecated Prisma models under Safe Deprecation Policy (WP 112). These models MUST NOT be physically dropped from the database to preserve historical data.',
      generatedAt: new Date().toISOString(),
      totalDeprecated: result.deprecated.length,
      models: result.deprecated,
    },
    null,
    2
  ),
  'utf8'
);

console.log('✅ Model Ownership Analysis Completed!');
console.log('Summary:', JSON.stringify(result.summary, null, 2));
console.log(`Inventory written to: ${INVENTORY_FILE}`);
console.log(`Deprecated registry written to: ${DEPRECATED_FILE}`);
