---
title: "خريطة المعمارية الحية للمنظومة"
description: "المخطط التفاعلي الحي للاعتماديات وحزم المونوريبو المستخرج آلياً من Turborepo"
sidebar:
  order: 0
---

توضح هذه الصفحة **خريطة المعمارية الحية (Living Architecture Map)** لمنظومة السعادة سمارت بوت، المستخرجة آلياً من اعتماديات حزم وموديولات الـ Monorepo.

:::tip[ميزة التكبير والتحريك (Interactive Pan & Zoom)]
يمكنك استخدام عجلة الفأرة أو أزرار التحكم في الشريط العلوي لتكبير وتصغير المخطط، والسحب بالفأرة للتحرك داخل أي جزء من الخريطة.
:::

```mermaid
flowchart TD
  subgraph Apps["🚀 طبقة التطبيقات والواجهات (Apps Layer)"]
    ADMIN_DASHBOARD["@alsaada/admin-dashboard\n(apps/admin-dashboard)"]
    BOT_SERVER["@alsaada/bot-server\n(apps/bot-server)"]
    DOCS["@alsaada/docs\n(apps/docs)"]
  end

  subgraph Modules["🧩 طبقة موديولات الأعمال (Business Modules)"]
    SETTINGS["@alsaada/settings\n(modules/settings)"]
    WORKFORCE["@alsaada/workforce\n(modules/workforce)"]
  end

  subgraph CoreEngines["⚙️ طبقة محركات النواة المشتركة (Core Packages)"]
    AI_VISION_ENGINE["@alsaada/ai-vision-engine\n(packages/ai-vision-engine)"]
    CORE_COMPONENTS["@alsaada/core-components\n(packages/core-components)"]
    NATIONAL_ID_ENGINE["@alsaada/national-id-engine\n(packages/national-id-engine)"]
    RBAC["@alsaada/rbac\n(packages/rbac)"]
    REGIONAL_ENGINE["@alsaada/regional-engine\n(packages/regional-engine)"]
    SHARED["@alsaada/shared\n(packages/shared)"]
    TELEMETRY["@alsaada/telemetry\n(packages/telemetry)"]
  end

  subgraph DataLayer["💾 طبقة البيانات والتخزين المزدوج (Data & Storage)"]
    DATABASE["@alsaada/database\n(Prisma 7 + Postgres + Soft-Delete)"]
    LEDGER["سجل العمليات المشفر\n(Tamper-Proof Ledger)"]
    SHEETS["جداول جوجل السحابية\n(Google Sheets Live Mirror)"]
  end

  %% Dynamic Relationships from Workspace Dependencies
  ADMIN_DASHBOARD --> CORE_COMPONENTS
  ADMIN_DASHBOARD --> DATABASE
  ADMIN_DASHBOARD --> NATIONAL_ID_ENGINE
  ADMIN_DASHBOARD --> RBAC
  ADMIN_DASHBOARD --> REGIONAL_ENGINE
  ADMIN_DASHBOARD --> SETTINGS
  ADMIN_DASHBOARD --> TELEMETRY
  ADMIN_DASHBOARD --> WORKFORCE
  BOT_SERVER --> AI_VISION_ENGINE
  BOT_SERVER --> CORE_COMPONENTS
  BOT_SERVER --> DATABASE
  BOT_SERVER --> NATIONAL_ID_ENGINE
  BOT_SERVER --> RBAC
  BOT_SERVER --> REGIONAL_ENGINE
  BOT_SERVER --> SETTINGS
  BOT_SERVER --> TELEMETRY
  BOT_SERVER --> WORKFORCE
  SETTINGS --> CORE_COMPONENTS
  SETTINGS --> DATABASE
  SETTINGS --> RBAC
  SETTINGS --> REGIONAL_ENGINE
  WORKFORCE --> AI_VISION_ENGINE
  WORKFORCE --> CORE_COMPONENTS
  WORKFORCE --> DATABASE
  WORKFORCE --> NATIONAL_ID_ENGINE
  WORKFORCE --> REGIONAL_ENGINE
  AI_VISION_ENGINE --> NATIONAL_ID_ENGINE
  AI_VISION_ENGINE --> REGIONAL_ENGINE
  CORE_COMPONENTS --> DATABASE
  CORE_COMPONENTS --> NATIONAL_ID_ENGINE
  CORE_COMPONENTS --> REGIONAL_ENGINE
  NATIONAL_ID_ENGINE --> REGIONAL_ENGINE
  DATABASE --> LEDGER
  DATABASE --> SHEETS

  classDef appNode fill:#0284c7,stroke:#0369a1,stroke-width:2px,color:#fff;
  classDef modNode fill:#7c3aed,stroke:#6d28d9,stroke-width:2px,color:#fff;
  classDef coreNode fill:#059669,stroke:#047857,stroke-width:2px,color:#fff;
  classDef dataNode fill:#d97706,stroke:#b45309,stroke-width:2px,color:#fff;

  class ADMIN_DASHBOARD,BOT_SERVER,DOCS appNode;
  class SETTINGS,WORKFORCE modNode;
  class AI_VISION_ENGINE,CORE_COMPONENTS,NATIONAL_ID_ENGINE,RBAC,REGIONAL_ENGINE,SHARED,TELEMETRY coreNode;
  class DATABASE,LEDGER,SHEETS dataNode;
```

---

## 📦 جرد حزم وموديولات المنظومة (13 حزم وموديولات معتمدة)

| اسم الحزمة / الموديول | المسار البرمجي | الدور المعماري الرئيسي |
| :--- | :--- | :--- |
| **`@alsaada/admin-dashboard`** | `apps/admin-dashboard` | apps/admin-dashboard |
| **`@alsaada/bot-server`** | `apps/bot-server` | apps/bot-server |
| **`@alsaada/docs`** | `apps/docs` | apps/docs |
| **`@alsaada/settings`** | `modules/settings` | modules/settings |
| **`@alsaada/workforce`** | `modules/workforce` | modules/workforce |
| **`@alsaada/ai-vision-engine`** | `packages/ai-vision-engine` | packages/ai-vision-engine |
| **`@alsaada/core-components`** | `packages/core-components` | packages/core-components |
| **`@alsaada/database`** | `packages/database` | packages/database |
| **`@alsaada/national-id-engine`** | `packages/national-id-engine` | packages/national-id-engine |
| **`@alsaada/rbac`** | `packages/rbac` | packages/rbac |
| **`@alsaada/regional-engine`** | `packages/regional-engine` | packages/regional-engine |
| **`@alsaada/shared`** | `packages/shared` | packages/shared |
| **`@alsaada/telemetry`** | `packages/telemetry` | packages/telemetry |

