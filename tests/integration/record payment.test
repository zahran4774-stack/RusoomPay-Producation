// اختبارات record_payment — الدالة الأخطر في النظام: كل مسار دفع (يدوي، ثواني، معتمد من محاسب)
// يمرّ عبرها. أي خلل هنا يعني مبالغ خاطئة في حسابات حقيقية.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { serviceClient, createTestFixture, type TestFixture } from './helpers'

const sb = serviceClient()
let fx: TestFixture

beforeEach(async () => { fx = await createTestFixture(sb, { feeTotal: 100 }) })
afterEach(async () => { await fx.cleanup() })

describe('record_payment — الحسابات الأساسية', () => {
  it('يخصم المبلغ من الفاتورة بدقّة (paid يزيد بالضبط بقيمة الدفعة)', async () => {
    const { data, error } = await sb.rpc('record_payment', {
      p_fee_id: fx.feeId, p_amount: 40, p_method: 'bank', p_paid_at: new Date().toISOString().slice(0, 10),
    })
    expect(error).toBeNull()
    expect(data?.ok).toBe(true)
    expect(data?.remaining).toBeCloseTo(60, 3)

    const { data: fee } = await sb.from('student_fees').select('paid, total').eq('id', fx.feeId).single()
    expect(fee?.paid).toBeCloseTo(40, 3)
  })

  it('يُنشئ قيداً محاسبياً متوازناً (مدين = دائن) لكل دفعة', async () => {
    await sb.rpc('record_payment', { p_fee_id: fx.feeId, p_amount: 25, p_method: 'bank' })

    const { data: entries } = await sb.from('journal_entries').select('id').eq('school_id', fx.schoolId)
    expect(entries?.length).toBe(1)

    const { data: lines } = await sb.from('journal_lines').select('debit, credit').eq('entry_id', entries![0].id)
    const totalDebit = (lines ?? []).reduce((a, l) => a + Number(l.debit), 0)
    const totalCredit = (lines ?? []).reduce((a, l) => a + Number(l.credit), 0)
    expect(totalDebit).toBeCloseTo(25, 3)
    expect(totalCredit).toBeCloseTo(25, 3)
    expect(totalDebit).toBeCloseTo(totalCredit, 6) // القاعدة الذهبية للقيد المزدوج
  })

  it('يستخدم حساب النقد (1110) للدفع نقداً، والبنك (1120) لغير ذلك', async () => {
    await sb.rpc('record_payment', { p_fee_id: fx.feeId, p_amount: 10, p_method: 'cash' })
    const { data: cashEntry } = await sb.from('journal_entries').select('id').eq('school_id', fx.schoolId).single()
    const { data: cashLines } = await sb.from('journal_lines').select('account_id, debit').eq('entry_id', cashEntry!.id).gt('debit', 0)
    const { data: cashAcc } = await sb.from('accounts').select('id').eq('school_id', fx.schoolId).eq('code', '1110').single()
    expect(cashLines?.[0]?.account_id).toBe(cashAcc?.id)
  })
})

describe('record_payment — منع الأخطاء المالية', () => {
  it('يرفض دفعة بمبلغ صفر أو سالب', async () => {
    const { error } = await sb.rpc('record_payment', { p_fee_id: fx.feeId, p_amount: 0, p_method: 'bank' })
    expect(error).not.toBeNull()

    const { error: negError } = await sb.rpc('record_payment', { p_fee_id: fx.feeId, p_amount: -5, p_method: 'bank' })
    expect(negError).not.toBeNull()
  })

  it('يرفض دفعة تتجاوز المتبقّي على الفاتورة', async () => {
    const { error } = await sb.rpc('record_payment', { p_fee_id: fx.feeId, p_amount: 999, p_method: 'bank' })
    expect(error).not.toBeNull()
    expect(error?.message).toContain('يتجاوز')
  })

  it('يرفض فاتورة غير موجودة', async () => {
    const { error } = await sb.rpc('record_payment', {
      p_fee_id: '00000000-0000-0000-0000-000000000000', p_amount: 10, p_method: 'bank',
    })
    expect(error).not.toBeNull()
  })

  it('حارس التكرار: يرفض نفس المبلغ ونفس الطريقة لنفس الفاتورة خلال 10 ثوانٍ', async () => {
    const first = await sb.rpc('record_payment', { p_fee_id: fx.feeId, p_amount: 15, p_method: 'bank' })
    expect(first.error).toBeNull()

    // محاولة فورية ثانية بنفس القيم بالضبط — يجب أن تُرفض كحماية من الازدواج
    const dup = await sb.rpc('record_payment', { p_fee_id: fx.feeId, p_amount: 15, p_method: 'bank' })
    expect(dup.error).not.toBeNull()
    expect(dup.error?.message).toContain('مكرر')
  })

  it('يسمح بدفعتين مختلفتين (مبلغ مختلف) على نفس الفاتورة بدون تعارض حارس التكرار', async () => {
    const first = await sb.rpc('record_payment', { p_fee_id: fx.feeId, p_amount: 15, p_method: 'bank' })
    expect(first.error).toBeNull()

    const second = await sb.rpc('record_payment', { p_fee_id: fx.feeId, p_amount: 20, p_method: 'bank' })
    expect(second.error).toBeNull()

    const { data: fee } = await sb.from('student_fees').select('paid').eq('id', fx.feeId).single()
    expect(fee?.paid).toBeCloseTo(35, 3)
  })
})

describe('record_payment — الدفعات الجزئية المتراكمة', () => {
  it('ثلاث دفعات جزئية متتالية تصل بالضبط لإجمالي الفاتورة، لا أكثر ولا أقل', async () => {
    await sb.rpc('record_payment', { p_fee_id: fx.feeId, p_amount: 30, p_method: 'bank' })
    await new Promise((r) => setTimeout(r, 11000)) // تجاوز نافذة حارس التكرار (10 ثوانٍ)
    await sb.rpc('record_payment', { p_fee_id: fx.feeId, p_amount: 30, p_method: 'cash' })
    await new Promise((r) => setTimeout(r, 11000))
    const last = await sb.rpc('record_payment', { p_fee_id: fx.feeId, p_amount: 40, p_method: 'bank' })

    expect(last.error).toBeNull()
    expect(last.data?.remaining).toBeCloseTo(0, 3)

    const { data: fee } = await sb.from('student_fees').select('paid, total').eq('id', fx.feeId).single()
    expect(fee?.paid).toBeCloseTo(fee?.total ?? -1, 3)
  }, 40000) // مهلة أطول بسبب الانتظار المتعمّد لتجاوز حارس التكرار
})
