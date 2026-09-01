// app/api/cron/fee-reminders/route.ts
// تذكيرات الرسوم المتأخّرة — يُشغّل يومياً، يجد الفواتير المتبقّية ويضيف تذكيراً للطابور.
// لا يرسل مباشرة: يضع في الطابور (مع dedupe) فيعالجه عامل الطابور مع إعادة المحاولة.
//
// ملاحظة أداء: مبني على استعلامات مجمّعة (batched) بدل استعلام لكل فاتورة/ولي أمر —
// عشان يتحمّل نمو عدد المدارس/الطلاب بدون أن يتجاوز مهلة التنفيذ (60 ثانية).
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
    // 1) الفواتير المستحقّة وغير المسدّدة بالكامل (غير المحذوفة) — استعلام واحد
    const { data: dueFees, error } = await supabase
      .from('student_fees')
      .select('id, school_id, student_id, description, total, paid, due_date')
      .is('deleted_at', null)
      .lt('due_date', today)

    if (error) throw error

    const remainingFees = (dueFees ?? []).filter(
      (fee) => Number(fee.total) - Number(fee.paid) > 0.0005
    )

    if (remainingFees.length === 0) {
      return NextResponse.json({ ok: true, queued: 0 })
    }

    // 2) أولياء الأمور المرتبطين بكل الطلاب المعنيين — استعلام واحد بدل استعلام لكل فاتورة
    const studentIds = [...new Set(remainingFees.map((f) => f.student_id))]
    const { data: links, error: linksErr } = await supabase
      .from('parent_students')
      .select('student_id, parent_id')
      .in('student_id', studentIds)
    if (linksErr) throw linksErr

    const parentIdsByStudent = new Map<string, string[]>()
    for (const l of links ?? []) {
      const arr = parentIdsByStudent.get(l.student_id) ?? []
      arr.push(l.parent_id)
      parentIdsByStudent.set(l.student_id, arr)
    }

    // 3) أرقام هواتف كل أولياء الأمور — استعلام واحد بدل استعلام لكل رابط
    const allParentIds = [...new Set((links ?? []).map((l) => l.parent_id))]
    const { data: profs, error: profsErr } = await supabase
      .from('profiles')
      .select('id, phone')
      .in('id', allParentIds)
    if (profsErr) throw profsErr

    const phoneByParent = new Map(
      (profs ?? []).filter((p) => !!p.phone).map((p) => [p.id, p.phone as string])
    )

    // 4) بناء كل صفوف الطابور في الذاكرة، ثم إدراج دفعة واحدة (مع تجاهل التكرارات اليومية)
    const rows: {
      school_id: string
      channel: string
      recipient: string
      payload: { body: string }
      dedupe_key: string
    }[] = []

    for (const fee of remainingFees) {
      const remaining = Number(fee.total) - Number(fee.paid)
      const parentIds = parentIdsByStudent.get(fee.student_id) ?? []
      for (const parentId of parentIds) {
        const phone = phoneByParent.get(parentId)
        if (!phone) continue
        rows.push({
          school_id: fee.school_id,
          channel: 'whatsapp',
          recipient: phone,
          payload: { body: `تذكير: عليكم رسوم متبقّية بقيمة ${remaining.toFixed(3)} (${fee.description}). يرجى السداد عبر بوابة RusoomPay.` },
          dedupe_key: `reminder:${fee.id}:${today}`,
        })
      }
    }

    if (rows.length > 0) {
      // dedupe_key عليه قيد UNIQUE في القاعدة — نتجاهل التكرارات بدل ما نفشل الدفعة كلها
      const { data: inserted, error: insErr } = await supabase
        .from('notification_queue')
        .upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
        .select('id')
      if (insErr) throw insErr
      queued = inserted?.length ?? 0
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
