// صفحة الرسوم والفواتير — مكوّن خادم
// يجلب الطلاب مع بنود رسومهم + هوية المدرسة (للفواتير)
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import FeesManager from './FeesManager'
import BankSettings from './BankSettings'
import PendingPayments from './PendingPayments'
import FocusScroller from '../FocusScroller'
import RiskIndicator from './RiskIndicator'
import PrintButton from '../PrintButton'
import { isOwner, type Role } from '@/lib/roles'

export default async function FeesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // الدور (لإظهار إعدادات الحساب البنكي للمدير فقط)
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? 'admin'

  // هوية المدرسة + الحساب البنكي (تظهر في الفواتير — لا شعار المنصة)
  const { data: school } = await supabase
    .from('schools')
    .select('name, branch, currency, cr_number, moe_license, vat_number, phone, email, address, logo_url, color, bank_name, bank_account, bank_iban, bank_holder, bank_enabled')
    .single()

  // الطلاب مع بنود الرسوم (RLS يقصرها على المدرسة)
  const { data: students } = await supabase
    .from('students')
    .select('id, code, full_name, grade, section, student_fees(id, description, total, paid, due_date)')
    .order('code')

  // الدفعات المعلّقة بانتظار اعتماد المحاسب
  const { data: pending } = await supabase.rpc('pending_payments_list')

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }} dir="rtl">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ color: '#0F2744', marginBottom: 4 }}>الرسوم والفواتير</h1>
          <p style={{ color: '#667', fontSize: 14, marginBottom: 20 }}>
            لكل بند رسوم فاتورة منفصلة تحمل هوية مدرستك
          </p>
        </div>
        <PrintButton
          school={{ name: school?.name ?? 'مدرسة', vat: school?.vat_number }}
          title="تقرير الفواتير والتحصيل"
          columns={[
            { key: 'student', label: 'الطالب' },
            { key: 'desc', label: 'البند' },
            { key: 'total', label: 'الإجمالي' },
            { key: 'paid', label: 'المحصّل' },
            { key: 'remain', label: 'المتبقي' },
            { key: 'status', label: 'الحالة' },
          ]}
          rows={(students ?? []).flatMap((s) =>
            (s.student_fees ?? []).map((fee) => {
              const remain = (fee.total ?? 0) - (fee.paid ?? 0)
              return {
                student: s.full_name, desc: fee.description,
                total: (fee.total ?? 0).toFixed(3), paid: (fee.paid ?? 0).toFixed(3),
                remain: remain.toFixed(3),
                status: remain <= 0.0005 ? 'مسدّدة' : (fee.paid > 0 ? 'جزئي' : 'غير مسدّدة'),
              }
            })
          )}
          label="🖨 طباعة تقرير التحصيل"
        />
      </div>
      <div id="pending-payments">
        <PendingPayments initial={pending || []} />
      </div>
      <RiskIndicator currency={school?.currency ?? 'OMR'} />
      {isOwner(role as Role) && school && (
        <BankSettings bank={{
          bank_name: school.bank_name, bank_account: school.bank_account,
          bank_iban: school.bank_iban, bank_holder: school.bank_holder,
          bank_enabled: school.bank_enabled ?? false,
        }} />
      )}
      <div id="fees-table" style={{ scrollMarginTop: 80 }}>
        <div id="overdue" style={{ scrollMarginTop: 80 }} />
        <FeesManager students={students ?? []} school={school} currency={school?.currency ?? 'OMR'} />
      </div>
      <FocusScroller />
    </div>
  )
}
