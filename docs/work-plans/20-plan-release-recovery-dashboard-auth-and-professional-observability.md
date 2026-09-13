# Release Recovery, Dashboard Authentication, and Professional Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** استعادة الدخول الآمن للوحة التحكم، جعل سجل الحوادث الداخلي موثوقاً ومحمياً، وإنشاء بوابة تحقق تمنع الإعلان عن إصدار سليم قبل إثبات ذلك.

**Architecture:** يكون SystemErrorLog / Incident Vault في PostgreSQL مرجع الحقيقة للحوادث مع traceId موحد، Redaction قبل التخزين، ودورة حالة قابلة للتدقيق. تتصل البوتات وNext بمكتبة عقود telemetry نقية؛ ويعالج OpenTelemetry Collector السجلات والتتبعات إلى Grafana Loki وTempo خارج مسار الطلب. لا يُستبدل سجل الحوادث الداخلي بـSentry أو خدمة SaaS.

**Tech Stack:** TypeScript 5.9، Node 22، Next.js 15، Grammy، Prisma/PostgreSQL 16، Redis 7، Vitest 3، Docker Compose، OpenTelemetry Collector، Grafana Loki، Grafana Tempo، Grafana.

---

## قواعد التنفيذ والحالة

- هذه الخطة تصحح نتائج التدقيق في docs/periodic-audits/2026-09-12/project-assessment-and-remediation-evidence.md.
- لا تبدأ أي مهمة Schema أو Docker أو CI قبل تسجيل نسخة Git الحالية ونسخة احتياطية قابلة للاستعادة لقاعدة البيانات. لا تغيّر تدفقات أعمال أو سلوكاً مرجعياً من F:\HR.
- لا تُسجَّل أي خطوة «مكتملة» في docs/19 أو docs/work-plans/README.md إلا بعد تنفيذ جميع أوامر التحقق في المهمة الخاصة بها وCommit حقيقي.
- لا تستبدل الفشل بـ catch صامت، ولا تسجل توكنات أو cookies أو أرقاماً قومية أو payload خاماً في logs أو Alerts.
- **شرط النضج الدائم الملزم بعد إغلاق PLAN-20:** كل وظيفة جديدة أو تعديل وظيفي يجب أن يرتبط بعقد تسجيل الحوادث الموحد الصادر من @alsaada/telemetry، وأن يثبت باختبار آلي أن الخطأ يصل إلى Incident Vault بمعرف traceId بعد حجب البيانات الحساسة. يحظر في كود الإنتاج استخدام console.error مباشرة أو catch صامت خارج المنظومة؛ والمخالفة تفشل بوابة الحوكمة ولا يجوز اعتماد الوظيفة أو تسجيلها مكتملة في docs/19.
- الاستثناء التقني الوحيد هو Emergency Sink المحدد داخل نواة telemetry عند تعطل مخزن الحوادث نفسه؛ يستخدم process.stderr.write برسالة محجوبة ومحدودة تحمل traceId، ولا يستخدم console.error ولا يبتلع الخطأ.
- المهاجرات وتعديل قاعدة البيانات يراجعهما منفذ لديه صلاحية squad-finance-security أو squad-architecture-devops؛ بوابة QA لا تتنازل عن أي فشل.

## خريطة الملفات المقفلة قبل التنفيذ

| المسار | العملية | المسؤولية |
|---|---|---|
| packages/database/prisma/schema.prisma | تعديل | نماذج trace وclaim الرابط السحري وحقول دورة الحادث. |
| packages/database/prisma/migrations/20260912090000_add_trace_incidents_and_magic_claim/migration.sql | إنشاء | تطبيق تدريجي للحقول والفهارس والجداول الناقصة. |
| apps/admin-dashboard/src/app/api/auth/magic/route.ts | تعديل | HMAC، user authorization، claim ذري، audit transaction، response آمن. |
| apps/admin-dashboard/src/app/api/telemetry/incidents/route.ts | إنشاء | مدخل أخطاء المتصفح المحدود والمصادق عليه. |
| apps/admin-dashboard/src/lib/incident-reporter.ts | إنشاء | Reporter server-side لمسارات Next. |
| apps/admin-dashboard/src/app/error.tsx وglobal-error.tsx | تعديل | إرسال minimal browser incident وإظهار رمز آمن. |
| apps/admin-dashboard/src/instrumentation.ts | إنشاء | تهيئة trace في runtime الخادم فقط. |
| apps/bot-server/src/services/error-vault.service.ts | تعديل | sanitize، fingerprint، كتابة حادثة، queue للتنبيه، ودورة حالة. |
| apps/bot-server/src/middlewares/telemetry.middleware.ts | تعديل | traceId لكل update وربط log وbreadcrumb. |
| apps/bot-server/src/handlers/dashboard.handler.ts | تعديل | HTTPS guard، fallback، وIncident دقيق عند فشل Telegram. |
| packages/telemetry/src/incidents.ts وindex.ts | إنشاء/تعديل | أنواع نقية ومُطبّع الأخطاء وredaction وtrace contract. |
| docker/Dockerfile وdocker/Dockerfile.dashboard | تعديل | تضمين telemetry manifest وبنائه قبل التطبيقات. |
| docker-compose.observability.yml | إنشاء | profile منفصل للـCollector وLoki وTempo وGrafana. |
| .github/workflows/ci.yml | تعديل | قاعدة اختبار بالمهاجرات، typecheck لكل workspace، واختبار الصورتين. |
| package.json و.gitignore | تعديل | أوامر تحقق سليمة وتجاهل مخرجات Next. |
| AGENTS.md وGEMINI.md وdocs/14-ai-agent-governance-and-file-rules.md وdocs/21-mandatory-module-architecture-and-gates.md | تعديل بعد التفويض الحرفي المحمي | جعل عقد التسجيل الموحد قاعدة دائمة ملزمة لجميع أدوات الذكاء الاصطناعي والمطورين. |
| tools/governance/verify-observability-contract.ts واختباره | إنشاء بعد التفويض الحرفي المحمي | رفض console.error وcatch الصامت والتحقق من مسار Incident الموحد في كود الإنتاج. |
| docs/19-legacy-to-enterprise-master-feature-migration-registry.md وdocs/work-plans/README.md | تعديل في النهاية | الحقيقة النهائية فقط، مع Commit ودليل تحقق. |

## معايير القبول العامة

    pnpm lint
    pnpm test
    pnpm governance:verify
    pnpm build
    docker build -f docker/Dockerfile .
    docker build -f docker/Dockerfile.dashboard .
    git status --short

جميع الأوامر يجب أن تنهي Exit 0، ولا يظهر P2022 أو خطأ اتصال قاعدة بيانات غير معالج في بناء Next، ولا تظهر مخرجات بناء أو ملفات عشوائية في Git.

### Task 1: تثبيت خط الأساس ومنع نشر إصدار معيب

**Files:**
- Create: docs/periodic-audits/2026-09-12/pre-change-verification-log.md
- Modify: لا شيء في الكود.
- Test: لا ينطبق؛ هذه مهمة دليل وتشغيل.

- [ ] **Step 1: تسجيل نسخة المستودع والحالة قبل التعديل.**

    git rev-parse HEAD
    git status --short
    pnpm --version
    node --version
    docker compose ps

دوّن hash وملخص الملفات المعدلة والحاويات في pre-change-verification-log.md. لا تضف أو تحذف تغييرات المستخدم الحالية.

- [ ] **Step 2: أخذ نسخة PostgreSQL قابلة للاستعادة والتحقق منها.**

    New-Item -ItemType Directory -Force .scratch
    docker compose exec -T postgres pg_dump -U alsaada_admin -d alsaada_db -Fc > .scratch/plan20-prechange.dump
    Get-FileHash .scratch/plan20-prechange.dump -Algorithm SHA256

استخدم الحساب واسم قاعدة بيانات البيئة الفعليين إذا اختلفا عن القيم الافتراضية، وسجل الاسم والحجم وSHA-256 في السجل. لا تطبق migration إن فشل النسخ أو لم يمكن قراءة ملف النسخة.

- [ ] **Step 3: إثبات الانحراف قبل علاجه.**

    pnpm --filter @alsaada/database exec prisma migrate status --schema prisma/schema.prisma
    docker compose exec -T postgres psql -U alsaada_admin -d alsaada_db -c "\d+ audit_logs"
    docker compose exec -T postgres psql -U alsaada_admin -d alsaada_db -c "\d+ system_error_logs"

**Expected:** تظهر أعمدة traceId وservice غائبة أو تظهر Prisma migrations غير مطبقة. إن اختلفت البيئة عن هذا الدليل، توقف عن مسار الإصلاح وسجل الفرق؛ لا تفترض بنية قاعدة البيانات.

- [ ] **Step 4: Commit الدليل فقط.**

    git add docs/periodic-audits/2026-09-12/pre-change-verification-log.md
    git commit -m "docs(audit): record plan 20 pre-change baseline"

### Task 2: مصالحة Prisma مع PostgreSQL وهجرة Incident/Magic Claim

**Files:**
- Modify: packages/database/prisma/schema.prisma
- Create: packages/database/prisma/migrations/20260912090000_add_trace_incidents_and_magic_claim/migration.sql
- Create: packages/database/tests/migration-trace-and-magic-claim.spec.ts

- [ ] **Step 1: اكتب اختبار Schema حي يفشل قبل الهجرة.**

    it('persists a traceable incident and allows one magic-link claim only', async () => {
      const traceId = crypto.randomUUID();
      await prisma.systemErrorLog.create({
        data: {
          traceId,
          service: 'admin-dashboard',
          errorReference: '#ERR-TEST1',
          errorHash: 'aaaaaaaaaaaaaaaa',
          errorMessage: 'sanitized',
        },
      });
      await prisma.authMagicTokenConsumption.create({
        data: { jti: 'test-jti', actorTelegramId: 1n, traceId, expiresAt: new Date(Date.now() + 60_000) },
      });
      await expect(prisma.authMagicTokenConsumption.create({
        data: { jti: 'test-jti', actorTelegramId: 1n, traceId, expiresAt: new Date() },
      })).rejects.toMatchObject({ code: 'P2002' });
    });

شغّل الاختبار على قاعدة بيانات اختبار معزولة ومطبقة بالمهاجرات، لا على الإنتاج.

    pnpm --filter @alsaada/database test -- migration-trace-and-magic-claim.spec.ts

**Expected before implementation:** فشل بسبب غياب النموذج أو الأعمدة.

- [ ] **Step 2: حدّث نموذج Prisma دون حذف بيانات قائمة.**

أضف نموذج claim التالي، وأبق الحقول الموجودة متوافقة مع الأسماء الحالية:

    model AuthMagicTokenConsumption {
      id              String   @id @default(uuid())
      jti             String   @unique @db.VarChar(128)
      actorTelegramId BigInt
      traceId         String?  @db.VarChar(36)
      expiresAt       DateTime
      consumedAt      DateTime @default(now())

      @@index([expiresAt])
      @@index([traceId])
      @@map("auth_magic_token_consumptions")
    }

أضف فقط الحقول الضرورية إلى AuditLog وSystemErrorLog: traceId nullable، وservice بقيمة افتراضية للبوت. لا تجعل traceId إلزامياً قبل ترحيل كل المنتجين.

- [ ] **Step 3: أنشئ migration قابلة للتدقيق.**

يجب أن تحتوي SQL الناتجة على هذه العمليات المكافئة، مع مراجعة أسماء القيود التي يولدها Prisma قبل اعتمادها:

    ALTER TABLE "audit_logs" ADD COLUMN "traceId" VARCHAR(36);
    ALTER TABLE "system_error_logs" ADD COLUMN "traceId" VARCHAR(36);
    ALTER TABLE "system_error_logs" ADD COLUMN "service" TEXT NOT NULL DEFAULT 'bot-server';
    CREATE INDEX "audit_logs_traceId_idx" ON "audit_logs" ("traceId");
    CREATE INDEX "system_error_logs_traceId_idx" ON "system_error_logs" ("traceId");
    CREATE INDEX "system_error_logs_service_createdAt_idx" ON "system_error_logs" ("service", "createdAt");
    CREATE TABLE "auth_magic_token_consumptions" (
      "id" TEXT NOT NULL,
      "jti" VARCHAR(128) NOT NULL,
      "actorTelegramId" BIGINT NOT NULL,
      "traceId" VARCHAR(36),
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "auth_magic_token_consumptions_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX "auth_magic_token_consumptions_jti_key" ON "auth_magic_token_consumptions" ("jti");

أنشئها في قاعدة تطوير فقط:

    pnpm --filter @alsaada/database exec prisma migrate dev --name add_trace_incidents_and_magic_claim --schema prisma/schema.prisma

راجع diff الناتج؛ لا تنسخ SQL يدوياً فوق ملف ولّدته Prisma من دون مطابقة.

- [ ] **Step 4: طبّق واختبر الهجرة في قاعدة اختبار ثم Staging.**

    pnpm --filter @alsaada/database exec prisma migrate deploy --schema prisma/schema.prisma
    pnpm --filter @alsaada/database exec prisma migrate status --schema prisma/schema.prisma
    pnpm --filter @alsaada/database test -- migration-trace-and-magic-claim.spec.ts

**Expected:** Database schema is up to date والاختبار PASS. بعد موافقة مسؤول البيئة فقط، يكرر migrate deploy على Staging ثم الإنتاج، مع تسجيل توقيت وخروج الأمر.

- [ ] **Step 5: Commit.**

    git add packages/database/prisma/schema.prisma packages/database/prisma/migrations packages/database/tests/migration-trace-and-magic-claim.spec.ts
    git commit -m "fix(database): align trace schema and claim magic links atomically"

### Task 3: إعادة بناء Magic Login على transaction ذري وfail-closed

**Files:**
- Modify: apps/admin-dashboard/src/app/api/auth/magic/route.ts
- Modify: apps/admin-dashboard/tests/magic-auth.spec.ts
- Modify: apps/admin-dashboard/tests/auth-session.spec.ts
- Create: apps/admin-dashboard/tests/magic-auth.integration.spec.ts

- [ ] **Step 1: أضف اختبارات فشل قبل التنفيذ.**

    it('returns service_unavailable and creates no session when durable claim fails', async () => {
      prisma.authMagicTokenConsumption.create.mockRejectedValueOnce(new Error('database unavailable'));
      const response = await GET(makeMagicRequest(validToken));
      expect(new URL(response.headers.get('location')).searchParams.get('error')).toBe('service_unavailable');
      expect(response.cookies.get('alsaada_session')).toBeUndefined();
    });

    it('accepts one concurrent JTI claim and rejects the duplicate', async () => {
      const first = await GET(makeMagicRequest(validToken));
      const duplicate = await GET(makeMagicRequest(validToken));
      expect(first.status).toBe(307);
      expect(new URL(duplicate.headers.get('location')).searchParams.get('error')).toBe('token_already_used');
    });

- [ ] **Step 2: نفذ ترتيب القرار الآمن.**

بعد تحقق HMAC والصلاحية، اجلب المستخدم المصرح به. بعدها فقط نفذ prisma transaction التي تنشئ claim فريد للـJTI وتكتب AuditLog مع traceId. التقط Prisma unique constraint P2002 وأعد token_already_used. أي خطأ آخر يعيد login?error=service_unavailable ولا ينشئ session cookie.

    try {
      await prisma.$transaction(async (tx) => {
        await tx.authMagicTokenConsumption.create({
          data: { jti: payload.jti, actorTelegramId: targetTelegramId, traceId, expiresAt: new Date(payload.exp * 1000) },
        });
        await tx.auditLog.create({
          data: { traceId, actorTelegramId: targetTelegramId, action: 'AUTH_MAGIC_CONSUMED', entityType: 'AUTH_MAGIC_TOKEN', entityId: payload.jti },
        });
      });
    } catch (error) {
      if (isPrismaUniqueConstraint(error)) return redirect('token_already_used');
      return redirect('service_unavailable');
    }

لا يبقى findFirst ثم create كحارس anti-replay، ولا يبقى catch يخفي فشل أثر audit.

**دليل تشخيص reverse proxy بتاريخ 13-09-2026:** أثبت الاختبار الميداني وصورة المتصفح أن claim الرابط والجلسة نجحا، لكن تحويل النجاح بُني من `req.url` الداخلي فأرسل المتصفح إلى `http://localhost:3002/admin` بدلاً من نطاق ngrok. جميع تحويلات success/error في Magic Login يجب أن تُبنى من `ADMIN_DASHBOARD_URL` أو `DASHBOARD_URL` الموثوق والمتحقق منه، لا من Host/URL الوارد القابل لإعادة الكتابة بواسطة proxy. أضف اختباراً يبدأ بطلب داخلي localhost ويثبت أن `Location.origin` هو الأصل الخارجي المكوّن؛ هذا يمنع الانحدار وHost-header poisoning معاً.

- [ ] **Step 3: نفذ اختبارات الوحدة والتكامل.**

    pnpm --filter @alsaada/admin-dashboard test -- magic-auth.spec.ts auth-session.spec.ts magic-auth.integration.spec.ts

الاختبار التكاملي يطبق المهاجرات، يصدر token موقعاً، يستهلكه، يثبت cookie HttpOnly، ويعيد المحاولة نفسها للتحقق من رفضها.

- [ ] **Step 4: Commit.**

    git add apps/admin-dashboard/src/app/api/auth/magic/route.ts apps/admin-dashboard/tests/magic-auth.spec.ts apps/admin-dashboard/tests/auth-session.spec.ts apps/admin-dashboard/tests/magic-auth.integration.spec.ts
    git commit -m "fix(auth): make magic link consumption durable and fail closed"

### Task 4: تحصين نقطة الدخول /dashboard وتشغيل dashboard فعلياً

**Files:**
- Modify: apps/bot-server/src/handlers/dashboard.handler.ts
- Modify: apps/bot-server/src/bot.ts
- Modify: apps/bot-server/src/config/env.ts
- Modify: apps/bot-server/package.json (إضافة اعتماد @alsaada/telemetry فقط؛ دون تعديل scripts المحمية)
- Modify: apps/bot-server/tests/dashboard-command.spec.ts
- Modify: docker/Dockerfile وdocker/Dockerfile.dashboard
- Modify: .dockerignore
- Modify: docker-compose.yml
- Create: apps/admin-dashboard/src/app/api/health/route.ts
- Create: apps/admin-dashboard/tests/health-route.spec.ts

- [ ] **Step 1: اكتب اختبارات سلوك Telegram الحقيقي.**

    it('never creates a Telegram WebApp button from an HTTP dashboard URL', async () => {
      await handleDashboardCommand(makeContext(), { dashboardUrl: 'http://localhost:3002' });
      expect(extractWebAppUrl(ctx.reply)).toBeUndefined();
      expect(extractBrowserUrl(ctx.reply)).toContain('http://localhost:3002/login?token=');
    });

    it('returns a user-safe fallback when Telegram rejects the rich dashboard message', async () => {
      ctx.reply.mockRejectedValueOnce(new GrammyError('sendMessage', { error_code: 400, description: 'Bad Request' }));
      await expect(handleDashboardCommand(ctx, httpsConfig)).resolves.toBeUndefined();
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('تعذر فتح لوحة التحكم'), expect.anything());
    });

- [ ] **Step 2: اجعل HTTPS شرطاً للزر المصغر فقط.**

    const dashboardBase = normalizeDashboardUrl(config.dashboardUrl);
    const loginUrl = new URL('/login', dashboardBase);
    loginUrl.searchParams.set('token', token);
    const keyboard = new InlineKeyboard();
    if (loginUrl.protocol === 'https:') {
      keyboard.webApp('📱 فتح داخل تيليجرام', loginUrl.toString()).row();
      keyboard.url('🌐 فتح بالمتصفح', magicUrl.toString()).row();
    } else {
      message += formatClickToCopy(magicUrl.toString(), 'html');
      keyboard.text('🔄 إنشاء رابط محلي جديد', 'menu:exec:dashboard').row();
    }
    keyboard.text('🏠 القائمة الرئيسية', 'action:main_menu');

في production يرفض validator إعداد DASHBOARD_URL غير HTTPS. في development يسمح بـlocalhost لكنه لا يولد WebApp button ولا URL button، لأن الاختبار الميداني أثبت أن Telegram Bot API يرفض زر `http://localhost` بخطأ `Wrong HTTP URL` (traceId: `9b42344b-00ce-45c4-a31c-cd0c040a0a43`). بدلاً منه يرسل الرابط المحلي كنص داخل المحادثة الخاصة مع زري إعادة التوليد والقائمة الرئيسية. عالج أي رفض Telegram ببطاقة تفاعلية لا برسالة صامتة.

سجّل callback صريحاً لـ`menu:exec:dashboard` قبل معالج `^menu:.+$` العام، حتى يفتح زر لوحة المؤشرات وزر إعادة المحاولة المسار الحقيقي بدلاً من placeholder.

**دليل التشخيص التشغيلي بتاريخ 13-09-2026:** أثبت فحص إعدادات الحاويات أن ملف `.env` على المضيف عُدّل إلى `https://enquirer-hardening-penny.ngrok-free.dev`، بينما ظلت حاوية البوت محملة بـ`NODE_ENV=development` و`DASHBOARD_URL=http://localhost:3002`، وظلت حاوية لوحة التحكم محملة بعنوان `http://localhost:3002`. متغيرات `env_file` تُقرأ عند إنشاء الحاوية ولا تتغير بتعديل الملف؛ لذلك يلزم إعادة إنشاء الخدمتين والتحقق من القيم داخلهما. كما أعاد النفق استجابة التطبيق الحقيقية `status=ready` عند إرسال ترويسة تجاوز صفحة التحذير المجانية لـngrok؛ أما الطلب الجديد دون الترويسة فأعاد صفحة `ERR_NGROK_6024`، وهي بوابة تحذير ngrok وليست عطلاً في `/api/health`.

- [ ] **Step 3: أصلح صور Docker.**

أضف قبل pnpm install في الصورتين:

    COPY packages/telemetry/package.json packages/telemetry/

وأضف قبل بناء التطبيق المستهلك:

    RUN pnpm --filter @alsaada/telemetry build

أثبت البناء النظيف أن lifecycle `prepare` الجذري يستدعي `git config core.hooksPath .githooks`؛ لذلك يجب أن تحتوي مرحلة builder على Git وأن تهيئ مستودعاً مؤقتاً قبل `pnpm install` ثم تزيل بيانات `.git` المؤقتة. لا تستخدم `--ignore-scripts` لأنه يعطل lifecycle الضروري لاعتماديات البناء.

يقتصر `COPY` في صورة البوت على `apps/bot-server/`؛ نسخ `apps/` كاملاً كان يُدخل manifest لوحة التحكم بعد التثبيت، فيجعل pnpm ينفذ تثبيتاً ضمنياً جديداً أثناء `db:generate`. يبقى `GIT_DIR` المؤقت مضبوطاً في مرحلة builder فقط لضمان سلامة أي lifecycle لاحق، ولا ينتقل إلى runner.

أثبتت بوابات التشخيص أن روابط workspace موجودة بعد التثبيت ثم يمحوها `COPY` للمجلد الأب على Windows/BuildKit. كما أثبتت محاولة `pnpm install --force --offline` أن pnpm يعتبر virtual store محدثاً ولا يعيد الروابط المحذوفة. الحل النهائي هو عدم نسخ مجلد workspace الأب فوقه: تُنسخ مجلدات `src` و`prisma` والأصول وملفات التكوين المطلوبة فقط بعد التثبيت، فتظل `node_modules` سليمة ولا يحدث تثبيت ثانٍ. تُستبعد مخرجات `.next` و`.next-dev` و`tsconfig.tsbuildinfo` و`.scratch` من سياق Docker، وتزال أوامر التشخيص المؤقتة بعد إثبات السبب.

لا تستبدل frozen lockfile بقرار منفرد؛ يراجع منفذ DevOps سبب عدم تجميد lockfile في مهمة مستقلة إن كان مطلوباً.

- [ ] **Step 4: أضف readiness صادقاً.**

يعيد api/health 200 فقط بعد SELECT 1 وقراءة query تستخدم AuditLog.traceId وSystemErrorLog.traceId. يعيد 503 مع traceId دون تفاصيل قاعدة البيانات إن فشل ذلك.

- [ ] **Step 5: تحقق من صورة نظيفة وحاوية صحية.**

    docker build -f docker/Dockerfile .
    docker build -f docker/Dockerfile.dashboard .
    docker compose up -d --build --force-recreate bot dashboard
    docker inspect alsaada_enterprise_bot --format '{{range .Config.Env}}{{println .}}{{end}}'
    docker inspect alsaada_enterprise_dashboard --format '{{range .Config.Env}}{{println .}}{{end}}'
    Invoke-WebRequest http://localhost:3002/api/health -UseBasicParsing
    Invoke-WebRequest http://localhost:3002/login -UseBasicParsing
    Invoke-WebRequest https://enquirer-hardening-penny.ngrok-free.dev/api/health -Headers @{'ngrok-skip-browser-warning'='plan20-health-check'} -UseBasicParsing
    docker compose logs --tail 200 dashboard

**Expected:** الصورتان Exit 0، وتظهر القيم المحملة داخل الخدمتين `NODE_ENV=production` وعنوان ngrok نفسه، وapi/health المحلي والخارجي يعيدان 200، وlogin لا يعيد 500 أو P2022.

- [ ] **Step 6: Commit.**

    git add apps/bot-server/package.json apps/bot-server/src/handlers/dashboard.handler.ts apps/bot-server/src/bot.ts apps/bot-server/src/config/env.ts apps/bot-server/tests/dashboard-command.spec.ts docker/Dockerfile docker/Dockerfile.dashboard .dockerignore docker-compose.yml apps/admin-dashboard/src/app/api/health/route.ts apps/admin-dashboard/tests/health-route.spec.ts
    git commit -m "fix(dashboard): enforce safe Telegram entry and deployment readiness"

### Task 5: عقد Incident Vault موحد مع Redaction قبل الاستمرارية

**Files:**
- Create: packages/telemetry/src/incidents.ts
- Create: packages/telemetry/src/emergency-sink.ts
- Modify: packages/telemetry/src/index.ts وpackages/telemetry/src/redaction.ts
- Create: packages/telemetry/tests/incidents.spec.ts
- Modify: apps/bot-server/src/services/error-vault.service.ts
- Modify: apps/bot-server/tests/error-vault-and-telemetry.spec.ts

- [ ] **Step 1: اكتب اختبارات الإخفاء والبصمة أولاً.**

    it('redacts token, cookie, Egyptian national ID, and authorization before persistence', () => {
      const incident = normalizeIncident(new Error('token=abc.123 Authorization: Bearer secret 29801011234567'), baseContext);
      expect(incident.message).not.toContain('abc.123');
      expect(incident.message).not.toContain('secret');
      expect(incident.message).not.toContain('29801011234567');
      expect(incident.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    });

    it('does not use raw secret text when deriving a fingerprint', () => {
      const a = normalizeIncident(new Error('same failure token=first'), baseContext);
      const b = normalizeIncident(new Error('same failure token=second'), baseContext);
      expect(a.fingerprint).toBe(b.fingerprint);
    });

- [ ] **Step 2: عرّف عقداً نقياً لا يستورد Prisma أو Grammy.**

    export type IncidentSeverity = 'WARNING' | 'ERROR' | 'CRITICAL' | 'FATAL';
    export type IncidentSource = 'bot' | 'dashboard-server' | 'dashboard-browser' | 'worker';
    export interface IncidentInput {
      readonly traceId: string;
      readonly source: IncidentSource;
      readonly service: string;
      readonly severity: IncidentSeverity;
      readonly action: string;
      readonly sourceLocation: string;
      readonly error: unknown;
      readonly actorTelegramId?: bigint;
      readonly release?: string;
      readonly environment: 'development' | 'test' | 'staging' | 'production';
    }

normalizeIncident يستدعي redaction على message وstack وbreadcrumbs قبل hash وقبل الإرجاع. يفرض message 1000 وstack 4000 وbreadcrumbs 10؛ لا يضع any في surface العام.

- [ ] **Step 3: استبدل المسار غير المحمي في Error Vault.**

أزل استعمالات ctx as any وbreadcrumbs as any من ErrorVaultService. يستقبل service NormalizedIncident ويحفظ الناتج sanitized فقط. إذا فشل التخزين، يكتب process.stderr برسالة مختصرة تحمل traceId ولا يكرر error الأصلي ولا يوقف محاولة الرد للمستخدم.

- [ ] **Step 4: تحقق.**

    pnpm --filter @alsaada/telemetry test -- incidents.spec.ts redaction.spec.ts
    pnpm --filter @alsaada/bot-server test -- error-vault-and-telemetry.spec.ts
    pnpm --filter @alsaada/telemetry typecheck
    pnpm --filter @alsaada/bot-server typecheck

- [ ] **Step 5: Commit.**

    git add packages/telemetry apps/bot-server/src/services/error-vault.service.ts apps/bot-server/tests/error-vault-and-telemetry.spec.ts
    git commit -m "feat(telemetry): normalize and redact incidents before storage"

### Task 6: توحيد Trace وIncident بين Grammy وNext والمتصفح

**Files:**
- Modify: apps/bot-server/src/middlewares/telemetry.middleware.ts وapps/bot-server/src/bot.ts
- Create: apps/admin-dashboard/src/lib/incident-reporter.ts
- Create: apps/admin-dashboard/src/app/api/telemetry/incidents/route.ts
- Create: apps/admin-dashboard/src/instrumentation.ts
- Modify: apps/admin-dashboard/src/app/error.tsx وapps/admin-dashboard/src/app/global-error.tsx
- Modify: apps/admin-dashboard/tests/middleware-trace.spec.ts وapps/admin-dashboard/tests/error-boundaries.spec.ts
- Create: apps/admin-dashboard/tests/incident-collector.spec.ts

- [ ] **Step 1: اكتب اختبارات cross-channel.**

    it('persists the browser boundary error with the inbound x-trace-id', async () => {
      const response = await POST(makeRequest({ message: 'render failed', traceId }, { 'x-trace-id': traceId }));
      expect(response.status).toBe(202);
      expect(prisma.systemErrorLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ traceId, service: 'admin-dashboard', errorMessage: expect.not.stringContaining('secret') }),
      }));
    });

    it('assigns exactly one UUID traceId to every Grammy update', async () => {
      await telemetryMiddleware(ctx, next);
      expect(ctx.traceId).toMatch(/^[0-9a-f-]{36}$/i);
    });

- [ ] **Step 2: أوصل محول Grammy الحقيقي.**

أضف traceId اختياري إلى MyContext، ثم يولد middleware UUID واحداً أو يعيد استخدامه ويضعه في logger/context. يستدعي البوت normalizeIncident عند bot.catch. لا تكتب adapter جديداً موازياً لما هو موجود في @alsaada/telemetry/adapters/grammy؛ صحح adapter القائم واستورده.

- [ ] **Step 3: أنشئ collector متصفحاً محدوداً.**

يقبل POST api/telemetry/incidents JSON بالشكل التالي فقط:

    type BrowserIncidentBody = {
      traceId?: string;
      digest?: string;
      message?: string;
      route?: string;
    };

حد الجسم 8KB، ارفض origin غير نفس الموقع، لا تقبل stack أو headers أو cookie في JSON، وطبق rate limit لكل session/IP عبر Redis. المسار يعيد 202 مع incidentCode وtraceId ولا يرسل تفاصيل الخطأ للمتصفح.

- [ ] **Step 4: فعّل reporter للخادم والحدود.**

incident-reporter.ts يستعمل Prisma في server runtime ويمرر IncidentInput إلى normalizer. في error.tsx وglobal-error.tsx أرسل فقط message وdigest وroute وtraceId عبر navigator.sendBeacon أو fetch مع keepalive، ثم اعرض incidentCode إن عاد أو traceId مختصراً. لا يبقى console.error القناة الوحيدة.

- [ ] **Step 5: تحقق ثم Commit.**

    pnpm --filter @alsaada/admin-dashboard test -- middleware-trace.spec.ts error-boundaries.spec.ts incident-collector.spec.ts
    pnpm --filter @alsaada/admin-dashboard typecheck
    pnpm --filter @alsaada/bot-server test -- error-vault-and-telemetry.spec.ts

    git add apps/bot-server/src/middlewares/telemetry.middleware.ts apps/bot-server/src/bot.ts apps/admin-dashboard/src/lib/incident-reporter.ts apps/admin-dashboard/src/app/api/telemetry/incidents/route.ts apps/admin-dashboard/src/instrumentation.ts apps/admin-dashboard/src/app/error.tsx apps/admin-dashboard/src/app/global-error.tsx apps/admin-dashboard/tests
    git commit -m "feat(observability): correlate bot and dashboard incidents by trace"

### Task 7: دورة حياة الحادث والتنبيه غير الحاجب

**Files:**
- Modify: packages/database/prisma/schema.prisma
- Create: packages/database/prisma/migrations/20260912100000_add_incident_lifecycle/migration.sql
- Modify: apps/bot-server/src/services/error-vault.service.ts
- Create: apps/bot-server/src/services/incident-notification-worker.ts
- Modify: apps/admin-dashboard/src/app/admin/settings/audit-vault/page.tsx
- Create: apps/admin-dashboard/src/app/api/incidents/[id]/route.ts
- Create: apps/bot-server/tests/incident-notification-worker.spec.ts
- Create: apps/admin-dashboard/tests/incident-lifecycle.spec.ts

- [ ] **Step 1: اكتب اختبارات الحالة والصلاحيات.**

    it('permits only SUPER_ADMIN to acknowledge, resolve, or reopen an incident', async () => {
      await expect(updateIncident(fieldAdminSession, incident.id, 'ACKNOWLEDGED')).rejects.toMatchObject({ status: 403 });
      await expect(updateIncident(superAdminSession, incident.id, 'ACKNOWLEDGED')).resolves.toMatchObject({ status: 'ACKNOWLEDGED' });
    });

    it('queues a critical alert without awaiting Telegram delivery', async () => {
      const started = performance.now();
      await reporter.record(criticalIncident);
      expect(performance.now() - started).toBeLessThan(15);
      expect(prisma.notificationQueue.create).toHaveBeenCalled();
    });

- [ ] **Step 2: أضف حقول دورة الحادث بهجرة توسعية فقط.**

أضف status بقيمة OPEN، وacknowledgedAt، وacknowledgedByTelegramId، وownerTelegramId، وresolutionCode، وresolutionNote، وreleaseVersion، وenvironment إلى SystemErrorLog. احتفظ مؤقتاً بـ isResolved وتحديثه في transaction حتى تنقل كل المستهلكين. لا تحذف حقلاً في هذه الخطة.

- [ ] **Step 3: نفذ سياسة الحالة الصريحة.**

    const INCIDENT_TRANSITIONS = {
      OPEN: ['ACKNOWLEDGED', 'RESOLVED', 'IGNORED'],
      ACKNOWLEDGED: ['RESOLVED', 'OPEN'],
      RESOLVED: ['OPEN'],
      IGNORED: ['OPEN'],
    } as const;

كل transition يسجل AuditLog بإجراء INCIDENT_STATUS_CHANGED داخل transaction، مع actor وtraceId وسبب غير فارغ للحل أو التجاهل. لا يملك FIELD_ADMIN أو ACCOUNTANT صلاحية تغيير دورة الحادث.

- [ ] **Step 4: انقل تنبيه Telegram إلى queue/worker.**

يعالج incident-notification-worker.ts عناصر NotificationQueue بالـstatus الحالي، يحجز العنصر transactionally، يعيد المحاولة بسياسة backoff، ويسجل DELIVERED أو EXHAUSTED مع رسالة sanitized. لا ينتظر recordError نتيجة api.sendMessage.

- [ ] **Step 5: اختبر ثم Commit.**

    pnpm --filter @alsaada/bot-server test -- incident-notification-worker.spec.ts error-vault-and-telemetry.spec.ts
    pnpm --filter @alsaada/admin-dashboard test -- incident-lifecycle.spec.ts

    git add packages/database apps/bot-server/src/services apps/admin-dashboard/src/app/admin/settings/audit-vault apps/admin-dashboard/src/app/api/incidents apps/bot-server/tests apps/admin-dashboard/tests
    git commit -m "feat(incidents): add audited lifecycle and queued alert delivery"

### Task 8: OpenTelemetry ومراقبة ذاتية الاستضافة بلا Sentry

**Files:**
- Create: docker/observability/otel-collector.yaml
- Create: docker/observability/loki-config.yaml
- Create: docker/observability/tempo.yaml
- Create: docker/observability/grafana/provisioning/datasources/observability.yaml
- Create: docker-compose.observability.yml
- Create: docs/operations/observability-runbook.md
- Create: packages/telemetry/tests/otel-export-contract.spec.ts

- [ ] **Step 1: اكتب اختبار عقد exporter.**

    it('exports a sanitized incident with traceId but never a token', async () => {
      const payload = toOtelLog(normalizeIncident(new Error('Authorization: Bearer secret'), baseContext));
      expect(payload.attributes['trace.id']).toBe(baseContext.traceId);
      expect(JSON.stringify(payload)).not.toContain('secret');
    });

- [ ] **Step 2: أنشئ pipeline داخلية.**

    receivers:
      otlp:
        protocols:
          http: { endpoint: 0.0.0.0:4318 }
          grpc: { endpoint: 0.0.0.0:4317 }
    processors:
      memory_limiter: { check_interval: 1s, limit_mib: 256 }
      batch: { timeout: 5s }
    exporters:
      debug: { verbosity: basic }
    service:
      pipelines:
        logs: { receivers: [otlp], processors: [memory_limiter, batch], exporters: [debug] }
        traces: { receivers: [otlp], processors: [memory_limiter, batch], exporters: [debug] }

ابدأ بـ debug في بيئة اختبار لإثبات عدم تسرب البيانات، ثم أضف exporters إلى Loki وTempo بعد اختبار الاتصال. لا تجعل exporter خارجياً ولا ترسل بيانات إنتاج إلى خدمة عامة.

- [ ] **Step 3: أضف compose profile منفصل.**

    docker compose -f docker-compose.yml -f docker-compose.observability.yml --profile observability up -d
    docker compose -f docker-compose.yml -f docker-compose.observability.yml ps

تبقى المكونات على شبكة داخلية، ولا يتعرض Grafana إلا عبر reverse proxy/TLS ومصادقة إدارية. وثق retention: 30 يوماً logs و14 يوماً traces مبدئياً، وراقب السعة قبل الزيادة.

- [ ] **Step 4: تحقق ثم Commit.**

    pnpm --filter @alsaada/telemetry test -- otel-export-contract.spec.ts
    docker compose -f docker-compose.yml -f docker-compose.observability.yml config

    git add docker/observability docker-compose.observability.yml docs/operations/observability-runbook.md packages/telemetry
    git commit -m "feat(observability): add self-hosted OpenTelemetry pipeline"

### Task 9: إصلاح بوابة TypeScript والاختبارات وCI دون إخفاء العيوب

**Files:**
- Modify: package.json
- Modify: .github/workflows/ci.yml
- Modify: .gitignore
- Modify: tools/governance/tests/agent-dispatcher.spec.ts بعد إثبات السبب
- Modify: modules/workforce/src/flows/01.2.D-worker-edit/tests/flow.unit.spec.ts بعد إثبات السبب
- Modify: apps/admin-dashboard/package.json أو apps/admin-dashboard/vitest.config.ts
- Create: docker-compose.ci.yml

- [ ] **Step 1: افصل تشخيص الاختبارين الفاشلين عن إصلاحهما.**

    pnpm vitest run tools/governance/tests/agent-dispatcher.spec.ts --reporter=verbose
    pnpm vitest run modules/workforce/src/flows/01.2.D-worker-edit/tests/flow.unit.spec.ts --reporter=verbose --testTimeout=15000

سجّل stack وزمن كل assertion وtimers والمورد الذي ينتظر. لا ترفع عتبة 10 ثوان أو 5 ثوان في commit منفصل من دون إثبات أن الاختبار صحيح وأن المورد البطيء مقصود.

- [ ] **Step 2: اجعل typecheck workspace-aware.**

بدّل أمر الجذر من tsc --noEmit إلى تنفيذ كل package/app التي تعرّف typecheck، حتى يحتفظ dashboard بـmoduleResolution bundler وJSX الخاصين به:

    {
      "scripts": {
        "typecheck": "pnpm -r --if-present run typecheck",
        "lint": "pnpm typecheck"
      }
    }

لا تخفّض strict ولا تضف skipLibCheck لإخفاء خطأ. أصلح أخطاء any وundefined التي يكتشفها typecheck الخاص بكل workspace.

- [ ] **Step 3: اجعل اكتشاف اختبارات dashboard صريحاً وقابلاً للإثبات.**

    {
      "scripts": {
        "test": "vitest run tests/**/*.spec.ts"
      }
    }

أو أضف apps/admin-dashboard/vitest.config.ts يتضمن tests/**/*.spec.ts. يجب أن يظهر 12 ملف اختبار أو العدد الجديد الموثق في ناتج Vitest.

- [ ] **Step 4: أضف CI قاعدة بيانات حقيقية واختبار الصورتين.**

ينشئ docker-compose.ci.yml PostgreSQL وRedis فقط بvolumes مؤقتة، ويشغل CI:

    docker compose -f docker-compose.ci.yml up -d --wait
    pnpm --filter @alsaada/database exec prisma migrate deploy --schema prisma/schema.prisma
    pnpm lint
    pnpm test
    pnpm governance:verify
    pnpm build
    docker build -f docker/Dockerfile .
    docker build -f docker/Dockerfile.dashboard .

استخدم DATABASE_URL الخاص بحاوية CI فقط. لا تستخدم أسرار الإنتاج في GitHub Actions.

- [ ] **Step 5: تجاهل مخرجات Next فقط.**

    apps/admin-dashboard/.next/
    apps/admin-dashboard/.next-dev/
    apps/admin-dashboard/tsconfig.tsbuildinfo

- [ ] **Step 6: تحقق ثم Commit.**

    pnpm lint
    pnpm test
    pnpm governance:verify
    pnpm build
    docker build -f docker/Dockerfile .
    docker build -f docker/Dockerfile.dashboard .
    git status --short

    git add package.json .github/workflows/ci.yml .gitignore docker-compose.ci.yml apps/admin-dashboard tools/governance/tests/agent-dispatcher.spec.ts modules/workforce/src/flows/01.2.D-worker-edit/tests/flow.unit.spec.ts
    git commit -m "fix(quality): enforce workspace checks and release gates"

### Task 10: ترسيخ عقد تسجيل الأخطاء كقاعدة حوكمة ملزمة

**Precondition:**
- لا تنفذ هذه المهمة ولا تعدل ملفات الحوكمة قبل ورود عبارة المستخدم الحرفية المطلوبة في AGENTS.md: «موافق على التعديل او الايقاف او الحذف».

**Files:**
- Modify: AGENTS.md
- Modify: GEMINI.md
- Modify: docs/14-ai-agent-governance-and-file-rules.md
- Modify: docs/21-mandatory-module-architecture-and-gates.md
- Modify: package.json
- Create: tools/governance/verify-observability-contract.ts
- Create: tools/governance/tests/verify-observability-contract.spec.ts

- [ ] **Step 1: اكتب اختبار فاحص الحوكمة قبل تنفيذه.**

    it('rejects direct console.error in production source', async () => {
      const result = await verifyFixture('handler-with-console-error.ts');
      expect(result.ok).toBe(false);
      expect(result.violations[0]?.rule).toBe('NO_DIRECT_CONSOLE_ERROR');
    });

    it('rejects an empty or silently swallowed catch block', async () => {
      const result = await verifyFixture('service-with-silent-catch.ts');
      expect(result.ok).toBe(false);
      expect(result.violations[0]?.rule).toBe('NO_SILENT_CATCH');
    });

    it('accepts a catch that reports through the unified contract or rethrows', async () => {
      expect((await verifyFixture('handler-with-report-incident.ts')).ok).toBe(true);
      expect((await verifyFixture('service-that-rethrows.ts')).ok).toBe(true);
    });

- [ ] **Step 2: أضف النص الدستوري نفسه إلى مراجع الحوكمة الأربع.**

النص الملزم يكون بلا اختلاف دلالي:

    شرط أساسي لاعتماد أي وظيفة جديدة أو معدلة هو ربط جميع أخطائها بعقد التسجيل الموحد
    الصادر من @alsaada/telemetry، مع traceId وحجب البيانات الحساسة واختبار آلي لمسار الحادث.
    يحظر استخدام console.error مباشرة أو catch صامت في كود الإنتاج خارج منظومة التسجيل.
    أي مخالفة تفشل بوابة الحوكمة، وتمنع اعتماد الوظيفة أو رفع حالتها إلى مكتمل في docs/19.

يحدد النص الاستثناء الوحيد باسم packages/telemetry/src/emergency-sink.ts عند تعطل المنظومة نفسها، وبشرط رسالة محجوبة ومحدودة عبر process.stderr.write. لا يسمح باستثناءات محلية داخل الموديولات.

- [ ] **Step 3: نفذ الفاحص بتحليل AST لا ببحث نصي ساذج.**

يفحص apps وmodules وpackages مع استبعاد tests وdist و.next وgenerated. يرفض استدعاء console.error، ويرفض catch فارغاً أو catch لا يحتوي استدعاء reportIncident ولا يعيد throw. يعيد Exit 1 وقائمة file:line لكل مخالفة، وExit 0 عند النظافة.

- [ ] **Step 4: اربط الفاحص ببوابة الحوكمة.**

    {
      "scripts": {
        "observability-contracts:verify": "tsx tools/governance/verify-observability-contract.ts",
        "governance:verify": "pnpm arch:verify && pnpm migration:verify && pnpm flow-contracts:verify && pnpm telegram-contracts:verify && pnpm observability-contracts:verify && pnpm docs:audit && pnpm docs:parity && pnpm governance:tamper-check && pnpm ai-compliance:verify"
      }
    }

- [ ] **Step 5: أضف معيار DoD لكل وظيفة جديدة.**

يجب أن يحتوي اختبار التكامل للوظيفة على خطأ متعمد يثبت: إنشاء Incident واحد، وجود traceId صالح، عدم ظهور secret أو National ID في البيانات، وعدم تعطيل رد المستخدم. لا تغلق وظيفة لا تملك هذا الدليل.

- [ ] **Step 6: تحقق ثم Commit.**

    pnpm vitest run tools/governance/tests/verify-observability-contract.spec.ts
    pnpm observability-contracts:verify
    pnpm governance:verify

    git add AGENTS.md GEMINI.md docs/14-ai-agent-governance-and-file-rules.md docs/21-mandatory-module-architecture-and-gates.md package.json tools/governance/verify-observability-contract.ts tools/governance/tests/verify-observability-contract.spec.ts
    git commit -m "feat(governance): require unified incident reporting"

### Task 11: توثيق الحقيقة والإطلاق المرحلي

**Files:**
- Modify: docs/19-legacy-to-enterprise-master-feature-migration-registry.md
- Modify: docs/work-plans/README.md
- Modify: README.md
- Create: docs/operations/dashboard-deployment-runbook.md
- Create: docs/periodic-audits/2026-09-12/post-remediation-verification.md

- [ ] **Step 1: اكتب Runbook النشر.**

يشمل بالترتيب: backup، migrate deploy، تحقق migration status، بناء الصورتين، تشغيل dashboard، فحص api/health، اختبار /dashboard في محادثة خاصة، اختبار magic link لمرة واحدة، اختبار Incident bot/web، وrollback إلى النسخة والـdatabase backup وفق قرار مسؤول التشغيل.

- [ ] **Step 2: صحح الحالات ولا ترفع النسبة قبل الدليل.**

تتحول NEW-52 إلى NEW-59 في docs/19 إلى «قيد الإصلاح والتحقق» إلى أن تُرفق في التقرير hashes للـcommits ونتائج الأوامر وقائمة ملفات Git المتتبعة. لا تكتب 100% أو Plan-XX-Completion كمعرف بديل عن commit.

- [ ] **Step 3: نفذ اختبار قبول Staging.**

| السيناريو | الدليل المطلوب |
|---|---|
| رابط Magic صحيح | redirect إلى admin وcookie HttpOnly وAudit/claim بنفس traceId. |
| إعادة استخدام الرابط | redirect إلى login بـtoken_already_used بلا cookie جديدة. |
| تعطل PostgreSQL | redirect بـservice_unavailable بلا session ولا stack للمستخدم. |
| URL dashboard HTTP | لا WebApp button؛ رابط متصفح فقط وIncident واضح إذا فشل الإرسال. |
| خطأ bot وNext | Incident sanitized قابل للبحث، queue تنبيه، ثم lifecycle ACK/RESOLVE مدقق. |
| حمل تنبيه فاشل | سجل notification ينتقل إلى retry/exhausted ولا يوقف المعالجة الأساسية. |

- [ ] **Step 4: تنفيذ بوابة الإغلاق.**

    pnpm lint
    pnpm test
    pnpm governance:verify
    pnpm build
    docker compose -f docker-compose.yml -f docker-compose.observability.yml --profile observability ps
    git status --short

**Expected:** جميع الأوامر Exit 0، حاويات الصحة تعمل، وشجرة Git لا تعرض مخرجات بناء أو تغييرات غير موثقة. عند أي فشل تبقى الخطة قيد التنفيذ ويضاف الدليل إلى التقرير؛ لا توجد استثناءات.

- [ ] **Step 5: Commit توثيق الإغلاق.**

    git add docs/19-legacy-to-enterprise-master-feature-migration-registry.md docs/work-plans/README.md README.md docs/operations docs/periodic-audits/2026-09-12/post-remediation-verification.md
    git commit -m "docs(operations): certify dashboard recovery evidence"

## مراجعة التغطية الذاتية

| مطلب المستخدم | المهمة التي تغطيه |
|---|---|
| تشخيص وإصلاح الدخول للوحة | 2، 3، 4، 11 |
| سجل أخطاء احترافي من دون Sentry | 5، 6، 7 |
| مراقبة ذاتية OpenTelemetry | 8 |
| إلزام كل وظيفة جديدة بعقد التسجيل الموحد | 10 |
| TypeScript والاختبارات والحوكمة والنشر | 1، 4، 9، 10، 11 |
| صحة الوثائق ونسب التقييم | تقرير 12-09-2026 ومهمة 11 |
| حظر ادعاء الاكتمال بلا دليل | قواعد التنفيذ ومعايير القبول ومهمتا 10 و11 |

لا تحتوي هذه الخطة على تغيير غير مفحوص أو قرار وظيفي يتعلق بتدفقات F:\HR. تنفيذها يبدأ فقط بالمهمة 1 ثم يتقدم بالترتيب، لأن كل مهمة تزيل مخاطرة لازمة للمهمة التالية.
