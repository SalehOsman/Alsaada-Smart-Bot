import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { Prisma } from '../src/generated/client/index.js';
import { prisma, disconnectDatabase } from '../src/client.js';

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
  afterAll(async () => {
    await disconnectDatabase();
  });

  it('verifies Worker model has additionalSalary and default contractType PERMANENT', () => {
    const workerModel = getModel('Worker');
    expect(workerModel).toBeDefined();

    // Check additionalSalary field
    const additionalSalaryField = workerModel?.fields.find((f) => f.name === 'additionalSalary');
    expect(additionalSalaryField).toBeDefined();
    expect(additionalSalaryField?.type).toBe('Decimal');
    expect(additionalSalaryField?.default).toBe(0);

    // Check basicSalary field is also present
    const basicSalaryField = workerModel?.fields.find((f) => f.name === 'basicSalary');
    expect(basicSalaryField).toBeDefined();
    expect(basicSalaryField?.type).toBe('Decimal');

    // Check contractType default value is PERMANENT
    const contractTypeField = workerModel?.fields.find((f) => f.name === 'contractType');
    expect(contractTypeField).toBeDefined();
    expect(contractTypeField?.type).toBe('String');
    expect(contractTypeField?.default).toBe('PERMANENT');
  });

  it('verifies WorkerCustomAllowance model has title field', () => {
    const allowanceModel = getModel('WorkerCustomAllowance');
    expect(allowanceModel).toBeDefined();

    const titleField = allowanceModel?.fields.find((f) => f.name === 'title');
    expect(titleField).toBeDefined();
    expect(titleField?.type).toBe('String');
    expect(titleField?.isRequired).toBe(true);
  });

  it('verifies CanteenItemPriceHistory model exists with all required fields', () => {
    const priceHistoryModel = getModel('CanteenItemPriceHistory');
    expect(priceHistoryModel).toBeDefined();

    const fieldNames = new Set(priceHistoryModel?.fields.map((f) => f.name));
    expect(fieldNames.has('id')).toBe(true);
    expect(fieldNames.has('canteenItemId')).toBe(true);
    expect(fieldNames.has('costPrice')).toBe(true);
    expect(fieldNames.has('sellingPrice')).toBe(true);
    expect(fieldNames.has('effectiveDate')).toBe(true);
    expect(fieldNames.has('changedBy')).toBe(true);
    expect(fieldNames.has('reason')).toBe(true);
    expect(fieldNames.has('createdAt')).toBe(true);
    expect(fieldNames.has('canteenItem')).toBe(true);

    const costPriceField = priceHistoryModel?.fields.find((f) => f.name === 'costPrice');
    expect(costPriceField?.type).toBe('Decimal');

    const sellingPriceField = priceHistoryModel?.fields.find((f) => f.name === 'sellingPrice');
    expect(sellingPriceField?.type).toBe('Decimal');

    const canteenItemRel = priceHistoryModel?.fields.find((f) => f.name === 'canteenItem');
    expect(canteenItemRel?.type).toBe('CanteenItem');
  });

  it('verifies CanteenItem model has priceHistories reverse relation', () => {
    const canteenItemModel = getModel('CanteenItem');
    expect(canteenItemModel).toBeDefined();

    const priceHistoriesField = canteenItemModel?.fields.find((f) => f.name === 'priceHistories');
    expect(priceHistoriesField).toBeDefined();
    expect(priceHistoriesField?.type).toBe('CanteenItemPriceHistory');
    expect(priceHistoriesField?.isList).toBe(true);
  });

  it('verifies TypeScript input types support new schema fields without compile error', () => {
    // Type-level contract checks
    const sampleWorkerInput: Prisma.WorkerCreateInput = {
      code: 'TEST-001',
      name: 'عامل تجريبي',
      idType: 'NATIONAL_ID',
      birthDate: new Date('1995-01-01'),
      gender: 'MALE',
      jobTitle: 'عامل',
      dailyWage: 100,
      basicSalary: 3000,
      additionalSalary: 1500,
      contractType: 'PERMANENT',
    };
    expect(sampleWorkerInput.additionalSalary).toBe(1500);

    const sampleAllowanceInput: Prisma.WorkerCustomAllowanceCreateInput = {
      title: 'بدل مخاطر موقع',
      allowanceType: 'RISK_ALLOWANCE',
      amount: 500,
      startDate: new Date(),
      worker: { connect: { id: 'dummy-worker-id' } },
    };
    expect(sampleAllowanceInput.title).toBe('بدل مخاطر موقع');

    const samplePriceHistoryInput: Prisma.CanteenItemPriceHistoryCreateInput = {
      costPrice: new Prisma.Decimal(50),
      sellingPrice: new Prisma.Decimal(60),
      reason: 'زيادة سعر المورد',
      canteenItem: { connect: { id: 'dummy-item-id' } },
    };
    expect(samplePriceHistoryInput.reason).toBe('زيادة سعر المورد');
  });

  it('verifies PostgreSQL migration script exists and defines all Milestone 1 schema modifications', () => {
    const migrationPath = resolve(
      __dirname,
      '../prisma/migrations/20260914120000_workforce_parity_and_canteen_price_history/migration.sql'
    );
    expect(existsSync(migrationPath)).toBe(true);

    const sqlContent = readFileSync(migrationPath, 'utf-8');
    expect(sqlContent).toContain('additionalSalary');
    expect(sqlContent).toContain('contractType');
    expect(sqlContent).toContain('PERMANENT');
    expect(sqlContent).toContain('worker_custom_allowances');
    expect(sqlContent).toContain('title');
    expect(sqlContent).toContain('canteen_item_price_histories');
    expect(sqlContent).toContain('canteenItemId');
    expect(sqlContent).toContain('sellingPrice');
  });

  it('verifies live postgres database schema if database connection is available', async () => {
    const isConnected = await canConnect();
    if (!isConnected) {
      console.warn('PostgreSQL database not active, skipping live database inspection');
      return;
    }

    type TableRow = { table_name: string };
    const tables = await prisma.$queryRawUnsafe<TableRow[]>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'canteen_item_price_histories'"
    );
    const tableNames = new Set(tables.map((t) => t.table_name));
    expect(tableNames.has('canteen_item_price_histories')).toBe(true);

    type ColumnRow = { column_name: string };
    const workerCols = await prisma.$queryRawUnsafe<ColumnRow[]>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workers' AND column_name = 'additionalSalary'"
    );
    expect(workerCols.length).toBeGreaterThan(0);

    const allowanceCols = await prisma.$queryRawUnsafe<ColumnRow[]>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'worker_custom_allowances' AND column_name = 'title'"
    );
    expect(allowanceCols.length).toBeGreaterThan(0);
  });

  it('performs live create, query and relation test on PostgreSQL for new models and fields', async () => {
    const isConnected = await canConnect();
    if (!isConnected) return;

    // 1. Resolve or create a site for canteen item
    let site = await prisma.site.findFirst();
    let createdSiteId: string | null = null;
    let createdProjectId: string | null = null;
    let createdTenantId: string | null = null;

    if (!site) {
      let tenant = await prisma.tenant.findFirst();
      if (!tenant) {
        tenant = await prisma.tenant.create({
          data: { code: `TNT-${Date.now()}`, name: 'شركة تجريبية' },
        });
        createdTenantId = tenant.id;
      }
      let project = await prisma.project.findFirst({ where: { tenantId: tenant.id } });
      if (!project) {
        project = await prisma.project.create({
          data: {
            tenantId: tenant.id,
            code: `PRJ-${Date.now()}`,
            name: 'مشروع تجريبي',
          },
        });
        createdProjectId = project.id;
      }
      site = await prisma.site.create({
        data: {
          projectId: project.id,
          code: `STE-${Date.now()}`,
          name: 'موقع تجريبي',
        },
      });
      createdSiteId = site.id;
    }

    // 2. Create a canteen item
    const item = await prisma.canteenItem.create({
      data: {
        siteId: site.id,
        code: `CIG-TEST-${Date.now()}`,
        name: 'سجائر كليوباترا بوكس تجريبية',
        category: 'CIGARETTES',
        costPrice: 50,
        sellingPrice: 55,
      },
    });

    // 3. Create price history record linked to canteen item
    const history = await prisma.canteenItemPriceHistory.create({
      data: {
        canteenItemId: item.id,
        costPrice: 50,
        sellingPrice: 55,
        reason: 'السعر الافتتاحي المعتمد',
        effectiveDate: new Date(),
      },
      include: {
        canteenItem: true,
      },
    });

    expect(history.id).toBeDefined();
    expect(Number(history.costPrice)).toBe(50);
    expect(Number(history.sellingPrice)).toBe(55);
    expect(history.canteenItem.id).toBe(item.id);

    // 4. Create worker with additionalSalary and custom allowance with title
    const worker = await prisma.worker.create({
      data: {
        code: `WRK-TEST-${Date.now()}`,
        name: 'عامل تجريبي لاختبار الراتب والبدل',
        idType: 'NATIONAL_ID',
        birthDate: new Date('1995-05-15'),
        gender: 'MALE',
        jobTitle: 'عامل عادي',
        dailyWage: 150,
        basicSalary: 4500,
        additionalSalary: 1500,
        // contractType defaults to PERMANENT
        customAllowances: {
          create: {
            title: 'بدل مشقة ميداني خاص',
            allowanceType: 'HARDSHIP_ALLOWANCE',
            amount: 750,
            startDate: new Date(),
          },
        },
      },
      include: {
        customAllowances: true,
      },
    });

    expect(worker.id).toBeDefined();
    expect(worker.contractType).toBe('PERMANENT'); // Verified default
    expect(Number(worker.additionalSalary)).toBe(1500);
    expect(worker.customAllowances).toHaveLength(1);
    expect(worker.customAllowances[0]?.title).toBe('بدل مشقة ميداني خاص');
    expect(Number(worker.customAllowances[0]?.amount)).toBe(750);

    // Cleanup test records
    await prisma.canteenItemPriceHistory.deleteMany({ where: { canteenItemId: item.id } });
    await prisma.canteenItem.delete({ where: { id: item.id } });
    if (createdSiteId) await prisma.site.delete({ where: { id: createdSiteId } });
    if (createdProjectId) await prisma.project.delete({ where: { id: createdProjectId } });
    if (createdTenantId) await prisma.tenant.delete({ where: { id: createdTenantId } });
    await prisma.workerCustomAllowance.deleteMany({ where: { workerId: worker.id } });
    await prisma.worker.delete({ where: { id: worker.id } });
  });
});
