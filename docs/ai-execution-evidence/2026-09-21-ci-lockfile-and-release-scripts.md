# AI Execution Evidence - Package.json CI & Release Scripts Configuration

## المهمة
إضافة أوامر changesets المفقودة ("version-packages" و "release:tag") في ملف package.json لتمكين خط إطلاق الإصدارات المؤتمتة ومطابقة إجراءات GitHub Actions بنسبة 100%، وتحديث قفل الاعتماديات pnpm-lock.yaml بإدراج حزمة @alsaada/shared.

## التفويض والعبارة الحاكمة
موافق على التعديل او الايقاف او الحذف

## المسارات المرخصة
- package.json
- .changeset/config.json
- pnpm-lock.yaml
- governance.lock.json

## التغييرات المجراة
1. إضافة الأمرين "version-packages" و "release:tag" إلى package.json.
2. إضافة "@alsaada/shared" إلى حزم fixed في .changeset/config.json.
3. استئصال الترويسة المكررة من pnpm-lock.yaml وتحديث الاعتماديات بـ pnpm install --lockfile-only.
4. إعادة حساب البصمة الرقمية وتحديث governance.lock.json.
