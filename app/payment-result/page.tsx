// app/payment-result/page.tsx
//
// ⚠️ هذا المسار عمداً خارج مجلد app/(app)/ المحمي بجلسة دخول إجبارية.
// السبب: ثواني يرجّع المستخدم من دومين خارجي (checkout.thawani.om) عبر
// تحويلة (redirect) — بعض المتصفحات (خصوصاً Safari/iOS) قد لا ترفق كوكيز
// الجلسة بشكل موثوق مع أول طلب بعد تحويلة عابرة للنطاقات.
//
// الحل: هذي الصفحة لا تعتمد على جلسة المستخدم إطلاقاً — لا لتأكيد الدفع
// (نتحقق من ثواني نفسها)، ولا لعرض النتيجة (نعرض تفاصيل الفاتورة مباشرة
// بهذي الصفحة، عشان ولي الأمر ما يحتاج يرجع لصفحة محمية بجلسة قد تكون ضاعت).

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { retrieveSession } from "@/lib/thawani";
import { toE164 } from "@/lib/phone";
import { sendWhatsApp } from "@/lib/whatsapp";
import Link from "next/link";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Receipt = {
  studentName: string;
  description: string;
  amount: number;
  paidAt: string;
};

async function fetchReceipt(pendingId: string): Promise<Receipt | null> {
  const { data } = await supabaseAdmin
    .from("pending_payments")
    .select("amount, resolved_at, student_fees ( description, students ( full_name ) )")
    .eq("id", pendingId)
    .single();

  if (!data) return null;
  return {
    // @ts-expect-error - shape depends on join
    studentName: data.student_fees?.students?.full_name || "",
    // @ts-expect-error
    description: data.student_fees?.description || "رسوم دراسية",
    amount: Number(data.amount),
    paidAt: data.resolved_at || new Date().toISOString(),
  };
}

// إرسال مباشر عبر Twilio — بدون نداء HTTP ذاتي على موقعنا (كان يفشل بصمت أحياناً)
async function sendWhatsAppConfirmation(pendingId: string) {
  try {
    const { data: pending } = await supabaseAdmin
      .from("pending_payments")
      .select("amount, student_fees ( description, students ( full_name, guardian_phone ) )")
      .eq("id", pendingId)
      .single();

    // @ts-expect-error - shape depends on join
    const phone: string | undefined = pending?.student_fees?.students?.guardian_phone;
    // @ts-expect-error
    const studentName: string = pending?.student_fees?.students?.full_name || "";
    // @ts-expect-error
    const description: string = pending?.student_fees?.description || "رسوم دراسية";
    const amount = pending?.amount;

    if (!phone || !amount) {
      console.error("send-whatsapp skipped: missing phone or amount", { pendingId, phone, amount });
      return;
    }

    const to = toE164(phone);
    const body =
      `✅ تم تأكيد دفعة بمبلغ ${Number(amount).toFixed(3)} ر.ع` +
      (studentName ? ` عن ${studentName}` : "") +
      ` (${description}) عبر ثواني. شكراً لكم.`;

    const result = await sendWhatsApp(to, body);
    if (!result.ok) {
      console.error("send-whatsapp failed:", result.error, { pendingId, to });
    }
  } catch (err) {
    console.error("send-whatsapp confirmation threw:", err);
  }
}

async function resolvePayment(pendingId: string) {
  const { data: pending } = await supabaseAdmin
    .from("pending_payments")
    .select("id, provider_ref, txn_state, status, method, amount")
    .eq("id", pendingId)
    .single();

  if (!pending || pending.method !== "thawani") {
    return { ok: false, reason: "لم يتم العثور على الدفعة" };
  }

  if (pending.status === "approved" || pending.txn_state === "paid") {
    return { ok: true, alreadyConfirmed: true };
  }

  if (!pending.provider_ref) {
    return { ok: false, reason: "لا توجد جلسة دفع مرتبطة" };
  }

  let session;
  try {
    session = await retrieveSession(pending.provider_ref);
  } catch {
    return { ok: false, reason: "تعذر التحقق من حالة الدفع" };
  }

  if (session.clientReferenceId && session.clientReferenceId !== pending.id) {
    await supabaseAdmin.rpc("mark_gateway_payment_failed", {
      p_id: pending.id,
      p_reason: "client_reference_id_mismatch",
    });
    return { ok: false, reason: "بيانات الجلسة غير متطابقة" };
  }

  if (session.paymentStatus === "paid") {
    const expectedBaisa = Math.round(Number(pending.amount) * 1000);
    if (session.totalAmountBaisa !== null && session.totalAmountBaisa !== expectedBaisa) {
      await supabaseAdmin.rpc("mark_gateway_payment_failed", {
        p_id: pending.id,
        p_reason: `amount_mismatch_expected_${expectedBaisa}_got_${session.totalAmountBaisa}`,
      });
      return { ok: false, reason: "المبلغ المدفوع لا يطابق المبلغ المطلوب" };
    }

    const { data: confirmResult, error } = await supabaseAdmin.rpc("confirm_gateway_payment", {
      p_id: pending.id,
      p_provider_ref: pending.provider_ref,
    });
    if (error) return { ok: false, reason: error.message };

    // لو الويب هوك سبق واعتمد الدفعة، لا نُرسل واتساب مكرر
    if (!confirmResult?.already_confirmed) {
      await sendWhatsAppConfirmation(pending.id);
    }
    return { ok: true, alreadyConfirmed: Boolean(confirmResult?.already_confirmed) };
  }

  await supabaseAdmin.rpc("mark_gateway_payment_failed", {
    p_id: pending.id,
    p_reason: `thawani_status_${session.paymentStatus}`,
  });
  return { ok: false, reason: "لم تكتمل عملية الدفع" };
}

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; pending?: string }>;
}) {
  const { status, pending: pendingId } = await searchParams;

  let result: { ok: boolean; reason?: string; alreadyConfirmed?: boolean } = {
    ok: false,
    reason: "بيانات ناقصة",
  };

  if (pendingId && status !== "cancel") {
    result = await resolvePayment(pendingId);
  } else if (status === "cancel") {
    result = { ok: false, reason: "تم إلغاء عملية الدفع" };
  }

  const success = result.ok;
  const receipt = success && pendingId ? await fetchReceipt(pendingId) : null;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#F4F6FA",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
      dir="rtl"
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 32,
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 2px 12px rgba(0,0,0,.08)",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>{success ? "✅" : "⚠️"}</div>
        <h2 style={{ color: "#0A1D33", margin: "0 0 8px", fontFamily: "Cairo" }}>
          {success ? "تم الدفع بنجاح" : "تعذّر إتمام الدفع"}
        </h2>
        <p style={{ color: "#667", fontSize: 14, lineHeight: 1.8, margin: "0 0 20px" }}>
          {success
            ? "تم تأكيد دفعتك وتحديث الفاتورة تلقائياً."
            : result.reason || "حدث خطأ أثناء معالجة الدفعة."}
        </p>

        {/* تفاصيل الفاتورة مباشرة هنا — بدون حاجة للرجوع لصفحة تتطلب تسجيل دخول */}
        {receipt && (
          <div
            style={{
              background: "#F4F8F7",
              borderRadius: 10,
              padding: 16,
              marginBottom: 20,
              textAlign: "right",
              fontSize: 13.5,
              lineHeight: 2,
              color: "#334",
            }}
          >
            {receipt.studentName && (
              <div>
                <b>الطالب:</b> {receipt.studentName}
              </div>
            )}
            <div>
              <b>البند:</b> {receipt.description}
            </div>
            <div>
              <b>المبلغ:</b> {fmt(receipt.amount)} ر.ع
            </div>
            <div>
              <b>التاريخ:</b> {new Date(receipt.paidAt).toLocaleDateString("en-GB")}
            </div>
          </div>
        )}

        <Link
          href="/parent"
          style={{
            display: "inline-block",
            padding: "12px 28px",
            background: "#D4A017",
            color: "#08172B",
            borderRadius: 10,
            fontWeight: 700,
            textDecoration: "none",
            fontFamily: "inherit",
          }}
        >
          الرجوع لبوابة ولي الأمر
        </Link>
      </div>
    </div>
  );
}
