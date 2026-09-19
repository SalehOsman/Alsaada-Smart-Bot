# تقرير الترقية الجنائية رقم: UPG-[NUMBER] — [COMPONENT_NAME]
## Enterprise Upgrade Execution & Verification Evidence

- **التاريخ:** YYYY-MM-DD
- **المكون المستهدف:** [e.g. Prisma ORM / GrammY / @alsaada/core-components]
- **نوع الترقية:** [Patch / Minor / Major / Core Shared Kernel]
- **رقم خطة العمل:** Plan-[NUMBER]
- **الفرع المخصص:** chore/upgrade-[SLUG]
- **معرف لقطة الارتداد:** `snap_[TIMESTAMP]`
- **أمر الارتداد للطوارئ:** `tsx tools/upgrade/rollback-manager.ts rollback --snapshot snap_[TIMESTAMP]`

---

### 1️⃣ نتائج رادار فحص الأثر (Blast Radius & Flow Impact)
- **إجمالي الملفات المفحوصة:** [X] ملف
- **عدد التدفقات المتأثرة مباشرة:** [Y] تدفق
- **قائمة المكونات الأكثر حساسية:**
  - `modules/...`: [Description of usage]
  - `apps/...`: [Description of usage]

---

### 2️⃣ بوابات الجودة الرباعية واجتياز الفحص (Quality Gates)
| البوابة | الأمر المنفذ | النتيجة | زمن الاستجابة |
| :--- | :--- | :---: | :---: |
| **Tier 1: Types** | `pnpm typecheck` | ✅ PASS | Xs |
| **Tier 2: Release Parity** | `pnpm release:verify` | ✅ PASS | Xs |
| **Tier 3: Tamper Check** | `pnpm governance:tamper-check` | ✅ PASS | Xs |
| **Tier 4: Architecture** | `pnpm arch:verify && pnpm flow-contracts:verify` | ✅ PASS | Xs |
| **Simulated CI** | `pnpm ci:simulate` | ✅ PASS | Xs |
| **Code Review** | `ocr review --concurrency 2` | ✅ PASS | Xs |

---

### 3️⃣ اعتماد القفل التشفيري والدمج (Sealing & Merge)
- **بصمة SHA-256 للملفات المعدلة:** مسجلة ومحصنة في `governance.lock.json`.
- **صيغة القفل المعتمدة:** «نعم اقفل»
- **صيغة الدمج المعتمدة:** «ادمج الفرع»
- **وسم Git Tag الناتج:** `v2.0.0-alpha.[PLAN]`
