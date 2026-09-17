# ترخيص فك قفل الحوكمة: البنية التحتية والدوكر (Docker Infrastructure)

- **التاريخ:** 2026-09-17
- **المكون:** Docker & Infrastructure Configuration
- **المسار:** `docker/` و `docker-compose.yml`
- **عبارة الاعتماد الصريحة المعتمدة:** **نعم موافق على التعديل**
- **عبارة الحوكمة العامة:** موافق على التعديل او الايقاف او الحذف
- **Target-Paths:** .dockerignore, docker-compose.yml, docker/Dockerfile, docker/Dockerfile.dashboard, docker/ngrok/ngrok.yml, docker/postgres/init-scripts/01-init-security.sql

## المبرر وأسباب التعديل (Reason)
Purge standalone ngrok service to use official Docker Desktop extension

## نطاق التعديل المرخص
تم رفع القفل التشفيري عن ملفات تكوين الحاويات والبنية التحتية:
- `.dockerignore`
- `docker-compose.yml`
- `docker/Dockerfile`
- `docker/Dockerfile.dashboard`
- `docker/ngrok/ngrok.yml`
- `docker/postgres/init-scripts/01-init-security.sql`

فور الانتهاء من العمل البرمجي واجتياز كافة الاختبارات، يلزم إعادة ختم وحماية ملفات الدوكر عبر:
`pnpm docker:lock`
