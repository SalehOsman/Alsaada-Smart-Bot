# 📋 خطة العمل رقم 10 المدمجة: معالج المشرفين وعزل المشاريع، حزمة مميزات تيليجرام الرسمية والنواة المشتركة، ومنهجية مسارات التتبع
## Merged Master Plan 10: Admin Scoping & Assignment, Telegram Native Core Suite, Universal Breadcrumbs & Contract Hardening

> [!IMPORTANT]
> **ميثاق الحوكمة ومرجعية الخطة المدمجة:**
> بناءً على التوافق والاعتماد الصريح للمستخدم، تدمج هذه الخطة بين:
> 1. **بناء حزمة مميزات تيليجرام الرسمية الست المعيارية في النواة المشتركة (`@alsaada/core-components`):**
>    - النسخ السريع بنقرة واحدة (`formatClickToCopy`).
>    - التشويش التفاعلي على البيانات الحساسة (`formatSpoiler`).
>    - الاقتباسات المطوية القابلة للتوسيع (`formatExpandableQuote`).
>    - نوافذ التنبيه المنبثقة الرسمية (`showModalAlert`).
>    - كبح معاينات الروابط المشوهة (`DISABLED_LINK_PREVIEWS`).
>    - مؤشرات المعالجة التفاعلية والنشاط الحي (`withChatAction` و `sendChatActionSafe`).
> 2. **منهجية مسارات التتبع الميداني الموحدة (Universal Navigation Breadcrumbs):**
>    - بناء دالة النواة `formatBreadcrumbs(segments: string[])`.
>    - التطبيق الإلزامي لشريط المسار (`📍 المسار: ...`) على **كافة تدفقات وشاشات مركز الإعدادات التسعة بالكامل**، وموديول شؤون العاملين، وبقية المنظومة.
> 3. **الإصلاح الفوري لعطل `BUTTON_DATA_INVALID (400 Bad Request)`:**
>    - تقليص بيانات الأزرار (`callback_data`) في كارت تعيين المشرفين إلى <= 53 بايت بتبني البادئات المدمجة (`adm:s:` و `adm:u:`).
>    - تحديث أداة الحوكمة `verify-telegram-contracts.ts` لفحص الـ Template Strings داخل الباكتكس لمنع أي تجاوز لسقف 64 بايت مستقبلاً.
> 4. **إعادة الهيكلة المؤسسية للوحة تعيين المشرفين (`00.5-admin-assignment`):**
>    - نقل قسم «👥 تعيين وتوزيع مشرفي المواقع» من قسم الحساب والمحاكاة إلى **«🏢 الكيان المؤسسي والمشاريع»** بجوار مصفوفة المشاريع والمواقع الميدانية.
>    - إظهار عداد القوى العاملة أمام كل موقع: `[ 📍 موقع ابو طرطور (STE-01) — 👥 3 عمال ]`.
>    - إظهار شارات الرتب الإدارية في قائمة المشرفين: `[ 🌟 الاسم — مدير عام (وصول شامل 🌐) ]` و `[ 🛡️ الاسم — مشرف موقع (📍 الموقع) ]`.
>    - إتاحة زر مباشر لفك التقييد وجعل المشرف عاماً لكافة المشاريع.
> 5. **قفل اختيار الموقع تلقائياً لمشرف الموقع الميداني (`FIELD_ADMIN`):**
>    - في معالج تسجيل العمال الجديد (`01.1`)، إذا كان المستخدم `FIELD_ADMIN` ولديه موقع محدد، يتم قفل الموقع تلقائياً وتجاوز خطوة اختيار الموقع مباشرة، مع إبقاء الاختيار حراً للمدير العام والسوبر أدمن.
> 6. **التوثيق الدستوري الحتمي:**
>    - تحديث الوثيقة 22 (`docs/22-telegram-ux-ui-design-system-and-ergonomics.md`).
>    - تحديث كتالوج المكونات المشتركة رقم 02 (`docs/02-core-shared-components-catalog.md`).
>    - تحديث دستور العمل (`AGENTS.md` و `GEMINI.md`) بإلزامية استيراد الدوال المشتركة ومسارات التتبع.

---

### 1️⃣ تفاصيل الحزمة البرمجية للنواة المشتركة (`packages/core-components`)

```typescript
// 1. مسار التتبع الموحد
export function formatBreadcrumbs(segments: string[]): string;

// 2. النسخ السريع بنقرة واحدة
export function formatClickToCopy(code: string | number | bigint): string;

// 3. التشويش التفاعلي على البيانات الحساسة
export function formatSpoiler(text: string, mode?: 'html' | 'markdown'): string;

// 4. الاقتباسات المطوية القابلة للتوسيع
export function formatExpandableQuote(text: string, mode?: 'html' | 'markdown'): string;

// 5. نافذة التنبيه المنبثقة الرسمية
export async function showModalAlert(
  ctx: { answerCallbackQuery: (opts: { text: string; show_alert: boolean }) => Promise<unknown> },
  text: string
): Promise<void>;

// 6. كبح معاينات الروابط
export const DISABLED_LINK_PREVIEWS = Object.freeze({ is_disabled: true } as const);
export function buildLinkPreviewOptions(disabled?: boolean): { is_disabled: boolean };

// 7. مؤشرات النشاط الحي والمعالجة
export async function sendChatActionSafe(ctx: any, action: TelegramChatAction): Promise<void>;
export async function withChatAction<T>(
  ctx: any,
  action: TelegramChatAction,
  task: () => Promise<T>,
  intervalMs?: number
): Promise<T>;
```

---

### 2️⃣ خطوات التنفيذ المعتمدة خطوة بخطوة

#### الخطوة 1: تطوير حزمة النواة المشتركة واختباراتها 🟢 [مكتمل 100%]
- [x] تعديل `packages/core-components/src/types.ts`.
- [x] تطوير الدوال في `packages/core-components/src/formatting/telegram-formatters.ts`.
- [x] تصديرها في `packages/core-components/src/index.ts`.
- [x] كتابة اختبارات Vitest شاملة في `packages/core-components/tests/telegram-formatters.spec.ts` (21 اختبار ناجح).

#### الخطوة 2: إصلاح عقود الأزرار والقوائم في موديول الإعدادات (`modules/settings`) 🟢 [مكتمل 100%]
- [x] في `00.5-admin-assignment/flow.keyboard.ts`:
  - تقليص البادئات إلى `adm:s:${user.telegramId}:${s.id}` و `adm:u:${u.telegramId}`.
  - إدراج شارات الرتب الإدارية وعداد العمال.
- [x] في `00.5-admin-assignment/flow.repository.ts`:
  - احتساب عدد العمال الفعلي لكل موقع (`_count: { select: { workers: { where: { isDeleted: false } } } }`).
- [x] في `modules/settings/src/module.routes.ts`:
  - دعم مسارات `adm:s:` و `adm:u:`.
- [x] في `modules/settings/src/shared/settings-hub.ts`:
  - نقل زر المشرفين إلى `buildCorporateSubKeyboard` داخل **«🏢 الكيان المؤسسي والمشاريع»**.
- [x] في ملفات `flow.messages.ts` لكافة تدفقات الإعدادات التسعة:
  - دمج `formatBreadcrumbs` لتظهر الترويسة الموحدة في كل شاشة.

#### الخطوة 3: قفل الموقع لمشرف الموقع في موديول القوى العاملة (`modules/workforce`) 🟢 [مكتمل 100%]
- [x] في `01.1-worker-registration/flow.handler.ts`:
  - قفل الموقع لمشرف الموقع والانتقال فوراً لتاريخ البدء.
  - دمج `formatBreadcrumbs` و `formatClickToCopy` في شاشات تسجيل العمال والدليل.
  - إضافة اختبارات التحقق من العزل والقفل التلقائي في `tests/flow.rbac.spec.ts`.

#### الخطوة 4: تحديث أداة الحوكمة والوثائق الرسمية 🟢 [مكتمل 100%]
- [x] تحديث `tools/governance/verify-telegram-contracts.ts` لفحص نصوص الباكتكس والتأكد من حد 64 بايت لـ 412 زر.
- [x] معالجة زر التصدير في `01.4-worker-export/flow.keyboard.ts` وتقليصه إلى 62 بايت.
- [x] تحديث وثائق المشروع (`docs/22`, `docs/02`, `AGENTS.md`, `GEMINI.md`, `docs/work-plans/README.md`).
- [x] توثيق الحوكمة في `docs/ai-execution-evidence/2026-09-11-telegram-contracts-guard-and-plan-10.md`.

#### الخطوة 5: التحقق الهندسي الشامل والاعتماد 🟢 [مكتمل 100%]
- [x] تشغيل فحص التايب سكريبت `pnpm typecheck`.
- [x] تشغيل اختبارات النواة والإعدادات والقوى العاملة `pnpm test`.
- [x] تشغيل حارس عقود تليجرام `pnpm telegram-contracts:verify`.
- [x] تشغيل بوابات الحوكمة `pnpm governance:verify`.
- [x] تحديث قفل الحوكمة `pnpm governance:lock`.
