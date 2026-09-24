# تدفق 00.11: إدارة وربط مجموعات وتوبيكات تيليجرام (Telegram Groups & Topics)
## Flow 00.11: Telegram Groups Binding & Topic Provisioning Hub

> **الموديول:** `modules/settings`  
> **كود التدفق:** `00.11`  
> **الرتب المصرح لها:** `SUPER_ADMIN`, `GENERAL_ADMIN`  
> **ميزانية التيليجرام:** 36/16/7/3  
> **حالة التدفق:** 🟢 مكتمل وموثق 100%  

---

### 🗺️ مخطط دورة حياة التدفق (State Machine Diagram)

```mermaid
stateDiagram-v2
    [*] --> Idle: تشغيل التدفق
    
    Idle --> GroupsHub: action:settings:telegram_groups
    
    state GroupsHub {
        [*] --> SelectGroupType
        SelectGroupType --> HqGroupManager: grp:hq (جروب الإدارة العليا)
        SelectGroupType --> SitesGroupsMatrix: grp:s:list (جروبات المواقع الميدانية)
        
        state HqGroupManager {
            [*] --> HqStatusCard
            HqStatusCard --> EditHqId: grp:hq:edit (إدخال/تعديل المعرف)
            HqStatusCard --> InitHqTopics: grp:hq:init (توليد التوبيكات الأربعة)
            HqStatusCard --> TestHqConnection: grp:hq:test (فحص الصلاحيات)
            HqStatusCard --> UnbindHqGroup: grp:hq:del (إلغاء الربط)
            EditHqId --> HqStatusCard: تم الحفظ
            InitHqTopics --> HqStatusCard: اكتمال التوليد
            TestHqConnection --> HqStatusCard: نتيجة الفحص
            UnbindHqGroup --> HqStatusCard: تم الفك
        }
        
        state SitesGroupsMatrix {
            [*] --> RenderSitesList
            RenderSitesList --> SiteGroupDetail: grp:s:v:* (اختيار موقع)
            SiteGroupDetail --> BindSiteGroup: ربط وتعيين المعرف
            SiteGroupDetail --> InitSiteTopics: توليد توبيكات الموقع
            SiteGroupDetail --> TestSiteConnection: فحص صلاحيات المشرف
            SiteGroupDetail --> UnbindSiteGroup: إلغاء الربط
        }
    }
    
    GroupsHub --> CorporateMenu: action:settings_sub:corporate
    GroupsHub --> MainMenu: action:main_menu
    
    CorporateMenu --> [*]: إنهاء
    MainMenu --> [*]: إنهاء
```

---

### 🛡️ القواعد الحوكمية المعمارية المطبقة
1. **عقد الشريحة الرأسية (Gate G2):** عزل واجهات Telegram API الخاصة بالمجموعات والتوبيكات.
2. **ميزانية التيليجرام (Gate G5):** الالتزام بألا يتجاوز طول الـ Callback الـ 36 بايت وتضمين روابط إضافة البوت الرسمية.
3. **حوكمة التوبيكات (Rulebook 07):** توليد التوبيكات الرسمية الأربعة المعتمدة حصراً.
