# 📜 خطة العمل رقم 71: مركز التحكم السيادي في موديولات وتدفقات وقوائم البوت
## Enterprise Bot Dynamic Module & Flow Control Center (Plan-71 - Final UX Refined)

---

### 1️⃣ ملخص الرؤية المعمارية وتجربة المستخدم المحسنة (Refined Vision & UX Principles)
بعد الفحص الدقيق والنقد المعماري لتجربة المستخدم، تم تحويل النظام من مجرد "شجرة تقليدية عريضة" إلى **منصة هندسة تفاعلية متكاملة (Interactive Bot Experience Studio)** تحقق أعلى معايير بيئة العمل المؤسسية وسلاسة الإدارة:

1. **القضاء على الإرهاق الإدراكي (Zero Cognitive Overload):**
   - استبدال الشجرة الواحدة الممتدة بـ **نظام تصفح هرمي مبوب (Domain Rails & Contextual Drill-Down)**: شريط موديولات علوي/جانبي ذكي يتيح التركيز على نطاق واحد في المرة الواحدة مع شريط مسار تتبع حي (`Breadcrumbs`).
   - **محرك بحث وتصفية فورية متعدد الأبعاد (Multi-Dimensional Filter):** بحث بالاسم، الكود (مثل `01.1`)، الصلاحية، أو الحالة (`نشط`، `موقوف`، `صيانة`).

2. **بيئة سحب وإفلات حصينة ومريحة (Bulletproof Ergonomic Reordering):**
   - **مفتاح حماية الترتيب (Reorder Mode Switch):** إقفال إمكانية السحب لمنع الإفلات العرضي، وتفعيله عند الرغبة في التعديل فقط.
   - **حدود المستويات الصارمة (Strict Boundary Guard):** منع سحب تدفق فرعي خارج مستواه القانوني في الشجرة.
   - **أزرار تحريك سريعة موازية (Quick Arrow Shift `🔼 / 🔽`):** بديل سريع وموثوق للعمل عبر شاشات اللمس والتابلت الميداني.
   - **ذاكرة تراجع سريعة (Undo / Redo Buffer):** إمكانية التراجع عن الحركات غير المقصودة قبل الحفظ النهائي.

3. **محاكي هاتف تليجرام التفاعلي الحي (Context-Aware Interactive Telegram Phone Frame):**
   - ليس مجرد صورة ساكنة، بل **محاكي هاتف واقعي تفاعلي**:
     - **محدد الدور المحاكى (Role Switcher):** معاينة شكل الشاشة كـ (مدير عام / مشرف ميداني / عامل / زائر).
     - **أزرار قابلة للنقر:** تتيح للمشرف النقر على أزرار المحاكي والتنقل بين مستويات القوائم تماماً كما يشاهدها المستخدم الحقيقي.
     - **انعكاس بصري فوري:** أي تغيير في الترتيب أو الإيقاف/التشغيل ينعكس فورياً وبأجزاء من الثانية داخل شاشة المحاكي.

4. **العمليات المجمعة والإيقاف المتسلسل الذكي (Bulk Operations & Smart Cascading):**
   - عند إيقاف موديول أو قسم رئيسي، يتاح للمدير خياران:
     - **إيقاف الرأس فقط (Head-Only Pause):** يوقف القسم مع احتفاظ الوظائف الداخلية بحالاتها الفردية لتسهيل العودة.
     - **إيقاف متسلسل شامل (Cascading Deep Disable):** يوقف القسم وكافة الوظائف والتدفقات التابعة له دفعة واحدة.
   - **شريط مهام مجمع (Bulk Action Toolbar):** لتحديد عدة وظائف وتشغيلها أو إيقافها وتحديد سلوكها بنقرة واحدة.

5. **قوالب رسائل التنبيه الجاهزة (1-Click Alert Templates):**
   - توفير بنك نصوص معتمد لتنبيهات الصيانة والتوقف بضغطة زر واحدة لمنع تكرار الكتابة، مع إمكانية التحرير اليدوي.

6. **حصانة وظائف السيادة (Sovereign Non-Disablable Anchors):**
   - حماية مشفرة غير قابلة للتعطيل لوظائف النظام الأساسية: (زر فتح لوحة التحكم `🖥️ فتح لوحة التحكم` وأمر `/dashboard`، القائمة الرئيسية `/start` و `/menu`، إعدادات النظام، التراجع وإلغاء المعاملة `/cancel`، فحص الجاهزية `/ping`، والخروج من وضع الشبح). تظهر بشارة ذهبية 🛡️ مع تعطيل مفتاح الإيقاف برمجياً وبصرياً.

7. **مزامنة لحظية فائقة السرعة (< 5ms):**
   - بث عبر `Redis Pub/Sub` لإفراغ كاش القوائم في خادم البوت فور اعتماد الحفظ دون إعادة تشغيل البوت.

8. **التوافق التجاوبي الذكي (Responsive Split-Screen Layout):**
   - في الشاشات الواسعة: تقسيم متوازن (60% لإدارة الشجرة والتحكم، و40% للمحاكي التفاعلي الحي).
   - في شاشات التابلت والموبايل: نظام التبويب السلس (تبويب "هندسة القوائم" وتبويب "المعاينة الحية").

---

### 2️⃣ المعمارية التقنية ونموذج البيانات المحدث (Database Schema)

```prisma
enum BotNodeType {
  MODULE       // النطاق العام (الموارد البشرية، المالية، التشغيل، اللوجستيات، الحوكمة)
  SECTION      // القسم الرئيسي (شؤون العاملين، السلف، العهد...)
  SUBSECTION   // القسم الفرعي (إن وجد)
  FLOW         // زر التدفق الإجرائي المباشر (مثل: تسجيل عامل 01.1)
}

enum BotNodeStatus {
  ACTIVE       // مفعل ويعمل بكفاءة
  DISABLED     // موقوف
  MAINTENANCE  // تحت الصيانة والتحديث
}

enum DisabledBehavior {
  HIDE             // إخفاء الزر تماماً من لوحة مفاتيح البوت
  LOCK_WITH_ALERT  // إبقاء الزر مع رمز قفل 🔒 ورسالة تنبيه منبثقة Modal Alert
}

model BotMenuNode {
  id                 String           @id @default(uuid())
  code               String           @unique // e.g. "mod:hr", "sec:workforce", "flow:01.1"
  parentId           String?          // ربط هرمي بالعنصر الأب
  type               BotNodeType
  title              String           // المسمى العربي على الزر
  icon               String?          // الرمز التعبيري (مثل: 👥, 💰, 🚜)
  callbackData       String?          // كود الكولباك في تليجرام (e.g. "flow:01.1:start")
  status             BotNodeStatus    @default(ACTIVE)
  disabledBehavior   DisabledBehavior @default(LOCK_WITH_ALERT)
  maintenanceMessage String?          // نص التنبيه المخصص عند الضغط
  sortOrder          Int              @default(0)
  isProtected        Boolean          @default(false) // وظيفة سيادية غير قابلة للإيقاف مطلقاً
  allowedRoles       String[]         @default(["SUPER_ADMIN", "GENERAL_ADMIN", "FIELD_ADMIN"])
  metadata           Json?            // إعدادات التنسيق، عدد الأعمدة، مسار الشريحة
  
  parent             BotMenuNode?     @relation("MenuHierarchy", fields: [parentId], references: [id], onDelete: Cascade)
  children           BotMenuNode[]    @relation("MenuHierarchy")

  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  @@index([parentId, sortOrder])
  @@index([status])
  @@map("bot_menu_nodes")
}

// سجل لقطات النسخ الاحتياطي للقوائم واستعادة التكوينات
model BotMenuSnapshot {
  id          String   @id @default(uuid())
  title       String   // e.g. "قبل صيانة رمضان 2026", "الترتيب الافتراضي للمنظومة"
  data        Json     // لقطة كاملة للشجرة
  createdById String
  createdAt   DateTime @default(now())

  @@map("bot_menu_snapshots")
}
```

---

### 3️⃣ تفاصيل المكونات والملفات التنفيذية (Components Implementation)

#### أ. طبقة قاعدة البيانات والنواة المشتركة:
1. **[MODIFY]** `packages/database/prisma/schema.prisma`: إضافة نموذج `BotMenuNode` و `BotMenuSnapshot`.
2. **[NEW]** `packages/database/prisma/seeds/bot-menu-catalog.seed.ts`: تهيئة شجرة الـ 126 وظيفة المعتمدة من `docs/19`.
3. **[NEW]** `packages/core-components/src/bot-catalog/`:
   - `bot-feature-registry.service.ts`: استعلامات الذاكرة المؤقتة وإدارة الشجرة.
   - `feature-gate-guard.ts`: صمام التحقق الأمني من حالة الوظائف قبل التنفيذ.

#### ب. خادم البوت (`apps/bot-server`):
1. **[NEW]** `apps/bot-server/src/services/dynamic-menu.service.ts`: توليد كيبورد تليجرام ديناميكياً مع الأخذ بالاعتبار الترتيب، الرتب، وسلوك الإيقاف (إخفاء / قفل).
2. **[MODIFY]** `apps/bot-server/src/keyboards/main-menu.keyboard.ts`: دمج الخدمة الديناميكية مع توفير Fallback فوري.
3. **[MODIFY]** `apps/bot-server/src/bot.ts`:
   - إضافة مستمع `Redis Pub/Sub` لقناة `system:bot_menu_sync` لإفراغ الكاش اللحظي في أقل من 5ms.
   - إضافة ميدلوير اعتراضي ذكي: في حال نقر المستخدم على وظيفة موقوفة برمز 🔒 يتم الرد فوراً بـ `ctx.answerCallbackQuery({ text: maintenanceMessage, show_alert: true })`.

#### ج. لوحة التحكم الإدارية (`apps/admin-dashboard`):
1. **[NEW]** `apps/admin-dashboard/src/app/admin/settings/bot-features/page.tsx`:
   - الحاوية الرئيسية الداعمة للعرض المنقسم (Split View) على الشاشات الكبيرة والمبوب على الصغيرة.
   - شريط الموديولات العلوي السريع + محرك البحث متعدد الحقول.
   - أشرطة العمليات المجمعة وقوالب رسائل الصيانة.
   - نافذة تحليل الأثر قبل الحفظ وتأكيد التغييرات.
2. **[NEW]** `apps/admin-dashboard/src/app/admin/settings/bot-features/components/bot-node-card.tsx`:
   - كارت العنصر التفاعلي (دعم السحب والإفلات، مفاتيح 🔼/🔽، مؤشرات الحالة، مفتاح الإيقاف/التشغيل مع الحماية الذهبية للوظائف السيادية).
3. **[NEW]** `apps/admin-dashboard/src/app/admin/settings/bot-features/components/interactive-phone-mockup.tsx`:
   - محاكي هاتف تليجرام تفاعلي كامل مع محدد الرتبة، والأزرار الحية، والتنقل الفوري بين القوائم.
4. **[NEW]** `apps/admin-dashboard/src/app/admin/settings/bot-features/components/node-edit-modal.tsx`:
   - نافذة تحرير تفاصيل الوظيفة (تعديل العنوان، الأيقونة، الأدوار، سلوك الإيقاف، رسالة الصيانة).
5. **[NEW]** `apps/admin-dashboard/src/app/api/admin/bot-features/route.ts`:
   - إدارة الـ CRUD، حفظ الترتيب، وإدارة اللقطات (Snapshots)، مع تدوين كل حركة في `AuditVault`.
6. **[MODIFY]** `apps/admin-dashboard/src/components/layout/sidebar.tsx`:
   - إضافة رابط مباشر وسريع في قائمة السوبر أدمن "هندسة موديولات وقوائم البوت".
7. **[MODIFY]** `apps/admin-dashboard/src/app/admin/settings/page.tsx`:
   - إضافة بطاقة مخصصة في مركز الإعدادات.

#### د. التوثيق والحوكمة الدستورية (`docs/` & `AGENTS.md` & `GEMINI.md`):
1. **[MODIFY]** `docs/work-plans/71-plan-bot-dynamic-module-and-flow-control-center.md`: تحديث وثيقة الخطة بالنسخة النهائية.
2. **[MODIFY]** `docs/19-legacy-to-enterprise-master-feature-migration-registry.md`: تسجيل الوظيفة `NEW-84`.
3. **[MODIFY]** `AGENTS.md` و `GEMINI.md`: إضافة بند الحوكمة الملزم بتسجيل أي وظيفة أو تدفق مستقبلي في هذا المحرك.

---

### 4️⃣ خطة التحقق والاختبارات المنهجية (Rigorous Verification Plan)
1. **اختبارات سلامة البيانات والحصانة (Automated Unit/Integration Tests):**
   - اختبار الـ Idempotent Seeding وتأكيد وجود كافة الوظائف الـ 126.
   - اختبار محاولة تعطيل وظيفة سيادية (`/dashboard`, `/start`) والتأكد من رفض المحاولة بنسبة 100%.
   - اختبار الترتيب الهرمي المتسلسل والتراجع (`Undo`).
2. **اختبارات سرعة المزامنة اللحظية (Latency & Pub/Sub Benchmark):**
   - التحقق من نشر الحدث واستلامه وتفريغ الكاش في زمن استجابة أقل من 5ms.
3. **اختبارات محاكي تليجرام التفاعلي (UI/UX Component Verification):**
   - التحقق من تغيير ترتيب الأزرار داخل المحاكي فور تغييرها في الشجرة.
   - التحقق من تفاعل أزرار المحاكي عند تبديل الأدوار (سوبر أدمن مقابل عامل مقابل زائر).
4. **اختبار البوت الحقيقي الميداني (Live Telegram End-to-End):**
   - اختبار ظهور وإخفاء الأزرار على تليجرام الفعلي.
   - اختبار الضغط على زر في وضع الصيانة والتأكد من ظهور التنبيه المنبثق `Modal Alert`.

---

### 5️⃣ سجل وسند التنفيذ البرمجي (Implementation & Verification Evidence)
- **الحالة:** 🟢 **مكتمل وموثق 100%**
- **تاريخ التنفيذ:** 2026-09-18
- **الملفات المنفذة:**
  * `packages/database/prisma/schema.prisma`: نماذج `BotMenuNode` و `BotMenuSnapshot` وتعدادات `BotNodeType`, `BotNodeStatus`, `DisabledBehavior`.
  * `packages/database/prisma/seeds/bot-menu-catalog.seed.ts`: سييد الـ 126 وظيفة والموديولات والأقسام مع تعيين الوظائف السيادية (`isProtected: true`).
  * `packages/core-components/src/bot-catalog/`: خدمات `bot-feature-registry.service.ts`, `feature-gate-guard.ts`, `types.ts`, `index.ts`.
  * `packages/core-components/tests/bot-catalog.spec.ts`: 8 اختبارات آلية تغطي كافة السيناريوهات والحصانة السيادية بنجاح 100%.
  * `apps/bot-server/src/services/dynamic-menu.service.ts`: خدمة توليد القوائم الديناميكية ومزامنة كاش Redis Pub/Sub الفورية.
  * `apps/bot-server/src/keyboards/main-menu.keyboard.ts`: دمج القوائم الديناميكية مع توفير Fallback فوري.
  * `apps/bot-server/src/bot.ts`: استماع لقناة `system:bot_menu_sync` واعتراض نقرات الوظائف الموقوفة بـ Modal Alert.
  * `apps/admin-dashboard/src/app/api/admin/bot-features/route.ts`: مسارات CRUD والعمليات المجمعة وإدارة اللقطات.
  * `apps/admin-dashboard/src/app/admin/settings/bot-features/`: صفحة التحكم التفاعلية والمحاكي وكروت العناصر ونافذة التعديل.
  * `apps/admin-dashboard/src/dashboard.manifest.ts` & `settings/page.tsx`: إضافة الروابط الرسمية بالداشبورد.
