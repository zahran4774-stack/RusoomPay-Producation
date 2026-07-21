'use client'
// منح موظف صلاحية دخول للنظام — ينشئ دعوة ببريده ويرسلها عبر Resend
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default function GrantAccess({
  employeeId, employeeName, email,
}: {
  employeeId: string; employeeName: string; email: string | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState('accountant')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)
  const [mailFailed, setMailFailed] = useState(false)

  // بلا بريد → لا يمكن منح الدخول
  if (!email || !email.trim()) {
    return <span style={{ fontSize: 12, color: '#B0B8C4' }} title="أضف بريداً للموظف أولاً">—</span>
  }

  async function grant() {
    setErr(''); setBusy(true)
    const { error } = await supabase.rpc('grant_employee_access', {
      p_employee_id: employeeId,
      p_role: role,
    })

    if (error) { setBusy(false); setErr(error.message); return }

    // إرسال بريد الدعوة — الصلاحية مُنحت بنجاح حتى لو فشل البريد
    let mailed = true
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: employeeName, role }),
      })
      if (!res.ok) mailed = false
    } catch {
      mailed = false
    }

    setBusy(false)
    setOk(true)
    setMailFailed(!mailed)
    router.refresh()
    setTimeout(() => { setOk(false); setMailFailed(false); setOpen(false) }, 3000)
  }

  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #E3E8EE', fontSize: 14, fontFamily: 'inherit' }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} title="منح هذا الموظف حساب دخول"
        style={{ background: '#F2F5F8', color: '#0F2744', border: 0, padding: '6px 12px', borderRadius: 8, fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
        🔑 صلاحية دخول
      </button>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,37,64,.45)', display: 'grid', placeItems: 'center', zIndex: 999, padding: 16 }}
      onClick={() => !busy && setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 18, padding: 26, width: '100%', maxWidth: 400, boxShadow: '0 24px 60px -20px rgba(10,37,64,.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 17, color: '#0F2744' }}>منح صلاحية دخول</h3>
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 0, fontSize: 22, cursor: 'pointer', color: '#667' }}>×</button>
        </div>
        <div style={{ color: '#667', fontSize: 13, marginBottom: 16 }}>
          {employeeName} · <span dir="ltr">{email}</span>
        </div>

        <label style={{ fontSize: 12.5, fontWeight: 700, color: '#0F2744', marginBottom: 6, display: 'block' }}>الدور</label>
        <select style={input} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="accountant">محاسب — الرسوم والمحاسبة</option>
          <option value="admin">إداري — الطلاب والموظفون</option>
        </select>

        <div style={{ background: '#F7FAFC', border: '1px solid #E3E8EE', borderRadius: 10, padding: '12px 14px', margin: '14px 0', fontSize: 12.5, color: '#667', lineHeight: 1.8 }}>
          ستُرسَل دعوة على بريد الموظف. عليه التسجيل بنفس البريد،
          فيُربَط بمدرستك ودوره تلقائياً عند أول دخول.
        </div>

        {err && <div style={{ color: '#C0392B', marginBottom: 12, fontWeight: 600, fontSize: 13 }}>⚠ {err}</div>}
        {ok && !mailFailed && (
          <div style={{ color: '#067647', marginBottom: 12, fontWeight: 700, fontSize: 13 }}>
            ✓ مُنحت الصلاحية وأُرسلت الدعوة على بريده
          </div>
        )}
        {ok && mailFailed && (
          <div style={{ color: '#8A6D0F', marginBottom: 12, fontWeight: 700, fontSize: 13, lineHeight: 1.7 }}>
            ✓ مُنحت الصلاحية — لكن تعذّر إرسال البريد، أخبره بالتسجيل يدوياً بنفس بريده
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={grant} disabled={busy}
            style={{ flex: 1, background: busy ? '#8AA' : '#163B68', color: '#fff', border: 0, padding: '12px', borderRadius: 11, fontWeight: 800, fontSize: 14.5, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {busy ? 'جارٍ المنح…' : 'منح الصلاحية'}
          </button>
          <button onClick={() => setOpen(false)} disabled={busy}
            style={{ background: '#F2F5F8', color: '#0F2744', border: 0, padding: '12px 20px', borderRadius: 11, fontWeight: 700, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  )
}
