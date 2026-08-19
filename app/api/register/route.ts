import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyOwnerNewSubscriber } from "@/lib/whatsapp";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { schoolName, contactName, phone, email, city, plan } = body;

    // التحقق من الحقول الإلزامية
    if (!schoolName || !contactName || !phone || !plan) {
      return NextResponse.json(
        { error: "بيانات ناقصة" },
        { status: 400 }
      );
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
    notifyOwnerNewSubscriber({ schoolName, contactName, phone, email, city, plan }).catch(
      (err) => console.error("[register] notify error:", err)
    );

    return NextResponse.json({ ok: true, id: school.id }, { status: 201 });
  } catch (err) {
    console.error("[register] unexpected error:", err);
    return NextResponse.json({ error: "خطأ غير متوقع" }, { status: 500 });
  }
}
