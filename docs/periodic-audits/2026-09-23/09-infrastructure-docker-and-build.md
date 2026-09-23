# المحور 09: البنية التحتية وDocker والبناء
## Infrastructure, Docker & Build Pipeline Audit

> **تاريخ التدقيق:** 2026-09-23  
> **المرجعية:** ميثاق `GEMINI.md` البند 3 و 4، ملفات Docker، وخطوات CI/CD  
> **المدقق:** المهندس المعماري المؤسسي والمدقق التقني المستقل (`/saleh`)

---

### 1. الدرجة والوزن
- **الدرجة:** **82 / 100**
- **الوزن المستخدم في الحساب:** **5**
- **المساهمة في الدرجة الإجمالية:** **4.10%**

---

### 2. الخلاصة
تكوينات الحاويات والبناء مصممة باحترافية عالية تعتمد نمط البناء متعدد المراحل (Multi-Stage Docker Build) على أساس `node:24-alpine`، مع مراعاة أمن الحاويات بالتشغيل كمستخدم غير جذري (`USER node`) واستخدام `dumb-init` لإدارة الإشارات والإيقاف المنظم (Graceful Shutdown). بيئة Compose تعزل الخدمات الحساسة (Postgres و Redis) في شبكة داخلية معزولة مع تطبيق فحوصات الجاهزية. نقطة الضعف تكمن في تضخم حجم صورة الـ Runner بنسخ أدوات التطوير ومصدر TypeScript بالكامل بدلاً من عزل مخرجات الإنتاج فقط.

---

### 3. التغطية
- **المكونات والملفات المفحوصة:**
  - ملف البناء الرئيسي للبوت: [`docker/Dockerfile`](file:///f:/Alsaada-Smart-Bot/docker/Dockerfile).
  - ملف بناء الداشبورد: [`docker/Dockerfile.dashboard`](file:///f:/Alsaada-Smart-Bot/docker/Dockerfile.dashboard).
  - تكوين الخدمات الموحدة: [`docker-compose.yml`](file:///f:/Alsaada-Smart-Bot/docker-compose.yml).
  - خط أنابيب البناء الآلي: [`.github/workflows/ci.yml`](file:///f:/Alsaada-Smart-Bot/.github/workflows/ci.yml).
- **أوامر التحقق المنفذة:**
  - فحص بناء الحاوية في مسار الـ CI (`docker build -t alsaada-bot:local -f docker/Dockerfile .`).

---

### 4. تقييم الجوانب الفرعية

| الجانب الفرعي | الحالة | الملاحظات والنتيجة |
|:---|:---:|:---|
| **الأمان وصلاحيات الحاوية (Non-Root)** | **سليم بنسبة 100%** | العمل بمستخدم `node:node` دون صلاحيات Root. |
| **إدارة الإشارات والإيقاف المنظم** | **سليم بنسبة 100%** | استخدام `dumb-init` لمعالجة SIGTERM و SIGINT وتفادي Zombie Processes. |
| **عزل الشبكات والخدمات الحساسة** | **سليم** | شبكة داخلية `alsaada-enterprise-internal` لقاعدة البيانات والكاش. |
| **فحوص الجاهزية (Healthchecks)** | **سليم** | فحوص نشطة لـ PostgreSQL و Redis قبل تشغيل البوت. |
| **حجم الصورة وعزل مخرجات الإنتاج** | **يحتاج تحسينًا** | نسخ كامل مجلد `/app` بما فيه devDependencies ومصدر TS لطور الـ Runner. |
| **فحص الجاهزية لحاوية البوت** | **يحتاج تحسينًا** | غياب فحص healthcheck على حاوية البوت ذاتها في Compose. |

---

### 5. النتائج المفصلة

#### نتيجة 9.1: تضخم حجم صورة الإنتاج النهائية (Runner Image Bloat)
- **الوصف والأثر:** في السطر 110 من `docker/Dockerfile`، يتم تنفيذ:  
  `COPY --from=builder --chown=node:node /app /app`  
  مما ينقل كامل مجلد العمل بما فيه ملفات TypeScript، وإعدادات tsconfig، وأدوات الحوكمة، ومخلفات البناء ومكتبات الـ devDependencies إلى صورة الإنتاج، مما يضاعف حجم الصورة ويزيد من مساحة الهجوم السطحية غير الضرورية.
- **مستوى الخطورة:** **Minor**
- **حالة الدليل:** **مؤكدة** ([`docker/Dockerfile#L110`](file:///f:/Alsaada-Smart-Bot/docker/Dockerfile#L110)).

#### نتيجة 9.2: غياب فحص الجاهزية لحاوية البوت في Docker Compose
- **الوصف والأثر:** حاوية `bot` في `docker-compose.yml` تعتمد على جاهزية Postgres و Redis، لكنها لا تحتوي فحصاً ذاتياً (`healthcheck`) للتأكد من استجابة خادم البوت على منفذ 3000.
- **مستوى الخطورة:** **Minor**
- **حالة الدليل:** **مؤكدة** ([`docker-compose.yml#L53-L88`](file:///f:/Alsaada-Smart-Bot/docker-compose.yml#L53-L88)).

---

### 6. الحلول المقترحة
1. **عزل مخرجات الإنتاج فقط في طور التشغيل:**
   استخدام `pnpm --filter @alsaada/bot-server --prod deploy /app/deployed` لنسخ ملفات الـ dist ومكتبات الإنتاج فقط إلى الـ Runner.
2. **إضافة فحص جاهزية لحاوية البوت في Docker Compose:**
   ```yaml
   healthcheck:
     test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/health || exit 1"]
     interval: 15s
     timeout: 5s
     retries: 3
   ```

---

### 7. المخاطر المتبقية
- استهلاك مساحة تخزين زائدة في خوادم النشر وبطء عمليات السحب (Image Pull).

---

### 8. الأولويات
1. تحديث `docker/Dockerfile` لعزل مخرجات الإنتاج وتقليص الحجم (الجهد: 1 ساعة).
2. إضافة healthcheck للبوت في `docker-compose.yml` (الجهد: 15 دقيقة).
