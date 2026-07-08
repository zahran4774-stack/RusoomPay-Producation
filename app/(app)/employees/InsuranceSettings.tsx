'use client'
// إعدادات نسب التأمينات — للمدير فقط
// عُمان: النسب معروفة ومضبوطة. باقي الخليج: المدير يحدّدها يدوياً
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import type { InsRates } from '@/lib/payroll'

export default function InsuranceSettings({ rates, configured }: { rates: InsRates; configured: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [emp, setEmp] = useState((rates.emp * 100).toString())
  const [er, setEr] = useState((rates.er * 100).toString())
  const [cap, setCap] = useState(rates.cap != null ? rates.cap.toString() : '')
  const [exempt, setExempt] = useState(rates.expatExempt)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setMsg('')
    const e = parseFloat(emp), r = parseFloat(er)
    if (isNaN(e) || isNaN(r) || e < 0 || e > 100 || r < 0 || r > 100) { setMsg('النسب يجب أن تكون بين 0 و 100'); return }
    setBusy(true)
    const { error } = await supabase.rpc('update_insurance_rates', {
      p_emp_rate: e / 100, p_er_rate: r / 100,
      p_cap: cap.trim() ? parseFloat(cap) : null, p_expat_exempt: exempt,
    })
    setBusy(false)
    if (error) { setMsg('تعذّر الحفظ: ' + error.message); return }
    setMsg('✓ تم حفظ نسب التأمينات')
    setOpen(false)
    router.refresh()
  }

  const inp = { width: '100%', padding: 11, margin: '5px 0 14px', borderRadius: 10, border: '1.5px solid #DDE3EC', fontFamily: 'inherit', fontSize: 14 }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 18, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <b style={{ color: '#0F2744' }}>⚙️ نسب التأمينات</b>
          <div style={{ fontSize: 13, color: '#667', marginTop: 4 }}>
            الموظف {(rates.emp * 100).toFixed(2)}% · صاحب العمل {(rates.er * 100).toFixed(2)}%
            {rates.cap != null ? ` · حد أقصى ${rates.cap}` : ' · بلا حد'}
            {rates.expatExempt ? ' · الوافد معفى' : ''}
          </div>
        </div>
        <button onClick={() => { setOpen(!open); setMsg('') }}
          style={{ background: '#163B68', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          {open ? 'إغلاق' : 'تعديل النسب'}
        </button>
      </div>

      {msg && <div style={{ marginTop: 12, padding: 10, borderRadius: 9, fontSize: 14, background: msg.startsWith('✓') ? '#E6F4EC' : '#FCE9E6', color: msg.startsWith('✓') ? '#1A7A45' : '#C0392B' }}>{msg}</div>}

      {open && (
        <div style={{ marginTop: 16, borderTop: '1px solid #EEF2F1', paddingTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600 }}>نسبة اشتراك الموظف (%)</label>
              <input type="number" step="0.01" value={emp} onChange={(e) => setEmp(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600 }}>نسبة حصة صاحب العمل (%)</label>
              <input type="number" step="0.01" value={er} onChange={(e) => setEr(e.target.value)} style={inp} />
            </div>
          </div>
          <label style={{ fontSize: 13, fontWeight: 600 }}>الحد الأقصى للراتب الخاضع (اتركه فارغاً = بلا حد)</label>
          <input type="number" value={cap} onChange={(e) => setCap(e.target.value)} placeholder="مثال: 3000" style={inp} />

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: '#F4F8F7', padding: 12, borderRadius: 10, marginBottom: 14 }}>
            <input type="checkbox" checked={exempt} onChange={(e) => setExempt(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#163B68' }} />
            <span style={{ fontSize: 14 }}>إعفاء الوافدين من التأمينات (كما في عُمان)</span>
          </label>

          <div style={{ fontSize: 12, color: '#889', marginBottom: 14, lineHeight: 1.8 }}>
            💡 عُمان: الموظف 8% · صاحب العمل 12.5% · حد 3000 · الوافد معفى. لباقي دول الخليج، أدخل نسب نظام التأمينات في بلدك.
          </div>

          <button onClick={save} disabled={busy}
            style={{ width: '100%', padding: 13, background: '#163B68', color: '#fff', border: 'none', borderRadius: 11, fontWeight: 700, cursor: 'pointer' }}>
            {busy ? 'جارٍ الحفظ…' : 'حفظ النسب'}
          </button>
        </div>
      )}
    </div>
  )
}
