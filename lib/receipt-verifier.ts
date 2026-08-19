import Anthropic from "@anthropic-ai/sdk";
import { PAYMENT_CONFIG, PLAN_PRICES } from "./payment-config";

export { PLAN_PRICES };

export interface ReceiptVerificationResult {
  status: "approved" | "suspicious" | "rejected";
  paymentMethod: "phone" | "bank" | "unknown";
  extracted: {
    amount:     number | null;
    currency:   string | null;
    recipient:  string | null;
    date:       string | null;
    reference:  string | null;
    rawText:    string;
  };
  checks: {
    amountMatch:     boolean;
    recipientMatch:  boolean;
    dateValid:       boolean;
    readable:        boolean;
  };
  reason:     string;
  confidence: "high" | "medium" | "low";
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\-_]/g, "")
    .replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function checkRecipientMatch(
  recipient: string | null,
  rawText: string
): { matched: boolean; method: "phone" | "bank" | "unknown" } {
  const haystack = normalize((recipient ?? "") + " " + rawText);

  // فحص رقم الهاتف
  const phoneMatch = PAYMENT_CONFIG.phone.variants.some((v) =>
    haystack.includes(normalize(v))
  );
  if (phoneMatch) return { matched: true, method: "phone" };

  // فحص الحساب البنكي
  const bankMatch = PAYMENT_CONFIG.bank.variants.some((v) =>
    haystack.includes(normalize(v))
  );
  if (bankMatch) return { matched: true, method: "bank" };

  return { matched: false, method: "unknown" };
}

function checkDateValid(dateStr: string | null): boolean {
  if (!dateStr) return false;
  try {
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return false;
    const diffDays = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 14;
  } catch {
    return false;
  }
}

export async function verifyReceipt(
  imageBase64: string,
  imageMediaType: string,
  planName: string,
  expectedAmount?: number
): Promise<ReceiptVerificationResult> {
  const expectedOMR = expectedAmount ?? PLAN_PRICES[planName] ?? null;

  const prompt = `أنت نظام تحقق آلي من إيصالات الدفع العُمانية. حلّل الصورة بدقة تامة.

أرجع JSON فقط بدون أي نص إضافي أو backticks:
{
  "amount": <المبلغ كرقم عشري مثل 320.000، أو null>,
  "currency": <"OMR" أو "RO" أو العملة الظاهرة، أو null>,
  "recipient": <اسم أو رقم المستفيد كما هو مكتوب في الإيصال، أو null>,
  "date": <تاريخ الدفع YYYY-MM-DD، أو null>,
  "reference": <رقم المرجع أو رقم العملية، أو null>,
  "readable": <true إذا الإيصال حقيقي وواضح، false إذا مشوّه أو مزوّر>,
  "rawText": <كل النص المرئي في الإيصال مختصراً في 500 حرف>
}

ابحث عن أي من طرق الدفع التالية في الإيصال:

طريقة 1 — تحويل هاتفي:
  الرقم: 95476649 أو +96895476649

طريقة 2 — تحويل بنكي:
  اسم الحساب: ZAHRAN ZAHIR HAMED AL DAGHARI
  رقم الحساب: 0368 0016 6281 0033
  IBAN: OM670270368001662810033
  SWIFT: BMUSOMRXXXX
  البنك: Bank Muscat

المبلغ المتوقع للخطة "${planName}": ${expectedOMR ?? "غير محدد"} OMR
الأرقام العربية (٠-٩) حوّلها لإنجليزية تلقائياً.
إذا بدا الإيصال معدّلاً أو مزوراً، اجعل readable = false.`;

  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: imageMediaType as
                | "image/jpeg"
                | "image/png"
                | "image/gif"
                | "image/webp",
              data: imageBase64,
            },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  let extracted: ReceiptVerificationResult["extracted"] = {
    amount: null, currency: null, recipient: null,
    date: null, reference: null, rawText: "",
  };
  let readable = false;

  try {
    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    extracted = {
      amount:    typeof parsed.amount === "number" ? parsed.amount : null,
      currency:  parsed.currency ?? null,
      recipient: parsed.recipient ?? null,
      date:      parsed.date ?? null,
      reference: parsed.reference ? String(parsed.reference) : null,
      rawText:   parsed.rawText ?? "",
    };
    readable = parsed.readable === true;
  } catch {
    return {
      status: "rejected",
      paymentMethod: "unknown",
      extracted,
      checks: { amountMatch: false, recipientMatch: false, dateValid: false, readable: false },
      reason: "لم يتمكن النظام من قراءة الإيصال — يرجى إرفاق صورة أوضح",
      confidence: "low",
    };
  }

  if (!readable) {
    return {
      status: "rejected",
      paymentMethod: "unknown",
      extracted,
      checks: { amountMatch: false, recipientMatch: false, dateValid: false, readable: false },
      reason: "الإيصال غير واضح أو يبدو معدّلاً — يحتاج مراجعة يدوية",
      confidence: "low",
    };
  }

  const { matched, method } = checkRecipientMatch(extracted.recipient, extracted.rawText);

  const checks = {
    readable:       true,
    amountMatch:    expectedOMR !== null && extracted.amount !== null
                      ? Math.abs(extracted.amount - expectedOMR) < 0.5
                      : false,
    recipientMatch: matched,
    dateValid:      checkDateValid(extracted.date),
  };

  const methodLabel =
    method === "phone"
      ? `رقم الهاتف (${PAYMENT_CONFIG.phone.display})`
      : method === "bank"
      ? `الحساب البنكي (${PAYMENT_CONFIG.bank.iban})`
      : "جهة غير معروفة";

  let status: ReceiptVerificationResult["status"];
  let reason: string;
  let confidence: ReceiptVerificationResult["confidence"];

  if (checks.amountMatch && checks.recipientMatch && checks.dateValid) {
    status = "approved";
    reason = `✅ إيصال صحيح — ${extracted.amount} OMR مدفوعة إلى ${methodLabel}`;
    confidence = "high";
  } else if (checks.amountMatch && checks.recipientMatch && !checks.dateValid) {
    status = "suspicious";
    reason = `⚠️ المبلغ والمستفيد صحيحان لكن التاريخ (${extracted.date ?? "غير واضح"}) لم يُتحقق منه`;
    confidence = "medium";
  } else if (checks.amountMatch && !checks.recipientMatch) {
    status = "suspicious";
    reason = `⚠️ المبلغ صحيح (${extracted.amount} OMR) لكن المستفيد (${extracted.recipient ?? "غير واضح"}) لا يطابق رقم الهاتف أو الحساب البنكي`;
    confidence = "medium";
  } else if (!checks.amountMatch && extracted.amount !== null && expectedOMR !== null) {
    status = "rejected";
    reason = `❌ المبلغ غير مطابق — المدفوع: ${extracted.amount} OMR، المطلوب: ${expectedOMR} OMR`;
    confidence = "high";
  } else {
    status = "rejected";
    reason = "❌ تعذّر التحقق من الإيصال — يحتاج مراجعة يدوية";
    confidence = "low";
  }

  return { status, paymentMethod: method, extracted, checks, reason, confidence };
}
