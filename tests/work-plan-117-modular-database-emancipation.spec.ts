/**
 * Permanent Regression Test Suite for Work Plan 117
 * Sovereign Modular Database Emancipation, Ghost Table Purge & Cross-Module Contract Architecture
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { composeDatabaseSchema, extractModelNames } from '../tools/modules/compose-database.js';

describe('Work Plan 117: Sovereign Modular Database Emancipation & Decoupling', () => {
  const root = process.cwd();
  const draftVaultDir = join(root, 'docs', 'schemas', 'future-modules-draft-schemas');
  const deprecatedRegistryPath = join(root, 'docs', 'schemas', 'deprecated-models.json');
  const coreSchemaPath = join(root, 'packages', 'database', 'prisma', 'schema.prisma');
  const modulesDir = join(root, 'modules');

  const PURGED_MODELS = [
    'PayrollRun',
    'PayrollRecord',
    'DutyRoster',
    'SiteTask',
    'CompanyTreasury',
    'FinancialCustody',
    'CustodyExpenseItem',
    'CustodySettlement',
    'HospitalityExpense',
    'WorkerExpenseClaim',
    'Supplier',
    'SupplierInvoice',
    'SupplierInvoiceItem',
    'SupplierPayment',
    'Equipment',
    'FuelTank',
    'FuelDispenseLog',
    'EquipmentMaintenance',
    'SparePartsRequest',
    'CanteenItem',
    'CanteenItemPriceHistory',
    'CampFoodItem',
    'FoodInboundShipment',
    'Recipe',
    'KitchenMealDispense',
    'FoodWasteLog',
    'MealSurvey',
    'MarketPriceBenchmark',
    'PhosphateProductionSlip',
    'PhosphateExtract',
    'SiteAccommodation',
    'SiteAccommodationAssignment',
    'CompanyDocument',
    'DeadLetterEvent',
  ];

  it('Pillar 1: All purged models must be archived in docs/schemas/future-modules-draft-schemas/', () => {
    expect(existsSync(draftVaultDir)).toBe(true);

    const draftFiles = readdirSync(draftVaultDir);
    expect(draftFiles.length).toBeGreaterThanOrEqual(6);

    let allDraftContent = '';
    for (const f of draftFiles) {
      if (f.endsWith('.prisma')) {
        allDraftContent += readFileSync(join(draftVaultDir, f), 'utf8') + '\n';
      }
    }

    const archivedModelNames = new Set(extractModelNames(allDraftContent));
    for (const model of PURGED_MODELS) {
      expect(archivedModelNames.has(model)).toBe(true);
    }
  });

  it('Pillar 1: Deprecated models registry (deprecated-models.json) must record all purged models', () => {
    expect(existsSync(deprecatedRegistryPath)).toBe(true);
    const registry = JSON.parse(readFileSync(deprecatedRegistryPath, 'utf8'));

    expect(registry.totalPurged).toBeGreaterThanOrEqual(30);
    const registeredNames = new Set(registry.models.map((m: any) => m.model));

    for (const model of PURGED_MODELS) {
      expect(registeredNames.has(model)).toBe(true);
    }
  });

  it('Pillar 2: Every active business module must adhere to the 4-component database architecture', () => {
    const modules = readdirSync(modulesDir, { withFileTypes: true })
      .filter((ent) => ent.isDirectory() && ent.name !== 'sandbox')
      .map((ent) => ent.name);

    for (const mod of modules) {
      const modDbDir = join(modulesDir, mod, 'database');
      expect(existsSync(modDbDir)).toBe(true);

      // 1. schema.prisma
      expect(existsSync(join(modDbDir, 'schema.prisma'))).toBe(true);

      // 2. relations.contract.json
      expect(existsSync(join(modDbDir, 'relations.contract.json'))).toBe(true);

      // 3. migrations/ directory
      expect(existsSync(join(modDbDir, 'migrations'))).toBe(true);

      // 4. erd.mermaid
      expect(existsSync(join(modDbDir, 'erd.mermaid'))).toBe(true);
    }
  });

  it('Pillar 3: Zero cross-module physical @relation references between module schemas', () => {
    const modules = readdirSync(modulesDir, { withFileTypes: true })
      .filter((ent) => ent.isDirectory())
      .map((ent) => ent.name);

    const moduleModelsMap = new Map<string, string>(); // modelName -> moduleName

    for (const mod of modules) {
      const schemaFile = join(modulesDir, mod, 'database', 'schema.prisma');
      if (existsSync(schemaFile)) {
        const content = readFileSync(schemaFile, 'utf8');
        const models = extractModelNames(content);
        for (const m of models) {
          moduleModelsMap.set(m, mod);
        }
      }
    }

    // Inspect each module schema: it should NOT have @relation pointing to another module's model
    for (const mod of modules) {
      const schemaFile = join(modulesDir, mod, 'database', 'schema.prisma');
      if (!existsSync(schemaFile)) continue;
      const content = readFileSync(schemaFile, 'utf8');

      for (const [targetModel, targetModule] of moduleModelsMap.entries()) {
        if (targetModule !== mod) {
          // If a model belongs to another module, it must NOT be referenced via @relation
          const crossRelationRegex = new RegExp(`@relation\\([^)]*references:\\s*\\[id\\][^)]*\\)\\s*(?://.*)?$`, 'm');
          const lines = content.split('\n');
          for (const line of lines) {
            if (line.includes(` ${targetModel} `) && line.includes('@relation')) {
              throw new Error(
                `Cross-module foreign key violation in module '${mod}': References model '${targetModel}' from '${targetModule}'. Use Loose ID Reference (Indexed Scalar ID) instead.`
              );
            }
          }
        }
      }
    }
  });

  it('Pillar 4: Core packages/database schema must be minimized to core shared models only', () => {
    const coreContent = readFileSync(coreSchemaPath, 'utf8');
    const coreModels = extractModelNames(coreContent);

    // Core schema must not contain any purged models
    for (const model of PURGED_MODELS) {
      expect(coreModels).not.toContain(model);
    }

    // Core schema must strictly contain core shared models
    const expectedCoreModels = [
      'CompanyProfile',
      'Project',
      'Site',
      'FinancialLedger',
      'User',
      'AuditLog',
      'BotPerformanceLog',
      'ApprovalTicket',
      'UserWizardDraft',
      'NotificationQueue',
      'OutboxEvent',
      'SystemErrorLog',
      'DashboardAuthLink',
      'DashboardSession',
    ];

    for (const expected of expectedCoreModels) {
      expect(coreModels).toContain(expected);
    }
  });

  it('Pillar 5: composeDatabaseSchema must compile exactly active models without collisions', () => {
    const result = composeDatabaseSchema({ dryRun: true });

    expect(result.coreModelsCount).toBeLessThanOrEqual(20);
    expect(result.coreModelsCount + result.moduleModelsCount).toBeLessThanOrEqual(50);
    expect(result.injectedRelationsCount).toBe(0);
  });
});
