// POST /api/thawani/webhook
// يستقبل تأكيد الدفع من ثواني، يتحقّق منه عبر الاستعلام المباشر (لا نثق بجسم الطلب وحده)،
// ثم يستدعي record_thawani_payment التي تجيب المبلغ والفاتورة من سجلّ pending_payments
// عندنا (مصدر الحقيقة)، وتُنفّذ نفس منطق record_payment المحاسبي (قيد، تحديث فاتورة، تدقيق).
//
// طبقة دفاع إضافية للتأكيد الأساسي عبر /payment-result — لو الوالد سكّر
// المتصفح قبل ما يرجع من ثواني، هذا الـwebhook يضمن اعتماد الدفعة برضه.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { retrieveSession } from '@/lib/thawani'

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

  // 🔒 لا نثق بمحتوى الطلب الوارد — نتحقّق من ثواني نفسها مباشرة
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

  const pendingId = status.clientReferenceId
  if (!pendingId) {
    return NextResponse.json({ ok: false, error: 'clientReferenceId مفقود من جلسة ثواني' }, { status: 502 })
  }

  const supabase = serviceClient()

  // 🔒 تحقّق إضافي: الدفعة المعلّقة موجودة فعلاً، طريقتها ثواني، والمبلغ الفعلي
  // المدفوع عند ثواني يطابق المبلغ المسجّل عندنا — قبل ما نستدعي دالة الاعتماد
  const { data: pending } = await supabase
    .from('pending_payments')
    .select('id, amount, method, status')
    .eq('id', pendingId)
    .single()

  if (!pending || pending.method !== 'thawani') {
    return NextResponse.json({ ok: false, error: 'دفعة غير موجودة أو ليست عبر ثواني' }, { status: 404 })
  }

  if (pending.status === 'approved') {
    // مؤكدة مسبقاً (webhook مكرر أو التأكيد صار عبر /payment-result أول) — لا إجراء إضافي
    return NextResponse.json({ ok: true, duplicate: true })
  }

  const expectedBaisa = Math.round(Number(pending.amount) * 1000)
  if (status.totalAmountBaisa !== null && status.totalAmountBaisa !== expectedBaisa) {
    return NextResponse.json(
      { ok: false, error: `عدم تطابق المبلغ: متوقّع ${expectedBaisa} والفعلي ${status.totalAmountBaisa}` },
      { status: 409 }
    )
  }

  const { data: result, error } = await supabase.rpc('record_thawani_payment', {
    p_pending_id: pendingId,
  })

  if (error) {
    // نُرجع 500 عمداً — ثواني تُعيد المحاولة تلقائياً عند فشل الـwebhook
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, result })
}
