// POST /api/thawani/webhook
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { retrieveSession } from '@/lib/thawani'
import { toE164 } from '@/lib/phone'
import { sendWhatsApp } from '@/lib/whatsapp'

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

  let status
  try {
    status = await retrieveSession(sessionId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'فشل التحقق من جلسة ثواني'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }

  if (status.paymentStatus !== 'paid') {
    return NextResponse.json({ ok: true, ignored: true, status: status.paymentStatus })
  }

  const pendingId = status.clientReferenceId
  if (!pendingId) {
    return NextResponse.json({ ok: false, error: 'clientReferenceId مفقود من جلسة ثواني' }, { status: 502 })
  }

  const supabase = serviceClient()

  const { data: pending } = await supabase
    .from('pending_payments')
    .select('id, amount, method, status')
    .eq('id', pendingId)
    .single()

  if (!pending || pending.method !== 'thawani') {
    return NextResponse.json({ ok: false, error: 'دفعة غير موجودة أو ليست عبر ثواني' }, { status: 404 })
  }

  if (pending.status === 'approved') {
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
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  // نرسل الواتساب من هنا فقط — الموثوق (سيرفر لسيرفر) — وفقط إذا نحن من اعتمد الدفعة فعلاً (مو تكرار)
  if (result?.ok && !result?.duplicate && result?.guardian_phone) {
    const to = toE164(result.guardian_phone)
    const body =
      `✅ تم تأكيد دفعة بمبلغ ${Number(result.amount).toFixed(3)} ر.ع` +
      (result.student_name ? ` عن ${result.student_name}` : '') +
      ` عبر ثواني. شكراً لكم.`
    const wa = await sendWhatsApp(to, body)
    if (!wa.ok) {
      console.error('webhook whatsapp failed:', wa.error, { pendingId })
    }
  }

  return NextResponse.json({ ok: true, result })
}
