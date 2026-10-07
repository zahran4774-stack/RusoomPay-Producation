// بوابة ولي الأمر: تقديم دفعة، حدود الإدراج المباشر في pending_payments، وحجب أرقام المدرسة عن الولي.
// يحلّ محل payment-flow.test.ts القديم (كان يستخدم أعمدة غير موجودة ويعمل بصلاحية الخدمة فلا يمثّل المستخدم الحقيقي).
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceClient, createTestFixture, anonClient, type TestFixture } from './helpers'

const sb = serviceClient()
let fx: TestFixture
let parentId: string
let parent: SupabaseClient

async function makeParent(link: boolean) {
  const email = `parent_${randomUUID().slice(0, 8)}@test.rusoompay.invalid`
  const password = randomUUID()
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw new Error('parent user: ' + error?.message)
  await sb.from('profiles').insert({ id: data.user.id, school_id: fx.schoolId, role: 'parent', full_name: 'Parent T' })
  if (link) {
    const { error: lerr } = await sb.from('parent_students').insert({
      school_id: fx.schoolId, parent_id: data.user.id, student_id: fx.studentId,
    })
    if (lerr) throw new Error('link: ' + lerr.message)
  }
  const client = anonClient()
  const { error: sErr } = await client.auth.signInWithPassword({ email, password })
  if (sErr) throw new Error('parent sign-in: ' + sErr.message)
  return { id: data.user.id, client }
}

beforeEach(async () => {
  fx = await createTestFixture(sb, { feeTotal: 100 })
  const p = await makeParent(true)
  parentId = p.id
  parent = p.client
})

afterEach(async () => {
  await sb.from('pending_payments').delete().eq('school_id', fx.schoolId)
  await sb.from('parent_students').delete().eq('school_id', fx.schoolId)
  await sb.from('profiles').delete().eq('id', parentId)
  await sb.auth.admin.deleteUser(parentId)
  await fx.cleanup()
})

describe('submit_payment — ولي الأمر', () => {
  it('ولي أمر مرتبط يقدّم دفعة بنكية فتُنشأ دفعة معلّقة', async () => {
    const { data, error } = await parent.rpc('submit_payment', {
      p_fee_id: fx.feeId, p_amount: 40, p_method: 'bank', p_bank_ref: 'REF-1',
    })
    expect(error).toBeNull()
    const { data: pp } = await sb.from('pending_payments').select('status, txn_state, amount').eq('id', data).single()
    expect(pp?.status).toBe('pending')
    expect(Number(pp?.amount)).toBe(40)
  })

  it('يرفض مبلغاً أكبر من المتبقي', async () => {
    const { error } = await parent.rpc('submit_payment', {
      p_fee_id: fx.feeId, p_amount: 500, p_method: 'bank', p_bank_ref: 'REF-2',
    })
    expect(error).not.toBeNull()
  })

  it('ولي أمر غير مرتبط بالطالب لا يستطيع الدفع عن فاتورته', async () => {
    const other = await makeParent(false)
    try {
      const { error } = await other.client.rpc('submit_payment', {
        p_fee_id: fx.feeId, p_amount: 10, p_method: 'bank', p_bank_ref: 'REF-3',
      })
      expect(error).not.toBeNull()
      expect(error?.message).toContain('لا تخص')
    } finally {
      await sb.from('profiles').delete().eq('id', other.id)
      await sb.auth.admin.deleteUser(other.id)
    }
  })
})

describe('pending_payments — الإدراج المباشر', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    school_id: fx.schoolId, fee_id: fx.feeId, guardian_id: parentId,
    amount: 10, method: 'thawani', status: 'pending', txn_state: 'pending', ...over,
  })

  it('يقبل صفاً عادياً (pending/pending بمبلغ موجب)', async () => {
    const { error } = await parent.from('pending_payments').insert(row())
    expect(error).toBeNull()
  })

  it('يرفض status=approved أو txn_state=paid', async () => {
    const a = await parent.from('pending_payments').insert(row({ status: 'approved' }))
    expect(a.error).not.toBeNull()
    const b = await parent.from('pending_payments').insert(row({ txn_state: 'paid' }))
    expect(b.error).not.toBeNull()
  })

  it('يرفض مبلغاً سالباً أو صفراً', async () => {
    const a = await parent.from('pending_payments').insert(row({ amount: -5 }))
    expect(a.error).not.toBeNull()
    const b = await parent.from('pending_payments').insert(row({ amount: 0 }))
    expect(b.error).not.toBeNull()
  })

  it('يرفض إدراجاً باسم ولي أمر آخر', async () => {
    const { error } = await parent.from('pending_payments').insert(row({ guardian_id: fx.accountantUserId }))
    expect(error).not.toBeNull()
  })
})

describe('أرقام المدرسة محجوبة عن ولي الأمر', () => {
  it('school_copilot ممنوعة على ولي الأمر ومسموحة للمحاسب', async () => {
    const p = await parent.rpc('school_copilot')
    expect(p.error).not.toBeNull()
    const a = await fx.asAccountant.rpc('school_copilot')
    expect(a.error).toBeNull()
  })

  it('assistant_context لا يعيد بيانات المدرسة لولي الأمر', async () => {
    const { data, error } = await parent.rpc('assistant_context')
    expect(error).toBeNull()
    expect(data?.data ?? null).toBeNull()
  })

  it('ولي الأمر لا يرى إلا أبناءه ولا يقرأ جدول المحاسبة', async () => {
    const stu = await parent.from('students').select('id')
    expect((stu.data ?? []).map((s) => s.id)).toEqual([fx.studentId])
    const jl = await parent.from('journal_lines').select('id')
    expect((jl.data ?? []).length).toBe(0)
  })
})
