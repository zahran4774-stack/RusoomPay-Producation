// صفحة الموظفين والرواتب — مكوّن خادم
// يجلب الموظفين وطلبات تعديل الرواتب، ويمرّرها لمكوّنات العميل التفاعلية
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import EmployeesTable from './EmployeesTable'
import AddEmployee from './AddEmployee'
import OrgChart from './OrgChart'
import FocusScroller from '../FocusScroller'
import SalaryRequests from './SalaryRequests'
import InsuranceSettings from './InsuranceSettings'
import PrintButton from '../PrintButton'
import { isOwner, isStaff, type Role } from '@/lib/roles'
import { payslip, type InsRates } from '@/lib/payroll'

export default async function EmployeesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // الدور الحالي (يحدّد: محاسب يطلب / مدير يعتمد)
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const { data: __myRole } = await supabase.rpc('my_role')
  const role = (__myRole ?? profile?.role) ?? 'admin'

  // الرواتب لطاقم المدرسة فقط — لا ولي الأمر أو الطالب
  if (!isStaff(role as Role)) redirect('/dashboard')

  // نسب التأمينات الخاصة بالمدرسة (عُمان افتراضياً، قابلة للتخصيص لباقي الخليج)
  const { data: school } = await supabase
    .from('schools').select('name, vat_number, country, ins_emp_rate, ins_er_rate, ins_cap, ins_expat_exempt, ins_configured').single()
  const rates: InsRates = {
    emp: school?.ins_emp_rate ?? 0.08,
    er: school?.ins_er_rate ?? 0.125,
    cap: school?.ins_cap ?? null,
    expatExempt: school?.ins_expat_exempt ?? true,
  }
  const needsConfig = school && !school.ins_configured

  // الموظفون (RLS يقصرها على المدرسة، والصلاحية للمدير والمحاسب)
  const { data: employees } = await supabase
    .from('employees').select('*').order('code')

  // طلبات تعديل الرواتب المعلّقة
  const { data: requests } = await supabase
    .from('salary_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false })

  const total = (employees ?? []).reduce(
    (acc, e) => {
      const p = payslip(e.basic, e.allowance, e.nationality, rates)
      acc.gross += p.gross; acc.emp += p.empContrib; acc.er += p.erContrib; acc.net += p.net
      return acc
    },
    { gross: 0, emp: 0, er: 0, net: 0 }
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }} dir="rtl">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ color: '#0F2744', marginBottom: 4 }}>الموظفون والرواتب</h1>
          <p style={{ color: '#667', fontSize: 14, marginBottom: 20 }}>
            التأمينات الاجتماعية: الموظف {(rates.emp * 100).toFixed(rates.emp * 100 % 1 ? 2 : 0)}% · صاحب العمل {(rates.er * 100).toFixed(rates.er * 100 % 1 ? 2 : 0)}%{rates.expatExempt ? ' · الوافد معفى' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <PrintButton
            school={{ name: school?.name ?? 'مدرسة', vat: school?.vat_number }}
            title="قائمة الموظفين"
            columns={[
              { key: 'code', label: 'الرقم' },
              { key: 'name', label: 'الاسم' },
              { key: 'title', label: 'المسمى الوظيفي' },
              { key: 'nationality', label: 'الجنسية' },
              { key: 'basic', label: 'الراتب الأساسي' },
              { key: 'allowance', label: 'البدلات' },
              { key: 'iban', label: 'الحساب البنكي' },
            ]}
            rows={(employees ?? []).map((e) => ({
              code: e.code, name: e.full_name, title: e.job_title ?? '—',
              nationality: e.nationality === 'expat' ? 'وافد' : 'مواطن',
              basic: (e.basic ?? 0).toFixed(3), allowance: (e.allowance ?? 0).toFixed(3),
              iban: e.iban ?? '—',
            }))}
            label="🖨 طباعة قائمة الموظفين"
          />
          <PrintButton
            school={{ name: school?.name ?? 'مدرسة', vat: school?.vat_number }}
            title="تقرير الرواتب والتأمينات (WPS)"
            columns={[
              { key: 'name', label: 'الموظف' },
              { key: 'gross', label: 'الإجمالي' },
              { key: 'emp', label: 'تأمين الموظف' },
              { key: 'er', label: 'تأمين صاحب العمل' },
              { key: 'net', label: 'الصافي' },
            ]}
            rows={(employees ?? []).map((e) => {
              const p = payslip(e.basic, e.allowance, e.nationality, rates)
              return {
                name: e.full_name, gross: p.gross.toFixed(3), emp: p.empContrib.toFixed(3),
                er: p.erContrib.toFixed(3), net: p.net.toFixed(3),
              }
            })}
            label="🖨 طباعة الرواتب والتأمينات"
          />
        </div>
      </div>

      {/* تنبيه ضبط النسب لغير العُمانيين */}
      {needsConfig && isOwner(role as Role) && (
        <div style={{ background: '#FBF3D5', border: '1px solid #EAD9A0', borderRadius: 13, padding: 16, marginBottom: 18 }}>
          <b style={{ color: '#7A5C0A' }}>⚙️ اضبط نسب التأمينات لبلدك</b>
          <p style={{ color: '#8A6D0F', fontSize: 13.5, margin: '6px 0 0' }}>
            النسب المعروضة افتراضية. بما أن مدرستك خارج عُمان، حدّد نسب نظام التأمينات في بلدك ليكون الحساب صحيحاً.
          </p>
        </div>
      )}

      {/* إعدادات نسب التأمينات — للمدير فقط */}
      {isOwner(role as Role) && (
        <InsuranceSettings rates={rates} configured={school?.ins_configured ?? true} />
      )}

      {/* لوحة اعتماد الطلبات — للمدير فقط */}
      {isOwner(role as Role) && requests && requests.length > 0 && (
        <div id="salary-requests" style={{ scrollMarginTop: 80 }}>
          <SalaryRequests requests={requests} />
        </div>
      )}
      <FocusScroller />

      {/* جدول الموظفين التفاعلي */}
      {(isOwner(role as Role) || role === 'admin') && (
        <div style={{ marginBottom: 18 }}>
          <AddEmployee />
        </div>
      )}

      <EmployeesTable employees={employees ?? []} role={role} rates={rates} />

      {/* الهيكل التنظيمي (شجرة الموظفين) */}
      <div style={{ marginTop: 18 }}>
        <OrgChart
          employees={(employees ?? []).map((e) => ({
            id: e.id, code: e.code, full_name: e.full_name,
            job_title: e.job_title ?? null, photo_url: e.photo_url ?? null, manager_id: e.manager_id ?? null,
          }))}
          canEdit={isOwner(role as Role)}
        />
      </div>

      {/* ملخص الرواتب والتأمينات */}
      <div style={{ marginTop: 18, background: '#0F2744', color: '#fff', borderRadius: 14, padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14 }}>
        <Sum label="إجمالي الرواتب" v={total.gross} />
        <Sum label="اشتراك الموظفين" v={total.emp} />
        <Sum label="حصة صاحب العمل" v={total.er} />
        <Sum label="صافي المستحق" v={total.net} />
      </div>
    </div>
  )
}

function Sum({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.8 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Cairo' }}>
        {v.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
      </div>
    </div>
  )
}
