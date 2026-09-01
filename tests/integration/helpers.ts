// أدوات مساعدة مشتركة للاختبارات التكاملية —
// تُنشئ عميل Supabase بصلاحية الخدمة (service role) لإعداد/تنظيف بيانات الاختبار،
// وعميلاً آخر بجلسة مستخدم حقيقية (JWT) لاستدعاء دوال RPC —
// لأن الدوال مثل record_payment تعتمد داخلياً على my_school_id()/my_role()
// المبنيّتين على auth.uid()، وهذا غير متاح عبر service_role مباشرة.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

export function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'متغيّرات البيئة مفقودة: NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY مطلوبان لتشغيل الاختبارات التكاملية.'
    )
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

// عميل عادي (anon key) — نستخدمه لاحقاً لتسجيل دخول المحاسب الوهمي بجلسة JWT حقيقية
function anonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY مطلوب أيضاً لإنشاء جلسات اختبار حقيقية.')
  }
  return createClient(url, anonKey, { auth: { persistSession: false } })
}

export type TestFixture = {
  schoolId: string
  accountantUserId: string
  studentId: string
  feeId: string
  password: string
  email: string
  // عميل بجلسة المحاسب الحقيقية — استخدمه لاستدعاء RPC (record_payment، إلخ)
  asAccountant: SupabaseClient
  cleanup: () => Promise<void>
}

export async function createTestFixture(sb: SupabaseClient, opts?: { feeTotal?: number }): Promise<TestFixture> {
  const tag = `TEST_${randomUUID().slice(0, 8)}`
  const feeTotal = opts?.feeTotal ?? 100
  const password = randomUUID()
  const email = `${tag.toLowerCase()}@test.rusoompay.invalid`

  // 1) مدرسة اختبار — is_test=true من البداية عشان تُستثنى فوراً من أي إحصائية حقيقية
  // (لوحة التحكم، عدد المدارس، إلخ) حتى قبل أي تنظيف لاحق.
  const { data: school, error: schoolErr } = await sb
    .from('schools')
    .insert({ name: tag, country: 'OM', currency: 'OMR', is_test: true, active: false })
    .select('id').single()
  if (schoolErr || !school) throw new Error('فشل إنشاء مدرسة الاختبار: ' + schoolErr?.message)

  // 2) دليل حسابات أساسي
  // type إلزامي (NOT NULL) — القيم مطابقة تماماً لما هو مستخدم فعلياً في حساباتك الحقيقية
  const accounts = [
    { code: '1110', name: 'الصندوق', type: 'asset' },
    { code: '1120', name: 'البنك', type: 'asset' },
    { code: '1210', name: 'ذمم الطلاب', type: 'asset' },
    { code: '1310', name: 'المخزون', type: 'asset' },
    { code: '5520', name: 'تكلفة المبيعات', type: 'expense' },
  ]
  for (const a of accounts) {
    const { error: accErr } = await sb.from('accounts').insert({ school_id: school.id, code: a.code, name: a.name, type: a.type })
    if (accErr) throw new Error(`فشل إنشاء حساب ${a.code}: ${accErr.message}`)
  }

  // 3) مستخدم محاسب اختبار — بريد مؤكَّد + كلمة مرور معروفة لنا لتسجيل الدخول لاحقاً
  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (authErr || !authUser.user) throw new Error('فشل إنشاء مستخدم الاختبار: ' + authErr?.message)

  await sb.from('profiles').insert({
    id: authUser.user.id, school_id: school.id, role: 'accountant', full_name: tag,
  })

  // 4) طالب اختبار
  const { data: student, error: stuErr } = await sb
    .from('students').insert({
      school_id: school.id, full_name: `${tag}_Student`, status: 'active', code: tag, grade: 'الأول',
    }).select('id').single()
  if (stuErr || !student) throw new Error('فشل إنشاء طالب الاختبار: ' + stuErr?.message)

  // 5) فاتورة اختبار
  const { data: fee, error: feeErr } = await sb
    .from('student_fees').insert({
      school_id: school.id, student_id: student.id, description: 'رسوم اختبار',
      total: feeTotal, paid: 0, due_date: new Date().toISOString().slice(0, 10),
    }).select('id').single()
  if (feeErr || !fee) throw new Error('فشل إنشاء فاتورة الاختبار: ' + feeErr?.message)

  // 6) جلسة حقيقية للمحاسب — عميل منفصل، auth.uid() سيكون صحيحاً فيه فعلياً
  const accClient = anonClient()
  const { error: signInErr } = await accClient.auth.signInWithPassword({ email, password })
  if (signInErr) throw new Error('فشل تسجيل دخول المحاسب الوهمي: ' + signInErr.message)

  return {
    schoolId: school.id,
    accountantUserId: authUser.user.id,
    studentId: student.id,
    feeId: fee.id,
    email,
    password,
    asAccountant: accClient,
    cleanup: async () => {
      // ملاحظة مهمة: القيود المحاسبية (journal_entries/journal_lines) محميّة عمداً
      // بحارس block_journal_mutation — لا تُحذف ولا تُعدَّل أبداً، حتى لبيانات الاختبار.
      // هذا سلوك صحيح ومقصود لحماية بياناتك الحقيقية. كل خطوة هنا "أفضل محاولة" —
      // فشل خطوة (لوجود قيد محاسبي مرتبط) ما يوقف باقي التنظيف.
      await sb.from('notifications').delete().eq('guardian_id', authUser.user.id)
      await sb.from('payments').delete().eq('school_id', school.id)
      await sb.from('pending_payments').delete().eq('school_id', school.id)
      await sb.from('student_fees').delete().eq('school_id', school.id)
      await sb.from('students').delete().eq('school_id', school.id)
      await sb.from('accounts').delete().eq('school_id', school.id)
      const { error: profileDelErr } = await sb.from('profiles').delete().eq('id', authUser.user.id)

      // نحاول حذف المدرسة فعلياً (أغلب الاختبارات ما تصل لمرحلة تنشئ فيها قيداً محاسبياً).
      // فقط إذا فشل الحذف بسبب قيد محاسبي مرتبط، نعزلها بإعادة التسمية بدلاً من تركها معلّقة.
      const { error: schoolDelErr } = await sb.from('schools').delete().eq('id', school.id)
      if (schoolDelErr) {
        await sb.from('schools').update({ name: 'ARCHIVED_' + tag }).eq('id', school.id)
      }

      // محاولة أخيرة لحذف مستخدم الاختبار — تُتجاهل بصمت لو فشلت (يعني بروفايله
      // ما زال مرتبطاً بقيد محاسبي created_by، وهذا يعني قيداً حقيقياً محمياً بحق).
      if (!profileDelErr && !schoolDelErr) {
        await sb.auth.admin.deleteUser(authUser.user.id)
      }
    },
  }
}

export async function callRpc(sb: SupabaseClient, fn: string, args: Record<string, unknown>) {
  return sb.rpc(fn, args)
}
