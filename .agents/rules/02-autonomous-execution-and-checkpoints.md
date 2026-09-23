# Domain Rulebook 02: Autonomous Execution, Scoped Zones & Checkpoints

> **Authority:** Derived from [`GEMINI.md`](../../GEMINI.md) Part 3.  
> **Status:** Mandatory Operational Standard.

---

## 1. Zone-Based Scoped Autonomy

To maximize autonomous velocity while guaranteeing absolute system safety, all agent operations are divided into distinct autonomy zones:

### 1.1 Autonomous Zone (No Prior Approval Needed)
Agents are fully authorized to execute autonomously within the active task branch:
- Reading files, inspecting directory structures, and analyzing ASTs.
- Writing, refactoring, and fixing code within the designated vertical slice or package.
- Creating test suites, running unit tests, and executing typechecks.
- Formatting code (`prettier`, `pnpm preflight:fix`) and running linters.
- Consulting RAG indices, searching project documentation, and reading topology maps.

### 1.2 Restricted Zone (Explicit Human Confirmation Required)
The following operations require explicit, untranslated Arabic user confirmation:
- Merging branches to `main`: requires verbatim formula **«ادمج الفرع»**.
- Locking components cryptographically: requires verbatim formula **«نعم اقفل»**.
- Unlocking locked components: requires dynamic OTP Challenge-Response protocol via `pnpm unlock:request` and chat approval **«موافق على الفتح <UNLOCK-XXXXXX>»** followed by `pnpm unlock:confirm`.
- Modifying locked files, schemas, or master governance: requires verbatim formula **«موافق على التعديل او الايقاف او الحذف»**.
- Modifying source code after test failure (RCA): requires verbatim formula **«موافق على تعديل الكود المصدري»**.

### 1.3 Strict Prohibition of Self-Authorization & Pre-Touch Encroachment
- **No Self-Generated Approval:** Agents cannot bypass the restricted zone by passing CLI flags (`--phrase`), simulating OTP codes, or injecting approval tokens into generated Markdown files.
- **Pre-Touch Encroachment Prohibition:** Modifying a locked file before obtaining the verified unlock via `pnpm unlock:confirm` is strictly prohibited. Any pre-touch modification violates the Zero Blast Radius policy.

---

## 2. Command Execution Whitelist & Destructive Blacklist

### 2.1 Safe Command Whitelist
Agents may freely execute:
- `git status`, `git diff`, `git log`
- `pnpm typecheck`, `pnpm test`, `pnpm test:flow`, `pnpm test:pre-commit`
- `pnpm arch:verify`, `pnpm flow:check`, `pnpm migration:verify`
- `pnpm preflight:fix`, `pnpm format`
- `pnpm tsx tools/*`, `pnpm tsx scripts/*`
- `ocr review --concurrency 2`

### 2.2 Destructive Command Blacklist (Strictly Prohibited)
Agents are **strictly forbidden** from proposing or executing:
- `git reset --hard` (destructive loss of uncommitted work)
- `git clean -f` (destructive deletion of untracked files)
- `rm -rf` / recursive filesystem deletion outside scratch dirs
- Dropping production or local databases outside the isolated test database (`alsaada_test_db`)
- Modifying files outside the current slice boundary (violating Zero Blast Radius)

---

## 3. Autonomous Checkpoint Discipline

1. **Self-Contained Work Units:** Plan changes in cohesive, self-verifying checkpoints.
2. **Pre-Commit Verification:** Always execute local typechecks and targeted tests before staging.
3. **No Guesswork Principle:** If requirements, edge cases, or accounting models are underspecified, stop immediately and ask for clarification rather than making assumptions.
4. **Mandatory AI Auto Re-Lock & Verbal Confirmation (إلزامية القفل التلقائي والتأكيد النصي):**
   - After completing edits on any unlocked entity, the agent MUST automatically re-lock the entity (`pnpm lock <target>` or `pnpm lock:all`) before requesting branch merge with «ادمج الفرع» or concluding the session.
   - The agent MUST explicitly include the verbatim confirmation in its final message:
     > **«تم قفل الوظيفة [اسم/معرف الوظيفة]»** (e.g., `✅ تم قفل الوظيفة flow:01.1` or `✅ تم قفل الشاشة dashboard:workforce/clearances`).
   - Leaving any modified entity unsealed prior to merge is a fatal governance violation (`Exit 1`).

---

## 4. الإلزام القطعي بالمسارات التشغيلية الثلاثة (The Tri-Lifecycle Invariant — WP 94)

يُحظر حظراً باتاً على أي وكيل ذكاء اصطناعي أو أداة برمجية الشروع في أي مهمة إلا بعد تصنيفها الصارم والالتزام الكامل بمراحلها وفق ميثاق **خطة العمل 94**:
1. **مسار التعديل البرمجي ([`Rulebook 11`](11-modification-lifecycle-standard.md)):** صياغة الخطة مسبقاً، فك القفل المشفر برمز OTP المؤقت، التطوير بـ TDD، الفحص والتحقق، إعادة القفل التلقائي فوراً، تسليم البطاقات الخمس في الشات، والدمج بصيغة «ادمج الفرع».
2. **مسار الإنشاء الجديد ([`Rulebook 12`](12-creation-lifecycle-standard.md)):** صياغة المواصفة السداسية واعتمادها، التوليد الهيكلي الآلي عبر `pnpm make:flow` لشريحة الـ 10 ملفات، التطوير المنضبط وعقود Zod، القفل التشفيري الأولي في `governance.lock.json`، توثيق سجل الترحيل `docs/19`، وتسليم البطاقات الخمس في الشات، والدمج بصيغة «ادمج الفرع».
3. **مسار إصلاح الأعطال والتحقيق الجنائي ([`Rulebook 08`](08-code-defect-and-regression-postmortem.md) / WP 93):** تجميد الكود فوراً عند فشل الاختبارات (حظر الترقيع الفوري)، فتح فرع الحادثة المنعزل `fix/inc-*`، تحرير الملف الجنائي المسبق في `docs/code-incidents/`، اعتماد الخطة بصيغة «موافق على خطة الإصلاح»، كتابة اختبار تراجع دائم (Permanent Regression Test)، اجتياز الفحص الآلي `pnpm incident:verify` و `pnpm test:incidents`، وإصدار بطاقة الإقرار الجنائي الإلزامية.
- **عقوبة المخالفة:** يُسقط عمل الوكيل فوراً بحكم `[REJECT]` قطعي من `/saleh`، وتُبطل أي تعديلات تمت خارج هذه المسارات.
