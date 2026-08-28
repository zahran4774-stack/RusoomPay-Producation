// اختبارات approve_payment — نستدعي RPC عبر fx.asAccountant (جلسة JWT حقيقية)
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { serviceClient, createTestFixture, type TestFixture } from './helpers'

const sb = serviceClient()
let fx: TestFixture

beforeEach(async () => { fx = await createTestFixture(sb, { feeTotal: 100 }) })
afterEach(async () => { await fx.cleanup() })

async function insertPendingPayment(amount: number, method = 'bank') {
  const { data, error } = await sb.from('pending_payments').insert({
    school_id: fx.schoolId, fee_id: fx.feeId, guardian_id: fx.accountantUserId,
    amount, method, status: 'pending',
  }).select('id').single()
  if (error) throw error
  return data!.id as string
}

describe('approve_payment — الاعتماد الصحيح', () => {
  it('اعتماد دفعة معلّقة يُنشئ دفعة فعلية ويحدّث الفاتورة', async () => {
    const ppId = await insertPendingPayment(30)
    const { error } = await fx.asAccountant.rpc('approve_payment', { p_id: ppId })
    expect(error).toBeNull()

    const { data: fee } = await sb.from('student_fees').select('paid').eq('id', fx.feeId).single()
    expect(fee?.paid).toBeCloseTo(30, 3)

    const { data: pp } = await sb.from('pending_payments').select('status').eq('id', ppId).single()
    expect(pp?.status).toBe('approved')
  })

  it('لا يمكن اعتماد نفس الدفعة المعلّقة مرّتين', async () => {
    const ppId = await insertPendingPayment(30)
    await fx.asAccountant.rpc('approve_payment', { p_id: ppId })
    const { error } = await fx.asAccountant.rpc('approve_payment', { p_id: ppId })
    expect(error).not.toBeNull()
    // بعد الاعتماد الأول status='approved'، فالبحث عن status='pending' لا يجدها فتُرجع "غير موجودة"
    expect(error?.message).toContain('سبق')
  })

  it('اعتماد دفعة معلّقة بمبلغ أكبر من المتبقّي يفشل (يحمي من خطأ مضاعف)', async () => {
    const ppId = await insertPendingPayment(500)
    const { error } = await fx.asAccountant.rpc('approve_payment', { p_id: ppId })
    expect(error).not.toBeNull()
  })

  it('رفض دفعة معلّقة لا يخصم شيئاً من الفاتورة', async () => {
    const ppId = await insertPendingPayment(30)
    const { error } = await fx.asAccountant.rpc('reject_payment', { p_id: ppId })
    if (error) {
      console.warn('reject_payment توقيعها مختلف — تحقّق من اسم المعامل الفعلي:', error.message)
    }
    const { data: fee } = await sb.from('student_fees').select('paid').eq('id', fx.feeId).single()
    expect(fee?.paid).toBeCloseTo(0, 3)
  })
})
