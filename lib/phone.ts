// lib/phone.ts
// دالة تطبيع رقم الهاتف — مصدر واحد مشترك (بدل تكرارها بكل ملف يحتاجها)
//
// ⚠️ حالياً تفترض عُمان افتراضياً (بلد التشغيل الوحيد حالياً).
// عند التوسّع لدول خليجية أخرى: الأصح تخزين رمز الدولة صراحة مع رقم كل
// طالب/موظف بدل التخمين من طول الرقم (أرقام الكويت/البحرين/قطر أيضاً
// 8 خانات محلياً، فالتخمين هنا غير موثوق لهم). هذي الدالة تبقى Fallback فقط.

export function normalizePhone(raw: string | null | undefined, defaultCountryCode = "968"): string {
  let p = (raw || "").replace(/[\s\-()]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("00")) p = p.slice(2);
  if (!p.startsWith(defaultCountryCode) && p.length === 8) {
    p = defaultCountryCode + p;
  }
  return p;
}

/** يرجع الرقم بصيغة E.164 كاملة (+968XXXXXXXX) جاهزة لـ Twilio أو أي API خارجي */
export function toE164(raw: string | null | undefined, defaultCountryCode = "968"): string {
  return `+${normalizePhone(raw, defaultCountryCode)}`;
}
