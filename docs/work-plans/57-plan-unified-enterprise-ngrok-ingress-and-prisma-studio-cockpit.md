# 📋 خطة العمل الموحدة رقم 57 (المعتمدة والنهائية): المنظومة السيادية للربط الشبكي الدائم وقمرة استوديو قاعدة البيانات
## Master Plan 57 (Unified Enterprise Ingress & Database Studio Cockpit Architecture): Permanent Ngrok Container, Network DMZ, Authenticated Studio Reverse Proxy & Forensic Safety Suite

> [!IMPORTANT]
> **مقررات جلسات الاستيضاح المعماري (`/grill-me`) والنقد الأمني والقواعدي المعتمد وتوجيه المستخدم بالدمج:**
> تدمج هذه الوثيقة الشاملة مخرجات **الخطة 57** (استوديو قاعدة البيانات الحصري للسوبر أدمن) و **الخطة 58** (حاوية Ngrok الدائمة والمستقرة في Docker) في هيكلية هندسية واحدة متناغمة.
> تحقق هذه المعمارية الموحدة: **ثبات النفق الدائم أمام عمليات إعادة البناء (`Zero-Break on Rebuild`)، إمكانية إدارة استوديو بريزما عن بُعد بأمان عبر النفق دون Mixed Content، عزل شبكة قاعدة البيانات (DMZ)، صمام إغلاق الخمول الآلي لمقابس Postgres، وفك وقفل الحوكمة التشفيرية لمرة واحدة.**

---

## 🏛️ مصفوفة المعمارية الموحدة (Unified Architecture Matrix)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    UNIFIED MASTER ARCHITECTURE MATRIX                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 1️⃣ نفق Ngrok الدائم (Compose Service)       │ استهداف dashboard:3002 عبر DNS الداخلي    │
│ 2️⃣ العزل الشبكي لقواعد البيانات (Strict DMZ) │ حظر Ngrok من شبكة Postgres الداخلية نهائياً │
│ 3️⃣ الوكيل العكسي للاستوديو (Reverse Proxy)    │ تدفق استوديو بريزما عبر الداشبورد و Ngrok   │
│ 4️⃣ صمام الخمول التلقائي (15-Min Watchdog)   │ إغلاق الاستوديو تلقائياً لمنع استنزاف المقابس │
│ 5️⃣ درع التحذير الجنائي وحماية التشفير       │ حظر الحذف الصلب وتعديل الحقول المشفرة       │
│ 6️⃣ فك وإعادة قفل الحوكمة التشفيرية (Lock)    │ تفويض تشفيري موحد لـ docker-compose.yml     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗺️ خريطة تدفق الاتصال والأمان الشبكي (End-to-End Secure Flow)

```
[مستخدم السوبر أدمن عن بُعد (Mobile / Desktop)]
       │
       ▼ (HTTPS مشفر)
[نفق Ngrok الثابت: enquirer-hardening-penny.ngrok-free.dev]
       │
       ▼ (داخل شبكة alsaada-enterprise-public)
[حاوية الداشبورد: dashboard:3002] ──► [فحص الجلسة: user.role === 'SUPER_ADMIN']
       │                                     │
       │ (Proxy: /api/admin/studio/proxy)     ▼ (رفض أي دور آخر 403)
       ▼
[استوديو بريزما: 127.0.0.1:5555 أو studio:5555]
       │
       ▼ (داخل شبكة alsaada-enterprise-internal المعزولة فقط)
[قاعدة بيانات PostgreSQL: postgres:5432]
```

---

### 1️⃣ المحور الأول: ملف إعدادات النفق المخصص وحقن الترويسات (`docker/ngrok/ngrok.yml`)
1. **إنشاء ملف التكوين المعياري:**
   - المسار: `docker/ngrok/ngrok.yml`
   - المحتوى المعتمد:
     ```yaml
     version: "3"
     agent:
       authtoken: ${NGROK_AUTHTOKEN}
     endpoints:
       - name: dashboard
         url: https://${NGROK_DOMAIN:-enquirer-hardening-penny.ngrok-free.dev}
         upstream:
           url: http://dashboard:3002
           protocol: http
         host_header: rewrite
         request_header:
           add:
             ngrok-skip-browser-warning: "true"
             x-forwarded-proto: "https"
     ```
2. **الضمانات التقنية:**
   - **`host_header: rewrite`**: يمنع تصادم ترويسات المضيف وتوافق 100% مع حماية Origin Guard في Next.js.
   - **`ngrok-skip-browser-warning: "true"`**: يتجاوز صفحة التحذير المجانية (`ERR_NGROK_6024`) ويضمن عمل الـ APIs والـ Webhooks دون أدنى انقطاع.
   - **تعدد الأنفاق (Multi-Tunnel Ready):** يتيح إضافة خدمات مستقبلية (مثل `n8n` أو البوت) بسطرين إضافيين فقط.

---

### 2️⃣ المحور الثاني: هندسة حاويات Docker والعزل الشبكي الصارم (`docker-compose.yml`)
1. **إدراج خدمة `ngrok` كحاوية رسمية دائمة:**
   ```yaml
   # -------------------------------------------------------------
   # 6. Ngrok Secure Enterprise Tunnel (Hardened Permanent Ingress)
   # -------------------------------------------------------------
   ngrok:
     image: ngrok/ngrok:latest
     container_name: alsaada_enterprise_ngrok
     restart: unless-stopped
     volumes:
       - ./docker/ngrok/ngrok.yml:/etc/ngrok.yml:ro
     command:
       - "start"
       - "--all"
       - "--config=/etc/ngrok.yml"
     environment:
       NGROK_AUTHTOKEN: ${NGROK_AUTHTOKEN}
       NGROK_DOMAIN: ${NGROK_DOMAIN:-enquirer-hardening-penny.ngrok-free.dev}
     ports:
       - "127.0.0.1:4040:4040" # Localhost-only Web Inspection UI (Secured)
     depends_on:
       dashboard:
         condition: service_healthy
     networks:
       - alsaada-enterprise-public # STRICT DMZ: Forbidden from alsaada-enterprise-internal
   ```
2. **العزل الشبكي الصارم لقواعد البيانات (Strict DMZ Isolation):**
   - حاوية `ngrok` تنتمي **حصراً إلى شبكة `alsaada-enterprise-public`**.
   - تُحظر تماماً من دخول شبكة `alsaada-enterprise-internal` التي تحتوي على `postgres` و `redis`.
   - الداشبورد (`dashboard`) هو الكيان الوسيط الوحيد المشترك بين الشبكتين ليعمل كبوابة جدار ناري (DMZ Gateway).
3. **صمود النفق أمام عمليات إعادة البناء (Rebuild Resilience):**
   - الارتباط المباشر باسم خدمة الدوكر `http://dashboard:3002` يحل مشكلة انقطاع النفق وتحوله إلى `<deleted>` نهائياً.

---

### 3️⃣ المحور الثالث: معمارية الوكيل العكسي الداخلي للاستوديو (Studio Reverse Proxy)
1. **مسار الوكيل الداخلي المشفر في Next.js:**
   - المسار: `apps/admin-dashboard/src/app/api/admin/studio/proxy/[...path]/route.ts`
   - يتولى الوكيل:
     * فحص كوكيز جلسة المستخدم والتحقق الصارم من أن `user.role === 'SUPER_ADMIN'`، والرد بـ `403 Forbidden` فورياً لأي رتبة أخرى.
     * تمرير طلبات الـ HTTP والـ Assets داخلياً إلى المنفذ 5555 (`127.0.0.1:5555` أو `studio:5555`).
     * القضاء التام على مشكلة **Mixed Content (HTTPS -> HTTP)**؛ لأن كافة الطلبات تتدفق عبر نفس نطاق الداشبورد المشفر (`https://enquirer-hardening-penny.ngrok-free.dev`).
     * إتاحة فتح وإدارة استوديو بريزما من أي مكان عن بُعد عبر النفق بسلاسة كاملة.

---

### 4️⃣ المحور الرابع: مدير العمليات وصمام إغلاق الخمول الآلي (`studio-process.ts`)
1. **صمام الأمان للخمول بعد 15 دقيقة (15-Minute Auto-Shutdown Watchdog):**
   - لحماية موارد الخادم ومنع استنزاف مجمّع اتصالات PostgreSQL (`Connection Pool Starvation`):
     * يقوم مدير العملية `studio-process.ts` بتشغيل مؤقت خمول تلقائي.
     * في حال انقطاع نشاط الاستوديو لأكثر من 15 دقيقة، يتم إيقاف العملية تلقائياً وتحرير كافة اتصالات قاعدة البيانات ومقابس الشبكة.
2. **تطهير العمليات اليتيمة (Zombie Process Reaping):**
   - فحص وتفريغ المنفذ 5555 تلقائياً قبل بدء أي جلسة جديدة لمنع أخطاء `EADDRINUSE`.
3. **التسجيل الجنائي للتشغيل والإيقاف (Audit Logging):**
   - قيد كل حدث تشغيل أو إيقاف في جدول `audit_logs` متضمناً معرّف السوبر أدمن `actorTelegramId`، الـ `ipAddress`، والبصمة الزمنية.

---

### 5️⃣ المحور الخامس: واجهة قمرة قيادة الاستوديو والدرع الجنائي (Cockpit UI & Shield)
1. **صفحة الخادم وحراسة الصلاحيات السيادية:**
   - المسار: `apps/admin-dashboard/src/app/admin/settings/prisma-studio/page.tsx`
   - فحص `requireDashboardUser()` وإعادة توجيه فورية لأي دور غير `SUPER_ADMIN`.
2. **مكون العميل وقمرة التحكم (`prisma-studio-client.tsx`):**
   - **شريط الأدوات العلوي:**
     * شارة الحالة الحية (نبض أخضر متصل / رمادي متوقف) مع عداد تنازلي لمؤقت الخمول.
     * زر التشغيل / الإيقاف السريع مع مؤشر تحميل.
     * زر التكبير ملء الشاشة (Fullscreen Toggle).
     * زر فتح في نافذة مستقلة عبر مسار البروكسي الداخلي.
   - **الدرع الأمني والتحذير الجنائي (Forensic Integrity Shield):**
     * شريط تحذيري كهرماني/أحمر يوضح حظر تعديل الحقول المشفرة بـ AES-256-GCM (`nationalIdEncrypted`, `phoneEncrypted`).
     * حظر الحذف الفيزيائي الصلب لمنع تدمير سجلات `FinancialLedger` وكسر الحذف الناعم.
     * زر سريع يوجه السوبر أدمن لشاشة **«استوديو تصحيح البيانات»** المعتمدة للحذف الناعم الآمن.
   - **الإطار المدمج المتكيف:**
     * `<iframe>` مؤطر بارتفاع `h-[800px]` يشير إلى مسار البروكسي الداخلي `/api/admin/studio/proxy`.
     * بطاقة تشغيل صفرية أنيقة (Zero-State Launcher) عند توقف الخدمة.
     * توافق تام بنسبة 100% مع الوضعين الليلي والنهاري (Dark & Light Mode).
3. **القائمة الجانبية (Dual-Rail Sidebar) والبيان المعماري:**
   - إضافة عنصر الملاحة تحت قسم "الإعدادات والنظام" باسم **«استوديو قاعدة البيانات (Prisma)»** بأيقونة `Database`، يظهر حصرياً لدور `SUPER_ADMIN`.
   - تسجيل الميزة برقم كودي في [`dashboard.manifest.ts`](file:///f:/Alsaada-Smart-Bot/apps/admin-dashboard/src/dashboard.manifest.ts).

---

### 6️⃣ المحور السادس: بروتوكول الحوكمة وفك وقفل البنية التحتية تشفيرياً (Governance Protocol)
1. **فك قفل البنية التحتية التشفيري (Single Controlled Unlock):**
   - تشغيل أمر فك القفل المصرح:
     `pnpm scaffold:unlock-docker "موافق على الفتح" "دمج حاوية Ngrok الدائمة وقمرة استوديو قاعدة البيانات الموحدة"`
2. **تطبيق التعديلات البرمجية وتكوينات الحاويات:**
   - كتابة `docker/ngrok/ngrok.yml`.
   - تعديل `docker-compose.yml`.
   - إنشاء ملفات البروكسي والواجهة في `apps/admin-dashboard`.
3. **إعادة القفل التشفيري الصارم (Cryptographic Lock):**
   - تشغيل `pnpm scaffold:lock-docker` لتحديث الهاشات التراكمية في `governance.lock.json`.
   - تشغيل فحص الحوكمة: `npx vitest tools/governance/tests/docker-governance-lock.spec.ts`.

---

## 🧪 خطة التحقق والاختبار الشاملة (Unified Verification Suite)

1. **اختبارات الصلاحيات والحراسة (RBAC & Proxy Security):**
   - إنشاء `apps/admin-dashboard/tests/prisma-studio-rbac.spec.ts`:
     * فحص السماح لـ `SUPER_ADMIN` بالوصول إلى الصفحة وبروكسي الاستوديو.
     * فحص حظر `GENERAL_ADMIN` و `FIELD_ADMIN` برمز `403 Forbidden` وإعادة التوجيه.
2. **فحص تكوين الدوكر والشبكات:**
   - `docker compose config` للتحقق من سلامة بناء الـ YAML وتمرير المتغيرات.
   - التحقق من عزل شبكة قاعدة البيانات عن حاوية Ngrok عبر `docker inspect`.
3. **فحص بقاء النفق واستقراره (Rebuild Resilience):**
   - محاكاة إعادة بناء الحاوية والتأكد من بقاء الرابط ثابتاً دون انقطاع ودون ظهور `<deleted>`.
4. **فحص الأنواع والبناء الشامل:**
   - `pnpm --filter @alsaada/admin-dashboard typecheck` (Exit 0).
   - `pnpm --filter @alsaada/admin-dashboard test` (All tests passing).
   - `pnpm --filter @alsaada/admin-dashboard build` (Production build exit 0).
