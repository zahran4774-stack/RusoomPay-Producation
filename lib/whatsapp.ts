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
