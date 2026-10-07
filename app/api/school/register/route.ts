import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyOwnerNewSubscriber } from "@/lib/whatsapp";
import { checkRateLimit, clientId } from "@/lib/rate-limit";

const MAX_LEN = 200;
const str = (v: unknown, max = MAX_LEN) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max ? v.trim() : null;
const optStr = (v: unknown, max = MAX_LEN) =>
  v == null || v === "" ? null : str(v, max);

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase environment variables are not configured"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function POST(req: NextRequest) {
  try {
    // نقطة عامة بلا تسجيل دخول: تحديد معدّل لكل IP (5 طلبات/ساعة) — كل طلب يرسل واتساب لمالك المنصة
    const rl = await checkRateLimit(`register:${clientId(req)}`, 5, 3600);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "محاولات كثيرة. حاول لاحقاً." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const supabase = getSupabaseAdmin();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "جسم الطلب غير صالح" }, { status: 400 });
    }

    // التحقق من الحقول وأطوالها (يمنع حشو البيانات)
    const schoolName = str(body.schoolName);
    const contactName = str(body.contactName);
    const phone = str(body.phone, 30);
    const plan = str(body.plan, 50);
    const email = optStr(body.email);
    const city = optStr(body.city);

    if (!schoolName || !contactName || !phone || !plan) {
      return NextResponse.json(
        { error: "بيانات ناقصة أو غير صالحة" },
        { status: 400 }
      );
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "بريد غير صالح" }, { status: 400 });
    }

    // حفظ الطلب في Supabase بحالة pending
    const { data: school, error: dbError } = await supabase
      .from("school_registrations")
      .insert({
        school_name: schoolName,
        contact_name: contactName,
        phone,
        email: email ?? null,
        city: city ?? null,
        plan,
        status: "pending",
      })
      .select()
      .single();

    if (dbError) {
      console.error("[register] Supabase error:", dbError.message);
      return NextResponse.json(
        { error: "فشل حفظ البيانات" },
        { status: 500 }
      );
    }

    // إرسال إشعار واتساب لصاحب المنصة — بشكل غير متزامن حتى لا يؤخر الرد
    notifyOwnerNewSubscriber({
      schoolName,
      contactName,
      phone,
      email: email ?? undefined,
      city: city ?? undefined,
      plan,
    }).catch((err) =>
      console.error("[register] notify error:", err)
    );

    return NextResponse.json(
      { ok: true, id: school.id },
      { status: 201 }
    );
  } catch (err) {
    console.error("[register] unexpected error:", err);

    return NextResponse.json(
      { error: "خطأ غير متوقع" },
      { status: 500 }
    );
  }
}
