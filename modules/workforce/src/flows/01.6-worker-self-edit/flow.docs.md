# تدفق 01.6: طلب تعديل وتحديث بيانات العامل ذاتياً (Worker Self-Edit)

## الوصف المعماري
يتيح هذا التدفق للعامل المسجل والمفعل في المنظومة تحديث بياناته الشخصية والتواصلية ذاتياً عبر بوت التيليجرام، مع التطبيق الصارم لميثاق النزاهة والحظر المالي (`Zero Financial Mutation`).

## الحقول المسموح بتعديلها
- `phone`: رقم الهاتف الشخصي
- `emergencyContactName`: اسم جهة الاتصال للطوارئ
- `emergencyPhone`: رقم هاتف الطوارئ
- `address`: محل الإقامة
- `walletType`: نوع المحفظة الإلكترونية
- `accountNumber`: رقم المحفظة / الحساب
- `walletOwnerName`: اسم صاحب المحفظة
- `instaPayHandle`: معرف إنستاباي
- `maritalStatus`: الحالة الاجتماعية
- `ppeShoeSize`: مقاس الحذاء الميداني
- `ppeUniformSize`: مقاس الزي الميداني

## الحقول المالية المحظورة قطيعاً
- `dailyWage` (الأجر اليومي)
- `basicSalary` (الراتب الأساسي)
- `fixedAllowances` (البدلات)
- `jobTitle` (المسمى الوظيفي)
- `siteId` (موقع العمل الميداني)
- `shiftSystem` (نظام الدوام)
- `insuranceNumber` (الرقم التأميني)

## الأمان والتدقيق الجنائي
- تسجيل كل تعديل في جدول `AuditLog` موثقاً بالمعرف الرقمي وقيمتي ما قبل وبعد التعديل.
- إطلاق حدث في طابور `OutboxEvent` للمزامنة الخلفية مع سجلات العمالة.

## مخطط حالات التدفق (State Machine Diagram)

```mermaid
stateDiagram-v2
    [*] --> Idle: تشغيل البوت / القائمة الذاتية
    Idle --> SelectingField: wizard worker_self_edit start
    SelectingField --> EnteringValue: اختيار حقل مسموح (هاتف، طوارئ، محفظة)
    EnteringValue --> ReviewSummary: إدخال القيمة والتحقق من صحتها
    ReviewSummary --> SelectingField: زر العودة / تغيير حقل
    ReviewSummary --> Cancelled: زر الإلغاء
    ReviewSummary --> PersistingUpdate: زر التأكيد والحفظ
    PersistingUpdate --> Completed: نجاح التحديث وتسجيل التدقيق الجنائي
    PersistingUpdate --> ErrorState: فشل الحفظ أو قيد مالي محظور
    Completed --> [*]: إرسال بطاقة الإشعار والإنهاء
    Cancelled --> [*]: إلغاء العملية والعودة للملف
    ErrorState --> [*]: عرض رسالة الخطأ والإنهاء
```
