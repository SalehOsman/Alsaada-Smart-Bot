# خطة العمل 87 — جلسة علاج الاختبارات الشاملة والامتثال الدستوري
## WP-87: Enterprise Test Remediation, Constitution Compliance & Documentation Reconciliation

## الهدف
إصلاح **184 ملف اختبار مخالف** (183 مخالف + 1 UNVERIFIABLE) من أصل 235 ملفاً ليمتثل بالكامل لدستور جودة الاختبارات الثماني القواعد (`.agents/rules/test-quality-constitution.md`)، مع تشغيل يدوي لكل ملف بعد الإصلاح، وتحديث التوثيقات بعد كل ملف.

---

## المرجعيات الحاكمة

| الوثيقة | الغرض |
|:---|:---|
| `.agents/rules/test-quality-constitution.md` | الدستور الحاكم — 8 قواعد إلزامية |
| `docs/28-master-tests-physical-reality-and-compliance-ledger.md` | السجل المرجعي الشامل — 235 ملف بأعمدة 10 |
| `docs/ai-execution-evidence/2026-09-20-tests-inventory.md` | جرد الاختبارات |
| `docs/ai-execution-evidence/2026-09-20-test-quality-constitution-audit.md` | تقرير التدقيق الجنائي |

---

## القرارات المتفق عليها (Grill-Me Interview — 20/09/2026)

| القرار | الاختيار المعتمد |
|:---|:---|
| **أولوية البدء** | Tier 1 — Critical أولاً ثم Tier 2 ثم Tier 3 ثم Tier 4 |
| **أول ملف** | `packages/rbac/tests/rbac.spec.ts` (#210) |
| **خطة العمل** | خطة واحدة شاملة لكافة الـ 235 ملف |
| **فرع Git** | فرع واحد: `plan/wp-87-test-remediation` |
| **نطاق التعديل** | ملفات الاختبار حصراً (يُحظر لمس الكود المصدري إلا بعد تقرير RCA الخماسي وموافقة حرفية صريحة) |
| **دورة كل ملف** | تعديل هيكل الاختبار بواسطة الوكيل → إرسال بطاقة التسليم ورابط الملف وأمر الترمينال للمستخدم → تشغيل يدوي بواسطة المستخدم حصراً → استلام التأكيد → (إن وُجد عيب مصدري: توقف فوري وتقرير خماسي + طلب إذن «موافق على تعديل الكود المصدري») → توثيق Doc 28 + Audit → التالي |

---

## سجل التنفيذ والإنجاز (Execution Log)

### ✅ المرحلة 1: Tier 1 — Critical Blockers (4 ملفات)

#### 1.1 ✅ `packages/rbac/tests/rbac.spec.ts` (#210) — مكتمل 20/09/2026
- **المخالفات المكتشفة:** R1 (توكيد واحد L19) + R5 (`Date.now()` L185) + R2 (سلوكان مكدسان L174) + R1 (غياب `reason` في مسارات الرفض) + R7 (نقص Edge Case)
- **الإصلاحات المنفذة:**
  1. [R1] أُضيف `expect(CANONICAL_ROLES).toHaveLength(7)` للاختبار 1.1
  2. [R5] أُثبت الوقت بـ `vi.useFakeTimers()` + `vi.setSystemTime(PINNED_DATE)` + `vi.useRealTimers()` في beforeEach/afterEach
  3. [R5] استُبدل `Date.now()` بـ `PINNED_DATE.getTime()`
  4. [R2] فُصل اختبار `inactive/expired` إلى اختبارين منفصلين: `deactivated` + `expired past end date`
  5. [R1] أُضيفت توكيدات `reason` لكافة مسارات الرفض
  6. [R7] أُضيف Edge Case لمصفوفة تفويضات فارغة `delegations: []`
- **النتيجة:** 19/19 اختبار ناجح — 21ms
- **الحكم الدستوري:** 🟢 مطابق 100%

#### 1.2 ✅ `tools/governance/tests/docker-governance-lock.spec.ts` (#221) — مكتمل 20/09/2026
- **المخالفات المكتشفة:** R5 (استخدام `Date.now()` و `Math.random()` L33) + R1 (توكيد وحيد في L184) + R1 (توكيدات صامتة داخل شرط `if` في L170) + R3 (أسماء الاختبارات لا تصف السلوك والشرط والنتيجة بدقة)
- **الإصلاحات المنفذة:**
  1. [R5] استُبدل `Date.now()` و `Math.random()` بعداد تسلسلي حتمي `fixtureSequence` مع تنظيف مسبق `rmSync(root, { recursive: true, force: true })`.
  2. [R1] أُزيل الشرط الصامت في فحص تشفير الدوكر واستُبدل بتوكيدين صريحين إلزاميين: `expect(existsSync(lockPath)).toBe(true)` و `expect(existsSync(composePath)).toBe(true)`.
  3. [R1] أُضيفت توكيدات نوعية مفيدة لفحص التلاعب بالمستودع: `expect(result.failures).toHaveLength(0)` و `expect(result.checked).toBeGreaterThan(0)` ليصبح المجموع 3 توكيدات.
  4. [R3] أُعيدت تسمية كافة الاختبارات الـ 8 لتصف السلوك والشرط والنتيجة المتوقعة بدقة وفق دستور الاختبارات.
  5. [R2] تنظيم الاختبارات بتعليقات Triple-A صريحة (`// Arrange`, `// Act`, `// Assert`).
- **النتيجة:** 8/8 اختبار ناجح — 3.55s
- **الحكم الدستوري:** 🟢 مطابق 100%

#### 1.3 ✅ `apps/docs/tests/docs-portal.spec.ts` (#60) — مكتمل ومراجع 20/09/2026
- **المخالفات المكتشفة:** R6 (بناء Astro كامل داخل ملف الـ spec) + R4 (مهلة مفرطة 360,000ms تتجاوز الـ SLA) + R2 (غياب وسوم Triple-A الصريحة ودمج فحص التكوين مع الـ Dist في اختبار واحد) + R3 (بدء كافة أسماء الاختبارات بـ `should`) + R1 (توكيدات صامتة داخل شرط `if (distExists)` وتوكيدات سطحية للودجت)
- **الإصلاحات المنفذة:**
  1. [R6] استئصال عملية البناء الثقيلة `await build({ root: ... })` واستيراد Astro من داخل الاختبار، واستبدالها باختبارين معزولين: الأول لعقد تكوين البناء وسكربتات `package.json` وتكامل Starlight، والثاني لفحص مخرجات الـ Dist وفهرس Pagefind بعمق (أحجام الملفات ووسوم HTML).
  2. [R4] إزالة المهلة المفرطة 360,000ms بالكامل ليعمل الاختبار ضمن المهلة القياسية للدستور بمعدل تنفيذ 2.47 ثانية لكامل الجناح (خفضا من 128.87 ثانية).
  3. [R2] تنظيم كافة الاختبارات الـ 11 بهيكل Triple-A صريح مع وسوم `// Arrange` و `// Act` و `// Assert`، وفصل فحص عقد التكوين عن فحص مخرجات الـ Dist كاختبارين مستقلين.
  4. [R3] إعادة صياغة جميع أسماء الاختبارات لتكون إخبارية وصفية دقيقة (السلوك والشرط والنتيجة) واستئصال بادئات `should`.
  5. [R7 & R1] إضافة تغطية كاملة للمسارات الاستراتيجية الستة وأزرار الـ Hero في صفحة البداية، وتوكيدات رياضية دقيقة لودجت رادار الترحيل (نسبة الإنجاز 2% والعدادات)، وتوكيدات سلبية مانعة لتسريب المتغيرات أو الرموز الخام، مع رفع عدد التوكيدات لتتجاوز 240 توكيداً عبر الملف.
- **النتيجة:** 11/11 اختبار ناجح — 2.47s
- **الحكم الدستوري:** 🟢 مطابق 100%

#### 1.4 ✅ `packages/database/tests/hash-chain.stress.spec.ts` (#197) — مكتمل ومقفل تشفيرياً 20/09/2026
- **المخالفات المكتشفة:** حالة `🔴 غير قابل للتحقق المادي (UNVERIFIABLE)` بسبب الاعتماد على محاكاة بالذاكرة واصطناع طابور وعود دون اتصال بقاعدة بيانات حقيقية + R5 (استخدام `Math.random()` غير المهيأ ببذرة في تأخير المحاكاة L69) + R1 (توكيد وحيد في اختبار 1.11 وغياب التوكيدات السلبية المانعة) + R2 (غياب وسوم Triple-A الصريحة) + R3 (أسماء الاختبارات بصيغ عامة وغير دقيقة).
- **الإصلاحات المنفذة:**
  1. **الواقعية المادية (Physical Reality Integration):** إضافة Suite 4 المتصلة بـ PostgreSQL الحيّة (`alsaada_test_db`) مع اختبارات استمرارية السجلات التشفيرية، فحص السلسلة عبر `verifyLedgerChainDb`، واختبار كشف التلاعب المادي المباشر بتعديل SQL خارج النطاق مع استعادة النظافة التامة في `afterAll`.
  2. [R5] استئصال كامل لـ `Math.random()` واستبداله بتأخير تسلسلي حتمي، وتثبيت التواريخ الحتمية.
  3. [R1] ترقية كافة الاختبارات الـ 28 بتوكيدات نوعية وسلبية مانعة مع فحص صيغ الهاش والـ HMAC وعدم تسريب `undefined`.
  4. [R2] تنظيم الاختبارات الـ 28 بهيكل Triple-A صريح (`// Arrange`, `// Act`, `// Assert`).
  5. [R3] إعادة صياغة كافة أسماء الاختبارات لتكون إخبارية حاسمة تصف (السلوك والشرط والنتيجة) بدقة دستورية.
- **النتيجة:** 28/28 اختبار ناجح — 4.37s
- **الحكم الدستوري:** 🟢 مطابق 100% ومقفل تشفيرياً بـ SHA-256 (`test:packages/database/tests/hash-chain.stress.spec.ts`)

---

> [!NOTE]
> **إغلاق المرحلة الأولى (Tier 1):** تم الانتهاء بنجاح من كافة ملفات Tier 1 الحرجة (4 من أصل 4 ملفات: #210، #221، #60، #197) ومطابقتها التامة لدستور الاختبارات وقفلها تشفيرياً في `governance.lock.json`.

### 🟡 المرحلة 2: Tier 2 — High (146 ملف) — قيد التنفيذ (الدفعة الأولى مكتملة 12/12)

#### 2.1 ✅ الدفعة الأولى (Batch 1: 12 ملفاً في `apps/admin-dashboard`) — 🟢 مكتملة ومقفلة تشفيرياً 21/09/2026
تم بحمد الله ترقية واعتماد وإغلاق الـ 12 ملفاً الأولى من Tier 2 في لوحة التحكم الإدارية وفق دستور الاختبارات ([`.agents/rules/06-testing-and-mutation-constitution.md`](file:///f:/Alsaada-Smart-Bot/.agents/rules/06-testing-and-mutation-constitution.md)) بنجاح 100% وبدون أي مساس بكود الإنتاج (Rule 9):

1. **`apps/admin-dashboard/tests/adversarial-route-role-session.spec.ts` (#1):** 🟢 20/20 نجاح (39ms) — مقفل تشفيرياً بـ SHA-256 (`test:apps/admin-dashboard/tests/adversarial-route-role-session.spec.ts`).
2. **`apps/admin-dashboard/tests/auth-claim-concurrency.spec.ts` (#3):** 🟢 4/4 نجاح (557ms) — مقفل تشفيرياً بـ SHA-256 (`test:apps/admin-dashboard/tests/auth-claim-concurrency.spec.ts`).
3. **`apps/admin-dashboard/tests/auth-claim.spec.ts` (#4):** 🟢 18/18 نجاح (1.43s) — مقفل تشفيرياً بـ SHA-256 (`test:apps/admin-dashboard/tests/auth-claim.spec.ts`).
4. **`apps/admin-dashboard/tests/auth-session.spec.ts` (#5):** 🟢 9/9 نجاح (54ms) — مقفل تشفيرياً بـ SHA-256 (`test:apps/admin-dashboard/tests/auth-session.spec.ts`).
5. **`apps/admin-dashboard/tests/bot-features-tree-and-telegram-unification.spec.ts` (#6):** 🟢 15/15 نجاح (24ms) — مقفل تشفيرياً بـ SHA-256 (`test:apps/admin-dashboard/tests/bot-features-tree-and-telegram-unification.spec.ts`).
6. **`apps/admin-dashboard/tests/dashboard-auth-ast.spec.ts` (#7):** 🟢 8/8 نجاح (570ms) — مقفل تشفيرياً بـ SHA-256 (`test:apps/admin-dashboard/tests/dashboard-auth-ast.spec.ts`).
7. **`apps/admin-dashboard/tests/dashboard-auth-r1-remediation.spec.ts` (#8):** 🟢 9/9 نجاح (783ms) — مقفل تشفيرياً بـ SHA-256 (`test:apps/admin-dashboard/tests/dashboard-auth-r1-remediation.spec.ts`).
8. **`apps/admin-dashboard/tests/dashboard-intelligence.spec.ts` (#9):** 🟢 7/7 نجاح (29ms) — مقفل تشفيرياً بـ SHA-256 (`test:apps/admin-dashboard/tests/dashboard-intelligence.spec.ts`).
9. **`apps/admin-dashboard/tests/dashboard-preferences.spec.ts` (#10):** 🟢 19/19 نجاح (56ms) — مقفل تشفيرياً بـ SHA-256 (`test:apps/admin-dashboard/tests/dashboard-preferences.spec.ts`).
10. **`apps/admin-dashboard/tests/data-fetchers.spec.ts` (#11):** 🟢 36/36 نجاح (104ms) — مقفل تشفيرياً بـ SHA-256 (`test:apps/admin-dashboard/tests/data-fetchers.spec.ts`).
11. **`apps/admin-dashboard/tests/error-boundaries.spec.ts` (#13):** 🟢 10/10 نجاح (28ms) — مقفل تشفيرياً بـ SHA-256 (`test:apps/admin-dashboard/tests/error-boundaries.spec.ts`).
12. **`apps/admin-dashboard/tests/legacy-auth-elimination.spec.ts` (#15):** 🟢 6/6 نجاح (19ms) — مقفل تشفيرياً بـ SHA-256 (`test:apps/admin-dashboard/tests/legacy-auth-elimination.spec.ts`).

- **إجمالي اختبارات الدفعة الأولى المعتمدة:** 161 اختباراً ناجحاً بنسبة 100%.
- **الفحص الجنائي والمطابقة:** `pnpm audit:saleh` = PASS ✅ | `pnpm typecheck` = PASS (0 errors) | `test-authenticity` = PASS (237 files).

#### 2.2 🟢 الدفعة الثانية (Batch 2: إنهاء كافة ملفات لوحة التحكم - 15 ملفاً في `apps/admin-dashboard`) — 🟢 مكتملة 21/09/2026
تم بحمد الله ترقية ومطابقة الـ 15 ملفاً المتبقية بالكامل في لوحة التحكم الإدارية وفق دستور جودة الاختبارات الثماني ([`.agents/rules/06-testing-and-mutation-constitution.md`](file:///f:/Alsaada-Smart-Bot/.agents/rules/06-testing-and-mutation-constitution.md)) لتكتمل لوحة التحكم الإدارية بنسبة 100% (30 ملفاً من أصل 30):

1. **`apps/admin-dashboard/tests/middleware-session-guard.spec.ts` (#16):** 🟢 7/7 نجاح (46ms) — تثبيت `PINNED_BASE_TIME`، استعادة المؤقتات، وهيكلة Triple-A صريحة وتوكيدات سلبية.
2. **`apps/admin-dashboard/tests/middleware-trace.spec.ts` (#17):** 🟢 10/10 نجاح (36ms) — تثبيت `PINNED_BASE_TIME`، حقن traceId، وتوكيدات سلبية مانعة للمسارات غير المصرحة.
3. **`apps/admin-dashboard/tests/parity/approvals-security-guard.spec.ts` (#18):** 🟢 7/7 نجاح (14ms) — هيكلة Triple-A صريحة، توكيدات سلبية مانعة لاعتماد النفس ومطابقة قيود الخزينة.
4. **`apps/admin-dashboard/tests/parity/settings-and-delegations-parity.spec.ts` (#19):** 🟢 6/6 نجاح (17ms) — ضبط Triple-A بالكامل، اختبار التفويضات المؤقتة وتوكيدات سلبية ضد انتهاك الصلاحيات.
5. **`apps/admin-dashboard/tests/parity/workforce-parity.spec.ts` (#20):** 🟢 9/9 نجاح (20ms) — استبدال المحلل اليدوي بمحرك `parseEgyptianNationalId` الرسمي، وهيكلة Triple-A وتوكيدات سلبية.
6. **`apps/admin-dashboard/tests/permissions-matrix-and-telegram-groups.spec.ts` (#21):** 🟢 9/9 نجاح (13ms) — ضبط كتل Triple-A الصريحة، وتوكيدات سلبية مانعة لوصول الأدوار غير المخولة لمجموعات الإشعارات.
7. **`apps/admin-dashboard/tests/pillar-4-cybersecurity-and-skeletons.spec.ts` (#22):** 🟢 16/16 نجاح (98ms) — تثبيت `PINNED_BASE_TIME`، والمؤقتات الوهمية واستعادتها، وفصل Triple-A وتوكيدات XSS سلبية.
8. **`apps/admin-dashboard/tests/prisma-studio-rbac.spec.ts` (#23):** 🟢 24/24 نجاح (72ms) — استئصال `Date.now()` واستبداله بـ `PINNED_BASE_TIME`، كتم ضوضاء spawn stderr، وضبط Triple-A.
9. **`apps/admin-dashboard/tests/rbac.spec.ts` (#24):** 🟢 5/5 نجاح (4ms) — فصل مراحل Triple-A صراحة، وتعزيز التوكيدات بمانعات سلبية صارمة للأدوار العادية.
10. **`apps/admin-dashboard/tests/role-overview.spec.ts` (#25):** 🟢 5/5 نجاح (58ms) — فحص عميق للمخرجات عبر `renderToString`، حجب الرواتب عن FIELD_ADMIN، وضبط Triple-A وتوكيدات سلبية.
11. **`apps/admin-dashboard/tests/screen-responsiveness.spec.ts` (#26):** 🟢 24/24 نجاح (13ms) — فصل مراحل Triple-A لـ 24 اختباراً، توكيدات سلبية مانعة للأخطاء التصميمية، وتثبيت ZeroStateCard.
12. **`apps/admin-dashboard/tests/secure-export.spec.ts` (#27):** 🟢 5/5 نجاح (81ms) — هيكلة Triple-A، استخدام المؤقتات الحقيقية لتدفق ExcelJS، توكيدات سلبية مانعة لحقن المعادلات وتسريب الرواتب.
13. **`apps/admin-dashboard/tests/sidebar-nav.spec.ts` (#28):** 🟢 17/17 نجاح (19ms) — هيكلة Triple-A لـ 17 اختباراً، توكيدات سلبية مانعة للتداخل، وتأكيد خلو عناوين الأقسام من الإيموجي بنسبة 100%.
14. **`apps/admin-dashboard/tests/workforce-evaluations.spec.ts` (#29):** 🟢 9/9 نجاح (17ms) — تثبيت `PINNED_BASE_TIME`، كتم تسريب خطأ قاعدة البيانات عن الكونسول، وضبط Triple-A وتوكيدات سلبية.
15. **`apps/admin-dashboard/tests/workforce-onboarding.spec.ts` (#30):** 🟢 12/12 نجاح (12ms) — تثبيت `PINNED_BASE_TIME`، واختبار استخراج الرقم القومي بمحرك النواة، وهيكلة Triple-A وتوكيدات سلبية.

- **إجمالي اختبارات لوحة التحكم بالكامل (30 ملفاً):** 342 اختباراً ناجحاً بنسبة 100% (30 passed / 342 tests).
- **الفحص الجنائي والمطابقة:** `pnpm audit:saleh` = PASS ✅ | `pnpm typecheck` = PASS (0 errors).

### ⬜ المرحلة 3: Tier 3 — Medium (22 ملف) — قيد الانتظار
### ⬜ المرحلة 4: Tier 4 — Low (12 ملف) — قيد الانتظار
