// lib/whatsapp.ts
// إرسال واتساب مباشرة عبر Twilio — بدون المرور بطلب HTTP ذاتي لموقعنا نفسه.
// (الاعتماد على fetch لموقعنا نفسه من داخل نفس السيرفر كان عرضة للفشل الصامت
// لو اختلف NEXT_PUBLIC_APP_URL عن الدومين الفعلي اللي يخدم الطلب.)

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
