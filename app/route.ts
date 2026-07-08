// app/api/cron/fee-reminders/route.ts
// تذكيرات الرسوم المتأخّرة — يُشغّل يومياً، يجد الفواتير المتبقّية ويضيف تذكيراً للطابور.
// لا يرسل مباشرة: يضع في الطابور (مع dedupe) فيعالجه عامل الطابور مع إعادة المحاولة.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  let queued = 0

  try {
    // الفواتير المستحقّة وغير المسدّدة بالكامل (غير المحذوفة)
    const { data: dueFees, error } = await supabase
      .from('student_fees')
      .select('id, school_id, student_id, description, total, paid, due_date')
      .is('deleted_at', null)
      .lt('due_date', today)

    if (error) throw error

    for (const fee of dueFees ?? []) {
      const remaining = Number(fee.total) - Number(fee.paid)
      if (remaining <= 0.0005) continue

      // إيجاد ولي الأمر المرتبط للحصول على وسيلة التواصل
      const { data: links } = await supabase
        .from('parent_students').select('parent_id').eq('student_id', fee.student_id)
      for (const link of links ?? []) {
        const { data: prof } = await supabase
          .from('profiles').select('phone').eq('id', link.parent_id).single()
        if (!prof?.phone) continue

        // إضافة للطابور مع dedupe يومي (يمنع تكرار نفس التذكير في اليوم)
        const dedupe = `reminder:${fee.id}:${today}`
        const body = `تذكير: عليكم رسوم متبقّية بقيمة ${remaining.toFixed(3)} (${fee.description}). يرجى السداد عبر بوابة RusoomPay.`
        const { error: qErr } = await supabase.from('notification_queue').insert({
          school_id: fee.school_id, channel: 'whatsapp', recipient: prof.phone,
          payload: { body }, dedupe_key: dedupe,
        })
        if (!qErr) queued++
      }
    }

    return NextResponse.json({ ok: true, queued })
  } catch (e) {
    await supabase.from('error_log').insert({
      source: 'queue', severity: 'error',
      message: `فشل تذكيرات الرسوم: ${(e as Error).message}`,
    })
    return NextResponse.json({ ok: false, error: 'fee reminders failed' }, { status: 500 })
  }
}
