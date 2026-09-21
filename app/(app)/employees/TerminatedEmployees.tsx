'use client'
// الموظفون منتهو الخدمة — عرض مطوي أسفل الجدول + إعادة التفعيل (للتراجع عن إنهاء بالخطأ)
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { employeeTypeLabel, terminationReasonLabel } from '@/lib/employee-types'

type Row = {
  id: string; code: string; full_name: string; job_title: string | null
  employee_type: string | null; termination_reason: string | null; deleted_at: string
}

export default function TerminatedEmployees({ rows, canManage }: { rows: Row[]; canManage: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState('')

  async function reinstate(r: Row) {
    if (!confirm(`إعادة تفعيل ${r.full_name}؟ سيعود إلى قائمة الموظفين ودورات الرواتب القادمة.`)) return
    setBusy(r.id); setErr('')
    try {
      const { error } = await supabase.rpc('reinstate_employee', { p_id: r.id })
      setBusy(null)
      if (error) { setErr(error.message); return }
      router.refresh()
    } catch {
      setBusy(null)
      setErr('تعذّر الاتصال — تحقّق من الإنترنت وحاول مجدداً')
    }
  }

  if (rows.length === 0) return null

  const th: React.CSSProperties = { padding: 10, textAlign: 'right', background: '#F4F6F9', color: '#0F2744', fontSize: 12.5, whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: 10, fontSize: 13, borderBottom: '1px solid #EEF2F1' }

  return (
    <details style={{ marginTop: 18, background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,.08)', overflow: 'hidden' }}>
      <summary style={{ padding: '14px 18px', cursor: 'pointer', fontWeight: 700, color: '#0F2744', fontSize: 14.5 }}>
        منتهو الخدمة ({rows.length})
      </summary>
      {err && <div style={{ background: '#FBE9E9', color: '#8A2B2B', padding: 10, fontSize: 13 }}>⚠ {err}</div>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr>
              <th style={th}>الرقم الوظيفي</th><th style={th}>الاسم</th><th style={th}>المسمى</th>
              <th style={th}>النوع</th><th style={th}>تاريخ الإنهاء</th><th style={th}>السبب</th>
              {canManage && <th style={th}></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, fontWeight: 700 }}>{r.code}</td>
                <td style={td}>{r.full_name}</td>
                <td style={td}>{r.job_title || '—'}</td>
                <td style={td}>{employeeTypeLabel(r.employee_type)}</td>
                <td style={{ ...td, direction: 'ltr', textAlign: 'right' }}>{r.deleted_at.slice(0, 10)}</td>
                <td style={td}>{terminationReasonLabel(r.termination_reason)}</td>
                {canManage && (
                  <td style={td}>
                    <button onClick={() => reinstate(r)} disabled={busy === r.id}
                      style={{ background: '#EEF2F9', color: '#163B68', border: '1px solid #D8E2EF', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                      {busy === r.id ? '…' : '↩ إعادة تفعيل'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
