'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

export default function NewRunButton() {
  const router = useRouter()
  const now = new Date()
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function create() {
    setBusy(true); setErr(null)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('profiles').select('school_id').eq('id', user?.id).single()

    if (!profile?.school_id) { setErr('تعذّر تحديد المدرسة'); setBusy(false); return }

    const { data, error } = await supabase.rpc('generate_payroll_run', {
      p_school_id: profile.school_id,
      p_year: year,
      p_month: month,
      p_value_date: null,
    })

    setBusy(false)
    if (error) { setErr(error.message); return }
    setOpen(false)
    router.push(`/payroll/${data}`)
    router.refresh()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ background: '#0F2744', color: '#fff', border: 0, borderRadius: 11,
                 padding: '11px 20px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer',
                 fontFamily: 'inherit' }}>
        + دورة رواتب جديدة
      </button>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E6E9EF', borderRadius: 14,
                  padding: 16, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div>
        <label style={{ display: 'block', fontSize: 12.5, color: '#667', marginBottom: 5 }}>الشهر</label>
        <select value={month} onChange={(e) => setMonth(+e.target.value)} style={sel}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12.5, color: '#667', marginBottom: 5 }}>السنة</label>
        <input type="number" value={year} onChange={(e) => setYear(+e.target.value)}
               style={{ ...sel, width: 100 }} />
      </div>
      <button onClick={create} disabled={busy}
        style={{ background: busy ? '#8894A8' : '#0F2744', color: '#fff', border: 0, borderRadius: 10,
                 padding: '10px 18px', fontWeight: 600, cursor: busy ? 'default' : 'pointer',
                 fontFamily: 'inherit' }}>
        {busy ? 'جارٍ التوليد…' : 'توليد'}
      </button>
      <button onClick={() => { setOpen(false); setErr(null) }}
        style={{ background: 'transparent', color: '#667', border: '1px solid #DCE1E8',
                 borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>
        إلغاء
      </button>
      {err && <div style={{ color: '#8A2B2B', fontSize: 13, width: '100%' }}>{err}</div>}
    </div>
  )
}

const sel: React.CSSProperties = {
  border: '1px solid #DCE1E8', borderRadius: 10, padding: '9px 12px',
  fontSize: 14, fontFamily: 'inherit', background: '#fff',
}
