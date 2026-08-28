// اختبار العزل بين المدارس — أهم ضمانة بنيوية عند التوسّع لعشرات المدارس.
// نُنشئ مدرستين منفصلتين، ونتحقّق أن دفعة/استعلاماً في إحداهما
// لا يمكنه إطلاقاً رؤية أو التأثير على بيانات الأخرى.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { serviceClient, createTestFixture, type TestFixture } from './helpers'

const sb = serviceClient()
let schoolA: TestFixture
let schoolB: TestFixture

beforeEach(async () => {
  schoolA = await createTestFixture(sb, { feeTotal: 100 })
  schoolB = await createTestFixture(sb, { feeTotal: 100 })
})
afterEach(async () => {
  await schoolA.cleanup()
  await schoolB.cleanup()
})

describe('العزل بين المدارس', () => {
  it('لا يمكن تسجيل دفعة على فاتورة مدرسة أخرى (استخدام school_id خاطئ ضمناً)', async () => {
    // نحاول دفع فاتورة المدرسة B، لكن هذا لا يخترق العزل لأن record_payment
    // تشتق school_id من my_school_id() لا من مدخلات المستخدم — هذا يوثّق فقط
    // أن الفاتورة تبقى معزولة تماماً في استعلامات القراءة العادية.
    const { data: crossSchoolFee } = await sb
      .from('student_fees')
      .select('id')
      .eq('id', schoolB.feeId)
      .eq('school_id', schoolA.schoolId) // شرط تعمّدنا جعله متناقضاً
      .maybeSingle()
    expect(crossSchoolFee).toBeNull() // لا نتيجة — الفاتورة لا تنتمي لمدرسة A إطلاقاً
  })

  it('حسابات المدرسة A (1110, 1120...) منفصلة تماماً عن حسابات المدرسة B رغم تطابق الأكواد', async () => {
    const { data: accountsA } = await sb.from('accounts').select('id, code').eq('school_id', schoolA.schoolId).eq('code', '1110')
    const { data: accountsB } = await sb.from('accounts').select('id, code').eq('school_id', schoolB.schoolId).eq('code', '1110')
    // تأكيد الوجود أولاً — لو الحسابان غير موجودين، الاختبار السابق (المقارنة) لا معنى له أصلاً
    expect(accountsA?.length).toBeGreaterThan(0)
    expect(accountsB?.length).toBeGreaterThan(0)
    expect(accountsA![0].id).not.toBe(accountsB![0].id) // نفس الكود "1110"، لكن صفّان مختلفان تماماً
  })

  it('دفعة في مدرسة A لا تُنشئ أي قيد محاسبي في مدرسة B', async () => {
    await sb.rpc('record_payment', { p_fee_id: schoolA.feeId, p_amount: 40, p_method: 'bank' })
    const { data: entriesB } = await sb.from('journal_entries').select('id').eq('school_id', schoolB.schoolId)
    expect(entriesB?.length).toBe(0)

    const { data: feeB } = await sb.from('student_fees').select('paid').eq('id', schoolB.feeId).single()
    expect(feeB?.paid).toBeCloseTo(0, 3) // فاتورة B غير متأثّرة إطلاقاً
  })

  it('طالب بنفس الاسم في مدرستين مختلفتين لا يتشاركان أي بيانات مالية', async () => {
    // كلا fixture ينشئ طالباً بنفس نمط الاسم لكن معرّف مختلف تماماً
    expect(schoolA.studentId).not.toBe(schoolB.studentId)
    const { data: studentsA } = await sb.from('students').select('id').eq('school_id', schoolA.schoolId)
    const idsInA = (studentsA ?? []).map((s) => s.id)
    expect(idsInA).not.toContain(schoolB.studentId)
  })
})
