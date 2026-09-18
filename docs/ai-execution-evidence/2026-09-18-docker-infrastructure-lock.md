# توثيق القفل التشفيري للبنية التحتية والدوكر (Docker Infrastructure Lock)

- **التاريخ:** 2026-09-18
- **الحالة:** 🔒 مقفل ومحمي تشفيرياً (Immutable Sealed)
- **المكون:** Docker & Infrastructure Configuration
- **المسار الأساسي:** `docker/` و `docker-compose.yml`
- **عبارة التفويض المعتمدة:** موافق على التعديل او الايقاف او الحذف
- **صيغ فك القفل الحرفية الحصرية:** «نعم موافق على التعديل» أو «موافق على الفتح»
- **Target-Paths:** .dockerignore, docker-compose.yml, docker/Dockerfile, docker/Dockerfile.dashboard, docker/Dockerfile.docs, docker/nginx-docs.conf, docker/postgres/init-scripts/01-init-security.sql

---

### الملفات المقفولة وتجزئاتها الرقمية (SHA-256):

- `.dockerignore`: `865f3560cd73f005a383c3215541b20dc4e796866ac0d0a0fcecbed1ffffb270`
- `docker-compose.yml`: `b96468c5159dc5a4401e3af96f96e028dffb0c082ba844a2e80bfe107eff6698`
- `docker/Dockerfile`: `c0f6a2a6a10bc3dd20bb64169f521bcc0cbbf876b1656b6f140909a72ab4b33b`
- `docker/Dockerfile.dashboard`: `7d0eae5f706fbfcc7e4325fe286e07657746689eed256b077533c98e2a5315b2`
- `docker/Dockerfile.docs`: `3b853dcb4d899eef774fcc9f3d4e2c12219dd8a05d9d5eafa39841982873aa79`
- `docker/nginx-docs.conf`: `2e02c009f7788ff9b8893f5673eac933dd488c16b8ca4664a23f77503b784bfa`
- `docker/postgres/init-scripts/01-init-security.sql`: `98ab41d13fef4f41d5e6d9893055a7ef61b82de5e98553969dd2c6734535123f`

---

### قواعد الحوكمة الصارمة:
1. يُحظر تعديل أي بايت في ملفات الدوكر أو ملفات التركيب دون فك القفل الصريح عبر:
   `pnpm docker:unlock --phrase="<عبارة_الموافقة>" --reason="<سبب_مفصل_أكثر_من_10_أحرف>"`
2. أي تعديل غير مصرح به يؤدي إلى فشل فوري في `pnpm governance:tamper-check` وخطافات Git.
3. فور الانتهاء من التعديل المرخص، يلزم إعادة القفل عبر `pnpm docker:lock`.
