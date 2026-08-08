// app/payment-result/page.tsx
//
// ⚠️ هذا المسار عمداً خارج مجلد app/(app)/ المحمي بجلسة دخول إجبارية.
// السبب: ثواني يرجّع المستخدم من دومين خارجي (checkout.thawani.om) عبر
// تحويلة (redirect) — بعض المتصفحات (خصوصاً Safari/iOS) قد لا ترفق كوكيز
// الجلسة بشكل موثوق مع أول طلب بعد تحويلة عابرة للنطاقات. لو كانت هذي
// الصفحة داخل app/(app)/layout.tsx (اللي يفرض "if (!user) redirect('/login')")
// فأي غياب مؤقت للجلسة يطرد الوالد لصفحة الدخول بدل ما يشوف نتيجة دفعته.
//
// الحل: هذي الصفحة لا تعتمد على جلسة المستخدم إطلاقاً. تتعرّف على الدفعة
// عبر معرّفها الخاص (uuid غير قابل للتخمين، مُمرّر من route.ts) وتتحقق من
// الدفع الحقيقي مباشرة من ثواني (Retrieve Session) — هذا أكثر أماناً
// وموثوقية من الاعتماد على كوكيز متصفح قد لا تصل.

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { retrieveSession } from "@/lib/thawani";
import { toE164 } from "@/lib/phone";
import Link from "next/link";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendWhatsAppConfirmation(appUrl: string, pendingId: string) {
  try {
    const { data: pending } = await supabaseAdmin
      .from("pending_payments")
      .select("amount, fee_id, student_fees ( description, students ( full_name, guardian_phone ) )")
      .eq("id", pendingId)
      .single();

    // @ts-expect-error - shape depends on join
    const phone: string | undefined = pending?.student_fees?.students?.guardian_phone;
    // @ts-expect-error
    const studentName: string = pending?.student_fees?.students?.full_name || "";
    // @ts-expect-error
    const description: string = pending?.student_fees?.description || "رسوم دراسية";
    const amount = pending?.amount;

    if (!phone || !amount) return;

    const to = toE164(phone);
    const body =
      `✅ تم تأكيد دفعة بمبلغ ${Number(amount).toFixed(3)} ر.ع` +
      (studentName ? ` عن ${studentName}` : "") +
      ` (${description}) عبر ثواني. شكراً لكم.`;

    await fetch(`${appUrl}/api/send-whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, body }),
    });
  } catch (err) {
    console.error("send-whatsapp confirmation failed:", err);
  }
}

async function resolvePayment(pendingId: string, appUrl: string) {
  // نجيب الدفعة عبر معرّفها مباشرة — بدون أي حاجة لهوية مستخدم مسجّل دخول
  const { data: pending } = await supabaseAdmin
    .from("pending_payments")
    .select("id, provider_ref, txn_state, status, method")
    .eq("id", pendingId)
    .single();

  if (!pending || pending.method !== "thawani") {
    return { ok: false, reason: "لم يتم العثور على الدفعة" };
  }

  // مؤكدة مسبقاً (مثلاً المستخدم رجع للصفحة مرتين) — ما نرسل واتساب مرة ثانية
  if (pending.status === "approved" || pending.txn_state === "paid") {
    return { ok: true, alreadyConfirmed: true };
  }

  if (!pending.provider_ref) {
    return { ok: false, reason: "لا توجد جلسة دفع مرتبطة" };
  }

  // 🔒 التحقق الحقيقي من ثواني نفسها — هذا هو مصدر الحقيقة الوحيد، لا الرابط
  let session;
  try {
    session = await retrieveSession(pending.provider_ref);
  } catch {
    return { ok: false, reason: "تعذّر التحقق من حالة الدفع" };
  }

  if (session.paymentStatus === "paid") {
    const { error } = await supabaseAdmin.rpc("confirm_gateway_payment", {
      p_id: pending.id,
      p_provider_ref: pending.provider_ref,
    });
    if (error) return { ok: false, reason: error.message };

    await sendWhatsAppConfirmation(appUrl, pending.id);
    return { ok: true, alreadyConfirmed: false };
  }

  await supabaseAdmin.rpc("mark_gateway_payment_failed", {
    p_id: pending.id,
    p_reason: `thawani_status_${session.paymentStatus}`,
  });
  return { ok: false, reason: "لم تكتمل عملية الدفع" };
}

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; pending?: string }>;
}) {
  const { status, pending: pendingId } = await searchParams;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  let result: { ok: boolean; reason?: string; alreadyConfirmed?: boolean } = {
    ok: false,
    reason: "بيانات ناقصة",
  };

  if (pendingId && status !== "cancel") {
    result = await resolvePayment(pendingId, appUrl);
  } else if (status === "cancel") {
    result = { ok: false, reason: "تم إلغاء عملية الدفع" };
  }

  const success = result.ok;

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
        <p style={{ color: "#667", fontSize: 14, lineHeight: 1.8, margin: "0 0 24px" }}>
          {success
            ? "تم تأكيد دفعتك وتحديث الفاتورة تلقائياً."
            : result.reason || "حدث خطأ أثناء معالجة الدفعة."}
        </p>
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
