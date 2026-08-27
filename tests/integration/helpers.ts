// أدوات مساعدة مشتركة للاختبارات التكاملية —
// تُنشئ عميل Supabase بصلاحية الخدمة (service role) للوصول المباشر أثناء الاختبار،
// وتوفّر دوال لإنشاء/تنظيف بيانات اختبار معزولة (مدرسة، طالب، فاتورة) لكل تشغيلة.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

export function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'متغيّرات البيئة مفقودة: NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY مطلوبان لتشغيل الاختبارات التكاملية.\n' +
      'أضفهما في ملف .env.test.local (لا يُرفع لـ GitHub أبداً).'
    )
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

// كل اختبار يعمل داخل "بيئة معزولة" خاصة به: مدرسة اختبار + مستخدم محاسب + طالب + فاتورة.
// نُسمّي كل شيء ببادئة TEST_ فريدة (uuid) حتى يسهل حذفها كاملة بعد كل اختبار،
// ولا تتعارض مع بيانات مدرسة حقيقية أبداً.
export type TestFixture = {
  schoolId: string
  accountantUserId: string
  studentId: string
  feeId: string
  cleanup: () => Promise<void>
}

export async function createTestFixture(sb: SupabaseClient, opts?: { feeTotal?: number }): Promise<TestFixture> {
  const tag = `TEST_${randomUUID().slice(0, 8)}`
  const feeTotal = opts?.feeTotal ?? 100

  // 1) مدرسة اختبار
  const { data: school, error: schoolErr } = await sb
    .from('schools')
    .insert({ name: tag, country: 'OM', currency: 'OMR' })
    .select('id').single()
  if (schoolErr || !school) throw new Error('فشل إنشاء مدرسة الاختبار: ' + schoolErr?.message)

  // 2) دليل حسابات أساسي (1110 نقد، 1120 بنك، 1210 ذمم مدينة/إيراد الرسوم، 5520، 1310)
  //    مطلوب لأن record_payment وinventory_sell يبحثان عن هذه الأكواد بالضبط.
  const accounts = [
    { code: '1110', name: 'الصندوق' },
    { code: '1120', name: 'البنك' },
    { code: '1210', name: 'ذمم الطلاب' },
    { code: '5520', name: 'تكلفة المبيعات' },
    { code: '1310', name: 'المخزون' },
  ]
  for (const a of accounts) {
    await sb.from('accounts').insert({ school_id: school.id, code: a.code, name: a.name })
  }

  // 3) مستخدم محاسب اختبار (auth.users + profiles) — يحتاج صلاحية service role
  const email = `${tag.toLowerCase()}@test.rusoompay.invalid`
  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email, password: randomUUID(), email_confirm: true,
  })
  if (authErr || !authUser.user) throw new Error('فشل إنشاء مستخدم الاختبار: ' + authErr?.message)

  await sb.from('profiles').insert({
    id: authUser.user.id, school_id: school.id, role: 'accountant', full_name: tag,
  })

  // 4) طالب اختبار
  const { data: student, error: stuErr } = await sb
    .from('students').insert({
      school_id: school.id, full_name: `${tag}_Student`, status: 'active', code: tag,
    }).select('id').single()
  if (stuErr || !student) throw new Error('فشل إنشاء طالب الاختبار: ' + stuErr?.message)

  // 5) فاتورة اختبار
  const { data: fee, error: feeErr } = await sb
    .from('student_fees').insert({
      school_id: school.id, student_id: student.id, description: 'رسوم اختبار',
      total: feeTotal, paid: 0, due_date: new Date().toISOString().slice(0, 10),
    }).select('id').single()
  if (feeErr || !fee) throw new Error('فشل إنشاء فاتورة الاختبار: ' + feeErr?.message)

  return {
    schoolId: school.id,
    accountantUserId: authUser.user.id,
    studentId: student.id,
    feeId: fee.id,
    cleanup: async () => {
      // الحذف بالترتيب العكسي لتفادي قيود المفاتيح الأجنبية
      await sb.from('journal_lines').delete().eq('school_id', school.id)
      await sb.from('journal_entries').delete().eq('school_id', school.id)
      await sb.from('payments').delete().eq('school_id', school.id)
      await sb.from('pending_payments').delete().eq('school_id', school.id)
      await sb.from('student_fees').delete().eq('school_id', school.id)
      await sb.from('students').delete().eq('school_id', school.id)
      await sb.from('accounts').delete().eq('school_id', school.id)
      await sb.from('profiles').delete().eq('school_id', school.id)
      await sb.auth.admin.deleteUser(authUser.user.id)
      await sb.from('schools').delete().eq('id', school.id)
    },
  }
}

// يستدعي دالة RPC "كأن" المستخدم هو من ينفّذها — عبر إعداد جلسة مؤقتة.
// ملاحظة: بما أن اختباراتنا تستخدم service role مباشرة (تتجاوز RLS)،
// نستدعي my_school_id/my_role ضمنياً عبر تمرير معاملات الدالة كما تفعل،
// لكن التحقّق من الصلاحيات داخل الدالة نفسها (public.my_role()) يعتمد على auth.uid()
// الذي لا يُحاكى بسهولة عبر service role. لهذا اختبارات "الرفض بسبب الصلاحية"
// تُختبر عبر anon/authenticated client حقيقي، لا service role — انظر rls.test.ts.
export async function callRpc(sb: SupabaseClient, fn: string, args: Record<string, unknown>) {
  return sb.rpc(fn, args)
}
