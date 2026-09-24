# تدفق 00.4: إدارة الملف الشخصي للأدمن والمشرفين
## Flow 00.4: Administrator & Supervisor Profile Hub

> **الموديول:** `modules/settings`  
> **كود التدفق:** `00.4`  
> **الرتب المصرح لها:** `SUPER_ADMIN`, `GENERAL_ADMIN`, `FIELD_ADMIN`  
> **ميزانية التيليجرام:** 36/16/7/3  
> **حالة التدفق:** 🟢 مكتمل وموثق 100%  

---

### 🗺️ مخطط دورة حياة التدفق (State Machine Diagram)

```mermaid
stateDiagram-v2
    [*] --> Idle: تشغيل التدفق
    
    Idle --> AdminProfileView: action:settings:admin_profile
    
    state AdminProfileView {
        [*] --> RenderProfileCard
        RenderProfileCard --> EditFullName: action:edit_admin:fullName
        RenderProfileCard --> EditPhone: action:edit_admin:phone
        RenderProfileCard --> SwitchToWorker: action:switch_identity:worker
        
        state EditFullName {
            [*] --> PromptNameInput
            PromptNameInput --> SaveFullName: إدخال الاسم الجديد
            PromptNameInput --> CancelEdit: إلغاء التعديل
            SaveFullName --> [*]
            CancelEdit --> [*]
        }
        
        state EditPhone {
            [*] --> PromptPhoneInput
            PromptPhoneInput --> SavePhone: إدخال رقم الهاتف المعتمد
            PromptPhoneInput --> CancelPhone: إلغاء التعديل
            SavePhone --> [*]
            CancelPhone --> [*]
        }
    }
    
    AdminProfileView --> IdentitySubMenu: action:settings_sub:identity
    AdminProfileView --> MainMenu: action:main_menu
    
    IdentitySubMenu --> [*]: إنهاء
    MainMenu --> [*]: إنهاء
```

---

### 🛡️ القواعد الحوكمية المعمارية المطبقة
1. **عقد الشريحة الرأسية (Gate G2):** التحقق من صحة أرقام الهواتف المصرية (11 رقماً تبدأ بـ 01).
2. **ميزانية التيليجرام (Gate G5):** الالتزام بألا يتجاوز طول الـ Callback الـ 36 بايت.
3. **تبديل الهوية الآمن (Gate G7):** عزل جلسات الإشراف الميداني عن جلسات الخدمة الذاتية للعامل.
