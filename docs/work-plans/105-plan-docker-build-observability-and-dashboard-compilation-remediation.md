# خطة العمل 105: مرصد بناء الحاويات ومعالجة إخفاق تجميع لوحة التحكم (WP 105)
## Plan 105: Sovereign Docker Build Observability Sentinel & Dashboard Compilation Remediation

> **المعرف السيادي:** `WP-105`  
> **الفرع المنعزل (Isolated Branch):** `fix/inc-20260924-docker-dashboard-build`  
> **ملف الحادثة المرتبط:** [`docs/code-incidents/2026-09-24-incident-docker-dashboard-build.md`](file:///f:/Alsaada-Smart-Bot/docs/code-incidents/2026-09-24-incident-docker-dashboard-build.md)  
> **المستوى والخطورة:** `SEV-2 (High)` | **التصنيف:** `TYPE_CONVERSION_DRIFT & BUILD_BOTTLENECK`  
> **تاريخ الإنشاء:** `2026-09-24`  
> **المستشار السيادي المعتمد:** `/jev` (Pure Cloud Sentinel - TypeSafe System One)  

---

## الركيزة 1: المجال والسياق المعماري (Architectural Scope & Context)

أثناء تشغيل بناء الحاويات الشامل للمنظومة (`docker compose build`)، توقف بناء حاوية لوحة التحكم (`alsaada-enterprise-system-dashboard`) فجأة عند خطوة البناء رقم 94 في `Dockerfile.dashboard`:
```dockerfile
RUN pnpm --filter @alsaada/admin-dashboard... build
```
بخطأ فادح: `exit code: 1` واستغراق زمن بناء قياسي بلغ **316.8 ثانية (أكثر من 5 دقائق)** لكافة الحاويات قبل السقوط.

### الأهداف الأساسية للخطة:
1. **القضاء الجذري على خطأ التجميع:** حل التباين النمطي بين `BackupListItemDto` المستورد من `@alsaada/settings` وبين واجهة `BackupItem` داخل `apps/admin-dashboard/src/app/admin/settings/backup/page.tsx` و `backup-client.tsx`.
2. **إنشاء مرصد بناء الحاويات الذكي (Docker Build Observability Sentinel):** استحداث أداة حوكمية متقدمة (`tools/docker/docker-build-telemetry.ts`) تقيس وتوثق زمن بناء كل حاوية وكل مرحلة فرعية بالمللي ثانية، وتلتقط الأخطاء فوراً وتوثقها جنائياً في سجلات الحوكمة.
3. **تسريع وتقليص زمن البناء (Build Acceleration & Layer Caching):** إدخال تحسينات كاش BuildKit وحظر التجميع المكرر غير الضروري، وضمان ألا تتجاوز إعادة البناء 30-45 ثانية عبر كاش Next.js المستقل.
4. **الضمانات الوقائية:** إضافة اختبار انحدار نمطي دائم في `apps/admin-dashboard/tests/` يتحقق من تكامل أنواع الصفحات دون الحاجة للانتظار حتى خطوة Docker.

---

## الركيزة 2: التحليل الجذري للخلل (Forensic Root Cause Analysis - RCA & 5 Whys)

### التسلسل السببي الخماسي:
1. **لماذا أخفق بناء الحاوية؟**  
   أخفق أمر `next build` داخل حاوية `Dockerfile.dashboard` بسبب خطأ فحص الأنماط:
   `Type error: Type 'BackupListItemDto[]' is not assignable to type 'BackupItem[]'. Types of property 'artifactsCount' are incompatible: Type 'number | undefined' is not assignable to type 'number'.`
2. **لماذا ظهر هذا الخطأ داخل Docker ولم يظهر في فحص tsc العادي؟**  
   لأن `pnpm --filter @alsaada/admin-dashboard... build` يقوم أولاً بتجميع موديول `@alsaada/settings` وتوليد `dist/flows/.../flow.types.d.ts` حيث عُرّف الحقل كـ `artifactsCount?: number | undefined`، بينما كانت واجهة `BackupItem` في صفحة لوحة التحكم تتطلب `artifactsCount: number` كحقل إجباري؛ وأداة `next build` تقوم بفحص JSX Props بدقة تامة وتسقط البناء.
3. **لماذا تأخذ إعادة بناء الحاويات وقتاً طويلاً جداً (> 5 دقائق)؟**  
   لأن `docker compose build` يقوم ببناء 4 حاويات بالتوازي:
   - حاوية `bot` تعيد تجميع الحزم والـ 23 تدفقاً بالكامل.
   - حاوية `dashboard` تعيد تثبيت الحزم وتجميع الحزم المشتركة من الصفر بواسطة `tsc` وتستغرق وحدها 111 ثانية.
   - حاوية `docs` تبني بيئة Astro كاملة.
   - تزامن الحاويات الأربع يؤدي إلى اختناق في الذاكرة والمعالج ومدخلات القرص (I/O Thrashing) على بيئة Docker Desktop، مما يضاعف الوقت إلى 316.8 ثانية.
4. **لماذا لا توجد رؤية أو تتبع لسبب التعطيل والتأخير؟**  
   لأن مخرجات Docker Compose الافتراضية تعطي أشرطة تقدم مجمعة (`[+] build 0/4 - 316.8s`) وتخفي تفاصيل التوقيت لكل خطوة داخلية وأين يقع عنق الزجاجة بالضبط.
5. **السبب الجذري الحقيقي (True Root Cause):**  
   غياب مواءمة الأنماط الدقيقة (Type Invariant Harmonization) بين عقود الموديولات المشتركة ومكونات واجهات Next.js، بالتوازي مع افتقار بنية Docker Compose إلى مرصد توقيت وتحليل الاختناقات (Build Telemetry & Stage Profiler).

---

## الركيزة 3: المواصفات الفنية والمعمارية للحل (Technical Architecture & Specifications)

### 3.1 معالجة عدم التوافق النمطي (Type Harmonization):
في `apps/admin-dashboard/src/app/admin/settings/backup/page.tsx`:
- تحويل استدعاء `backupService.listRecentBackups()` لضمان الإسناد الافتراضي الصريح:
```tsx
const rawBackups = await backupService.listRecentBackups();
const backups: BackupItem[] = rawBackups.map((b) => ({
  ...b,
  artifactsCount: b.artifactsCount ?? 0,
}));
```
وفي `apps/admin-dashboard/src/app/admin/settings/backup/backup-client.tsx`:
- تحديث واجهة `BackupItem` لتسمح بـ `artifactsCount?: number | undefined` للتناغم التام مع عقد `BackupListItemDto`.

### 3.2 مرصد بناء الحاويات السيادي (Docker Build Telemetry Sentinel):
إنشاء أداة تشخيصية وحوكمية مخصصة في `tools/docker/docker-build-telemetry.ts`:
- **الوظيفة:** تشغيل ومراقبة بناء خدمات Docker بدقة عبر `BUILDKIT_PROGRESS=plain`.
- **القياس بالمللي ثانية:** حساب التوقيت الصافي لكل مرحلة:
  - مرحلة تجهيز التبعيات (`pnpm install`).
  - مرحلة توليد Prisma (`prisma db:generate`).
  - مرحلة بناء TypeScript المشترك (`tsc`).
  - مرحلة بناء Next.js الإنتاجي (`next build`).
- **التقاط الأخطاء التلقائي:** عند حدوث أي خطأ، تستخرج الأداة المقطع المسبب والسطر الدقيق وتصدر تقريراً فورياً ملوناً في الطرفية، مع حفظ السجل الجنائي في:
  `docs/ai-execution-evidence/docker-build-telemetry-latest.json`.
- **إضافة السكريبت في `package.json`:**
  `"docker:profile": "tsx tools/docker/docker-build-telemetry.ts"`.

### 3.3 تحسين وتسريع كاش بناء Next.js في `docker/Dockerfile.dashboard`:
- تفعيل كاش BuildKit لمجلد `.next/cache` عبر:
```dockerfile
RUN --mount=type=cache,id=nextjs-cache,target=/app/apps/admin-dashboard/.next/cache \
    pnpm --filter @alsaada/admin-dashboard... build
```
مما يقلص زمن بناء Next.js اللاحق من 51 ثانية إلى أقل من 10 ثوانٍ!

---

## الركيزة 4: مصفوفة بوابات الجودة (Quality Gates Matrix G1–G23)

| البوابة | المطلب | آلية التحقق |
| :--- | :--- | :--- |
| **Gate G1 (Type Safety)** | صفر أخطاء TypeScript عبر المنظومة ولوحة التحكم | `pnpm typecheck` بـ Exit Code 0 |
| **Gate G2 (Layer Separation)** | عزل كامل بين الخدمات ولوحات التحكم والموديولات | عدم وجود استيرادات مكسورة لـ `tools/` |
| **Gate G9 (Observability)** | تسجيل توثيق وأوقات البناء وأعطال الحاويات | صدور تقرير `docker-build-telemetry-latest.json` |
| **Gate G10 (Test Authenticity)** | اختبار انحدار حقيقي يفحص التوافق النمطي | اختبار `backup-settings-types.spec.ts` |
| **Gate G13 (Cryptographic Lock)** | قفل الكيانات المتأثرة بنظام SHA-256 | `pnpm lock:verify` بـ 366 كياناً محصناً |
| **Gate G15 (Git Hygiene)** | عزل كامل في فرع الحادثة دون مساس بالـ `main` | التحقق من `git status` و `git branch` |

---

## الركيزة 5: خطوات التنفيذ التفصيلية (Detailed Execution Steps)

- [ ] **المرحلة 1:** كتابة اختبار الانحدار الدائم في `apps/admin-dashboard/tests/backup-page-types.spec.ts` لإثبات التوافق النمطي.
- [ ] **المرحلة 2:** تعديل `page.tsx` و `backup-client.tsx` لمعالجة توافق `artifactsCount`.
- [ ] **المرحلة 3:** بناء `tools/docker/docker-build-telemetry.ts` وإضافة أمر `pnpm docker:profile` في `package.json`.
- [ ] **المرحلة 4:** تفعيل كاش `.next/cache` في `docker/Dockerfile.dashboard`.
- [ ] **المرحلة 5:** تشغيل البناء التجريبي للحاوية والتحقق الفيزيائي من اجتياز `pnpm --filter @alsaada/admin-dashboard build` و `docker build`.
- [ ] **المرحلة 6:** استكمال ملف الحادثة `docs/code-incidents/2026-09-24-incident-docker-dashboard-build.md` واجتياز `pnpm incident:verify`.
- [ ] **المرحلة 7:** إعادة القفل التلقائي للكيانات المتأثرة وتشغيل الفحص الجنائي السيادي `/saleh` و `/jev`.

---

## الركيزة 6: الضمانات الوقائية الدائمة (Permanent Regression Hardening)

1. **حظر التباين النمطي:** توحيد عقود DTO عبر اختبارات `apps/admin-dashboard/tests/` لضمان مطابقة الـ Props بنسبة 100%.
2. **مرصد التوقيت الدائم (`pnpm docker:profile`):** تمكين المطور والوكيل الذكي من معرفة مدة بناء كل حاوية بدقة واكتشاف أي بطء فور حدوثه.
3. **كاش BuildKit المستدام:** حفظ كاش Next.js في وحدة تخزين مؤمنة لحظر إعادة التجميع الكامل إلا عند تعديل التبعيات.
