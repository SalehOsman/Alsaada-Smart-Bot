import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  verifyIncidents,
  parseYamlFrontmatter,
  checkPlaceholders,
  extractRepoLinks,
} from '../verify-incidents.js';

let tempDirCounter = 0;

function createTestRepo(): { root: string; incidentsDir: string; cleanup: () => void } {
  tempDirCounter += 1;
  const root = join(tmpdir(), `test-incidents-repo-${Date.now()}-${tempDirCounter}`);
  const incidentsDir = join(root, 'docs', 'code-incidents');
  mkdirSync(incidentsDir, { recursive: true });

  // Create dummy test file so physical path check can pass
  const testDir = join(root, 'packages', 'database', 'tests');
  mkdirSync(testDir, { recursive: true });
  writeFileSync(join(testDir, 'db-concurrency.spec.ts'), '// dummy test', 'utf8');

  const cleanup = () => {
    if (existsSync(root)) {
      rmSync(root, { recursive: true, force: true });
    }
  };

  return { root, incidentsDir, cleanup };
}

function createValidIncidentContent(overrides: {
  incidentId?: string;
  date?: string;
  branch?: string;
  component?: string;
  severity?: string;
  category?: string;
  status?: string;
  workPlan?: string;
  affectedTest?: string;
  regressionTest?: string;
  body?: string;
} = {}): string {
  const incidentId = overrides.incidentId ?? 'INC-20260923-TEST-INC';
  const date = overrides.date ?? '2026-09-23';
  const branch = overrides.branch ?? 'fix/inc-20260923-test-inc';
  const component = overrides.component ?? 'packages/database';
  const severity = overrides.severity ?? 'SEV-2';
  const category = overrides.category ?? 'CONCURRENCY_RACE_CONDITION';
  const status = overrides.status ?? 'RESOLVED';
  const workPlan = overrides.workPlan ?? 'WP-93';
  const affectedTest = overrides.affectedTest ?? 'packages/database/tests/db-concurrency.spec.ts';
  const regressionTest = overrides.regressionTest ?? 'packages/database/tests/db-concurrency.spec.ts#L120-L150';

  const defaultBody = overrides.body ?? `
# 📝 تقرير توثيق وتحليل الخلل البرمجي لما بعد الحل (Post-Incident Defect Report)
## معالجة مشكلة التزامن في قفل قاعدة البيانات

## 1️⃣ 📋 بطاقة وسياق الخلل (Incident Metadata & Scope)
| الحقل الرقابي | القيمة المعتمدة |
| :--- | :--- |
| **معرف الخلل** | \`${incidentId}\` |
| **الفرع المنعزل** | \`${branch}\` |

## 2️⃣ 🚨 التوصيف والأعراض ومخرجات الفشل (Symptoms & Error Signatures)
حدث فشل عند محاولة استدعاء الدالة بشكل متزامن.

## 3️⃣ 🔍 التحليل الجذري للسبب (Root Cause Analysis - RCA & 5 Whys)
1. **لماذا أخفق الاختبار؟** بسبب تعارض الـ transactions.
2. **لماذا تصرف الكود بهذه الطريقة؟** لغياب القفل الاستشاري.
3. **لماذا لم تتم المعالجة؟** لم يتم اختبار التزامن العالي.
4. **لماذا لم يكتشف مبكراً؟** كانت الاختبارات تسلسلية فقط.
5. **السبب الجذري:** غياب قفل التزامن.

## 4️⃣ 🛠️ تفاصيل الحل المعماري المنفذ (Resolution & Architecture Adjustments)
- **صيغة موافقة المستخدم المعتمدة حرفياً:** «موافق على تعديل الكود المصدري»
- **الملف المعدل:** [db-concurrency.spec.ts](packages/database/tests/db-concurrency.spec.ts)

## 5️⃣ 🧪 التحقق الميداني واختبار الانحدار الدائم (Verification & Regression Proof)
تم تشغيل الاختبار بنجاح واجتياز كافة الفحوصات.

## 6️⃣ 🛡️ التوصيات الوقائية والمقترحات الاحترافية لتفادي التكرار (Preventive Recommendations)
- [x] إضافة اختبار انحدار دائم.
- [x] تفعيل فحص التزامن.
`;

  return `---
incident_id: "${incidentId}"
date: "${date}"
branch: "${branch}"
component: "${component}"
severity: "${severity}"
category: "${category}"
status: "${status}"
work_plan: "${workPlan}"
affected_test: "${affectedTest}"
regression_test: "${regressionTest}"
---
${defaultBody}`;
}

describe('🛡️ Defect Dossier & Incident Verifier (WP 93)', () => {
  let repo: { root: string; incidentsDir: string; cleanup: () => void };

  beforeEach(() => {
    repo = createTestRepo();
  });

  afterEach(() => {
    repo.cleanup();
  });

  describe('parseYamlFrontmatter', () => {
    it('parses valid frontmatter correctly', () => {
      const content = `---
incident_id: "INC-20260923-TEST"
date: "2026-09-23"
branch: "fix/inc-20260923-test"
regression_test: "packages/database/tests/example.spec.ts#L120" # anchor line
---
Body text here`;

      const result = parseYamlFrontmatter(content);
      expect(result).not.toBeNull();
      expect(result?.frontmatter.incident_id).toBe('INC-20260923-TEST');
      expect(result?.frontmatter.date).toBe('2026-09-23');
      expect(result?.frontmatter.branch).toBe('fix/inc-20260923-test');
      expect(result?.frontmatter.regression_test).toBe('packages/database/tests/example.spec.ts#L120');
      expect(result?.body.trim()).toBe('Body text here');
    });

    it('returns null if no frontmatter delimiters exist', () => {
      const result = parseYamlFrontmatter('# Just Markdown');
      expect(result).toBeNull();
    });
  });

  describe('checkPlaceholders', () => {
    it('returns no violations for authentic text', () => {
      const text = 'This is a genuine defect report with [markdown link](http://example.com) and [x] checkbox and [REDACTED].';
      const violations = checkPlaceholders(text);
      expect(violations).toHaveLength(0);
    });

    it('detects literal [...] ellipsis placeholders', () => {
      const text = 'Here is some code [...] left unfinished.';
      const violations = checkPlaceholders(text);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.includes('[...]'))).toBe(true);
    });

    it('detects TODO, TBD, FIXME markers', () => {
      expect(checkPlaceholders('Needs TODO later').some((v) => v.includes('TODO'))).toBe(true);
      expect(checkPlaceholders('Value is TBD').some((v) => v.includes('TBD'))).toBe(true);
      expect(checkPlaceholders('Bug FIXME here').some((v) => v.includes('FIXME'))).toBe(true);
    });

    it('detects unreplaced template guidance brackets', () => {
      expect(checkPlaceholders('[اشرح بدقة ما حدث]').length).toBeGreaterThan(0);
      expect(checkPlaceholders('[الإجابة 1]').length).toBeGreaterThan(0);
      expect(checkPlaceholders('path/to/source.ts').length).toBeGreaterThan(0);
      expect(checkPlaceholders('functionName()').length).toBeGreaterThan(0);
      expect(checkPlaceholders('Expected: ...').length).toBeGreaterThan(0);
    });
  });

  describe('extractRepoLinks', () => {
    it('extracts markdown links and file:/// links', () => {
      const body = `
See [test file](packages/database/tests/example.spec.ts)
Also check file:///f:/Alsaada-Smart-Bot/modules/workforce/src/index.ts
And external [link](https://google.com)
`;
      const links = extractRepoLinks(body);
      expect(links).toContain('packages/database/tests/example.spec.ts');
      expect(links).toContain('modules/workforce/src/index.ts');
      expect(links).not.toContain('https://google.com');
    });
  });

  describe('verifyIncidents End-to-End', () => {
    it('passes for a fully compliant incident report', () => {
      const incidentContent = createValidIncidentContent();
      writeFileSync(join(repo.incidentsDir, '2026-09-23-incident-test.md'), incidentContent, 'utf8');

      const result = verifyIncidents(repo.root);
      expect(result.ok).toBe(true);
      expect(result.failures).toHaveLength(0);
      expect(result.checked).toBe(1);
    });

    it('ignores TEMPLATE.md file', () => {
      writeFileSync(
        join(repo.incidentsDir, 'TEMPLATE.md'),
        '--- \n incident_id: "INC-YYYYMMDD-01"\n--- \n [اشرح بدقة...]',
        'utf8',
      );

      const result = verifyIncidents(repo.root);
      expect(result.ok).toBe(true);
      expect(result.checked).toBe(0);
    });

    it('fails when YAML frontmatter is missing or malformed', () => {
      writeFileSync(
        join(repo.incidentsDir, '2026-09-23-incident-bad.md'),
        '# Missing frontmatter\n\nThis is a long text to test that missing frontmatter is caught properly without frontmatter headers.\n'.repeat(
          3,
        ),
        'utf8',
      );

      const result = verifyIncidents(repo.root);
      expect(result.ok).toBe(false);
      expect(result.failures.some((f) => f.includes('YAML frontmatter'))).toBe(true);
    });

    it('fails when branch is missing or not following fix/inc- convention', () => {
      const content = createValidIncidentContent({ branch: 'random-branch' });
      writeFileSync(join(repo.incidentsDir, '2026-09-23-incident-bad-branch.md'), content, 'utf8');

      const result = verifyIncidents(repo.root);
      expect(result.ok).toBe(false);
      expect(result.failures.some((f) => f.includes('branch'))).toBe(true);
    });

    it('fails when affected_test file does not exist on disk', () => {
      const content = createValidIncidentContent({
        affectedTest: 'packages/database/tests/non-existent.spec.ts',
      });
      writeFileSync(join(repo.incidentsDir, '2026-09-23-incident-missing-test.md'), content, 'utf8');

      const result = verifyIncidents(repo.root);
      expect(result.ok).toBe(false);
      expect(result.failures.some((f) => f.includes('affected_test file not found on disk'))).toBe(true);
    });

    it('fails when regression_test file does not exist on disk', () => {
      const content = createValidIncidentContent({
        regressionTest: 'packages/database/tests/ghost.spec.ts#L50',
      });
      writeFileSync(join(repo.incidentsDir, '2026-09-23-incident-missing-regression.md'), content, 'utf8');

      const result = verifyIncidents(repo.root);
      expect(result.ok).toBe(false);
      expect(result.failures.some((f) => f.includes('regression_test file not found on disk'))).toBe(true);
    });

    it('fails when one of the 6 mandatory sections is omitted', () => {
      // Omit Section 3 (Root Cause)
      const bodyWithoutSection3 = `
## 1️⃣ 📋 بطاقة وسياق الخلل (Incident Metadata & Scope)
Scope
## 2️⃣ 🚨 التوصيف والأعراض ومخرجات الفشل (Symptoms & Error Signatures)
Symptoms
## 4️⃣ 🛠️ تفاصيل الحل المعماري المنفذ (Resolution & Architecture Adjustments)
«موافق على تعديل الكود المصدري»
## 5️⃣ 🧪 التحقق الميداني واختبار الانحدار الدائم (Verification & Regression Proof)
Verified
## 6️⃣ 🛡️ التوصيات الوقائية والمقترحات الاحترافية لتفادي التكرار (Preventive Recommendations)
Recommendations
`;
      const content = createValidIncidentContent({ body: bodyWithoutSection3 });
      writeFileSync(join(repo.incidentsDir, '2026-09-23-incident-missing-sec3.md'), content, 'utf8');

      const result = verifyIncidents(repo.root);
      expect(result.ok).toBe(false);
      expect(result.failures.some((f) => f.includes('Section 3'))).toBe(true);
    });

    it('fails when sovereign authorization formula is missing in Section 4', () => {
      const bodyWithoutFormula = `
## 1️⃣ 📋 بطاقة وسياق الخلل (Incident Metadata & Scope)
Scope
## 2️⃣ 🚨 التوصيف والأعراض ومخرجات الفشل (Symptoms & Error Signatures)
Symptoms
## 3️⃣ 🔍 التحليل الجذري للسبب (Root Cause Analysis - RCA & 5 Whys)
Whys
## 4️⃣ 🛠️ تفاصيل الحل المعماري المنفذ (Resolution & Architecture Adjustments)
I changed the code without asking user approval.
## 5️⃣ 🧪 التحقق الميداني واختبار الانحدار الدائم (Verification & Regression Proof)
Verified
## 6️⃣ 🛡️ التوصيات الوقائية والمقترحات الاحترافية لتفادي التكرار (Preventive Recommendations)
Recommendations
`;
      const content = createValidIncidentContent({ body: bodyWithoutFormula });
      writeFileSync(join(repo.incidentsDir, '2026-09-23-incident-no-auth.md'), content, 'utf8');

      const result = verifyIncidents(repo.root);
      expect(result.ok).toBe(false);
      expect(result.failures.some((f) => f.includes('authorization formula'))).toBe(true);
    });

    it('fails when an unfilled placeholder is present in the document', () => {
      const bodyWithPlaceholder = `
## 1️⃣ 📋 بطاقة وسياق الخلل (Incident Metadata & Scope)
Scope
## 2️⃣ 🚨 التوصيف والأعراض ومخرجات الفشل (Symptoms & Error Signatures)
[اشرح بدقة ما حدث عند تشغيل الاختبار]
## 3️⃣ 🔍 التحليل الجذري للسبب (Root Cause Analysis - RCA & 5 Whys)
Whys
## 4️⃣ 🛠️ تفاصيل الحل المعماري المنفذ (Resolution & Architecture Adjustments)
«موافق على تعديل الكود المصدري»
## 5️⃣ 🧪 التحقق الميداني واختبار الانحدار الدائم (Verification & Regression Proof)
Verified
## 6️⃣ 🛡️ التوصيات الوقائية والمقترحات الاحترافية لتفادي التكرار (Preventive Recommendations)
Recommendations
`;
      const content = createValidIncidentContent({ body: bodyWithPlaceholder });
      writeFileSync(join(repo.incidentsDir, '2026-09-23-incident-placeholder.md'), content, 'utf8');

      const result = verifyIncidents(repo.root);
      expect(result.ok).toBe(false);
      expect(result.failures.some((f) => f.includes('unfilled placeholder'))).toBe(true);
    });
  });
});
