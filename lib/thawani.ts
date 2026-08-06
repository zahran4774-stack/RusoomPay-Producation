// lib/thawani.ts
// عميل بسيط للتعامل مع Thawani Checkout API
// المفاتيح تُقرأ من متغيرات البيئة فقط — لا تكتبها هنا أبداً

const THAWANI_SECRET_KEY = process.env.THAWANI_SECRET_KEY!;
const THAWANI_PUBLISHABLE_KEY = process.env.THAWANI_PUBLISHABLE_KEY!;

// UAT = بيئة الاختبار (Sandbox) — production لما تصير المفاتيح حقيقية
const THAWANI_ENV = process.env.THAWANI_ENV === "production" ? "production" : "uat";

const API_BASE =
  THAWANI_ENV === "production"
    ? "https://checkout.thawani.om/api/v1"
    : "https://uatcheckout.thawani.om/api/v1";

const CHECKOUT_BASE =
  THAWANI_ENV === "production"
    ? "https://checkout.thawani.om"
    : "https://uatcheckout.thawani.om";

type ThawaniProduct = {
  name: string;
  quantity: number;
  unit_amount: number; // بالبيسة — عدد صحيح، بدون فواصل عشرية
};

type CreateSessionParams = {
  clientReferenceId: string; // = pending_payment.id عندنا
  amountOMR: number; // المبلغ بالريال العماني (مثال: 25.500)
  description: string;
  successUrl: string;
  cancelUrl: string;
  customerName?: string;
  customerPhone?: string;
};

/** يحوّل مبلغ بالريال العماني إلى بيسة (عدد صحيح) كما تتطلب ثواني */
export function omrToBaisa(amountOMR: number): number {
  return Math.round(amountOMR * 1000);
}

export async function createCheckoutSession(params: CreateSessionParams) {
  const products: ThawaniProduct[] = [
    {
      name: params.description || "رسوم دراسية",
      quantity: 1,
      unit_amount: omrToBaisa(params.amountOMR),
    },
  ];

  const res = await fetch(`${API_BASE}/checkout/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "thawani-api-key": THAWANI_SECRET_KEY,
    },
    body: JSON.stringify({
      client_reference_id: params.clientReferenceId,
      mode: "payment",
      products,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        customer_name: params.customerName || "ولي أمر",
        customer_phone: params.customerPhone || "",
      },
    }),
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(
      `فشل إنشاء جلسة ثواني: ${data?.description || res.statusText}`
    );
  }

  const sessionId: string = data.data.session_id;
  const checkoutUrl = `${CHECKOUT_BASE}/pay/${sessionId}?key=${THAWANI_PUBLISHABLE_KEY}`;

  return { sessionId, checkoutUrl };
}

export type ThawaniSessionStatus = "paid" | "unpaid" | "cancelled" | string;

export async function retrieveSession(sessionId: string): Promise<{
  paymentStatus: ThawaniSessionStatus;
  clientReferenceId: string | null;
  raw: any;
}> {
  const res = await fetch(`${API_BASE}/checkout/session/${sessionId}`, {
    method: "GET",
    headers: {
      "thawani-api-key": THAWANI_SECRET_KEY,
    },
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(
      `فشل التحقق من جلسة ثواني: ${data?.description || res.statusText}`
    );
  }

  return {
    paymentStatus: data.data.payment_status,
    clientReferenceId: data.data.client_reference_id ?? null,
    raw: data.data,
  };
}
