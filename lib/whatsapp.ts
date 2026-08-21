// lib/whatsapp.ts
// إرسال واتساب مباشرة عبر Twilio — بدون المرور بطلب HTTP ذاتي لموقعنا نفسه.
// (الاعتماد على fetch لموقعنا نفسه من داخل نفس السيرفر كان عرضة للفشل الصامت
// لو اختلف NEXT_PUBLIC_APP_URL عن الدومين الفعلي اللي يخدم الطلب.)

// ─── قوالب Twilio المعتمدة (ContentSid) ─────────────────────────────────────
// مصدر واحد للحقيقة: يُستخدم من app/api/send-whatsapp/route.ts (المسار المحمي
// بجلسة مستخدم) ومن sendWhatsAppTemplate أدناه (لنداءات سيرفر-إلى-سيرفر بلا
// جلسة مستخدم، مثل webhook ثواني وصفحة نتيجة الدفع).
// حدّث القيم هنا فقط إذا أنشأت قالب جديد أو غيّرت واحد قديم.
export const TEMPLATES = {
  fee_reminder: 'HX26a44583bfcd9f3d2f93ff88c9d7abd4', // تذكير رسوم — {{1}} مدرسة {{2}} ولي أمر {{3}} طالب {{4}} مبلغ
  payment_full: 'HX6cf023d78afdf4050b79163f78cb823e', // تأكيد سداد كامل — {{1}} مدرسة {{2}} ولي أمر {{3}} مبلغ {{4}} طريقة {{5}} طالب
  payment_partial: 'HX03029915d074ff446d676551c48e2416', // تأكيد سداد جزئي — نفس السابق + {{6}} متبقي
  parent_invite: 'HX2a05e89eb4f7022b2b3b39442c82e337', // دعوة تفعيل حساب (parentinvite5 — Call to Action) — {{1}} اسم المدرسة {{2}} رقم هاتف
  admin_new_sub: 'HX815c4c62648c90c9e502021720ba7e98', // إشعار اشتراك جديد للإدارة — {{1}} مدرسة {{2}} باقة {{3}} طريقة دفع
  general_reminder: 'HXc750c19902eccb2ac11f5c5c6f7f1c98', // تذكير عام — {{1}} مدرسة
} as const

export type TemplateName = keyof typeof TEMPLATES

// القوالب التي يبدأ نصّها المعتمد بكلمة "مدرسة" قبل المتغيّر {{1}}.
// أسماء المدارس في قاعدة البيانات تُخزَّن أحياناً بالبادئة ("مدرسة نور العلم")،
// فيظهر التكرار "مدرسة مدرسة نور العلم". نُزيل البادئة هنا مركزياً بدل تعديل كل مكوّن.
// لا نلمس نصّ القالب في Twilio لأنه معتمد من واتساب.
export const TEMPLATES_WITH_SCHOOL_PREFIX: readonly TemplateName[] = [
  'fee_reminder',
  'parent_invite',
  'payment_full',
  'payment_partial',
  'admin_new_sub',
  'general_reminder',
]

export function stripSchoolPrefix(value: string): string {
  return value.replace(/^\s*مدرسة\s+/, '').trim() || value
}

// إرسال عبر قالب معتمد (ContentSid) — الطريقة الصحيحة لأي رسالة يبدأها النظام
// (تذكير، تأكيد دفع، إشعار)، تعمل خارج نافذة الـ24 ساعة على عكس Body الحر.
// للاستخدام من نداءات سيرفر-إلى-سيرفر التي ليس لها جلسة مستخدم (webhooks، صفحات
// تحويل خارجية). المسارات التي فيها جلسة مستخدم تمرّ عبر /api/send-whatsapp
// (فيها فحوصات صلاحية وعزل مستأجر إضافية).
export async function sendWhatsAppTemplate(
  to: string,
  template: TemplateName,
  variables?: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!sid || !token || !from) {
    return { ok: false, error: "متغيرات Twilio غير مكتملة" };
  }

  const toFormatted = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

  const params = new URLSearchParams();
  params.append("To", toFormatted);
  params.append("From", from);
  params.append("ContentSid", TEMPLATES[template]);

  if (variables && Object.keys(variables).length > 0) {
    const finalVars = { ...variables };
    if (TEMPLATES_WITH_SCHOOL_PREFIX.includes(template) && typeof finalVars['1'] === 'string') {
      finalVars['1'] = stripSchoolPrefix(finalVars['1']);
    }
    params.append("ContentVariables", JSON.stringify(finalVars));
  }

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      return { ok: false, error: data?.message || `Twilio error (${res.status})` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "فشل الاتصال بـ Twilio" };
  }
}

// ─── نص حر (Body) — يعمل فقط داخل نافذة 24 ساعة من آخر رسالة من المستلم ────
// استخدمه فقط لردود على مستخدم راسل حديثاً (مثل notifyOwnerNewSubscriber أدناه
// التي تُرسل لرقم المالك الذي يتفاعل بانتظام). لأي رسالة يبدأها النظام لولي
// أمر (تذكير، تأكيد دفع، دعوة)، استخدم sendWhatsAppTemplate أعلاه بدلاً منه.
export async function sendWhatsApp(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!sid || !token || !from) {
    return { ok: false, error: "متغيرات Twilio غير مكتملة" };
  }

  const toFormatted = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

  const params = new URLSearchParams();
  params.append("To", toFormatted);
  params.append("From", from);
  params.append("Body", body);

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      return { ok: false, error: data?.message || `Twilio error (${res.status})` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "فشل الاتصال بـ Twilio" };
  }
}

// ─── إشعار صاحب المنصة عند اشتراك مدرسة جديدة ───────────────────────────────

interface NewSubscriberPayload {
  schoolName: string;
  contactName: string;
  phone: string;
  plan: string;
  email?: string;
  city?: string;
}

export async function notifyOwnerNewSubscriber(data: NewSubscriberPayload): Promise<void> {
  const ownerPhone = process.env.OWNER_WHATSAPP_NUMBER;
  if (!ownerPhone) {
    console.warn("[notifyOwnerNewSubscriber] OWNER_WHATSAPP_NUMBER غير موجود في env");
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://rusoompay.com";
  const adminUrl = `${appUrl}/admin/schools/pending`;

  const now = new Date().toLocaleString("ar-OM", {
    timeZone: "Asia/Muscat",
    dateStyle: "short",
    timeStyle: "short",
  });

  const body = [
    "📌 *مشترك جديد ينتظر الاعتماد*",
    "",
    `🏫 المدرسة: ${data.schoolName}`,
    `👤 المسؤول: ${data.contactName}`,
    `📱 الهاتف: ${data.phone}`,
    data.email ? `✉️ البريد: ${data.email}` : null,
    data.city ? `📍 المدينة: ${data.city}` : null,
    `📦 الخطة: ${data.plan}`,
    `🕐 الوقت: ${now}`,
    "",
    `🔗 للاعتماد: ${adminUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await sendWhatsApp(ownerPhone, body);
  if (!result.ok) {
    console.error("[notifyOwnerNewSubscriber] فشل الإرسال:", result.error);
  }
}
