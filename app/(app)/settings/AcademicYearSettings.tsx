'use client'
// إدارة الأعوام الدراسية — إنشاء وتعيين العام الحالي
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

type Year = { id: string; label: string; start_date: string; end_date: string; is_current: boolean }

export default function AcademicYearSettings({ initial }: { initial: Year[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  async function create() {
    setErr(''); setMsg('')
    if (!label.trim()) { setErr('أدخل اسم العام الدراسي'); return }
    if (!startDate || !endDate) { setErr('أدخل تاريخي البداية والنهاية'); return }
    if (startDate >= endDate) { setErr('تاريخ البداية يجب أن يسبق النهاية'); return }

    setSaving(true)
    const { error } = await supabase.rpc('create_academic_year', {
      p_label: label.trim(),
      p_start_date: startDate,
      p_end_date: endDate,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setLabel(''); setStartDate(''); setEndDate('')
    setOpen(false)
    setMsg('✓ تم إنشاء العام الدراسي')
    router.refresh()
  }

  async function setCurrent(id: string) {
    setBusyId(id); setErr(''); setMsg('')
    const { error } = await supabase.rpc('set_current_academic_year', { p_id: id })
    setBusyId(null)
    if (error) { setErr(error.message); return }
    setMsg('✓ صار هذا هو العام الدراسي الحالي')
    router.refresh()
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: 10, margin: '5px 0 12px', borderRadius: 9,
    border: '1.5px solid #DDE3EC', fontFamily: 'inherit', fontSize: 14,
  }
  const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#0F2744' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p style={{ color: '#667', fontSize: 13.5, margin: 0 }}>
          الأعوام الدراسية تنظّم الرسوم والخدمات لكل سنة على حدة.
        </p>
        <button onClick={() => setOpen((v) => !v)}
          style={{ background: '#163B68', color: '#fff', border: 0, borderRadius: 10,
                   padding: '9px 18px', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit',
                   whiteSpace: 'nowrap' }}>
          ＋ عام دراسي جديد
        </button>
      </div>

      {err && <div style={{ background: '#FBE9E9', color: '#8A2B2B', padding: 11, borderRadius: 9, marginBottom: 12, fontSize: 13.5, fontWeight: 600 }}>⚠ {err}</div>}
      {msg && <div style={{ background: '#E6F4EC', color: '#1A7A45', padding: 11, borderRadius: 9, marginBottom: 12, fontSize: 13.5, fontWeight: 600 }}>{msg}</div>}

      {open && (
        <div style={{ background: '#F7F9FC', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <label style={lbl}>اسم العام الدراسي</label>
          <input style={inp} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="2026-2027" dir="ltr" />

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>تاريخ البداية</label>
              <input type="date" style={inp} value={startDate} onChange={(e) => setStartDate(e.target.value)} dir="ltr" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>تاريخ النهاية</label>
              <input type="date" style={inp} value={endDate} onChange={(e) => setEndDate(e.target.value)} dir="ltr" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={create} disabled={saving}
              style={{ background: saving ? '#8AA' : '#1A7A45', color: '#fff', border: 0, borderRadius: 9,
                       padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'جارٍ الحفظ…' : 'إنشاء'}
            </button>
            <button onClick={() => setOpen(false)} disabled={saving}
              style={{ background: '#F0F3F8', color: '#0F2744', border: 0, borderRadius: 9,
                       padding: '10px 18px', cursor: 'pointer', fontFamily: 'inherit' }}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      {initial.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #E6E9EF', borderRadius: 12, padding: 24, textAlign: 'center', color: '#8A94A6', fontSize: 13.5 }}>
          لا توجد أعوام دراسية بعد — أنشئ أول عام لتنظيم الرسوم والخدمات
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E6E9EF', borderRadius: 12, overflow: 'hidden' }}>
          {initial.map((y, i) => (
            <div key={y.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '13px 16px', borderTop: i === 0 ? 'none' : '1px solid #EEF1F5', flexWrap: 'wrap', gap: 8,
            }}>
              <div>
                <div style={{ fontWeight: 700, color: '#0F2744', fontSize: 14.5 }}>
                  {y.label}
                  {y.is_current && (
                    <span style={{ marginInlineStart: 8, background: '#E6F4EC', color: '#1A7A45',
                                   fontSize: 11.5, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>
                      الحالي
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: '#8A94A6', marginTop: 2 }}>
                  {y.start_date} — {y.end_date}
                </div>
              </div>
              {!y.is_current && (
                <button onClick={() => setCurrent(y.id)} disabled={busyId === y.id}
                  style={{ background: '#EEF2F9', color: '#163B68', border: '1px solid #D8E2EF', borderRadius: 8,
                           padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {busyId === y.id ? 'جارٍ…' : 'تعيين كحالي'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
