# تدفق 01.2.D: تعديل وتحديث بيانات العامل وتذاكر الاعتماد
## Flow 01.2.D: Worker Profile Editing & Field Admin Change Approval Hub

> **الموديول:** `modules/workforce`  
> **كود التدفق:** `01.2.D`  
> **الرتب المصرح لها:** `SUPER_ADMIN`, `GENERAL_ADMIN`, `FIELD_ADMIN`  
> **ميزانية التيليجرام:** 36/16/7/3  
> **حالة التدفق:** 🟢 مكتمل وموثق 100%  

---

### 🗺️ مخطط دورة حياة التدفق (State Machine Diagram)

```mermaid
stateDiagram-v2
    [*] --> Idle: تشغيل التدفق
    
    Idle --> WorkerProfileTabs: w:v:* (استعراض بطاقة العامل)
    
    state WorkerProfileTabs {
        [*] --> PersonalTab: w:tab:*:pers
        PersonalTab --> JobTab: w:tab:*:job
        JobTab --> FinancialTab: w:tab:*:fin
        FinancialTab --> DocumentsTab: w:tab:*:docs
        DocumentsTab --> PersonalTab
        
        state EditFieldAction {
            [*] --> SelectFieldToEdit
            SelectFieldToEdit --> EnterNewValue: طلب القيمة الجديدة
            EnterNewValue --> ValidateValue: فحص صحة المدخلات
            ValidateValue --> EnterNewValue: خطأ بالقيمة (إعادة المحاولة)
            ValidateValue --> ReviewEditCard: صحة القيمة وعرض التأكيد
        }
    }
    
    ReviewEditCard --> DirectAdminSave: حفظ فوري (SuperAdmin / GeneralAdmin)
    ReviewEditCard --> SubmitApprovalTicket: إرسال تذكرة اعتماد (FieldAdmin)
    ReviewEditCard --> CancelEdit: إلغاء التعديل والعودة
    
    DirectAdminSave --> ProfileUpdatedCard: تحديث قاعدة البيانات
    SubmitApprovalTicket --> TicketPendingCard: إشعار الإدارة بالتذكرة
    
    ProfileUpdatedCard --> WorkerProfileTabs: العودة للملف
    TicketPendingCard --> WorkerProfileTabs: العودة للملف
    CancelEdit --> WorkerProfileTabs: العودة للملف
    
    WorkerProfileTabs --> [*]: إنهاء الجلسة
```

---

### 🛡️ القواعد الحوكمية المعمارية المطبقة
1. **عقد الشريحة الرأسية (Gate G2):** تقسيم بطاقة العامل إلى أربعة تبويبات منظمة (36/16/7/3).
2. **حوكمة الأجور (Gate G8):** حجب تفاصيل الراتب والبدلات عبر `formatSpoiler` في تبويب الماليات.
3. **تذاكر الموافقة للمشرفين (Gate G7):** تحويل تعديل الحقول المالية للمشرف الميداني إلى تذاكر معلقة تنتظر اعتماد الإدارة العامة.
