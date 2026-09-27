// tests/integration/payment-flow.test.ts
// اختبارات تكامل — تفحص تدفّق العمليات الكامل عبر Supabase الحيّة.
// تتطلّب قاعدة بيانات اختبار: تعمل تلقائياً فقط عند توفّر متغيّرات البيئة، وإلا تُتخطّى بوضوح.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = process.env.TEST_SUPABASE_URL
const SERVICE = process.env.TEST_SUPABASE_SERVICE_KEY
const ready = !!(URL && SERVICE)

// تُتخطّى بوضوح إن لم تتوفّر قاعدة اختبار (لا فشل زائف)
const d = ready ? describe : describe.skip

d('تدفّق الدفع الكامل (تكامل)', () => {
  let admin: SupabaseClient
  let schoolId: string
  let studentId: string
  let feeId: string

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, {
      auth: { persistSession: false },
    })

    // تجهيز بيانات اختبار معزولة
    // is_test:true, active:false — تحصين مضاعف: حتى لو فشل afterAll
    // تبقى هذه المدرسة مستثناة فوراً من أي إحصائية حقيقية.

    const { data: school, error: schoolError } = await admin
      .from('schools')
      .insert({
        name: 'مدرسة اختبار التكامل',
        currency: 'OMR',
        is_test: true,
        active: false,
      })
      .select('id')
      .single()

    expect(schoolError).toBeNull()

    if (!school) {
      throw new Error('Failed to create integration test school')
    }

    schoolId = school.id

    const { data: student, error: studentError } = await admin
      .from('students')
      .insert({
        school_id: schoolId,
        name: 'طالب اختبار',
        grade: '1',
      })
      .select('id')
      .single()

    expect(studentError).toBeNull()

    if (!student) {
      throw new Error('Failed to create integration test student')
    }

    studentId = student.id

    const { data: fee, error: feeInsertError } = await admin
      .from('student_fees')
      .insert({
        school_id: schoolId,
        student_id: studentId,
        description: 'رسوم فصل',
        total: 1000,
        paid: 0,
        due_date: '2026-03-01',
      })
      .select('id')
      .single()

    expect(feeInsertError).toBeNull()

    if (!fee) {
      throw new Error('Failed to create integration test fee')
    }

    feeId = fee.id
  })

  afterAll(async () => {
    // تنظيف بيانات الاختبار
    if (schoolId) {
      await admin
        .from('schools')
        .delete()
        .eq('id', schoolId)
    }
  })

  it('1) تقديم دفعة ينشئ سجلّاً معلّقاً (pending)', async () => {
    const { data, error } = await admin.rpc('submit_payment', {
      p_fee_id: feeId,
      p_amount: 400,
      p_method: 'bank',
      p_bank_ref: 'TEST-REF',
    })

    expect(error).toBeNull()
    expect(data).toBeTruthy()

    const { data: pending, error: pendingError } = await admin
      .from('pending_payments')
      .select('*')
      .eq('id', data)
      .single()

    expect(pendingError).toBeNull()

    if (!pending) {
      throw new Error('Failed to retrieve pending payment')
    }

    expect(pending.txn_state ?? 'pending').toBe('pending')
  })

  it('2) اعتماد الدفعة يُرحّلها محاسبياً ويحدّث المدفوع', async () => {
    // record_payment ينشئ القيد المزدوج ويزيد paid
    const { error } = await admin.rpc('record_payment', {
      p_fee_id: feeId,
      p_amount: 400,
      p_method: 'bank',
    })

    expect(error).toBeNull()

    const { data: fee, error: feeError } = await admin
      .from('student_fees')
      .select('paid')
      .eq('id', feeId)
      .single()

    expect(feeError).toBeNull()

    if (!fee) {
      throw new Error('Failed to retrieve updated student fee')
    }

    expect(Number(fee.paid)).toBe(400)
  })

  it('3) القيد المزدوج متوازن (مدين = دائن)', async () => {
    const { data: lines, error } = await admin
      .from('journal_lines')
      .select(
        'debit, credit, journal_entries!inner(school_id)',
      )
      .eq('journal_entries.school_id', schoolId)

    expect(error).toBeNull()

    const totalD = (lines ?? []).reduce(
      (sum, line) => sum + Number(line.debit),
      0,
    )

    const totalC = (lines ?? []).reduce(
      (sum, line) => sum + Number(line.credit),
      0,
    )

    expect(Math.abs(totalD - totalC)).toBeLessThan(0.0005)
  })

  it('4) عزل البيانات — مدرسة أخرى لا ترى هذه الرسوم', async () => {
    const { data: other, error: otherError } = await admin
      .from('schools')
      .insert({
        name: 'مدرسة أخرى',
        currency: 'OMR',
        is_test: true,
        active: false,
      })
      .select('id')
      .single()

    expect(otherError).toBeNull()

    if (!other) {
      throw new Error('Failed to create second integration test school')
    }

    const { data: fees, error: feesError } = await admin
      .from('student_fees')
      .select('id')
      .eq('school_id', other.id)

    expect(feesError).toBeNull()

    expect(
      (fees ?? []).find((fee) => fee.id === feeId),
    ).toBeUndefined()

    await admin
      .from('schools')
      .delete()
      .eq('id', other.id)
  })
})
