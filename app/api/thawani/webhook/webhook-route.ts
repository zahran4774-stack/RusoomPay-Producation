// POST /api/thawani/webhook
// يستقبل تأكيد الدفع من ثواني، يتحقّق منه عبر الاستعلام المباشر (لا نثق بجسم الطلب وحده)،
// ثم يستدعي record_thawani_payment التي تجيب المبلغ والفاتورة من سجلّ pending_payments
// عندنا (مصدر الحقيقة)، وتُنفّذ نفس منطق record_payment المحاسبي (قيد، تحديث فاتورة، تدقيق).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { retrieveSession } from '@/lib/thawani'

// عميل Supabase بصلاحية الخدمة (service role) — الـwebhook لا يملك جلسة مستخدم.
function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null) as { session_id?: string; data?: { session_id?: string } } | null
  const sessionId = payload?.session_id || payload?.data?.session_id
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'session_id مفقود' }, { status: 400 })
  }

  // نتحقّق من ثواني مباشرة — لا نثق بمحتوى الطلب الوارد وحده
  let status
  try {
    status = await retrieveSession(sessionId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'فشل التحقق من جلسة ثواني'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }

  // نتجاهل بصمت أي حالة غير "مدفوعة" — لا خطأ، فقط لا إجراء
  if (status.paymentStatus !== 'paid') {
    return NextResponse.json({ ok: true, ignored: true, status: status.paymentStatus })
  }

  // clientReferenceId هو id سجلّ pending_payments الذي أنشأناه وقت فتح الجلسة
  const pendingId = status.clientReferenceId
  if (!pendingId) {
    return NextResponse.json({ ok: false, error: 'clientReferenceId مفقود من جلسة ثواني' }, { status: 502 })
  }

  const supabase = serviceClient()

  const { data: result, error } = await supabase.rpc('record_thawani_payment', {
    p_pending_id: pendingId,
  })

  if (error) {
    // نُرجع 500 عمداً — ثواني تُعيد المحاولة تلقائياً عند فشل الـwebhook
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, result })
}
