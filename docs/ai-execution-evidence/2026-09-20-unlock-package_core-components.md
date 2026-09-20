# ترخيص فك قفل الحوكمة: (package:core-components)

- **التاريخ:** 2026-09-20 (2026-09-20T02:23:35.318Z)
- **معرف الكيان المفكوك:** `package:core-components`
- **عبارة الاعتماد الصريحة المعتمدة:** **موافق على الفتح**
- **مبدأ العزل:** 🔒 **Zero Blast Radius** (سائر الكيانات الأخرى في المنظومة لا تزال مقفلة ومحصنة تشفيرياً 100%).

## المبرر وأسباب التعديل (Justification & Reason)
Plan 86 remediation: PositiveFiniteAmount branded types and NaN/Infinity rejection

## نطاق التعديل المرخص
تم رفع القفل التشفيري عن الكيان `package:core-components` حصراً لإجراء التعديلات المطلوبة.
يُحظر تماماً تعديل أي ملف خارج نطاق هذا الكيان، وأي مساس بملف آخر سيسقط فوراً عند الـ Git Commit.
فور الانتهاء من العمل واجتياز الاختبارات، يلزم إعادة ختم الكيان عبر:
`pnpm lock package:core-components`
