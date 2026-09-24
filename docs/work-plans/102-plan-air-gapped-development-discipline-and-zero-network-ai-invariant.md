# خطة العمل 102: معيار التطوير المحلي المعزول شبكياً وإلزام وكلاء الذكاء الاصطناعي بالاعتمادية المحلية الصفرية (Work Plan 102)
## Work Plan 102: Sovereign Air-Gapped AI Development Standard & Zero-Network Dependency Invariant

> **الحالة:** 🟢 معتمدة وقيد التنفيذ في الفرع المعزول `plan/102-air-gapped-development-standard`  
> **المرجع الدستوري:** `GEMINI.md` (البنود 1، 3، 4، 7.1، 10) و `Rulebook 10` و `Rulebook 11` وبوابات الجودة (G1, G2, G6, G13, G15).  
> **الفرع المنعزل:** `plan/102-air-gapped-development-standard`  
> **تاريخ الإنشاء:** 2026-09-24  
> **الهدف الاستراتيجي:** القضاء الجذري على ظاهرة استنزاف الإنترنت وإعادة تنزيل الحزم من `npmjs.org` عند تعديل الكود بواسطة الوكلاء، وحظر إعادة بناء حاويات تطبيقات دوكر لأغراض التجربة، وتأسيس بيئة تطوير محلية فائقة السرعة معزولة شبكياً بنسبة 100% (Zero-Network Inner-Loop).

---

## 1. التوصيف الجنائي للمشكلة والتحليل الجذري (5 Whys RCA)
1. **المشكلة الميدانية:** قيام مدير الحزم `pnpm` بتنزيل مئات الميجابايت من الثنائيات المجمعة لأنظمة تشغيل ومعماريات غريبة (`darwin-x64`, `android-arm-eabi`, `linux-riscv64`, `openharmony-arm64`, `linux-musl`) بسرعة بطيئة عند إعادة بناء الحاويات أو تعديل الكود بواسطة وكلاء الذكاء الاصطناعي.
2. **لماذا يتم تنزيل حزم أنظمة غريبة؟**  
   لأن مكتبات الجيل الحديث (`Next.js SWC`, `Rolldown`, `Sharp`, `Rollup`) تدرج ملحقاتها الثنائية كـ `optionalDependencies`، وفي غياب قيد `supportedArchitectures` في `pnpm-workspace.yaml` يحاول `pnpm` استكشاف وحل حزم كافة الأنظمة لضمان توافق القفل.
3. **لماذا يتكرر هذا التحميل داخل الحاويات؟**  
   بسبب الخلط بين تشغيل خدمات البنية التحتية (`docker compose up -d postgres redis`) وبين إعادة بناء صور تطبيقات الـ Node.js (`docker compose build`)، إضافة إلى وجود راية `--no-cache` في السكريبت `"docker:bot"` داخل `package.json` والتي تدمر كاش الطبقات.
4. **لماذا يقوم وكلاء الذكاء الاصطناعي باستدعاء `npmjs` أثناء التطوير؟**  
   بسبب سلوكيات انعكاسية خاطئة (AI Anti-Patterns) حيث يلجأ الوكيل إلى تشغيل `pnpm install` عند حدوث خطأ استيراد أو يقوم ببناء صورة دوكر لتجربة وظيفة بدلاً من تشغيل اختبارات `vitest` الموجهة ومسار `pnpm dev:bot`.
5. **ما هو الحل الجذري المستدام؟**  
   تطبيق منظومة الردع السداسية التي تقيد المعماريات في `pnpm-workspace.yaml`، وتفرض وضع العمل المحلي في `.npmrc`، وتطهر سكريبتات `package.json`، وتشرع القاعدة الدستورية العاشرة في `Rulebook 10` و `GEMINI.md` مع فحص آلي في `.githooks/pre-commit`.

---

## 2. الأركان الستة الهندسية لمنظومة الانعزال الشبكي (The 6 Architectural Pillars)

### الركن الأول (Pillar 1): تقييد المعماريات المدعومة في `pnpm-workspace.yaml` (Scope & Supported Architectures)
- حصر المعماريات المدعومة في [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml) على نظامي التشغيل المستخدمين فعلياً في التطوير والحاويات (`win32` و `linux`) ومعمارية المعالج (`x64`):
  ```yaml
  supportedArchitectures:
    os:
      - win32
      - linux
    cpu:
      - x64
  ```
- يمنع هذا الإعداد نهائياً تحميل أي حزمة تخص `darwin` (Mac)، `android`، `openharmony`، أو `riscv64`.

### الركن الثاني (Pillar 2): درع الإعدادات المحلية الصارم في `.npmrc` (Data & Package Manager Contract)
- إنشاء ملف `.npmrc` في جذر المستودع لإجبار مدير الحزم على تفضيل المخزن المحلي وعدم الاتصال بالإنترنت طالما الحزم متوفرة:
  ```ini
  prefer-offline=true
  package-import-method=auto
  fetch-retries=2
  fetch-retry-maxtimeout=10000
  network-concurrency=8
  ```

### الركن الثالث (Pillar 3): تطهير وهندسة سكريبتات التشغيل في `package.json` (Developer & Agent Ergonomics)
- إزالة راية `--no-cache` المدمرة للكاش من السكريبت `"docker:bot"` في [`package.json`](../../package.json).
- إضافة سكريبت صريح للبنية التحتية `"docker:infra": "docker compose up -d postgres redis"` لتوضيح الفصل التام بين تشغيل قواعد البيانات الجاهزة وبناء التطبيقات الإنتاجية `"docker:bot:fresh"`.

### الركن الرابع (Pillar 4): التشريع الدستوري في `Rulebook 10` و `GEMINI.md` (Security & AI Discipline Invariant)
- إضافة **المبدأ العاشر (Zero-Network Development & Air-Gapped Local Invariant)** في [`.agents/rules/10-ai-agent-discipline-and-preflight.md`](../../.agents/rules/10-ai-agent-discipline-and-preflight.md) و [`GEMINI.md`](../../GEMINI.md).
- حظر أوامر `pnpm install`، `pnpm add`، `npm install`، و `docker compose build` أثناء مهام تطوير الميزات أو إصلاح الأعطال.

### الركن الخامس (Pillar 5): حارس عدم التلاعب بملف القفل في `.githooks/pre-commit` (Concurrency & Pre-Commit Guard)
- تحصين البوابة القبلية لمنع تمرير أي تعديل غير مصرح به على `pnpm-lock.yaml` في فروع الميزات (`feat/*`) أو فروع الإصلاح (`fix/*`).

### الركن السادس (Pillar 6): مصفوفة الاختبار والقبول الجنائي (Test Matrix & Acceptance Criteria)
- إنشاء جناح اختبارات آلي في `tools/governance/tests/air-gapped-development-invariant.spec.ts` للتحقق الدائم من:
  1. وجود `supportedArchitectures` في `pnpm-workspace.yaml` واقتصارها على `win32` و `linux` و `x64`.
  2. وجود `.npmrc` وتفعيل `prefer-offline=true`.
  3. خلو السكريبت الافتراضي `"docker:bot"` في `package.json` من راية `--no-cache`.
  4. توثيق المبدأ العاشر في `Rulebook 10` و `GEMINI.md`.
