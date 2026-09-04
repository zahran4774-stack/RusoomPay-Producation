'use client'
// تسعير المراحل — رسوم سنوية افتراضية لكل مرحلة دراسية، تُستخدم لتعبئة حقل
// "الرسوم السنوية" تلقائياً عند اختيار المرحلة في نموذج تسجيل طالب جديد.
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { GRADES } from '@/lib/academic'

type GradeFee = { grade: string; annual_fee: number }

const input: React.CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid #E3E8EE', fontSize: 14, fontFamily: 'inherit' }

export default function GradePricing({ initial, canEdit }: { initial: GradeFee[]; canEdit: boolean }) {
  const supabase = createClient()
  const initialMap = Object.fromEntries(initial.map((g) => [g.grade, String(g.annual_fee)]))
  const [values, setValues] = useState<Record<string, string>>(initialMap)
  const [savingGrade, setSavingGrade] = useState<string | null>(null)
  const [savedGrade, setSavedGrade] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function save(grade: string) {
    const amount = Number(values[grade] || 0)
    if (!amount || amount <= 0) { setErr(`أدخل رسوماً صحيحة أكبر من صفر لمرحلة ${grade}`); return }
    setErr(null)
    setSavingGrade(grade)
    const { error } = await supabase.rpc('save_grade_fee', { p_grade: grade, p_annual_fee: amount })
    setSavingGrade(null)
    if (error) { setErr(error.message); return }
    setSavedGrade(grade)
    setTimeout(() => setSavedGrade(null), 1500)
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 16, padding: 20, marginBottom: 16 }} dir="rtl">
      <h3 style={{ margin: '0 0 4px', color: '#0F2744', fontSize: 16 }}>تسعير المراحل</h3>
      <p style={{ color: '#667', fontSize: 13, margin: '0 0 16px', lineHeight: 1.7 }}>
        رسم سنوي افتراضي لكل مرحلة — يُملأ تلقائياً في حقل "الرسوم السنوية" عند اختيار المرحلة أثناء تسجيل طالب جديد. يمكن تعديل المبلغ لطالب معيّن بعد التعبئة التلقائية.
      </p>

      {err && <div style={{ color: '#C0392B', fontWeight: 600, fontSize: 13, marginBottom: 12 }}>⚠ {err}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {GRADES.map((g) => (
          <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: '1 1 160px', fontSize: 14, fontWeight: 600, color: '#0F2744' }}>{g}</span>
            <input
              type="number" style={{ ...input, flex: '0 0 150px' }} dir="ltr"
              value={values[g] ?? ''} disabled={!canEdit}
              onChange={(e) => setValues((p) => ({ ...p, [g]: e.target.value }))}
              placeholder="0.000"
            />
            {canEdit && (
              <button
                onClick={() => save(g)} disabled={savingGrade === g}
                style={{
                  flex: '0 0 auto', padding: '8px 16px', borderRadius: 9, border: 0, cursor: savingGrade === g ? 'default' : 'pointer',
                  fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                  background: savedGrade === g ? '#EAF7F0' : '#163B68', color: savedGrade === g ? '#15803D' : '#fff',
                }}>
                {savingGrade === g ? '...' : savedGrade === g ? '✓ حُفظ' : 'حفظ'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
