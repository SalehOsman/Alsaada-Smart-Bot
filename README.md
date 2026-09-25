<div align="center">

# 🏢 Al-Saada Smart Enterprise Framework
## المنظومة الذكية المؤسسية لإدارة العمليات الميدانية والمالية والموارد البشرية

**إطار عمل مؤسسي متقدم مبني على أحدث معايير TypeScript و grammY ومعمارية الموديولات المستقلة**  
*مستوحى من أفضل ممارسات معمارية Tempot v11 مع توجيه متخصص لقطاعات المقاولات والمشاريع والتوريدات*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9_Strict-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-24+-green?logo=node.js&logoColor=white)](https://nodejs.org/)
[![grammY](https://img.shields.io/badge/grammY-1.41+-blueviolet?logo=telegram&logoColor=white)](https://grammy.dev/)
[![Architecture](https://img.shields.io/badge/Architecture-Modular_Monolith-success)](#)
[![Database](https://img.shields.io/badge/Storage-PostgreSQL_16_%2B_Google_Sheets-336791?logo=postgresql&logoColor=white)](#)
[![AI Powered](https://img.shields.io/badge/AI_Vision-Gemini_2.5_Flash-orange)](#)

</div>

> [!IMPORTANT]
> **ميثاق المرجعية الأساسية وإعادة الهيكلة النظيفة (The Baseline SSOT Charter):**
> * هذا المشروع الجديد (`F:\Alsaada-Smart-Bot`) هو **إعادة هيكلة شاملة وتصحيح وتطوير حديث** لمنظومتنا الحالية.
> * **مشروعنا الحالي (`F:\HR`) هو مصدر الحقيقة المطلقة والكاملة (The Definitive Functional Baseline & SSOT)** لمعرفة وتدقيق كافة الوظائف والتدفقات الـ 126 المعتمدة، وقواعد العمل، والـ 66 شيت.
> * **تجميد المشروع الحالي دون أي تعديل:** يظل المشروع الحالي يعمل بكامل طاقته في بيئة الإنتاج دون المساس به، ويُستخدم كمرجع مكتبي وميداني لمطابقة كل رقم وشاشة وتدفق.
> * **إعادة البناء في هذا المشروع:** تتم إعادة بناء كل وظيفة وفق المعمارية الموديولية المعزولة الحديثة بدقة متناهية.
> * راجع الوثيقة التأسيسية: [دستور المرجعية وميثاق إعادة الهيكلة](./docs/00-baseline-and-ssot-charter.md).

---

## 🌟 الرؤية والأهداف الاستراتيجية (Vision & Core Objectives)

1. **المنظومة المؤسسية المخصصة (Dedicated Enterprise Engine - شركة السعادة):**
   * معمارية مؤسسية مخصصة بالكامل لشركة السعادة للمقاولات العامة تعتمد ملف الشركة الفردي (Singleton `CompanyProfile`).
   * تجريد كافة الثوابت التشغيلية في ملفات إعدادات مركزية وقاعدة بيانات PostgreSQL 16 موحدة مع حظر تام لتعدد الشركات.
2. **محرك التوليد الآلي لقواعد البيانات (Google Sheets Auto-Provisioner):**
   * توليد كافة ملفات الشيتات (66 شيت)، وتبويباتها، وأعمدتها، وتنسيقاتها، وألوانها، ومعادلاتها الحسابية آلياً مع بداية التشغيل (`pnpm system:provision`) دون أي تدخل يدوي.
3. **النواة المشتركة الشاملة (Core Shared Kernel):**
   * محركات عامة مجهزة مسبقاً لاستدعائها في أي موديول: محرك اختيار العمال، معالج المبالغ النقدية، حاسبة الكميات، بطاقات الاعتماد، ولوحات أزرار ما بعد الإنجاز، ومحرر الرسائل الغني (`assertRichMessage`).
4. **الذكاء الاصطناعي لاستخراج وقراءة الفواتير والمستندات (AI Vision Invoice Extractor):**
   * قراءة صور الفواتير، وسندات التحويل البنكي، وبوالص الشحن عبر الذكاء الاصطناعي واستخراج البيانات رقمياً لمنع الأخطاء البشرية والتزوير.
5. **التحقق من الهوية الوطنية المصرية (Egyptian National ID Engine):**
   * فحص الأرقام القومية للعمال واستخراج تاريخ الميلاد والنوع والمحافظة تلقائياً مع التحقق من صحة الرقم القومي.
6. **معمارية الحماية من التراجع (Zero-Regression Architecture):**
   * عزل كل موديول بجلسته وملفاته واختباراته التفاعلية، مدعوماً بمحرك محاكاة المحادثات لمنع كسر أي وظيفة سابقة.

---

## 🏛️ البنية الهندسية للمشروع (Architecture Overview)

```
F:\Alsaada-Smart-Bot/
├── apps/
│   ├── admin-dashboard/         # لوحة الإدارة التشغيلية المتطورة (Next.js 15 + Tailwind + SSR/Data Fetchers)
│   ├── bot-server/              # التطبيق التنفيذي للبوت (grammY Polling Engine + Native Node HTTP Health Server)
│   └── docs/                    # مركز التوثيق والمواصفات المعتمدة (Astro Documentation Hub)
│
├── packages/                    # 🧱 الحزم التقنية المشتركة والنواة المستقلة (Core Shared Kernel)
│   ├── ai-vision-engine/        # محرك قراءة الفواتير والمرفقات ونماذج الذكاء الاصطناعي
│   ├── core-components/         # مكونات الواجهة والمحركات (Pickers, Clearing, RichMessage, Outbox, etc.)
│   ├── database/                # قاعدة البيانات المركزية (Prisma 7.10.0 + PostgreSQL 16 + التشفير والهاش التراكمي)
│   ├── google-engine/           # محرك الربط السحابي ومزامنة شيتات جوجل
│   ├── national-id-engine/      # محرك تحليل الهوية القومية المصرية والتحقق الرياضي والبيانات الديموغرافية
│   ├── rbac/                    # مصفوفة الصلاحيات السباعية الموحدة وحوكمة الوصول للداشبورد والبوت
│   ├── regional-engine/         # محرك التوقيت (Africa/Cairo) وتنسيق العملات والأرقام المشرقية
│   ├── shared/                  # الأدوات المساعدة المشتركة والثوابت العامة
│   └── telemetry/               # مرصد المراقبة والقياس الجنائي وتسجيل الأعطال وتتبع الأداء
│
├── modules/                     # 📦 موديولات الأعمال المستقلة تماماً (Vertical Slices)
│   ├── settings/                # موديول إعدادات النظام والتحكم السيادي والرقابة والأداء والمجموعات (12 تدفقاً)
│   ├── workforce/               # موديول شؤون العاملين وسجلات التسكين ودليل 360° واستخراج الإكسيل (9 تدفقات)
│   └── sandbox/                 # موديول بيئة الاختبار المعزولة والتجارب الميدانية
│
├── tools/
│   ├── governance/              # حراس بوابات الحوكمة وفحص المعمارية والعقود وسقف بايتات تليجرام
│   └── scaffold/                # أداة التوليد الآلي للتدفقات المعيارية (pnpm make:flow)
│
└── .githooks/                   # خطافات Git المحلية للفحص المسبق التلقائي قبل الالتزام
```

---

## 🚀 دليل البدء السريع للمطورين (Developer Quickstart)

```bash
# 1. تثبيت كافة الحزم والاعتماديات
pnpm install

# 2. توليد عميل Prisma Client لقاعدة بيانات PostgreSQL 16
pnpm db:generate

# 3. تهيئة ملف الشركة الفردي والمشروع الأساسي
pnpm system:provision

# 4. تشغيل خادم البوت في وضع التطوير
pnpm --filter @alsaada/bot-server dev
```

---

## 🛡️ أوامر التشغيل وبوابات الجودة والحوكمة (Quality & CI Governance Gates)

| الأمر البرمجي | الوصف والهدف الهندسي |
| :--- | :--- |
| `pnpm build` | بناء تجميعي كامل لكافة الحزم والموديولات بتصريف TypeScript 5.9+ صارم وخالٍ من الأخطاء |
| `pnpm test` | تشغيل 291 جناح اختبار (291 Spec Suites) و1,900+ اختبار آلي بنسبة نجاح 100% (TDD & Zero-Regression) |
| `pnpm make:flow` | أداة توليد التدفقات المعيارية بالقوالب النمطية الأربعة لإنشاء شرائح الوثيقة 21 (< 350 سطراً) |
| `pnpm flow:check` | الفحص الموضعي اللحظي فائق السرعة للتدفق المعدل حصراً في أقل من ثانيتين (< 2s) |
| `pnpm flow:finish` | أداة الأتمتة للإغلاق والترحيل وسجل الترحيل Doc 19 وملف الإثبات وقفل الحوكمة |
| `pnpm governance:verify` | تشغيل بوابات الحوكمة الشاملة معاً والتحقق الصارم من استيفاء شروط الاعتماد |
| `pnpm single-tenant:verify` | حارس النزاهة المؤسسية للتأكد من خلو المشروع تماماً من أي آثار لتعدد الشركات |
| `pnpm doc-parity:verify` | حارس مطابقة التوثيق للواقع الفيزيائي وفحص صلاحية السكربتات ومحركات قواعد البيانات |
| `pnpm arch:verify` | التحقق من العزل الموديولي وسقف الأسطر (< 350) وحظر استيراد موديول لموديول آخر |
| `pnpm migration:verify` | فحص مطابقة سجل الترحيل Master Migration Registry والتحقق من المسارات والـ Commits |
| `pnpm flow-contracts:verify` | فحص عقود التدفقات ومعالجات الواجهة وتطابق واجهات الإدخال والتنقل |
| `pnpm telegram-contracts:verify` | حارس عقود Telegram Bot API الآلي لضمان سقف 512 بايت للروابط و64 بايت لبيانات الـ Callbacks |
| `pnpm docs:audit` | فحص اكتمال الوثائق الإلزامية وعلامات المعايير والسكربتات |
| `pnpm docs:parity` | فحص التناغم التوثيقي بين ملفات الحوكمة والمعايير |
| `pnpm governance:tamper-check` | فحص عدم التلاعب بقفل الحوكمة governance.lock.json والتغييرات غير المصرح بها |
| `pnpm ai-compliance:verify` | فحص امتثال الذكاء الاصطناعي للدستور ومنع التكاسل أو التأجيل غير الموثق |

---

## 📚 الفهرس المكتبي لتوثيق المشروع

* [00. دستور المرجعية وميثاق إعادة الهيكلة والتصحيح المعماري](./docs/00-baseline-and-ssot-charter.md)
* [01. المعمارية العامة والاستفادة من تجربة Tempot](./docs/01-architecture-and-tempot-synergy.md)
* [02. كتالوج المكونات المشتركة المجهزة مسبقاً](./docs/02-core-shared-components-catalog.md)
* [03. محرك قراءة الفواتير والمرفقات بالذكاء الاصطناعي](./docs/03-ai-vision-invoice-engine.md)
* [04. محرك التوليد الآلي لشيتات جوجل (Auto-Provisioner)](./docs/04-google-sheets-auto-provisioner.md)
* [05. خارطة الطريق التنفيذية للمشروع الجديد](./docs/05-master-implementation-roadmap.md)
* [06. دليل ومنهجية تهيئة ملف الشركة وإعداد المنظومة (Single-Company Setup)](./docs/06-tenant-onboarding-and-provisioning-wizard.md)
* [07. طوبولوجيا ملفات جوجل شيت ومحرك التوجيه السحابي](./docs/07-sheets-topology-and-registry-resolver.md)
* [08. مصفوفة الصلاحيات السباعية ودور الإدارة العليا](./docs/08-universal-rbac-and-executive-role.md)
* [09. حوكمة وتعديل بيانات قاعدة البيانات ووحدة تحكم السوبر أدمن](./docs/09-database-governance-and-superadmin-console.md)
* [10. بروتوكول التحقق من الهوية بحساب تليجرام الحصري](./docs/10-telegram-id-identity-verification.md)
* [11. محرك الدعوات الشامل وطلبات الانضمام لكافة الأدوار](./docs/11-universal-invitation-and-onboarding-engine.md)
* [12. هندسة التكوين التأسيسي والإدارة الديناميكية من البوت](./docs/12-system-configuration-and-operational-simplicity.md)
* [13. المنظومة المالية المحاسبية المغلقة وقائمة الدخل والأرباح](./docs/13-closed-loop-financial-and-pnl-engine.md)
* [14. ميثاق حوكمة وكلاء الذكاء الاصطناعي وقواعد التعامل مع الملفات البرمجية](./docs/14-ai-agent-governance-and-file-rules.md)
* [15. الدستور المعياري لبناء الموديولات والتدفقات الوظيفية](./docs/15-universal-module-and-flow-standard.md)
* [16. ميثاق أمان قواعد البيانات وحوكمة القيود الجنائية والتشفير](./docs/16-database-security-and-tamper-proof-ledger.md)
* [17. الدليل المعياري لتكويد العمال وهيكل الأقسام والربط الصامت بالأكواد القديمة](./docs/17-worker-coding-and-silent-alias-resolution.md)
* [18. المعمارية الهندسية الشاملة لقاعدة بيانات PostgreSQL ونموذج الكيانات والعلاقات](./docs/18-enterprise-schema-and-entity-relationship-model.md)
* [19. السجل المرجعي الشامل لحصر وترحيل وظائف المنظومة والوظائف المستحدثة](./docs/19-legacy-to-enterprise-master-feature-migration-registry.md)
* [20. دليل وحدة التحكم وإعدادات السوبر أدمن والتحكم السيادي](./docs/20-super-admin-settings-and-control-hub-guide.md)
* [21. معيار الموديولات الإلزامي وبوابات الاعتماد الصارمة](./docs/21-mandatory-module-architecture-and-gates.md)
* [22. معايير تصميم تجربة وواجهة المستخدم على تليجرام](./docs/22-telegram-ux-ui-design-system-and-ergonomics.md)
* [23. ميثاق تشكيل الفرق الهندسية المستقلة ومحرك المعرفة المرجعية المحلي](./docs/23-autonomous-agent-roster-and-rag.md)
* [24. دستور ومعايير هندسة وظائف وتدفقات المنظومة (المواصفات الشاملة الموحدة)](./docs/24-enterprise-feature-and-flow-master-specification.md)
* [25. المخطط المعماري المؤسسي للسرعة القصوى والأداء الفائق للبوت (< 100ms)](./docs/25-optimal-high-performance-bot-architecture-and-speed-blueprint.md)
* [26. السجل المرجعي الشامل للوظائف المقفلة والحصانة التشفيرية](./docs/26-locked-flows-and-features-registry.md)
* [27. دستور حوكمة الذكاء الاصطناعي وبوابات الجودة المؤسسية الموحدة](./docs/27-enterprise-ai-governance-and-quality-gates-constitution.md)
* [28. دستور إدارة الإصدارات الحية ومنهجية التحديثات الآمنة بنمط الأثر الصفري](./docs/28-enterprise-safe-upgrade-and-living-release-standard.md)
* [29. السجل المرجعي الشامل للواقع الفيزيائي للاختبارات والامتثال الدستوري](./docs/29-master-tests-physical-reality-and-compliance-ledger.md)

---

### 📑 سجلات إثبات التنفيذ وتقارير الجودة (Verification Evidence)

* [وثيقة التدقيق الجنائي الفني الشامل للمنظومة — 19-09-2026](./docs/periodic-audits/2026-09-19/comprehensive-forensic-engineering-audit.md) — تقرير التدقيق الجنائي الفني الشامل الصادر عن هيئة المحلفين التقنية العليا وفحص محاور النزاهة المالية ومعمارية الإضافات وأمن الداشبورد وبوابات الجودة.
* [سجل تقارير وأدلة تنفيذ الذكاء الاصطناعي والحوكمة](./docs/ai-execution-evidence/README.md) — الفهرس المعتمد لتقارير الإثبات والاعتماد الصارم لكافة التعديلات.
* [توثيق إصلاحات بطاقة العامل الشاملة وحارس عقود تليجرام الآلي — 09-09-2026](./docs/ai-execution-evidence/2026-09-09-remediation-and-telegram-contracts-guard.md) — تقرير إثبات إنجاز إصلاحات سقف البايتات وكشف الرقم القومي وتفعيل حارس العقود والاجتياز الكامل لبوابات الجودة (Status: PASS).
* [تقرير مراجعة الهيكلة والمطابقة التاريخي — 08-09-2026](./docs/ai-execution-evidence/08-09-2026-restructuring-audit.md) — تقرير الفحص الأولي التاريخي؛ لا يُعد دليلاً على إغلاق نتائجه، وتوضح مراجعة 10-09-2026 الحالة الحالية.
* [خطة الإصلاح الشاملة وبوابات منع الدمج — 08-09-2026](./docs/superpowers/plans/2026-09-08-comprehensive-remediation-and-enforced-merge-gates.md) — خطة معالجة R01–R17 والبوابات G1–G12؛ التنفيذ الكامل ومنع الدمج على الخادم لم يثبتا بعد وفق مراجعة 10-09-2026.
* [تقرير الوضع الحالي والالتزام بمنهجية إعادة الهيكلة — 10-09-2026](./docs/ai-execution-evidence/10-09-2026-current-methodology-assessment.md) — تقدم موديولي فعلي مع إخفاق البناء والأنواع والمعمارية، وفجوات في توصيل الوظائف والحوكمة؛ الحالة FAIL / RETEST_REQUIRED.

---

## 🧪 تشغيل الاختبارات الموحد (Unified Test Execution)

توفر المنظومة طريقتين معتمدتين وموحدتين لتشغيل حزمة الاختبارات عبر كافة الحزم والموديولات:

1. **التشغيل المركزي الشامل (Root Unified Runner):**
   ```bash
   pnpm test
   ```
   يشغّل محرك `vitest` مركزياً عبر كافة ملفات `*.spec.ts` في المنظومة (291 ملف اختبار، 1,900+ اختباراً) بنجاح كامل 100%.

2. **التشغيل التكراري عبر مساحات العمل (Workspace Recursive Runner):**
   ```bash
   pnpm -r test
   ```
   يشغّل سكربت `test` الخاص بكل حزمة وتطبيق وموديول داخل الـ Workspace بالتوازي، مع دعم التمرير التلقائي للحزم الخالية من ملفات الاختبار عبر العلم المعتمد `--passWithNoTests`.
