# تدفق 00.6: وضع المحاكاة وانتحال الأدوار (Ghost Mode)
## Flow 00.6: Super Admin Impersonation & Ghost Mode Hub

> **الموديول:** `modules/settings`  
> **كود التدفق:** `00.6`  
> **الرتب المصرح لها:** `SUPER_ADMIN` حصراً  
> **ميزانية التيليجرام:** 36/16/7/3  
> **حالة التدفق:** 🟢 مكتمل وموثق 100%  

---

### 🗺️ مخطط دورة حياة التدفق (State Machine Diagram)

```mermaid
stateDiagram-v2
    [*] --> Idle: تشغيل التدفق
    
    Idle --> GhostMenu: action:ghost_mode:menu
    
    state GhostMenu {
        [*] --> SelectRole
        SelectRole --> ImpersonateAdmin: action:impersonate:GENERAL_ADMIN / FIELD_ADMIN
        SelectRole --> PickWorker: action:impersonate:pick_worker
        SelectRole --> PickSupplier: action:impersonate:pick_supplier
        SelectRole --> ImpersonateGuest: action:impersonate:GUEST
        
        state PickWorker {
            [*] --> RenderWorkersGrid
            RenderWorkersGrid --> ActivateWorkerGhost: action:impersonate:worker:*
        }
        
        state PickSupplier {
            [*] --> RenderSuppliersGrid
            RenderSuppliersGrid --> ActivateSupplierGhost: action:impersonate:supplier:*
        }
    }
    
    ImpersonateAdmin --> ActiveGhostSession: تفعيل جلسة المحاكاة
    ActivateWorkerGhost --> ActiveGhostSession: تفعيل جلسة المحاكاة
    ActivateSupplierGhost --> ActiveGhostSession: تفعيل جلسة المحاكاة
    ImpersonateGuest --> ActiveGhostSession: تفعيل جلسة المحاكاة
    
    ActiveGhostSession --> ExitGhost: action:exit_impersonate
    ExitGhost --> GhostMenu: العودة كمدير عام
    
    GhostMenu --> SettingsMenu: menu:super_admin_settings
    GhostMenu --> MainMenu: action:main_menu
    
    SettingsMenu --> [*]: إنهاء
    MainMenu --> [*]: إنهاء
```

---

### 🛡️ القواعد الحوكمية المعمارية المطبقة
1. **عقد الشريحة الرأسية (Gate G2):** عزل جلسة المحاكاة داخل الـ Session Store وعدم المساس ببيانات المستخدم الأصلية.
2. **ميزانية التيليجرام (Gate G5):** الالتزام بميزانية الـ Callbacks والأزرار المقتضبة (36/16/7/3).
3. **الحصانة الأمنية (Gate G7):** الحظر القطعي لغير السوبر أدمن من استدعاء وضع المحاكاة.
