// تخطيط وحدة الرواتب — يضيف شريط تبويب "الموظفون/الرواتب" فوق كل صفحات
// /payroll (القائمة، تفاصيل الدورة /payroll/[id]، والإعدادات /payroll/settings)
// دون تكراره في كل ملف. المصادقة تبقى في كل صفحة كما هي — هذا التخطيط لا
// يستبدلها، فقط يضيف الشريط. أب هذا التخطيط (app/(app)/layout.tsx) يضمن
// وجود مستخدم مسجَّل دخوله قبل الوصول لهذا المستوى.
import { createClient } from '@/lib/supabase-server'
import ModuleTabs from '../ModuleTabs'
import { employeesPayrollTabs } from '../module-tabs-config'
import type { Role } from '@/lib/roles'

export default async function PayrollLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let role: Role = 'admin'
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    role = (profile?.role ?? 'admin') as Role
  }

  return (
    <>
      <div style={{ maxWidth: 1100, margin: '0 auto' }} dir="rtl">
        <ModuleTabs items={employeesPayrollTabs(role)} />
      </div>
      {children}
    </>
  )
}
