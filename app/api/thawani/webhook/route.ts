// POST /api/thawani/webhook
// يستقبل تأكيد الدفع من ثواني، يتحقّق منه عبر الاستعلام المباشر (لا نثق بجسم الطلب وحده)،
// ثم يسجّل الدفعة عبر record_payment — نفس الدالة التي يستخدمها المحاسب يدوياً.
//
// ⚠️ الأمان: بدل الاعتماد فقط على توقيع HMAC (تفاصيله غير مؤكَّدة بعد من ثواني)،
// نُعيد الاستعلام عن حالة الجلسة من ثواني مباشرة عبر getThawaniSessionStatus —
// هذا يضمن أن القيمة المصدر هي ثواني نفسها لا الطلب الوارد، بغضّ النظر عن دقّة توقيعهم.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getThawaniSessionStatus } from '@/lib/thawani'

// عميل Supabase بصلاحية الخدمة (service role) — الـwebhook لا يملك جلسة مستخدم،
// يحتاج صلاحية مباشرة لاستدعاء record_payment نيابة عن النظام.
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
  const status = await getThawaniSessionStatus(sessionId)
  if (!status.ok) {
    return NextResponse.json({ ok: false, error: status.error }, { status: 502 })
  }

  // نتجاهل بصمت أي حالة غير "مدفوعة" — لا خطأ، فقط لا إجراء
  if (status.status !== 'paid') {
    return NextResponse.json({ ok: true, ignored: true, status: status.status })
  }

  const feeId = status.feeId
  const amountOmr = status.amountBaisa / 1000

  const supabase = serviceClient()

  // منع التسجيل المزدوج: لو هذه الجلسة سجّلت من قبل (webhook قد يُستدعى أكثر من مرّة)
  const { data: already } = await supabase
    .from('payments')
    .select('id')
    .eq('fee_id', feeId)
    .eq('method', 'thawani')
    .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .limit(1)

  if (already && already.length > 0) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  // تسجيل الدفعة عبر نفس الدالة المحاسبية الموثوقة — لا منطق موازٍ
  const { data: result, error } = await supabase.rpc('record_payment', {
    p_fee_id: feeId,
    p_amount: amountOmr,
    p_method: 'thawani',
    p_paid_at: new Date().toISOString().slice(0, 10),
  })

  if (error) {
    // نُرجع 500 عمداً — ثواني تُعيد المحاولة تلقائياً عند فشل الـwebhook
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, result })
}

