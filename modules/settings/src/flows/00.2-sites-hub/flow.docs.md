# تدفق 00.2: إدارة المواقع والفروع الميدانية (Sites Hub)
## Flow 00.2: Field Sites & Geofencing Hub

> **الموديول:** `modules/settings`  
> **كود التدفق:** `00.2`  
> **الرتب المصرح لها:** `SUPER_ADMIN`, `GENERAL_ADMIN`  
> **ميزانية التيليجرام:** 36/16/7/3  
> **حالة التدفق:** 🟢 مكتمل وموثق 100%  

---

### 🗺️ مخطط دورة حياة التدفق (State Machine Diagram)

```mermaid
stateDiagram-v2
    [*] --> Idle: تشغيل التدفق
    
    Idle --> SitesList: action:settings:sites_hub
    
    state SitesList {
        [*] --> RenderList
        RenderList --> ViewSiteDetail: action:site:view:*
        RenderList --> AddSiteWizard: action:site:add_new
    }
    
    state ViewSiteDetail {
        [*] --> SiteCard
        SiteCard --> ToggleStatus: action:site:toggle:*
        SiteCard --> EditSiteMenu: action:site:edit_menu:*
        ToggleStatus --> SiteCard: تحديث الحالة (نشط/مجمد)
        EditSiteMenu --> SiteCard: حفظ التعديلات
    }
    
    state AddSiteWizard {
        [*] --> PromptName: إدخال اسم الموقع
        PromptName --> SelectGovernorate: اختيار المحافظة
        SelectGovernorate --> SetLocationGPS: إرسال إحداثيات GPS
        SetLocationGPS --> ConfirmNewSite: مراجعة البيانات
        ConfirmNewSite --> SaveSite: تأكيد الإضافة
        ConfirmNewSite --> CancelAdd: إلغاء
        SaveSite --> SitesList: تم الحفظ
        CancelAdd --> SitesList: تم الإلغاء
    }
    
    SitesList --> CorporateMenu: action:settings_sub:corporate
    SitesList --> MainMenu: action:main_menu
    
    CorporateMenu --> [*]: إنهاء
    MainMenu --> [*]: إنهاء
```

---

### 🛡️ القواعد الحوكمية المعمارية المطبقة
1. **عقد الشريحة الرأسية (Gate G2):** فصل منطق الـ GPS وحسابات السياج الجغرافي داخل الخدمة.
2. **ميزانية التيليجرام (Gate G5):** الالتزام بألا يتجاوز طول الـ Callback الـ 36 بايت.
3. **حوكمة الموقع الجغرافي (Gate G22):** التحقق من دقة إحداثيات خطوط الطول والعرض المصرية.
