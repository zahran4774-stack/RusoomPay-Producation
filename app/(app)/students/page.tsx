// صفحة سجل الطلاب — مكوّن خادم
// لاحظ: لا نكتب where school_id — سياسات RLS تُطبّق العزل تلقائياً
// فيستحيل أن يرى مستخدم طلاب مدرسة أخرى حتى لو حاول
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { isStaff, type Role } from '@/lib/roles'
import PrintButton from '../PrintButton'
import LinkParent from './LinkParent'
import StudentsByClass from './StudentsByClass'
import AddStudent from './AddStudent'
import ImportStudents from './ImportStudents'
export default async function StudentsPage() {
  const supabase = await createClient()

  // التحقق من المصادقة
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // سجل الطلاب لطاقم المدرسة فقط (مدير/إداري/محاسب) — لا ولي الأمر أو الطالب
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const { data: __myRole } = await supabase.rpc('my_role')
  if (!isStaff((__myRole ?? profile?.role) as Role)) redirect('/dashboard')

  // هوية المدرسة (لترويسة التقرير)
  const { data: school } = await supabase.from('schools').select('name, vat_number').single()

  // جلب الطلاب — RLS يقصرها على مدرسة المستخدم تلقائياً
  const { data: students, error } = await supabase
    .from('students')
    .select('id, code, full_name, grade, section, guardian_name, guardian_phone, guardian_email, birth_date, gender, status')
    .order('code')

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }} dir="rtl">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ color: '#0F2744', marginBottom: 4 }}>سجل الطلاب</h1>
          <p style={{ color: '#667', fontSize: 14, marginBottom: 20 }}>
            كل البيانات معزولة آمنياً — ترى طلاب مدرستك فقط
          </p>
        </div>
        <PrintButton
          school={{ name: school?.name ?? 'مدرسة', vat: school?.vat_number ?? null }}
          title="قائمة الطلاب"
          subtitle="مرتّبة حسب الصف والشعبة"
          columns={[
            { key: 'code', label: 'الرقم' },
            { key: 'name', label: 'الطالب' },
            { key: 'grade', label: 'الصف' },
            { key: 'section', label: 'الشعبة' },
            { key: 'guardian', label: 'ولي الأمر' },
            { key: 'status', label: 'الحالة' },
          ]}
          rows={[...(students ?? [])]
            .sort((a, b) => (a.grade + (a.section ?? '')).localeCompare(b.grade + (b.section ?? ''), 'ar'))
            .map((s) => ({
              code: s.code, name: s.full_name, grade: s.grade, section: s.section ?? '—',
              guardian: s.guardian_name ?? '—', status: s.status === 'active' ? 'نشط' : s.status,
            }))}
          label="🖨 طباعة قائمة الطلاب"
        />
      </div>

      {error && <div style={{ color: '#C0392B' }}>تعذّر جلب البيانات: {error.message}</div>}

     <div style={{ marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
<AddStudent />
<ImportStudents />
</div>

      <LinkParent students={(students ?? []).map((s) => ({ id: s.id, full_name: s.full_name, code: s.code }))} />

      <div style={{ marginTop: 18 }}>
        <StudentsByClass
          students={students ?? []}
          school={{ name: school?.name ?? 'مدرسة', vat: school?.vat_number ?? null }}
        />
      </div>
    </div>
  )
}
