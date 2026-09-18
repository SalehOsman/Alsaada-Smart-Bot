# ترخيص فك قفل الحوكمة: البنية التحتية والدوكر (Docker Infrastructure)

- **التاريخ:** 2026-09-18
- **المكون:** Docker & Infrastructure Configuration
- **المسار:** `docker/` و `docker-compose.yml`
- **عبارة الاعتماد الصريحة المعتمدة:** **موافق على الفتح**
- **عبارة الحوكمة العامة:** موافق على التعديل او الايقاف او الحذف
- **Target-Paths:** .dockerignore, docker-compose.yml, docker/Dockerfile, docker/Dockerfile.dashboard, docker/Dockerfile.docs, docker/nginx-docs.conf, docker/postgres/init-scripts/01-init-security.sql

## المبرر وأسباب التعديل (Reason)
إصلاح مسار نسخ ملفات ومصادر apps/docs في docker/Dockerfile.docs لمنع مسح أو استبدال عقد node_modules وروابط حزمة astro التابعة لمنظومة المونوريبو مع تحصين قواعد .dockerignore

## نطاق التعديل المرخص
تم رفع القفل التشفيري عن ملفات تكوين الحاويات والبنية التحتية:
- `.dockerignore`
- `docker-compose.yml`
- `docker/Dockerfile`
- `docker/Dockerfile.dashboard`
- `docker/Dockerfile.docs`
- `docker/nginx-docs.conf`
- `docker/postgres/init-scripts/01-init-security.sql`

فور الانتهاء من العمل البرمجي واجتياز كافة الاختبارات، يلزم إعادة ختم وحماية ملفات الدوكر عبر:
`pnpm docker:lock`
