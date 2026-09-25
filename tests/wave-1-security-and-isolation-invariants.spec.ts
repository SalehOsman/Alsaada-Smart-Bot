import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { assertTestDatabaseSafety } from '../scripts/test-db-setup.js';

describe('Wave 1 Invariants — Security, Test Isolation, Hono Engine & Telegram Local API', () => {
  const rootDir = process.cwd();

  // 1. Hono Dependencies in apps/bot-server
  it('INV-1: apps/bot-server/package.json contains hono and @hono/node-server dependencies', () => {
    const pkgPath = path.join(rootDir, 'apps/bot-server/package.json');
    expect(fs.existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(pkg.dependencies).toHaveProperty('hono');
    expect(pkg.dependencies).toHaveProperty('@hono/node-server');
  });

  // 2. Hono Integration & Deep Health Probes in apps/bot-server/src/index.ts
  it('INV-2: apps/bot-server/src/index.ts implements Hono engine and deep health checks on runner and database', () => {
    const indexPath = path.join(rootDir, 'apps/bot-server/src/index.ts');
    expect(fs.existsSync(indexPath)).toBe(true);
    const content = fs.readFileSync(indexPath, 'utf8');

    // Hono engine imported and instantiated
    expect(content).toContain("import { Hono } from 'hono'");
    expect(content).toContain("import { serve } from '@hono/node-server'");
    expect(content).toContain('const app = new Hono()');

    // Deep health routes defined
    expect(content).toContain("app.get('/health/liveness'");
    expect(content).toContain("app.get('/api/health'");
    expect(content).toContain("app.get('/health/readiness'");

    // Real component health checks (runner, db, redis)
    expect(content).toContain('pingDatabase()');
    expect(content).toContain('redis.ping()');
    expect(content).toContain('statusCode = allHealthy ? 200 : 503');

    // Webhook support via Hono
    expect(content).toContain("app.post('/webhook', webhookCallback(bot, 'hono'))");
  });

  // 3. Telegram Local Bot API Configuration in env.ts
  it('INV-3: apps/bot-server/src/config/env.ts exports telegramApiRoot, telegramLocal, and webhookUrl', () => {
    const envPath = path.join(rootDir, 'apps/bot-server/src/config/env.ts');
    expect(fs.existsSync(envPath)).toBe(true);
    const content = fs.readFileSync(envPath, 'utf8');

    expect(content).toContain('telegramApiRoot: string;');
    expect(content).toContain('telegramLocal: boolean;');
    expect(content).toContain('webhookUrl: string;');
    expect(content).toContain("process.env.TELEGRAM_API_ROOT || 'https://api.telegram.org'");
  });

  // 4. Docker Compose Telegram Local Bot API & Bot Healthcheck
  it('INV-4: docker-compose.yml defines telegram-bot-api service and bot healthcheck', () => {
    const composePath = path.join(rootDir, 'docker-compose.yml');
    expect(fs.existsSync(composePath)).toBe(true);
    const content = fs.readFileSync(composePath, 'utf8');

    // telegram-bot-api container definition
    expect(content).toContain('telegram-bot-api:');
    expect(content).toContain('image: aiogram/telegram-bot-api:latest');
    expect(content).toContain('container_name: alsaada_enterprise_telegram_api');
    expect(content).toContain('telegram_bot_api_data:');

    // bot service healthcheck
    expect(content).toContain('healthcheck:');
    expect(content).toContain('wget -qO- http://127.0.0.1:${PORT:-3000}/api/health || exit 1');
    expect(content).toContain('TELEGRAM_API_ROOT: ${TELEGRAM_API_ROOT:-http://telegram-bot-api:8081}');
  });

  // 5. ADR-005 Documents Hono & Telegram Local API
  it('INV-5: ADR-005 documents Hono engine and Telegram Local Bot API architecture', () => {
    const adrPath = path.join(rootDir, 'apps/docs/src/content/docs/adrs/adr-005.md');
    expect(fs.existsSync(adrPath)).toBe(true);
    const content = fs.readFileSync(adrPath, 'utf8');

    expect(content).toContain('Embedded Web Server Engine (Hono API & Webhooks)');
    expect(content).toContain('ADR-005');
    expect(content).toContain('Accepted');
  });

  // 6. E2E Test Isolation in os.tmpdir()
  it('INV-6: module-onboarding.e2e.spec.ts operates inside os.tmpdir() and never deletes repo modules/sample-domain', () => {
    const e2ePath = path.join(rootDir, 'tools/modules/tests/module-onboarding.e2e.spec.ts');
    expect(fs.existsSync(e2ePath)).toBe(true);
    const content = fs.readFileSync(e2ePath, 'utf8');

    expect(content).toContain("import * as os from 'node:os'");
    expect(content).toContain("fs.mkdtempSync(path.join(os.tmpdir(), 'alsaada-e2e-onboarding-'))");
    expect(content).not.toContain("path.resolve(process.cwd(), 'modules/sample-domain')");
  });

  // 7. vitest.config.ts Fallback Targets alsaada_test_db
  it('INV-7: vitest.config.ts fallback DATABASE_URL strictly targets alsaada_test_db', () => {
    const vitestPath = path.join(rootDir, 'vitest.config.ts');
    expect(fs.existsSync(vitestPath)).toBe(true);
    const content = fs.readFileSync(vitestPath, 'utf8');

    expect(content).toContain('/alsaada_test_db?schema=public');
    expect(content).not.toContain("DATABASE_URL: process.env.DATABASE_URL || 'postgresql://alsaada_admin:alsaada_secure_pass_2026@127.0.0.1:5432/alsaada_db?schema=public'");
  });

  // 8. test-db-setup.ts Fail-Fast Guard against alsaada_db
  it('INV-8: test-db-setup.ts fails fast and throws error if target URL is production alsaada_db', () => {
    const prodUrl = 'postgresql://alsaada_admin:pass@127.0.0.1:5432/alsaada_db?schema=public';
    expect(() => assertTestDatabaseSafety(prodUrl)).toThrowError(/FATAL TEST ISOLATION BREACH/);

    const safeUrl = 'postgresql://alsaada_admin:pass@127.0.0.1:5432/alsaada_test_db?schema=public';
    expect(() => assertTestDatabaseSafety(safeUrl)).not.toThrow();
  });

  // 9. docs/README.md Documentation Parity
  it('INV-9: docs/README.md links to 29-master-tests-... and records 291 test count', () => {
    const readmePath = path.join(rootDir, 'docs/README.md');
    expect(fs.existsSync(readmePath)).toBe(true);
    const content = fs.readFileSync(readmePath, 'utf8');

    expect(content).toContain('29-master-tests-physical-reality-and-compliance-ledger.md');
    expect(content).toContain('291 جناحاً حقيقياً');
    expect(content).not.toContain('28-master-tests-physical-reality-and-compliance-ledger.md');
  });
});
