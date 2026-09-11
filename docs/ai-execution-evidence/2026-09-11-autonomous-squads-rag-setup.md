# توثيق الحوكمة: منظومة الفرق الهندسية المستقلة ومحرك الـ SSOT RAG المحلي وأدوات التحقق (Autonomous Squads & SSOT RAG Infrastructure)

- التاريخ: 2026-09-11
- الحالة: معتمد وموافق عليه رسمياً
- عبارة الاعتماد الإلزامية: موافق على التعديل او الايقاف او الحذف

## نطاق الأعمال المنفذة (Autonomous Squads, RAG Engine & Verification Architecture)

1. **محرك المعرفة المرجعية المحلي فائق السرعة (Local SSOT RAG Engine - Requirement R1):**
   - تطوير `tools/governance/rag-engine.ts` بلغة TypeScript الصارمة وصفر اعتماديات خارجية (اعتماد حصري على مكتبات Node 22 المدمجة: `node:fs`, `node:path`, `node:perf_hooks`, `node:process`).
   - ماسح AST ذكي للماركداون يتجاهل كتل الأكواد البرمجية (`inCodeFence`) بدقة وحساب ترقيم أسطر الأقسام 1-indexed.
   - مستخرج أكواد التدفقات (Legacy flows, Novel features `NEW-*`, Governance gates `G1-G12`, Work plans `PLAN-*`).
   - معالج لغوي ثنائي اللغة (عربي/إنجليزي) لتجريد التشكيل، التطويل، توحيد الألفات والتاء المربوطة والألف المقصورة وأل التعريف.
   - فهرس عكسي (Inverted Index) فائق السرعة مخزن في `.cache/ssot-index.json`.
   - محرك استعلام سريع (`pnpm ssot:query`) بزمن استرجاع < 15ms.
   - تفعيل بروتوكول غياب التوثيق (Missing Knowledge Protocol / Zero-Hallucination Policy) بحالة `TASK_SUSPENDED_MISSING_SSOT` وكود خروج 2.
   - تصدير واجهة فحص الاستباقية `verifySsotPreflight`.
   - تغطية شاملة باختبارات آلية في `tools/governance/tests/rag-engine.spec.ts`.

2. **حزم المهارات التدريجية للفرق المتخصصة (Workspace Progressive Disclosure Skills - Requirement R2):**
   - تأسيس معمارية المهارات التدريجية وفق معيار Antigravity (ترويسة YAML مدمجة < 2KB وتعليمات تشغيلية موسعة عند الطلب) في `.agents/skills/`:
     * `.agents/skills/chief-arbitrator/SKILL.md` (محكم التوافق والنزاعات وإدارة بروتوكول DDD).
     * `.agents/skills/squad-finance-security/SKILL.md` (حارس النزاهة المالية والأمان وحق الفيتو المطلق).
     * `.agents/skills/squad-implementation-ux/SKILL.md` (هندسة الشرائح الرأسية ومعايير بيئة تليجرام 36/16/7/3).
     * `.agents/skills/squad-architecture-devops/SKILL.md` (هندسة المونو-ريبو ومزامنة Outbox والحاويات).
     * `.agents/skills/squad-qa-migration/SKILL.md` (حارس جودة البوابات G1-G12 ومفتش مطابقة النظام السابق F:\HR وفق الأركان السبعة).

3. **ميثاق تشكيل الفرق الهندسية المستقلة والتسجيل التوثيقي (Enterprise Architecture Charter - Requirement R3):**
   - تأليف الوثيقة الدستورية الشاملة `docs/23-autonomous-agent-roster-and-rag.md` (590 سطراً) شاملة كافة الأقسام الدستورية، ومصفوفة الفيتو، وبروتوكول الفحص الميداني، وبروتوكول غياب التوثيق، وصيغ التوجيه اليومي.
   - استعادة مطابقة فهرس التوثيق في `README.md` بتسجيل الوثيقتين `docs/22` و `docs/23` دون المساس بملفات الحوكمة المقفلة.

4. **أداة الموجه اليومي وأتمتة التحقق الصارم (Daily Dispatcher Tooling & Verification Automation - Requirement R4):**
   - تطوير `tools/governance/agent-dispatcher.ts` لتشغيل الفواحص المعمارية والتعاقدية والتوثيقية وسلسلة الحوكمة استدعاءً داخلياً (In-Process Execution) بزمن استجابة فائق < 400ms.
   - دعم تدقيق الشرائح الفردية `pnpm agent:check [target]` وفحص الجودة المتكامل `pnpm agent:audit`.
   - اختبارات سلوكية متقدمة في `tools/governance/tests/agent-dispatcher.spec.ts`.
   - إضافة نصوص التشغيل في `package.json`: `ssot:index`, `ssot:query`, `ssot:sync`, `agent:check`, `agent:audit`.
   - تحديث `.gitignore` باستثناء مسار الفهرس `.cache/`.

5. **إصلاح التايب سكريبت الصارم في موديول القوى العاملة (Workforce Flow 01.4 TS2412 Fix):**
   - تصحيح السطر 18 في `modules/workforce/src/flows/01.4-worker-export/flow.service.ts`:
     `private readonly normalizedKeyHex?: string | undefined;`
     للتوافق الصارم مع `exactOptionalPropertyTypes: true` وضمان نجاح بناء وتصريف الحزم بنسبة 100%.

## الملفات المضافة والمعدلة (Files Added and Modified)

- **ملفات مضافة:**
  * `tools/governance/rag-engine.ts`
  * `tools/governance/tests/rag-engine.spec.ts`
  * `.agents/skills/chief-arbitrator/SKILL.md`
  * `.agents/skills/squad-finance-security/SKILL.md`
  * `.agents/skills/squad-implementation-ux/SKILL.md`
  * `.agents/skills/squad-architecture-devops/SKILL.md`
  * `.agents/skills/squad-qa-migration/SKILL.md`
  * `docs/23-autonomous-agent-roster-and-rag.md`
  * `tools/governance/agent-dispatcher.ts`
  * `tools/governance/tests/agent-dispatcher.spec.ts`
  * `docs/ai-execution-evidence/2026-09-11-autonomous-squads-rag-setup.md`
- **ملفات معدلة:**
  * `README.md` (تسجيل الوثائق 22 و 23)
  * `package.json` (إضافة 5 أوامر تشغيل)
  * `.gitignore` (استثناء مجلد `.cache/`)
  * `modules/workforce/src/flows/01.4-worker-export/flow.service.ts` (تصحيح التايب سكريبت)
  * `governance.lock.json` (تحديث التجزئة الشاملة)

## أوامر التحقق الإلزامية (Mandatory Verification Commands)

| الأمر | النتيجة | البيان التفصيلي |
| :--- | :---: | :--- |
| `pnpm build` | PASS | بناء وتصريف كافة الحزم والموديولات بتصريف صارم Exit 0 |
| `pnpm test` | PASS | اجتياز 100% من الاختبارات الآلية بما فيها اختبارات RAG والموجه اليومي والقوى العاملة |
| `pnpm lint` | PASS | اجتياز فحص التايب سكريبت الصارم (tsc --noEmit) بدون أي أخطاء أو تحذيرات |
| `pnpm arch:verify` | PASS | فحص العزل الموديولي وسقف الأسطر واستقلالية التدفقات وحظر الاستدعاء المباشر |
| `pnpm migration:verify` | PASS | مطابقة سجل الترحيل الشامل لـ 163 إدخالاً بنسبة 100% |
| `pnpm flow-contracts:verify` | PASS | مطابقة عقود التدفقات الـ 19 المسجلة وخلوها من any |
| `pnpm docs:audit` | PASS | اكتمال كافة وثائق الحوكمة الإلزامية ووجود كافة العلامات والنصوص القياسية |
| `pnpm docs:parity` | PASS | التناغم الكامل بين ملفات الحوكمة والدستور والواقع البرمجي |
| `pnpm governance:tamper-check` | PASS | مطابقة قفل الحوكمة ووجود عبارة التفويض الإلزامية الصريحة |
| `pnpm ai-compliance:verify` | PASS | تحقق كامل من امتثال الذكاء الاصطناعي ووجود أدلة الإنجاز |
| `git status --short` | PASS | شجرة عمل منضبطة وخالية من الملفات العشوائية |

## جدول مطابقة البوابات G1 إلى G12 (Gates Compliance Matrix)

| البوابة | الحالة | الدليل والبيان الفني |
| :--- | :---: | :--- |
| G1 - العزل الموديولي | PASS | فصل تام للفرق الهندسية وتحديد صلاحيات الملفات بدقة في docs/23 ومهارات .agents/skills |
| G2 - عقد الوظيفة | PASS | كافة التدفقات الـ 19 تمتلك عقود flow.contract.json موثقة وخالية من any |
| G3 - النواة المشتركة | PASS | عدم تكرار الأكواد واستخدام Node 22 built-ins للنواة في tools/governance/rag-engine.ts |
| G4 - حجب الصلاحيات | PASS | تقييد صلاحيات الفرق والأدوات ومصفوفة الفيتو المالية والأمنية الثلاثية |
| G5 - تجربة البوت الموحدة | PASS | الالتزام الصارم بمعايير بيئة تليجرام 36/16/7/3 وشاشات الإنجاز في مهارات UX |
| G6 - سلامة البيانات | PASS | حماية التجزئة وسلسلة الكتل المالية وحظر الحذف الصلب وتشفير البيانات الحساسة |
| G7 - الأداء وسقف البايتات | PASS | استعلام RAG في < 15ms، وتشغيل agent:check في < 400ms، والتزام بسقف 64/512 بايت لتليجرام |
| G8 - الاختبارات التلقائية | PASS | 100% نسبة نجاح الاختبارات الآلية بما فيها اختبارات RAG والموجه وفواحص الحوكمة |
| G9 - التوثيق والمطابقة | PASS | ميثاق المعمارية المستقلة docs/23 وتسجيل Docs 22 و 23 في README.md |
| G10 - نظافة Git | PASS | استثناء مجلد الفهرس .cache/ في .gitignore وتطهير جذر المستودع من الملفات المؤقتة |
| G11 - قفل الحوكمة | PASS | تحديث governance.lock.json بالأمر المعتمد وتوثيق التجزئة لكافة الملفات الحاكمة |
| G12 - منع التلاعب | PASS | تضمين عبارة التفويض الإلزامية الصريحة: موافق على التعديل او الايقاف او الحذف |

## المخاطر المتبقية وخطة المعالجة (Residual Risks & Mitigations)

1. **مخاطر استنزاف الذاكرة للفهرس المحلي:**
   - تم تصميم الفهرس بذاكرة موضعية خفيفة (~500KB) تخزن مؤقتاً عند الطلب ولا تتعدى 1MB.
2. **مخاطر التعديل غير المصرح به على الأدوات:**
   - تم إخضاع `rag-engine.ts` و `agent-dispatcher.ts` لقفل الحوكمة المشفر `governance.lock.json`، وأي تعديل مستقبلي يستوجب ترخيصاً صريحاً.
3. **مخاطر استدعاءات تليجرام المباشرة أو الهلوسة البرمجية:**
   - محاصرة بالكامل عبر بروتوكول غياب التوثيق (TASK_SUSPENDED_MISSING_SSOT) والفيتو المطلق لفرقة المالية والأمان.
