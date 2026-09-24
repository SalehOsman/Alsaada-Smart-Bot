# تدفق 01.1: معالج تسجيل وتعيين العمالة الميدانية (Worker Registration Wizard)
## Flow 01.1: Comprehensive Worker Onboarding & National ID Verification Wizard

> **الموديول:** `modules/workforce`  
> **كود التدفق:** `01.1`  
> **الرتب المصرح لها:** `SUPER_ADMIN`, `GENERAL_ADMIN`, `FIELD_ADMIN`  
> **ميزانية التيليجرام:** 36/16/7/3  
> **حالة التدفق:** 🟢 مكتمل وموثق 100%  

---

### 🗺️ مخطط دورة حياة التدفق (State Machine Diagram)

```mermaid
stateDiagram-v2
    [*] --> Idle: تشغيل التدفق
    
    Idle --> DocTypeSelection: menu:hr:onboarding
    
    state DocTypeSelection {
        [*] --> ChooseDocument: nat_id / passport
        ChooseDocument --> PhotoPrompt: اختيار نوع الوثيقة
    }
    
    state OnboardingWizard {
        [*] --> PhotoPrompt
        PhotoPrompt --> OcrProcessing: إرسال صورة البطاقة
        PhotoPrompt --> ManualInput: تخطي الذكاء الاصطناعي
        
        OcrProcessing --> NationalIdVerification: استخراج البيانات آلياً
        ManualInput --> NationalIdVerification: إدخال الرقم القومي
        
        NationalIdVerification --> NationalIdVerification: فشل فحص Modulo-11 (إعادة)
        NationalIdVerification --> FullNamePrompt: رقم قومي سليم
        
        FullNamePrompt --> NicknamePrompt: اعتماد الاسم الرسمي
        NicknamePrompt --> PhoneNumberPrompt: اختيار اسم الشهرة
        PhoneNumberPrompt --> PayoutMethodPrompt: إدخال رقم الهاتف
        PayoutMethodPrompt --> JobSelectionPrompt: تحديد طريقة الصرف (محفظة/كاش)
        JobSelectionPrompt --> SiteAssignmentPrompt: اختيار المهنة
        SiteAssignmentPrompt --> WageConfirmationPrompt: اختيار موقع العمل
        WageConfirmationPrompt --> SummaryConfirmationCard: تحديد الأجر اليومي
    }
    
    SummaryConfirmationCard --> SaveWorkerRecord: wizard:worker:confirm (تأكيد نهائي)
    SummaryConfirmationCard --> CancelWizard: wizard:worker:cancel (إلغاء)
    
    SaveWorkerRecord --> WorkerCreatedCard: توليد كود العامل وبطاقة العمل
    CancelWizard --> MainMenu: تنظيف الجلسة
    
    WorkerCreatedCard --> [*]: إنهاء
    MainMenu --> [*]: إنهاء
```

---

### 🛡️ القواعد الحوكمية المعمارية المطبقة
1. **التحقق الجنائي من الرقم القومي (Gate G1):** فحص خوارزمية Modulo-11 المصرية واستخراج تاريخ الميلاد والمحافظة.
2. **شريحة الـ 10 ملفات (Gate G2):** فصل جلسات المعالج عبر `UniversalWizardSessionEngine`.
3. **حجب الأجور والبيانات الحساسة (Gate G8):** تطبيق `formatSpoiler` على تفاصيل الأجر والراتب اليومي.
4. **ميزانية التيليجرام (Gate G5):** الالتزام بألا يتجاوز طول الـ Callback الـ 36 بايت.
