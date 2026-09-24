# تدفق 00.7: خزانة التحقيق الجنائي والأعطال (Audit & Incident Vault)
## Flow 00.7: Audit Logging & Unresolved Incident Vault

> **الموديول:** `modules/settings`  
> **كود التدفق:** `00.7`  
> **الرتب المصرح لها:** `SUPER_ADMIN`, `GENERAL_ADMIN`  
> **ميزانية التيليجرام:** 36/16/7/3  
> **حالة التدفق:** 🟢 مكتمل وموثق 100%  

---

### 🗺️ مخطط دورة حياة التدفق (State Machine Diagram)

```mermaid
stateDiagram-v2
    [*] --> Idle: تشغيل التدفق
    
    Idle --> VaultHub: action:settings:audit_vault
    
    state VaultHub {
        [*] --> SelectConsole
        SelectConsole --> UserJourney: action:audit:journey_prompt
        SelectConsole --> UnresolvedErrors: action:audit:unresolved:page:*
        SelectConsole --> PurgeOldRecords: action:audit:purge_prompt
        
        state UnresolvedErrors {
            [*] --> RenderErrorsPage
            RenderErrorsPage --> ErrorDetailCard: action:audit:error_view:*
            ErrorDetailCard --> ResolveIncident: action:audit:resolve:* (اعتماد الإغلاق)
            ResolveIncident --> RenderErrorsPage: تحديث القائمة
        }
        
        state PurgeOldRecords {
            [*] --> ConfirmPurgeDialog
            ConfirmPurgeDialog --> ExecutePurge: تأكيد التطهير (> 30 يوم)
            ExecutePurge --> [*]
        }
    }
    
    VaultHub --> SystemSubMenu: action:settings_sub:system
    VaultHub --> MainMenu: action:main_menu
    
    SystemSubMenu --> [*]: إنهاء
    MainMenu --> [*]: إنهاء
```

---

### 🛡️ القواعد الحوكمية المعمارية المطبقة
1. **عقد الشريحة الرأسية (Gate G2):** ربط خزانة الأعطال مع منظومة التتبع والقياس `@alsaada/telemetry`.
2. **ميزانية التيليجرام (Gate G5):** الالتزام بميزانية الـ Callbacks والتقسيم الصفحي للأعطال.
3. **التوثيق الجنائي (Gate G9):** تتبع مرجع العطل `#ERR-XXXXXXXX` وربطه بالخطأ الأصلي ومستويات الخطورة.
