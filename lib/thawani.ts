// مكتبة التكامل مع ثواني Pay — بوابة الدفع العُمانية
// بيئة UAT للاختبار حالياً. التبديل للإنتاج: تغيير متغيّرات البيئة فقط، لا الكود.
//
// المبدأ: خادمنا ينشئ جلسة دفع، نحوّل العميل لصفحة ثواني المستضافة
// (لا نلمس بيانات البطاقة أبداً)، ثم نتحقّق من النتيجة عبر webhook — لا نثق بـsuccess_url وحده.

const THAWANI_BASE_URL = process.env.THAWANI_BASE_URL || 'https://uatcheckout.thawani.om/api/v1'
const THAWANI_PAY_URL = process.env.THAWANI_PAY_URL || 'https://uatcheckout.thawani.om/pay'
const THAWANI_SECRET_KEY = process.env.THAWANI_SECRET_KEY || 'rRQ26GcsZzoEhbrP2HZvLYDbn9C9et'       // مفتاح UAT العام — للتطوير فقط
const THAWANI_PUBLISHABLE_KEY = process.env.THAWANI_PUBLISHABLE_KEY || 'HGvTMLDssJghr9tlN9gr4DVYt0qyBy'

type CreateSessionInput = {
  feeId: string          // معرّف الفاتورة عندنا (student_fees.id)
  amountOmr: number      // المبلغ بالريال العُماني (كسور عشرية، مثل 15.000)
  studentName: string
  parentEmail?: string | null
  parentName: string
  parentPhone: string
  successUrl: string
  cancelUrl: string
}

type ThawaniSessionResponse = {
  success: boolean
  data?: { session_id: string }
  description?: string
}

type ThawaniStatusResponse = {
  success: boolean
  data?: {
    session_id: string
    payment_status: 'paid' | 'unpaid' | 'cancelled'
    client_reference_id: string
    total_amount: number
  }
}

// يحوّل ريال عُماني (كسور) إلى بيسة (عدد صحيح) — ثواني يتطلّب بيسة حصراً
function omrToBaisa(amountOmr: number): number {
  return Math.round(amountOmr * 1000)
}

// ينشئ جلسة دفع جديدة لدى ثواني، يرجع رابط الدفع الجاهز للتحويل إليه
export async function createThawaniSession(input: CreateSessionInput): Promise<
  { ok: true; sessionId: string; paymentUrl: string } | { ok: false; error: string }
> {
  try {
    const res = await fetch(`${THAWANI_BASE_URL}/checkout/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'thawani-api-key': THAWANI_SECRET_KEY,
      },
      body: JSON.stringify({
        client_reference_id: input.feeId,
        mode: 'payment',
        products: [
          {
            name: `رسوم دراسية - ${input.studentName}`,
            quantity: 1,
            unit_amount: omrToBaisa(input.amountOmr),
          },
        ],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: {
          customer_email: input.parentEmail || undefined,
          customer_name: input.parentName,
          customer_phone: input.parentPhone,
          order_id: input.feeId,
        },
      }),
    })

    const json = (await res.json()) as ThawaniSessionResponse
    if (!res.ok || !json.success || !json.data?.session_id) {
      return { ok: false, error: json.description || 'تعذّر إنشاء جلسة الدفع' }
    }

    const sessionId = json.data.session_id
    const paymentUrl = `${THAWANI_PAY_URL}/${sessionId}?key=${THAWANI_PUBLISHABLE_KEY}`
    return { ok: true, sessionId, paymentUrl }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ اتصال بثواني' }
  }
}

// يستعلم عن حالة جلسة دفع — يُستخدم كخط دفاع ثانٍ إضافةً للـwebhook
export async function getThawaniSessionStatus(sessionId: string): Promise<
  { ok: true; status: 'paid' | 'unpaid' | 'cancelled'; feeId: string; amountBaisa: number } | { ok: false; error: string }
> {
  try {
    const res = await fetch(`${THAWANI_BASE_URL}/checkout/session/${sessionId}`, {
      headers: { 'thawani-api-key': THAWANI_SECRET_KEY },
    })
    const json = (await res.json()) as ThawaniStatusResponse
    if (!res.ok || !json.success || !json.data) {
      return { ok: false, error: 'تعذر جلب حالة الجلسة' }
    }
    return {
      ok: true,
      status: json.data.payment_status,
      feeId: json.data.client_reference_id,
      amountBaisa: json.data.total_amount,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'خطأ اتصال بثواني' }
  }
}

