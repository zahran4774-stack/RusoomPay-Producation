// app/(app)/organization/page.tsx
// نظرة تجميعية للمالك على كل فروعه معاً — جنباً إلى جنب، مع صف إجمالي.
// تُعرض فقط لمن يملك عضوية "مالك" فعّالة في أكثر من فرع واحد.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { Building2 } from 'lucide-react'

type BranchOverview = {
  school_id: string
  school_name: string
  branch: string | null
  students: number
  employees: number
  fees_total: number
  fees_paid: number
  collection_rate: number
  revenue: number
  expense: number
  profit: number
}

function fmt(n: number) {
  return n.toLocaleString('ar', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default async function OrganizationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase.rpc('org_overview')
  const rows = (data ?? []) as BranchOverview[]

  // فرع واحد فقط أو لا شيء → لا معنى لهذه الصفحة، أعِد للوحة التحكم
  if (rows.length < 2) redirect('/dashboard')

  const totals = rows.reduce((acc, r) => ({
    students: acc.students + r.students,
    employees: acc.employees + r.employees,
    fees_total: acc.fees_total + Number(r.fees_total),
    fees_paid: acc.fees_paid + Number(r.fees_paid),
    revenue: acc.revenue + Number(r.revenue),
    expense: acc.expense + Number(r.expense),
    profit: acc.profit + Number(r.profit),
  }), { students: 0, employees: 0, fees_total: 0, fees_paid: 0, revenue: 0, expense: 0, profit: 0 })

  const totalRate = totals.fees_total > 0 ? Math.round((totals.fees_paid / totals.fees_total) * 100) : 100

  const cols: { key: keyof BranchOverview; label: string; money?: boolean }[] = [
    { key: 'students', label: 'الطلاب' },
    { key: 'employees', label: 'الموظفون' },
    { key: 'fees_total', label: 'إجمالي الرسوم', money: true },
    { key: 'fees_paid', label: 'المحصّل', money: true },
    { key: 'collection_rate', label: 'نسبة التحصيل' },
    { key: 'revenue', label: 'الإيرادات', money: true },
    { key: 'expense', label: 'المصروفات', money: true },
    { key: 'profit', label: 'الربح', money: true },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }} dir="rtl">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Building2 size={22} color="#0F2744" strokeWidth={2} />
        <h1 style={{ color: '#0F2744', fontSize: 24, margin: 0 }}>نظرة عامة على الفروع</h1>
      </div>
      <p style={{ color: '#667', fontSize: 14, marginBottom: 24 }}>
        مقارنة بين كل فروعك (العام الحالي) — {rows.length} فرع.
      </p>

      <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #E3E8EE', borderRadius: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 760 }}>
          <thead>
            <tr style={{ background: '#F7F9FB', textAlign: 'right' }}>
              <th style={{ padding: '12px 14px', fontWeight: 700, color: '#0F2744', whiteSpace: 'nowrap' }}>الفرع</th>
              {cols.map((c) => (
                <th key={c.key} style={{ padding: '12px 14px', fontWeight: 700, color: '#0F2744', whiteSpace: 'nowrap' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.school_id} style={{ borderTop: '1px solid #F0F3F7' }}>
                <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0F2744', whiteSpace: 'nowrap' }}>
                  {r.school_name}{r.branch ? ` — ${r.branch}` : ''}
                </td>
                {cols.map((c) => (
                  <td key={c.key} style={{ padding: '12px 14px', color: '#334', whiteSpace: 'nowrap' }}>
                    {c.money ? fmt(Number(r[c.key])) : c.key === 'collection_rate' ? `${r[c.key]}%` : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #E3E8EE', background: '#F7F9FB' }}>
              <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0F2744' }}>الإجمالي</td>
              <td style={{ padding: '12px 14px', fontWeight: 800 }}>{totals.students}</td>
              <td style={{ padding: '12px 14px', fontWeight: 800 }}>{totals.employees}</td>
              <td style={{ padding: '12px 14px', fontWeight: 800 }}>{fmt(totals.fees_total)}</td>
              <td style={{ padding: '12px 14px', fontWeight: 800 }}>{fmt(totals.fees_paid)}</td>
              <td style={{ padding: '12px 14px', fontWeight: 800 }}>{totalRate}%</td>
              <td style={{ padding: '12px 14px', fontWeight: 800 }}>{fmt(totals.revenue)}</td>
              <td style={{ padding: '12px 14px', fontWeight: 800 }}>{fmt(totals.expense)}</td>
              <td style={{ padding: '12px 14px', fontWeight: 800, color: totals.profit >= 0 ? '#15803D' : '#A5331F' }}>{fmt(totals.profit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
