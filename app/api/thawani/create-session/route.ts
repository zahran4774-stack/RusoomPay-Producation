// POST /api/thawani/create-session
// ينشئ صفّ pending_payments أولاً (مصدر الحقيقة عندنا)، ثم ينشئ جلسة دفع ثواني
// باستخدام معرّف ذلك الصفّ كـ clientReferenceId — هذا يسمح للـwebhook لاحقاً
// بجلب المبلغ والفاتورة من قاعدة بياناتنا مباشرة، لا من تخمين شكل ردّ ثواني.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createCheckoutSession } from '@/lib/thawani'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'غير مسجّل الدخول' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, full_name, phone').eq('id', user.id).single()
  if (profile?.role !== 'parent') {
    return NextResponse.json({ ok: false, error: 'هذه الخدمة لأولياء الأمور فقط' }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as { feeId?: string; amount?: number } | null
  const feeId = body?.feeId
  const amount = body?.amount
  if (!feeId || !amount || amount <= 0) {
    return NextResponse.json({ ok: false, error: 'بيانات الطلب غير مكتملة' }, { status: 400 })
  }

  // تحقّق أن الفاتورة تخصّ فعلاً أحد أبناء ولي الأمر هذا، والمبلغ لا يتجاوز المتبقّي
  const { data: fee } = await supabase
    .from('student_fees')
    .select('id, total, paid, student_id, students!inner(full_name, school_id, parent_students!inner(parent_id))')
    .eq('id', feeId)
    .single()

  if (!fee) {
    return NextResponse.json({ ok: false, error: 'الفاتورة غير موجودة' }, { status: 404 })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkedParents = ((fee as any).students?.parent_students ?? []) as { parent_id: string }[]
  const belongsToUser = linkedParents.some((p) => p.parent_id === user.id)
  if (!belongsToUser) {
    return NextResponse.json({ ok: false, error: 'هذه الفاتورة لا تخصّ أحد أبنائك' }, { status: 403 })
  }

  const remaining = Number(fee.total) - Number(fee.paid)
  if (amount > remaining + 0.0005) {
    return NextResponse.json({ ok: false, error: 'المبلغ أكبر من المتبقّي على الفاتورة' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const studentName = (fee as any).students?.full_name ?? 'الطالب'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schoolId = (fee as any).students?.school_id as string | undefined
  if (!schoolId) {
    return NextResponse.json({ ok: false, error: 'تعذّر تحديد المدرسة المرتبطة بالفاتورة' }, { status: 500 })
  }

  // 1) أنشئ صفّ pending_payments أولاً — هذا مصدر الحقيقة، لا رد ثواني
  const { data: pending, error: insertError } = await supabase
    .from('pending_payments')
    .insert({
      school_id: schoolId,
      fee_id: feeId,
      guardian_id: user.id,
      amount,
      method: 'thawani',
      status: 'pending',
      txn_state: 'pending',
    })
    .select('id')
    .single()

  if (insertError || !pending) {
    return NextResponse.json({ ok: false, error: insertError?.message ?? 'فشل إنشاء سجلّ الدفعة' }, { status: 500 })
  }

  const origin = req.nextUrl.origin

  // 2) أنشئ جلسة ثواني، مستخدمين id السجلّ كمرجع (clientReferenceId)
  let session
  try {
    session = await createCheckoutSession({
      clientReferenceId: pending.id,
      amountOMR: amount,
      description: `رسوم دراسية - ${studentName}`,
      successUrl: `${origin}/parent/payment-result?status=success&fee=${feeId}`,
      cancelUrl: `${origin}/parent/payment-result?status=cancel&fee=${feeId}`,
      customerName: profile.full_name ?? 'ولي الأمر',
      customerPhone: profile.phone ?? '',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'فشل إنشاء جلسة الدفع'
    // فشل إنشاء الجلسة بعد إنشاء السجلّ — نعلّم السجلّ كفاشل بدل ما يبقى معلّقاً للأبد
    await supabase
      .from('pending_payments')
      .update({ status: 'rejected', failure_reason: message, state_updated_at: new Date().toISOString() })
      .eq('id', pending.id)
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }

  // 3) خزّن مرجع الجلسة على السجلّ عشان الـwebhook يقدر يتحقق ويطابق لاحقاً
  await supabase
    .from('pending_payments')
    .update({ provider_ref: session.sessionId, state_updated_at: new Date().toISOString() })
    .eq('id', pending.id)

  return NextResponse.json({ ok: true, paymentUrl: session.checkoutUrl, sessionId: session.sessionId })
}
