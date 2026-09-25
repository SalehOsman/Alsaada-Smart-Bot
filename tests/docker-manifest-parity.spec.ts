import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

describe('Docker manifest and monorepo workspace parity guard (INC-20260925-DOCKER-DASHBOARD-PARITY)', () => {
  test('verifies all docker/Dockerfile* files copy package.json and source files for all monorepo modules and packages dynamically', () => {
    const root = process.cwd();
    const dockerfileBot = readFileSync(join(root, 'docker', 'Dockerfile'), 'utf8');
    const dockerfileDashboard = readFileSync(join(root, 'docker', 'Dockerfile.dashboard'), 'utf8');
    const dockerfileDocs = readFileSync(join(root, 'docker', 'Dockerfile.docs'), 'utf8');

    const moduleDirs = readdirSync(join(root, 'modules'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(root, 'modules', entry.name, 'package.json')))
      .map((entry) => entry.name);

    expect(moduleDirs).toEqual(expect.arrayContaining(['workforce', 'settings', 'sandbox']));

    // 1. Verify Bot Dockerfile (Full manifest + source)
    for (const mod of moduleDirs) {
      expect(dockerfileBot).toContain(`COPY modules/${mod}/package.json modules/${mod}/`);
      expect(dockerfileBot).toContain(`COPY modules/${mod}/src/ modules/${mod}/src/`);
      expect(dockerfileBot).toContain(`COPY modules/${mod}/index.ts modules/${mod}/`);
      expect(dockerfileBot).toContain(`COPY modules/${mod}/module.contract.json modules/${mod}/`);
      expect(dockerfileBot).toContain(`COPY modules/${mod}/tsconfig.json modules/${mod}/`);
    }

    // 2. Verify Dashboard Dockerfile (Full manifest + source)
    for (const mod of moduleDirs) {
      expect(dockerfileDashboard).toContain(`COPY modules/${mod}/package.json modules/${mod}/`);
      expect(dockerfileDashboard).toContain(`COPY modules/${mod}/src/ modules/${mod}/src/`);
      expect(dockerfileDashboard).toContain(`COPY modules/${mod}/index.ts modules/${mod}/`);
      expect(dockerfileDashboard).toContain(`COPY modules/${mod}/module.contract.json modules/${mod}/`);
      expect(dockerfileDashboard).toContain(`COPY modules/${mod}/tsconfig.json modules/${mod}/`);
    }

    // 3. Verify Docs Dockerfile (Manifest parity for pnpm install)
    for (const mod of moduleDirs) {
      expect(dockerfileDocs).toContain(`COPY modules/${mod}/package.json modules/${mod}/`);
    }

    const packageDirs = readdirSync(join(root, 'packages'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(root, 'packages', entry.name, 'package.json')))
      .map((entry) => entry.name);

    expect(packageDirs.length).toBeGreaterThanOrEqual(9);

    const dockerfileStudio = readFileSync(join(root, 'docker', 'Dockerfile.studio'), 'utf8');

    expect(dockerfileBot).toContain('COPY tools/modules/compose-database.ts tools/modules/compose-database.ts');
    expect(dockerfileDashboard).toContain('COPY tools/modules/compose-database.ts tools/modules/compose-database.ts');
    expect(dockerfileStudio).toContain('COPY tools/modules/compose-database.ts tools/modules/compose-database.ts');

    for (const mod of moduleDirs) {
      if (existsSync(join(root, 'modules', mod, 'database'))) {
        expect(dockerfileBot).toContain(`COPY modules/${mod}/database/ modules/${mod}/database/`);
        expect(dockerfileDashboard).toContain(`COPY modules/${mod}/database/ modules/${mod}/database/`);
        expect(dockerfileStudio).toContain(`COPY modules/${mod}/database/ modules/${mod}/database/`);
      }
    }

    // Verify packages in Bot and Dashboard Dockerfiles (Full manifest + source)
    for (const pkg of packageDirs) {
      expect(dockerfileBot).toContain(`COPY packages/${pkg}/package.json packages/${pkg}/`);
      expect(dockerfileBot).toContain(`COPY packages/${pkg}/src/ packages/${pkg}/src/`);
      expect(dockerfileBot).toContain(`COPY packages/${pkg}/tsconfig.json packages/${pkg}/`);

      expect(dockerfileDashboard).toContain(`COPY packages/${pkg}/package.json packages/${pkg}/`);
      expect(dockerfileDashboard).toContain(`COPY packages/${pkg}/src/ packages/${pkg}/src/`);
      expect(dockerfileDashboard).toContain(`COPY packages/${pkg}/tsconfig.json packages/${pkg}/`);

      expect(dockerfileDocs).toContain(`COPY packages/${pkg}/package.json packages/${pkg}/`);
    }
  });
});
