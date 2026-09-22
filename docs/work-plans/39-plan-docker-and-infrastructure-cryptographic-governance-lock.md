# خطة العمل 39 (النسخة المنقحة والمعتمدة): نظام القفل التشفيري الشامل للبنية التحتية والدوكر (Enterprise Docker & Infrastructure Cryptographic Governance Lock)

بناءً على جلسة الاستجواب المعمارية الحصرية (`/grill-me`) والمراجعة النقدية الصارمة لمسودة التصميم، تهدف هذه الخطة المعتمدة إلى إرساء منظومة حوكمة تشفيرية متكاملة لبيئة الحاويات والبنية التحتية في المشروع، وتطبيق ذات المنهجية المؤسسية الصارمة المعتمدة في تدفقات البوت (`Flows`) وشاشات لوحة التحكم (`Dashboard Features`) لحماية كافة ملفات تكوين وبناء الحاويات من أي تعديل عرضي أو غير مصرح به بنسبة 100%.

> [!WARNING]
> ⚠️ **إشعار إلغاء سيادي (Deprecation Notice):** تم إلغاء وسحب علم `--phrase` نهائياً واستبداله ببروتوكول التحدي والاستجابة المتغير (Dynamic OTP Nonce Challenge-Response Protocol) وفق خطة العمل السيادية رقم 90 (WP-90). لا يجوز لأي وكيل استخدام هذا العلم برمجياً أو تمرير عبارات الفتح عبر أسطر الأوامر، والمسار الوحيد المعتمد هو: `pnpm unlock:request <target>` ثم موافقة المستخدم المباشرة في الشات برمز التحدي ثم `pnpm unlock:confirm <target>`.

---

## 🏛️ قرارات التصميم والمعمارية المعتمدة (Architectural Design & Consensus)

1. **القسم المستقل للبنية التحتية والدوكر (`lockedDocker`):**
   - إضافة قسم مخصص ومستقل `lockedDocker` في وثيقة القفل المركزية [`governance.lock.json`](file:///f:/Alsaada-Smart-Bot/governance.lock.json).
   - يتم عزل هذا القسم عن أمر القفل العام `pnpm governance:lock` لضمان عدم إعادة حساب بصمات الدوكر تلقائياً دون أمر صريح (`pnpm docker:lock`)، مما يضمن الحصانة التامة.
   - يتضمن القسم:
     * تاريخ ووقت الختم التشفيري بالـ ISO (`lockedAt`).
     * مسار المجلد الأساسي (`directory: "docker"`).
     * مصفوفة البصمات التشفيرية (`files: [{ path, sha256 }]`).

2. **النطاق الشامل لملفات الحاويات (Comprehensive Containerization Scope):**
   - **ملفات التركيب والتشغيل:** [`docker-compose.yml`](file:///f:/Alsaada-Smart-Bot/docker-compose.yml) وأي ملفات Compose مرافقة.
   - **ملف التجاهل المعماري للبناء:** [`.dockerignore`](file:///f:/Alsaada-Smart-Bot/.dockerignore) (مُهندس خصيصاً لمشاريع pnpm Monorepo لضمان تسريع البناء وحجب البيانات الحساسة كـ `.git`, `.env*`, `node_modules`, `dist`, `.next`, وقواعد البيانات المحلية).
   - **مجلد [`docker/`](file:///f:/Alsaada-Smart-Bot/docker) بالكامل مع حماية مسارات البيانات:**
     * [`docker/Dockerfile`](file:///f:/Alsaada-Smart-Bot/docker/Dockerfile) (حاوية البوت، وسيرفر Hono، و Studio).
     * [`docker/Dockerfile.dashboard`](file:///f:/Alsaada-Smart-Bot/docker/Dockerfile.dashboard) (حاوية لوحة التحكم Next.js 15).
     * [`docker/postgres/init-scripts/01-init-security.sql`](file:///f:/Alsaada-Smart-Bot/docker/postgres/init-scripts/01-init-security.sql) وسائر سكريبتات تهيئة قواعد البيانات.
     * استثناء مجلدات البيانات المحلية أو ملفات السجلات المؤقتة (`docker/**/data/`, `*.log`, `*.tmp`) من حساب البصمات لتفادي التلوث البرمجي.

3. **أوامر سطر الأوامر المخصصة (Dedicated CLI Suite):**
   - **القفل والختم:**
     * `pnpm docker:lock` (أو `pnpm docker:finish` كـ alias مطابق لمنهجية البوت والداشبورد).
     * يقوم بفحص وتطبيع المسارات (POSIX standard `/`)، وحساب بصمات تجزئة `SHA-256`، وختمها في `governance.lock.json`، وطباعة بطاقة تأكيد تشفيرية رسمية.
   - **فك القفل المرخص:**
     * `pnpm docker:unlock --phrase="<عبارة_الموافقة>" --reason="<سبب_مفصل_أكثر_من_10_أحرف>"`
     * التحقق الحرفي الصارم من العبارات الدستورية المعتمدة في `AGENTS.md`:
       - **«نعم موافق على التعديل»**
       - **«موافق على الفتح»**
       - **«موافق على التعديل او الايقاف او الحذف»**
     * توليد وثيقة ترخيص رسمية فوراً في `docs/ai-execution-evidence/YYYY-MM-DD-unlock-docker.md`.
     * رفع القفل من `governance.lock.json` مؤقتاً لتمكين المطور من العمل.

4. **صمام الأمان ثلاثي الأبعاد (3D Hard-Fail Tamper Guard):**
   - فحص سلامة البصمات لكافة الملفات المسجلة ومنع تعديل أي بايت (Zero Content Tampering).
   - كشف ومنع حذف أي ملف مسجل (Zero File Deletion).
   - كشف ومنع إضافة أي ملف غير مسجل داخل مجلد `docker/` أو ملفات الكومبوز دون ترخيص (Zero Rogue Files).
   - الحظر والإيقاف الفوري في خطاف Git pre-commit وفحص `pnpm governance:tamper-check` بـ `Exit 1` في حال وجود أي انتهاك دون وثيقة ترخيص معتمدة.

5. **بروتوكول القفل الدستوري والاستئذان الإلزامي (Governance Protocol Alignment):**
   - التزام الوكيل التام بنص البند 1.6 في `AGENTS.md`:
     فور الانتهاء من أي عمل على الدوكر، يُحظر القفل التلقائي، ويلتزم الوكيل بطلب الإذن نصاً:
     > «تم الانتهاء بنجاح من بناء وتحديث ملفات دوكر والبنية التحتية. هل نقفل ونحمي ملفات دوكر تشفيرياً ضد أي تعديل؟  
     > **لإتمام القفل والحماية، يرجى الرد بالصيغة المعتمدة حصراً:**  
     > **«نعم اقفل»**»

---

## 🛠️ تفاصيل التعديلات البرمجية التفصيلية (Proposed Changes)

### 1. إعدادات بيئة الحاويات والتكامل المعماري
- `[NEW]` [`.dockerignore`](file:///f:/Alsaada-Smart-Bot/.dockerignore):
  * استثناء دقيق وشامل لـ:
    - `.git`, `.github`, `.githooks`
    - `node_modules`, `.pnpm-store`
    - `.env`, `.env.local`, `.env.*.local`
    - `dist`, `.next`, `build`, `out`
    - `*.log`, `npm-debug.log*`, `pnpm-debug.log*`
    - `docs/ai-execution-evidence/`
    - `tests/`, `**/*.spec.ts`, `**/*.test.ts`
    - `.vitest`, `coverage`

### 2. محركات وأدوات الحوكمة التشفيرية (`tools/governance/`)
- `[MODIFY]` [`tools/governance/verify-governance-lock.ts`](file:///f:/Alsaada-Smart-Bot/tools/governance/verify-governance-lock.ts):
  * إضافة واجهة `LockedDockerEntry`:
    ```typescript
    export interface LockedDockerEntry {
      directory: string;
      lockedAt: string;
      files: GovernanceLockFileEntry[];
    }
    ```
  * ربط `lockedDocker?: LockedDockerEntry` في واجهة `GovernanceLock`.
  * إضافة دالة `lockDockerEntry(root: string): GovernanceLock`.
  * إضافة دالة `unlockDockerEntry(root: string): { ok: boolean; error?: string }`.
  * استثناء ملفات البيانات المحلية (`/data/`, `*.log`) عند مسح مجلد `docker/`.
  * تدقيق بصمات `lockedDocker` داخل `verifyGovernanceLock()`.
- `[MODIFY]` [`tools/governance/verify-governance-tamper.ts`](file:///f:/Alsaada-Smart-Bot/tools/governance/verify-governance-tamper.ts):
  * تحديث دالة `isProtectedGovernancePath()` لتشمل `docker-compose.yml` و `.dockerignore` ومجلد `docker/` عند تفعيل القفل.
  * فحص العبث ثلاثي الأبعاد لملفات الدوكر (تعديل / حذف / إضافة ملفات جديدة).
  * ربط تجاوز الفحص بوجود وثيقة ترخيص صريحة في `docs/ai-execution-evidence/`.

### 3. أدوات سطر الأوامر للقفل والترخيص (`tools/scaffold/`)
- `[NEW]` [`tools/scaffold/finish-docker.ts`](file:///f:/Alsaada-Smart-Bot/tools/scaffold/finish-docker.ts):
  * أداة تنفيذية للأمر `pnpm docker:lock` / `pnpm docker:finish` تقوم بحساب البصمات، تحديث `governance.lock.json`، وعرض بطاقة الإغلاق التشفيري.
- `[MODIFY]` [`tools/scaffold/unlock-feature.ts`](file:///f:/Alsaada-Smart-Bot/tools/scaffold/unlock-feature.ts):
  * دعم نوع `'docker'` دون اشتراط إدخال معرّف عشوائي (`targetKey` اختياري أو افتراضي `'docker'`).
  * التحقق الصارم من العبارة الحرفية والمبرر.
  * توليد ملف الترخيص الرسمي `docs/ai-execution-evidence/YYYY-MM-DD-unlock-docker.md`.
  * استدعاء `unlockDockerEntry(root)`.

### 4. إعدادات المشروع (`package.json`)
- `[MODIFY]` [`package.json`](file:///f:/Alsaada-Smart-Bot/package.json):
  * إضافة أوامر:
    ```json
    "docker:lock": "tsx tools/scaffold/finish-docker.ts",
    "docker:finish": "tsx tools/scaffold/finish-docker.ts",
    "docker:unlock": "tsx tools/scaffold/unlock-feature.ts docker",
    ```

### 5. الاختبارات الآلية الشاملة (`tools/governance/tests/`)
- `[NEW]` [`tools/governance/tests/docker-governance-lock.spec.ts`](file:///f:/Alsaada-Smart-Bot/tools/governance/tests/docker-governance-lock.spec.ts):
  * اختبار قفل الدوكر وحساب بصمات `SHA-256` وتطبيع المسارات.
  * اختبار اجتياز الفحص عند المطابقة التامة.
  * اختبار كشف التعديل الطفيف واعتراضه فوراً (Hard-Fail).
  * اختبار كشف حذف ملف مقفول واعتراضه.
  * اختبار كشف إضافة ملف جديد عشوائي في مجلد دوكر واعتراضه.
  * اختبار رفض فك القفل بالعبارات المبهمة أو المبررات القصيرة.
  * اختبار نجاح فك القفل بالعبارة المعتمدة وتوليد ملف الإثبات.
  * اختبار إعادة الختم بنجاح.

### 6. ميثاق الحوكمة ومستندات المشروع
- `[MODIFY]` [`AGENTS.md`](file:///f:/Alsaada-Smart-Bot/AGENTS.md): توثيق بروتوكول حماية دوكر، أوامر `docker:lock` و `docker:unlock`، وصيغة الموافقة المعتمدة.
- `[MODIFY]` [`GEMINI.md`](file:///f:/Alsaada-Smart-Bot/GEMINI.md): المزامنة الحرفية الصارمة.
- `[MODIFY]` [`docs/work-plans/README.md`](file:///f:/Alsaada-Smart-Bot/docs/work-plans/README.md): توثيق اعتماد الخطة 39.

---

## 🧪 خطة الاختبار والتحقق الشاملة (Comprehensive Verification Plan)

1. **الاختبارات الآلية (Automated Vitest Suite):**
   - تشغيل اختبارات قفل الدوكر المستحدثة:
     ```bash
     pnpm vitest run tools/governance/tests/docker-governance-lock.spec.ts
     ```
   - تشغيل كافة اختبارات الحوكمة للمشروع لضمان Zero-Regression:
     ```bash
     pnpm vitest run tools/governance/tests/
     ```
2. **فحص التحقق التكاملي وسيناريوهات الاختراق (Integration & Tamper Simulation):**
   - **الختم الأولي:** تنفيذ `pnpm docker:lock` وفحص `governance.lock.json`.
   - **فحص النزاهة:** تنفيذ `pnpm governance:tamper-check` (يجب أن يعطي PASS 100%).
   - **محاكاة الاختراق (Tamper Test):**
     * تعديل سطر في `docker-compose.yml` ومحاولة تشغيل `pnpm governance:tamper-check` -> التأكد من الرفض الفوري بـ FAIL و Exit 1.
     * التراجع عن التعديل.
   - **محاكاة فك القفل المصرح به (Authorized Unlock):**
     * تنفيذ `pnpm docker:unlock --phrase="موافق على الفتح" --reason="اختبار تشغيلي دوري لترخيص تعديل بيئة الحاويات"`.
     * التحقق من إنشاء ملف الإثبات في `docs/ai-execution-evidence/`.
     * التحقق من نجاح فحص `pnpm governance:tamper-check` بوجود الترخيص.
   - **إعادة الختم النهائي:**
     * تنفيذ `pnpm docker:finish` والتأكد من تحديث البصمات.
   - **بوابة الالتزام الشاملة:**
     * تشغيل `pnpm governance:verify` بالكامل للتأكد من خروج كافة الفواحص بـ Exit 0.
