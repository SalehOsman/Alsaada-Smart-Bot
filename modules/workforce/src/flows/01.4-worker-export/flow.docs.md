# تدفق 01.4: تصدير واستيراد كشوف العمالة (Excel Import & Export)
## Flow 01.4: Worker Excel Roster Export & Bulk Import Hub

> **الموديول:** `modules/workforce`  
> **كود التدفق:** `01.4`  
> **الرتب المصرح لها:** `SUPER_ADMIN`, `GENERAL_ADMIN`  
> **ميزانية التيليجرام:** 36/16/7/3  
> **حالة التدفق:** 🟢 مكتمل وموثق 100%  

---

### 🗺️ مخطط دورة حياة التدفق (State Machine Diagram)

```mermaid
stateDiagram-v2
    [*] --> Idle: تشغيل التدفق
    
    Idle --> ExportMenu: action:worker_export:start
    
    state ExportMenu {
        [*] --> SelectExportFilter
        SelectExportFilter --> ExportAllRoster: action:worker_export:do:all
        SelectExportFilter --> FilterByDepartment: action:worker_export:dept_menu
        SelectExportFilter --> FilterByJobTitle: action:worker_export:job_menu:*
        SelectExportFilter --> FilterByGovernorate: action:worker_export:gov_menu
        
        state FilterByDepartment {
            [*] --> PickDept
            PickDept --> GenerateDeptExcel: action:worker_export:do:d:*
        }
        
        state FilterByJobTitle {
            [*] --> PickJob
            PickJob --> GenerateJobExcel: action:worker_export:do:j:*
        }
        
        state FilterByGovernorate {
            [*] --> PickGov
            PickGov --> GenerateGovExcel: action:worker_export:do:g:*
        }
    }
    
    ExportAllRoster --> BuildExcelBuffer: جلب سجلات العمالة
    GenerateDeptExcel --> BuildExcelBuffer: تصفية القسم
    GenerateJobExcel --> BuildExcelBuffer: تصفية المهنة
    GenerateGovExcel --> BuildExcelBuffer: تصفية المحافظة
    
    BuildExcelBuffer --> SendDocumentAttachment: إنشاء وتنسيق ملف XLSX
    SendDocumentAttachment --> [*]: تسليم الكشف والإنهاء
```

---

### 🛡️ القواعد الحوكمية المعمارية المطبقة
1. **عقد الشريحة الرأسية (Gate G2):** توليد ملفات Excel في الذاكرة دون تلويث القرص بملفات مؤقتة.
2. **ميزانية التيليجرام (Gate G5):** إرسال الكشف كمستند (`sendDocument`) مع كابشن لا يتجاوز 1024 حرفاً.
3. **أمان البيانات (Gate G8):** قصر التصدير الشامل للرواتب على الحسابات الإدارية المعتمدة.
