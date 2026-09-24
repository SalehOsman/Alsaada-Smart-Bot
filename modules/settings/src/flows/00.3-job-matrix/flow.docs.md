# تدفق 00.3: مصفوفة الوظائف والأقسام الميدانية (Job Matrix)
## Flow 00.3: Department & Job Titles Matrix

> **الموديول:** `modules/settings`  
> **كود التدفق:** `00.3`  
> **الرتب المصرح لها:** `SUPER_ADMIN`, `GENERAL_ADMIN`  
> **ميزانية التيليجرام:** 36/16/7/3  
> **حالة التدفق:** 🟢 مكتمل وموثق 100%  

---

### 🗺️ مخطط دورة حياة التدفق (State Machine Diagram)

```mermaid
stateDiagram-v2
    [*] --> Idle: تشغيل التدفق
    
    Idle --> DepartmentsList: action:settings:job_matrix
    
    state DepartmentsList {
        [*] --> RenderDepts
        RenderDepts --> DepartmentDetail: action:dept:view:*
        RenderDepts --> AddDepartment: action:dept:add
        RenderDepts --> ExcelMatrixSync: action:dept:download_excel / upload_excel
    }
    
    state DepartmentDetail {
        [*] --> DeptCard
        DeptCard --> JobDetail: action:job:view:*
        DeptCard --> AddJobTitle: action:job:add:*
        DeptCard --> ToggleDeptStatus: action:dept:toggle_active:*
        DeptCard --> EditDeptMeta: تعديل الكود / المسمى
    }
    
    state JobDetail {
        [*] --> JobCard
        JobCard --> AdjustHeadcount: تعديل سقف العمالة للموقع
        JobCard --> ToggleJobStatus: تجميد / تنشيط المهنة
    }
    
    DepartmentsList --> CorporateMenu: action:settings_sub:corporate
    DepartmentsList --> MainMenu: action:main_menu
    
    CorporateMenu --> [*]: إنهاء
    MainMenu --> [*]: إنهاء
```

---

### 🛡️ القواعد الحوكمية المعمارية المطبقة
1. **عقد الشريحة الرأسية (Gate G2):** عزل مصفوفة الوظائف عن بيانات العمالة المباشرة.
2. **ميزانية التيليجرام (Gate G5):** الالتزام بألا يتجاوز طول الـ Callback الـ 36 بايت.
3. **تكامل البيانات (Gate G19):** مطابقة هيكل الأقسام مع السجلات المالية المعتمدة في F:\HR.
