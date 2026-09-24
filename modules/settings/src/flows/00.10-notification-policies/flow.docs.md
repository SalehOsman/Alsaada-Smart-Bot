# تدفق 00.10: سياسات وقنوات الإشعارات والتنبيهات الميدانية (Notification Policies)
## Flow 00.10: Field & HQ Notification Routing & Policies Hub

> **الموديول:** `modules/settings`  
> **كود التدفق:** `00.10`  
> **الرتب المصرح لها:** `SUPER_ADMIN`, `GENERAL_ADMIN`  
> **ميزانية التيليجرام:** 36/16/7/3  
> **حالة التدفق:** 🟢 مكتمل وموثق 100%  

---

### 🗺️ مخطط دورة حياة التدفق (State Machine Diagram)

```mermaid
stateDiagram-v2
    [*] --> Idle: تشغيل التدفق
    
    Idle --> PoliciesHub: action:settings:notification_policies
    
    state PoliciesHub {
        [*] --> SelectScope
        SelectScope --> SitePoliciesScope: pol:site (جروبات المواقع)
        SelectScope --> HqPoliciesScope: pol:hq (جروب الإدارة العليا)
        
        state SitePoliciesScope {
            [*] --> RenderSiteDepts
            RenderSiteDepts --> DepartmentFeatureDetail: pol:c:site:* (اختيار قسم)
            RenderSiteDepts --> ResetSiteScope: pol:res:site (استعادة الافتراضي)
        }
        
        state HqPoliciesScope {
            [*] --> RenderHqDepts
            RenderHqDepts --> DepartmentFeatureDetail: pol:c:hq:* (اختيار قسم)
            RenderHqDepts --> ResetHqScope: pol:res:hq (استعادة الافتراضي)
        }
        
        state DepartmentFeatureDetail {
            [*] --> RenderFeaturesList
            RenderFeaturesList --> ToggleFeature: pol:t:*:* (تفعيل / تعطيل الإشعار)
            RenderFeaturesList --> ToggleSound: pol:s:*:* (كتم / تنبيه صوتي)
            ToggleFeature --> RenderFeaturesList: تحديث الحالة
            ToggleSound --> RenderFeaturesList: تحديث النمط الصوتي
        }
    }
    
    PoliciesHub --> SystemSubMenu: action:settings_sub:system
    PoliciesHub --> MainMenu: action:main_menu
    
    SystemSubMenu --> [*]: إنهاء
    MainMenu --> [*]: إنهاء
```

---

### 🛡️ القواعد الحوكمية المعمارية المطبقة
1. **عقد الشريحة الرأسية (Gate G2):** فصل سياسات التوجيه عن منطق إرسال رسائل البوت.
2. **ميزانية التيليجرام (Gate G5):** الالتزام بألا يتجاوز طول الـ Callback الـ 36 بايت.
3. **حوكمة الإشعارات (Gate G8):** التحقق من كتم الأصوات للإشعارات الليلية غير الحرجة.
