import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCliEntrypoint } from '../governance/common.js';

export interface ScaffoldDashboardOptions {
  moduleName: string;
  featureSlug: string;
  titleArabic: string;
  subSection?: string | undefined;
  allowedRoles?: string[] | undefined;
  root?: string | undefined;
}

export function scaffoldDashboard(options: ScaffoldDashboardOptions): string {
  const root = options.root ?? process.cwd();
  const { moduleName, featureSlug, titleArabic } = options;
  const subSection = options.subSection ?? 'شؤون العاملين والتعيينات';
  const allowedRoles = options.allowedRoles ?? ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'];

  const featureId = `${moduleName}/${featureSlug}`;
  const targetDir = join(root, 'apps', 'admin-dashboard', 'src', 'app', 'admin', moduleName, featureSlug);
  const testsDir = join(root, 'apps', 'admin-dashboard', 'tests');

  if (existsSync(targetDir)) {
    throw new Error(`Target dashboard feature directory already exists: ${targetDir}`);
  }

  mkdirSync(targetDir, { recursive: true });
  mkdirSync(testsDir, { recursive: true });

  const pascalName = featureSlug
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');

  // 1. feature.contract.json
  const contract = {
    id: featureId,
    module: moduleName,
    titleArabic,
    href: `/admin/${moduleName}/${featureSlug}`,
    subSection,
    allowedRoles,
    status: 'Draft',
    createdAt: new Date().toISOString(),
  };
  writeFileSync(join(targetDir, 'feature.contract.json'), JSON.stringify(contract, null, 2) + '\n', 'utf8');

  // 2. <featureSlug>-client.tsx
  const clientContent = `'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ${pascalName}Client() {
  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">${titleArabic}</h1>
        <p className="text-sm text-slate-400">إدارة ومتابعة عمليات ${titleArabic} في منظومة السعادة.</p>
      </div>

      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-100">بيانات ${titleArabic}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-950/40 text-slate-500">
            جاهز لتكامل البيانات الميدانية والعمليات.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
`;
  writeFileSync(join(targetDir, `${featureSlug}-client.tsx`), clientContent, 'utf8');

  // 3. page.tsx
  const pageContent = `import React from 'react';
import { ${pascalName}Client } from './${featureSlug}-client';

export const metadata = {
  title: '${titleArabic} | لوحة تحكم السعادة',
};

export default function ${pascalName}Page() {
  return <${pascalName}Client />;
}
`;
  writeFileSync(join(targetDir, 'page.tsx'), pageContent, 'utf8');

  // 4. Test in apps/admin-dashboard/tests/<featureSlug>.spec.ts
  const specContent = `import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('Dashboard Feature: ${titleArabic} (${featureId})', () => {
  const dir = join(process.cwd(), 'src', 'app', 'admin', '${moduleName}', '${featureSlug}');

  it('verifies vertical slice files exist', () => {
    expect(existsSync(join(dir, 'page.tsx'))).toBe(true);
    expect(existsSync(join(dir, '${featureSlug}-client.tsx'))).toBe(true);
    expect(existsSync(join(dir, 'feature.contract.json'))).toBe(true);
  });

  it('validates feature contract roles', () => {
    const raw = readFileSync(join(dir, 'feature.contract.json'), 'utf8');
    const contract = JSON.parse(raw);
    expect(contract.id).toBe('${featureId}');
    expect(contract.allowedRoles).toContain('SUPER_ADMIN');
  });
});
`;
  writeFileSync(join(testsDir, `${featureSlug}.spec.ts`), specContent, 'utf8');

  // 5. Update apps/admin-dashboard/src/dashboard.manifest.ts if present
  const manifestPath = join(root, 'apps', 'admin-dashboard', 'src', 'dashboard.manifest.ts');
  if (existsSync(manifestPath)) {
    try {
      const manifestText = readFileSync(manifestPath, 'utf8');
      if (!manifestText.includes(`id: '${featureId}'`)) {
        const featureEntry = `      {
        id: '${featureId}',
        module: '${moduleName}',
        title: '${titleArabic}',
        href: '/admin/${moduleName}/${featureSlug}',
        allowedRoles: ${JSON.stringify(allowedRoles)},
        subSection: '${subSection}',
        status: 'Draft',
      },`;

        // Look for existing section for this module (e.g. href: '/admin/workforce')
        const sectionPattern = new RegExp(`href:\\s*['"]/admin/${moduleName}['"]`);
        const sectionMatch = sectionPattern.exec(manifestText);

        if (sectionMatch && sectionMatch.index !== undefined) {
          const featuresStart = manifestText.indexOf('features: [', sectionMatch.index);
          if (featuresStart !== -1) {
            const featuresEnd = manifestText.indexOf('],', featuresStart);
            if (featuresEnd !== -1) {
              const updated =
                manifestText.slice(0, featuresEnd) +
                featureEntry +
                '\n    ' +
                manifestText.slice(featuresEnd);
              writeFileSync(manifestPath, updated, 'utf8');
            }
          }
        } else {
          // If no section exists for this module, insert a new section before DASHBOARD_SECTIONS_MANIFEST closing bracket
          const insertionPoint = manifestText.lastIndexOf('];');
          if (insertionPoint !== -1) {
            const newSection = `  {
    title: '${moduleName}',
    href: '/admin/${moduleName}',
    iconName: 'PackageCheck',
    allowedRoles: ${JSON.stringify(allowedRoles)},
    features: [
${featureEntry}
    ],
  },\n`;
            const updated = manifestText.slice(0, insertionPoint) + newSection + manifestText.slice(insertionPoint);
            writeFileSync(manifestPath, updated, 'utf8');
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return targetDir;
}

if (isCliEntrypoint(import.meta.url)) {
  const args = process.argv.slice(2);
  let subSection = 'شؤون العاملين والتعيينات';
  let roles: string[] = ['SUPER_ADMIN', 'GENERAL_ADMIN', 'FIELD_ADMIN'];
  const posArgs: string[] = [];

  for (const arg of args) {
    if (arg.startsWith('--subsection=')) {
      subSection = arg.slice('--subsection='.length);
    } else if (arg.startsWith('--roles=')) {
      roles = arg.slice('--roles='.length).split(',');
    } else if (!arg.startsWith('--')) {
      posArgs.push(arg);
    }
  }

  const [moduleName, featureSlug, titleArabic] = posArgs;
  if (!moduleName || !featureSlug || !titleArabic) {
    console.error('❌ Usage: pnpm make:dashboard-feature <module> <featureSlug> <titleArabic> [--subsection="..."] [--roles=SUPER_ADMIN,...]');
    process.exit(1);
  }

  try {
    const created = scaffoldDashboard({ moduleName, featureSlug, titleArabic, subSection, allowedRoles: roles });
    console.log(`✅ [SCAFFOLD:DASHBOARD] Successfully created dashboard feature ${moduleName}/${featureSlug} in:`);
    console.log(`   ${created}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ [SCAFFOLD:DASHBOARD ERROR] ${msg}`);
    process.exit(1);
  }
}
