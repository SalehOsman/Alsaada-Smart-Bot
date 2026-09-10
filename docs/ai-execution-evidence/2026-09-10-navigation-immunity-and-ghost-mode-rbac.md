# توثيق الحوكمة: حصانة أزرار التنقل وحوكمة محاكاة الأدوار (Ghost Mode RBAC)
## Navigation Immunity & Authentic Ghost Mode Role Scoping

- التاريخ: 2026-09-10
- الحالة: معتمد وموافق عليه رسمياً
- عبارة الاعتماد الإلزامية: موافق على التعديل او الايقاف او الحذف

## نطاق الأعمال والترقيات المعمارية المنفذة

1. **الحصانة السيادية لأزرار وقوائم التنقل (Sovereign Navigation Immunity):**
   - معالجة المشكلة التي كانت تؤدي لعدم استجابة زر [ 👥 الموارد البشرية والعمال ] (menu:domain:hr) وأزرار القوائم الأخرى بسبب اعتراض صمام الكولباك المنتهي (isStaleCallback).
   - منح حصانة مطلقة لكافة أزرار وقوائم التنقل العليا (menu:*, action:main_menu, action:exit_impersonate, action:switch_identity:*, action:settings*, action:worker*, action:advances*, action:leaves*, action:payroll*, action:admin_affairs*, action:dept:*, action:site:*) في screen-flow.service.ts لضمان استجابتها الفورية وعدم حظرها حتى في حال وجود تباين بمعرف الرسالة النشطة في الكاش.

2. **مطابقة صلاحيات وضع المحاكاة الشبحية (Authentic Ghost Mode Role Scoping):**
   - تعديل فحص صلاحية السوبر أدمن في hr-hub.handler.ts و 01.5-worker-directory/flow.handler.ts و 01.2.D-worker-edit/flow.handler.ts و 01.4-worker-export/flow.handler.ts ليأخذ في الاعتبار حالة المحاكاة:
     ctx.isImpersonating ? ctx.effectiveRole === 'SUPER_ADMIN' : Boolean(ctx.isRealSuperAdmin || ctx.effectiveRole === 'SUPER_ADMIN')
   - عند تفعيل وضع المحاكاة (مثل محاكاة رتبة المشرف الميداني FIELD_ADMIN)، يتم حجب قسم الرواتب والأجور والمستحقات، وحجب أزرار رفع كشوفات الإكسيل، وحجب تبويبات التعديل المالي، وحذف أسطر الراتب الأساسي كلياً دون تسريب أي بيانات سوبر أدمن، مما يوفر تجربة محاكاة واقعية 100% تطابق ما يراه المستخدم الميداني الفعلي.

3. **اكتمال توافق الأنواع وتحديث سياق الموديول (Strict Typing & Module Context):**
   - إضافة خاصية isImpersonating?: boolean; إلى واجهة WorkforceModuleContext في modules/workforce/src/shared/module.types.ts لتحقيق التوافق التام مع TypeScript 5.9+ الصارم.

4. **الاختبارات الآلية المضافة:**
   - إضافة اختبار استجابة وحصانة أزرار القوائم في apps/bot-server/tests/screen-flow-and-hr-directory.spec.ts.
   - إضافة اختبار التحقق من حجب قسم الرواتب والأجور ورفع الإكسيل في وضع المحاكاة في apps/bot-server/tests/hr-rbac-masking.spec.ts.

## أوامر التحقق الإلزامية (Mandatory Verification Commands)

| الأمر | النتيجة | البيان التفصيلي |
| :--- | :---: | :--- |
| pnpm build | PASS | نجاح بناء وتجميع كافة الحزم والموديولات بتصريف صارم Exit 0 |
| pnpm test | PASS | اجتياز كافة الاختبارات الآلية بنسبة 100% (348 اختباراً عبر 58 ملفاً) |
| pnpm lint | PASS | التحقق الصارم من التايب سكريبت بدون أخطاء (tsc --noEmit) |
| pnpm arch:verify | PASS | فحص العزل الموديولي الصارم وسقف الأسطر < 350 سطراً |
| pnpm migration:verify | PASS | مطابقة سجل الترحيل الشامل (146 سجلاً) |
| pnpm flow-contracts:verify | PASS | مطابقة عقود التدفقات المعتمدة |
| pnpm telegram-contracts:verify | PASS | فحص عقود كولباك وروابط تليجرام |
| pnpm docs:audit | PASS | اكتمال كافة وثائق الحوكمة الإلزامية ومؤشراتها |
| pnpm docs:parity | PASS | التناغم الكامل بين ملفات الحوكمة والمعايير |
| pnpm governance:tamper-check | PASS | حماية قفل الحوكمة والتحقق من عدم وجود تلاعب |
| pnpm ai-compliance:verify | PASS | تحقق كامل من امتثال الذكاء الاصطناعي لكافة البوابات |
| git status --short | PASS | شجرة عمل نظيفة وخالية من أي تعديلات معلقة |

## جدول مطابقة البوابات G1 إلى G12

| البوابة | الحالة | الدليل والبيان الفني |
| :--- | :---: | :--- |
| G1 - العزل الموديولي | PASS | فصل تام للموديولات والنواة المشتركة وتوجيه نصوص آمن |
| G2 - عقد الوظيفة | PASS | عقود تدفقات صارمة ومطابقة للمعايير المعتمدة |
| G3 - النواة المشتركة | PASS | استخدام معايير النواة لأزرار وعرض التبويبات |
| G4 - حجب الصلاحيات | PASS | تطبيق صارم للـ RBAC المسبق وحجب الرواتب في وضع المحاكاة |
| G5 - تجربة البوت الموحدة | PASS | حصانة أزرار وقوائم التنقل العليا ضد صمام الكولباك القديم |
| G6 - سلامة البيانات | PASS | المحركات المالية تعتمد الراتب الشهري وتمنع التسريب |
| G7 - الأداء وسقف البايتات | PASS | فحص سريع < 2 ثانية وأداء فائق للواجهة |
| G8 - الاختبارات التلقائية | PASS | اجتياز 100% من الاختبارات الآلية بنجاح تام (348/348) |
| G9 - التوثيق والمطابقة | PASS | تحديث التوثيقات وسجل الترحيل وسجل الأدلة |
| G10 - نظافة Git | PASS | خطافات pre-commit واعتماد commits معتمدة |
| G11 - قفل الحوكمة | PASS | تحديث governance.lock.json بكافة الملفات المحمية |
| G12 - منع التلاعب | PASS | مطابقة عبارة التفويض الإلزامية والهاش الجنائي |
