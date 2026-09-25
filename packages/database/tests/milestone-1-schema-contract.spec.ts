import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../src/generated/client/index.js';
import { prisma, disconnectDatabase } from '../src/client.js';

const PINNED_BASE_TIME = new Date('2026-09-11T12:00:00.000Z');

let idCounter = 0;
const nextTestCode = (prefix: string) => `${prefix}-${PINNED_BASE_TIME.getTime()}-${++idCounter}`;

const canConnect = async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return true;
  } catch {
    return false;
  }
};

interface SchemaField {
  name: string;
  type: string;
  isList: boolean;
  isRequired: boolean;
  default?: any;
}

interface SchemaModel {
  name: string;
  fields: SchemaField[];
}

function parseSchemaModels(schemaContent: string): SchemaModel[] {
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\}/g;
  const models: SchemaModel[] = [];
  let match: RegExpExecArray | null;

  while ((match = modelRegex.exec(schemaContent)) !== null) {
    const modelName = match[1];
    const body = match[2];
    if (!modelName || !body) continue;

    const fields: SchemaField[] = [];

    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

      const tokens = trimmed.split(/\s+/);
      const name = tokens[0];
      let type = tokens[1];
      if (!name || !type) continue;

      const isList = type.endsWith('[]');
      if (isList) type = type.slice(0, -2);
      const isOptional = type.endsWith('?');
      if (isOptional) type = type.slice(0, -1);

      let defaultValue: any = undefined;
      const defaultMatch = trimmed.match(/@default\(([^)]+)\)/);
      if (defaultMatch && defaultMatch[1]) {
        const rawDef = defaultMatch[1].trim();
        if (rawDef === 'true') defaultValue = true;
        else if (rawDef === 'false') defaultValue = false;
        else if (!isNaN(Number(rawDef))) defaultValue = Number(rawDef);
        else if (rawDef.startsWith('"') && rawDef.endsWith('"')) defaultValue = rawDef.slice(1, -1);
        else defaultValue = rawDef;
      }

      fields.push({
        name,
        type,
        isList,
        isRequired: !isOptional,
        default: defaultValue,
      });
    }
    models.push({ name: modelName, fields });
  }
  return models;
}

const schemaPath = resolve(__dirname, '../prisma/schema.prisma');
const schemaContent = readFileSync(schemaPath, 'utf-8');
const models = parseSchemaModels(schemaContent);
const getModel = (name: string) => models.find((m) => m.name === name);

describe('Milestone 1 — Schema Contract & Model Verification', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(PINNED_BASE_TIME);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('verifies Worker model has additionalSalary and default contractType PERMANENT', () => {
    // Arrange
    const targetModelName = 'Worker';

    // Act
    const workerModel = getModel(targetModelName);
    const additionalSalaryField = workerModel?.fields.find((f) => f.name === 'additionalSalary');
    const basicSalaryField = workerModel?.fields.find((f) => f.name === 'basicSalary');
    const contractTypeField = workerModel?.fields.find((f) => f.name === 'contractType');
    const nonExistentField = workerModel?.fields.find((f) => f.name === 'nonExistentField');

    // Assert
    expect(workerModel).toBeDefined();
    expect(additionalSalaryField).toBeDefined();
    expect(additionalSalaryField?.type).toBe('Decimal');
    expect(additionalSalaryField?.default).toBe(0);
    expect(basicSalaryField).toBeDefined();
    expect(basicSalaryField?.type).toBe('Decimal');
    expect(contractTypeField).toBeDefined();
    expect(contractTypeField?.type).toBe('String');
    expect(contractTypeField?.default).toBe('PERMANENT');
    expect(nonExistentField).toBeUndefined();
  });

  it('verifies WorkerCustomAllowance model has title field', () => {
    // Arrange
    const targetModelName = 'WorkerCustomAllowance';

    // Act
    const allowanceModel = getModel(targetModelName);
    const titleField = allowanceModel?.fields.find((f) => f.name === 'title');
    const nonExistentField = allowanceModel?.fields.find((f) => f.name === 'nonExistentField');

    // Assert
    expect(allowanceModel).toBeDefined();
    expect(titleField).toBeDefined();
    expect(titleField?.type).toBe('String');
    expect(titleField?.isRequired).toBe(true);
    expect(nonExistentField).toBeUndefined();
  });

  it('verifies CanteenItemPriceHistory model exists with all required fields', () => {
    // Arrange
    const targetModelName = 'CanteenItemPriceHistory';

    // Act
    const priceHistoryModel = getModel(targetModelName);
    const fieldNames = new Set(priceHistoryModel?.fields.map((f) => f.name));
    const costPriceField = priceHistoryModel?.fields.find((f) => f.name === 'costPrice');
    const sellingPriceField = priceHistoryModel?.fields.find((f) => f.name === 'sellingPrice');
    const canteenItemRel = priceHistoryModel?.fields.find((f) => f.name === 'canteenItem');

    // Assert
    expect(priceHistoryModel).toBeDefined();
    expect(fieldNames.has('id')).toBe(true);
    expect(fieldNames.has('canteenItemId')).toBe(true);
    expect(fieldNames.has('costPrice')).toBe(true);
    expect(fieldNames.has('sellingPrice')).toBe(true);
    expect(fieldNames.has('effectiveDate')).toBe(true);
    expect(fieldNames.has('changedBy')).toBe(true);
    expect(fieldNames.has('reason')).toBe(true);
    expect(fieldNames.has('createdAt')).toBe(true);
    expect(fieldNames.has('canteenItem')).toBe(true);
    expect(costPriceField?.type).toBe('Decimal');
    expect(sellingPriceField?.type).toBe('Decimal');
    expect(canteenItemRel?.type).toBe('CanteenItem');
    expect(fieldNames.has('invalidFieldName')).toBe(false);
  });

  it('verifies CanteenItem model has priceHistories reverse relation', () => {
    // Arrange
    const targetModelName = 'CanteenItem';

    // Act
    const canteenItemModel = getModel(targetModelName);
    const priceHistoriesField = canteenItemModel?.fields.find((f) => f.name === 'priceHistories');
    const nonExistentField = canteenItemModel?.fields.find((f) => f.name === 'nonExistentField');

    // Assert
    expect(canteenItemModel).toBeDefined();
    expect(priceHistoriesField).toBeDefined();
    expect(priceHistoriesField?.type).toBe('CanteenItemPriceHistory');
    expect(priceHistoriesField?.isList).toBe(true);
    expect(nonExistentField).toBeUndefined();
  });

  it('verifies TypeScript input types support new schema fields without compile error', () => {
    // Arrange
    const sampleWorkerInput: Prisma.WorkerCreateInput = {
      code: 'TEST-001',
      name: 'عامل تجريبي',
      idType: 'NATIONAL_ID',
      birthDate: new Date('1995-01-01T00:00:00.000Z'),
      gender: 'MALE',
      jobTitle: 'عامل',
      dailyWage: 100,
      basicSalary: 3000,
      additionalSalary: 1500,
      contractType: 'PERMANENT',
    };

    const sampleAllowanceInput: Prisma.WorkerCustomAllowanceCreateInput = {
      title: 'بدل مخاطر موقع',
      allowanceType: 'RISK_ALLOWANCE',
      amount: 500,
      startDate: PINNED_BASE_TIME,
      worker: { connect: { id: 'dummy-worker-id' } },
    };

    const samplePriceHistoryInput: Prisma.CanteenItemPriceHistoryCreateInput = {
      costPrice: new Prisma.Decimal(50),
      sellingPrice: new Prisma.Decimal(60),
      reason: 'زيادة سعر المورد',
      canteenItem: { connect: { id: 'dummy-item-id' } },
    };

    // Act
    const salaryVal = sampleWorkerInput.additionalSalary;
    const allowanceTitle = sampleAllowanceInput.title;
    const historyReason = samplePriceHistoryInput.reason;

    // Assert
    expect(salaryVal).toBe(1500);
    expect(allowanceTitle).toBe('بدل مخاطر موقع');
    expect(historyReason).toBe('زيادة سعر المورد');
    expect(sampleWorkerInput.code).not.toBe('');
  });

  it('verifies PostgreSQL migration script exists and defines all Milestone 1 schema modifications', () => {
    // Arrange
    const migrationPath = resolve(
      __dirname,
      '../prisma/migrations/20260914120000_workforce_parity_and_canteen_price_history/migration.sql'
    );

    // Act
    const fileExists = existsSync(migrationPath);
    const sqlContent = readFileSync(migrationPath, 'utf-8');

    // Assert
    expect(fileExists).toBe(true);
    expect(sqlContent).toContain('additionalSalary');
    expect(sqlContent).toContain('contractType');
    expect(sqlContent).toContain('PERMANENT');
    expect(sqlContent).toContain('worker_custom_allowances');
    expect(sqlContent).toContain('title');
    expect(sqlContent).toContain('canteen_item_price_histories');
    expect(sqlContent).toContain('canteenItemId');
    expect(sqlContent).toContain('sellingPrice');
    expect(sqlContent).not.toContain('DROP TABLE workers');
  });

  it('verifies live postgres database schema if database connection is available', async () => {
    // Arrange
    const isConnected = await canConnect();
    if (!isConnected) {
      return;
    }

    // Act
    type TableRow = { table_name: string };
    const tables = await prisma.$queryRawUnsafe<TableRow[]>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'canteen_item_price_histories'"
    );
    const tableNames = new Set(tables.map((t) => t.table_name));

    type ColumnRow = { column_name: string };
    const workerCols = await prisma.$queryRawUnsafe<ColumnRow[]>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workers' AND column_name = 'additionalSalary'"
    );

    const allowanceCols = await prisma.$queryRawUnsafe<ColumnRow[]>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'worker_custom_allowances' AND column_name = 'title'"
    );

    // Assert
    expect(tableNames.has('canteen_item_price_histories')).toBe(true);
    expect(workerCols.length).toBeGreaterThan(0);
    expect(allowanceCols.length).toBeGreaterThan(0);
    expect(tableNames.has('non_existent_table_probe')).toBe(false);
  });

  it('performs live create, query and relation test on PostgreSQL for new models and fields', async () => {
    // Arrange
    const isConnected = await canConnect();
    if (!isConnected) return;

    let site = await prisma.site.findFirst();
    let createdSiteId: string | null = null;
    let createdProjectId: string | null = null;

    if (!site) {
      let project = await prisma.project.findFirst();
      if (!project) {
        project = await prisma.project.create({
          data: {
            code: nextTestCode('PRJ'),
            name: 'مشروع تجريبي',
          },
        });
        createdProjectId = project.id;
      }
      site = await prisma.site.create({
        data: {
          projectId: project.id,
          code: nextTestCode('STE'),
          name: 'موقع تجريبي',
        },
      });
      createdSiteId = site.id;
    }

    // Act
    const item = await prisma.canteenItem.create({
      data: {
        siteId: site.id,
        code: nextTestCode('CIG'),
        name: 'سجائر كليوباترا بوكس تجريبية',
        category: 'CIGARETTES',
        costPrice: 50,
        sellingPrice: 55,
      },
    });

    const history = await prisma.canteenItemPriceHistory.create({
      data: {
        canteenItemId: item.id,
        costPrice: 50,
        sellingPrice: 55,
        reason: 'السعر الافتتاحي المعتمد',
        effectiveDate: PINNED_BASE_TIME,
      },
      include: {
        canteenItem: true,
      },
    });

    const worker = await prisma.worker.create({
      data: {
        code: nextTestCode('WRK'),
        name: 'عامل تجريبي لاختبار الراتب والبدل',
        idType: 'NATIONAL_ID',
        birthDate: new Date('1995-05-15T00:00:00.000Z'),
        gender: 'MALE',
        jobTitle: 'عامل عادي',
        dailyWage: 150,
        basicSalary: 4500,
        additionalSalary: 1500,
        customAllowances: {
          create: {
            title: 'بدل مشقة ميداني خاص',
            allowanceType: 'HARDSHIP_ALLOWANCE',
            amount: 750,
            startDate: PINNED_BASE_TIME,
          },
        },
      },
      include: {
        customAllowances: true,
      },
    });

    // Assert
    expect(history.id).toBeDefined();
    expect(Number(history.costPrice)).toBe(50);
    expect(Number(history.sellingPrice)).toBe(55);
    expect(history.canteenItem.id).toBe(item.id);
    expect(worker.id).toBeDefined();
    expect(worker.contractType).toBe('PERMANENT');
    expect(Number(worker.additionalSalary)).toBe(1500);
    expect(worker.customAllowances).toHaveLength(1);
    expect(worker.customAllowances[0]?.title).toBe('بدل مشقة ميداني خاص');
    expect(Number(worker.customAllowances[0]?.amount)).toBe(750);
    expect(worker.deletedAt).toBeNull();

    // Cleanup
    await prisma.canteenItemPriceHistory.deleteMany({ where: { canteenItemId: item.id } });
    await prisma.canteenItem.delete({ where: { id: item.id } });
    if (createdSiteId) await prisma.site.delete({ where: { id: createdSiteId } });
    if (createdProjectId) await prisma.project.delete({ where: { id: createdProjectId } });
    await prisma.workerCustomAllowance.deleteMany({ where: { workerId: worker.id } });
    await prisma.worker.delete({ where: { id: worker.id } });
  });
});
