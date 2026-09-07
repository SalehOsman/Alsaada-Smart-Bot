<div align="center">

# 🏢 Al-Saada Smart Enterprise Framework
## المنظومة الذكية المؤسسية لإدارة العمليات الميدانية والمالية والموارد البشرية

**إطار عمل مؤسسي متقدم مبني على أحدث معايير TypeScript و grammY ومعمارية الموديولات المستقلة**  
*مستوحى من أفضل ممارسات معمارية Tempot v11 مع توجيه متخصص لقطاعات المقاولات والمشاريع والتوريدات*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9_Strict-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.12+-green?logo=node.js&logoColor=white)](https://nodejs.org/)
[![grammY](https://img.shields.io/badge/grammY-1.41+-blueviolet?logo=telegram&logoColor=white)](https://grammy.dev/)
[![Architecture](https://img.shields.io/badge/Architecture-Modular_Monolith-success)](#)
[![Database](https://img.shields.io/badge/Storage-Hybrid_(DB_%2B_Google_Sheets)-34A853?logo=sqlite&logoColor=white)](#)
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

1. **التحول إلى منتج مؤسسي عام (White-Label Multi-Tenant Engine):**
   * تجريد كافة الثوابت النصية والتشغيلية في ملفات إعدادات مركزية (`company.config.ts`).
   * قابلية تشغيل المنظومة لأي شركة مقاولات، أو توريدات، أو مصانع خلال دقائق.
2. **محرك التوليد الآلي لقواعد البيانات (Google Sheets Auto-Provisioner):**
   * توليد كافة ملفات الشيتات (66 شيت)، وتبويباتها، وأعمدتها، وتنسيقاتها، وألوانها، ومعادلاتها الحسابية آلياً مع بداية التشغيل (`npm run system:provision`) دون أي تدخل يدوي.
3. **النواة المشتركة الشاملة (Core Shared Kernel):**
   * محركات عامة مجهزة مسبقاً لاستدعائها في أي موديول: محرك اختيار العمال، معالج المبالغ النقدية، حاسبة الكميات، بطاقات الاعتماد، ولوحات أزرار ما بعد الإنجاز.
4. **الذكاء الاصطناعي لاستخراج وقراءة الفواتير والمستندات (AI Vision Invoice Extractor):**
   * قراءة صور الفواتير، وسندات التحويل البنكي، وبوالص الشحن عبر الذكاء الاصطناعي واستخراج البيانات رقمياً لمنع الأخطاء البشرية والتزوير.
5. **التحقق من الهوية الوطنية المصرية (Egyptian National ID Engine):**
   * فحص الأرقام القومية للعمال واستخراج تاريخ الميلاد والنوع والمحافظة تلقائياً مع التحقق من صحة الرقم القومي.
6. **معمارية الحماية من التراجع (Zero-Regression Architecture):**
   * عزل كل موديول بجلسته وملفاته واختباراته التفاعلية، مدعوماً بمحرك محاكاة المحادثات لمنع كسر أي وظيفة سابقة.

---

## 🏛️ البنية الهندسية المستهدفة (Architecture Overview)

```
F:\Alsaada-Smart-Bot/
├── docs/                        # 📚 التوثيق المعماري الشامل والمواصفات القياسية
├── packages/                    # 🧱 الحزم التقنية المستقلة القابلة لإعادة الاستخدام
│   ├── core-components/         # مكونات الواجهة التفاعلية (WorkerPicker, AmountPicker, etc.)
│   ├── ai-vision-engine/        # محرك قراءة الفواتير والإيصالات بالذكاء الاصطناعي
│   ├── sheets-provisioner/      # محرك التوليد الآلي للشيتات والمعادلات
│   ├── national-id-engine/      # محرك تحليل الهوية القومية المصرية
│   ├── regional-engine/         # محرك التوقيت (Africa/Cairo) والعملات وتحويل الأرقام
│   └── test-harness/            # محرك محاكاة المحادثات للاختبارات التكاملية
│
├── modules/                     # 📦 موديولات الأعمال المستقلة تماماً (Vertical Slices)
│   ├── canteen/                 # موديول الكانتين والسجائر وضيافة الموقع
│   ├── advances/                # موديول السلف النقدية ومصروف الجيب الدوري
│   ├── leaves/                  # موديول الإجازات والغياب وحساب البدلات
│   ├── custody/                 # موديول العهد النقدية ومصاريف الموقع
│   ├── logistics/               # موديول شحن الفوسفات وبوالص السيارات
│   ├── fuels/                   # موديول تفريغ وجرد تنكات السولار
│   └── workforce/               # موديول بطاقات العمال 360 وسجلات التسكين
│
└── apps/
    └── bot-server/              # التطبيق التنفيذي الرئيسي (grammY + Hono Webhook)
```

---

## 📚 الفهرس المكتبي لتوثيق المشروع

* [00. دستور المرجعية وميثاق إعادة الهيكلة والتصحيح المعماري](./docs/00-baseline-and-ssot-charter.md)
* [01. المعمارية العامة والاستفادة من تجربة Tempot](./docs/01-architecture-and-tempot-synergy.md)
* [02. كتالوج المكونات المشتركة المجهزة مسبقاً](./docs/02-core-shared-components-catalog.md)
* [03. محرك قراءة الفواتير والمرفقات بالذكاء الاصطناعي](./docs/03-ai-vision-invoice-engine.md)
* [04. محرك التوليد الآلي لشيتات جوجل (Auto-Provisioner)](./docs/04-google-sheets-auto-provisioner.md)
* [05. خارطة الطريق التنفيذية للمشروع الجديد](./docs/05-master-implementation-roadmap.md)
* [06. دليل ومنهجية إعداد وبناء البوت للمنشآت (CLI Provisioning Wizard)](./docs/06-tenant-onboarding-and-provisioning-wizard.md)
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

