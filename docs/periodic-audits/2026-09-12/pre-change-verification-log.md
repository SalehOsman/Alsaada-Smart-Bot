# سجل خط الأساس قبل تنفيذ PLAN-20 — 12-09-2026

## هوية النسخة

- Git HEAD: 71dbc5242ab685f1c9d04ee789f3daf1b473addc
- الفرع: main
- Node.js: v24.11.1
- pnpm: 11.0.8
- طريقة التنفيذ: مساحة العمل الحالية بتفويض المستخدم، لأن apps/admin-dashboard وpackages/telemetry غير متتبعتين ولا يمكن نقلهما بأمان إلى worktree مبني من HEAD.
- الملفات غير المرتبطة المحمية من التعديل: تغييرات modules/workforce الحالية وباقي تعديلات المستخدم خارج نطاق PLAN-20.

## نسخة قاعدة البيانات

- الملف المحلي المستبعد من Git: .scratch/plan20-prechange.dump
- النوع: PostgreSQL custom dump
- قاعدة المصدر: alsaada_db
- إصدار PostgreSQL: 16.15
- الحجم: 200271 بايت
- SHA-256: 568F240B152484AE62CAE60377B4A4790CFEF88A1E9499BD84D1044B3FBD5CC1
- تحقق القراءة: نجح pg_restore -l وأظهر 381 مدخلاً.

## الخدمات قبل الإصلاح

| الخدمة | الحالة |
|---|---|
| postgres | تعمل وHealthy |
| redis | تعمل وHealthy |
| bot | تعمل |
| studio | تعمل |
| dashboard | غير موجودة ضمن الحاويات العاملة |

## حالة Prisma الفعلية

- prisma validate: المخطط صالح.
- prisma migrate status: Exit 1؛ الهجرة 20260911000000_init_enterprise_hash_ledger غير مطبقة.
- جدول _prisma_migrations: غير موجود في قاعدة البيانات.
- قاعدة البيانات أنشئت سابقاً خارج سجل Prisma Migrate، لذلك يمنع تشغيل migrate deploy مباشرة قبل إنشاء Baseline موثق.
- الأعمدة audit_logs.traceId وsystem_error_logs.traceId وsystem_error_logs.service غير موجودة.
- الجداول المالية التي تحتاج أعمدة hash تحتوي صفراً من السجلات وقت الفحص؛ لا توجد بيانات مالية تحتاج backfill في هذه البيئة.
- audit_logs: أربعة سجلات.
- system_error_logs: خمسة سجلات.

## قرار الأمان

يُنشأ أولاً اختبار قاعدة معزولة وفاشل يثبت الحقول المطلوبة. بعد ذلك تُسجل الهجرة الابتدائية كBaseline فقط بعد مقارنة المخطط، ثم تُطبق هجرة مصالحة إضافية ولا تُشغل SQL الإنشائية الابتدائية فوق الجداول القائمة.

