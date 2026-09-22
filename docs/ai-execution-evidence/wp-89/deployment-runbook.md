# دليل التشغيل والنشر المعماري للموديولات (Work Plan 89 — Phase P7)

## 1. فلسفة النشر والنواة الثابتة
في إطار **خطة العمل 89**، تم فك الارتباط الكامل بين بناء النواة وإضافة الموديولات التشغيلية (`Zero Blast Radius`). تتبع المنظومة المعمارية المبادئ الحاكمة التالية:
1. **الاكتشاف التلقائي الكامل (Zero Hardcoded Modules):** يتم بناء ونشر الموديولات ديناميكياً عبر استكشاف شجرة الدليل `modules/*` والاعتماد على العقود الرسمية `module.contract.json`.
2. **عزل مراحل البناء عن النشر (Decoupled Build & Deploy):** ينتج أمر البناء بياناً مشفراً بصيغة JSON (`.generated/release/manifest.json`) يوثق بصمة النواة (`coreHash`) وبصمة الكتالوج (`catalogHash`) والـ Checksum الشامل.
3. **حظر نشر مسودات الموديولات في الإنتاج (Strict Production Gate):** يمنع المحرك نهائياً (`Exit 1`) نشر أي موديول يحمل حالة `status: 'draft'` في بيئة الإنتاج (`production`).

---

## 2. أوامر التشغيل المعتمدة (Predefined CLI Scripts)

```bash
# 1. بناء بيان الإصدار والتحقق من التبعيات
pnpm modules:build

# 2. بناء بيان الإصدار لبيئة الإنتاج (يفحص جاهزية العقود ويمنع المسودات)
pnpm modules:build --production

# 3. التحقق الجنائي من سلامة بيان الإصدار وعدم التلاعب
pnpm modules:release:verify

# 4. محاكاة نشر الإصدار (Dry Run)
pnpm modules:deploy --dry-run

# 5. تنفيذ النشر الفعلي وتسجيل سجل التدقيق
pnpm modules:deploy
```

---

## 3. هيكل بيان الإصدار (`.generated/release/manifest.json`)

```json
{
  "schemaVersion": "2.0.0",
  "generatedAt": "2026-09-22T10:00:00.000Z",
  "gitCommitSha": "d4fab07...",
  "environment": "production",
  "coreHash": "a1b2c3d4...",
  "catalogHash": "e5f6a7b8...",
  "totalModules": 3,
  "totalFlows": 15,
  "modules": [
    {
      "id": "workforce",
      "version": "2.0.0",
      "status": "ready",
      "titleArabic": "إدارة القوى العاملة الميدانية",
      "moduleHash": "c9d8e7...",
      "flowsCount": 9,
      "isV1Compatible": true,
      "requiredCapabilities": ["storage:attachment", "ledger:double-entry"]
    }
  ],
  "checksum": "f0e1d2c3b4a5..."
}
```

---

## 4. خطة الاسترجاع والتعافي عند الفشل (Rollback Procedure)
في حالة حدوث أي تعثر أثناء النشر:
1. يحتفظ المحرك بسجل تاريخي لكافة عمليات النشر في `.generated/release/deploy.log`.
2. يمكن إعادة توجيه مسار البوت نحو بيان الإصدار السابق المعتمد دون الحاجة لإعادة ترجمة كود النواة أو إعادة بناء الحاويات بالكامل.
3. يتم التحقق من صحة الربط عبر: `pnpm test:modules:release`.
