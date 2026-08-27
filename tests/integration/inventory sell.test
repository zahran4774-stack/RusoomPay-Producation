// اختبارات inventory_sell — تشمل خيار الضريبة الذي أضفناه هذه الجلسة.
// نتحقّق تحديداً أن "بدون ضريبة" يُنتج نفس السلوك القديم بالضبط (لا انحراف عن السابق).
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { serviceClient, createTestFixture, type TestFixture } from './helpers'

const sb = serviceClient()
let fx: TestFixture
let itemId: string

beforeEach(async () => {
  fx = await createTestFixture(sb)
  const { data: item } = await sb.from('inventory_items').insert({
    school_id: fx.schoolId, name: 'زي مدرسي - اختبار', price: 10, cost: 6, qty: 20, vat_rate: 5,
  }).select('id').single()
  itemId = item!.id
})
afterEach(async () => {
  await sb.from('inventory_items').delete().eq('id', itemId)
  await fx.cleanup()
})

describe('inventory_sell — حساب الضريبة', () => {
  it('مع ضريبة: الفاتورة = (الكمية × السعر) + 5%', async () => {
    const { error } = await sb.rpc('inventory_sell', {
      p_item: itemId, p_qty: 3, p_student: fx.studentId, p_apply_tax: true,
    })
    expect(error).toBeNull()

    const { data: fee } = await sb.from('student_fees')
      .select('total').eq('student_id', fx.studentId).order('created_at', { ascending: false }).limit(1).single()
    expect(fee?.total).toBeCloseTo(3 * 10 * 1.05, 3) // 31.5
  })

  it('بدون ضريبة: الفاتورة = الكمية × السعر فقط (يطابق السلوك القديم قبل هذا التعديل)', async () => {
    const { error } = await sb.rpc('inventory_sell', {
      p_item: itemId, p_qty: 3, p_student: fx.studentId, p_apply_tax: false,
    })
    expect(error).toBeNull()

    const { data: fee } = await sb.from('student_fees')
      .select('total').eq('student_id', fx.studentId).order('created_at', { ascending: false }).limit(1).single()
    expect(fee?.total).toBeCloseTo(30, 3) // بلا أي ضريبة
  })

  it('p_apply_tax الافتراضي (بلا تمريره) = true — يحافظ على التوافق مع أي كود قديم يستدعيها بلا هذا المعامل', async () => {
    const { error } = await sb.rpc('inventory_sell', { p_item: itemId, p_qty: 2, p_student: fx.studentId })
    expect(error).toBeNull()
    const { data: fee } = await sb.from('student_fees')
      .select('total').eq('student_id', fx.studentId).order('created_at', { ascending: false }).limit(1).single()
    expect(fee?.total).toBeCloseTo(2 * 10 * 1.05, 3)
  })

  it('قيد التكلفة (COGS) لا يتأثّر بخيار الضريبة — يبقى بسعر التكلفة الصافي دائماً', async () => {
    await sb.rpc('inventory_sell', { p_item: itemId, p_qty: 4, p_student: fx.studentId, p_apply_tax: true })
    const { data: entry } = await sb.from('journal_entries').select('id').eq('school_id', fx.schoolId).single()
    const { data: lines } = await sb.from('journal_lines').select('debit, credit').eq('entry_id', entry!.id)
    const debit = (lines ?? []).reduce((a, l) => a + Number(l.debit), 0)
    expect(debit).toBeCloseTo(4 * 6, 3) // 24 = الكمية × التكلفة (6)، لا علاقة للضريبة هنا
  })
})

describe('inventory_sell — حدود المخزون', () => {
  it('يرفض بيع كمية أكبر من الرصيد المتاح', async () => {
    const { error } = await sb.rpc('inventory_sell', { p_item: itemId, p_qty: 999, p_student: fx.studentId })
    expect(error).not.toBeNull()
  })

  it('ينقص الكمية من المخزون بالضبط بعدد القطع المباعة', async () => {
    await sb.rpc('inventory_sell', { p_item: itemId, p_qty: 5, p_student: fx.studentId })
    const { data: item } = await sb.from('inventory_items').select('qty').eq('id', itemId).single()
    expect(item?.qty).toBe(15) // 20 - 5
  })
})
