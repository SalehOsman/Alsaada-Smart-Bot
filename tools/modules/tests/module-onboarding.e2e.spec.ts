import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { scanMonorepoCatalog } from '../catalog.js';
import { validateMonorepoCatalog } from '../validate-catalog.js';
import { verifyCoreImmutability, computeCoreHash } from '../../governance/verify-core-immutability.js';
import { verifyModuleBoundaries } from '../../governance/verify-module-boundaries.js';
import { buildRelease } from '../build-release.js';
import { verifyRelease } from '../verify-release.js';
import {
  SampleFlowHandler,
} from './fixtures/acceptance-module/src/flows/89.1-sample-flow-one/flow.handler.js';
import {
  SampleQueryHandler,
} from './fixtures/acceptance-module/src/flows/89.2-sample-flow-two/flow.handler.js';
import {
  moduleRoutes,
} from './fixtures/acceptance-module/src/module.routes.js';
import {
  adminRoutes,
} from './fixtures/acceptance-module/src/admin/routes.js';
import {
  adminNavigationItems,
} from './fixtures/acceptance-module/src/admin/navigation.js';

describe('Work Plan 89 — End-to-End Module Onboarding & Acceptance Verification (Phase P11)', () => {
  const fixtureDir = path.resolve(__dirname, 'fixtures/acceptance-module');
  const tempRootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alsaada-e2e-onboarding-'));
  const tempModulesDir = path.join(tempRootDir, 'modules');
  const tempModuleDir = path.join(tempModulesDir, 'sample-domain');

  beforeAll(() => {
    // Copy fixture to isolated temporary directory inside os.tmpdir()
    fs.mkdirSync(tempModulesDir, { recursive: true });
    fs.cpSync(fixtureDir, tempModuleDir, { recursive: true });
  });

  afterAll(() => {
    // Clean up temporary module inside os.tmpdir() so we never touch working tree
    if (fs.existsSync(tempRootDir)) {
      fs.rmSync(tempRootDir, { recursive: true, force: true });
    }
  });

  // 1. Catalog Autodiscovery
  it('E2E-1: dynamically discovers sample-domain module and flows 89.1 and 89.2', () => {
    const catalog = scanMonorepoCatalog(tempRootDir);
    const sampleMod = catalog.modules.find((m) => m.id === 'sample-domain');

    expect(sampleMod).toBeDefined();
    expect(sampleMod?.schemaVersion).toBe('2.0.0');
    expect(sampleMod?.titleArabic).toBe('نطاق العينة التجريبي للقبول');
    expect(sampleMod?.status).toBe('active');

    // Verify discovered flows
    expect(sampleMod?.flows.length).toBe(2);
    const flow1 = sampleMod?.flows.find((f) => f.id === '89.1');
    const flow2 = sampleMod?.flows.find((f) => f.id === '89.2');

    expect(flow1).toBeDefined();
    expect(flow1?.slug).toBe('sample-flow-one');
    expect(flow1?.titleArabic).toBe('تدفق العينة الأول - إنشاء وتفويض');

    expect(flow2).toBeDefined();
    expect(flow2?.slug).toBe('sample-flow-two');
    expect(flow2?.titleArabic).toBe('تدفق العينة الثاني - استعلام وسجل');

    // Verify catalog validation passes
    const validation = validateMonorepoCatalog(catalog, tempRootDir);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  // 2. Bot Route Autodiscovery & RBAC Execution
  it('E2E-2: verifies bot autodiscovery routes and executes Flow 89.1 & 89.2 independently', async () => {
    expect(moduleRoutes).toHaveLength(2);
    const startRoute = moduleRoutes.find((r) => r.pattern === 'action:sample:start');
    expect(startRoute).toBeDefined();
    expect(startRoute?.roles).toContain('SUPER_ADMIN');

    // Test Flow 89.1 Handler
    const handler89_1 = new SampleFlowHandler();

    // Unauthorized access rejection
    const unauthResponse = await handler89_1.handleStart(101, 'WORKER');
    expect(unauthResponse.text).toContain('غير مصرح لك');
    expect(unauthResponse.keyboard).toHaveLength(0);

    // Authorized access
    const authResponse = await handler89_1.handleStart(101, 'SUPER_ADMIN');
    expect(authResponse.text).toContain('مرحبًا بك');
    expect(authResponse.keyboard.length).toBeGreaterThan(0);

    // Confirm execution
    const confirmResponse = await handler89_1.handleConfirm(101, 'عملية شراء تجريبية', 5000);
    expect(confirmResponse.text).toContain('تم إنشاء السجل التجريبي بنجاح');
    expect(confirmResponse.record.amount).toBe(5000);

    // Test Flow 89.2 Handler (Reading data with zero modifications to 89.1)
    const handler89_2 = new SampleQueryHandler();
    const queryResponse = await handler89_2.handleQuery(101, 'SUPER_ADMIN', 'APPROVED');
    expect(queryResponse.text).toContain('سجل العمليات التجريبية');
    expect(queryResponse.records?.length).toBeGreaterThan(0);
  });

  // 3. Admin Dynamic Extensions
  it('E2E-3: discovers admin dashboard dynamic routes and navigation items', () => {
    expect(adminRoutes).toHaveLength(2);
    expect(adminRoutes[0]?.path).toBe('/modules/sample-domain');
    expect(adminRoutes[0]?.requiredRole).toBe('SUPER_ADMIN');

    expect(adminNavigationItems).toHaveLength(1);
    expect(adminNavigationItems[0]?.id).toBe('sample-domain-overview');
    expect(adminNavigationItems[0]?.labelArabic).toBe('نطاق العينة');
    expect(adminNavigationItems[0]?.requiredRole).toBe('SUPER_ADMIN');
  });

  // 4. Zero Core Modifications Invariant
  it('E2E-4: enforces zero core modifications invariant during module onboarding', () => {
    const immutabilityResult = verifyCoreImmutability(process.cwd(), {
      changedFiles: ['modules/sample-domain/module.contract.json', 'modules/sample-domain/src/index.ts'],
    });
    expect(immutabilityResult.ok).toBe(true);
    expect(immutabilityResult.failures).toHaveLength(0);
    expect(immutabilityResult.checkedFiles).toBeGreaterThan(200);

    const { hash } = computeCoreHash(process.cwd());
    expect(hash).toHaveLength(64);
  });

  // 5. Package Layering & Module Isolation
  it('E2E-5: validates package boundary isolation and zero illegal imports', () => {
    const boundaryResult = verifyModuleBoundaries(process.cwd());
    expect(boundaryResult.ok).toBe(true);
    expect(boundaryResult.failures).toHaveLength(0);
  });

  // 6. Production Release Artifact Packaging & Verification
  it('E2E-6: builds, packages, and verifies production release artifact for sample-domain', () => {
    const outDir = path.join(tempRootDir, 'release-artifact');
    const releaseResult = buildRelease({
      root: tempRootDir,
      outDir,
    });

    expect(releaseResult.ok).toBe(true);
    expect(releaseResult.manifest).toBeDefined();
    expect(releaseResult.manifestPath).toBeDefined();

    const sampleInManifest = releaseResult.manifest?.modules.find((m) => m.id === 'sample-domain');
    expect(sampleInManifest).toBeDefined();
    expect(sampleInManifest?.flowsCount).toBe(2);

    // Verify release artifact integrity
    const verifyResult = verifyRelease({
      manifestPath: releaseResult.manifestPath,
      root: tempRootDir,
    });
    expect(verifyResult.ok).toBe(true);
    expect(verifyResult.errors).toHaveLength(0);
  });
});
