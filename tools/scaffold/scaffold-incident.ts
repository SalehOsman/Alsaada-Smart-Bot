import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export function scaffoldIncident(
  slug: string,
  titleArabic?: string,
  root = process.cwd(),
): string {
  if (!slug) {
    throw new Error("Usage: pnpm make:incident <incident-slug> [titleArabic]");
  }

  const cleanSlug = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "");
  const today = new Date().toISOString().slice(0, 10);
  const incidentsDir = join(root, "docs", "code-incidents");

  if (!existsSync(incidentsDir)) {
    mkdirSync(incidentsDir, { recursive: true });
  }

  const targetFileName = `${today}-incident-${cleanSlug}.md`;
  const targetPath = join(incidentsDir, targetFileName);

  if (existsSync(targetPath)) {
    throw new Error(`Incident file already exists: ${targetPath}`);
  }

  const templatePath = join(incidentsDir, "TEMPLATE.md");
  let content: string;

  const incidentId = `INC-${today.replace(/-/g, "")}-${cleanSlug.toUpperCase().slice(0, 8)}`;
  const title = titleArabic ?? `تحليل الخلل البرمجي: ${cleanSlug}`;

  if (existsSync(templatePath)) {
    content = readFileSync(templatePath, "utf8")
      .replace(/INC-YYYYMMDD-01/g, incidentId)
      .replace(/YYYY-MM-DD/g, today)
      .replace(/\[عنوان المشكلة البرمجية بدقة وإيجاز\]/g, title);
  } else {
    content = `---
incident_id: "${incidentId}"
date: "${today}"
component: "packages/shared"
severity: "SEV-2"
category: "CONCURRENCY_RACE_CONDITION"
status: "RESOLVED"
---

# 📝 تقرير توثيق وتحليل الخلل البرمجي (Post-Incident Defect Report)
## ${title}

### 1️⃣ بطاقة وسياق الخلل (Incident Scope)
- **معرف الخلل:** \`${incidentId}\`
- **تاريخ الاكتشاف:** \`${today}\`

### 2️⃣ مخرجات الفشل (Symptoms & Failure)
### 3️⃣ التحليل الجذري للسبب (5 Whys Root Cause Analysis)
### 4️⃣ تفاصيل الحل وترخيص الكود المصدري («موافق على تعديل الكود المصدري»)
### 5️⃣ التحقق واختبار الانحدار الدائم
`;
  }

  writeFileSync(targetPath, content, "utf8");
  return targetPath;
}

if (
  process.argv[1]
    ?.replace(/\\/g, "/")
    .endsWith("tools/scaffold/scaffold-incident.ts")
) {
  const slug = process.argv[2];
  const title = process.argv[3];
  if (!slug) {
    console.error(
      "Usage: tsx tools/scaffold/scaffold-incident.ts <incident-slug> [titleArabic]",
    );
    process.exit(1);
  }
  const created = scaffoldIncident(slug, title);
  console.log(`✅ Incident report scaffolded successfully: ${created}`);
}
