// صفحة دورات الرواتب — مكوّن خادم
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import NewRunButton from './NewRunButton'
import { isStaff, type Role } from '@/lib/roles'

const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  draft:     { label: 'مسودة',  bg: '#F1F3F6', fg: '#556' },
  approved:  { label: 'معتمدة', bg: '#E7F0FB', fg: '#1B4F8A' },
  paid:      { label: 'مصروفة', bg: '#E6F6EC', fg: '#1B6B3A' },
  cancelled: { label: 'ملغاة',  bg: '#FBE9E9', fg: '#8A2B2B' },
}

export default async function PayrollPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: runs }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('payroll_runs')
      .select('id, period_year, period_month, status, total_gross, total_net, total_pasi_er')
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false }),
  ])

  const role = (profile?.role ?? 'admin') as Role
  if (!isStaff(role)) redirect('/dashboard')

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }} dir="rtl">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ color: '#0F2744', marginBottom: 4 }}>دورات الرواتب</h1>
          <p style={{ color: '#667', fontSize: 14, marginBottom: 20 }}>
            توليد الرواتب الشهرية، اعتمادها محاسبياً، وتصدير ملف حماية الأجور
          </p>
        </div>
        <NewRunButton />
      </div>

      {(!runs || runs.length === 0) ? (
        <div style={{ background: '#fff', border: '1px solid #E6E9EF', borderRadius: 14, padding: 40, textAlign: 'center', color: '#889' }}>
          لا توجد دورات رواتب بعد. ابدأ بإنشاء دورة الشهر الحالي.
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E6E9EF', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#F7F9FC', color: '#556' }}>
                <Th>الفترة</Th>
                <Th>الحالة</Th>
                <Th>إجمالي الرواتب</Th>
                <Th>الصافي</Th>
                <Th>حصة صاحب العمل</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const st = STATUS[r.status] ?? STATUS.draft
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid #EEF1F5' }}>
                    <Td>{MONTHS[r.period_month - 1]} {r.period_year}</Td>
                    <Td>
                      <span style={{ background: st.bg, color: st.fg, padding: '3px 10px', borderRadius: 20, fontSize: 12.5, fontWeight: 600 }}>
                        {st.label}
                      </span>
                    </Td>
                    <Td>{fmt(r.total_gross)}</Td>
                    <Td><b>{fmt(r.total_net)}</b></Td>
                    <Td>{fmt(r.total_pasi_er)}</Td>
                    <Td>
                      <Link href={`/payroll/${r.id}`} style={{ color: '#1B4F8A', fontWeight: 600, textDecoration: 'none' }}>
                        التفاصيل ←
                      </Link>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th style={{ textAlign: 'right', padding: '12px 14px', fontWeight: 600 }}>{children}</th>
}

function Td({ children }: { children?: React.ReactNode }) {
  return <td style={{ padding: '12px 14px', color: '#334' }}>{children}</td>
}

function fmt(v: number | null) {
  return (v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}
