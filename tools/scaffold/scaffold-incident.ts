import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export function scaffoldIncident(
  slug: string,
  titleArabic?: string,
  root = process.cwd(),
  branch?: string,
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
  const branchName = branch ?? `fix/inc-${today.replace(/-/g, "")}-${cleanSlug}`;

  if (existsSync(templatePath)) {
    content = readFileSync(templatePath, "utf8")
      .replace(/INC-YYYYMMDD-01/g, incidentId)
      .replace(/fix\/inc-YYYYMMDD-slug/g, branchName)
      .replace(/YYYY-MM-DD/g, today)
      .replace(/\[عنوان المشكلة البرمجية بدقة وإيجاز\]/g, title);
  } else {
    content = `---
incident_id: "${incidentId}"
date: "${today}"
branch: "${branchName}"
component: "packages/shared"
severity: "SEV-2"
category: "CONCURRENCY_RACE_CONDITION"
status: "RESOLVED"
work_plan: "WP-93"
affected_test: "packages/shared/tests/shared.spec.ts"
regression_test: "packages/shared/tests/shared.spec.ts"
---

# 📝 تقرير توثيق وتحليل الخلل البرمجي (Post-Incident Defect Report)
## ${title}

## 1️⃣ 📋 بطاقة وسياق الخلل (Incident Metadata & Scope)
- **معرف الخلل:** \`${incidentId}\`
- **تاريخ الاكتشاف:** \`${today}\`
- **الفرع المنعزل:** \`${branchName}\`

## 2️⃣ 🚨 التوصيف والأعراض ومخرجات الفشل (Symptoms & Error Signatures)
## 3️⃣ 🔍 التحليل الجذري للسبب (Root Cause Analysis - RCA & 5 Whys)
## 4️⃣ 🛠️ تفاصيل الحل المعماري المنفذ (Resolution & Architecture Adjustments)
- **صيغة موافقة المستخدم المعتمدة حرفياً:** \`«موافق على تعديل الكود المصدري»\`
## 5️⃣ 🧪 التحقق الميداني واختبار الانحدار الدائم (Verification & Regression Proof)
## 6️⃣ 🛡️ التوصيات الوقائية والمقترحات الاحترافية لتفادي التكرار (Preventive Recommendations)
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
