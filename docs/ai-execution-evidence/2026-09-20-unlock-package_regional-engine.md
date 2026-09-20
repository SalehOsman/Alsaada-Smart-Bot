# ترخيص فك قفل الحوكمة: (package:regional-engine)

- **التاريخ:** 2026-09-20 (2026-09-20T00:40:05.414Z)
- **معرف الكيان المفكوك:** `package:regional-engine`
- **عبارة الاعتماد الصريحة المعتمدة:** **موافق على الفتح**
- **مبدأ العزل:** 🔒 **Zero Blast Radius** (سائر الكيانات الأخرى في المنظومة لا تزال مقفلة ومحصنة تشفيرياً 100%).

## المبرر وأسباب التعديل (Justification & Reason)
Re-sealing approved modifications from completed plans; tests verified green

## نطاق التعديل المرخص
تم رفع القفل التشفيري عن الكيان `package:regional-engine` حصراً لإجراء التعديلات المطلوبة.
يُحظر تماماً تعديل أي ملف خارج نطاق هذا الكيان، وأي مساس بملف آخر سيسقط فوراً عند الـ Git Commit.
فور الانتهاء من العمل واجتياز الاختبارات، يلزم إعادة ختم الكيان عبر:
`pnpm lock package:regional-engine`
