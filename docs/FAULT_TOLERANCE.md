# EduPay — بنية تحمّل الأخطاء (Enterprise Fault Tolerance)

هذا المستند يشرح ما بُني فعلياً، وما يُفعّل خارجياً، وكيف يعمل النظام كاملاً.

---

## ملخّص صادق: ما بُني وما يُفعّل

| المتطلّب | الحالة |
|---|---|
| إعادة المحاولة التلقائية للإشعارات | ✅ مبني (backoff أسّي في قاعدة البيانات) |
| طابور موحّد (Email/SMS/WhatsApp/Push) | ✅ مبني (الجدول + العامل + المزوّدون) |
| الحذف الناعم للسجلّات الحرجة | ✅ مبني (`deleted_at` + دوال) |
| حالات الدفع الآمنة (5 حالات) | ✅ مبني (آلة حالات + سجلّ انتقالات) |
| التعامل الرشيق مع الأخطاء | ✅ مبني (غلاف API + سجلّ أخطاء) |
| سجلّ الأخطاء والمراقبة | ✅ مبني (جدول + دالة صحّة النظام) |
| النسخ الاحتياطي اليومي | ⚙️ **يُفعّل في Supabase** (مدمج) + جدول تتبّع |
| ربط مزوّدي الإشعارات الفعليين | ⚙️ **يتطلّب مفاتيح API** (Twilio/Resend/WhatsApp) |

**الصدق المعماري:** المزوّدون غير المُهيّأين يُرجعون "غير مُهيّأ" بوضوح بدل التظاهر بالنجاح — فلا رسائل وهمية ولا فقدان صامت.

---

## 1. مخطّط قاعدة البيانات

الملف: `supabase/migrations/21_fault_tolerance.sql`

**الجداول الجديدة:**
- `notification_queue` — طابور موحّد لكل القنوات، مع `attempts`, `max_attempts`, `next_retry_at`, `dedupe_key`.
- `payment_state_log` — سجلّ كل انتقال حالة دفع (للتدقيق).
- `error_log` — أخطاء النظام بمستويات (info/warning/error/critical).
- `backup_log` — تتبّع النسخ الاحتياطي.

**التعديلات:**
- `pending_payments` + `txn_state` (5 حالات) + `idempotency_key` (منع الدفع المزدوج).
- ستّة جداول حرجة + `deleted_at` (حذف ناعم) مع فهارس جزئية للأداء.

**الدوال الأساسية:**
- `transition_payment_state()` — آلة حالات تمنع الانتقالات غير المنطقية.
- `enqueue_notification()` / `claim_queue_batch()` / `mark_queue_result()` — دورة الطابور.
- `soft_delete()` / `restore_record()` — الحذف والاسترجاع مع تدقيق.
- `system_health()` — ملخّص صحّة فوري لمدير المنصّة.

---

## 2. بنية الـAPI

```
app/api/cron/
  process-queue/route.ts   ← عامل الطابور (كل دقيقة)
  fee-reminders/route.ts   ← تذكيرات الرسوم (يومياً 6 صباحاً)

lib/
  supabase-service.ts      ← عميل service role (يتجاوز RLS، للخادم فقط)
  api-handler.ts           ← غلاف التعامل الرشيق مع الأخطاء
  notifications/
    providers.ts           ← تجريد المزوّدين (email/sms/whatsapp/push)
```

**مبادئ الأمان:**
- مهام الـcron محميّة بترويسة `CRON_SECRET` — لا تُشغّل من الخارج.
- `service_role` لا يُرسل للمتصفّح أبداً — في مسارات الخادم فقط.
- غلاف الأخطاء يُرجع `requestId` للعميل دون تسريب التفاصيل الداخلية.

---

## 3. دورة عمل الطابور (Queue Workflow)

```
حدث (دفعة/تذكير) → enqueue_notification() → notification_queue [queued]
                                                      ↓
        Vercel Cron كل دقيقة → process-queue → claim_queue_batch()
                                                      ↓ [processing]
                                          deliver() حسب القناة
                                          ↓ نجاح            ↓ فشل
                                    mark_queue_result    mark_queue_result
                                          ↓                 ↓
                                       [sent]      attempts < max ?
                                                   نعم ↓        لا ↓
                                          [failed] + backoff   [dead]
                                          (1,2,4,8,16 دقيقة)
```

**ضمانات:**
- **لا فقدان**: كل رسالة مُسجّلة قبل الإرسال؛ الفشل يُعيد الجدولة لا يحذف.
- **لا تكرار**: `dedupe_key` فريد + `idempotency_key` للدفعات.
- **تزامن آمن**: `FOR UPDATE SKIP LOCKED` يسمح بعدّة عمّال دون تضارب.
- **الرسائل الميّتة**: بعد 5 محاولات تنتقل لـ`dead` للمراجعة اليدوية.

---

## 4. استراتيجية المراقبة

**المدمج (مبني):**
- `error_log` يلتقط كل خطأ مع السياق و`request_id`.
- `system_health()` يُرجع: طابور معلّق، رسائل ميّتة، أخطاء 24 ساعة، أخطاء حرجة مفتوحة، دفعات عالقة.
- يُعرض في مركز تحكّم المالك (تبويب مراقبة).

**الخارجي (موصى به للإنتاج):**
- **Sentry** لتتبّع أخطاء الواجهة والخادم لحظياً.
- **Supabase Logs & Reports** لمراقبة قاعدة البيانات والاستعلامات البطيئة.
- تنبيه عند `critical_open > 0` أو `payments_stuck > 0`.

---

## 5. إجراءات الاسترداد (Recovery)

**النسخ الاحتياطي:**
- Supabase يوفّر نسخاً يومياً مدمجاً في كل الخطط، و**Point-in-Time Recovery (PITR)** في الخطط المدفوعة (استرداد لأي لحظة خلال آخر 7 أيام).
- التفعيل: لوحة Supabase → Database → Backups → فعّل PITR.
- `backup_log` لتسجيل النسخ اليدوية والتحقّق الدوري.

**استرداد بيانات محذوفة:**
- الحذف ناعم — `restore_record('students', id)` يُرجع أي سجلّ فوراً.

**دفعات عالقة:**
- `system_health()` يكشف الدفعات في `processing` لأكثر من 30 دقيقة.
- `transition_payment_state(id, 'failed', 'timeout')` ثم إعادة المحاولة.

**رسائل ميّتة:**
- مراجعة `notification_queue where status='dead'` يدوياً، وإصلاح السبب، ثم إعادة الجدولة.

---

## 6. هيكل الكود الجاهز للإنتاج

```
rusoompay-production/
├── supabase/migrations/21_fault_tolerance.sql   ← المخطّط الكامل
├── lib/
│   ├── supabase-service.ts                       ← عميل الخدمة
│   ├── api-handler.ts                             ← غلاف الأخطاء
│   └── notifications/providers.ts                ← المزوّدون
├── app/api/cron/
│   ├── process-queue/route.ts                    ← عامل الطابور
│   └── fee-reminders/route.ts                     ← التذكيرات
├── vercel.json                                    ← جدولة الـcron
└── .env.example                                   ← المتغيّرات المطلوبة
```

---

## خطوات التفعيل

1. **نفّذ الترحيل**: شغّل `21_fault_tolerance.sql` في Supabase.
2. **املأ المتغيّرات**: انسخ `.env.example` إلى `.env.local` واملأ `SUPABASE_SERVICE_ROLE_KEY` و`CRON_SECRET`.
3. **فعّل النسخ الاحتياطي**: من لوحة Supabase فعّل PITR.
4. **انشر على Vercel**: مهام الـcron تعمل تلقائياً من `vercel.json`.
5. **(اختياري) فعّل مزوّداً**: أضف مفاتيح Twilio/Resend/WhatsApp لتفعيل القناة المطلوبة.
6. **(موصى به) اربط Sentry** لمراقبة لحظية.

النظام يعمل بأمان **حتى قبل** ربط المزوّدين — الرسائل تُحفظ في الطابور وتُرسل فور التفعيل.

---

## 7. الأمان: تحديد المعدّل والتحقّق من المدخلات

### مفاتيح API (تأكيد)
لا توجد مفاتيح مكتوبة في الكود — كلها من `process.env`. ملاحظة مهمة:
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` يظهر في المتصفّح **بالتصميم**؛ الحماية من RLS لا من إخفائه.
- `SUPABASE_SERVICE_ROLE_KEY` سرّي، يُستخدم في الخادم فقط (العامل/الـcron).

### تحديد المعدّل (Rate Limiting)
- `lib/rate-limit.ts` + `22_rate_limiting.sql` — عدّاد ذرّي بنافذة منزلقة في قاعدة البيانات (يعمل عبر خوادم serverless المتعدّدة، عكس الذاكرة المحلية).
- مطبّق على `/api/payments/submit`: 10 محاولات / 5 دقائق لكل مستخدم → يردّ `429` مع `Retry-After`.
- طبّق نفس النمط على أي مسار حسّاس (دخول، تسجيل، إرسال).

### التحقّق من المدخلات وتنظيفها
- `lib/validation.ts` (zod) — مخطّطات قابلة لإعادة الاستخدام + منظّفات (`sanitizeText` يزيل وسوم HTML ومحارف التحكّم، `sanitizePhone`).
- يُرجع أخطاء نظيفة (`422`) دون رمي استثناء.
- **ملاحظة**: الحماية الأساسية تبقى RLS ودوال `SECURITY DEFINER` في قاعدة البيانات؛ هذه الطبقة دفاع إضافي على الحدود.

### الترتيب في كل مسار حسّاس
1. مصادقة (`getUser`) → 2. تحديد معدّل → 3. تحقّق مدخلات → 4. تنفيذ RPC آمنة → 5. تعامل رشيق مع الأخطاء.
