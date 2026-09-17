# توثيق القفل التشفيري للبنية التحتية والدوكر (Docker Infrastructure Lock)

- **التاريخ:** 2026-09-17
- **الحالة:** 🔒 مقفل ومحمي تشفيرياً (Immutable Sealed)
- **المكون:** Docker & Infrastructure Configuration
- **المسار الأساسي:** `docker/` و `docker-compose.yml`
- **عبارة التفويض المعتمدة:** موافق على التعديل او الايقاف او الحذف
- **صيغ فك القفل الحرفية الحصرية:** «نعم موافق على التعديل» أو «موافق على الفتح»
- **Target-Paths:** .dockerignore, docker-compose.yml, docker/Dockerfile, docker/Dockerfile.dashboard, docker/postgres/init-scripts/01-init-security.sql

---

### الملفات المقفولة وتجزئاتها الرقمية (SHA-256):

- `.dockerignore`: `88fdceab587d2bfbbee134bda990fe94a8c41a3ab4c7b65f9c90ec543a3fbb43`
- `docker-compose.yml`: `39f816845bdcb1b2a64b6143e9b040d941ec8ddd307adeed9e0f9efc64b75445`
- `docker/Dockerfile`: `c0f6a2a6a10bc3dd20bb64169f521bcc0cbbf876b1656b6f140909a72ab4b33b`
- `docker/Dockerfile.dashboard`: `7d0eae5f706fbfcc7e4325fe286e07657746689eed256b077533c98e2a5315b2`
- `docker/postgres/init-scripts/01-init-security.sql`: `98ab41d13fef4f41d5e6d9893055a7ef61b82de5e98553969dd2c6734535123f`

---

### قواعد الحوكمة الصارمة:
1. يُحظر تعديل أي بايت في ملفات الدوكر أو ملفات التركيب دون فك القفل الصريح عبر:
   `pnpm docker:unlock --phrase="<عبارة_الموافقة>" --reason="<سبب_مفصل_أكثر_من_10_أحرف>"`
2. أي تعديل غير مصرح به يؤدي إلى فشل فوري في `pnpm governance:tamper-check` وخطافات Git.
3. فور الانتهاء من التعديل المرخص، يلزم إعادة القفل عبر `pnpm docker:lock`.
