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
| **نطاق التعديل** | ملفات الاختبار + الكود المصدري إن لزم |
| **دورة كل ملف** | إصلاح → تشغيل يدوي → إصلاح أخطاء → توثيق Doc 28 + Audit → التالي |

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

#### 1.2 ⬜ `tools/governance/tests/docker-governance-lock.spec.ts` (#221) — قيد الانتظار
#### 1.3 ⬜ `apps/docs/tests/docs-portal.spec.ts` (#60) — قيد الانتظار
#### 1.4 ⬜ `packages/database/tests/hash-chain.stress.spec.ts` (#197) — قيد الانتظار

---

### ⬜ المرحلة 2: Tier 2 — High (146 ملف) — قيد الانتظار
### ⬜ المرحلة 3: Tier 3 — Medium (22 ملف) — قيد الانتظار
### ⬜ المرحلة 4: Tier 4 — Low (12 ملف) — قيد الانتظار
