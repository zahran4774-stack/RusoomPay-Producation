'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import type { Role } from '@/lib/roles'

export default function RunActions({
  runId, status, role, hasIssues,
}: {
  runId: string
  status: string
  role: Role
  hasIssues: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const canApprove = role === 'owner' || role === 'admin' || role === 'accountant'

  async function call(fn: string, args: Record<string, unknown>, label: string) {
    if (!confirm(`تأكيد ${label}؟ لا يمكن التراجع بعد التنفيذ.`)) return
    setBusy(fn); setErr(null)
    const supabase = createClient()
    const { error } = await supabase.rpc(fn, args)
    setBusy(null)
    if (error) { setErr(error.message); return }
    router.refresh()
  }

  async function exportWps() {
    setBusy('export'); setErr(null)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('export_wps_rows', { p_run_id: runId })
    setBusy(null)
    if (error) { setErr(error.message); return }
    if (!data || data.length === 0) { setErr('لا توجد بيانات للتصدير'); return }

    const headers = ['No','Account Number','Employee Name','Bank Name','ID Type',
                     'ID Number','Working Days','Basic Salary','Extra Income',
                     'Deductions','Social Security','Net Salary']
    const rows = data.map((r: any) => [
      r.seq_no, r.account_number, r.employee_name, r.bank_name, r.id_type,
      r.id_number, r.working_days, r.basic_salary, r.extra_income,
      r.deductions, r.social_security, r.net_salary,
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((c: any) => `"${String(c ?? '')}"`).join(','))
      .join('\r\n')

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `WPS-${runId.slice(0, 8)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {status === 'draft' && canApprove && (
        <button onClick={() => call('approve_payroll_run', { p_run_id: runId }, 'اعتماد الدورة')}
                disabled={busy !== null} style={btn('#0F2744')}>
          {busy === 'approve_payroll_run' ? 'جارٍ…' : '✓ اعتماد محاسبي'}
        </button>
      )}

      {status === 'approved' && canApprove && (
        <button onClick={() => call('pay_payroll_run',
                  { p_run_id: runId, p_payment_date: null, p_bank_code: '1120' }, 'صرف الرواتب')}
                disabled={busy !== null} style={btn('#1B6B3A')}>
          {busy === 'pay_payroll_run' ? 'جارٍ…' : '💸 تسجيل الصرف'}
        </button>
      )}

      <button onClick={exportWps} disabled={busy !== null || hasIssues}
              title={hasIssues ? 'أكمل البيانات الناقصة أولاً' : ''}
              style={btn(hasIssues ? '#B4BCC8' : '#1B4F8A')}>
        {busy === 'export' ? 'جارٍ…' : '⬇ تصدير ملف حماية الأجور'}
      </button>

      {err && <div style={{ color: '#8A2B2B', fontSize: 13, width: '100%' }}>{err}</div>}
    </div>
  )
}

function btn(bg: string): React.CSSProperties {
  return {
    background: bg, color: '#fff', border: 0, borderRadius: 11,
    padding: '10px 18px', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  }
}
