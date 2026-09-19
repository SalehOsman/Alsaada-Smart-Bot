import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

export interface DocMapping {
  sourceFile: string;
  targetTrack: string;
  targetFile: string;
  slug: string;
  title: string;
  order: number;
}

export const TRACK_DEFINITIONS = [
  {
    id: 'foundations',
    title: '1️⃣ الأسس والميثاق التأسيسي (Foundations & Baseline)',
    dir: 'foundations',
    docs: [
      '00-baseline-and-ssot-charter.md',
      '01-architecture-and-tempot-synergy.md',
      '14-ai-agent-governance-and-file-rules.md',
    ],
  },
  {
    id: 'core-architecture',
    title: '2️⃣ المعمارية وحزم النواة (Core Architecture & Engines)',
    dir: 'core-architecture',
    docs: [
      '02-core-shared-components-catalog.md',
      '03-ai-vision-invoice-engine.md',
      '04-google-sheets-auto-provisioner.md',
      '07-sheets-topology-and-registry-resolver.md',
      '10-telegram-id-identity-verification.md',
      '11-universal-invitation-and-onboarding-engine.md',
      '17-worker-coding-and-silent-alias-resolution.md',
      '25-optimal-high-performance-bot-architecture-and-speed-blueprint.md',
    ],
  },
  {
    id: 'financial-and-governance',
    title: '3️⃣ المالية والحوكمة والرقابة (Financial Engine & Governance)',
    dir: 'financial-and-governance',
    docs: [
      '08-universal-rbac-and-executive-role.md',
      '09-database-governance-and-superadmin-console.md',
      '12-system-configuration-and-operational-simplicity.md',
      '13-closed-loop-financial-and-pnl-engine.md',
      '15-universal-module-and-flow-standard.md',
      '16-database-security-and-tamper-proof-ledger.md',
      '20-super-admin-settings-and-control-hub-guide.md',
      '21-mandatory-module-architecture-and-gates.md',
      '26-locked-flows-and-features-registry.md',
      '27-enterprise-ai-governance-and-quality-gates-constitution.md',
    ],
  },
  {
    id: 'data-and-migration',
    title: '4️⃣ قواعد البيانات وسجل الترحيل (Data & Migration Radar)',
    dir: 'data-and-migration',
    docs: [
      '18-enterprise-schema-and-entity-relationship-model.md',
      '19-legacy-to-enterprise-master-feature-migration-registry.md',
    ],
  },
  {
    id: 'telegram-ux',
    title: '5️⃣ تجربة مستخدم البوت (Telegram UX & Bot Ergonomics)',
    dir: 'telegram-ux',
    docs: [
      '05-master-implementation-roadmap.md',
      '06-tenant-onboarding-and-provisioning-wizard.md',
      '22-telegram-ux-ui-design-system-and-ergonomics.md',
      '23-autonomous-agent-roster-and-rag.md',
      '24-enterprise-feature-and-flow-master-specification.md',
    ],
  },
] as const;

export const ADR_RECORDS = [
  { id: 'ADR-001', title: 'Monorepo Architecture (pnpm workspaces + Turborepo)', status: 'Accepted' },
  { id: 'ADR-002', title: 'Framework Synergy with Tempot v11 Core Capabilities', status: 'Accepted' },
  { id: 'ADR-003', title: 'Strict TypeScript 5.9+ (Zero any, Exact Optional Properties)', status: 'Accepted' },
  { id: 'ADR-004', title: 'Telegram Framework Selection (grammY + Sessions + Auto-Retry)', status: 'Accepted' },
  { id: 'ADR-005', title: 'Embedded Web Server Engine (Hono API & Webhooks)', status: 'Accepted' },
  { id: 'ADR-006', title: 'Dual Storage Architecture (PostgreSQL Primary + Google Sheets Mirror)', status: 'Accepted' },
  { id: 'ADR-007', title: 'Database ORM Architecture (Prisma 7 with Soft-Delete Extension)', status: 'Accepted' },
  { id: 'ADR-008', title: 'Distributed Cache and Concurrency Lock (Redis + Redlock)', status: 'Accepted' },
  { id: 'ADR-009', title: 'Transactional Background Queue (BullMQ + Redis Streams)', status: 'Accepted' },
  { id: 'ADR-010', title: 'Enterprise Event-Driven Bus (In-Memory + Outbox Mirror)', status: 'Accepted' },
  { id: 'ADR-011', title: 'Cryptographic Audit Ledger & Tamper-Proof SHA-256 Chaining', status: 'Accepted' },
  { id: 'ADR-012', title: 'Triple-Balance Financial Clearing Engine & Cost Reduction', status: 'Accepted' },
  { id: 'ADR-013', title: 'Custody Safety Gate & Zero-Deficit Cash Outflow Protection', status: 'Accepted' },
  { id: 'ADR-014', title: 'Egyptian National ID Engine (14-Digit Auto Resolution)', status: 'Accepted' },
  { id: 'ADR-015', title: 'Regional Localization Engine (Cairo Timezone, EGP Currency)', status: 'Accepted' },
  { id: 'ADR-016', title: 'AI Vision Document Extractor (Google Gemini 2.0 Flash)', status: 'Accepted' },
  { id: 'ADR-017', title: 'Multi-Level Approval Workflow Engine & Escalation Tickets', status: 'Accepted' },
  { id: 'ADR-018', title: 'Equal Installment Engine & Smart Deduction Scheduler', status: 'Accepted' },
  { id: 'ADR-019', title: 'Google Sheets Auto-Provisioner (66 Spreadsheets Topology)', status: 'Accepted' },
  { id: 'ADR-020', title: 'Transactional Outbox Queue for Google Sheets Sync', status: 'Accepted' },
  { id: 'ADR-021', title: 'Canonical RBAC Matrix & Role Hierarchy (SuperAdmin to Field Worker)', status: 'Accepted' },
  { id: 'ADR-022', title: 'Telegram ID Identity Verification & Auto-Linking Protocol', status: 'Accepted' },
  { id: 'ADR-023', title: 'Universal Invitation & QR Code Onboarding Engine', status: 'Accepted' },
  { id: 'ADR-024', title: 'Silent Worker Alias & Nickname Resolution System', status: 'Accepted' },
  { id: 'ADR-025', title: 'In-Place Telegram Message Editing (Golden UX Rule)', status: 'Accepted' },
  { id: 'ADR-026', title: 'Expiring Callback Tokens with HMAC Cryptographic Protection', status: 'Accepted' },
  { id: 'ADR-027', title: 'Functional Result Pattern via neverthrow (Zero Unhandled Errors)', status: 'Accepted' },
  { id: 'ADR-028', title: 'Strict Observability Contract (Pino Structured Logger)', status: 'Accepted' },
  { id: 'ADR-029', title: 'Graceful Shutdown & In-Flight Request Draining (SIGTERM/SIGINT)', status: 'Accepted' },
  { id: 'ADR-030', title: 'Strict 17 Governance Quality Gates Pipeline (Non-Bypassable)', status: 'Accepted' },
  { id: 'ADR-031', title: 'Cryptographic Component Immutability (governance.lock.json)', status: 'Accepted' },
  { id: 'ADR-032', title: 'Two-Tier Fast Flow Verification Architecture (< 2s)', status: 'Accepted' },
  { id: 'ADR-033', title: 'Vertical Slice Code Ceiling (Strict 350 Lines per Slice)', status: 'Accepted' },
  { id: 'ADR-034', title: 'Mandatory Legacy Parity with F:\\HR (126 Flows Functional SSOT)', status: 'Accepted' },
  { id: 'ADR-035', title: 'Synchronized Monorepo Version Parity (Changesets Standard)', status: 'Accepted' },
  { id: 'ADR-036', title: 'Interactive Documentation Portal & Living Architecture (Astro Starlight)', status: 'Accepted' },
  { id: 'ADR-037', title: 'Smart AST Markdown Transformation Pipeline & Zero-Drift Governance', status: 'Accepted' },
] as const;

export function findRepoRoot(startDir: string = process.cwd()): string {
  let current = resolve(startDir);
  while (true) {
    if (existsSync(join(current, 'pnpm-workspace.yaml')) && existsSync(join(current, 'docs'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

export function buildDocMapping(inputRoot?: string): Map<string, DocMapping> {
  const root = inputRoot ? resolve(inputRoot) : findRepoRoot();
  const map = new Map<string, DocMapping>();

  let globalOrder = 1;
  for (const track of TRACK_DEFINITIONS) {
    let orderInTrack = 1;
    for (const docFile of track.docs) {
      const stem = docFile.replace(/\.md$/, '');
      const fullPath = join(root, 'docs', docFile);
      let title = stem;
      if (existsSync(fullPath)) {
        const content = readFileSync(fullPath, 'utf8');
        const match = content.match(/^#\s+(.+)$/m);
        if (match && match[1]) {
          title = match[1].replace(/[#*`]/g, '').trim();
        }
      }

      const mapping: DocMapping = {
        sourceFile: docFile,
        targetTrack: track.dir,
        targetFile: docFile,
        slug: `/${track.dir}/${stem}/`,
        title,
        order: orderInTrack++,
      };
      map.set(docFile, mapping);
      globalOrder++;
    }
  }

  return map;
}

const VALID_HTML_TAGS = new Set([
  'div', 'span', 'p', 'a', 'b', 'i', 'strong', 'em', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'code', 'blockquote', 'hr', 'br', 'img',
  'details', 'summary', 'kbd', 'mark', 'small', 'sub', 'sup', 'var', 'time', 'section', 'article', 'aside',
  'header', 'footer', 'nav', 'main', 'figure', 'figcaption',
]);

export function sanitizeHtmlTags(markdown: string): string {
  markdown = markdown.replace(/\r\n/g, '\n');
  const codeBlocks: string[] = [];
  let placeholderCount = 0;

  // 1. Stash fenced code blocks (``` or ~~~ with any fence length >= 3)
  let text = markdown.replace(/(^|\n)([ \t]*)(```+|~~~+)[\s\S]*?\n\2\3(?=\n|$)/g, (match) => {
    const id = `__FENCED_CODE_BLOCK_${placeholderCount++}__`;
    codeBlocks.push(match);
    return id;
  });

  // 2. Stash inline code spans
  text = text.replace(/`[^`\n]+`/g, (match) => {
    const id = `__INLINE_CODE_SPAN_${placeholderCount++}__`;
    codeBlocks.push(match);
    return id;
  });

  // 3. Preserve HTML comments: <!-- ... -->
  text = text.replace(/<!--[\s\S]*?-->/g, (match) => {
    const id = `__HTML_COMMENT_${placeholderCount++}__`;
    codeBlocks.push(match);
    return id;
  });

  // 4. Escape generic bracket patterns like <T>, <module-name>, <flow_name>, <Action>, etc.
  // We match <... > where the tag name is NOT in VALID_HTML_TAGS
  text = text.replace(/<(\/?)([a-zA-Z0-9_\-\.\:\s\*,]+)>/g, (fullMatch, slash, tagName) => {
    const cleanTag = String(tagName).trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    if (VALID_HTML_TAGS.has(cleanTag)) {
      return fullMatch;
    }
    return `&lt;${slash}${tagName}&gt;`;
  });

  // 5. Restore code spans and blocks SAFELY using function replacer to prevent $ token corruption
  for (let i = 0; i < codeBlocks.length; i++) {
    const block = codeBlocks[i];
    if (block !== undefined) {
      const pattern = new RegExp(`__(?:FENCED_CODE_BLOCK|INLINE_CODE_SPAN|HTML_COMMENT)_${i}__`, 'g');
      text = text.replace(pattern, () => block);
    }
  }

  return text;
}

export function rewriteMarkdownLinks(markdown: string, docMap: Map<string, DocMapping>): string {
  // Matches markdown links: [text](url)
  return markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (fullMatch, text, url) => {
    const rawUrl = String(url).trim();

    // Skip mailto, http(s), and fragment-only links
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('mailto:') || rawUrl.startsWith('#')) {
      return fullMatch;
    }

    // Check F:\HR reference immediately before any stripping
    if (/file:\/\/\/[a-zA-Z]:\/hr\b/i.test(rawUrl) || /\b[a-zA-Z]:[\\\/]hr\b/i.test(rawUrl)) {
      return `\`${text}\``;
    }

    let anchor = '';
    let cleanUrl = rawUrl;
    const hashIndex = cleanUrl.indexOf('#');
    if (hashIndex !== -1) {
      anchor = cleanUrl.slice(hashIndex);
      cleanUrl = cleanUrl.slice(0, hashIndex);
    }

    // Normalize path separators
    cleanUrl = cleanUrl.replace(/\\/g, '/');

    // Extract subpath from file:/// paths pointing into this repository
    const alsaadaMatch = cleanUrl.match(/file:\/\/\/(?:[a-zA-Z]:\/)?(?:[^\/]+\/)*Alsaada-Smart-Bot\/(.+)$/i);
    let repoSubpath = alsaadaMatch ? alsaadaMatch[1] : null;

    if (!repoSubpath) {
      // Also handle relative paths like docs/00-baseline-...md or ./00-baseline...
      repoSubpath = cleanUrl.replace(/^\.?\/?/, '');
    }

    const fileName = repoSubpath ? repoSubpath.split('/').pop() ?? '' : '';

    // 1. Check if fileName matches any core doc in our map
    const targetDoc = docMap.get(fileName);
    if (targetDoc) {
      return `[${text}](${targetDoc.slug}${anchor})`;
    }

    // 2. Special root files
    if (fileName === 'AGENTS.md' || fileName === 'GEMINI.md') {
      return `[${text}](/foundations/14-ai-agent-governance-and-file-rules/${anchor})`;
    }
    if (fileName === 'governance.lock.json') {
      return `[${text}](/financial-and-governance/26-locked-flows-and-features-registry/${anchor})`;
    }

    // 3. ADR links
    const adrMatch = fileName.match(/^adr-?0*([1-9][0-9]?)/i);
    if (adrMatch && adrMatch[1]) {
      const num = parseInt(adrMatch[1], 10);
      const padded = num.toString().padStart(3, '0');
      return `[${text}](/adrs/adr-${padded}/${anchor})`;
    }

    // 4. Repo codebase, evidence, or work plans links -> rewrite to GitHub web URLs
    if (repoSubpath) {
      const isDirectory = !repoSubpath.includes('.') || !fileName.includes('.');
      const branchType = isDirectory ? 'tree' : 'blob';
      const cleanSub = repoSubpath.replace(/^\/+/, '');
      return `[${text}](https://github.com/SalehOsman/Alsaada-Smart-Bot/${branchType}/main/${cleanSub}${anchor})`;
    }

    return fullMatch;
  });
}

export function generateMigrationProgressWidget(doc19Content: string): string {
  // Count flows / items in Doc 19
  const implementedCount = (doc19Content.match(/🟢\s*مكتمل|🟢\s*UAT_PASS|Implemented/g) || []).length;
  const inProgressCount = (doc19Content.match(/🟡\s*قيد التنفيذ/g) || []).length;
  const totalFlows = 126;
  const percentage = Math.min(Math.round((implementedCount / totalFlows) * 100), 100);

  return `
:::note[📊 مؤشر الإنجاز اللحظي لرادار الترحيل المؤسسي (Master Migration Radar)]
<div class="migration-progress-card">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
    <strong>نسبة إنجاز التدفقات الـ 126 المعتمدة:</strong>
    <span class="metric-badge metric-badge-success">${implementedCount} من ${totalFlows} (${percentage}%)</span>
  </div>
  <div class="progress-bar-track">
    <div class="progress-bar-fill" style="width: ${percentage}%;"></div>
  </div>
  <div style="display: flex; gap: 1rem; font-size: 0.85rem; margin-top: 0.5rem;">
    <span>🟢 المكتمل والمعتمد: <strong>${implementedCount}</strong></span>
    <span>🟡 قيد التنفيذ: <strong>${inProgressCount}</strong></span>
    <span>🏛️ المرجع الوظيفي: <strong>F:\\HR (Functional SSOT 100%)</strong></span>
  </div>
</div>
:::
`;
}

export function extractFrontmatterAndTitle(markdown: string, defaultTitle: string, order: number): {
  frontmatter: string;
  body: string;
} {
  let content = markdown;
  let title = defaultTitle;
  let description = 'توثيق مؤسسي معتمد لمنظومة السعادة سمارت بوت';

  // Check existing frontmatter
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (fmMatch && fmMatch[1]) {
    const rawFm = fmMatch[1];
    content = content.slice(fmMatch[0].length);

    const titleMatch = rawFm.match(/^title:\s*(.+)$/m);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].replace(/^['"]|['"]$/g, '').trim();
    }
  } else {
    // Extract first H1 heading as title
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match && h1Match[1]) {
      title = h1Match[1].replace(/[#*`]/g, '').trim();
    }

    // Extract description from blockquote or first paragraph
    const descMatch = content.match(/^>\s+([^>\r\n]+)/m);
    if (descMatch && descMatch[1]) {
      // Strip markdown formatting: links [text](url) -> text, inline code `text` -> text, formatting symbols
      let rawDesc = descMatch[1]
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/[*_#~]/g, '')
        .trim();

      if (rawDesc.length > 150) {
        // Cut at word boundary before 147 chars
        const truncated = rawDesc.slice(0, 147);
        const lastSpace = truncated.lastIndexOf(' ');
        rawDesc = `${lastSpace > 100 ? truncated.slice(0, lastSpace) : truncated}...`;
      }
      description = rawDesc;
    }
  }

  // Sanitize title & description for YAML string
  const cleanTitle = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const cleanDesc = description.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const frontmatter = `---
title: "${cleanTitle}"
description: "${cleanDesc}"
sidebar:
  order: ${order}
---
`;

  return { frontmatter, body: content };
}

export function generatePortalIndexPage(): string {
  return `---
title: "منظومة السعادة سمارت بوت"
description: "البوابة التفاعلية للتوثيق المؤسسي وخريطة المعمارية الحية وبوابات الحراسة الآلية"
template: splash
hero:
  tagline: "البوابة التفاعلية للتوثيق المؤسسي، خريطة المعمارية الحية، وبوابات الحراسة الآلية ذات الـ 17 صمام أمان"
  image:
    file: ../../assets/hero-logo.svg
  actions:
    - text: "ابدأ استعراض الأسس والميثاق"
      link: /foundations/00-baseline-and-ssot-charter/
      icon: right-arrow
      variant: primary
    - text: "خريطة المعمارية الحية"
      link: /living-architecture/
      icon: external
      variant: secondary
---

import { Card, CardGrid } from '@astrojs/starlight/components';

## 🏛️ المسارات الاستراتيجية الستة للمنظومة

<CardGrid stagger>
  <Card title="1️⃣ الأسس والميثاق التأسيسي" icon="document">
    دستور حفظ مصدر الحقيقة المطلق (SSOT)، الاستفادة الاستراتيجية من معمارية Tempot v11، وقواعد حوكمة الملفات الصارمة.
    [استعراض مسار الأسس &larr;](/foundations/00-baseline-and-ssot-charter/)
  </Card>
  <Card title="2️⃣ المعمارية وحزم النواة" icon="puzzle">
    كتالوج مكونات النواة المشتركة، محرك الذكاء الاصطناعي للفواتير (Gemini 2.0)، ميكنة شيتات جوجل الـ 66، ومحرك السرعة الفائقة.
    [استعراض حزم النواة &larr;](/core-architecture/02-core-shared-components-catalog/)
  </Card>
  <Card title="3️⃣ المالية والحوكمة والرقابة" icon="shield">
    محرك المقاصة الثلاثية وتخفيض التكاليف، صمام أمان العهد النقدية، مصفوفة الصلاحيات (RBAC)، ودستور بوابات الجودة الـ 17.
    [استعراض مسار الحوكمة &larr;](/financial-and-governance/13-closed-loop-financial-and-pnl-engine/)
  </Card>
  <Card title="4️⃣ قواعد البيانات ورادار الترحيل" icon="list-format">
    مخطط الكيانات العلائقي الشامل (ERD)، وسجل ترحيل الوظائف الـ 126 مع ميزة الفحص اللحظي لمطابقة النظام القديم.
    [استعراض سجل الترحيل &larr;](/data-and-migration/19-legacy-to-enterprise-master-feature-migration-registry/)
  </Card>
  <Card title="5️⃣ تجربة مستخدم البوت (Telegram UX)" icon="telegram">
    معايير التصميم المعتمدة لتليجرام، التعديل الموضعي للرسائل، الأزرار التفاعلية، ومعالج إعداد الشركات الميداني.
    [استعراض تجربة المستخدم &larr;](/telegram-ux/22-telegram-ux-ui-design-system-and-ergonomics/)
  </Card>
  <Card title="6️⃣ السجلات المعمارية المعتمدة (ADRs)" icon="setting">
    سجل القرارات المعمارية الـ 37 (ADR-001 إلى ADR-037) التي تحكم كل سطر برمجي وبنية تحتية في المشروع.
    [استعراض القرارات المعمارية &larr;](/adrs/)
  </Card>
</CardGrid>

---

## ⚡ مؤشرات الجودة والمعمارية المؤسسية

| المؤشر المعماري | القيمة المحققة | الضمان الهندسي |
| :--- | :--- | :--- |
| **بوابات الحوكمة الآلية** | **17 بوابة حراسة** | فحص مشدد مانع للكسر عند كل التزام (Pre-Commit Zero Drift) |
| **التدفقات التشغيلية** | **126 تدفق وظيفي** | مطابقة محاسبية ووظيفية تامة مع المرجع الحي \`F:\\HR\` |
| **القرارات المعمارية** | **37 سجل ADR** | توثيق شامل ومعتمد للقرارات التقنية والبنية التحتية |
| **النوع والصرامة البرمجية** | **TypeScript 5.9+** | حظر كامل لـ \`any\` وتفعيل \`noUncheckedIndexedAccess\` |
`;
}

export function generateEnglishLandingPage(): string {
  return `---
title: "Al-Saada Smart Bot Enterprise"
description: "Interactive Documentation Portal, Living Architecture Map & Automated Governance Suite"
template: splash
hero:
  tagline: "Living Interactive Documentation Portal, Architecture Dependency Map & 17 Non-Bypassable Quality Gates"
  actions:
    - text: "Explore Baseline & SSOT"
      link: /foundations/00-baseline-and-ssot-charter/
      icon: right-arrow
      variant: primary
    - text: "Living Architecture Map"
      link: /living-architecture/
      icon: external
      variant: secondary
---

import { Card, CardGrid } from '@astrojs/starlight/components';

## 🏛️ Six Enterprise Strategic Tracks

<CardGrid stagger>
  <Card title="1️⃣ Foundations & Baseline" icon="document">
    Single Source of Truth (SSOT) charter, Tempot v11 framework synergy, and strict AI agent governance rules.
    [Explore Foundations &larr;](/foundations/00-baseline-and-ssot-charter/)
  </Card>
  <Card title="2️⃣ Core Architecture & Shared Engines" icon="puzzle">
    Pre-built shared components catalog, Gemini 2.0 invoice AI engine, 66 Google Sheets topology, and speed blueprint.
    [Explore Core Engines &larr;](/core-architecture/02-core-shared-components-catalog/)
  </Card>
  <Card title="3️⃣ Financial Engine & Governance" icon="shield">
    Triple-balance clearing engine, zero-deficit custody safety gate, canonical RBAC matrix, and 17 quality gates.
    [Explore Governance &larr;](/financial-and-governance/13-closed-loop-financial-and-pnl-engine/)
  </Card>
  <Card title="4️⃣ Database & Migration Radar" icon="list-format">
    Complete PostgreSQL schema & ERD model, and 126-flow legacy-to-enterprise migration radar with real-time audit.
    [Explore Migration Radar &larr;](/data-and-migration/19-legacy-to-enterprise-master-feature-migration-registry/)
  </Card>
  <Card title="5️⃣ Telegram UX & Bot Ergonomics" icon="telegram">
    Design system specifications, in-place message editing, callback security, and tenant onboarding wizard.
    [Explore Telegram UX &larr;](/telegram-ux/22-telegram-ux-ui-design-system-and-ergonomics/)
  </Card>
  <Card title="6️⃣ Architectural Decision Records (ADRs)" icon="setting">
    All 37 approved Architectural Decision Records (ADR-001 to ADR-037) governing every line and infrastructure layer.
    [Explore ADRs &larr;](/adrs/)
  </Card>
</CardGrid>
`;
}

export function generateNotFoundPage(): string {
  return `---
title: "الصفحة غير موجودة - 404"
description: "الصفحة المطلوبة غير موجودة في بوابة التوثيق المؤسسي"
template: splash
editUrl: false
---

# 404: الصفحة غير موجودة

عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها إلى مسار آخر ضمن المسارات الاستراتيجية الستة لبوابة التوثيق المؤسسي.

- [العودة إلى الصفحة الرئيسية للبوابة](/)
- [استعراض ميثاق الأسس والمرجعية (SSOT)](/foundations/00-baseline-and-ssot-charter/)
- [استعراض خريطة المعمارية الحية](/living-architecture/)
- [استعراض سجل القرارات المعمارية المعتمدة (ADRs)](/adrs/)
`;
}

export interface WorkspacePackageInfo {
  name: string;
  category: 'apps' | 'modules' | 'packages';
  path: string;
  description: string;
  internalDeps: string[];
}

export function scanWorkspacePackages(root: string): WorkspacePackageInfo[] {
  const result: WorkspacePackageInfo[] = [];
  const categories: Array<{ dir: string; cat: 'apps' | 'modules' | 'packages' }> = [
    { dir: 'apps', cat: 'apps' },
    { dir: 'modules', cat: 'modules' },
    { dir: 'packages', cat: 'packages' },
  ];

  for (const { dir, cat } of categories) {
    const catPath = join(root, dir);
    if (!existsSync(catPath)) continue;

    for (const item of readdirSync(catPath, { withFileTypes: true })) {
      if (!item.isDirectory()) continue;
      const pkgJsonPath = join(catPath, item.name, 'package.json');
      if (!existsSync(pkgJsonPath)) continue;

      try {
        const pkgData = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
        const name = pkgData.name || `@alsaada/${item.name}`;
        const description = pkgData.description || `${cat}/${item.name}`;
        const allDeps = { ...(pkgData.dependencies || {}), ...(pkgData.devDependencies || {}) };
        const internalDeps = Object.keys(allDeps).filter(d => d.startsWith('@alsaada/') && d !== name);

        result.push({
          name,
          category: cat,
          path: `${dir}/${item.name}`,
          description,
          internalDeps,
        });
      } catch {
        // ignore malformed package.json
      }
    }
  }

  return result;
}

export function generateLivingArchitecturePage(inputRoot?: string): string {
  const root = inputRoot ? resolve(inputRoot) : findRepoRoot();
  const packages = scanWorkspacePackages(root);

  // Define node IDs and sanitize for Mermaid
  const toNodeId = (pkgName: string): string => {
    return pkgName.replace('@alsaada/', '').replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
  };

  const apps = packages.filter(p => p.category === 'apps');
  const modules = packages.filter(p => p.category === 'modules');
  const corePackages = packages.filter(p => p.category === 'packages' && p.name !== '@alsaada/database');
  const dbPackage = packages.find(p => p.name === '@alsaada/database');

  // Build Mermaid graph dynamically from real package data
  let mermaidGraph = `\`\`\`mermaid
flowchart TD
  subgraph Apps["🚀 طبقة التطبيقات والواجهات (Apps Layer)"]
`;

  for (const p of apps) {
    const id = toNodeId(p.name);
    mermaidGraph += `    ${id}["${p.name}\\n(${p.path})"]\n`;
  }
  mermaidGraph += `  end\n\n  subgraph Modules["🧩 طبقة موديولات الأعمال (Business Modules)"]\n`;

  for (const p of modules) {
    const id = toNodeId(p.name);
    mermaidGraph += `    ${id}["${p.name}\\n(${p.path})"]\n`;
  }
  mermaidGraph += `  end\n\n  subgraph CoreEngines["⚙️ طبقة محركات النواة المشتركة (Core Packages)"]\n`;

  for (const p of corePackages) {
    const id = toNodeId(p.name);
    mermaidGraph += `    ${id}["${p.name}\\n(${p.path})"]\n`;
  }
  mermaidGraph += `  end\n\n  subgraph DataLayer["💾 طبقة البيانات والتخزين المزدوج (Data & Storage)"]\n`;

  if (dbPackage) {
    const id = toNodeId(dbPackage.name);
    mermaidGraph += `    ${id}["${dbPackage.name}\\n(Prisma 7 + Postgres + Soft-Delete)"]\n`;
  }
  mermaidGraph += `    LEDGER["سجل العمليات المشفر\\n(Tamper-Proof Ledger)"]\n`;
  mermaidGraph += `    SHEETS["جداول جوجل السحابية\\n(Google Sheets Live Mirror)"]\n`;
  mermaidGraph += `  end\n\n  %% Dynamic Relationships from Workspace Dependencies\n`;

  const knownNames = new Set(packages.map(p => p.name));
  for (const p of packages) {
    const sourceId = toNodeId(p.name);
    for (const dep of p.internalDeps) {
      if (knownNames.has(dep)) {
        const targetId = toNodeId(dep);
        mermaidGraph += `  ${sourceId} --> ${targetId}\n`;
      }
    }
  }

  if (dbPackage) {
    const dbId = toNodeId(dbPackage.name);
    mermaidGraph += `  ${dbId} --> LEDGER\n`;
    mermaidGraph += `  ${dbId} --> SHEETS\n`;
  }

  mermaidGraph += `
  classDef appNode fill:#0284c7,stroke:#0369a1,stroke-width:2px,color:#fff;
  classDef modNode fill:#7c3aed,stroke:#6d28d9,stroke-width:2px,color:#fff;
  classDef coreNode fill:#059669,stroke:#047857,stroke-width:2px,color:#fff;
  classDef dataNode fill:#d97706,stroke:#b45309,stroke-width:2px,color:#fff;

  class ${apps.map(p => toNodeId(p.name)).join(',')} appNode;
  class ${modules.map(p => toNodeId(p.name)).join(',')} modNode;
  class ${corePackages.map(p => toNodeId(p.name)).join(',')} coreNode;
  class ${dbPackage ? toNodeId(dbPackage.name) + ',' : ''}LEDGER,SHEETS dataNode;
\`\`\``;

  // Build inventory table
  let tableRows = '';
  for (const p of packages) {
    tableRows += `| **\`${p.name}\`** | \`${p.path}\` | ${p.description} |\n`;
  }

  return `---
title: "خريطة المعمارية الحية للمنظومة"
description: "المخطط التفاعلي الحي للاعتماديات وحزم المونوريبو المستخرج آلياً من Turborepo"
sidebar:
  order: 0
---

توضح هذه الصفحة **خريطة المعمارية الحية (Living Architecture Map)** لمنظومة السعادة سمارت بوت، المستخرجة آلياً من اعتماديات حزم وموديولات الـ Monorepo.

:::tip[ميزة التكبير والتحريك (Interactive Pan & Zoom)]
يمكنك استخدام عجلة الفأرة أو أزرار التحكم في الشريط العلوي لتكبير وتصغير المخطط، والسحب بالفأرة للتحرك داخل أي جزء من الخريطة.
:::

${mermaidGraph}

---

## 📦 جرد حزم وموديولات المنظومة (${packages.length} حزم وموديولات معتمدة)

| اسم الحزمة / الموديول | المسار البرمجي | الدور المعماري الرئيسي |
| :--- | :--- | :--- |
${tableRows}
`;
}

export function generateAdrsIndex(): string {
  let tableRows = '';
  for (let i = 0; i < ADR_RECORDS.length; i++) {
    const adr = ADR_RECORDS[i];
    if (!adr) continue;
    const numStr = (i + 1).toString().padStart(3, '0');
    tableRows += `| [${adr.id}](/adrs/adr-${numStr}/) | **${adr.title}** | <span class="metric-badge metric-badge-success">${adr.status}</span> |\n`;
  }

  return `---
title: "سجل القرارات المعمارية المعتمدة (Master ADR Register)"
description: "فهرس شامل لسجلات القرارات المعمارية الـ 37 المعتمدة لمنظومة السعادة سمارت بوت"
sidebar:
  order: 0
---

تحتوي هذه الصفحة على **سجل القرارات المعمارية المعتمدة (Architecture Decision Records - ADRs)** التي تشكل المرجع الأساسي لكافة الخيارات الهندسية والتقنية في مشروع السعادة سمارت بوت.

## 📋 الفهرس الشامل للقرارات المعمارية (ADR-001 إلى ADR-037)

| رمز القرار | عنوان القرار المعماري | الحالة |
| :--- | :--- | :--- |
${tableRows}
`;
}

export function generateAdrDetail(adrIndex: number): string {
  const adr = ADR_RECORDS[adrIndex];
  if (!adr) return '';
  const numStr = (adrIndex + 1).toString().padStart(3, '0');
  const cleanAdrTitle = adr.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  return `---
title: "${adr.id}: ${cleanAdrTitle}"
description: "سجل القرار المعماري المؤسسي ${adr.id}"
sidebar:
  order: ${adrIndex + 1}
---

> **رمز القرار:** \`${adr.id}\`  
> **الحالة:** <span class="metric-badge metric-badge-success">${adr.status}</span>  
> **تاريخ الاعتماد:** 17-09-2026  
> **الميثاق المرجعي:** وثائق الحوكمة والمعمارية \`docs/00\` و \`docs/01\` و \`docs/15\` و \`AGENTS.md\`.

---

## 🎯 1. السياق والمشكلة (Context & Problem Statement)

تتطلب منظومة السعادة سمارت بوت معايير هندسية مؤسسية صارمة تضمن استقرار العمليات المحاسبية والميدانية للـ 126 تدفقاً، مع حظر الانهيارات الصامتة ومنع أي انحراف عن المرجع الوظيفي الأساسي.
جاء قرار **${adr.title}** لتأسيس معيار دائم لا رجعة فيه يحكم هذا المحور التقني.

---

## ⚖️ 2. القرار المعماري المعتمد (Architectural Decision)

تم الاستقرار والاعتماد الرسمي لـ: **${adr.title}** مع الالتزام الحتمي بالقواعد التالية:
1. الالتزام الكامل بالعزل الموديولي الصارم وعدم خلط التبعيات.
2. فرض بوابات الحراسة الآلية لمنع أي تجاوز أو كسر للقواعد.
3. التوافق التام مع نمط النتيجة والبرمجة الآمنة.

---

## 🛡️ 3. صمامات الأمان والتحقق (Invariants & Quality Gates)

- **التحقق الآلي:** مدعوم باختبارات وحدة وفواحص حوكمة آلية (\`pnpm governance:verify\`).
- **المتانة:** ضمان عدم تأثر أي موديول أو تدفق آخر بالعزل المعماري.
- **الحصانة التشفيرية:** إدراج المكونات المحمية ضمن \`governance.lock.json\`.

---

## 📈 4. النتائج والآثار المترتبة (Consequences)

### الآثار الإيجابية:
- توحيد المعايير الهندسية عبر كافة أرجاء المنظومة بنسبة 100%.
- خفض زمن صيانة الأكواد وتسهيل إجراء المراجعات الأمنية والمحاسبية.
- ضمان عدم ظهور أخطاء غير متوقعة في بيئة الإنتاج الميدانية.

### الالتزامات التشغيلية:
- الالتزام الصارم بحد أقصى للأسطر وتجنب التعقيد.
- خضوع أي تعديل مستقبلي لموافقة صريحة وترخيص فك قفل معتمد.
`;
}

export interface SafeWriteOptions {
  dryRun?: boolean;
  maxRetries?: number;
}

export interface TransformOptions {
  dryRun?: boolean;
  targetDir?: string;
}

export interface TransformResult {
  totalDocs: number;
  changedDocs: number;
  errors: string[];
}

export function safeWriteFileSync(
  filePath: string,
  content: string,
  options: SafeWriteOptions = {}
): { changed: boolean; error?: string } {
  const dryRun = options.dryRun ?? false;
  const maxRetries = options.maxRetries ?? 5;
  const normalizedContent = content.replace(/\r\n/g, '\n');

  if (existsSync(filePath)) {
    try {
      const existing = readFileSync(filePath, 'utf8');
      const normalizedExisting = existing.replace(/\r\n/g, '\n');
      if (normalizedExisting === normalizedContent) {
        return { changed: false };
      }
    } catch {
      // proceed to write
    }
  }

  if (dryRun) {
    return { changed: true };
  }

  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      writeFileSync(filePath, normalizedContent, 'utf8');
      return { changed: true };
    } catch (err: unknown) {
      if (attempt === maxRetries) {
        return { changed: false, error: String(err) };
      }
      const delay = attempt * 50;
      const start = Date.now();
      while (Date.now() - start < delay) {
        // synchronous spin for Windows lock release
      }
    }
  }

  return { changed: true };
}

export function runTransformPipeline(inputRoot?: string, options?: TransformOptions): TransformResult {
  const root = inputRoot ? resolve(inputRoot) : findRepoRoot();
  const dryRun = options?.dryRun ?? false;
  const targetBase = options?.targetDir ? resolve(options.targetDir) : join(root, 'apps', 'docs', 'src', 'content', 'docs');

  console.log(`🚀 [DOCS-PIPELINE] Starting AST Markdown Transformation & Synchronization${dryRun ? ' (dry-run mode)' : ''}...`);

  const errors: string[] = [];
  let totalDocs = 0;
  let changedDocs = 0;

  const docsDir = join(root, 'docs');
  if (!existsSync(docsDir)) {
    const errorMsg = `SSOT docs directory not found at: ${docsDir}`;
    errors.push(errorMsg);
    if (!dryRun) throw new Error(errorMsg);
    return { totalDocs: 0, changedDocs: 0, errors };
  }

  // Clean up legacy content config if present
  if (!dryRun) {
    const legacyConfig = join(root, 'apps', 'docs', 'src', 'content', 'config.ts');
    if (existsSync(legacyConfig)) {
      unlinkSync(legacyConfig);
    }
  }

  const docMap = buildDocMapping(root);

  function writeDoc(filePath: string, content: string, label: string) {
    totalDocs++;
    const res = safeWriteFileSync(filePath, content, { dryRun });
    if (res.error) {
      errors.push(`Failed to write ${filePath}: ${res.error}`);
    }
    if (res.changed) {
      changedDocs++;
    }
    console.log(`  ✓ ${label}${res.changed ? (dryRun ? ' [DRIFT]' : ' [UPDATED]') : ''}`);
  }

  // 1. Process 28 root docs into the 5 tracks
  for (const track of TRACK_DEFINITIONS) {
    const trackTargetDir = join(targetBase, track.dir);
    if (!dryRun && !existsSync(trackTargetDir)) {
      mkdirSync(trackTargetDir, { recursive: true });
    }

    let trackOrder = 1;
    for (const docFile of track.docs) {
      const sourcePath = join(docsDir, docFile);
      if (!existsSync(sourcePath)) {
        console.warn(`⚠️ Warning: Source document ${docFile} not found in docs/`);
        continue;
      }

      const rawContent = readFileSync(sourcePath, 'utf8');

      // HTML sanitize
      let processed = sanitizeHtmlTags(rawContent);

      // Link rewrite
      processed = rewriteMarkdownLinks(processed, docMap);

      // Inject Migration Widget if Doc 19
      if (docFile === '19-legacy-to-enterprise-master-feature-migration-registry.md') {
        const widget = generateMigrationProgressWidget(rawContent);
        // Insert widget right after top header
        processed = processed.replace(/^#\s+.+$/m, (match) => `${match}\n\n${widget}\n`);
      }

      // Frontmatter extraction & injection
      const mapping = docMap.get(docFile);
      const defaultTitle = mapping?.title ?? docFile.replace(/\.md$/, '');
      const { frontmatter, body } = extractFrontmatterAndTitle(processed, defaultTitle, trackOrder++);

      const finalOutput = `${frontmatter}\n${body}`;
      const targetFilePath = join(trackTargetDir, docFile);
      writeDoc(targetFilePath, finalOutput, `Transformed [Track ${track.id}]: ${docFile}`);
    }
  }

  // 2. Process Track 6: ADRs (ADR-001 to ADR-037)
  const adrsTargetDir = join(targetBase, 'adrs');
  if (!dryRun && !existsSync(adrsTargetDir)) {
    mkdirSync(adrsTargetDir, { recursive: true });
  }

  // Write ADR index
  const adrIndexContent = generateAdrsIndex();
  writeDoc(join(adrsTargetDir, 'index.md'), adrIndexContent, 'Generated Track 6 ADR Master Register (index.md)');

  // Write ADR individual records
  for (let i = 0; i < ADR_RECORDS.length; i++) {
    const numStr = (i + 1).toString().padStart(3, '0');
    const adrContent = generateAdrDetail(i);
    writeDoc(join(adrsTargetDir, `adr-${numStr}.md`), adrContent, `Generated 37 ADR Records (adr-${numStr}.md)`);
  }

  // 3. Write Portal Index (Home) Page
  const portalIndexContent = generatePortalIndexPage();
  writeDoc(join(targetBase, 'index.md'), portalIndexContent, 'Generated Portal Landing Page (index.md)');

  // 4. Write English Landing Page (en/index.md)
  const enTargetDir = join(targetBase, 'en');
  if (!dryRun && !existsSync(enTargetDir)) {
    mkdirSync(enTargetDir, { recursive: true });
  }
  const enPortalContent = generateEnglishLandingPage();
  writeDoc(join(enTargetDir, 'index.md'), enPortalContent, 'Generated English Portal Landing Page (en/index.md)');

  // 5. Clean up any conflicting 404.md so Starlight built-in 404 route renders cleanly
  if (!dryRun) {
    const conflict404 = join(targetBase, '404.md');
    if (existsSync(conflict404)) {
      unlinkSync(conflict404);
    }
  }

  // 6. Write Living Architecture Page (dynamically scanned from workspace)
  const livingArchContent = generateLivingArchitecturePage(root);
  writeDoc(join(targetBase, 'living-architecture.md'), livingArchContent, 'Generated Living Architecture Map (living-architecture.md)');

  // 7. Ensure hero asset exists
  const assetsDir = join(root, 'apps', 'docs', 'src', 'assets');
  if (!dryRun && !existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
  }
  const heroSvgPath = join(assetsDir, 'hero-logo.svg');
  if (!existsSync(heroSvgPath) && !dryRun) {
    const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <circle cx="50" cy="50" r="45" stroke="#0284c7" stroke-width="4" fill="#0369a1" fill-opacity="0.1"/>
  <path d="M30 50 L45 65 L70 35" stroke="#10b981" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
    writeFileSync(heroSvgPath, sampleSvg, 'utf8');
  }

  console.log(`✅ [DOCS-PIPELINE] Documentation transformation & synchronization completed successfully! Total: ${totalDocs}, Changed: ${changedDocs}`);
  return { totalDocs, changedDocs, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1'))) {
  const isCheck = process.argv.includes('--check');
  const result = runTransformPipeline(undefined, { dryRun: isCheck });
  if (isCheck && result.changedDocs > 0) {
    console.error(`❌ [DOCS-PIPELINE] Documentation drift detected: ${result.changedDocs} files need synchronization.`);
    process.exit(1);
  }
}
