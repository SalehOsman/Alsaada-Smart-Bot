# تدفق 01.5: دليل وسجلات العاملين والملف الشامل 360 (Worker Directory)
## Flow 01.5: Worker Directory, Search & Profile 360 Hub

> **الموديول:** `modules/workforce`  
> **كود التدفق:** `01.5`  
> **الرتب المصرح لها:** `SUPER_ADMIN`, `GENERAL_ADMIN`, `FIELD_ADMIN`  
> **ميزانية التيليجرام:** 36/16/7/3  
> **حالة التدفق:** 🟢 مكتمل وموثق 100%  

---

### 🗺️ مخطط دورة حياة التدفق (State Machine Diagram)

```mermaid
stateDiagram-v2
    [*] --> Idle: تشغيل التدفق
    
    Idle --> WorkerDirectory: action:worker:dir أو menu:hr_sub:directory
    
    state WorkerDirectory {
        [*] --> RenderDirectoryList
        RenderDirectoryList --> SearchPrompt: action:worker:dir:search_prompt
        RenderDirectoryList --> Profile360View: action:worker:view:* (اختيار عامل)
        
        state SearchPrompt {
            [*] --> AwaitingQuery: إدخال الاسم / الكود / الرقم القومي
            AwaitingQuery --> FilteredResults: مطابقة البيانات
            FilteredResults --> Profile360View: اختيار من النتائج
            FilteredResults --> RenderDirectoryList: action:worker:dir:clear_search (إلغاء البحث)
        }
        
        state Profile360View {
            [*] --> Render360Card
            Render360Card --> RevealNationalId: إظهار الرقم القومي كاملاً
            Render360Card --> ViewDocumentsGallery: استعراض مرفقات العامل
            Render360Card --> WhatsAppDirectLink: فتح محادثة الواتساب
            Render360Card --> EditWorkerRedirect: الانتقال لمعالج التعديل 01.2.D
        }
    }
    
    WorkerDirectory --> HrSubMenu: menu:hr_sub:onboarding
    WorkerDirectory --> MainMenu: action:main_menu
    
    HrSubMenu --> [*]: إنهاء
    MainMenu --> [*]: إنهاء
```

---

### 🛡️ القواعد الحوكمية المعمارية المطبقة
1. **عقد الشريحة الرأسية (Gate G2):** اعتماد مكون `buildWorkerPickerKeyboard` الموحد من `@alsaada/core-components`.
2. **ميزانية التيليجرام (Gate G5):** الالتزام بألا يتجاوز طول الـ Callback الـ 36 بايت.
3. **حماية الخصوصية (Gate G8):** تشفير وحجب الرقم القومي ما لم يطلب المستخدم المصرح له إظهاره صراحة.
