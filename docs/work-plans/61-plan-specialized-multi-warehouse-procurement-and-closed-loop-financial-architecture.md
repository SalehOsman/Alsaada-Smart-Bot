# 📋 خطة عمل رقم 61 (المرجع المعماري والمحاسبي الشامل - النسخة الذهبية الكاملة غير المختصرة): المنظومة المؤسسية للمخازن المتخصصة والديناميكية، إدارة الموردين، تفنيط الفواتير بالذكاء الاصطناعي (AI Vision)، ميني آب الباركود، والدائرة المحاسبية المغلقة
## Enterprise Multi-Warehouse Topology, Dynamic Warehouse Engine, AI Vision Invoice Parser, Telegram Barcode Mini App, Procurement Taxonomy & Forensic Closed-Loop Accounting (Full Unabbreviated Master SSOT)

> **مرجع الخطة الدائم:** `docs/work-plans/61-plan-specialized-multi-warehouse-procurement-and-closed-loop-financial-architecture.md`  
> **تاريخ التحرير والتوافق الاستشاري:** 17-09-2026  
> **الحالة:** 🟢 مسودة معتمدة ونهائية بنسبة 100% للتنفيذ (Sealed Master Execution Blueprint)  
> **الميثاق المرجعي:** بنود 1.1، 1.2، 1.5، 1.6، و 2.5 من `AGENTS.md` و `GEMINI.md`، مخرجات جلسات التدقيق المحاسبي المالي (CPA Audit)، النقد البرمجي الهندسي (Principal Software Engineering Audit)، وتفنيط الفواتير بالـ AI Vision (`packages/ai-vision-engine`)، ميثاق الدائرة المالية المغلقة (`docs/13-closed-loop-financial-and-pnl-engine.md`)، وميثاق السجل الجنائي المشفر (`docs/16-database-security-and-tamper-proof-ledger.md`).

---

## 🎯 1. منهجية التنفيذ والتسليم المعتمدة (Dual-Track Vertical Slice Methodology)

بناءً على جلسات العصف الذهني (`/grill-me`) وميثاق الحوكمة المؤسسية، تم اعتماد **منهجية التوازي الموديولي المتزامن (Dual-Track Vertical Slice)**:
* **التوازي الصارم بين البوت والداشبورد:** يتم بناء كل موديول وشريحة وظيفية في نفس السبرنت على مسارين متزامنين:
  1. **تدفقات تليجرام بوت الميدانية (`modules/*` في `apps/bot-server`):** مصممة لتجربة مستخدم سريعة وسهلة عبر الأزرار التفاعلية للمهندسين والمشرفين ومسؤولي المخازن في المواقع والمشاريع الصحراوية مع دعم العمل بأضعف شبكات الاتصال.
  2. **شاشات لوحة تحكم الويب (`apps/admin-dashboard/src/app/admin/...`):** مبنية بـ Next.js 15 و React 19 مع Tailwind CSS وجداول تفاعلية متقدمة ومخططات بيانية لكشوف الحسابات 360°، مرصد الأسعار، مطابقة الجرد، وإدارة الموردين والمخازن للإدارة العليا والمحاسبين.
* **مبدأ الحصانة ومنع الديون التقنية (Zero Technical Debt):** لا يُعتبر أي موديول مكتملاً ما لم تنتهِ كافة تدفقاته في البوت وكافة شاشاته في الداشبورد معاً وتجتاز اختبارات الحوكمة `pnpm governance:verify`.

### 🚦 1.1 ميثاق التنفيذ المتتابع الصارم وبوابة التحقق الثلاثية (Strict Sequential Delivery & Triple Verification Gate)
تطبيقاً للتوجيه الإلزامي الصارم:
> «تكون الخطة مقسمة إلى أجزاء صغيرة تنفذ على التتابع، ولا يتم الانتقال إلى أي نقطة تالية قبل الانتهاء التام من الجزء الحالي واختباره بالكود ويدوياً».

يُحظر تماماً القفز بين الشرائح أو بدء كتابة كود شريحة تالية قبل استيفاء **بوابة الفحص الثلاثية الصارمة (Strict Triple Gate)** لكل شريحة:
1. **البوابة 1 (الفحص الآلي الكامل):** اجتياز تجميع التايب سكريبت الصارم `pnpm typecheck`، واختبارات الوحدة والتكامل للتدفقات والشاشات بنسبة نجاح 100% وخلو تام من `any`.
2. **البوابة 2 (سيناريو الاختبار اليدوي المحدد بالأرقام):** يقدم الوكيل للمستخدم في نهاية كل شريحة دليلاً عملياً دقيقاً يتضمن:
   - المدخلات التجريبية المحددة في البوت (أزرار ونصوص وأرقام).
   - الشاشة المقابلة في لوحة تحكم الويب مع الرابط الدقيق وتفاصيل الصفوف المتوقعة.
   - القيد المحاسبي المتولد والأثر المالي الفعلي للتحقق من دقته.
3. **البوابة 3 (الاعتماد الصريح من المستخدم):** ينتظر الوكيل موافقة المستخدم الصريحة على نتائج الاختبار، ولا يفتح أي ملف يخص الشريحة التالية قبل هذا الاعتماد.

---

## 🏛️ 2. الدائرة المحاسبية المغلقة ومكافحة الازدواجية بنسبة 0.00% (Forensic Closed-Loop Accounting)

تم تصميم الدورة المستندية والمحاسبية لضمان سلامة ميزان المراجعة، ومنع ازدواجية تسجيل المصروفات أو تشويه تكلفة المشاريع، مع تقديم الإثبات الرياضي والمحاسبي القاطع:

### 2.1 سيناريو مسحوبات السجائر والسلع العينية للعمالة (Cigarettes & In-Kind Provisions)
* **المشكلة الشائعة:** قيام بعض الشركات بقيد فاتورة شراء السجائر كمصروف موقع، ثم خصمها من راتب العامل وقيد الراتب الإجمالي كمصروف، مما يؤدي إلى ازدواجية المصروف وتضخيم خسائر المشروع بنسبة 100% من قيمة المسحوبات.
* **المعالجة المحاسبية الصارمة المعتمدة في النظام:**
  1. **المرحلة الأولى: شراء وتوريد السجائر من المورد إلى مخزن الكانتين بالموقع:**
     - تُقيد الفاتورة كإضافة للمخزون (أصل متداول) دون المساس بقائمة الدخل نهائياً:
       $$\begin{aligned}
       \text{Debit: } & 120401 \text{ مخزون كانتين ومسحوبات الموقع (أصل متداول)} \\
       \text{Credit: } & 210101 \text{ حسابات الموردين - مورد السجائر (التزام متداول)}
       \end{aligned}$$
     - **الأثر على قائمة الأرباح والخسائر (P&L):** **صفر جنيه (0.00 EGP)**.
  2. **المرحلة الثانية: صرف السجائر للعامل من الكانتين:**
     - تُصرف السجائر للعامل **بسعر التكلفة الصافي (Zero Profit Margin)** منعاً للتربح من العاملين:
       $$\begin{aligned}
       \text{Debit: } & 120305 \text{ سلف ومسحوبات عمال عينية - ذمة العامل (أصل متداول)} \\
       \text{Credit: } & 120401 \text{ مخزون كانتين ومسحوبات الموقع (أصل متداول)}
       \end{aligned}$$
     - **الأثر المالي:** مناقلة أصول داخلية بين بندين في الأصول المتداولة. خروج نقدية = **0.00 EGP**، أثر على قائمة الدخل = **0.00 EGP**.
  3. **المرحلة الثالثة: إقفال مسير الرواتب الشهري (`Monthly Payroll Settlement`):**
     - عند احتساب أجور العاملين في نهاية الشهر، يُقيد الراتب الإجمالي كالمصروف الحقيقي الوحيد، وتُقفل مسحوبات السجائر والسلف النقدية لخصمها من الراتب:
       $$\begin{aligned}
       \text{Debit: } & 510101 \text{ مصروف أجور ومرتبات عمال التشغيل (P&L Expense - المصروف الوحيد)} \\
       \text{Credit: } & 120305 \text{ سلف ومسحوبات عمال عينية (إقفال ذمة السجائر)} \\
       \text{Credit: } & 120301 \text{ سلف نقدية عمال (إقفال السلف النقدية)} \\
       \text{Credit: } & 110101 \text{ الخزينة / البنك (صافي الراتب المستحق نقداً)}
       \end{aligned}$$
  4. **المرحلة الرابعة: سداد مستحقات مورد السجائر:**
     - يتم سداد فاتورة المورد من العهدة أو الخزينة:
       $$\begin{aligned}
       \text{Debit: } & 210101 \text{ حسابات الموردين - مورد السجائر (إقفال الالتزام)} \\
       \text{Credit: } & 110101 \text{ الخزينة الرئيسية أو عهدة الموقع النقدية}
       \end{aligned}$$
  5. **الإثبات الرياضي والمالي لعدم الازدواجية:**
     - إجمالي النقدية الخارجة من خزينة الشركة = النقدية المدفوعة للمورد + صافي الراتب النقدي المدفوع للعامل.
     - بالتعويض: صافي الراتب = الراتب الإجمالي - ثمن السجائر.
     - النقدية الخارجة = ثمن السجائر + (الراتب الإجمالي - ثمن السجائر) = **الراتب الإجمالي للعامل بالمليم**.
     - المصروف الإجمالي المسجل في قائمة الدخل = **الراتب الإجمالي للعامل فقط**.
     - نسبة الازدواجية والتكرار = **0.00% مستحيلة رياضياً ودفترياً**.

---

### 2.2 منظومة مخزن السولار وقياس التنكات بالشرطة وساعات المعدات (Fuel Tank Notches & Multi-Tank Allocation Engine)
* **المشكلة والواقع الميداني:** في المواقع الإنشائية والصحراوية، لا يُقاس السولار في التنكات بالسنتيمتر، بل يُقاس بـ **«الشرطة»** عبر سيخ قياس مخصص ومدرج لكل تانك. وكل تانك له سعة تخزينية إجمالية باللترات (`totalCapacityLiters`) مسجلة في بطاقته، وقيمة محددة لكل شرطة باللترات (`litersPerNotch`) تتناسب مع سعته وهندسته. كما قد يحتوي الموقع الواحد على عدة تنكات (مثل: تانك المحطة الثابت، فنطاس متحرك، وتانك كرفان المولد).
* **الحل الرياضي والهندسي المعتمد:**
  1. **معايرة الخزانات وتعدد التنكات (Multi-Tank & Notch Calibration Model):**
     - يسجل في بطاقة كل تانك في النظام:
       - اسم وكود التانك: (مثلاً: `TANK-SITE1-MAIN` تانك المحطة 20,000 لتر، `TANK-SITE1-MOBILE` فنطاس متحرك 5,000 لتر).
       - السعة الإجمالية باللترات: $V_{\text{capacity}}$ (مثلاً: 10,000 لتر).
       - إجمالي عدد الشرطات على السيخ: $N_{\text{total}}$ (مثلاً: 100 شرطة أو 200 شرطة).
       - القيمة اللترية الثابتة للشرطة:
         $$\text{LitersPerNotch} = \frac{V_{\text{capacity}}}{N_{\text{total}}}$$
         *(مثلاً: تانك 10,000 لتر مقسم إلى 100 شرطة $\rightarrow$ كل شرطة = 100 لتر، أو تانك 10,000 لتر مقسم إلى 200 شرطة $\rightarrow$ كل شرطة = 50 لتر).*
       - **جدول معايرة الشرطات الاختياري (`Notch Lookup Table`):** للتنكات البيضاوية أو غير المنتظمة هندسياً، يدعم النظام جدول معايرة يحدد القيمة اللترية التراكمية لكل رقم شرطة بدقة.
  2. **تجربة إدخال القياس اليومي بالبوت والداشبورد:**
     - يختار المشرف التانك المراد قياسه من قائمة تنكات الموقع.
     - يعرض النظام بطاقة التانك: `[تانك المحطة الرئيسي | السعة: 10,000 لتر | قيمة الشرطة: 50 لتر]`.
     - يدخل المشرف قراءة السيخ في بداية الوردية برقم الشرطة $N_{\text{start}}$ (يدعم الأرقام العشرية ونصف الشرطة، مثل: 64.5 شرطة)، فيحسب النظام فورياً ويعرض:
       $$V_{\text{open}} = N_{\text{start}} \times \text{LitersPerNotch} \quad (64.5 \times 50 = 3,225 \text{ لتر})$$
     - في نهاية الوردية يدخل قراءة الإغلاق $N_{\text{end}}$ (مثلاً: 42 شرطة $\rightarrow$ 2,100 لتر).
     - الاستهلاك الفعلي الإجمالي للسولار بالوردية للتانك:
       $$V_{\text{actual\_consumed}} = V_{\text{open}} + V_{\text{inbound}} - V_{\text{close}}$$
       *(حيث $V_{\text{inbound}}$ يمثل أي كميات سولار تم توريدها واستلامها في التانك خلال نفس الوردية).*
  3. **التوزيع النسبي الموزون بساعات التشغيل المعيارية (Weighted Hour-Meter Allocation):**
     - يتم تسجيل ساعات التشغيل الفعلية لكل معدة من واقع قراءة عداد الساعات في بداية ونهاية الوردية: $\Delta H_i = H_{i,\text{end}} - H_{i,\text{start}}$.
     - لكل موديل معدة مسجل في بطاقتها معدل استهلاك قياسي بالساعة: $C_i \text{ (Standard L/h)}$ (مثلاً: حفار كوماتسو 300 = 22 لتر/ساعة، لودر كاتربيلر 966 = 18 لتر/ساعة، قلاب مرسيدس = 12 لتر/ساعة).
     - الاستهلاك التقديري النظري للمعدة $i$:
       $$E_i = \Delta H_i \times C_i$$
     - إجمالي الاستهلاك التقديري لجميع المعدات العاملة بالموقع:
       $$E_{\text{total}} = \sum_{i=1}^{n} E_i$$
     - حصة المعدة $i$ الفعلية الموزعة باللترات من السولار المستهلك:
       $$\text{Allocated Fuel}_i = V_{\text{actual\_consumed}} \times \left( \frac{E_i}{E_{\text{total}}} \right)$$
     - القيمة المالية المحملة على كارت تشغيل وصيانة المعدة $i$:
       $$\text{Cost}_i = \text{Allocated Fuel}_i \times \text{WAC}_{\text{fuel\_price}}$$
  4. **رادار الانحراف والشذوذ التشغيلي (Fuel Discrepancy & Theft Radar):**
     - يحسب المحرك نسبة التباين بين الاستهلاك الفعلي والاستهلاك التقديري:
       $$\text{Variance \%} = \frac{V_{\text{actual\_consumed}} - E_{\text{total}}}{E_{\text{total}}} \times 100$$
     - **الحالة 1 (تباين طبيعي $\le 10\%$):** تفاوت مقبول ناتج عن تباين صلابة التربة أو الأحمال، ويوزع الفارق بالكامل على المعدات.
     - **الحالة 2 (تباين ملحوظ $10\% < \text{Variance} \le 20\%$):** يتم التوزيع مع تسجيل وسم تحذيري أصفر في تقرير الوردية.
     - **الحالة 3 (شذوذ جسيم $\text{Variance} > 20\%$):**
       - يُعزل الفائض غير المبرر فورياً ولا يُحمل على المعدات لمنع تشويه مؤشرات كفاءة السائقين وصحة المحركات.
       - يُقيد الفائض في حساب خسارة مستقل:
         $$\begin{aligned}
         \text{Debit: } & 520901 \text{ خسائر عجز وتسريب وقود الموقع (P&L Abnormal Loss)} \\
         \text{Credit: } & 120402 \text{ مخزون السولار والوقود (أصل متداول)}
         \end{aligned}$$
       - إطلاق إنذار أحمر فوري في توبيك الإدارة وإشعار مدير الموقع والمهندس الميكانيكي لفحص التانك وتتبع السائقين لمنع السرقات والتسريبات.

---

### 2.3 منظومة البضائع المستلمة غير المفوترة (GRNI - Goods Received Not Invoiced)
* **التحدي الميداني:** استلام شحنات حيوية بالموقع (سولار، قطع غيار حرجة، مستلزمات تشغيل) مع بوليصة شحن أو إذن تسليم سائق دون توفر الفاتورة الضريبية النهائية للمورد. التوقف لحين وصول الفاتورة يعطل الإنتاج، والصرف الفعلي دون إثبات مخزني يؤدي لرصيد سالب وتدمير حسابات متوسط التكلفة المرجح (WAC).
* **المعالجة المحاسبية والبرمجية:**
  1. **تسجيل إذن الاستلام المخزني المؤقت (بوليصة استلام):**
     - يُسجل الوارد بالكميات الفعلية وبسعر التعاقد القياسي المتفق عليه في كارت المورد عبر حساب وسيط:
       $$\begin{aligned}
       \text{Debit: } & 1204xx \text{ مخزون الصنف المستلم (بالكمية الفعلية $\times$ السعر القياسي)} \\
       \text{Credit: } & 210199 \text{ وسيط بضائع مستلمة غير مفوترة - GRNI (التزام وسيط متداول)}
       \end{aligned}$$
     - **النتيجة:** تتوفر الأصناف فورياً للصرف في النظام برصيد موجب وبتكلفة منضبطة دون توقف.
  2. **وصول الفاتورة الرسمية والمطابقة الثلاثية (Three-Way Matching):**
     - عند رفع الفاتورة النهائية وتفنيطها، يقوم محرك `GRNIReconciliationEngine` بإقفال الحساب الوسيط وإثبات حساب المورد النهائي وقيد فروق الأسعار إن وجدت:
       $$\begin{aligned}
       \text{Debit: } & 210199 \text{ وسيط بضائع مستلمة غير مفوترة - GRNI (إقفال القيمة المؤقتة)} \\
       \text{Debit/Credit: } & 510905 \text{ فروق أسعار توريدات مخزنية (فرق سعر الفاتورة عن القياسي)} \\
       \text{Credit: } & 210101 \text{ حساب المورد النهائي (بالقيمة الحقيقية للفاتورة)}
       \end{aligned}$$

---

### 2.4 القيد المركب لمستخلصات مقاولي الباطن والتشييد (Construction Subcontractor Extracts)
* **المشكلة:** مستخلصات مقاولي الحفر والخرسانات تتضمن تشابكات مالية: خصم استهلاك سولار الشركة، استقطاع وجبات وسكن عمال المقاول، احتجاز تأمين ضمان الأعمال، سداد استحقاقات التأمينات الاجتماعية للمقاولات، والخصم الضريبي من المنبع.
* **القيد المركب الكامل والمعتمد في المحرك:**
  $$\begin{aligned}
  \text{Debit: } & 510201 \text{ تكلفة مقاولي باطن - إجمالي الأعمال المنجزة المعتمدة بالمستخلص} \\
  \text{Credit: } & 120402 \text{ مخزون السولار (قيمة وقود الشركة المنصرف لمعدات المقاول - تخفيض تكلفة الموقع)} \\
  \text{Credit: } & 120401 \text{ مخزون الكانتين والإعاشة (قيمة وجبات ومسكن عمال المقاول)} \\
  \text{Credit: } & 210301 \text{ تأمينات محتجزة لضمان الأعمال (نسبة 5\% إلى 10\% تحتجز حتى نهاية فترة الضمان)} \\
  \text{Credit: } & 210401 \text{ مصلحة التأمينات الاجتماعية - حصة مقاولات التشييد (1.8\% إلى 2.16\% سداد مباشر)} \\
  \text{Credit: } & 210501 \text{ مصلحة الضرائب - ضريبة الخصم والتحصيل من المنبع (1\% أرباح تجارية وصناعية)} \\
  \text{Credit: } & 110101 \text{ البنك / أوراق دفع (صافي المبلغ المستحق صرفه للمقاول)}
  \end{aligned}$$
* **الميزة:** إقفال مقاصة السولار والإعاشة فورياً وتقليل خروج النقدية من الشركة إلى الصافي الحقيقي فقط مع ضبط الضرائب والتأمينات.

---

### 2.5 معالجة عمولات المحافظ الإلكترونية وشبكة المدفوعات اللحظية (InstaPay & E-Wallets)
* عند تحويل أو سحب مبالغ نقدية لتغذية العهد الميدانية عبر فودافون كاش أو إنستاباي، تُخصم عمولة سحب/تحويل (1% أو الحد الأقصى للعملية).
* يُنشئ النظام فورياً قيداً آلياً متزامناً مع العملية:
  $$\begin{aligned}
  \text{Debit: } & 520401 \text{ مصروفات وعمولات بنكية ومحافظ إلكترونية (P\&L Expense)} \\
  \text{Credit: } & 110201 \text{ عهدة المشرف بالموقع (تسوية المبلغ المخصوم كعمولة)}
  \end{aligned}$$
* يمنع هذا القيد تراكم أي عجز دفتري غير مفسر في عهدة المشرف، ويجعل رصيد العهدة الفعلي في جيب المشرف مطابقاً لسجلات النظام بنسبة 100%.

---

### 2.6 المسار المزدوج لتسوية مستحقات العمالة (Dual-Track Worker Settlement)
* **المسار الأول (العمالة الدائمة والمثبتة):** استقطاع مسحوبات الكانتين والسلف النقدية تلقائياً بنهاية كل شهر عبر مسير الرواتب المعتمد (`PayrollRun`).
* **المسار الثاني (العمالة المؤقتة، اليوميات، وعمال المواسم):**
  - يوفر البوت والداشبورد شاشة تصفية فورية (`Interim Clearance Sheet`).
  - تقوم بتجميع ساعات وأيام العمل المستحقة للعامل المؤقت، وخصم مسحوبات الكانتين والسجائر والسلف النقدية المستلمة خلال فترة عمله بالموقع، وتوليد إيصال تصفية نهائي معتمد يُوقع عليه العامل ويُصرف له الصافي نقداً قبل مغادرته بوابة الموقع.

---

## 🤖 3. منظومة تفنيط فواتير وبوالص الموردين بالذكاء الاصطناعي (`packages/ai-vision-engine`)

استثماراً لمحرك الذكاء الاصطناعي المشترك في النواة `@alsaada/ai-vision-engine` (المستخدم لفحص بطاقات الرقم القومي)، تم تعميم وتوسيع قدراته لمعالجة فواتير وبوالص الشحن الميدانية:

### 3.1 تدفق المعالجة غير المتزامنة في الخلفية (Async Background Pre-Parsing):
1. **الخطوة 1 (تسجيل الشحنة السريع):** يرفع المشرف صورة الفاتورة/البوليصة ويسجل الإجمالي التقريبي.
2. **ضغط وحفظ الصورة فورياً:** يتم ضغط الصورة عبر `sharp` إلى WebP وحفظها في `attachments/inventory/items/`.
3. **إطلاق المعالجة الخلفية:** يطلق السيرفر فورياً مهمة خلفية غير محجوبة تستدعي `aiVisionEngine.scanDocument(buffer, 'INVOICE')`.
4. **تخزين النتيجة المستخرجة:** تُحفظ البيانات المستخرجة في حقل `InboundShipment.ocrExtractedData: Json`.
5. **الخطوة 2 (تفنيط البنود):** عندما يفتح المشرف شاشة التفنيط `11.3`، تظهر كافة البنود والكميات والأسعار جاهزة ومطابقة في أجزاء من الثانية (زمن انتظار صفر ثانية!).

### 3.2 بنية البيانات المستخرجة بدقة (`ocrExtractedData JSON Schema`):
```json
{
  "vendor": {
    "name": "شركة النيل للتوريدات البترولية",
    "taxNumber": "123-456-789",
    "commercialRegister": "98765"
  },
  "invoice": {
    "invoiceNumber": "INV-2026-8891",
    "date": "2026-09-17",
    "grossTotal": 45600.00,
    "vatAmount": 5600.00,
    "netTotal": 40000.00,
    "currency": "EGP"
  },
  "items": [
    {
      "lineNumber": 1,
      "rawDescription": "فلتر زيت حفار كوماتسو 300 أصلي",
      "quantity": 10,
      "unit": "قطعة",
      "unitPrice": 850.00,
      "lineTotal": 8500.00,
      "matchedItemId": "item_wh1_flt_0042",
      "matchConfidence": 0.94,
      "isNewItem": false
    },
    {
      "lineNumber": 2,
      "rawDescription": "جركن زيت هيدروليك 68 موبيل 20 لتر",
      "quantity": 15,
      "unit": "جركن",
      "unitPrice": 2100.00,
      "lineTotal": 31500.00,
      "matchedItemId": "item_wh2_oil_0019",
      "matchConfidence": 0.88,
      "isNewItem": false
    }
  ]
}
```

### 3.3 خوارزمية المطابقة الضبابية للأصناف (Hybrid Fuzzy Matching):
- مقارنة وصف البند المستخرج مع أصناف المخزن المستهدف بخوارزمية Levenshtein Distance مع Trigram Similarity.
- **تطابق $\ge 80\%$:** ربط البند آلياً مع كود الصنف المسجل بشارة خضراء.
- **تطابق $< 80\%$ أو صنف جديد:** إظهار زر فوري: `[ ➕ تسجيل كصنف جديد في المخزن ]`، وعند النقر عليه تُملأ بطاقة الصنف الجديد تلقائياً من بيانات الفاتورة بنقرة واحدة.

---

## 📱 4. ميني آب تليجرام المدمج لقراءة وتوليد الباركود (`BarcodeScannerMiniApp`)

تم بناء الميني آب داخل حزمة النواة المشتركة `@alsaada/core-components/barcode-mini-app`:
* **المسح بالكاميرا الميدانية:** واجهة سريعة الاستجابة داخل تليجرام بمكتبة `@zxing/library` و Canvas، تدعم EAN-13, EAN-8, Code 128, QR Code، مع زر فلاش الكاميرا واهتزاز هابتيك عند النجاح.
* **التحقق التشفيري الإلزامي (`initData HMAC-SHA256`):** ترتيب معاملات تليجرام أبجدياً والتحقق من الهاش باستخدام مفتاح مشتق من توكن البوت لمنع التلاعب.
* **توليد الباركود والـ QR Code الداخلي:** توليد أكواد داخلية بصيغة `AL-WH{WID}-{CAT}-{SEQ}` وطباعة ملصقات حرارية عبر الداشبورد.

---

## 🗄️ 5. معمارية المخازن المتخصصة والديناميكية والسمات الفنية (Dynamic Custom Attributes)

هيكلية هجينة تجمع بين **6 مخازن افتراضية متخصصة** و**محرك مخازن حرة ديناميكية** غير محدودة:
1. **مخزن الفلاتر:** `partNumber` (كود الجزء), `compatibleEquipment` (المعدات المتوافقة), `filterType` (زيت، سولار، هيدروليك، هواء), `oemBrand` (الماركة).
2. **مخزن الزيوت والشحوم:** `viscosityGrade` (اللزوجة: 15W40, 20W50, 68), `packageType` (جركن 20 لتر، برميل 208 لتر), `application` (محرك، هيدروليك).
3. **مخزن قطع الغيار:** `oemPartNumber` (الكود الأصلي), `crossRefNumber` (الكود البديل), `binLocation` (موقع الرف الفيزيائي), `condition` (جديد، مجدد).
4. **مخزن السولار والوقود:** `tankCode` (كود التانك), `totalCapacity` (السعة القصوى), `fuelDensity` (الكثافة), `calibrationChartId` (جدول المعايرة).
5. **مخزن الكانتين والإعاشة:** `expiryDate` (تاريخ الصلاحية), `itemCategory` (سجائر، معلبات، مياه، لحوم), `dispenseUnit` (علبة، كرتونة، كجم).
6. **مخزن المهمات والعدد:** `size` (المقاس), `isReturnable` (مستردة كعهدة أم مستهلكة), `serialNumber` (الرقم التسلسلي للعدد الكهربائية).
7. **المخازن الحرة الديناميكية:** توليد مدقق Zod لحظي (`DynamicWarehouseSchemaEngine`) بناءً على تعريف الحقول المخصصة في `Warehouse.schemaDefinition`.

---

## 💾 6. خط أنابيب حفظ الصور والمرفقات على القرص الصلب للمشروع

* **مسار الحفظ الهيكلي المنظم:** `attachments/inventory/items/{itemCode}/originals/` و `thumbnails/`.
* **خط الأنابيب غير المتزامن لمعالجة الصور (`Async Sharp Pipeline`):**
  - فحص نوع الملف الحقيقي (Magic Bytes) لمنع الملفات الخبيثة.
  - تحويل إلى **WebP** بجودة 80% وحجم أقل من **300 كيلوبايت**.
  - توليد صورة مصغرة (Thumbnail: 150×150 px).
  - حساب وتخزين هاش SHA-256 للملف.
  - تعقيم المسارات (Path Sanitization) ضد هجمات تجاوز المجلدات (Directory Traversal).
* **التصفح الآمن في الداشبورد:** مسار Next.js محمي `/api/attachments/inventory/[...path]` مع كاش طويل الأمد.

---

## 🔒 7. التحصينات الهندسية والبرمجية ومكافحة سباق العمليات (Concurrency & Security)

1. **التحديثات الذرية وقفل التفاؤل:** تحديث الأرصدة عبر `currentStock: { decrement: qty }, version: { increment: 1 }` داخل PostgreSQL Transaction لمنع الـ Race Conditions.
2. **أقفال عدم التكرار الموزعة:** عبر Redis `SET idempotency:action:{hash} EX 300 NX`.
3. **الحسابات المالية الدقيقة:** باستخدام `Decimal.js` مع تقريب بنكي (Banker's Half-Even Rounding) لخانتي قروش وحظر الفاصلة العائمة.
4. **سلاسل الهاش الجنائية المجزأة حسب الموقع:** احتساب سلسلة الهاش SHA-256 لكل موقع ودفتر بشكل مستقل (`siteId-ledgerCode`) لمنع عنق الزجاجة وتزاحم الأقفال.

---

## 🧩 8. خريطة جرد النواة المشتركة وتصفير التكرار البرمجي (Zero Code Duplication)

### 8.1 المكونات المشتركة الحالية الجاهزة للاستخدام الفوري (12 مكوناً):
1. `AiVisionEngine` (`packages/ai-vision-engine`)
2. `UniversalAmountPicker` (`packages/core-components`)
3. `UniversalQuantityPicker` (`packages/core-components`)
4. `UniversalDatePicker` (`packages/core-components`)
5. `UniversalSourceOfFundsPicker` (`packages/core-components`)
6. `UniversalCustodyGate` (`packages/core-components`)
7. `TripleBalanceClearingEngine` (`packages/core-components`)
8. `UniversalConfirmationCard` & `ConfirmationKeyboard`
9. `UniversalCompletionCard` & `WhatsAppShare`
10. `TopicRouter & NotificationDispatcher`
11. `UniversalAttachmentPipeline`
12. `RegionalEngine`

### 8.2 المكونات المشتركة الجديدة المستحدثة في النواة (10 مكونات جديدة):
1. `buildSupplierPickerKeyboard` & `formatSupplierCard`
2. `buildWarehousePickerKeyboard` & `formatWarehouseCard`
3. `buildItemPickerKeyboard` & `formatInventoryItemCard`
4. `BarcodeScannerMiniApp` (تليجرام ميني آب للباركود مع HMAC)
5. `DynamicWarehouseSchemaEngine` (مدقق Zod الديناميكي للمخازن الحرة)
6. `MovingAverageCostEngine (WAC Engine)` (محرك التكلفة المرجحة بالحساب العشري)
7. `FuelDipstickDistributionEngine` (محرك تحويل السيخ والتوزيع بساعات المعدات)
8. `ComprehensiveExtractClearingEngine` (محرك مقاصة المستخلص المركب)
9. `GRNIReconciliationEngine` (محرك تسوية الوارد غير المفوتر وفروق الأسعار)
10. `SitePartitionedHashEngine` (محرك الهاش الجنائي المجزأ بالموقع)

---

## 🗺️ 9. جدول مطابقة التدفقات والشاشات بالتوازي المتزامن (Dual-Track Matrix)

| المجال الوظيفي | كود التدفق في تليجرام بوت (`apps/bot-server/src/modules/...`) | الشاشة المقابلة في لوحة تحكم الويب (`apps/admin-dashboard/src/app/admin/...`) |
| :--- | :--- | :--- |
| **المشتريات والموردين** | • `09.1-new-supplier` (تسجيل وتصنيف مورد جديد)<br/>• `09.2-supplier-ledger` (كشف حساب المورد 360°)<br/>• `09.3-pay-supplier` (سداد دفعة من عهدة أو خزينة)<br/>• `09.4-contractor-clearing` (تسوية مستخلص مقاول باطن)<br/>• `09.5-grni-reconciliation` (مطابقة وارد غير مفوتر) | • `/admin/finance/suppliers` (دليل وسجل الموردين)<br/>• `/admin/finance/suppliers/[id]` (كشف حساب تفاعلي 360°)<br/>• `/admin/finance/invoices` (سجل فواتير التوريد والمطابقة)<br/>• `/admin/finance/extracts` (مقاصة مستخلصات المقاولين)<br/>• `/admin/finance/grni` (شاشات تسوية الـ GRNI) |
| **المخازن والأصناف** | • `11.0-warehouse-manager` (إدارة وإنشاء المخازن الحرة)<br/>• `11.1-item-registration` (تسجيل صنف وتوليد باركود)<br/>• `11.2-inbound-shipment` (استلام شحنة واردة سريعة)<br/>• `11.3-itemize-invoice` (تفنيط بنود الفاتورة بالـ AI)<br/>• `11.4-price-observatory` (مرصد ومؤشر أسعار الأصناف) | • `/admin/logistics/warehouses` (مستكشف المخازن وحقولها)<br/>• `/admin/logistics/items` (دليل الأصناف والملصقات)<br/>• `/admin/logistics/inbound` (الشحنات وتفنيط الـ AI)<br/>• `/admin/logistics/price-radar` (رادار ومؤشر الأسعار) |
| **التشغيل والصرف الميداني** | • `07.2-fuel-dipstick` (تسجيل وقود السيخ وساعات المعدات)<br/>• `07.4-composite-service` (سيرفيس مجمع فلاتر وزيوت)<br/>• `11.5-camp-food` (صرف أغذية الكانتين ومطبخ الموقع)<br/>• `11.6-cigarettes` (صرف سجائر ومسحوبات العمال) | • `/admin/operations/fleet-fuel` (مراقبة ورادار وقود الأسطول)<br/>• `/admin/operations/maintenance` (سجل كروت الصيانة والسيرفيس)<br/>• `/admin/operations/camp` (تكاليف الإعاشة والمطبخ)<br/>• `/admin/workforce/advances` (سلف ومسحوبات العمالة) |
| **الرقابة والجرد المخزني** | • `11.7-stock-audit` (الجرد الفعلي ومعالجة العجز بالـ 3 خيارات)<br/>• `11.8-aging-radar` (رادار الأصناف الراكدة والمخصصات) | • `/admin/logistics/audits` (محاضر الجرد والتسوية الرقابية)<br/>• `/admin/logistics/aging` (تحليل أعمار المخزون والمخصص) |

---

## 🗄️ 10. نماذج قاعدة البيانات الموسعة المقترحة (`Prisma Schema Enhancements`)

```prisma
// نموذج الموردين المطور
model Supplier {
  id                 String              @id @default(cuid())
  code               String              @unique // كود فريد مثل SUP-001
  name               String
  contactPerson      String?
  phone              String
  secondaryPhone     String?
  taxNumber          String?             // البطاقة الضريبية
  commercialRegister String?             // السجل التجاري
  taxRegime          SupplierTaxRegime   @default(STANDARD_VAT) // ضريبي عادي، صغار موردين، مقاولات
  contractType       SupplierContractType @default(CASH)         // كاش، آجل، مستخلصات
  category           SupplierCategory    // وقود، قطع غيار، كانتين، مقاول باطن، مهمات
  paymentTermsDays   Int                 @default(0)            // فترة الائتمان بالأيام
  creditLimit        Decimal?            @db.Decimal(12, 2)     // الحد الائتماني
  currentBalance     Decimal             @default(0) @db.Decimal(12, 2) // رصيد المورد اللحظي
  siteId             String?             // الموقع التابع له المورد إن وجد
  site               Site?               @relation(fields: [siteId], references: [id])
  inboundShipments   InboundShipment[]
  invoices           SupplierInvoice[]
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
}

// نموذج المخزن المطور (يشمل الـ 6 الافتراضية والمخازن الحرة)
model Warehouse {
  id               String           @id @default(cuid())
  code             String           @unique // WH-SITE1-DIESEL
  name             String
  type             WarehouseType    // FILTERS, OILS, SPARE_PARTS, DIESEL, CANTEEN, TOOLS, CUSTOM
  siteId           String
  site             Site             @relation(fields: [siteId], references: [id])
  isDefault        Boolean          @default(false)
  schemaDefinition Json?            // تعريف الحقول المخصصة في حال كان مخزن مخصص CUSTOM
  items            InventoryItem[]
  inboundShipments InboundShipment[]
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
}

// نموذج الصنف المخزني الشامل
model InventoryItem {
  id                 String             @id @default(cuid())
  warehouseId        String
  warehouse          Warehouse          @relation(fields: [warehouseId], references: [id])
  itemCode           String             @unique // AL-WH1-FLT-0042
  barcode            String?            @unique // الباركود التجاري المقروء بالكاميرا
  name               String
  description        String?
  unit               String             // لتر، قطعة، كجم، جركن، علبة
  currentStock       Decimal            @default(0) @db.Decimal(12, 3)
  minimumStockAlert  Decimal            @default(0) @db.Decimal(12, 3)
  movingAverageCost  Decimal            @default(0) @db.Decimal(12, 2) // متوسط التكلفة المرجح WAC
  lastPurchasePrice  Decimal            @default(0) @db.Decimal(12, 2)
  imagePath          String?            // مسار الصورة في attachments/inventory/items/...
  thumbnailPath      String?
  customAttributes   Json?              // السمات الفنية (اللزوجة، رقم القطعة، الصلاحية، إلخ)
  version            Int                @default(1) // قفل التفاؤل لمنع سباق العمليات
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
}

// نموذج الشحنات الواردة وتفنيط الفواتير بالـ AI
model InboundShipment {
  id                 String             @id @default(cuid())
  shipmentNumber     String             @unique // SHP-2026-0001
  warehouseId        String
  warehouse          Warehouse          @relation(fields: [warehouseId], references: [id])
  supplierId         String
  supplier           Supplier           @relation(fields: [supplierId], references: [id])
  status             ShipmentStatus     @default(PENDING_ITEMIZATION) // PENDING, ITEMIZED, GRNI_SETTLED
  invoiceImage       String?            // مسار صورة الفاتورة
  ocrExtractedData   Json?              // البيانات المستخرجة بالـ AI Vision
  totalAmount        Decimal            @db.Decimal(12, 2)
  isGRNI             Boolean            @default(false) // هل تم استلامها بدون فاتورة رسمية
  items              InboundItem[]
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
}

// نموذج تعريف تنكات السولار بالموقع
model DieselTank {
  id                 String                @id @default(cuid())
  code               String                @unique // TANK-SITE1-MAIN
  name               String                // تانك المحطة الرئيسي، فنطاس متحرك، إلخ
  siteId             String
  site               Site                  @relation(fields: [siteId], references: [id])
  totalCapacityLiters Decimal              @db.Decimal(10, 2) // مثلاً 10000.00
  totalNotches       Int                   // إجمالي عدد الشرطات على السيخ (مثلاً 100 أو 200)
  litersPerNotch     Decimal               @db.Decimal(10, 3) // قيمة الشرطة باللترات (مثلاً 50.000 أو 100.000)
  calibrationChart   Json?                 // جدول معايرة الشرطات الاختياري للتنكات غير المنتظمة
  currentNotches     Decimal               @default(0) @db.Decimal(6, 2)
  currentLiters      Decimal               @default(0) @db.Decimal(10, 2)
  soundingLogs       DipstickSoundingLog[]
  createdAt          DateTime              @default(now())
  updatedAt          DateTime              @updatedAt
}

// نموذج قياس السولار بالسيخ (بالشرطة) وساعات المعدات
model DipstickSoundingLog {
  id                 String             @id @default(cuid())
  siteId             String
  site               Site               @relation(fields: [siteId], references: [id])
  tankId             String             // التانك المقاس
  tank               DieselTank         @relation(fields: [tankId], references: [id])
  shiftDate          DateTime
  shiftType          String             // MORNING, NIGHT
  openingNotches     Decimal            @db.Decimal(6, 2) // قراءة بداية الوردية بالشرطة (مثلاً 64.5)
  openingVolumeLiters Decimal           @db.Decimal(10, 2)
  inboundFuelLiters  Decimal            @default(0) @db.Decimal(10, 2)
  closingNotches     Decimal            @db.Decimal(6, 2) // قراءة نهاية الوردية بالشرطة (مثلاً 42.0)
  closingVolumeLiters Decimal           @db.Decimal(10, 2)
  actualConsumedLiters Decimal          @db.Decimal(10, 2)
  theoreticalConsumedLiters Decimal     @db.Decimal(10, 2)
  variancePercentage Decimal            @db.Decimal(6, 2)
  allocations        FuelMachineAllocation[]
  createdAt          DateTime           @default(now())
}
```

---

## 🗺️ 11. خارطة الشرائح الـ 10 الدقيقة المتتابعة وبروتوكول التسليم (Sequential Micro-Slices Roadmap)

تنفيذاً لميثاق الحوكمة، يتم تنفيذ المنظومة على **10 شرائح رأسية متتابعة صارمة**، لا يتم الانتقال من أي شريحة إلى التي تليها إلا بعد اجتياز بوابة الفحص الثلاثية (آلياً + يدوياً + اعتماد صريح):

```mermaid
graph LR
    S0["Slice 0:<br/>النواة وقاعدة البيانات"] --> S1["Slice 1:<br/>المخازن والمستكشف"]
    S1 --> S2["Slice 2:<br/>ميني آب الباركود"]
    S2 --> S3["Slice 3:<br/>الأصناف وحفظ الصور"]
    S3 --> S4["Slice 4:<br/>الموردين وعهد السداد"]
    S4 --> S5["Slice 5:<br/>الشحنات وتفنيط AI"]
    S5 --> S6["Slice 6:<br/>وقود السيخ والمعدات"]
    S6 --> S7["Slice 7:<br/>الصرف والسيرفيس"]
    S7 --> S8["Slice 8:<br/>المستخلصات المركبة"]
    S8 --> S9["Slice 9:<br/>الجرد ورادار الركود"]
```

### تفصيل الشرائح الـ 10 المتتابعة:

#### 🔹 Slice 0: المرحلة التأسيسية الشاملة للنواة المشتركة وقاعدة البيانات (Master Shared Kernel & DB Foundation)
* **الهدف:** بناء وتجهيز واختبار البنية التحتية الصلبة لقاعدة البيانات وكافة المحركات والوظائف المشتركة الـ 10 في النواة `@alsaada/core-components` مسبقاً قبل البدء في أي موديول.
* **النطاق:**
  1. تحديث `schema.prisma` بنماذج الموردين، المخازن الـ 6، تنكات السولار `DieselTank`، أذون الشحن وتفنيط الذكاء الاصطناعي، وسجلات السيخ وتوزيع الوقود، وتشغيل `pnpm db:generate`.
  2. بناء المكونات المشتركة الـ 10 في `packages/core-components`:
     - لوحات مفاتيح وبطاقات العرض: `buildSupplierPickerKeyboard`, `buildWarehousePickerKeyboard`, `buildItemPickerKeyboard`.
     - `BarcodeScannerMiniApp` وتوثيق `initData HMAC-SHA256` وتوليد ملصقات الطباعة.
     - `DynamicWarehouseSchemaEngine` (مولد مدققات Zod الفوري).
     - `MovingAverageCostEngine (WAC Engine)` بالحسابات العشرية الدقيقة.
     - `FuelTankNotchDistributionEngine` (محرك قياس التنكات بالشرطة وحساب اللترات وتوزيع الوقود بساعات المعدات ورادار الانحراف > 20%).
     - `ComprehensiveExtractClearingEngine` و `GRNIReconciliationEngine` و `SitePartitionedHashEngine`.
* **بوابة الفحص:** اجتياز `pnpm typecheck`، واختبارات الوحدة لكافة المحركات بنسبة نجاح 100%.

#### 🔹 Slice 1: إدارة المخازن الـ 6 والمخازن الحرة الديناميكية ومستكشف الداشبورد
* **الهدف:** تأسيس توبولوجيا المخازن بالموقع والسمات الفنية المخصصة.
* **النطاق:** تدفق البوت `11.0-warehouse-manager` + صفحة الداشبورد `/admin/logistics/warehouses` (استدعاء مباشر للمحركات المشتركة الجاهزة من Slice 0).
* **بوابة الفحص:** إنشاء مخزن افتراضي ومخزن مخصص في البوت $\rightarrow$ ظهوره اللحظي في الداشبورد، والتحقق اليدوي.

#### 🔹 Slice 2: ميني آب مسح وتوليد الباركود والـ QR Code المشترك
* **الهدف:** تفعيل واختبار أداة المسح الضوئي بالكاميرا في تليجرام مع التوثيق التشفيري.
* **النطاق:** ربط `BarcodeScannerMiniApp` في تدفقات البوت والداشبورد للتعرف الفوري على الأصناف.
* **بوابة الفحص:** مسح كود تجريبي بالكاميرا والتحقق من التوقيع التشفيري ونجاح الاختبار الآلي واليدوي.

#### 🔹 Slice 3: دليل الأصناف المخزنية وخط أنابيب حفظ الصور على القرص ومحرك WAC
* **الهدف:** تسجيل الأصناف وربطها بالباركود والسمات الفنية وحفظ صورها محلياً وحساب التكلفة المرجحة.
* **النطاق:** تدفق البوت `11.1-item-registration` + صفحة الداشبورد `/admin/logistics/items` + خط أنابيب `sharp` غير المتزامن لحفظ WebP في `attachments/inventory/items/`.
* **بوابة الفحص:** تسجيل صنف ورفع صورته ومسح باركوده $\rightarrow$ حفظ الصورة على القرص وظهوره في بطاقات الداشبورد.

#### 🔹 Slice 4: دليل الموردين وكشف الحساب 360° وسداد دفعات العهدة اللحظية
* **الهدف:** إدارة شجرة الموردين والتصنيف الضريبي ومتابعة الأرصدة وسداد الدفعات بضوابط العهدة.
* **النطاق:** تدفقات البوت `09.1-new-supplier`, `09.2-supplier-ledger`, `09.3-pay-supplier` + شاشات الداشبورد `/admin/finance/suppliers` + صمام أمان العهدة اللحظي.
* **بوابة الفحص:** تسجيل مورد وسداد دفعة من العهدة $\rightarrow$ التحقق من فحص كفاية الرصيد وظهور الحركة بكشف الحساب 360°.

#### 🔹 Slice 5: استلام الشحنات وتفنيط الفواتير بالـ AI ومطابقة الـ GRNI
* **الهدف:** استلام الوارد الميداني وتفريغ بنود الفواتير بالذكاء الاصطناعي في 0 ثانية مع دعم الوارد غير المفوتر.
* **النطاق:** تدفقات البوت `11.2-inbound-shipment`, `11.3-itemize-invoice`, `09.5-grni-reconciliation` + صفحة الداشبورد `/admin/logistics/inbound` + محرك `aiVisionEngine` والمطابقة الضبابية.
* **بوابة الفحص:** رفع صورة فاتورة مشتريات $\rightarrow$ استخراج البنود بالخلفية وتفنيطها وتحديث رصيد المخزن في 0 ثانية.

#### 🔹 Slice 6: مخزن السولار وقياس التنكات المتعددة بالشرطة وتوزيع وقود المعدات ورادار الانحراف
* **الهدف:** قياس استهلاك الوقود بالشرطة واختيار التانك وتوزيعه الموزون بساعات تشغيل المعدات وعزل عجز التسريب > 20%.
* **النطاق:** تدفق البوت `07.2-fuel-dipstick` (اختيار التانك، إدخال رقم الشرطة واللترات) + صفحة الداشبورد `/admin/operations/fleet-fuel`.
* **بوابة الفحص:** اختيار تانك وإدخال قراءة الشرطة وساعات 3 معدات $\rightarrow$ التحقق من احتساب اللترات والتوزيع النسبي وعزل عجز التسريب.

#### 🔹 Slice 7: التشغيل والصرف الداخلي (سيرفيس المعدات، مطبخ الموقع، وسجائر العمال بالتكلفة)
* **الهدف:** ضبط الصرف الداخلي من المخازن وإغلاق دائرة مسحوبات السجائر والسلع بدون كاش وبربح صفري.
* **النطاق:** تدفقات البوت `07.4-composite-service`, `11.5-camp-food`, `11.6-cigarettes` + شاشات الداشبورد المقابلة + محرك `TripleBalanceClearingEngine`.
* **بوابة الفحص:** تسجيل سيرفيس معدة (فلاتر+زيوت)، صرف إعاشة، وصرف سجائر لعامل $\rightarrow$ التأكد من صرف السجائر بالتكلفة وعدم خروج أي نقدية.

#### 🔹 Slice 8: مقاصة المستخلصات الإنشائية المركبة وعمولات المحافظ الإلكترونية
* **الهدف:** المعالجة المالية المجمعة لمقاولي الباطن وخصم السولار والإعاشة والتأمينات والضرائب وتثبيت عمولات العهد.
* **النطاق:** تدفق البوت `09.4-contractor-clearing` + صفحة الداشبورد `/admin/finance/extracts` + محرك `ComprehensiveExtractClearingEngine` + قيود عمولات إنستاباي.
* **بوابة الفحص:** تسجيل مستخلص مقاول باطن مع خصم السولار وضمان 5% $\rightarrow$ التحقق من القيد المركب وإقفال مقاصة السولار.

#### 🔹 Slice 9: الرقابة والجرد الفعلي ورادار الركود ومرصد الأسعار التاريخي
* **الهدف:** الرقابة المخزنية الشاملة، معالجة فروق الجرد بالخيارات الثلاثة، ورصد الأصناف الراكدة وتقلبات الأسعار.
* **النطاق:** تدفقات البوت `11.7-stock-audit`, `11.8-aging-radar`, `11.4-price-observatory` + شاشات الداشبورد `/admin/logistics/audits` و `/admin/logistics/aging`.
* **بوابة الفحص:** تسجيل محضر جرد بعجز وفائض وتسويته بالخيارات الـ 3 $\rightarrow$ تشغيل فحص الحوكمة الشامل `pnpm governance:verify`.

---

## 🛡️ 12. ميثاق الحصانة وبروتوكول القفل النهائي (Governance Protocol)

* **القاعدة الملزمة:** فور الانتهاء من بناء واختبار أي تدفق أو شاشة بنسبة 100%، يلتزم الوكيل بعدم قفلها أو إغلاقها إلا بعد استئذان المستخدم وتقديم الصيغة المعتمدة حصراً:  
  > «تم الانتهاء بنجاح من بناء واختبار وظيفة **[اسم الوظيفة / الشاشة]**. هل نقفل ونحمى هذه الوظيفة تشفيرياً ضد أي تعديل؟  
  > **لإتمام القفل والحماية، يرجى الرد بالصيغة المعتمدة حصراً:**  
  > **«نعم اقفل»**»
* **السيادة المطلقة للنواة:** يُحظر تماماً كتابة أي منطق مكرر أو زر اختيار خارج النواة المشتركة `@alsaada/core-components`.
