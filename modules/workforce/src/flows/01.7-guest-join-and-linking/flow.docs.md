# تدفق 01.7: محرك طلبات انضمام الزوار والربط المشفر عبر الواتساب (Guest Join & WhatsApp Linking)

## الوصف والهدف المعماري
محرك مصادقة خارج النطاق (`Out-of-Band Cryptographic Authentication Engine`) لحماية حسابات العمال من الاختطاف أو الانتحال عند تقديم طلبات الانضمام من الزوار.

## المعايير والضوابط المعتمدة
1. **صلاحية الرمز الرقمي المشفر (TTL):**
   - صلاحية الرابط هي **24 ساعة كاملة (86,400 ثانية)**.
2. **الربط التشفيري الصارم بمعرف التليجرام:**
   - التوكن موقع بختم HMAC-SHA256 ومربوط بمعرف مقدم الطلب (`applicantTelegramId`).
   - عند فتح الرابط في البوت يتم فحص `ctx.from.id === tokenPayload.applicantTelegramId`. أي عدم تطابق يؤدي إلى رفض العملية فورياً.
3. **الإرسال الحصري لواتساب الرقم المسجل:**
   - يوجه النظام الإدارة لإرسال الرابط المشفر حصراً إلى رقم الهاتف المعتمد في ملف العامل بالشركة.
4. **استهلاك لمرة واحدة (Single-Use):**
   - يُبطل الرمز تلقائياً فور استهلاكه بنجاح لتفعيل الحساب.

## أثر البيانات
- تفعيل الحساب: `User.role = 'WORKER'`, `User.workerId = worker.id`.
- ربط العامل: `Worker.telegramId = applicantTelegramId`.
- تفريغ الكاش وتحديث الأوامر الجانبية فورياً.

## مخطط حالات التدفق (State Machine Diagram)

```mermaid
stateDiagram-v2
    [*] --> AwaitingApplication: زائر غير مسجل يفتح البوت
    AwaitingApplication --> CollectingGuestInfo: wizard guest_join start
    CollectingGuestInfo --> SubmittingApplication: إدخال البيانات الشخصية ورقم الهاتف
    SubmittingApplication --> PendingAdminReview: حفظ الطلب وإشعار الإدارة
    PendingAdminReview --> IssuingEncryptedToken: موافقة الإدارة وتوليد رمز HMAC (24h)
    PendingAdminReview --> Rejected: رفض الطلب من قبل الإدارة
    IssuingEncryptedToken --> OutOfBandDelivery: إرسال الرابط المشفر لواتساب العامل
    OutOfBandDelivery --> VerifyingIdentity: فتح الرابط بالبوت وفحص تطابق المعرف
    VerifyingIdentity --> AccountLinked: تطابق التوكن ومعرف التيليجرام
    VerifyingIdentity --> ValidationFailed: انتهاء صلاحية التوكن أو عدم تطابق المعرف
    AccountLinked --> [*]: ترقية الدور إلى WORKER واستهلاك التوكن
    Rejected --> [*]: إشعار الزائر بالرفض
    ValidationFailed --> [*]: حظر العملية وتسجيل تنبيه أمني
```
