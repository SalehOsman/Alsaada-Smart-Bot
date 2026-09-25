# خطة عمل رقم 113: تفكيك وتطهير خادم البوت، والتهيئة الموحدة، ومطابقة التوثيق للواقع الفيزيائي (الموجة 3)
## Work Plan 113: Pure Micro-Kernel Bot Decoupling, Unified System Provisioning & Architecture Reality Alignment (Wave 3)

> **الحالة:** 🟡 بانتظار اعتماد المالك (Pending Sovereign Approval)  
> **الفرع المعزول المستهدف (OBOO Branch):** `plan/113-bot-decoupling-provisioning-and-reality-alignment`  
> **المرجع الدستوري:** ميثاق `GEMINI.md` (البنود 1، 2، 4، 5، 6، 7، 8.1، 8.2)، كتيب القواعد 11 (مسار التعديل السيادي)، وبوابات الجودة (G1–G23).  
> **الهيئة الفاحصة والمصممة:** `/jev` (Chief Quality & Forensic Sentinel) × `/saleh` (Sovereign Strategic Advisor).  
> **التوجيه السيادي للمالك (Saleh):** «المشروع مخصص لشركة واحدة، وتفكيك كافة الوظائف داخل موديولاتها، وتحويل خادم البوت لقشرة نقية، مع مطابقة التوثيق بنسبة 100% للواقع الفعلي وإلغاء أي أوهام لا وجود لها في الكود».

---

## 🔬 0. التشخيص الجنائي للواقع الفيزيائي (Forensic Reality & Root Cause Analysis)

بناءً على نتائج التدقيق الفني الشامل بتاريخ 2026-09-25 (`docs/periodic-audits/2026-09-25/`)، وبعد اكتمال الموجتين الأولى (WP 111) والثانية (WP 112) بنجاح، رصد الفحص الجنائي 4 فجوات متبقية تستوجب الحسم في هذه الموجة الثالثة:

1. **تداخل منطق الأعمال داخل خادم البوت (`apps/bot-server/src/bot.ts`):**
   - يحتوي ملف `bot.ts` في الأسطر 564–660 على معالجات أوامر مباشرة لـ (`/قسيمة راتبي/`، `/كشف حسابي/`، `/فواتيري ومستخلصاتي/`، `/🚜 تسجيل منسوب/`) تستعلم مباشرة من جداول `prisma.worker` و `prisma.financialLedger` و `prisma.supplier` وتبني نصوصاً مجردة بدائية دون المرور عبر عقود الرسائل الغنية المعتمدة (`@alsaada/core-components/rich-message`).
   - هذا يخالف مبدأ القشرة المعمارية النقية (Pure Micro-Kernel Bot Shell)، حيث يجب أن تُسند كافة تفاعلات المستخدم للموديولات المعنية (`workforce` و `settings`) عبر محرك الاكتشاف التلقائي (`Autoloader / Catalog`).

2. **تعطل أمر التهيئة الأولي (`pnpm system:provision`):**
   - في `scripts/provision.ts`، لا يتم تحميل متغيرات البيئة (`dotenv`) في مستهل السكربت، مما يتسبب في فشل الاتصال بقاعدة البيانات (`Authentication failed for user "postgres"`) عند تشغيل الأمر المباشر، وتظهر رسائل "White-Label" قديمة تتعارض مع نمط المنشأة الفردية لشركة السعادة.

3. **انحراف التوثيق عن الواقع الفيزيائي للكود (Documentation-Code Drift):**
   - لا تزال بعض شارات ومصطلحات التوثيق في `docs/06` تذكر مصطلحات `White-Label Multi-Tenant`، بينما الواقع المادي تم توحيده على شركة السعادة حصراً (`CompanyProfile`).
   - تفاوت أرقام الاختبارات وبعض التبعيات ومسارات التشغيل في الوثائق المرجعية.

4. **غياب الحراس الدائمين لمنع التراجع (Permanent Anti-Drift Sentinels):**
   - عدم وجود حارس AST آلي يمنع عودة حقول `tenantId` أو نماذج `Tenant` مستقبلاً.
   - عدم وجود فاحص آلي يمنع تلوث `apps/bot-server` باستعلامات الجداول التشغيلية أو الرسائل المجردة.
   - عدم وجود فاحص لمطابقة أرقام التوثيق بالواقع على القرص لمنع تكرار الانحراف.

---

## 🎯 الأركان الستة الهندسية للخطة (The 6 Architectural Pillars)

```mermaid
flowchart TD
    subgraph Pillar1["Pillar 1: Scope & Functional Baseline Parity"]
        P1A["تطهير bot.ts من منطق الأعمال"]
        P1B["ترحيل استعلامات الرواتب وكشف الحساب لموديول workforce"]
        P1C["ترحيل استعلامات الموردين لموديول settings"]
    end

    subgraph Pillar2["Pillar 2: Blast Radius & Data Contracts"]
        P2A["الالتزام الصارم بـ 10-file vertical slice"]
        P2B["عقود RichMessage لرسائل الرواتب وكشف الحساب"]
        P2C["حظر النصوص المجردة Zero Raw Text"]
    end

    subgraph Pillar3["Pillar 3: Telegram Mobile UX (36/16/7/3)"]
        P3A["ميزانية الأزرار 36/16/7/3"]
        P3B["استخدام formatBreadcrumbs في الشاشات الجديدة"]
    end

    subgraph Pillar4["Pillar 4: Invariants, Provisioning & Security"]
        P4A["إصلاح سكربت التهيئة scripts/provision.ts بـ dotenv"]
        P4B["قفل الحوكمة التشفيري 100%"]
        P4C["PostgreSQL 16 حصراً وحظر SQLite"]
    end

    subgraph Pillar5["Pillar 5: Test Matrix & Sentinels"]
        P5A["بناء verify-single-tenant-invariants.ts"]
        P5B["بناء verify-bot-server-purity.ts"]
        P5C["بناء verify-doc-reality-parity.ts"]
        P5D["اختبارات TDD لسكربت التهيئة"]
    end

    subgraph Pillar6["Pillar 6: Quality Gates & Attestation"]
        P6A["اجتياز بوابات G1-G23 بالكامل"]
        P6B["CGI >= 95% واجتياز jev:consult"]
        P6C["إصدار بطاقة الإقرار الجنائي الختامية"]
    end

    Pillar1 --> Pillar2 --> Pillar3 --> Pillar4 --> Pillar5 --> Pillar6
```

---

### الركن الأول (Pillar 1: Scope & Functional Baseline Parity)
- **Scope:** 
  1. تحويل `apps/bot-server` إلى قشرة تشغيلية نقية (Pure Micro-Kernel) تدير الاتصال، الجلسات، التوجيه العام، واعتراض المدخلات، وتفوض كافة استعلامات الأعمال ومعالجات الأزرار للموديولات المكتشفة تلقائياً.
  2. ترحيل معالجات `bot.hears(/قسيمة راتبي/)` و `bot.hears(/كشف حسابي/)` إلى مسار معتمد في موديول `workforce` (`modules/workforce/src/flows/01.6-worker-self-edit` أو تدفق استعلامات الموظف).
  3. ترحيل معالج `bot.hears(/فواتيري ومستخلصاتي/)` لموديول الموردين أو الإعدادات العامة.
  4. ترحيل `bot.hears(/🚜 تسجيل منسوب/)` لمعالج نموذج العمليات الميدانية في موديول القوى العاملة.
- **Functional Baseline Parity:** مطابقة 100% مع شاشات وعمليات `F:\HR` وحسابات الرواتب وكشوف الحسابات دون أدنى تغيير في المخرجات الرقمية أو العملة (EGP حصراً).

---

### الركن الثاني (Pillar 2: Blast Radius & Data Contracts (10-file vertical slice))
- **Zero Blast Radius:** لا تعديل على جداول قاعدة البيانات المقفلة أو الحزم الأساسية؛ كافة التعديلات تنحصر في:
  - `apps/bot-server/src/bot.ts`
  - موديولات `workforce` و `settings`
  - `scripts/provision.ts`
  - `tools/governance/`
  - التوثيق `README.md` و `docs/06`
- **Rich Message Invariant:** تحويل كافة النصوص المجردة في معالجات الأزرار القديمة إلى قوالب `buildRichPage` من `@alsaada/core-components/rich-message` مفحوصة بـ `assertRichMessage`.

---

### الركن الثالث (Pillar 3: Telegram Mobile UX & Ergonomics Budget (36/16/7/3))
- **Button & Viewport Budget:**
  - نصوص الأزرار: حد أقصى 16 حرفاً.
  - الـ Callback Data: حد أقصى 36 بايت.
  - الشبكة: حد أقصى 7 صفوف × 3 أزرار.
- **Breadcrumbs Navigation:** شريط التنقل الهرمي عبر `formatBreadcrumbs`.

---

### الركن الرابع (Pillar 4: Invariants, Provisioning & Security)
- **System Provisioning (`scripts/provision.ts`):**
  - تحميل `dotenv` مسبقاً وتوجيه الاتصال لـ `DATABASE_URL` المعتمد.
  - إنشاء وتثبيت ملف المنشأة الفردي `CompanyProfile` لشركة السعادة للتعدين ببيانات متكاملة.
  - إنشاء وتحديث المستخدم المدير العام الافتراضي مع ربطه بالرقم التعريفي لتيليجرام (`SUPER_ADMIN_TELEGRAM_ID`).
  - تشغيل فحص جاهزية قاعدة البيانات والتأكد من خروج السكربت بـ `Exit Code 0`.
- **Single-Company & Storage Invariant:**
  - تأكيد وتثبيت PostgreSQL 16 كمحرك وحيد، وشطب أي ذكر لـ SQLite.
  - حظر أي كيان أو حقل مستأجرين.

---

### الركن الخامس (Pillar 5: Test Matrix & Permanent Anti-Drift Sentinels)
- **1. حارس معمارية المنشأة الواحدة (`tools/governance/verify-single-tenant-invariants.ts`):**
  - فحص AST لمخططات Prisma: حظر وجود `model Tenant` أو أي حقل `tenantId`.
  - فحص الكود: حظر استدعاء `prisma.tenant`.
- **2. حارس نقاء خادم البوت (`tools/governance/verify-bot-server-purity.ts`):**
  - فحص AST لملف `apps/bot-server/src/bot.ts`:
    - حظر استعلام الجداول التشغيلية مباشرة (`prisma.worker`, `prisma.financialLedger`, `prisma.supplier`).
    - حظر استدعاءات `ctx.reply("string")` المجردة دون كتل RichMessage.
- **3. رادار تطابق التوثيق والواقع الفيزيائي (`tools/governance/verify-doc-reality-parity.ts`):**
  - التحقق من وجود كافة الملفات المشار إليها في سكربتات `package.json`.
  - مطابقة إصدار Prisma المذكور في الوثائق مع `packages/database/package.json`.
  - مطابقة أعداد الاختبارات والموديولات مع الموجود الفعلي على القرص.
- **4. حزمة الاختبارات (TDD):**
  - كتابة اختبارات لكل حارس حوكمة لضمان كفاءته ومنع الالتفاف عليه.
  - فحص دورة الـ TDD لسكربت `provision.ts`.

---

### الركن السادس (Pillar 6: Acceptance Criteria & Quality Gates (G1–G23))
- **Acceptance Criteria:**
  1. خلو `apps/bot-server/src/bot.ts` تماماً من أي استعلام مباشر عن جداول الأعمال أو نصوص مجردة.
  2. تشغيل `pnpm system:provision` بنجاح وسلاسة وإنشاء ملف شركة السعادة وحساب المدير العام في < 3 ثوان.
  3. اجتياز الحراس الجدد الثلاثة بنسبة 100%:
     - `pnpm exec tsx tools/governance/verify-single-tenant-invariants.ts` -> PASS
     - `pnpm exec tsx tools/governance/verify-bot-server-purity.ts` -> PASS
     - `pnpm exec tsx tools/governance/verify-doc-reality-parity.ts` -> PASS
  4. تحديث `README.md` و `docs/06` بنسبة مطابقة 100% للواقع الفيزيائي.
  5. اجتياز الفحص النوعي `pnpm typecheck`، واختبارات الحوكمة `pnpm test:governance`، والفحص السريع `pnpm pre-commit:fast`.
  6. إعادة القفل التشفيري التام في `governance.lock.json` واجتياز `pnpm lock:verify`.

---

## 📋 خطة التنفيذ الميدانية على مراحل (Step-by-Step Execution Phases)

| المرحلة | الأنشطة والإجراءات | الملفات المستهدفة |
| :---: | :--- | :--- |
| **المرحلة 1** | **إصلاح وتأهيل سكربت التهيئة (`scripts/provision.ts`)**<br>• تحميل dotenv وضبط إعدادات الاتصال.<br>• تهيئة بيانات شركة السعادة وحساب الأدمن.<br>• اختبار التشغيل بـ `pnpm system:provision`. | `scripts/provision.ts`<br>`packages/database/src/scripts/seed-company-profile.ts` |
| **المرحلة 2** | **تطهير خادم البوت ونقاء النواة (`Pure Bot Shell`)**<br>• ترحيل معالجات الرواتب وكشف الحساب والموردين إلى موديولاتها.<br>• تحويل المعالجات المتبقية في `bot.ts` لعقود RichMessage.<br>• تنظيف `bot.ts` من أي استعلام مباشر لـ Prisma. | `apps/bot-server/src/bot.ts`<br>`modules/workforce/src/flows/*`<br>`modules/settings/src/flows/*` |
| **المرحلة 3** | **بناء حراس الحوكمة الدائمين الثلاثة**<br>• بناء `verify-single-tenant-invariants.ts`.<br>• بناء `verify-bot-server-purity.ts`.<br>• بناء `verify-doc-reality-parity.ts`.<br>• إضافة سكربتاتها في `package.json` وربطها بـ `governance:verify`. | `tools/governance/*`<br>`package.json` |
| **المرحلة 4** | **تحديث الوثائق ومطابقتها للواقع الفيزيائي**<br>• تنقيح `README.md` وشطب أوهام SQLite وتعدد الشركات.<br>• تنقيح `docs/06-company-profile-and-system-setup.md`.<br>• تحديث إحصائيات المعمارية والموديولات والـ 290+ اختباراً. | `README.md`<br>`docs/06-company-profile-and-system-setup.md` |
| **المرحلة 5** | **الفحص الجنائي وإعادة القفل التشفيري الشامل**<br>• فحص الأنواع `pnpm typecheck` واختبارات الحوكمة `pnpm test:governance`.<br>• التحقق من القفل التشفيري `pnpm lock:verify`.<br>• فحص `/jev` وإصدار بطاقة الإقرار الجنائي الختامية. | `governance.lock.json`<br>`docs/ai-execution-evidence/` |

---

## 🚦 صيغة الاعتماد الإلزامية للمالك (Owner Sovereign Approval Checkpoint)

وفقاً للبند 7 من ميثاق `GEMINI.md` والمسار التشغيلي السيادي (WP 94)، فإن البدء في تنفيذ الكود البرمجي للمرحلة الأولى يتطلب اعتماد سيادتكم الصريح والمطابق حرفياً:

> **«موافق على خطة الإصلاح»**
