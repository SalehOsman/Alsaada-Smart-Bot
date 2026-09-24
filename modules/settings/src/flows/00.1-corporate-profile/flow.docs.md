# تدفق 00.1: الملف التعريفي وبيانات المؤسسة
## Flow 00.1: Corporate Profile & Enterprise Settings

> **الموديول:** `modules/settings`  
> **كود التدفق:** `00.1`  
> **الرتب المصرح لها:** `SUPER_ADMIN`, `GENERAL_ADMIN`  
> **ميزانية التيليجرام:** 36/16/7/3  
> **حالة التدفق:** 🟢 مكتمل وموثق 100%  

---

### 🗺️ مخطط دورة حياة التدفق (State Machine Diagram)

```mermaid
stateDiagram-v2
    [*] --> Idle: بدء تشغيل التدفق
    
    Idle --> ViewProfile: action:settings:company_profile
    
    state ViewProfile {
        [*] --> RenderProfileCard
        RenderProfileCard --> PromptFieldEdit: اختيار تعديل حقل
        PromptFieldEdit --> AwaitingNewValue: طلب القيمة الجديدة
        AwaitingNewValue --> ConfirmEdit: استقبال القيمة وتأكيد التعديل
        ConfirmEdit --> SaveProfile: action:edit_comp:* (تأكيد)
        ConfirmEdit --> RenderProfileCard: action:settings:company_profile (إلغاء)
        SaveProfile --> RenderProfileCard: تحديث وحفظ البيانات
    }
    
    ViewProfile --> SettingsMenu: menu:super_admin_settings
    ViewProfile --> MainMenu: action:main_menu
    
    SettingsMenu --> [*]: العودة لقائمة الإعدادات
    MainMenu --> [*]: العودة للقائمة الرئيسية
```

---

### 🛡️ القواعد الحوكمية المعمارية المطبقة
1. **عقد الشريحة الرأسية (Gate G2):** الالتزام بمعمارية الـ 10 ملفات مع فصل طبقة العرض والخدمة.
2. **ميزانية التيليجرام (Gate G5):** الالتزام بألا يتجاوز طول الـ Callback الـ 36 بايت.
3. **حماية التعديل (Gate G7):** قصر صلاحية تعديل بيانات الشركة على السوبر أدمن والمدير العام.
