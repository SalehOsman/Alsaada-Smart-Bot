# 📋 خطة العمل رقم 30: تحويل رابط دعوة العمال إلى مسار اعتماد وتفعيل إداري محكم، درع الحماية الإدارية، وتوحيد الاسم التجاري الديناميكي
## Master Work Plan 30: Worker Invitation Approval Workflow, Administrative Shield & Dynamic Company Name SSOT

> [!IMPORTANT]
> **الحالة:** 🟢 مكتمل ومعتمد 100%  
> **التاريخ:** 2026-09-15  
> **الموديولات والحزم المستهدفة:**
> - `modules/workforce` (`01.1-worker-registration`, `01.5-worker-directory`, `01.7-guest-join-and-linking`)
> - `apps/bot-server` (`handlers/start.handler.ts`, `handlers/worker-linking.handler.ts`, `bot.ts`, `services/system-data.service.ts`)
> **دستور العمل:** الالتزام الصارم بميثاق الحوكمة (`AGENTS.md`) ودستور المنظومة (`GEMINI.md`): حظر تكرار الأكواد، سقف معالج التدفق <= 350 سطراً، خلو تام من `any`، وحفظ سلامة الأدوار والصلاحيات (Zero Role Degradation).

---

### 1️⃣ الدوافع والمعالجة المعمارية (Architecture & Vulnerability Analysis)

1. **معالجة ثغرة خفض الرتبة والربط الفوري (Vulnerability: Blind Downgrade & Account Takeover):**
   - **الخلل السابق:** عند فتح رابط الدعوة `/start inv_CODE_TOKEN` والضغط على زر `[ ⚡ تأكيد وربط حسابي فوراً ]`، كان النظام يقوم بالاستدعاء المباشر لـ `linkWorkerAccount` دون أي تدقيق لرتبة المستخدم المنفذ. وإذا قام مستخدم برتبة إدارية (`SUPER_ADMIN` أو `GENERAL_ADMIN` أو `FIELD_ADMIN` أو `ACCOUNTANT` أو `PROJECT_MANAGER`) بفتح الرابط وتأكيده، يتم فوراً ربط العامل بحسابه وخفض رتبته في قاعدة البيانات إلى `WORKER` ومسح صلاحياته الإدارية!
   - **الحل المعماري (Admin Shield):**
     * فحص رتبة المستخدم الذي فتح رابط الدعوة فوراً.
     * إذا كان المستخدم يحمل رتبة إدارية، يتم تفعيل **«وضع معاينة الإدارة»** حصراً:
       عرض بطاقة استعراضية لبيانات العامل مع تنبيه صريح بأن الحساب إداري ولا يمكن ربطه، وحجب زر الربط/التقديم تماماً.

2. **تحويل الربط المباشر إلى طلب انضمام ومصادقة معتمد (Approval-Based Pre-filled Join Request):**
   - بدلاً من التفعيل الفوري العشوائي، عند فتح الرابط من حساب ضيف أو عامل:
     * عرض بطاقة بيانات العامل المستهدَف بالدعوة.
     * زر وحيد: `[ 📝 إرسال طلب ربط وتفعيل حسابي ]` (`action:submit_join_request:CODE:TOKEN`).
     * عند النقر، يتم إنشاء تذكرة موافقة رقمية رسمية في جدول `ApprovalTicket` بنوع `GUEST_JOIN_LINKING` وحالة `PENDING`.
     * عرض بطاقة استلام رسمية للمستخدم برقم التذكرة: `⏳ تم إرسال طلب تفعيل وربط حسابك بنجاح للمراجعة الإدارية (تذكرة رقم #TCK-JOIN-XXXX)`.
     * إرسال إشعار تفاعلي لحظي لمديري المنظومة (Super Admins) يحتوي على تفاصيل العامل وهوية حساب التيليجرام لمقدم الطلب (`@username`, `telegramId`) مع أزرار قرار تفاعلية:
       `[ ✅ موافقة واعتماد الربط ]` (`action:approve_worker_link:TICKET_ID`)
       `[ ❌ رفض الطلب ]` (`action:reject_worker_link:TICKET_ID`)

3. **التفعيل والربط اللحظي فور الاعتماد (Instant Activation upon Approval):**
   - عند موافقة الإدارة:
     * التحقق من حالة التذكرة المعلقة `PENDING` وتحديثها إلى `APPROVED` مع توثيق هوية المعتمد وتاريخ الاعتماد.
     * ربط العامل بأمان تام `worker.telegramId = applicantTelegramId`.
     * ترقية حساب المستخدم في جدول `User` إلى `role: 'WORKER'`.
     * إبطال الكاش فورياً (`invalidateUserCache`) ومزامنة نطاق الأوامر (`syncUserCommandsScope`).
     * إرسال إشعار فوري في الشات الخاص للعامل بتهنئته واعتماد حسابه مع عرض القائمة الرئيسية للبوابة الذاتية.
   - عند رفض الإدارة:
     * تحديث التذكرة إلى `REJECTED` وتوثيق الملاحظات وإشعار العامل بأدب بمراجعة الموارد البشرية.

4. **إجراء الإلغاء الإداري لربط التيليجرام (Admin Unlink Worker Action):**
   - توفير إجراء إداري معتمد `action:worker:unlink_telegram:WORKER_ID` في بطاقة العامل ودليل العاملين يتيح للإدارة فك ارتباط حساب التيليجرام لأي عامل مسجل (في حال فقدان الهاتف أو تغييره) مع تصفير `worker.telegramId` وخفض رتبة الحساب القديم إلى `GUEST` وإبطال الكاش بنظافة تامة.

5. **توحيد المصدر الحصري للاسم التجاري للشركة (Dynamic Company Name SSOT):**
   - استئصال أي نصوص ثابتة للاسم التجاري (`شركة السعادة للمقاولات العامة والتعدين`) في رسائل ترحيل الواتساب والبطاقات في `flow.service.ts` وبطاقات التيليجرام.
   - جلب الاسم التجاري ديناميكياً من `SystemDataService.getCompanyTradeName()` أو `CompanyProfile` لضمان ديناميكية المنظومة مع أي مستأجر أو تعديل رسمي لبيانات المنشأة.

---

### 2️⃣ مراحل التنفيذ التفصيلية (Implementation Phases & Milestones)

- [x] **المرحلة 1: توحيد الاسم التجاري الديناميكي (Dynamic Company Name SSOT)**
  - [x] إضافة دالة `getCompanyTradeName` في `WorkerRegistrationRepository` و `WorkerRegistrationService`.
  - [x] تحديث `buildWelcomeWhatsAppUrl` لاستقبال واستخدام الاسم التجاري الديناميكي للشركة وإزالة أي نصوص ثابتة.
  - [x] تدقيق رسائل `01.7-guest-join-and-linking` وإتاحة تمرير اسم الشركة ديناميكياً.

- [x] **المرحلة 2: تعزيز مستودع وخدمة الربط والانضمام (`01.7-guest-join-and-linking`)**
  - [x] إضافة دالة `unlinkWorkerAccount(workerId, actorTelegramId)` في `GuestJoinRepository` و `GuestJoinService` لتنفيذ فك الارتباط المعاملي النظيف.
  - [x] تحديث `flow.types.ts` و `WorkerProfile360` في `01.5-worker-directory` ليشمل `telegramId`.
  - [x] تحديث `profile360ActionsKeyboard` لإظهار زر `[ 🔓 إلغاء ربط حساب التليجرام ]` عند وجود حساب مرتبط أو للإدارة.

- [x] **المرحلة 3: هندسة المعالج التفاعلي لربط العمال والدرع الإداري (`apps/bot-server`)**
  - [x] تحديث `apps/bot-server/src/handlers/start.handler.ts`:
    * تفعيل **Admin Shield** عند فتح `/start inv_...` لمنع أي خفض لرتبة الحسابات الإدارية، وعرض بطاقة المعاينة الإدارية.
    * التحقق من التذاكر المعلقة للمستخدم وعرض بطاقة المتابعة.
    * عرض بطاقة التقديم الجاهزة مع زر `[ 📝 إرسال طلب ربط وتفعيل حسابي ]`.
  - [x] إنشاء `apps/bot-server/src/handlers/worker-linking.handler.ts`:
    * معالج `handleSubmitJoinRequest`: إنشاء تذكرة `ApprovalTicket` بنوع `GUEST_JOIN_LINKING`، عرض إيصال التقديم، وإرسال بطاقة الاعتماد التفاعلية للمديرين.
    * معالج `handleApproveWorkerLink`: فحص الصلاحية الإدارية، تحديث التذكرة، ربط العامل، ترقية الحساب، إبطال الكاش، ومزامنة البوابة وإشعار العامل.
    * معالج `handleRejectWorkerLink`: فحص الصلاحية، تحديث التذكرة لـ `REJECTED`، وإشعار العامل.
    * معالج `handleAdminUnlinkWorker`: فك ارتباط العامل، تحويل المستخدم القديم لـ `GUEST`، إبطال الكاش، وإشعار المعتمد والعامل.
  - [x] تسجيل المسارات في `apps/bot-server/src/bot.ts`.

- [x] **المرحلة 4: الاختبارات والتحقق الشامل (Zero Regression & Verification)**
  - [x] كتابة اختبارات وحدة وسلوك شاملة لتدفق الاعتماد والدرع الإداري وفك الارتباط.
  - [x] تشغيل `pnpm flow:check modules/workforce/src/flows/01.1-worker-registration`.
  - [x] تشغيل كافة اختبارات `modules/workforce` و `apps/bot-server`.
  - [x] تشغيل `pnpm typecheck`.
  - [x] توثيق الميزة في `docs/19-legacy-to-enterprise-master-feature-migration-registry.md` تحت `NEW-73`.
  - [x] إعادة بناء حاوية الدوكر `alsaada_enterprise_bot` والتأكد من تشغيلها السليم وحالتها `healthy`.
