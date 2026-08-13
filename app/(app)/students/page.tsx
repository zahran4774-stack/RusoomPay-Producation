// صفحة سجل الطلاب — مكوّن خادم
// لا نكتب where school_id — سياسات RLS تُطبّق العزل تلقائياً.
// تحسين الأداء: الاستعلامات المستقلّة تُنفَّذ متوازية (Promise.all).
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { isStaff, isOwner, type Role } from '@/lib/roles'
import PrintButton from '../PrintButton'
import LinkParent from './LinkParent'
import StudentsByClass from './StudentsByClass'
import AddStudent from './AddStudent'
import { buildSectionOptions } from '@/lib/academic'
import ImportStudents from './ImportStudents'
import PromoteStudents from './PromoteStudents'
import InviteParents from './InviteParents'

export default async function StudentsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ═══ كل الاستعلامات المستقلّة معاً — بدل أربع رحلات متتابعة ═══
  const [
    { data: profile },
    { data: myRole },
    { data: school },
    { data: students, error },
  ] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.rpc('my_role'),
    supabase.from('schools').select('name, vat_number, section_styles').single(),
    supabase.from('students')
      .select('id, code, full_name, grade, section, guardian_name, guardian_phone, guardian_email, birth_date, gender, status')
      // ⚠️ إصلاح: بدون هذا الفلتر، الطلاب المحذوفين بصمت (soft_delete لا يغيّر
      // status، فتبقى 'active') كانوا يظهرون بقائمة الطلاب كأنهم حقيقيون —
      // اكتُشف عبر تناقض بين هذي الصفحة (32) وشاشة الاشتراك (2 فعلياً)
      .is('deleted_at', null)
      .order('code'),
      // لا نضع .limit() هنا: أي سقف على هذا الاستعلام يعني قطع طلاب حقيقيين
      // بصمت (خارج الصفحة، خارج الطباعة، خارج البحث) بدون أي رسالة خطأ توضّح
      // السبب — أخطر من مشكلة الأداء الأصلية. التنبيه أدناه (عدّاد فعلي بعد
      // الجلب) يحذّر دون أن يُسقط أي بيانات.
  ])

  // التحقّق من الصلاحية بعد الجلب (الجلب المتوازي أسرع من التحقّق المتسلسل)
  const role = (myRole ?? profile?.role) as Role
  if (!isStaff(role)) redirect('/dashboard')
  const sectionOptions = buildSectionOptions(school?.section_styles)

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

      {(students?.length ?? 0) >= 1500 && (
        <div style={{ background: '#FFF8E7', border: '1.5px solid #F0DFA8', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#8A6D1D' }}>
          ⚠️ عدد الطلاب ({students!.length}) صار كبيراً بما يكفي ليبدأ يؤثر على سرعة
          تحميل هذه الصفحة. لا يوجد فقدان بيانات — كل الطلاب معروضون بلا استثناء —
          لكن يُنصح بترقيم حقيقي للصفحة قريباً بدل الاعتماد على جلب الكل دفعة واحدة.
        </div>
      )}

      <div style={{ marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <AddStudent />

        <ImportStudents />
        <div id="invite-parents" style={{ scrollMarginTop: 80 }}>
          <InviteParents schoolName={school?.name ?? undefined} />
        </div>
        {isOwner(role) && (
          <PromoteStudents
            students={(students ?? []).map((s) => ({
              id: s.id, code: s.code, full_name: s.full_name,
              grade: s.grade, section: s.section, status: s.status,
            }))}
          />
        )}
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
